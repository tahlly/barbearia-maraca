# Pendências registradas

Registro rastreável de decisões adiadas e lacunas abertas. Cada pendência
deve informar origem, decisão de negócio (se houver) e caminho sugerido de
retomada. Estado: **aberta** / **em andamento** / **resolvida**.

---

## P-001 — Dashboard: "Profissional destaque do mês" por faturamento

**Estado:** aberta

**Origem:** ajuste solicitado na seção 2.1 (Dashboard) — mudar o critério do
destaque do mês de *quantidade de atendimentos concluídos* para *faturamento
(R$) no período*, mantendo a quantidade no mesmo retorno.

**Descoberta:** o cálculo **não está no backend**. O destaque é calculado
100% no Frontend, em `frontend/src/views/manage.ts` → `dashboardMetricsHTML`
(ordena concluídos por `funcionarioId`, desempate por atendimento mais
recente). Não existe rota, contrato em `shared/types` nem permissão associada
a "destaque" no backend hoje.

**Decisão na sessão (11/09/2026):** adiado — escopo do Dashboard base
(Frontend), fora da branch `feat/modulo-financeiro-comissao`. Manter por
quantidade até a rodada de Frontend do módulo financeiro.

**Decisão de negócio registrada (para quando for retomado):**
- Implementar na **Opção B**: endpoint próprio no backend (ex.:
  `GET /api/dashboard/destaque`), branch separada do tipo
  `fix/destaque-por-faturamento`.
- Critério de escolha: `MAX(soma do valor dos atendimentos concluídos)` no
  período; quantidade mantida como dado secundário no retorno.
- Campo novo `valorFaturado` no retorno.
- Desempate documentado em código (proposta em aberto: maior quantidade de
  atendimentos).
- **Permissão:** `valorFaturado` só aparece para quem tem `ver_financeiro`;
  a Recepcionista continua vendo o card, mas **somente** com a quantidade de
  atendimentos, sem o valor em R$.

**Próximo responsável:** Backend (endpoint + contrato) → Frontend (consumo) →
QA.