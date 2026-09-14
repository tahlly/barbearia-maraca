/**
 * Paginação client-side das listagens de agendamentos (todas as views).
 *
 * Os dados chegam completos do backend (`listAppointments`); a paginação é
 * feita no cliente com `.slice()` sobre o array já filtrado — nenhuma mudança
 * de contrato/API é necessária.
 *
 * Estado local por renderização; sempre que o usuário troca o select de itens
 * por página ou executa uma nova consulta (filtros), a navegação volta para a
 * primeira página.
 */

export const PAGINACAO_OPCOES = [5, 10, 20] as const;
export const PAGINACAO_PADRAO = 10;

export interface PaginacaoEstado {
  paginaAtual: number;
  itensPorPagina: number;
}

export function criarPaginacaoEstado(itensPorPagina: number = PAGINACAO_PADRAO): PaginacaoEstado {
  return { paginaAtual: 1, itensPorPagina };
}

export function totalPaginas(totalItens: number, itensPorPagina: number): number {
  if (totalItens <= 0) return 1;
  return Math.ceil(totalItens / itensPorPagina);
}

/** Ajusta a página atual para o intervalo [1, totalPaginas]. */
export function limitarPagina(pagina: number, totalItens: number, itensPorPagina: number): number {
  return Math.min(Math.max(1, pagina), totalPaginas(totalItens, itensPorPagina));
}

/** Fatia a lista completa para a página atual (client-side). */
export function paginar<T>(itens: readonly T[], estado: PaginacaoEstado): T[] {
  const inicio = (estado.paginaAtual - 1) * estado.itensPorPagina;
  return itens.slice(inicio, inicio + estado.itensPorPagina);
}

/**
 * Texto descritivo do intervalo exibido, ex.: "Mostrando 1 a 10 de 45
 * agendamentos" (o rótulo é customizável, ex.: "serviços").
 */
export function textoIntervalo(
  totalItens: number,
  estado: PaginacaoEstado,
  singular: string = "agendamento",
  plural: string = "agendamentos",
): string {
  if (totalItens <= 0) return `Mostrando 0 ${plural}`;
  const inicio = (estado.paginaAtual - 1) * estado.itensPorPagina + 1;
  const fim = Math.min(estado.paginaAtual * estado.itensPorPagina, totalItens);
  const palavra = totalItens === 1 ? singular : plural;
  return `Mostrando ${inicio} a ${fim} de ${totalItens} ${palavra}`;
}

/**
 * HTML do rodapé de paginação: select de itens por página (5/10/20, padrão 10),
 * texto descritivo do intervalo e botões Primeira (<<), Anterior (<), Próxima
 * (>) e Última (>>). Botões desabilitados fora do limite.
 *
 * Controles identificados por `data-pag-first|prev|next|last` e
 * `data-pag-itens`; os listeners são registrados uma única vez por
 * renderização via `bindPaginacao` (delegação).
 */
export function paginacaoHtml(
  totalItens: number,
  estado: PaginacaoEstado,
  singular: string = "agendamento",
  plural: string = "agendamentos",
): string {
  const paginas = totalPaginas(totalItens, estado.itensPorPagina);
  const naPrimeira = estado.paginaAtual <= 1;
  const naUltima = estado.paginaAtual >= paginas;
  const opcoes = PAGINACAO_OPCOES.map(
    (n) => `<option value="${n}" ${n === estado.itensPorPagina ? "selected" : ""}>${n}</option>`,
  ).join("");
  return `
    <div class="pagination" role="navigation" aria-label="Paginação de ${plural}">
      <label class="pagination__per">
        <span class="pagination__label">Itens por página</span>
        <select class="input pagination__select" data-pag-itens aria-label="Itens por página">${opcoes}</select>
      </label>
      <span class="pagination__info">${textoIntervalo(totalItens, estado, singular, plural)}</span>
      <div class="pagination__controls">
        <button type="button" class="btn btn--sm btn--ghost pagination__btn" data-pag-first aria-label="Primeira página" ${naPrimeira ? "disabled" : ""}>&lt;&lt;</button>
        <button type="button" class="btn btn--sm btn--ghost pagination__btn" data-pag-prev aria-label="Página anterior" ${naPrimeira ? "disabled" : ""}>&lt;</button>
        <span class="pagination__page">Página ${estado.paginaAtual} de ${paginas}</span>
        <button type="button" class="btn btn--sm btn--ghost pagination__btn" data-pag-next aria-label="Próxima página" ${naUltima ? "disabled" : ""}>&gt;</button>
        <button type="button" class="btn btn--sm btn--ghost pagination__btn" data-pag-last aria-label="Última página" ${naUltima ? "disabled" : ""}>&gt;&gt;</button>
      </div>
    </div>
  `;
}

/**
 * Liga os controles de paginação presentes em `container` por delegação.
 *
 * - `data-pag-itens` (select): muda `itensPorPagina` e volta para a página 1.
 * - `data-pag-first|prev|next|last`: navegam na página atual.
 *
 * `obterTotal` retorna o total de itens da lista filtrada atual; `aoNavegar`
 * re-renderiza a página. Retorna a função de cleanup.
 */
export function bindPaginacao(
  container: HTMLElement,
  estado: PaginacaoEstado,
  obterTotal: () => number,
  aoNavegar: () => void,
): () => void {
  const handle = (event: Event): void => {
    const target = event.target as HTMLElement;
    const select = target.closest<HTMLSelectElement>("[data-pag-itens]");
    if (select) {
      const novo = Number(select.value);
      if (Number.isFinite(novo) && novo > 0) {
        estado.itensPorPagina = novo;
        estado.paginaAtual = 1;
        aoNavegar();
      }
      return;
    }
    const btn = target.closest<HTMLElement>(
      "[data-pag-first],[data-pag-prev],[data-pag-next],[data-pag-last]",
    );
    if (!btn || btn.hasAttribute("disabled")) return;
    const total = obterTotal();
    const paginas = totalPaginas(total, estado.itensPorPagina);
    if (btn.hasAttribute("data-pag-first")) estado.paginaAtual = 1;
    else if (btn.hasAttribute("data-pag-prev")) estado.paginaAtual = Math.max(1, estado.paginaAtual - 1);
    else if (btn.hasAttribute("data-pag-next")) estado.paginaAtual = Math.min(paginas, estado.paginaAtual + 1);
    else if (btn.hasAttribute("data-pag-last")) estado.paginaAtual = paginas;
    aoNavegar();
  };
  container.addEventListener("click", handle);
  return () => container.removeEventListener("click", handle);
}