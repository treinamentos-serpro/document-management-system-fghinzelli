const express = require('express');
const documentsRoutes = require('./routes/documents.routes');
const { port, maxFileSizeBytes } = require('./config');

const app = express();

app.use(express.json());

app.get('/health', (req, res) => {
  res.json({ status: 'ok' });
});

app.get('/config', (req, res) => {
  res.json({ maxFileSizeBytes });
});

app.use(documentsRoutes);

app.use((req, res) => {
  res.status(404).json({
    error: {
      code: 'ROUTE_NOT_FOUND',
      message: 'Rota não encontrada.',
    },
  });
});

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error);
  }
  return res.status(500).json({
    error: {
      code: 'INTERNAL_SERVER_ERROR',
      message: 'Ocorreu um erro interno.',
    },
  });
});

if (require.main === module) {
  app.listen(port, () => {
    console.log(`DMS backend ouvindo na porta ${port}`);
  });
}

module.exports = app;
