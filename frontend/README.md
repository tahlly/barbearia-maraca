# Frontend — Barbearia Maracá (SPA Vanilla TypeScript)

Front-end da Barbearia Maracá como **SPA (Single Page Application)** em
**Vanilla TypeScript + HTML5 + CSS3**, sem frameworks (sem React/Vue/Angular),
conforme especificação do projeto. A navegação interna **não recarrega a página**:
usa Hash Router (`#/...`).

## Como rodar

Requisitos: Node.js 18+ e npm.

```bash
cd frontend
npm install        # instala Vite + TypeScript
npm run dev        # servidor de desenvolvimento → http://localhost:5173
npm run typecheck  # checagem de tipos (tsc --noEmit)
npm run build      # build de produção (tsc + vite build) → dist/
npm run preview    # pré-visualiza o build de produção
```

## Rotas

| Rota | Tela |
|---|---|
| `#/` | Landing pública (Início · Serviços · Sobre · Contato) |
| `#/login` | Acesso administrativo (redireciona por papel: admin / profissional / recepcionista) |
| `#/login-cliente` | Login / cadastro da área do cliente (inclui **Login com Google**) |
| `#/minha-conta` | Painel do Cliente — **Agendamentos** (histórico, filtro CONSULTAR, busca por serviço, Reagendar/Cancelar) |
| `#/minha-conta/configuracoes` | Painel do Cliente — **Configurações** (foto, nome, senha, e-mail) |
| `#/admin` | Painel de gestão — Administrador (dashboard, agendamentos, serviços, profissionais, configurações) |
| `#/admin/*` | Abas do painel do Administrador |
| `#/superusuario` | Painel do Superusuário — **Lista de usuários** (CRUD de perfis administradores) |
| `#/profissional` | Painel do Profissional — **Agendamentos** (somente leitura) |
| `#/profissional/configuracoes` | Painel do Profissional — **Configurações** |
| `#/recepcionista` | Painel de gestão compartilhado com o Admin (sem dashboard/financeiro — abre em Agendamentos) |
| `#/recepcionista/*` | Abas do painel da Recepcionista |
| `#/privacidade` | Política de Privacidade (institucional) |
| `#/termos` | Termos de Uso (institucional) |
| `#/servicos`, `#/sobre`, `#/contato` | Âncoras da landing → rolagem suave até a seção |
| qualquer outra | Fallback → landing |

Cada seção da landing tem `id` correspondente (`inicio`, `servicos`, `sobre`,
`contato`); os links do menu navegam por âncora, sem recarregar a página.

## Estrutura

```
frontend/
├── index.html            # shell da SPA: header/nav, <main id="app">, footer, modais
├── package.json          # scripts dev/build/preview/typecheck
├── tsconfig.json         # TypeScript strict mode
├── public/assets/        # imagens (logo, hero, sobre)
├── css/                  # variables · base · components · landing · modals · auth · panel · account · admin · manage
└── src/
    ├── main.ts           # entry point: theme, navbar, modais, rotas, router
    ├── router.ts         # hash router + registro de âncoras + navegação
    ├── theme.ts          # toggle light/dark persistido em localStorage + logo por tema
    ├── config.ts         # config geral (credencial demo, chave de sessão)
    ├── types.ts          # tipos/contratos do domínio
    ├── data/             # mock.ts · seed.ts (dados de demonstração)
    ├── views/            # landing · login · loginCliente · minhaConta · manage · profissional · privacidade · termos
    ├── features/         # navbar.ts · bookingWizard.ts
    ├── services/         # api · auth · clientes · usuarios · booking · catalog · schedule (Fetch)
    └── ui/               # dom · format · icons · mask · modal · toast · layout (painel/sidebar)
```

## Funcionalidades atuais

- **Agendamento em 4 passos** (wizard modal): serviços → profissional/horário → dados → confirmação, com código gerado.
- **Autenticação por papel (mock/localStorage)**: login administrativo redireciona por papel
  (superusuário → `#/superusuario`, admin → `#/admin`, recepcionista → `#/recepcionista`, profissional → `#/profissional`); cliente → `#/minha-conta`.
  Inclui **login com conta Google** na área do cliente (botão "LOGIN COM GOOGLE").
