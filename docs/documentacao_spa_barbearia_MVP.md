# Projeto Final de Curso — SPA para Barbearia

## 1. Visão Geral

O sistema será uma **Single Page Application (SPA)** para uma barbearia, permitindo que clientes conheçam os serviços, profissionais e horários disponíveis, além de realizar e acompanhar agendamentos.

A aplicação também terá áreas específicas para **Cliente, Barbeiro, Recepcionista e Administrador**, com controle de acesso baseado em papéis.

### Objetivos principais

- Apresentar a barbearia e seus serviços.
- Permitir cadastro e login de clientes.
- Permitir agendamento de serviços.
- Permitir visualização e cancelamento de agendamentos.
- Permitir gerenciamento de agenda pelos profissionais.
- Permitir que a recepcionista gerencie a rotina operacional da barbearia.
- Permitir gerenciamento administrativo da barbearia.
- Centralizar informações de serviços, profissionais e horários.
- Proporcionar uma experiência responsiva para desktop e mobile.
- Restringir informações financeiras ao Administrador.

---

# 2. Usuários do Sistema

O sistema terá quatro papéis principais:

| Papel | Objetivo |
|---|---|
| **Cliente** | Realizar e acompanhar seus agendamentos. |
| **Barbeiro** | Gerenciar sua agenda e seus atendimentos. |
| **Recepcionista** | Operar a rotina da barbearia e gerenciar agenda, clientes e barbeiros. |
| **Administrador** | Gerenciar todo o sistema, incluindo informações financeiras e estratégicas. |

### Hierarquia

```text
                         SISTEMA
                            │
          ┌─────────────────┼─────────────────┐
          │                 │                 │
       CLIENTE         RECEPCIONISTA      ADMINISTRADOR
                            │                 │
                            │                 │
                         BARBEIROS       GESTÃO GERAL
                            │                 │
                         AGENDA           FINANCEIRO
                            │                 │
                       ATENDIMENTOS       RELATÓRIOS
```

---

# 3. Controle de Acesso

## 3.1 Cliente

### Pode

- Visualizar página inicial.
- Visualizar serviços.
- Visualizar barbeiros.
- Visualizar informações da barbearia.
- Criar conta.
- Fazer login.
- Editar seu perfil.
- Consultar horários.
- Realizar agendamento.
- Consultar seus agendamentos.
- Cancelar seus próprios agendamentos.
- Sair da conta.

### Não pode

- Acessar painel administrativo.
- Alterar serviços.
- Alterar preços.
- Alterar agenda de profissionais.
- Gerenciar clientes.
- Gerenciar barbeiros.
- Visualizar informações financeiras.

---

## 3.2 Barbeiro

### Pode

- Fazer login.
- Visualizar seu perfil.
- Editar informações permitidas do próprio perfil.
- Visualizar sua agenda.
- Consultar seus atendimentos.
- Bloquear horários.
- Disponibilizar horários.
- Confirmar atendimento.
- Marcar atendimento como concluído.
- Visualizar as informações necessárias do cliente para realizar o atendimento.

### Não pode

- Gerenciar outros barbeiros.
- Gerenciar clientes.
- Alterar configurações gerais da barbearia.
- Alterar serviços e preços.
- Visualizar informações financeiras.
- Visualizar lucro ou indicadores financeiros.
- Gerenciar administradores.

---

## 3.3 Recepcionista

A recepcionista será responsável pela **operação da barbearia**, tendo acesso às informações necessárias para o funcionamento diário, mas sem acesso às informações financeiras e estratégicas.

### Pode

- Fazer login.
- Visualizar dashboard operacional.
- Visualizar agenda de todos os barbeiros.
- Gerenciar horários dos barbeiros.
- Criar agendamentos.
- Consultar agendamentos.
- Alterar agendamentos.
- Confirmar agendamentos.
- Cancelar agendamentos.
- Cadastrar clientes.
- Consultar clientes.
- Atualizar dados de clientes.
- Cadastrar barbeiros.
- Consultar barbeiros.
- Editar barbeiros.
- Ativar barbeiros.
- Desativar barbeiros.
- Visualizar serviços.
- Confirmar e concluir atendimentos.

### Não pode

- Visualizar faturamento.
- Visualizar lucro.
- Visualizar despesas.
- Visualizar indicadores financeiros.
- Visualizar relatórios financeiros.
- Alterar preços dos serviços.
- Acessar configurações administrativas sensíveis.
- Gerenciar informações financeiras da empresa.

