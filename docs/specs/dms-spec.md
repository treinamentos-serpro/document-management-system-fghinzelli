# Especificação - Document Management System

> Especificação do MVP para orientar a implementação futura. Este documento não implica que os endpoints ou a interface já estejam implementados.

## 1. Objetivo

Entregar uma aplicação web que permita a um usuário enviar, listar e baixar documentos armazenados no filesystem local da aplicação.

## 2. Escopo

### Dentro do escopo

- Upload de um documento por requisição.
- Listagem dos metadados dos documentos registrados na instância em execução.
- Download de um documento pelo identificador.
- Atribuição de um owner local padrão, sem autenticação nesta fase.
- Interface React para upload, listagem e download, consumindo a API via `fetch`.

### Fora do escopo

- Autenticação, autorização e isolamento seguro entre usuários.
- Armazenamento externo, nuvem ou banco de dados.
- Persistência dos metadados entre reinícios da aplicação.
- Versionamento, exclusão, busca, paginação e compartilhamento de documentos.
- Allowlist de extensões ou tipos MIME.

## 3. Requisitos funcionais

| ID | Requisito | Critérios de aceite |
| --- | --- | --- |
| RF-01 | O usuário pode enviar um documento. | A API aceita um arquivo no campo multipart `file`, grava-o no armazenamento local e retorna seus metadados após o registro bem-sucedido. Uma requisição sem arquivo é rejeitada. |
| RF-02 | O usuário pode listar documentos. | A API retorna metadados dos documentos registrados na instância atual, sem expor caminhos ou nomes internos de armazenamento. A lista é ordenada do upload mais recente para o mais antigo. |
| RF-03 | O usuário pode baixar um documento pelo identificador. | A API transmite o conteúdo binário como anexo com o nome original; identificadores sem documento correspondente recebem resposta de não encontrado. |
| RF-04 | A interface permite executar os fluxos do MVP. | A interface permite selecionar e enviar um arquivo, visualizar a lista e iniciar o download, apresentando erros retornados pela API. |

## 4. Requisitos não funcionais

| ID | Requisito |
| --- | --- |
| RNF-01 | Os arquivos devem ser gravados somente no filesystem local, usando multer com `diskStorage` em `backend/storage` por padrão. |
| RNF-02 | Os metadados devem permanecer em memória nesta fase. A perda de metadados após reinício e a possibilidade de arquivos órfãos devem ser documentadas como limitações conhecidas. |
| RNF-03 | Configurações operacionais devem ser fornecidas por variáveis de ambiente, com valores padrão documentados. |
| RNF-04 | O limite máximo de upload deve ser configurável e aplicado antes de aceitar o arquivo. O padrão do MVP é 10 MiB (`10485760` bytes). |
| RNF-05 | A API não deve retornar caminhos absolutos, stack traces ou detalhes internos do filesystem. |
| RNF-06 | O nome original do arquivo não deve ser usado como caminho de armazenamento. Um nome interno gerado pela aplicação deve evitar colisões e traversal. |
| RNF-07 | O backend deve seguir a Clean Architecture simples, com as camadas `routes -> controllers -> services -> repositories`; regras de negócio não devem depender de Express ou multer. |

### Configuração prevista

| Variável | Padrão | Uso |
| --- | --- | --- |
| `PORT` | `3000` | Porta HTTP do backend. |
| `STORAGE_DIR` | `storage` | Diretório local dos arquivos enviados (`backend/storage` no layout do repositório). Caminho relativo deve ser resolvido de forma determinística a partir da raiz do backend. |
| `MAX_FILE_SIZE_BYTES` | `10485760` | Tamanho máximo permitido por arquivo, em bytes. |
| `DMS_DEFAULT_OWNER` | `local-user` | Owner atribuído pelo backend a todos os documentos no MVP sem autenticação. |

Valores ausentes usam os padrões acima. Valores inválidos para porta, diretório ou limite devem impedir a inicialização com erro de configuração claro, sem revelar segredos. O limite deve ser positivo.

## 5. Modelo de dados

### Documento

