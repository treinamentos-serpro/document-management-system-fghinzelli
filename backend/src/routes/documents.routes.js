const crypto = require('node:crypto');
const fs = require('node:fs');
const express = require('express');
const multer = require('multer');
const { maxFileSizeBytes, storageDir } = require('../config');
const documentsController = require('../controllers/documents.controller');

const router = express.Router();

const upload = multer({
  storage: multer.diskStorage({
    destination: (req, file, callback) => {
      fs.mkdir(storageDir, { recursive: true }, (error) => callback(error, storageDir));
    },
    filename: (req, file, callback) => callback(null, crypto.randomUUID()),
  }),
  limits: {
    fileSize: maxFileSizeBytes,
    files: 1,
    fields: 8,
    fieldSize: 1024,
  },
});

router.post('/upload', (req, res, next) => {
  upload.single('file')(req, res, (error) => {
    if (error) {
      return documentsController.handleUploadError(error, res);
    }
    next();
  });
}, documentsController.upload);

router.get('/documents', documentsController.list);
router.get('/documents/:id/download', documentsController.download);

module.exports = router;