# Como fazer commit com Husky

Este guia explica como o Husky e o Commitlint estão configurados neste repositório e como criar commits que passam na validação automática.

## Visão geral

O repositório usa dois hooks da cadeia de qualidade:

- **Husky** — gerencia os Git hooks localmente (`.husky/`).
- **Commitlint** — valida o formato da mensagem de commit usando o padrão **Conventional Commits** (via `@commitlint/config-conventional`).

O hook `commit-msg` é executado a cada tentativa de commit e bloqueia mensagens que não seguem o padrão.

## Pré-requisitos

- Node.js instalado (versão que acompanha o `package-lock.json`).
- Dependências instaladas:

```sh
npm install
```

## Como fazer um commit (fluxo normal)

1. Adicione os arquivos que deseja versionar:

```sh
git add .
# ou arquivos específicos ex.: git add src/meu-arquivo.ts
```

2. Crie o commit com uma mensagem no padrão Conventional Commits:

```sh
git commit -m "tipo: descrição curta"
```

O Husky dispara automaticamente o `commitlint` e valida a mensagem.

## Padrão de mensagem de commit

```
tipo(escopo): descrição
```

- **`tipo`** — obrigatório. Um dos tipos convencionais:
  - `feat` — nova funcionalidade
  - `fix` — correção de bug
  - `docs` — alterações de documentação
  - `chore` — tarefas de manutenção (ex.: dependências, config)
  - `refactor` — refatoração sem mudar comportamento
  - `style` — formatação, sem mudança de lógica
  - `test` — testes
  - `perf` — melhoria de performance
  - `build` — mudanças em build/sistema de build
  - `ci` — mudanças em CI
- **`(escopo)`** — opcional. Indica a parte do projeto afetada (ex.: `frontend`, `backend`, `shared`).
- **`descrição`** — obrigatória, resumo curto no imperativo.

### Exemplos

```sh
# Válidos
git commit -m "feat: adiciona agendamento de horários"
git commit -m "fix(frontend): corrige validação do formulário"
git commit -m "docs: documenta fluxo de commit"
git commit -m "chore: atualiza dependências"

# Inválidos (serão bloqueados)
git commit -m "commit inicial"           # sem tipo
git commit -m "FEAT: texto"              # tipo em maiúsculas
git commit -m "feat"                     # sem descrição
```

## O que acontece quando a mensagem é inválida

O commit é **bloqueado** e o Commitlint mostra o motivo:

```
✖   subject may not be empty [subject-empty]
✖   type may not be empty [type-empty]
```

Corrija a mensagem e tente novamente:

```sh
git commit -m "tipo: mensagem válida"
```

## Hooks disponíveis

| Hook | Local | O que faz |
| --- | --- | --- |
| `commit-msg` | `.husky/commit-msg` | Valida a mensagem de commit com Commitlint |
| `pre-commit` | `.husky/pre-commit` | Reservado para lint/typecheck futuros (atualmente vazio) |

## Configuração relevante

- `commitlint.config.cjs` — define as regras (estende `config-conventional`).
- `.husky/` — hooks gerenciados pelo Husky.
- `package.json` — dependências e o script `prepare` que instala o Husky.

> O `pre-commit` está vazio porque o repositório ainda não possui scripts de lint e typecheck definidos. Quando forem configurados, as verificações devem ser adicionadas a esse hook.
