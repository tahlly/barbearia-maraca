# 💈 Barbearia Maracá

SPA full-stack para gestão de uma barbearia — agendamentos online, operação da agenda e administração, com **quatro papéis**: Cliente, Barbeiro (profissional), Recepcionista e Administrador.

---

## 📋 Sumário

- [Stack / Tecnologias](#stack)
- [Arquitetura do projeto](#arquitetura-do-projeto)
- [Estrutura de pastas](#estrutura-de-pastas)
- [Como iniciar o projeto](#como-iniciar-o-projeto)
- [Usuários de teste (seed)](#usuários-de-teste-seed)
- [Comandos disponíveis](#comandos-úteis)
- [Regras de domínio e autorização](#regras-de-domínio-e-autorização)
- [Contratos compartilhados](#contratos-compartilhados)
- [Documentação da API (Swagger)](#documentação-da-api-swagger)
- [Estado atual do projeto — avaliação de QA](#estado-atual-do-projeto--avaliação-de-qa)
- [Outras documentações](#outras-documentações)
- [Observações importantes](#observações-importantes)

---

## <a name="stack"></a>Stack

| Camada | Tecnologia |
|--------|-----------|
| **Frontend** | Vanilla TypeScript (sem framework) + HTML5 + CSS3 nativo, SPA com roteamento por hash, build via Vite |
| **Backend** | Node.js + Express 5 + TypeScript, API REST em camadas |
| **Banco de dados** | PostgreSQL 16 (via Docker), SQL relacional com integridade referencial |
| **ORM / Migrations** | Knex (configuração, migrations e seeds) |
| **Autenticação** | JWT (`jsonwebtoken`) + bcrypt para senhas; suporte a login Google (OAuth) |
| **Validação** | Zod (schemas de entrada) |

---

## <a name="arquitetura-do-projeto"></a>Arquitetura

Monorepo simples com três pastas principais:

```
barbearia-maraca/
├── backend/          → API REST (Express + Knex)
├── frontend/         → SPA (Vite + Vanilla TS)
├── shared/types/     → contratos HTTP compartilhados (TypeScript)
├── docs/             → documentação
├── docker-compose.yml → ambiente local completo (Postgres, migrations, API e SPA)
└── AGENTS.md          → convenções e regras do projeto
```

### Fluxo de dados

1. **Frontend (Vite, :5173)** faz chamadas via `/api/*` → proxy para o backend.
2. **Backend (Express, :3000)** expõe a API REST, valida entrada com Zod, aplica autenticação (JWT) e autorização por papel.
3. **Banco (Postgres, :5432)** armazena tudo; o backend acessa via **repositórios** (Knex).

> O backend **também serve o frontend estático** em `http://localhost:3000` (build de produção). Em desenvolvimento, use o Vite em `:5173`.

---

## <a name="estrutura-de-pastas"></a>Estrutura de pastas

### Backend (`backend/`)

```
backend/src/
├── server.ts               → bootstrap do Express, rotas, estáticos, error handler
├── knexfile.ts             → config de conexão (dev/test/prod)
├── config/                 → jwt.ts (segredo/expiração)
├── rotas/                  → definição de rotas por recurso + middlewares
│   ├── auth-routes.ts
│   ├── servico-routes.ts
│   ├── cliente-routes.ts
│   ├── funcionario-routes.ts
│   ├── agendamento-routes.ts
│   └── horario-routes.ts
├── controllers/            → valida (Zod), chama services, monta resposta
├── services/               → regras de negócio e autorização
├── repositories/           → acesso a dados via Knex
├── dtos/                   → representações de saída (espelham shared/types)
├── middlewares/            → authenticate, authorize, errorHandler
├── errors/                 → AppError, ForbiddenError, NotFoundError, etc.
├── database/connection.ts  → pool do Knex
├── utils/                  → jwt-utils, formatação
├── types/                  → extensões de tipos do Express (req.user)
├── migrations/             → schema do banco (13 migrations)
└── seeds/                  → dados de teste (001_seed_completo.ts)
```

**Fluxo de uma requisição:** `rota` → `controller` (valida com Zod) → `service` (regras + autorização) → `repository` (Knex) → resposta DTO.

### Frontend (`frontend/`)

```
frontend/
├── index.html              → HTML raiz da SPA (header/footer/modal de agendamento)
├── vite.config.ts          → porta 5173, proxy /api → :3000, alias @
├── public/                 → assets estáticos (imagens, CSS servido)
└── src/
    ├── main.ts             → entrypoint: initRouter, registra rotas, init de modais/tema
    ├── router.ts           → roteamento por hash (#/...)
    ├── config.ts           → CONFIG (URL da API, chaves, constantes)
    ├── theme.ts            → controle de tema claro/escuro
    ├── types.ts            → tipos locais do frontend
    ├── data/seed.ts        → seed de catálogo no storage/boot
    ├── services/           → camada de integração com a API
    │   ├── api.ts          → httpJson/apiFetch (fetch + token + tratamento de erro)
    │   ├── auth.ts         → login, sessão, requisição de papel
    │   ├── booking.ts      → agendamentos (CRUD, confirmação, conclusão)
    │   ├── catalog.ts      → serviços e profissionais
    │   ├── clientes.ts     → cadastro/cliente
    │   ├── googleAuth.ts   → login com Google
    │   ├── schedule.ts     → horários de trabalho e disponibilidade
    │   └── usuarios.ts     → usuários internos (funcionários)
    ├── features/           → navbar, wizard de agendamento, settings form
    ├── ui/                 → modal, toast, layout, ícones, máscaras, formatação
    ├── styles/             → CSS (fonte) + public/*.css (assets servidos)
    └── views/              → telas da SPA
        ├── landing.ts, login.ts, loginCliente.ts
        ├── minhaConta.ts   → cliente
        ├── profissional.ts → barbeiro
        └── manage.ts       → admin e recepcionista
```

### Rotas da SPA (hash)

| Rota | Painel | Acesso |
|------|--------|--------|
| `#/` | Landing page (área pública) | público |
| `#/login` | Login administrativo | público |
| `#/login-cliente` | Login/área do cliente | público |
| `#/minha-conta` e `#/minha-conta/configuracoes` | Área do cliente | cliente |
| `#/admin/*` | Painel administrativo | admin |
| `#/recepcionista/*` | Operação | recepcionista |
| `#/profissional` e `#/profissional/configuracoes` | Agenda do barbeiro | profissional |
| `#/privacidade` e `#/termos` | Páginas institucionais | público |

### Banco de dados (migrations)

Tabelas principais:

- `usuario` — credenciais (email + `senha_hash`), tipo (cliente/funcionario), login Google
- `funcionario` — equipe (cargo: `barbeiro` / `recepcionista` / `administrador`)
- `cliente` — clientes
- `servico` — serviços (preço DECIMAL, soft-delete via `ativo`)
- `agendamento` — agendamentos (índice único parcial por funcionário+data+hora)
- `horario_trabalho` — escala semanal dos profissionais
- `horario_excecao` — exceções/folgas

---

## <a name="como-iniciar-o-projeto"></a>Como iniciar o projeto

### Pré-requisitos

- **Docker Desktop** com Docker Compose
- **Node.js** e **npm** apenas para usar os atalhos `npm run dev:*`

No Windows, abra o Docker Desktop e espere o motor ficar disponível. Depois abra um novo PowerShell e confirme:

```powershell
docker --version
docker compose version
```

Se o Docker estiver aberto, mas o terminal ainda não reconhecer o comando, feche e abra novamente o PowerShell. Como alternativa temporária para a sessão atual:

```powershell
$env:Path = "C:\Program Files\Docker\Docker\resources\bin;$env:Path"
```

### Fluxo recomendado — ambiente completo com Docker

Na raiz do projeto, este comando constrói e inicia Postgres, migrations, Backend e Frontend na ordem correta:

```powershell
npm run dev:up
```

Também é possível usar o Docker Compose diretamente:

```powershell
docker compose up --build
```

O ambiente fica disponível em:

- Frontend: **http://localhost:5173**
- Backend: **http://localhost:3000**
- Health check: **http://localhost:3000/api/health**
- PostgreSQL: **localhost:5432**

O serviço `migrate` espera o banco ficar saudável e aplica automaticamente apenas migrations pendentes. A seed não faz parte da inicialização normal.

Para acompanhar os logs:

```powershell
npm run dev:logs
```

Para encerrar todos os contêineres do projeto:

```powershell
npm run dev:down
```

Esse comando encerra Frontend, Backend, migrations e PostgreSQL do Docker, preservando os dados no volume `postgres_data`. Ele não controla um PostgreSQL instalado como serviço do Windows. Não use `docker compose down -v` a menos que queira apagar também o banco Docker local.

#### Seed de desenvolvimento — execução explícita

O seed apaga e recria os dados de demonstração. Execute somente quando quiser reinicializar o conteúdo do banco:

```powershell
npm run dev:seed
```

#### Variáveis locais

O projeto usa um único arquivo `.env` na raiz para Docker, Backend e Frontend. Em um clone novo, crie-o sem sobrescrever uma configuração existente:

```powershell
if (-not (Test-Path .env)) { Copy-Item .env.example .env }
```

Preencha no `.env` o segredo JWT e, quando necessário, os Client IDs do Google. O Backend e o Knex carregam esse arquivo diretamente; o Vite usa a mesma raiz, mas só expõe ao navegador variáveis iniciadas com `VITE_`.

O Compose lê o mesmo arquivo e repassa apenas as variáveis necessárias a cada serviço. Dentro dos contêineres, ele sobrescreve host, porta e credenciais do banco com os valores `COMPOSE_DB_*`.

Se a porta `5432` já estiver ocupada por um PostgreSQL nativo, encerre esse serviço ou defina outra porta do host antes de subir o Compose:

```powershell
$env:COMPOSE_DB_PORT=5433
npm run dev:up
```

Dentro da rede Docker, o Backend continua acessando o banco em `db:5432`.

### Fluxo alternativo — execução manual

Para executar sem Docker, mantenha um PostgreSQL local ativo e configure as variáveis `DB_*` no `.env` da raiz. Depois instale as dependências:

```powershell
# backend/
npm install

# frontend/
npm install
```

Na pasta `backend/`, aplique migrations e inicie a API:

```powershell
npm run migrate:latest
npm run dev
```

Em outro terminal, na pasta `frontend/`, inicie a SPA:

```powershell
npm run dev
```

Teste a conexão:

```powershell
Invoke-WebRequest http://localhost:3000/api/health
# → {"status":"ok","database":"connected"}
```

---

## <a name="usuários-de-teste-seed"></a>Usuários de teste (seed)

Todos os usuários usam a senha **`senha123`**:

| Papel | E-mail |
|-------|--------|
| **Administrador** | `carlos@barbeariamaraca.com.br` |
| **Recepcionista** | `ana@barbeariamaraca.com.br` |
| **Barbeiro** | `joao@barbeariamaraca.com.br` |
| **Barbeiro** | `lucas@barbeariamaraca.com.br` |
| **Cliente** | `maria@email.com` |
| **Cliente** | `pedro@email.com` |

---

## <a name="comandos-úteis"></a>Comandos úteis

### Ambiente Docker (raiz)

| Comando | Descrição |
|---------|-----------|
| `npm run dev:up` | constrói e inicia banco, migrations, Backend e Frontend |
| `npm run dev:down` | encerra toda a stack e preserva os dados |
| `npm run dev:logs` | acompanha os logs do Backend e Frontend |
| `npm run dev:seed` | reinicializa explicitamente os dados de demonstração |

### Backend (`backend/`)

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | roda em dev com `tsx` (→ :3000) |
| `npm run build` | compila TypeScript → `dist/` |
| `npm start` | roda `node dist/server.js` |
| `npm run migrate:latest` | aplica migrations |
| `npm run migrate:rollback` | desfaz a última batch |
| `npm run migrate:make -- nome` | cria nova migration |
| `npm run seed` | popula dados de teste |
| `npm run swagger` | regenera `backend/openapi.json` a partir das anotações das rotas |

### Frontend (`frontend/`)

| Comando | Descrição |
|---------|-----------|
| `npm run dev` | Vite dev (→ :5173) |
| `npm run typecheck` | `tsc --noEmit` |
| `npm run build` | `tsc && vite build` |
| `npm run preview` | Vite preview do build |

---

## <a name="regras-de-domínio-e-autorização"></a>Regras de domínio e autorização

- **Cliente** opera somente seus próprios dados e agendamentos.
- **Barbeiro** visualiza e gerencia somente sua própria agenda e os dados mínimos do atendimento; **não cancela** agendamentos.
- **Recepcionista** tem acesso operacional, mas **não financeiro**.
- **Administrador** tem acesso completo (incluindo financeiro e configurações).
- A **proteção de acesso é feita no backend** (middlewares `authenticate` + `authorize` e regras nos services); o frontend representa fluxo, não é barreira de segurança.

---

## <a name="contratos-compartilhados"></a>Contratos compartilhados

Em `shared/types/index.ts` ficam os contratos HTTP usados por backend e frontend (auth, agendamentos, horários, funcionários, serviços, clientes). **O Backend é o dono padrão** desses tipos.

Pontos de atenção no contrato:

- `preco` de serviço é serializado como **string** (precisão decimal de moeda).
- `login` recebe `password`; `register` e `PATCH /auth/me` recebem `senha`.
- O backend serializa agendamentos em **camelCase** (`clienteId`, `funcionarioId`, etc.), mas a criação envia **snake_case** (`funcionario_id`, `servico_id`).

---

## <a name="documentação-da-api-swagger"></a>Documentação da API (Swagger)

O projeto usa **OpenAPI 3.0** para documentar a API REST. A UI interativa fica em:

- **UI Swagger:** `http://localhost:3000/api/docs` (backend rodando)
- **Spec gerado:** `backend/openapi.json`

### Como funciona

1. As rotas express são anotadas com blocos JSDoc `@openapi` dentro dos arquivos em `backend/src/rotas/`.
2. O script `backend/swagger.ts` usa **swagger-jsdoc** para escanear esses arquivos e gerar `backend/openapi.json`.
3. O `server.ts` lê `backend/openapi.json` em runtime e expõe a UI em `/api/docs` via swagger-ui-express.

> O `openapi.json` é gerado a partir das anotações e **commitado** no repositório. Sempre que uma rota mudar, regenere o arquivo e inclua a alteração no PR.

### Fluxo rápido

```sh
# dentro de backend/
npm run swagger        # regenera backend/openapi.json
npm run dev            # ou reinicie o backend já em execução
# acesse http://localhost:3000/api/docs
```

### Como criar uma nova rota para ela aparecer no Swagger

Follow os 5 passos abaixo. O passo **3 é o mais fácil de esquecer** — o swagger-jsdoc só escaneia os arquivos listados em `backend/swagger.ts`.

**1. Implemente a rota no Express** em `backend/src/rotas/meu-recurso-routes.ts` e monte-a no `server.ts`:

```ts
// backend/src/rotas/meu-recurso-routes.ts
import { Router } from 'express';
import { autenticar, fazerX } from '../controllers/meu-recurso-controller';

const meuRecursoRoutes = Router();
meuRecursoRoutes.get('/', autenticar, fazerX);
export default meuRecursoRoutes;
```

```ts
// backend/src/server.ts
import meuRecursoRoutes from './rotas/meu-recurso-routes';
// ...
app.use('/api/meu-recurso', meuRecursoRoutes);
```

**2. Anote o arquivo com JSDoc `@openapi`** — defina os schemas e os paths no topo do arquivo de rotas:

```ts
/**
 * @openapi
 * components:
 *   schemas:
 *     MeuRecurso:
 *       type: object
 *       properties:
 *         id: { type: string }
 *         nome: { type: string }
 *
 * /api/meu-recurso:
 *   get:
 *     tags: [MeuRecurso]
 *     summary: Lista recursos
 *     security:
 *       - bearerAuth: []
 *     responses:
 *       '200':
 *         description: Lista de recursos
 *         content:
 *           application/json:
 *             schema:
 *               type: array
 *               items: { $ref: '#/components/schemas/MeuRecurso' }
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 */
```

**3. Registre o arquivo na lista `apis:` do `backend/swagger.ts`**:

```ts
apis: [
  path.join(__dirname, 'src', 'server.ts'),
  // ...existing routes...
  path.join(__dirname, 'src', 'rotas', 'meu-recurso-routes.ts'), // ← adicione aqui
],
```

**4. Regenerar a spec e validar:**

```sh
cd backend
npm run swagger
# confira que o novo path apareceu em backend/openapi.json
```

**5. Reinicie o backend e visualize** em `http://localhost:3000/api/docs`.

### Boas práticas nas anotações

- Reutilize os schemas já definidos em `server.ts` (`Erro`, `Erro400`, `Erro401`, `Erro403`, `Erro404`, `Erro500`) via `$ref: '#/components/responses/Erro400'`.
- Rotas autenticadas precisam de `security: [{ bearerAuth: [] }]` (o scheme é definido em `server.ts`).
- Rotas públicas (ex.: disponibilidade de horários) devem **omitir** `security`.
- Defina `tags` para agrupar os endpoints na UI.
- Se o endpoint retorna um shape novo, declare um `schema` novo no bloco `components.schemas` do mesmo arquivo de rotas.


## <a name="outras-documentações"></a>Outras documentações

| Documento | Conteúdo |
|-----------|----------|
| [`docs/DER-MODELO-INICIAL.md`](docs/DER-MODELO-INICIAL.md) | Modelo de dados inicial (DER) |
| [`docs/documentacao_spa_barbearia_MVP.md`](docs/documentacao_spa_barbearia_MVP.md) | Especificação funcional / MVP da SPA |
| [`docs/SETUP_BANCO.md`](docs/SETUP_BANCO.md) | Setup do PostgreSQL e migrations passo a passo |
| [`docs/COMO-FAZER-COMMIT-COM-HUSKY.md`](docs/COMO-FAZER-COMMIT-COM-HUSKY.md) | Fluxo de commit com Husky + Commitlint |
| [`docs/GUIA-PROFISSIONAL-DOS-AGENTES.md`](docs/GUIA-PROFISSIONAL-DOS-AGENTES.md) | Arquitetura de agentes, ownership e fluxo de revisão |
| [`AGENTS.md`](AGENTS.md) | Regras executáveis e fonte de verdade do projeto |

---

## <a name="observações-importantes"></a>Observações importantes

- **Porta 3000**: o backend usa a porta 3000 por padrão. Se outro serviço (ex.: Whaticket) estiver usando-a, libere a porta antes de subir o projeto.
- **Seed destrutivo**: `npm run seed` apaga e recria os dados — rode apenas quando quiser dados limpos.
- **Modo mock**: o `config.ts` do frontend usa `useMockApi: false` (integração real com o backend). A variável `VITE_USE_MOCK_API` está documentada no `.env.example`, mas **não é lida** pelo código — mudá-la não tem efeito (pendência) e a aplicação sempre funciona em modo API.
- **Login Google**: requer `VITE_GOOGLE_CLIENT_ID` e `GOOGLE_CLIENT_ID` no `.env` da raiz; sem configuração, o fluxo Google fica indisponível.
- **Migrations não devem ser reescritas** após aplicadas — para mudanças, crie uma nova migration.

---

## 🧭 Desenvolvimento (fluxo de contribuição)

- Todas as mudanças entram via **Pull Request** para a branch `developer` (histórico é de merges de PRs).
- Mensagens de commit seguem **Conventional Commits** (validado por Commitlint + Husky): `tipo(escopo): descrição`, ex.: `fix(frontend): ...`.
- `*.log` e `.env` (qualquer nível) são ignorados pelo git.
