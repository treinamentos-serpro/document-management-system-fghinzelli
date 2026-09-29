const fs = require('node:fs/promises');
const { constants } = require('node:fs');
const path = require('node:path');
const { storageDir } = require('../config');

const documentsById = new Map();
const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function resolveStoragePath(storageKey) {
  if (!UUID_PATTERN.test(storageKey)) {
    throw new Error('Chave de armazenamento inválida.');
  }

  const filePath = path.resolve(storageDir, storageKey);
  const relativePath = path.relative(storageDir, filePath);
  if (!relativePath || relativePath.startsWith('..') || path.isAbsolute(relativePath)) {
    throw new Error('Caminho de armazenamento inválido.');
  }

  return filePath;
}

async function create(document) {
  documentsById.set(document.id, { ...document });
}

function list() {
  return [...documentsById.values()]
    .sort((first, second) => second.uploadedAt.localeCompare(first.uploadedAt)
      || first.id.localeCompare(second.id))
    .map((document) => ({ ...document }));
}

function findById(id) {
  const document = documentsById.get(id);
  return document ? { ...document } : null;
}

async function openFile(storageKey) {
  const filePath = resolveStoragePath(storageKey);
  let fileHandle;
  try {
    fileHandle = await fs.open(filePath, constants.O_RDONLY | constants.O_NOFOLLOW);
    const stats = await fileHandle.stat();
    if (!stats.isFile()) {
      await fileHandle.close();
      const error = new Error('Arquivo do documento não encontrado.');
      error.code = 'DOCUMENT_FILE_NOT_FOUND';
      throw error;
    }
    return { fileHandle, size: stats.size };
  } catch (error) {
    if (fileHandle && error.code !== 'DOCUMENT_FILE_NOT_FOUND') {
      await fileHandle.close();
    }
    if (error.code === 'ENOENT' || error.code === 'ELOOP') {
      const notFoundError = new Error('Arquivo do documento não encontrado.');
      notFoundError.code = 'DOCUMENT_FILE_NOT_FOUND';
      throw notFoundError;
    }
    throw error;
  }
}

async function removeFile(storageKey) {
  await fs.rm(resolveStoragePath(storageKey), { force: true });
}

module.exports = {
  create,
  list,
  findById,
  openFile,
  removeFile,
};