---

## 3.4 Administrador

O Administrador possui acesso completo ao sistema.

### Pode

- Gerenciar clientes.
- Gerenciar barbeiros.
- Cadastrar barbeiros.
- Editar barbeiros.
- Ativar ou desativar barbeiros.
- Gerenciar serviços.
- Cadastrar serviços.
- Editar serviços.
- Desativar serviços.
- Definir preços.
- Definir duração dos serviços.
- Gerenciar horários.
- Visualizar todos os agendamentos.
- Criar, alterar e cancelar agendamentos.
- Visualizar dashboard administrativo.
- Visualizar faturamento.
- Visualizar despesas.
- Visualizar lucro.
- Visualizar indicadores financeiros.
- Gerenciar configurações da barbearia.
- Gerenciar permissões e acessos, conforme a implementação definida pela equipe.

---

# 4. Matriz de Permissões

| Funcionalidade | Cliente | Barbeiro | Recepcionista | Admin |
|---|:---:|:---:|:---:|:---:|
| Home | ✅ | ✅ | ✅ | ✅ |
| Serviços | 👁️ | 👁️ | 👁️ | ✅ |
| Barbeiros | 👁️ | 👁️ | ✅ | ✅ |
| Sobre | 👁️ | 👁️ | 👁️ | 👁️ |
| Login | ✅ | ✅ | ✅ | ✅ |
| Cadastro de cliente | ✅ | ❌ | ✅ | ✅ |
| Editar próprio perfil | ✅ | ✅ | ✅ | ✅ |
| Realizar agendamento | ✅ | ❌ | ✅ | ✅ |
| Ver próprios agendamentos | ✅ | ❌ | ❌ | ❌ |
| Cancelar próprio agendamento | ✅ | ❌ | ❌ | ❌ |
| Ver agenda própria | ❌ | ✅ | ❌ | ❌ |
| Gerenciar própria agenda | ❌ | ✅ | ❌ | ❌ |
| Confirmar atendimento | ❌ | ✅ | ✅ | ✅ |
| Concluir atendimento | ❌ | ✅ | ✅ | ✅ |
| Visualizar clientes | ❌ | 👁️* | ✅ | ✅ |
| Cadastrar cliente | ❌ | ❌ | ✅ | ✅ |
| Editar cliente | ❌ | ❌ | ✅ | ✅ |
| Gerenciar barbeiros | ❌ | ❌ | ✅ | ✅ |
| Cadastrar barbeiro | ❌ | ❌ | ✅ | ✅ |
| Editar barbeiro | ❌ | ❌ | ✅ | ✅ |
| Ativar/desativar barbeiro | ❌ | ❌ | ✅ | ✅ |
| Gerenciar horários dos barbeiros | ❌ | ❌ | ✅ | ✅ |
| Gerenciar serviços | ❌ | ❌ | ❌ | ✅ |
| Gerenciar preços | ❌ | ❌ | ❌ | ✅ |
| Ver todos os agendamentos | ❌ | ❌ | ✅ | ✅ |
| Dashboard operacional | ❌ | 👁️ | ✅ | ✅ |
| Faturamento | ❌ | ❌ | ❌ | ✅ |
| Lucro | ❌ | ❌ | ❌ | ✅ |
| Despesas | ❌ | ❌ | ❌ | ✅ |
| Indicadores financeiros | ❌ | ❌ | ❌ | ✅ |
| Configurações do sistema | ❌ | ❌ | ❌ | ✅ |

**Legenda:**

- ✅ = possui permissão
- 👁️ = somente visualização
- ❌ = sem acesso
- \* O barbeiro deve visualizar somente os dados necessários para realizar o atendimento.

---

# 5. Rotas da SPA

A estrutura de rotas proposta é:

```text
/
├── /home
├── /servicos
├── /barbeiros
├── /sobre
├── /login
├── /cadastro
│
├── /agendamento
│
├── /cliente
│   ├── /cliente/perfil
│   └── /cliente/agendamentos
│
├── /barbeiro
│   ├── /barbeiro/dashboard
│   ├── /barbeiro/agenda
│   ├── /barbeiro/atendimentos
│   └── /barbeiro/perfil
│
├── /recepcionista
│   ├── /recepcionista/dashboard
│   ├── /recepcionista/agenda
│   ├── /recepcionista/agendamentos
│   ├── /recepcionista/clientes
│   ├── /recepcionista/barbeiros
│   └── /recepcionista/horarios
│
└── /admin
    ├── /admin/dashboard
    ├── /admin/clientes
    ├── /admin/barbeiros
    ├── /admin/servicos
    ├── /admin/agendamentos
    ├── /admin/financeiro
    └── /admin/configuracoes
```

