const path = require('node:path');
const { defaultOwner } = require('../config');
const documentsRepository = require('../repositories/documents.repository');

function sanitizeOriginalName(originalName) {
  const normalizedName = String(originalName || '')
    .replace(/\\/g, '/')
    .split('/')
    .pop()
    .replace(/[\u0000-\u001f\u007f]/g, '')
    .slice(0, 255);

  return normalizedName || 'document';
}

async function createDocument(file) {
  if (file.size === 0) {
    await documentsRepository.removeFile(file.id);
    const error = new Error('Envie um arquivo não vazio.');
    error.code = 'FILE_REQUIRED';
    throw error;
  }

  const document = {
    id: file.id,
    originalName: sanitizeOriginalName(file.originalName),
    size: file.size,
    uploadedAt: new Date().toISOString(),
    owner: defaultOwner,
    storageKey: file.id,
  };

  try {
    await documentsRepository.create(document);
    return document;
  } catch (error) {
    try {
      await documentsRepository.removeFile(document.storageKey);
    } catch (cleanupError) {
      // A falha de limpeza não deve ocultar o erro original do registro.
    }
    throw error;
  }
}

function listDocuments() {
  return documentsRepository.list();
}

async function getDocumentForDownload(id) {
  const document = documentsRepository.findById(id);
  if (!document) {
    const error = new Error('Documento não encontrado.');
    error.code = 'DOCUMENT_NOT_FOUND';
    throw error;
  }

  const filePath = await documentsRepository.getFilePath(document.storageKey);
  return { document, filePath: path.resolve(filePath) };
}

module.exports = {
  createDocument,
  listDocuments,
  getDocumentForDownload,
};