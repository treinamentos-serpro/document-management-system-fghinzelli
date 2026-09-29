const API_BASE = '/api';

async function request(path, options) {
  let response;
  try {
    response = await fetch(`${API_BASE}${path}`, options);
  } catch (error) {
    throw new Error('Não foi possível conectar ao servidor.');
  }

  if (!response.ok) {
    let message = 'Não foi possível concluir a solicitação.';
    try {
      const payload = await response.json();
      message = payload.error?.message || message;
    } catch (error) {
      // Mantém uma mensagem segura quando a resposta não contém JSON.
    }
    throw new Error(message);
  }

  return response;
}

export async function listDocuments() {
  const response = await request('/documents');
  const payload = await response.json();
  return payload.documents;
}

export async function uploadDocument(file) {
  const formData = new FormData();
  formData.append('file', file);

  const response = await request('/upload', {
    method: 'POST',
    body: formData,
  });
  return response.json();
}

export async function downloadDocument(id) {
  const response = await request(`/documents/${encodeURIComponent(id)}/download`);
  return response.blob();
}