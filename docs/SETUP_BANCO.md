# Setup do Banco de Dados - Barbearia Maraca

Guia para configurar o PostgreSQL local e rodar as migrations do projeto.

## 1. Clonar o repositório

```bash
git clone https://github.com/tahlly/barbearia-maraca.git
cd barbearia-maraca
```

Se já clonou, atualize:

```bash
git pull origin main
```

## 2. Instalar o PostgreSQL

Baixe e instale o PostgreSQL (versão 14 ou superior):
- **Windows:** https://www.postgresql.org/download/windows/
- **Mac:** `brew install postgresql@16`
- **Linux (Ubuntu/Debian):** `sudo apt install postgresql postgresql-contrib`

Durante a instalação, anote:
- **Usuário:** geralmente `postgres`
- **Senha:** a que você definir
- **Porta:** geralmente `5432`

## 3. Criar o banco vazio

Conecte no PostgreSQL e crie o banco:

```bash
# Usando psql (linha de comando)
psql -U postgres -c "CREATE DATABASE barbearia_maraca;"
```

Ou pelo **pgAdmin** (interface gráfica):
1. Conecte no servidor local
2. Clique com o botão direito em "Databases"
3. "Create" > "Database..."
4. Nome: `barbearia_maraca`
5. Clique em "Save"

## 4. Instalar dependências do backend

```bash
cd backend
npm install
```

## 5. Configurar o arquivo `.env` da raiz

Volte para a raiz do repositório, copie o exemplo somente se o `.env` ainda não existir e preencha suas credenciais:

```bash
# Windows (PowerShell)
cd ..
if (-not (Test-Path .env)) { Copy-Item .env.example .env }

# Mac/Linux
cd ..
[ -f .env ] || cp .env.example .env
```

Edite apenas o `.env` da raiz e ajuste as variáveis de execução manual do Backend:

```env
DB_HOST=localhost
DB_PORT=5432
DB_USER=postgres
DB_PASS=sua_senha_aqui
DB_NAME=barbearia_maraca
DB_NAME_TEST=barbearia_maraca_test
```

> **ATENÇÃO:** O arquivo `.env` é **pessoal e nunca deve ser commitado**. Ele já está no `.gitignore`. Nunca mande sua senha para o repositório.

O Backend, o Knex, o Vite e o Docker Compose usam esse mesmo arquivo. Não crie `backend/.env` nem `frontend/.env`. Somente variáveis iniciadas por `VITE_` podem ser disponibilizadas ao navegador.

## 6. Rodar as migrations

```bash
cd backend
npm run migrate:latest
```

Isso vai criar automaticamente todas as tabelas, enums e índices:

| Migration | O que cria |
|-----------|------------|
| `20260901000001_create_usuario` | Tabela `usuario` (id uuid, email, senha_hash, tipo) |
| `20260901000002_create_cliente` | Tabela `cliente` (FK → usuario) |
| `20260901000003_create_cargo_funcionario_enum` | Enum `cargo_funcionario` (barbeiro, recepcionista, administrador) |
| `20260901000004_create_funcionario` | Tabela `funcionario` (FK → usuario, cargo, especialidade, foto, descricao, ativo) |
| `20260901000005_create_servico` | Tabela `servico` (nome, descricao, duracao_minutos, preco, ativo) |
| `20260901000006_create_horario_trabalho` | Tabela `horario_trabalho` (FK → funcionario, dia_semana, hora_inicio, hora_fim) |
| `20260901000007_create_horario_excecao` | Tabela `horario_excecao` + enum `tipo_excecao_horario` (FK → funcionario) |
| `20260901000008_create_agendamento` | Tabela `agendamento` + enum `status_agendamento` (FK → cliente, funcionario, servico) |

## 7. Dados de teste (seeds)

Se existir pasta `backend/seeds/`, rode:

```bash
npm run seed
```

Isso popula o banco com dados de exemplo para desenvolvimento.

## 8. Comandos úteis

| Comando | O que faz |
|---------|-----------|
| `npm run migrate:latest` | Roda todas as migrations pendentes |
| `npm run migrate:rollback` | Desfaz a última batch de migrations |
| `npm run migrate:make -- nome_da_migration` | Cria uma nova migration |
| `npm run seed` | Roda os seeds (dados de teste) |

Para ver quais migrations já rodaram:

```bash
npx knex migrate:status --knexfile src/knexfile.ts
```

## 9. Troubleshooting

### Erro: "password authentication failed for user"

A senha no `.env` não bate com a do seu PostgreSQL.

```bash
# Teste a conexão direto
psql -U postgres -h localhost -c "SELECT 1;"
```

Se pedir senha e não conectar, a senha está errada. Atualize o `.env`.

### Erro: "database does not exist"

O banco `barbearia_maraca` não foi criado. Rode:

```bash
psql -U postgres -c "CREATE DATABASE barbearia_maraca;"
```

### Erro: "type already exists"

O banco já tinha tabelas/etypes antes de rodar o `migrate:latest`. Soluções:

**Opção A:** Deixar o banco vazio e rodar do zero (recomendado):

```bash
# Windows
dropdb -U postgres barbearia_maraca
createdb -U postgres barbearia_maraca

# Mac/Linux
dropdb barbearia_maraca
createdb barbearia_maraca
```

Depois rode `npm run migrate:latest` novamente.

**Opção B:** Se tem dados importantes, rode o status e veja quais migrations faltam:

```bash
npx knex migrate:status --knexfile src/knexfile.ts
```

### Erro: "Knex: Timeout acquiring a connection"

O PostgreSQL não está rodando ou a porta está errada.

```bash
# Windows - verificar se o serviço está rodando
Get-Service postgresql*

# Mac/Linux
sudo systemctl status postgresql
```

### Versão do PostgreSQL

O projeto usa PostgreSQL 14+. Se estiver com versão anterior, algumas functions como `gen_random_uuid()` podem não existir. Atualize ou crie manualmente:

```sql
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";
```
