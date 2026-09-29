const { test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

const storageDir = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'dms-backend-test-'));
process.env.STORAGE_DIR = storageDir;
process.env.MAX_FILE_SIZE_BYTES = '1024';
process.env.DMS_DEFAULT_OWNER = 'test-user';

const app = require('../src/app');
let server;
let baseUrl;

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  if (server) {
    await new Promise((resolve, reject) => {
      server.close((error) => (error ? reject(error) : resolve()));
    });
  }
  await fs.rm(storageDir, { recursive: true, force: true });
});

test('o app backend é exportado e mantém o health check', async () => {
  assert.ok(app, 'o app deve estar definido');
  assert.strictEqual(typeof app, 'function', 'o app Express deve ser uma função');

  const response = await fetch(`${baseUrl}/health`);
  assert.equal(response.status, 200);
  assert.deepEqual(await response.json(), { status: 'ok' });

  const configResponse = await fetch(`${baseUrl}/config`);
  assert.equal(configResponse.status, 200);
  assert.deepEqual(await configResponse.json(), { maxFileSizeBytes: 1024 });
});

test('faz upload, lista e baixa um documento', async () => {
  const form = new FormData();
  form.append('file', new Blob(['conteúdo do documento']), 'relatorio.txt');

  const uploadResponse = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
  assert.equal(uploadResponse.status, 201);
  const document = await uploadResponse.json();
  assert.match(document.id, /^[0-9a-f-]{36}$/i);
  assert.deepEqual(
    { ...document, uploadedAt: undefined },
    {
      id: document.id,
      originalName: 'relatorio.txt',
      size: Buffer.byteLength('conteúdo do documento'),
      uploadedAt: undefined,
      owner: 'test-user',
    },
  );
  assert.ok(Number.isNaN(Date.parse(document.uploadedAt)) === false);

  const listResponse = await fetch(`${baseUrl}/documents`);
  assert.equal(listResponse.status, 200);
  assert.deepEqual(await listResponse.json(), { documents: [document] });

  const downloadResponse = await fetch(`${baseUrl}/documents/${document.id}/download`);
  assert.equal(downloadResponse.status, 200);
  assert.match(downloadResponse.headers.get('content-type'), /^application\/octet-stream/);
  assert.match(downloadResponse.headers.get('content-disposition'), /relatorio\.txt/);
  assert.equal(await downloadResponse.text(), 'conteúdo do documento');
});

test('retorna erros estáveis para upload inválido e download inexistente', async () => {
  const missingFileResponse = await fetch(`${baseUrl}/upload`, { method: 'POST' });
  assert.equal(missingFileResponse.status, 400);
  assert.equal((await missingFileResponse.json()).error.code, 'FILE_REQUIRED');

  const emptyFileForm = new FormData();
  emptyFileForm.append('file', new Blob([]), 'vazio.txt');
  const emptyFileResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: emptyFileForm,
  });
  assert.equal(emptyFileResponse.status, 400);
  assert.equal((await emptyFileResponse.json()).error.code, 'FILE_REQUIRED');

  const oversizedForm = new FormData();
  oversizedForm.append('file', new Blob([new Uint8Array(1025)]), 'grande.bin');
  const oversizedResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: oversizedForm,
  });
  assert.equal(oversizedResponse.status, 413);
  assert.equal((await oversizedResponse.json()).error.code, 'FILE_TOO_LARGE');

  const extraFieldForm = new FormData();
  extraFieldForm.append('metadata', 'untrusted');
  extraFieldForm.append('file', new Blob(['documento']), 'documento.txt');
  const extraFieldResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: extraFieldForm,
  });
  assert.equal(extraFieldResponse.status, 201);

  const tooManyFieldsForm = new FormData();
  for (let fieldIndex = 0; fieldIndex < 9; fieldIndex += 1) {
    tooManyFieldsForm.append(`extra${fieldIndex}`, 'valor');
  }
  tooManyFieldsForm.append('file', new Blob(['documento']), 'documento.txt');
  const tooManyFieldsResponse = await fetch(`${baseUrl}/upload`, {
    method: 'POST',
    body: tooManyFieldsForm,
  });
  assert.equal(tooManyFieldsResponse.status, 400);
  assert.equal((await tooManyFieldsResponse.json()).error.code, 'INVALID_FIELD');

  const invalidIdResponse = await fetch(`${baseUrl}/documents/invalido/download`);
  assert.equal(invalidIdResponse.status, 400);
  assert.equal((await invalidIdResponse.json()).error.code, 'INVALID_DOCUMENT_ID');

  const traversalResponse = await fetch(`${baseUrl}/documents/..%2F..%2Fprivate/download`);
  assert.equal(traversalResponse.status, 400);
  assert.equal((await traversalResponse.json()).error.code, 'INVALID_DOCUMENT_ID');

  const missingDocumentResponse = await fetch(
    `${baseUrl}/documents/00000000-0000-4000-8000-000000000000/download`,
  );
  assert.equal(missingDocumentResponse.status, 404);
  assert.equal((await missingDocumentResponse.json()).error.code, 'DOCUMENT_NOT_FOUND');
});

test('remove caminho do nome original sem usá-lo como nome no storage', async () => {
  const form = new FormData();
  form.append('file', new Blob(['dados']), '../fora.txt');
  const response = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
  assert.equal(response.status, 201);
  const document = await response.json();
  assert.equal(document.originalName, 'fora.txt');
  assert.equal(await fs.readFile(path.join(storageDir, document.id), 'utf8'), 'dados');
});

test('não baixa um link simbólico inserido no storage', async () => {
  const outsideDir = await fs.mkdtemp(path.join(os.tmpdir(), 'dms-outside-'));
  try {
    const outsideFile = path.join(outsideDir, 'private.txt');
    await fs.writeFile(outsideFile, 'conteúdo privado');
    const form = new FormData();
    form.append('file', new Blob(['conteúdo original']), 'arquivo.txt');
    const uploadResponse = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
    assert.equal(uploadResponse.status, 201);
    const document = await uploadResponse.json();
    const storedFile = path.join(storageDir, document.id);
    await fs.rm(storedFile);
    await fs.symlink(outsideFile, storedFile);

    const response = await fetch(`${baseUrl}/documents/${document.id}/download`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'DOCUMENT_FILE_NOT_FOUND');
  } finally {
    await fs.rm(outsideDir, { recursive: true, force: true });
  }
});

test('retorna erro de arquivo ausente sem expor caminhos locais', async () => {
  const form = new FormData();
  form.append('file', new Blob(['documento']), 'apagado.txt');
  const uploadResponse = await fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
  assert.equal(uploadResponse.status, 201);
  const document = await uploadResponse.json();
  await fs.rm(path.join(storageDir, document.id));

  const response = await fetch(`${baseUrl}/documents/${document.id}/download`);
  assert.equal(response.status, 404);
  assert.deepEqual(await response.json(), {
    error: { code: 'DOCUMENT_FILE_NOT_FOUND', message: 'O arquivo do documento não foi encontrado.' },
  });
});