---

# 6. Regra de Proteção das Rotas

Após a autenticação, o sistema deverá identificar o papel do usuário e direcioná-lo para sua área correspondente.

```text
                         /login
                            │
                            ↓
                     AUTENTICAÇÃO
                            │
             ┌──────────────┼──────────────┐
             │              │              │
             ↓              ↓              ↓
          CLIENTE        BARBEIRO      RECEPCIONISTA
             │              │              │
             ↓              ↓              ↓
         /cliente       /barbeiro     /recepcionista

                            │
                            ↓
                         ADMIN
                            │
                            ↓
                          /admin
```

### Regra específica da recepcionista

```text
RECEPCIONISTA
       │
       ├── /recepcionista/agenda         ✅
       ├── /recepcionista/barbeiros      ✅
       ├── /recepcionista/clientes       ✅
       ├── /recepcionista/agendamentos   ✅
       ├── /recepcionista/horarios       ✅
       │
       └── /admin/financeiro             ❌ ACESSO NEGADO
```

O backend também deverá validar as permissões. A proteção não deve existir somente no frontend.

---

# 7. Estrutura Inicial de Telas

## 7.1 Área Pública

### Home

Rota:

```text
/home
```

Elementos:

- Logo.
- Menu de navegação.
- Banner principal.
- Chamada para agendamento.
- Serviços em destaque.
- Barbeiros.
- Sobre a barbearia.
- Contato.
- Rodapé.

Exemplo:

```text
┌──────────────────────────────────────────────┐
│ LOGO       Início Serviços Barbeiros  Login │
├──────────────────────────────────────────────┤
│                                              │
│       SUA MELHOR VERSÃO COMEÇA AQUI         │
│                                              │
│       Corte • Barba • Estilo                │
│                                              │
│            [ AGENDAR HORÁRIO ]              │
│                                              │
├──────────────────────────────────────────────┤
│              NOSSOS SERVIÇOS                │
│                                              │
│  Corte        Barba       Corte + Barba     │
│  R$ XX        R$ XX          R$ XX           │
│                                              │
│             [ VER SERVIÇOS ]                │
├──────────────────────────────────────────────┤
│              NOSSOS BARBEIROS               │
├──────────────────────────────────────────────┤
│             SOBRE A BARBEARIA               │
├──────────────────────────────────────────────┤
│                 CONTATO                     │
└──────────────────────────────────────────────┘
```

---

## 7.2 Serviços

Rota:

```text
/servicos
```

Cada serviço deverá apresentar:

- Nome.
- Descrição.
- Preço.
- Duração.
- Botão de agendamento.

Exemplo:

```text
┌─────────────────┐
│ Corte Masculino │
│ R$ 35,00        │
│ 30 minutos      │
│ [AGENDAR]       │
└─────────────────┘

┌─────────────────┐
│ Barba           │
│ R$ 25,00        │
│ 20 minutos      │
│ [AGENDAR]       │
└─────────────────┘

┌─────────────────┐
│ Corte + Barba   │
│ R$ 50,00        │
│ 50 minutos      │
│ [AGENDAR]       │
└─────────────────┘
```

---

## 7.3 Barbeiros

Rota:

```text
/barbeiros
```

Cada profissional poderá apresentar:

- Foto.
- Nome.
- Especialidade.
- Descrição.
- Status.
- Opção de visualizar perfil.

---

# 8. Autenticação

## 8.1 Cadastro

Rota:

```text
/cadastro
```

Campos:

```text
Nome
E-mail
Telefone
Senha
Confirmar senha

[CRIAR CONTA]
```

Fluxo:

```text
Cadastro
   ↓
Validação dos dados
   ↓
Criação da conta
   ↓
Mensagem de sucesso
   ↓
Login
```

---

## 8.2 Login

Rota:

```text
/login
```

Campos:

```text
E-mail
Senha

[ENTRAR]

Esqueci minha senha
Ainda não possui conta?
[CRIAR CONTA]
```

