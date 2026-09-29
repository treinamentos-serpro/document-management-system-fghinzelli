import DownloadButton from './DownloadButton.jsx';
import { formatFileSize } from '../utils/formatFileSize.js';

export default function DocumentList({ documents, isLoading, error, onRefresh }) {
  return (
    <section className="documents-section" aria-labelledby="documents-heading">
      <div className="section-heading documents-heading">
        <span className="section-index">02</span>
        <div>
          <p className="eyebrow">ARQUIVO LOCAL</p>
          <h2 id="documents-heading">Documentos</h2>
        </div>
        <button className="text-button refresh-button" type="button" onClick={onRefresh} disabled={isLoading}>
          <span aria-hidden="true">↻</span> Atualizar
        </button>
      </div>

      <div className="document-table" aria-busy={isLoading}>
        <div className="document-table-head" aria-hidden="true">
          <span>ARQUIVO</span>
          <span>DATA</span>
          <span>TAMANHO</span>
          <span />
        </div>

        {isLoading && <p className="list-message">Carregando documentos...</p>}
        {!isLoading && error && <p className="list-message list-error" role="alert">{error}</p>}
        {!isLoading && !error && documents.length === 0 && (
          <p className="list-message">Nenhum documento enviado.</p>
        )}

        {!isLoading && !error && documents.map((document) => (
          <DocumentRow key={document.id} document={document} />
        ))}
      </div>
    </section>
  );
}

function DocumentRow({ document }) {
  return (
    <article className="document-row">
      <div className="document-name-cell">
        <span className="file-type-mark" aria-hidden="true">{getFileExtension(document.originalName)}</span>
        <div className="document-name-copy">
          <strong title={document.originalName}>{document.originalName}</strong>
          <small>{document.owner}</small>
        </div>
      </div>
      <time className="document-date" dateTime={document.uploadedAt}>
        {formatDate(document.uploadedAt)}
      </time>
      <span className="document-size">{formatFileSize(document.size)}</span>
      <DownloadButton document={document} />
    </article>
  );
}

function getFileExtension(filename) {
  const extension = filename.split('.').pop();
  return extension && extension !== filename ? extension.slice(0, 4).toUpperCase() : 'FILE';
}

function formatDate(value) {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Data indisponível';
  }
  return new Intl.DateTimeFormat('pt-BR', { dateStyle: 'medium' }).format(date);
}
