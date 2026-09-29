import { useState } from 'react';
import { downloadDocument } from '../services/documentsApi.js';

export default function DownloadButton({ document }) {
  const [isDownloading, setIsDownloading] = useState(false);
  const [error, setError] = useState('');

  async function handleDownload() {
    if (isDownloading) {
      return;
    }

    setIsDownloading(true);
    setError('');
    try {
      const file = await downloadDocument(document.id);
      const objectUrl = URL.createObjectURL(file);
      const link = window.document.createElement('a');
      link.href = objectUrl;
      link.download = document.originalName;
      link.click();
      URL.revokeObjectURL(objectUrl);
    } catch (downloadError) {
      setError(downloadError.message);
    } finally {
      setIsDownloading(false);
    }
  }

  return (
    <div className="download-control">
      <button
        className="download-button"
        type="button"
        onClick={handleDownload}
        disabled={isDownloading}
        aria-label={`Baixar ${document.originalName}`}
        title="Baixar documento"
      >
        {isDownloading ? '...' : '↓'}
      </button>
      {error && <span className="download-error" role="alert">{error}</span>}
    </div>
  );
}