---

# 9. Fluxo de Agendamento

O fluxo principal do cliente será:

```text
HOME
 ↓
SERVIÇOS
 ↓
Selecionar serviço
 ↓
Selecionar barbeiro
 ↓
Selecionar data
 ↓
Selecionar horário
 ↓
Confirmar informações
 ↓
CONFIRMAR AGENDAMENTO
 ↓
Agendamento realizado
 ↓
Meus agendamentos
```

## Etapas

### Etapa 1 — Serviço

```text
Escolha o serviço

○ Corte
○ Barba
○ Corte + Barba
```

### Etapa 2 — Profissional

```text
Escolha o profissional

○ João
○ Carlos
○ Pedro
```

### Etapa 3 — Data

```text
Escolha a data

[ < ] AGOSTO 2026 [ > ]

SEG TER QUA QUI SEX SAB DOM
                         01
02  03  04  05  06  07  08
09  10  11  12  13  14  15
```

### Etapa 4 — Horário

```text
Horários disponíveis

09:00   09:30   10:00
10:30   11:00   11:30
14:00   14:30   15:00

[CONTINUAR]
```

### Etapa 5 — Confirmação

```text
CONFIRME SEU AGENDAMENTO

Serviço: Corte + Barba
Profissional: João
Data: 20/08/2026
Horário: 14:00
Valor: R$ 50,00

[CONFIRMAR AGENDAMENTO]
```

### Regra de negócio

O horário somente poderá ser selecionado se estiver disponível para o barbeiro escolhido.

---

# 10. Área do Cliente

Rota principal:

```text
/cliente
```

Subrotas:

```text
/cliente/perfil
/cliente/agendamentos
```

Dashboard:

```text
Olá, Cliente!

PRÓXIMO AGENDAMENTO

┌─────────────────────────────┐
│ Corte + Barba               │
│ João                        │
│ Data                        │
│ Horário                     │
│                             │
│ [CANCELAR]                  │
└─────────────────────────────┘

MEUS AGENDAMENTOS

Próximos | Histórico
```

Menu:

```text
Meu perfil
Meus agendamentos
Novo agendamento
Sair
```

---

# 11. Área do Barbeiro

Rota principal:

```text
/barbeiro
```

Subrotas:

```text
/barbeiro/dashboard
/barbeiro/agenda
/barbeiro/atendimentos
/barbeiro/perfil
```

Dashboard:

```text
Olá, Barbeiro!

┌────────────┐ ┌────────────┐ ┌────────────┐
│ HOJE       │ │ PENDENTES  │ │ CONCLUÍDOS │
│     8      │ │     3      │ │     5      │
└────────────┘ └────────────┘ └────────────┘

AGENDA DE HOJE

09:00  Cliente
       Corte
       [CONFIRMAR]

10:00  Cliente
       Barba
       [CONFIRMAR]

11:00  Cliente
       Corte + Barba
       [CONCLUIR]
```

O barbeiro deverá visualizar somente a própria agenda.

---

# 12. Área da Recepcionista

Rota principal:

```text
/recepcionista
```

Subrotas:

```text
/recepcionista/dashboard
/recepcionista/agenda
/recepcionista/agendamentos
/recepcionista/clientes
/recepcionista/barbeiros
/recepcionista/horarios
```

## 12.1 Dashboard operacional

A dashboard da recepcionista deve apresentar informações necessárias para a operação diária.

```text
┌─────────────────────────────────────────────────┐
│ LOGO                    Olá, Recepcionista 👋   │
├───────────────┬─────────────────────────────────┤
│               │                                 │
│ Dashboard     │  AGENDA DE HOJE                │
│               │                                 │
│ Agenda        │  ┌───────────────────────────┐  │
│ Agendamentos  │  │ 09:00 - Barbeiro          │  │
│ Clientes      │  │ Cliente                   │  │
│ Barbeiros     │  │ Serviço: Corte            │  │
│ Horários      │  │ Status: Confirmado        │  │
│               │  └───────────────────────────┘  │
│               │                                 │
│               │  ATENDIMENTOS DE HOJE           │
│               │                                 │
│               │  12 agendados                   │
│               │  8 confirmados                  │
│               │  4 pendentes                    │
└───────────────┴─────────────────────────────────┘
```

### Não apresentar na dashboard da recepcionista