- **Painel do Superusuário** (`views/superusuario.ts`): menu único **Lista de usuários** — lista os
  **perfis administradores** cadastrados (em `maraca.v2.admins`), com **adicionar**, **editar**
  (nome, e-mail e senha) e **excluir**. Proteções: impede excluir o último administrador e
  bloqueia e-mails duplicados com outros perfis. O admin demo herdado de `maraca.v2.demoAdmin`
  é migrado para essa lista automaticamente ao primeiro acesso.
- **Painel compartilhado (Admin + Recepcionista)** em `views/manage.ts`: abas de agendamentos
  (busca, filtro por status, **bloco "CONSULTAR AGENDAMENTOS"** com filtro por datas, confirmar/cancelar,
  detalhes, configuração de agenda), serviços (CRUD + **excluir** com confirmação), profissionais
  (CRUD + métricas do mês) e configurações do perfil (foto, nome, senha, e-mail).
  **Dashboard/receita é exclusivo do Admin** — a Recepcionista abre no Agendamentos e não acessa financeiro.
  A tabela usa layout **encaixado (`table--fit`)**, sem scroll horizontal, e o menu tem item
  **"Voltar ao site"**.
- **Painel do Profissional** (`views/profissional.ts`): duas abas — **Agendamentos** (tabela
  **somente leitura** dos seus agendamentos, filtro por status, busca por cliente, bloco
  "CONSULTAR AGENDAMENTOS" com datas) e **Configurações** (foto, nome, senha, e-mail), além do
  menu **"Voltar ao site"**.
- **Painel do Cliente** (`views/minhaConta.ts`): duas abas — **Agendamentos** (histórico completo
  do próprio cliente, filtro por status, **busca por serviço**, bloco "CONSULTAR AGENDAMENTOS" com
  datas, ações **Reagendar** — muda data/hora — e **Cancelar**, botão "Novo agendamento") e
  **Configurações** (foto, nome, senha, e-mail), além do menu **"Voltar ao site"**.
- **Páginas institucionais**: Política de Privacidade (`#/privacidade`) e Termos de Uso (`#/termos`),
  acessíveis pelo rodapé; landing com **links reais de Instagram e WhatsApp**.
- **Sidebar fixa + drawer mobile** nos painéis: no desktop a sidebar fica fixa e o conteúdo rola à
  direita; no mobile vira um **drawer lateral** aberto por **hamburger**, com **backdrop** e fechamento
  ao tocar fora ou navegar.
- **Light/dark mode**: toggle no header, persistido em `localStorage` (classe `body.light-theme` +
  variáveis CSS); **logo troca por tema**; as **telas de login** respeitam o tema (modo claro corrigido).
- **Menu mobile**: hamburger com backdrop e bloqueio de scroll.
- **Validação client-side** nos formulários (nome, telefone, e-mail, senha).
- **CSS3 nativo** com variáveis, BEM e animações; responsivo desktop/mobile.

## Credencial demo (ambiente mock)

```
# Área do Cliente
e-mail: cliente@maraca.com
senha:  cliente123

# Área Administrativa (redireciona por papel)
e-mail: super@maraca.com         senha: maraca123     → Superusuário
e-mail: admin@maraca.com        senha: maraca123     → Administrador
e-mail: recepcao@maraca.com     senha: 123456        → Recepcionista
e-mail: profissional@maraca.com senha: 123456        → Profissional
```

Novos profissionais cadastrados no painel do administrador recebem a **senha
padrão `123456`** (o usuário deve alterá-la em Configurações). Se o checkbox
"É recepcionista" for marcado, o usuário é direcionado para a tela da
Recepcionista ao entrar; caso contrário, para a tela do Profissional.

## Contrato esperado do back-end

A camada JS já consome a API via `services/*`; hoje opera em **modo mock**
(async, latência simulada). Na integração com o `backend/`, os contratos esperados são:

```
POST /login-barbeiro         → login do administrador/barbeiro
Body: { "email": string, "senha": string }
Retorno: 200 → token JWT  |  401 → CREDENCIAIS_INVALIDAS
```

Validação de servidor, autorização por papel e demais endpoints seguem o
`docs/ESPECIFICACAO-PAPEIS-ACESSOS-ROTAS-CASOS-DE-USO.md`.

> O `backend/` do monorepo é Node + TypeScript (REST em camadas) com `migrations/`, `seeds/` e
> `docker-compose.yml`. Este frontend só passa a consumir esses endpoints quando a integração real
> substituir o modo mock.