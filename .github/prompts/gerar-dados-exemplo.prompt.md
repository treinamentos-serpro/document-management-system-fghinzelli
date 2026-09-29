---
description: Cria dados de exemplo para o carregamento inicial da aplicacao.
name: gerar-dados-exemplo
argument-hint: quantidade de documentos de exemplo (ex. 3)
agent: agent
---

# Gerar dados de exemplo

Implemente o carregamento inicial de `${input:quantidade:3}` documentos de exemplo no DMS.

Requisitos:

- Siga as instrucoes do projeto e integre o carregamento ao inicio do backend, antes de aceitar requisicoes.
- Crie arquivos de exemplo reais no filesystem local configurado por `STORAGE_DIR` e registre os metadados no repositorio em memoria, usando o formato esperado pelos endpoints existentes.
- Use conteudo ficticio e seguro; os exemplos devem aparecer na listagem e estar disponiveis para download.
- Evite duplicar exemplos ao iniciar novamente e nao sobrescreva nem remova documentos enviados pelo usuario.
- Mantenha a inicializacao dos testes isolada, sem criar arquivos no storage real do projeto.
- Adicione testes focados no carregamento, na repeticao da inicializacao e no download dos exemplos, seguindo `node:test`.