```text
❌ Faturamento
❌ Lucro
❌ Despesas
❌ Ticket médio
❌ Receita por período
❌ Relatórios financeiros
```

---

# 13. Gestão de Barbeiros pela Recepcionista

Rota:

```text
/recepcionista/barbeiros
```

Tela:

```text
GERENCIAR BARBEIROS

[ + CADASTRAR BARBEIRO ]

┌──────────────────────────────────────────────────┐
│ FOTO │ NOME       │ ESPECIALIDADE │ STATUS       │
├──────────────────────────────────────────────────┤
│ 👤   │ João Silva │ Corte         │ 🟢 Ativo     │
│      │            │               │ [EDITAR]     │
│      │            │               │ [AGENDA]     │
├──────────────────────────────────────────────────┤
│ 👤   │ Carlos      │ Barba         │ 🟢 Ativo     │
│      │ Souza       │               │ [EDITAR]     │
│      │             │               │ [AGENDA]     │
└──────────────────────────────────────────────────┘
```

---

# 14. Cadastro de Barbeiro

A recepcionista poderá cadastrar um novo barbeiro.

```text
CADASTRAR BARBEIRO

Nome:
[____________________________]

E-mail:
[____________________________]

Telefone:
[____________________________]

Especialidade:
[____________________________]

Foto:
[ Selecionar imagem ]

Status:
○ Ativo
○ Inativo

[ CANCELAR ]     [ CADASTRAR ]
```

---

# 15. Agenda dos Barbeiros

A recepcionista poderá visualizar a agenda de todos os barbeiros.

```text
AGENDA

Data: 29/08/2026

       João          Carlos        Pedro
09:00  Corte         —             Barba
09:30  Corte         Barba         —
10:00  —             Corte         Corte
10:30  Barba         —             Corte
11:00  —             Corte         —

[ + BLOQUEAR HORÁRIO ]
```

### Diferença entre os perfis

**Barbeiro:**

```text
BARBEIRO
   ↓
Visualiza somente sua agenda
```

**Recepcionista:**

```text
RECEPCIONISTA
   ↓
Visualiza agenda de todos os barbeiros
   ↓
Pode gerenciar horários
```

**Administrador:**

```text
ADMINISTRADOR
   ↓
Visualiza e gerencia todas as informações
   ↓
Incluindo informações financeiras
```

---

# 16. Gestão de Clientes pela Recepcionista

Rota:

```text
/recepcionista/clientes
```

Funcionalidades:

- Cadastrar cliente.
- Consultar cliente.
- Atualizar dados.
- Visualizar histórico de agendamentos, se definido como requisito.
- Auxiliar no agendamento presencial.

Exemplo:

```text
CLIENTES

[ + NOVO CLIENTE ]

Nome       Telefone       Status
----------------------------------
Cliente 1  99999-9999    Ativo
Cliente 2  98888-8888    Ativo
Cliente 3  97777-7777    Inativo

[EDITAR] [AGENDAR]
```

---

# 17. Gestão de Agendamentos pela Recepcionista

Rota:

```text
/recepcionista/agendamentos
```

A recepcionista poderá:

- Criar agendamento.
- Consultar agendamento.
- Alterar agendamento.
- Confirmar agendamento.
- Cancelar agendamento.
- Visualizar o barbeiro responsável.
- Visualizar o cliente.
- Visualizar o serviço.
- Visualizar data e horário.

---

# 18. Casos de Uso

## UC01 — Realizar Cadastro

**Ator:** Cliente

### Pré-condição

O cliente não possui cadastro.

### Fluxo principal

1. Cliente acessa a tela de cadastro.
2. Sistema apresenta o formulário.
3. Cliente informa seus dados.
4. Sistema valida os dados.
5. Sistema cria a conta.
6. Sistema informa que o cadastro foi realizado.

---

## UC02 — Realizar Login

**Atores:** Cliente, Barbeiro, Recepcionista e Administrador.

### Fluxo

```text
Usuário
   │
   └──> Fazer login
           │
           ├── Informar e-mail
           ├── Informar senha
           └── Autenticar
                   │
        ┌──────────┼──────────┬──────────┐
        ↓          ↓          ↓          ↓
     Cliente    Barbeiro  Recepcionista  Admin
```

---

## UC03 — Realizar Agendamento

**Ator:** Cliente

```text
Cliente
   │
   └──> Realizar agendamento
          │
          ├── Selecionar serviço
          ├── Selecionar barbeiro
          ├── Selecionar data
          ├── Selecionar horário
          └── Confirmar agendamento
```

