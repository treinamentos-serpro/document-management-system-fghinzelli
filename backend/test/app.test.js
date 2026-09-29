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

  const invalidIdResponse = await fetch(`${baseUrl}/documents/invalido/download`);
  assert.equal(invalidIdResponse.status, 400);
  assert.equal((await invalidIdResponse.json()).error.code, 'INVALID_DOCUMENT_ID');

  const missingDocumentResponse = await fetch(
    `${baseUrl}/documents/00000000-0000-4000-8000-000000000000/download`,
  );
  assert.equal(missingDocumentResponse.status, 404);
  assert.equal((await missingDocumentResponse.json()).error.code, 'DOCUMENT_NOT_FOUND');
});
