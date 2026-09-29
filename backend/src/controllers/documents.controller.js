const documentsService = require('../services/documents.service');

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

function sendError(res, status, code, message) {
  return res.status(status).json({ error: { code, message } });
}

function toPublicDocument(document) {
  return {
    id: document.id,
    originalName: document.originalName,
    size: document.size,
    uploadedAt: document.uploadedAt,
    owner: document.owner,
  };
}

async function upload(req, res) {
  if (!req.file) {
    return sendError(res, 400, 'FILE_REQUIRED', 'Envie um arquivo no campo file.');
  }

  try {
    const document = await documentsService.createDocument({
      id: req.file.filename,
      originalName: req.file.originalname,
      size: req.file.size,
    });
    return res.status(201).json(toPublicDocument(document));
  } catch (error) {
    if (error.code === 'FILE_REQUIRED') {
      return sendError(res, 400, error.code, 'Envie um arquivo não vazio no campo file.');
    }
    console.error('Falha no upload:', error.code || 'UNKNOWN');
    return sendError(res, 500, 'UPLOAD_FAILED', 'Não foi possível enviar o documento.');
  }
}

async function list(req, res) {
  try {
    const documents = await documentsService.listDocuments();
    return res.status(200).json({ documents: documents.map(toPublicDocument) });
  } catch (error) {
    console.error('Falha na listagem:', error.code || 'UNKNOWN');
    return sendError(res, 500, 'DOCUMENT_LIST_FAILED', 'Não foi possível listar os documentos.');
  }
}

async function download(req, res) {
  if (!UUID_PATTERN.test(req.params.id)) {
    return sendError(res, 400, 'INVALID_DOCUMENT_ID', 'O identificador do documento é inválido.');
  }

  let download;
  try {
    download = await documentsService.getDocumentForDownload(req.params.id);
  } catch (error) {
    if (error.code === 'DOCUMENT_NOT_FOUND') {
      return sendError(res, 404, error.code, 'Documento não encontrado.');
    }
    if (error.code === 'DOCUMENT_FILE_NOT_FOUND') {
      return sendError(res, 404, error.code, 'O arquivo do documento não foi encontrado.');
    }
    console.error('Falha ao abrir documento:', error.code || 'UNKNOWN');
    return sendError(res, 500, 'DOWNLOAD_FAILED', 'Não foi possível baixar o documento.');
  }

  res.attachment(download.document.originalName);
  res.type('application/octet-stream');
  res.set('Content-Length', String(download.size));
  const stream = download.fileHandle.createReadStream({ autoClose: true });
  stream.on('error', (error) => {
    console.error('Falha ao transmitir documento:', error.code || 'UNKNOWN');
    if (res.headersSent) {
      res.destroy(error);
      return;
    }
    res.removeHeader('Content-Disposition');
    res.removeHeader('Content-Length');
    sendError(res, 500, 'DOWNLOAD_FAILED', 'Não foi possível baixar o documento.');
  });
  res.on('close', () => stream.destroy());
  stream.pipe(res);
}

function handleUploadError(error, res) {
  if (error.code === 'LIMIT_FILE_SIZE') {
    return sendError(res, 413, 'FILE_TOO_LARGE', 'O arquivo excede o tamanho máximo permitido.');
  }
  if (error.code === 'LIMIT_UNEXPECTED_FILE') {
    return sendError(res, 400, 'UNEXPECTED_FILE', 'Envie um único arquivo no campo file.');
  }
  if (error.code === 'LIMIT_FIELD_COUNT' || error.code === 'LIMIT_FIELD_VALUE') {
    return sendError(res, 400, 'INVALID_FIELD', 'Os campos adicionais excedem os limites permitidos.');
  }
  console.error('Falha ao processar multipart:', error.code || 'UNKNOWN');
  return sendError(res, 500, 'UPLOAD_FAILED', 'Não foi possível enviar o documento.');
}

module.exports = {
  upload,
  list,
  download,
  handleUploadError,
};