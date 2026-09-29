const { describe, test, before, after } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs/promises');
const os = require('node:os');
const path = require('node:path');
const { once } = require('node:events');

const storageDir = require('node:fs').mkdtempSync(path.join(os.tmpdir(), 'dms-endpoints-test-'));
process.env.STORAGE_DIR = storageDir;
process.env.MAX_FILE_SIZE_BYTES = '4096';
process.env.DMS_DEFAULT_OWNER = 'endpoint-user';

const app = require('../src/app');
let server;
let baseUrl;

function uploadFile(content, fileName, fieldName = 'file') {
  const form = new FormData();
  form.append(fieldName, new Blob([content]), fileName);
  return fetch(`${baseUrl}/upload`, { method: 'POST', body: form });
}

before(async () => {
  server = app.listen(0);
  await once(server, 'listening');
  baseUrl = `http://127.0.0.1:${server.address().port}`;
});

after(async () => {
  await new Promise((resolve, reject) => {
    server.close((error) => (error ? reject(error) : resolve()));
  });
  await fs.rm(storageDir, { recursive: true, force: true });
});

describe('GET /documents', () => {
  test('retorna lista vazia antes de qualquer upload', async () => {
    const response = await fetch(`${baseUrl}/documents`);
    assert.equal(response.status, 200);
    assert.deepEqual(await response.json(), { documents: [] });
  });
});

describe('POST /upload', () => {
  test('cria o documento, retorna metadados e grava o arquivo no storage', async () => {
    const response = await uploadFile('conteúdo', 'contrato.pdf');
    assert.equal(response.status, 201);

    const document = await response.json();
    assert.deepEqual(Object.keys(document).sort(), ['id', 'originalName', 'owner', 'size', 'uploadedAt']);
    assert.equal(document.originalName, 'contrato.pdf');
    assert.equal(document.size, Buffer.byteLength('conteúdo'));
    assert.equal(document.owner, 'endpoint-user');
    assert.equal(await fs.readFile(path.join(storageDir, document.id), 'utf8'), 'conteúdo');
  });

  test('rejeita arquivo enviado em campo diferente de file', async () => {
    const response = await uploadFile('conteúdo', 'outro.txt', 'attachment');
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'UNEXPECTED_FILE');
  });

  test('rejeita arquivo acima do limite configurado', async () => {
    const response = await uploadFile(new Uint8Array(4097), 'grande.bin');
    assert.equal(response.status, 413);
    assert.equal((await response.json()).error.code, 'FILE_TOO_LARGE');
  });
});

describe('GET /documents após uploads', () => {
  test('lista todos os documentos enviados, do mais recente ao mais antigo', async () => {
    const first = await (await uploadFile('a', 'primeiro.txt')).json();
    await new Promise((resolve) => setTimeout(resolve, 5));
    const second = await (await uploadFile('b', 'segundo.txt')).json();

    const response = await fetch(`${baseUrl}/documents`);
    assert.equal(response.status, 200);
    const { documents } = await response.json();
    const ids = documents.map((document) => document.id);

    assert.ok(ids.indexOf(second.id) < ids.indexOf(first.id));
    assert.deepEqual(documents.find((document) => document.id === first.id), first);
  });
});

describe('GET /documents/:id/download', () => {
  test('baixa o conteúdo binário íntegro com cabeçalhos de anexo', async () => {
    const bytes = Uint8Array.from({ length: 256 }, (_, index) => index);
    const document = await (await uploadFile(bytes, 'dados.bin')).json();

    const response = await fetch(`${baseUrl}/documents/${document.id}/download`);
    assert.equal(response.status, 200);
    assert.match(response.headers.get('content-type'), /^application\/octet-stream/);
    assert.match(response.headers.get('content-disposition'), /^attachment; filename="dados\.bin"/);
    assert.equal(response.headers.get('content-length'), '256');
    assert.deepEqual(new Uint8Array(await response.arrayBuffer()), bytes);
  });

  test('retorna 404 para documento inexistente', async () => {
    const response = await fetch(`${baseUrl}/documents/11111111-1111-4111-8111-111111111111/download`);
    assert.equal(response.status, 404);
    assert.equal((await response.json()).error.code, 'DOCUMENT_NOT_FOUND');
  });

  test('retorna 400 para identificador inválido', async () => {
    const response = await fetch(`${baseUrl}/documents/nao-e-uuid/download`);
    assert.equal(response.status, 400);
    assert.equal((await response.json()).error.code, 'INVALID_DOCUMENT_ID');
  });
});
