import { useEffect, useState } from 'react';
import DocumentList from './components/DocumentList.jsx';
import UploadComponent from './components/UploadComponent.jsx';
import { listDocuments } from './services/documentsApi.js';
import './App.css';

export default function App() {
  const [documents, setDocuments] = useState([]);
  const [isLoading, setIsLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [refreshKey, setRefreshKey] = useState(0);
  const [announcement, setAnnouncement] = useState('');

  useEffect(() => {
    let isCurrent = true;

    async function loadDocuments() {
      setIsLoading(true);
      setLoadError('');
      try {
        const result = await listDocuments();
        if (isCurrent) {
          setDocuments(result);
        }
      } catch (error) {
        if (isCurrent) {
          setLoadError(error.message);
        }
      } finally {
        if (isCurrent) {
          setIsLoading(false);
        }
      }
    }

    loadDocuments();
    return () => {
      isCurrent = false;
    };
  }, [refreshKey]);

  function handleUploadComplete(document) {
    setAnnouncement(`${document.originalName} enviado com sucesso.`);
    setRefreshKey((currentKey) => currentKey + 1);
  }

  function refreshDocuments() {
    setRefreshKey((currentKey) => currentKey + 1);
  }

  return (
    <div className="app-shell">
      <header className="app-header">
        <a className="brand" href="#inicio" aria-label="DMS, início">
          <span className="brand-mark" aria-hidden="true">D</span>
          <span className="brand-name">DMS<span> / </span>ARQUIVOS</span>
        </a>
        <span className="header-state"><span aria-hidden="true" /> ARMAZENAMENTO LOCAL</span>
      </header>

      <main id="inicio" className="workspace">
        <div className="page-heading">
          <div>
            <p className="eyebrow">DOCUMENT MANAGEMENT SYSTEM</p>
            <h1>Biblioteca de documentos</h1>
          </div>
          <div className="document-total" aria-label={`${documents.length} documentos`}>
            <span>{String(documents.length).padStart(2, '0')}</span>
            <small>DOCUMENTOS</small>
          </div>
        </div>

        <div className="workspace-grid">
          <UploadComponent onUploaded={handleUploadComplete} />
          <DocumentList
            documents={documents}
            isLoading={isLoading}
            error={loadError}
            onRefresh={refreshDocuments}
          />
        </div>
        <p className="visually-hidden" role="status" aria-live="polite">{announcement}</p>
      </main>

      <footer className="app-footer">
        <span>DMS <span className="footer-separator">/</span> DOCUMENTOS</span>
        <span>ARMAZENAMENTO LOCAL</span>
      </footer>
    </div>
  );
}