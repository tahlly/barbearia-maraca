# Swagger / OpenAPI da API (passo a passo validado)

Este guia documenta **exatamente o que funcionou** para gerar a documentação OpenAPI das rotas e expor a interface Swagger UI em `http://localhost:3000/api/docs`.

> Contexto: projeto backend em Node.js + TypeScript (Express 5), com Docker Compose. Os passos abaixo foram validados em Windows com a stack Docker rodando.

---

## Visão geral

| Item | Valor |
|------|-------|
| Geração do spec | `swagger-jsdoc` lê comentários `@openapi` nos arquivos |
| Arquivo gerado | `backend/openapi.json` |
| Rota da UI | `GET /api/docs` (via `swagger-ui-express`) |
| Regenerar spec | `npm run swagger` (dentro de `backend/`) |

Fluxo: **rotas documentadas com `@openapi`** → **`npm run swagger` gera `openapi.json`** → **`server.ts` servindo a UI em `/api/docs`**.

---

## 1. Instalar dependências (host)

No diretório `backend/`:

```sh
npm install -D swagger-jsdoc @types/swagger-jsdoc
npm install swagger-ui-express
npm install -D @types/swagger-ui-express
```

> `swagger-jsdoc` gera o spec a partir dos comentários. `swagger-ui-express` expõe a interface web.

---

## 2. Criar `backend/swagger.ts`

Script que gera o `openapi.json`:

```ts
import swaggerJSDoc from 'swagger-jsdoc';
import fs from 'fs';
import path from 'path';

const options: swaggerJSDoc.Options = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Barbearia Maraca API',
      version: '1.0.0',
      description: 'API REST da barbearia',
    },
    servers: [{ url: 'http://localhost:3000' }],
  },
  apis: [
    path.join(__dirname, 'src', 'server.ts'),
    path.join(__dirname, 'src', 'rotas', 'auth-routes.ts'),
    path.join(__dirname, 'src', 'rotas', 'servico-routes.ts'),
    path.join(__dirname, 'src', 'rotas', 'cliente-routes.ts'),
    path.join(__dirname, 'src', 'rotas', 'funcionario-routes.ts'),
    path.join(__dirname, 'src', 'rotas', 'agendamento-routes.ts'),
    path.join(__dirname, 'src', 'rotas', 'horario-routes.ts'),
  ],
};

const spec = swaggerJSDoc(options);
const output = path.join(__dirname, 'openapi.json');
fs.writeFileSync(output, JSON.stringify(spec, null, 2));
console.log(`Spec gerado em ${output}`);
```

> **⚠️ Lição importante (Windows):** NÃO use glob (`src/rotas/*.ts`) na lista `apis`. No Windows com `path.join`, o `swagger-jsdoc` falha ao expandir o `*` e **só gera os paths de arquivos com caminho explícito** (ex.: só o `/api/health` do `server.ts`). Use a **lista explícita de arquivos** como acima.

---

## 3. Documentar as rotas com JSDoc `@openapi`

### 3.1 Documento raiz (`backend/src/server.ts`)

No topo do arquivo, antes dos imports, o bloco global com `securitySchemes`, `schemas` e `responses` reutilizáveis:

```js
/**
 * @openapi
 * components:
 *   securitySchemes:
 *     bearerAuth:
 *       type: http
 *       scheme: bearer
 *       bearerFormat: JWT
 *   schemas:
 *     Erro:
 *       type: object
 *       required: [erro, mensagem, status]
 *       properties:
 *         erro: { type: boolean, example: true }
 *         mensagem: { type: string }
 *         status: { type: number }
 *         detalhes:
 *           type: array
 *           items: { type: string }
 *   responses:
 *     Erro400:
 *       description: Requisicao invalida
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Erro' }
 *     Erro401:
 *       description: Nao autenticado
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Erro' }
 *     Erro403:
 *       description: Acesso negado
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Erro' }
 *     Erro404:
 *       description: Nao encontrado
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Erro' }
 *     Erro500:
 *       description: Erro interno
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/Erro' }
 *
 * /api/health:
 *   get:
 *     tags: [Health]
 *     summary: Verifica a saude do servidor e do banco
 *     responses:
 *       '200':
 *         description: OK
 *         content:
 *           application/json:
 *             schema:
 *               type: object
 *               properties:
 *                 status: { type: string, example: ok }
 *                 database: { type: string, example: connected }
 *       '500':
 *         $ref: '#/components/responses/Erro500'
 */
```

### 3.2 Por arquivo de rota

Em cada arquivo de `backend/src/rotas/*.ts`, adicione um bloco `@openapi` documentando:
- o path **absoluto** (ex.: `/api/auth/login`);
- `tags` por domínio (Auth, Servicos, Clientes, Funcionarios, Agendamentos, Horarios);
- `security: [{ bearerAuth: [] }]` nas rotas autenticadas;
- `parameters` (path `id`, queries);
- `requestBody` com `$ref` para o schema;
- `responses` 200/201/204, 400, 401, 403, 404, 500 (usando os `Erro*` do root).

Exemplo (`auth-routes.ts`):

```js
/**
 * @openapi
 * /api/auth/login:
 *   post:
 *     tags: [Auth]
 *     summary: Login local (email e senha)
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema: { $ref: '#/components/schemas/AuthLoginRequest' }
 *     responses:
 *       '200':
 *         description: Login realizado
 *         content:
 *           application/json:
 *             schema: { $ref: '#/components/schemas/AuthLoginResponse' }
 *       '401':
 *         $ref: '#/components/responses/Erro401'
 */
```

Os schemas (`AuthLoginRequest`, etc.) são definidos como `components.schemas` nos blocos `@openapi` dos próprios arquivos de rota — o `swagger-jsdoc` mescla tudo.

