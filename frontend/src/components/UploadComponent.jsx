import { useRef, useState } from 'react';
import { uploadDocument } from '../services/documentsApi.js';
import { formatFileSize } from '../utils/formatFileSize.js';

export default function UploadComponent({ onUploaded, maxFileSizeBytes }) {
  const inputRef = useRef(null);
  const [file, setFile] = useState(null);
  const [isUploading, setIsUploading] = useState(false);
  const [error, setError] = useState('');

  function handleFileChange(event) {
    setFile(event.target.files?.[0] || null);
    setError('');
  }

  async function handleSubmit(event) {
    event.preventDefault();
    if (!file || isUploading) {
      return;
    }

    setIsUploading(true);
    setError('');
    try {
      const document = await uploadDocument(file);
      setFile(null);
      if (inputRef.current) {
        inputRef.current.value = '';
      }
      onUploaded(document);
    } catch (uploadError) {
      setError(uploadError.message);
    } finally {
      setIsUploading(false);
    }
  }

  return (
    <section className="upload-section" aria-labelledby="upload-heading">
      <div className="section-heading">
        <span className="section-index">01</span>
        <div>
          <p className="eyebrow">NOVO ARQUIVO</p>
          <h2 id="upload-heading">Enviar documento</h2>
        </div>
      </div>

      <form onSubmit={handleSubmit}>
        <label className={`file-picker${file ? ' has-file' : ''}`}>
          <input
            ref={inputRef}
            type="file"
            onChange={handleFileChange}
            aria-label="Selecionar documento"
          />
          <span className="file-picker-symbol" aria-hidden="true">+</span>
          <span className="file-picker-copy">
            <strong>{file ? file.name : 'Selecionar arquivo'}</strong>
            <small>{file ? formatFileSize(file.size) : maxFileSizeBytes ? `Até ${formatFileSize(maxFileSizeBytes)} por arquivo` : 'Limite definido pelo servidor'}</small>
          </span>
          <span className="file-picker-action">ESCOLHER</span>
        </label>

        {error && <p className="form-error" role="alert">{error}</p>}

        <button className="primary-button upload-submit" type="submit" disabled={!file || isUploading}>
          {isUploading ? 'Enviando...' : 'Enviar documento'}
          {!isUploading && <span aria-hidden="true">↗</span>}
        </button>
      </form>
    </section>
  );
}