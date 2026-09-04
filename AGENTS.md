# AGENTS.md

## Projeto

Este projeto implementa uma SPA full-stack para uma barbearia com quatro papéis:
- Cliente
- Barbeiro
- Recepcionista
- Administrador

O sistema inclui:
- área pública;
- autenticação;
- agendamentos;
- áreas privadas por papel;
- operação da agenda;
- gestão administrativa;
- restrição de informações financeiras ao Administrador.

## Fonte de verdade

Use esta ordem de prioridade:
1. PRD atual
2. especificação funcional atual
3. tarefa/card e critérios de aceite
4. estado real do repositório
5. agentes em `.opencode/agents/**`

Se houver conflito, ambiguidade ou lacuna material:
- não invente;
- registre como pendência;
- escale ao Orquestrador ou ao responsável humano.

## Stack obrigatória

### Frontend
- Vanilla TypeScript
- HTML5
- CSS3 nativo
- SPA sem framework

### Backend
- Node.js
- TypeScript
- API REST em camadas

### Banco
- SQL relacional
- integridade referencial
- Knex para configuração, migrations e seeds quando isso fizer parte do repositório aprovado

## Operação / Desenvolvimento local

### Arquitetura (não óbvia pelos nomes)
- Monorepo simples: `backend/` (Express + Knex), `frontend/` (Vite + Vanilla TS SPA), `shared/types/**` (contratos HTTP compartilhados — hoje vazio, o Backend é o dono padrão).
- Backend em camadas: `rotas/` → `controllers/` → `services/` → `repositories/`.
- Frontend: SPA sem framework, roteamento por hash (`#/...`), entrypoint `frontend/src/main.ts`, `index.html` em `frontend/`.
- O backend também serve o frontend estático em `http://localhost:3000`; em dev use o Vite (5173).

### Comandos
```sh
# Banco (Postgres 16 via Docker)
docker compose up -d          # sobe o banco na porta 5432 (db: barbearia_maraca, user/senha: postgres/postgres)

# Backend (rodar de backend/)
npm install
npm run dev                   # tsx src/server.ts -> http://localhost:3000
npm run migrate:latest        # aplica migrations
npm run migrate:rollback      # desfaz última batch
npm run migrate:make -- nome  # cria nova migration
npm run seed                  # popula dados de teste
npm run build                 # tsc -> dist/
npm start                     # node dist/server.js

# Frontend (rodar de frontend/)
npm install
npm run dev                   # Vite -> http://localhost:5173 (proxy /api -> :3000)
npm run typecheck             # tsc --noEmit
npm run build                 # tsc && vite build
```

### Gotchas de ambiente (fáceis de errar)
- **O `.env` ativo é `backend/.env`, NÃO o da raiz.** Tanto `backend/src/knexfile.ts` quanto `backend/src/server.ts` carregam `path.resolve(__dirname, '..', '.env')` = `backend/.env`. O `.env` da raiz é redundante/confuso — mantenha os dois consistentes ou remova o da raiz.
- **Migrations e seeds são TypeScript** e rodam via `npx tsx node_modules/knex/bin/cli.js ...` (os scripts do `package.json` já fazem isso). Não use `npx knex` direto.
- **Migrations não devem ser reescritas após aplicadas** — crie novas migrations para mudanças.
- **Restrição de dupla reserva** é um índice único parcial em `agendamento (funcionario_id, data, hora) WHERE status <> 'cancelado'` (migration `20260902000004`). Cobre horário exato, não sobreposição parcial.
- **Nomenclatura do schema:** a tabela de equipe é `funcionario` (enum `cargo`: barbeiro/recepcionista/administrador), NÃO `barbeiro`. Horários são `horario_trabalho` + `horario_excecao`, NÃO `horario`.
- **Seed:** senha padrão dos usuários de teste é `senha123`; o seed não cria agendamentos.

### Commits e fluxo de PR
- **Commitlint + Husky** validam a mensagem de commit (Conventional Commits, `commitlint.config.cjs`). Formato: `tipo(escopo): descrição` (ex.: `fix(frontend): ...`). Mensagens fora do padrão são **bloqueadas**.
- **Todas as mudanças entram via Pull Request** (o histórico é todo de merges de PRs). Não commitar/pushar direto na `developer` — crie uma branch (`feat/`, `fix/`, `chore/`, `docs/`), abra PR para `developer`, e faça merge no GitHub.
- `*.log` e `.env` (qualquer nível) são ignorados — não commitar logs nem credenciais.

## Restrições globais