> **Fonte de verdade dos campos:** use os DTOs reais de `backend/src/dtos/` e os schemas Zod dos controllers. Ex.: `preco` é **string** (DECIMAL no banco); `dia_semana` é integer 0-6; `hora_inicio`/`hora_fim` são strings `"HH:MM:SS"`.

---

## 4. Adicionar o script no `backend/package.json`

```jsonc
"scripts": {
  ...
  "swagger": "npx tsx swagger.ts"
}
```

---

## 5. Gerar o spec

```sh
# dentro de backend/
npm run swagger
```

Cria `backend/openapi.json`.

### Validação rápida (quantos paths/schemas foram gerados)

```sh
node -e "const s=require('./openapi.json'); console.log('paths:', Object.keys(s.paths).length); console.log('schemas:', Object.keys(s.components.schemas||{}).length)"
```

Esperado: **25 paths** e **31 schemas**.

---

## 6. Expor a UI no `backend/src/server.ts`

Adicione os imports:

```ts
import fs from 'fs';
import swaggerUi from 'swagger-ui-express';
```

Adicione a rota **antes** do handler de 404 de `/api` (a ordem importa — se vier depois, cai no 404):

```ts
// ── Swagger UI (documentação da API) ────────────────────────────────
// Lê o spec OpenAPI gerado por `npm run swagger` (backend/openapi.json).
// Se o arquivo ainda não existir, expõe a UI com uma mensagem orientativa.
const openapiPath = path.join(__dirname, '..', 'openapi.json');
let swaggerDocument: object;
try {
  swaggerDocument = JSON.parse(fs.readFileSync(openapiPath, 'utf8'));
} catch {
  swaggerDocument = {
    openapi: '3.0.0',
    info: {
      title: 'Barbearia Maraca API',
      version: '1.0.0',
      description:
        'Spec nao encontrado. Rode `npm run swagger` no diretorio backend/ para gerar o openapi.json.',
    },
    paths: {},
  };
}
app.use('/api/docs', swaggerUi.serve, swaggerUi.setup(swaggerDocument));
```

> **Por que `fs.readFileSync` e não `import`?** O `tsconfig` tem `rootDir: ./src`, então importar um JSON fora de `src/` quebraria o build (`outDir`). A leitura via `fs` com `path.join(__dirname, '..', 'openapi.json')` funciona tanto em dev (`tsx src/server.ts` → `src/`) quanto em Docker (volume `./backend:/app`).

---

## 7. Validar no Docker (a pegadinha do `node_modules`)

A stack usa volumes separados para o `node_modules` do contêiner (`backend_node_modules`). Só instalar no host **não** instala dentro do contêiner. Passos que funcionaram:

```sh
# 1) Verificar se o pacote está no contêiner
docker exec barbearia-maraca-backend-1 sh -c "ls node_modules/swagger-ui-express >/dev/null 2>&1 && echo INSTALADO || echo NAO_INSTALADO"

# 2) Se NAO_INSTALADO, instalar dentro do contêiner
docker exec barbearia-maraca-backend-1 sh -c "npm install swagger-ui-express @types/swagger-ui-express"

# 3) Reiniciar o contêiner (o tsx watch nem sempre recarrega com DEP nova)
docker restart barbearia-maraca-backend-1
```

Teste final:

```sh
curl -s -o /dev/null -w "%{http_code}" http://localhost:3000/api/docs
# 301 (redirect normal do swagger-ui-express)
curl -sL -o /dev/null -w "%{http_code}" http://localhost:3000/api/docs
# 200 (UI carregada)
```

Confira no navegador: **http://localhost:3000/api/docs** → deve renderizar a UI com as tags Health, Auth, Servicos, Clientes, Funcionarios, Agendamentos e Horarios, com o botão **Authorize** para inserir Bearer token.

---

## 8. Pegadinhas e decisões registradas

1. **Glob no Windows:** não use `*.ts` na lista `apis` do `swagger.ts` — use caminhos explícitos (senão só o `server.ts` é lido).
2. **Ordem da rota:** `/api/docs` deve ser registrada **antes** do handler `app.use('/api/{*path}')` (404), senão retorna `{"erro":true,"mensagem":"Rota não encontrada"}`.
3. **Volume do `node_modules`:** em Docker, o `node_modules` é volume separado; instale via `docker exec` e dê `docker restart` no backend.
4. **`tsx watch` não recarrega DEP nova:** mesmo com o volume sincronizado (`./backend:/app`), faltando a dependência no contêiner o watch falha/ignora. O `docker restart` resolve.
5. **`/api/docs/swagger.json` retorna HTML:** normal — o `swagger-ui-express` com `setup(document)` embute o spec no HTML (`swagger-ui-init.js`) em vez de servir um JSON separado.
6. **Regeneração:** após mudar rotas/DTOs, rode `npm run swagger` de novo e repita a validação.

---

## 9. Próximos passos quando a stack for reconstruída do zero

Como o `package.json`/`package-lock.json` já contêm as dependências, uma reconstrução limpa (novos volumes) via `npm run dev:up` já instala tudo corretamente pelo `npm ci` do Dockerfile — os passos 7.2/7.3 só são necessários quando a stack já está rodando com o volume antigo.

---

## Referência de arquivos

| Arquivo | Função |
|---------|--------|
| `backend/swagger.ts` | Gera `openapi.json` a partir dos comentários `@openapi` |
| `backend/openapi.json` | Spec OpenAPI 3.0 gerado (versionado) |
| `backend/src/server.ts` | Doc raiz + rota `/api/docs` + health |
| `backend/src/rotas/*.ts` | Anotações `@openapi` de todos os endpoints |
| `backend/package.json` | Script `swagger` + deps `swagger-jsdoc`, `swagger-ui-express` |