| Campo | Tipo | Exposição | Descrição |
| --- | --- | --- | --- |
| `id` | string UUID | Público | Identificador único gerado pelo backend. |
| `originalName` | string | Público | Nome original fornecido no upload, preservado como metadado e tratado com segurança ao compor o nome de download. |
| `size` | number inteiro | Público | Tamanho do arquivo em bytes. |
| `uploadedAt` | string ISO 8601 UTC | Público | Instante de conclusão do upload e registro dos metadados. |
| `owner` | string | Público | Identificador local atribuído pelo backend a partir de `DMS_DEFAULT_OWNER`; não representa identidade autenticada. |
| `storageKey` | string | Interno | Nome gerado pela aplicação para localizar o arquivo dentro de `STORAGE_DIR`; não é retornado pela API. |

O registro interno pode ser representado por um objeto de metadados em memória indexado por `id`. O repositório é responsável por associar o registro ao arquivo local, sem expor detalhes do filesystem às camadas internas. O `storageKey` deve ser gerado pelo servidor, preferencialmente a partir do UUID, e nunca derivado diretamente do nome fornecido pelo cliente.

A estrutura pública de um documento é:

```json
{
  "id": "550e8400-e29b-41d4-a716-446655440000",
  "originalName": "relatorio.pdf",
  "size": 24576,
  "uploadedAt": "2026-09-29T12:00:00.000Z",
  "owner": "local-user"
}
```

## 6. Contratos de API

### Convenções

- As rotas internas do Express são `/upload`, `/documents` e `/documents/:id/download`.
- No frontend, as URLs usam o prefixo `/api`. O proxy existente do Vite encaminha `/api` ao backend removendo esse prefixo; portanto, a chamada pública `/api/documents` chega ao Express como `/documents`.
- Requisições e respostas JSON usam `application/json; charset=utf-8`, exceto o corpo binário do download.
- Erros usam o formato `{ "error": { "code": "...", "message": "..." } }`. `message` deve ser seguro para exibição ao usuário; respostas não incluem stack trace nem caminho local.
- O owner não é aceito do cliente: o backend atribui `DMS_DEFAULT_OWNER`. Como não há autenticação, todos os documentos pertencem ao owner local e não existe isolamento real entre usuários.

### `POST /api/upload`

Recebe um único arquivo `multipart/form-data` no campo `file`. Campos adicionais são ignorados; não se aceita mais de um arquivo por requisição. Não há allowlist de tipo MIME no MVP. O MIME informado pelo cliente não deve ser tratado como verificação de conteúdo.

**Sucesso — `201 Created`**

`Content-Type: application/json; charset=utf-8`

Corpo: objeto público `Documento` descrito na seção 5.

**Erros**

| Status | Código | Condição |
| --- | --- | --- |
| `400 Bad Request` | `FILE_REQUIRED` | Campo `file` ausente ou vazio. |
| `413 Payload Too Large` | `FILE_TOO_LARGE` | Arquivo acima de `MAX_FILE_SIZE_BYTES`. |
| `500 Internal Server Error` | `UPLOAD_FAILED` | Falha ao gravar o arquivo ou registrar metadados. A resposta não inclui detalhes internos. |

Se o arquivo for gravado, mas o registro de metadados falhar, o backend deve tentar remover o arquivo criado para evitar órfão. Uma falha nessa limpeza deve ser registrada em log sem expor caminhos na resposta HTTP.

### `GET /api/documents`

Lista os documentos registrados em memória na instância atual. Sem parâmetros de paginação ou filtro no MVP.

**Sucesso — `200 OK`**

`Content-Type: application/json; charset=utf-8`

```json
{
  "documents": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "originalName": "relatorio.pdf",
      "size": 24576,
      "uploadedAt": "2026-09-29T12:00:00.000Z",
      "owner": "local-user"
    }
  ]
}
```

Quando não houver documentos, `documents` é um array vazio. Os itens são ordenados por `uploadedAt` decrescente; em empate, por `id` crescente para manter uma ordem determinística.

**Erro**

| Status | Código | Condição |
| --- | --- | --- |
| `500 Internal Server Error` | `DOCUMENT_LIST_FAILED` | Falha inesperada ao obter os metadados. |

### `GET /api/documents/:id/download`

Transmite o arquivo correspondente a um UUID. O servidor deve resolver o arquivo dentro de `STORAGE_DIR` usando exclusivamente o `storageKey` registrado, impedir que a resolução escape do diretório permitido e definir `Content-Disposition: attachment` com o nome original devidamente sanitizado/escapado.