Não adote sem aprovação explícita:
- React, Vue, Angular ou equivalentes
- Tailwind, Bootstrap, CSS-in-JS
- ORM, provider ou banco não decidido
- framework HTTP não aprovado
- estratégia de autenticação, sessão ou token não aprovada
- runner, comando ou ferramenta inexistente no repositório

## Regras centrais de domínio

- Cliente opera somente seus próprios dados e agendamentos.
- Barbeiro visualiza e gerencia somente sua própria agenda e os dados mínimos necessários do atendimento.
- Recepcionista possui acesso operacional, mas não acesso financeiro.
- Administrador possui acesso completo, incluindo financeiro e configurações.
- Proteção de acesso deve existir no backend; o frontend representa fluxo e navegação, não segurança real.
- A modelagem inicial da documentação funcional é referência, não schema final automático.

## Regras transversais

- TypeScript deve permanecer em modo estrito.
- `any` e casts inseguros não são atalhos aceitáveis.
- Toda entrada externa deve ser tratada como não confiável.
- Não confie em papel, ID, preço, status ou propriedade enviados pelo cliente.
- Não exponha segredos, hashes, tokens internos ou dados pessoais desnecessários.
- Não invente requisito ausente.
- Diferencie sempre:
  - **aprovado**
  - **proposta**
  - **pendência**

## Regras de colaboração

- Não permita dois agentes escrevendo o mesmo arquivo ao mesmo tempo.
- Se a tarefa afetar schema e API, Banco vem antes de Backend.
- Se a tarefa afetar API e SPA, Backend e Frontend devem alinhar o contrato compartilhado antes da integração.
- O Backend é o dono padrão dos contratos HTTP compartilhados em `shared/types/**`.
- Se a tarefa afetar lógica e visual, Frontend define a estrutura funcional antes de UI/UX aplicar a camada visual.
- Toda implementação relevante deve passar por QA.
- Tarefas multidomínio devem começar pelo Orquestrador.

## Ownership por agente

- `.opencode/agents/orquestrador.md`: coordenação, ordem, dependências, bloqueios e rastreabilidade.
- `.opencode/agents/arquiteto-banco-dados.md`: schema, migrations, integridade, invariantes estruturais e concorrência.
- `.opencode/agents/backend-api-autorizacao.md`: endpoints, regras de aplicação, autenticação, autorização e contratos HTTP compartilhados.
- `.opencode/agents/frontend-spa.md`: fluxo SPA, roteamento, estado, DOM, formulários e integração cliente/API.
- `.opencode/agents/ui-ux-css.md`: CSS, layout, responsividade, tokens visuais, assets e estados visuais.
- `.opencode/agents/qa-code-review.md`: revisão independente, evidências, severidade e revalidação.

## Política de arquivos

### Banco
- `backend/src/knexfile.ts`
- `backend/migrations/**`
- `backend/seeds/**`

### Backend
- `backend/src/**`
- `shared/types/**` quando a tarefa exigir contratos HTTP compartilhados

### Frontend
- `frontend/src/**`
- `frontend/index.html`

### UI/UX
- arquivos CSS dentro de `frontend/`
- `frontend/public/assets/**`
- markup semântico com coordenação explícita com Frontend

### QA
- apenas arquivos de teste aprovados
- relatórios e documentação de revisão, quando aplicável

Mudanças fora do escopo normal do agente devem ser explicitamente justificadas na tarefa.

## Validação mínima

Antes de concluir qualquer tarefa:
- confirme aderência ao PRD e à especificação funcional;
- confirme que o escopo permaneceu nos arquivos autorizados;
- confirme que nenhuma permissão indevida foi ampliada;
- confirme que nenhuma decisão ausente foi inventada;
- confirme que impactos, riscos e pendências foram registrados.

## Condições de bloqueio

Bloqueie e escale quando faltar definição sobre:
- framework HTTP;
- autenticação, sessão ou token;
- provider ou banco;
- timezone;
- status e transições;
- política de exclusão;
- política financeira;
- contrato ausente ou divergente;
- critérios de aceite insuficientes.

## Handoff mínimo

Toda entrega deve informar, no mínimo:
- resumo;
- requisito ou fonte;
- arquivos afetados;
- alterações realizadas ou propostas;
- impactos;
- riscos;
- pendências;
- próximo responsável.

## Estilo global

- Seja preciso e rastreável.
- Prefira bloquear a inventar.
- Preserve segurança, integridade e clareza contratual.
- Quando houver mais de uma alternativa válida, apresente trade-offs curtos e recomende a mais segura.