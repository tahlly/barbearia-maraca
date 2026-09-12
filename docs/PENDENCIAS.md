# Pendências registradas

Registro rastreável de decisões adiadas e lacunas abertas. Cada pendência
deve informar origem, decisão de negócio (se houver) e caminho sugerido de
retomada. Estado: **aberta** / **decisão confirmada, aguardando
implementação** / **em andamento** / **resolvida**.

---

## P-001 — Dashboard: "Profissional destaque do mês" por faturamento

**Estado:** decisão confirmada, aguardando implementação

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

**Decisão de negócio confirmada (12/09/2026):**
- Implementar na **Opção B**: endpoint próprio no backend (ex.:
  `GET /api/dashboard/destaque`), branch separada do tipo
  `fix/destaque-por-faturamento`.
- Critério de escolha: `MAX(soma do valor dos atendimentos concluídos)` no
  período; quantidade mantida como dado secundário no retorno.
- Desempate: **maior quantidade de atendimentos** no período.
- Campo novo `valorFaturado` no retorno.
- **Permissão:** `valorFaturado` só aparece para quem tem `ver_financeiro`;
  a Recepcionista continua vendo o card, mas **somente** com a quantidade de
  atendimentos, sem o valor em R$.

**Próximo responsável:** Backend (endpoint + contrato) → Frontend (consumo) →
QA.

---

## P-002 — OpenAPI gerado (`openapi.json`) não inclui o módulo Financeiro

**Estado:** resolvida

**Origem:** revisão de QA da rodada 3.4+3.5 (Regras de Comissão). O gerador
`backend/swagger.ts` (lista `apis`) não incluía `financeiro-routes.ts` (nem
`despesa-routes.ts`, `dashboard-routes.ts`) — portanto o `openapi.json`
produzido por `npm run swagger` não continha nenhuma rota/schema do módulo
financeiro (3.1–3.5), mesmo com o bloco OpenAPI interno dos arquivos correto e
validado.

**Resolução (rodada de encerramento 3.1–3.5):**
- `backend/swagger.ts`: adicionados à lista `apis` os arquivos
  `dashboard-routes.ts`, `despesa-routes.ts` e `financeiro-routes.ts`.
- `backend/src/rotas/funcionario-routes.ts`: corrigidos dois `summary` YAML
  que continham `:` sem aspas (`YAMLSemanticError: Nested mappings are not
  allowed in compact mappings`), que faziam o swagger-jsdoc descartar parte do
  input — agora todos os 38 paths entram no catálogo.
- `backend/openapi.json`: regenerado com `npm run swagger`; 38 paths
  (31 anteriores + 7 do financeiro), nenhuma rota antiga removida.
- Validação: rotas `/api/dashboard/graficos`, `/api/despesas*`,
  `/api/financeiro/resumo` e `/api/financeiro/comissao/*` presentes no
  catálogo servido em `http://localhost:3000/api/docs`.

**Próximo responsável:** — (fechada)