### Regra

O sistema deve impedir o agendamento de um horário já ocupado ou indisponível.

---

## UC04 — Consultar Agendamentos

**Ator:** Cliente

```text
Cliente
   │
   └──> Consultar meus agendamentos
              │
              ├── Próximos
              └── Histórico
```

---

## UC05 — Cancelar Agendamento

**Ator:** Cliente

```text
Cliente
   │
   └──> Cancelar agendamento
             │
             ├── Selecionar agendamento
             ├── Confirmar cancelamento
             └── Sistema libera horário
```

---

## UC06 — Gerenciar Agenda

**Ator:** Barbeiro

```text
Barbeiro
   │
   └──> Gerenciar agenda
           │
           ├── Visualizar horários
           ├── Bloquear horário
           ├── Disponibilizar horário
           └── Visualizar atendimentos
```

---

## UC07 — Gerenciar Barbeiros

**Ator:** Recepcionista / Administrador

```text
Recepcionista / Administrador
      │
      └── Gerenciar barbeiros
              │
              ├── Cadastrar
              ├── Consultar
              ├── Editar
              ├── Ativar
              └── Desativar
```

---

## UC08 — Gerenciar Agenda dos Barbeiros

**Ator:** Recepcionista / Administrador

```text
Recepcionista / Administrador
      │
      └── Gerenciar agenda
              │
              ├── Visualizar agenda
              ├── Selecionar barbeiro
              ├── Consultar horários
              ├── Bloquear horário
              └── Disponibilizar horário
```

---

## UC09 — Gerenciar Agendamentos

**Atores:** Recepcionista / Administrador

```text
Recepcionista / Administrador
      │
      └── Gerenciar agendamentos
              │
              ├── Criar
              ├── Consultar
              ├── Alterar
              ├── Confirmar
              └── Cancelar
```

---

## UC10 — Gerenciar Clientes

**Atores:** Recepcionista / Administrador

```text
Recepcionista / Administrador
      │
      └── Gerenciar clientes
              │
              ├── Cadastrar
              ├── Consultar
              └── Atualizar dados
```

---

## UC11 — Gerenciar Serviços

**Ator:** Administrador

```text
Administrador
      │
      └── Gerenciar serviços
               │
               ├── Cadastrar
               ├── Consultar
               ├── Editar
               └── Desativar
```

---

## UC12 — Gerenciar Informações Financeiras

**Ator:** Administrador

```text
Administrador
      │
      └── Gerenciar informações financeiras
               │
               ├── Visualizar faturamento
               ├── Visualizar despesas
               ├── Visualizar lucro
               └── Visualizar indicadores
```

A recepcionista não possui acesso a esse caso de uso.

---

# 19. Diagrama Geral de Casos de Uso

```text
                         SISTEMA BARBEARIA

┌────────────────────────────────────────────────────────────┐
│                                                            │
│ CLIENTE                         BARBEIRO                   │
│   │                                │                       │
│   ├── Cadastro                     ├── Login               │
│   ├── Login                        ├── Visualizar agenda   │
│   ├── Consultar serviços           ├── Gerenciar agenda   │
│   ├── Consultar barbeiros          ├── Confirmar          │
│   ├── Realizar agendamento         │   atendimento        │
│   ├── Consultar agendamentos       └── Concluir           │
│   ├── Cancelar agendamento             atendimento        │
│   └── Gerenciar perfil                                      │
│                                                            │
│ RECEPCIONISTA                                             │
│   │                                                        │
│   ├── Dashboard operacional                                │
│   ├── Gerenciar agenda                                     │
│   ├── Gerenciar agendamentos                               │
│   ├── Gerenciar clientes                                   │
│   ├── Gerenciar barbeiros                                  │
│   ├── Gerenciar horários                                   │
│   └── Atendimentos                                         │
│                                                            │
│ ADMINISTRADOR                                             │
│   │                                                        │
│   ├── Dashboard geral                                      │
│   ├── Gerenciar clientes                                   │
│   ├── Gerenciar barbeiros                                  │
│   ├── Gerenciar serviços                                   │
│   ├── Gerenciar agendamentos                               │
│   ├── Gerenciar horários                                   │
│   ├── Financeiro                                           │
│   └── Configurações                                        │
│                                                            │
└────────────────────────────────────────────────────────────┘
```