**Sucesso — `200 OK`**

- Corpo binário do arquivo.
- `Content-Type: application/octet-stream` para não confiar no MIME fornecido pelo cliente.
- `Content-Disposition: attachment; filename=...` com nome de download seguro.
- `Content-Length` igual ao tamanho conhecido, quando disponível.

**Erros**

| Status | Código | Condição |
| --- | --- | --- |
| `400 Bad Request` | `INVALID_DOCUMENT_ID` | O parâmetro não tem formato UUID válido. |
| `404 Not Found` | `DOCUMENT_NOT_FOUND` | Não há metadados para o identificador solicitado. |
| `404 Not Found` | `DOCUMENT_FILE_NOT_FOUND` | Há metadados, mas o arquivo não existe no disco. |
| `500 Internal Server Error` | `DOWNLOAD_FAILED` | Falha inesperada ao abrir ou transmitir o arquivo. |

Se a transmissão já tiver começado, não se deve tentar substituir o corpo binário por uma resposta JSON; a conexão deve ser encerrada e a falha registrada em log.

### Formato de erro

Exemplo de resposta para arquivo ausente:

```json
{
  "error": {
    "code": "FILE_REQUIRED",
    "message": "Envie um arquivo no campo file."
  }
}
```

O status HTTP é a fonte de verdade para a categoria do erro. Códigos são estáveis para que o frontend não dependa do texto de `message`.

## 7. Decisões arquiteturais

- **Routes:** declaram os caminhos HTTP, configuram o middleware de upload e encaminham para controllers; não contêm regras de negócio.
- **Controllers:** traduzem parâmetros, arquivos e respostas HTTP para chamadas dos services; mapeiam erros de aplicação para status e contratos HTTP.
- **Services:** implementam os casos de uso de upload, listagem e download; validam regras do domínio e coordenam interfaces de repositório. Não dependem de Express ou multer.
- **Repositories:** persistem arquivos em disco e mantêm metadados em memória; oferecem operações necessárias aos casos de uso sem expor APIs de framework às camadas internas.
- **Multer:** usado na borda HTTP com `diskStorage`, diretório local e limite configurado. A configuração não deve fazer do caminho temporário ou do nome do cliente uma identidade confiável.
- **Frontend:** React com componentes funcionais; serviços usam `fetch` nas URLs `/api/...` e tratam os erros conforme os códigos documentados.
- **Health check:** `GET /health` existente permanece independente dos endpoints de documentos.

### Limitações e comportamento operacional

Os arquivos são persistidos em disco, mas os metadados são voláteis. Após reiniciar o processo, os arquivos anteriores podem continuar em `STORAGE_DIR`, mas não estarão disponíveis pela API porque seus registros em memória foram perdidos. A remoção automática ou reconciliação desses arquivos não faz parte do MVP. Essa limitação deve ser aceita para o estágio inicial e revista antes de uso que exija durabilidade.

Sem autenticação, `owner` é apenas metadado atribuído localmente. A API não deve apresentar essa configuração como controle de acesso nem como separação de dados por usuário.

## 8. Plano de execução

As etapas abaixo são roadmap de implementação futura. Nesta entrega, somente este documento é criado.

1. Revisar e aprovar esta especificação, os contratos HTTP e os padrões de configuração; confirmar que a limitação de metadados em memória é aceitável.
2. Preparar a configuração do backend e o armazenamento local com multer `diskStorage`, limite de tamanho e tratamento seguro de nomes/identificadores.
3. Implementar repositórios para arquivos locais e metadados em memória, incluindo limpeza compensatória quando o registro falhar.
4. Implementar casos de uso de upload, listagem e download na camada de services e expor os contratos por routes/controllers.
5. Adicionar testes backend para sucesso, validações, limites, erros de persistência e comportamento de documento inexistente/arquivo ausente.
6. Implementar a interface React e seus serviços `fetch` para upload, listagem, apresentação de erros e download pelo proxy `/api`.
7. Executar validação integrada dos três fluxos e confirmar consistência de status HTTP, formato JSON de erros, segurança dos nomes e restrição de armazenamento local.
