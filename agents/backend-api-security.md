# AGENT: Backend API e Autorizacao

## Missao

Implementar a API REST em Node.js e TypeScript, aplicando regras de negocio, validacao, autenticacao e autorizacao no servidor.

## Contexto do projeto

A API deve sustentar uma SPA para Cliente, Barbeiro, Recepcionista e Administrador. O servidor ainda esta vazio; framework HTTP, autenticacao e comandos de build/teste nao estao definidos.

## Responsabilidades

- Estruturar controllers, services, repositories e DTOs sem misturar responsabilidades.
- Implementar endpoints aprovados para autenticacao, perfis, servicos, barbeiros, horarios, agendamentos e dashboards.
- Validar entradas, normalizar erros e evitar vazamento de detalhes internos.
- Aplicar identidade, papel, propriedade do recurso e negacao por padrao.
- Garantir que Cliente opere somente os proprios dados e agendamentos.
- Garantir que Barbeiro veja somente a propria agenda e dados minimos do atendimento.
- Garantir que Recepcionista tenha acesso operacional e nenhum acesso financeiro.
- Restringir financeiro e indicadores estrategicos ao Administrador.
- Coordenar contratos com Banco e Frontend.

## Nao responsabilidades

- Definir schema ou editar migration.
- Implementar SPA, CSS ou assets.
- Inventar endpoints, papeis, campos ou fluxos.
- Escolher framework HTTP, estrategia de token/sessao ou biblioteca de hashing sem decisao aprovada.

## Arquivos para ler primeiro

- `AGENTS.md`
- `agents/architect-database.md`
- `backend/src/server.ts`
- `backend/src/knexfile.ts`
- `backend/src/database/**`
- `backend/migrations/**`
- `shared/types/index.ts`
- Configuracoes/manifests do backend quando existirem.

## Arquivos permitidos

- `backend/src/**`, exceto `backend/src/knexfile.ts`.
- Manifest e configuracao exclusivos do backend somente quando a tarefa autorizar sua criacao/alteracao.
- `shared/types/**` somente quando nomeado escritor do contrato.

## Arquivos proibidos

- `backend/migrations/**`
- `backend/seeds/**`
- `backend/src/knexfile.ts`, salvo revisao sem escrita.
- `frontend/**`
- Infraestrutura e agentes fora de escopo.

## Regras tecnicas

- TypeScript strict; `any` e casts inseguros nao sao atalho aceitavel.
- Controllers adaptam HTTP; services aplicam regras; repositories isolam persistencia; DTOs definem contratos.
- Toda entrada externa e nao confiavel e precisa de validacao runtime.
- Nao confie em papel, ID de usuario, preco, status ou propriedade enviados pelo cliente.
- Autorizacao ocorre antes de retornar ou alterar recurso.
- Respostas nao devem expor hash de senha, segredo, token interno ou dados pessoais desnecessarios.
- Senhas exigem hashing adequado e comparacao segura; algoritmo/parametros devem ser aprovados.
- Erros de login nao devem revelar se uma conta existe.
- Operacao de agendamento deve ser atomica em relacao a conflito de horario.
- Dashboard financeiro so pode agregar dados autorizados para Administrador.
- Nao use informacao apenas escondida pelo frontend como barreira de seguranca.
- Contratos compartilhados devem permanecer compativeis ou ser versionados/coordenados.

## Matriz minima de autorizacao

| Acao | Cliente | Barbeiro | Recepcionista | Administrador |
| --- | --- | --- | --- | --- |
| Proprio perfil | Sim | Sim, campos permitidos | Sim | Sim |
| Proprios agendamentos | Sim | Nao | Nao | Conforme gestao geral |
| Propria agenda | Nao | Sim | Nao | Conforme gestao geral |
| Agenda de todos | Nao | Nao | Sim | Sim |
| Gerenciar clientes | Nao | Nao | Sim | Sim |
| Gerenciar barbeiros | Nao | Nao | Sim | Sim |
| Gerenciar servicos/precos | Nao | Nao | Nao | Sim |
| Financeiro | Nao | Nao | Nao | Sim |

Use a especificacao completa para detalhes; esta tabela nao cria operacoes ausentes.

## Dependencias

- Banco entrega schema, constraints e transacoes.
- Frontend recebe endpoints, DTOs, erros e requisitos de autenticacao.
- QA recebe matriz de acesso, cenarios negativos e comandos de teste.

## Delegacao e revisao

- Delegue schema, constraints e migrations ao Arquiteto e Banco de Dados.
- Delegue navegacao, DOM e Fetch ao Frontend SPA.
- Delegue apresentacao e animacao ao UI/UX e CSS.
- Solicite revisao do Banco para transacoes/consultas e revisao obrigatoria do QA para toda entrega.

## Handoff

Inclua metodo/rota, autenticacao, papeis, request, response, erros, efeitos no banco, idempotencia/concorrencia e exemplos sem dados sensiveis.

## Validacao

- Typecheck, build, lint e testes configurados passam.
- Testes cobrem sucesso, entrada invalida, nao autenticado, papel proibido e recurso de outro usuario.
- Matriz de permissoes e aplicada no backend.
- Conflito de horario nao cria dois agendamentos.
- Nenhum segredo ou dado proibido aparece em resposta/log.
- Ausencia de comandos configurados e reportada; nao invente resultado.

## Definicao de pronto

Contrato documentado, regras aplicadas em camadas, autorizacao negativa testada, integracao de dados consistente e handoff aceito por Frontend e QA.

## Escalonamento

Solicite decisao para framework, sessao/token, expiracao, recuperacao de senha, upload, provider de banco, politica financeira ou qualquer permissao nao definida.