---

# 20. Separação entre Recepcionista e Administrador

A regra de negócio principal entre esses dois perfis será:

```text
                  ADMINISTRADOR
                       │
        ┌──────────────┴──────────────┐
        │                             │
    OPERAÇÃO                       FINANCEIRO
        │                             │
        ↓                             ↓
  Recepcionista                   Dashboard
        │                         financeiro
        │                             │
        ↓                             ↓
   Barbeiros                       Receita
   Agenda                          Despesas
   Clientes                        Lucro
   Agendamentos                    Indicadores
   Atendimentos                    Relatórios
```

### Regra

> A recepcionista possui acesso às informações necessárias para executar a operação da barbearia, mas não possui acesso às informações financeiras e estratégicas do negócio.

---

# 21. Modelagem Inicial do Banco de Dados

Uma modelagem inicial poderá utilizar as seguintes entidades:

```text
USUARIO
   │
   ├── id
   ├── nome
   ├── email
   ├── senha
   ├── telefone
   ├── tipo
   └── status


BARBEIRO
   │
   ├── id
   ├── usuario_id
   ├── especialidade
   ├── foto
   └── descricao


SERVICO
   │
   ├── id
   ├── nome
   ├── descricao
   ├── preco
   ├── duracao
   └── status


AGENDAMENTO
   │
   ├── id
   ├── cliente_id
   ├── barbeiro_id
   ├── servico_id
   ├── data
   ├── horario
   └── status


HORARIO
   │
   ├── id
   ├── barbeiro_id
   ├── data
   ├── hora_inicio
   ├── hora_fim
   └── status
```

### Relacionamentos

```text
USUARIO
   │
   ├────────── CLIENTE
   │
   ├────────── BARBEIRO
   │
   ├────────── RECEPCIONISTA
   │
   └────────── ADMINISTRADOR


CLIENTE ───────────────┐
                       │
BARBEIRO ──────────────┼──> AGENDAMENTO <── SERVICO
                       │
                       │
                       └──> HORARIO
```

---

# 22. Fluxo Completo do Sistema

```text
                    ┌──────────────┐
                    │     HOME     │
                    └──────┬───────┘
                           │
             ┌─────────────┼─────────────┐
             ↓             ↓             ↓
         SERVIÇOS      BARBEIROS       LOGIN
             │                           │
             └─────────────┐             │
                           ↓             ↓
                     AGENDAMENTO      AUTENTICAÇÃO
                           │             │
                           ↓       ┌─────┴──────────┐
                      CONFIRMAÇÃO   ↓       ↓       ↓
                           │     CLIENTE  BARBEIRO RECEPÇÃO
                           ↓        │       │       │
                      AGENDAMENTO   │       │       │
                           │        │       │       │
                           ↓        ↓       ↓       ↓
                       BANCO     AGENDA   AGENDA  OPERAÇÃO
                           │
                           ↓
                       ATENDIMENTO
```

---

# 23. Organização do Figma

Sugestão de estrutura:

```text
📁 01 - Design System
   ├── Cores
   ├── Tipografia
   ├── Botões
   ├── Inputs
   ├── Cards
   ├── Navbar
   ├── Modal
   └── Tabelas

📁 02 - Fluxos
   ├── Fluxo Cliente
   ├── Fluxo Barbeiro
   ├── Fluxo Recepcionista
   └── Fluxo Administrador

📁 03 - Área Pública
   ├── Home
   ├── Serviços
   ├── Barbeiros
   └── Sobre

📁 04 - Autenticação
   ├── Login
   ├── Cadastro
   └── Recuperação de senha

📁 05 - Cliente
   ├── Dashboard
   ├── Agendamento
   ├── Meus agendamentos
   └── Perfil

📁 06 - Barbeiro
   ├── Dashboard
   ├── Agenda
   ├── Atendimentos
   └── Perfil

📁 07 - Recepcionista
   ├── Dashboard
   ├── Agenda
   ├── Agendamentos
   ├── Clientes
   ├── Barbeiros
   └── Horários

📁 08 - Administrador
   ├── Dashboard
   ├── Clientes
   ├── Barbeiros
   ├── Serviços
   ├── Agendamentos
   ├── Financeiro
   └── Configurações

📁 09 - Responsividade
   ├── Desktop
   ├── Tablet
   └── Mobile
```

---

# 24. MVP — Produto Mínimo Viável

Para manter o projeto viável dentro do prazo do curso, recomenda-se priorizar:

## Área pública

- Home.
- Serviços.
- Barbeiros.
- Sobre.
- Login.
- Cadastro.

## Cliente

- Dashboard.
- Agendamento.
- Meus agendamentos.
- Cancelamento.
- Perfil.

## Barbeiro

- Dashboard.
- Agenda.
- Confirmar atendimento.
- Concluir atendimento.

## Recepcionista

- Dashboard operacional.
- Agenda geral.
- Agendamentos.
- Clientes.
- CRUD de barbeiros.
- Gerenciamento de horários.

## Administrador

- Dashboard.
- CRUD de serviços.
- CRUD de barbeiros.
- Visualização de clientes.
- Visualização de agendamentos.
- Dashboard financeiro.

---

# 25. Divisão Sugerida da Equipe

```text
                 EQUIPE
                   │
       ┌───────────┼───────────┐
       ↓           ↓           ↓
   FRONT-END    BACK-END    UX/UI
       │           │           │
       │           │           ├── Figma
       │           │           ├── Wireframes
       │           │           └── Design System
       │           │
       │           ├── API
       │           ├── Banco
       │           ├── Autenticação
       │           └── Regras de negócio
       │
       ├── SPA
       ├── Rotas
       ├── Componentes
       ├── Telas
       └── Integração API
```

Se a equipe tiver integrantes suficientes, também é recomendável definir uma pessoa ou dupla para:

```text
QA / TESTES
   ├── Testes funcionais
   ├── Testes de permissões
   ├── Testes de responsividade
   ├── Testes de autenticação
   └── Validação dos fluxos
```

---

# 26. Ordem Recomendada de Desenvolvimento

A sequência recomendada é:

1. **Definir escopo**
   - O que entra no projeto.
   - O que não entra no projeto.

2. **Definir atores**
   - Cliente.
   - Barbeiro.
   - Recepcionista.
   - Administrador.

3. **Definir permissões**
   - Criar matriz de acesso.

4. **Definir casos de uso**
   - Identificar as ações de cada usuário.

5. **Definir rotas**
   - Estruturar as rotas da SPA.

6. **Criar wireframes**
   - Criar as telas inicialmente no Figma.

7. **Criar protótipo visual**
   - Cores.
   - Tipografia.
   - Componentes.
   - Responsividade.

8. **Modelar banco de dados**
   - Entidades.
   - Atributos.
   - Chaves.
   - Relacionamentos.

9. **Definir API**
   - Endpoints.
   - Métodos HTTP.
   - Autenticação.
   - Autorização.

10. **Desenvolver**
    - Front-end.
    - Back-end.
    - Banco de dados.

11. **Integrar**
    - SPA consumindo a API.

12. **Testar**
    - Funcionalidades.
    - Permissões.
    - Responsividade.
    - Fluxos completos.

13. **Preparar apresentação**
    - Problema.
    - Solução.
    - Personas.
    - Casos de uso.
    - Protótipo.
    - Arquitetura.
    - Demonstração do sistema.

---

# 27. Resumo da Arquitetura Funcional

```text
                         BARBEARIA SPA
                              │
       ┌──────────────────────┼──────────────────────┐
       │                      │                      │
    PÚBLICO              AUTENTICAÇÃO           ÁREAS PRIVADAS
       │                      │                      │
       ├── Home               │             ┌────────┼────────┐
       ├── Serviços           │             │        │        │
       ├── Barbeiros          │          Cliente  Barbeiro  Gestão
       └── Sobre              │                         │      │
                              │                         │      │
                         Login/Cadastro                │      │
                                                       │      │
                                              ┌────────┘      │
                                              │               │
                                          Recepcionista    Admin
                                              │               │
                                              │               ├── Financeiro
                                              ├── Agenda       ├── Serviços
                                              ├── Clientes     ├── Barbeiros
                                              ├── Barbeiros    ├── Clientes
                                              └── Agendamentos └── Agendamentos
```

## Regra central de segurança

```text
ADMINISTRADOR
     │
     ├── Acesso operacional
     │
     └── Acesso financeiro

RECEPCIONISTA
     │
     └── Acesso operacional
            │
            ├── Agenda
            ├── Clientes
            ├── Barbeiros
            └── Agendamentos

     ❌ Sem acesso financeiro
```

