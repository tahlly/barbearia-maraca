/**
 * Deep-link de configuração de comissão entre views.
 *
 * A tela Financeiro (aba Regras de Comissão) e a tela Profissionais são rotas
 * SPA separadas (`#/admin/financeiro` e `#/admin/profissionais`). Quando o
 * admin clica em "Configurar agora" de uma pendência, esta view grava o
 * comando em sessionStorage (chave não sensível, apenas de navegação) e
 * navega para Profissionais; `manage.ts` consome o comando ao montar a aba e
 * abre `openProModal` do profissional com foco no input do serviço pendente.
 *
 * O comando é consumido UMA ÚNICA vez (leitura com remoção atômica) para não
 * reabrir o modal a cada render da aba.
 */

const CHAVE = "maraca.comissao.deep-link";

export interface ComissaoDeepLink {
  funcionarioId: string;
  servicoId: string;
}

/** Grava o comando de navegação antes de trocar de rota SPA. */
export function salvarComissaoDeepLink(link: ComissaoDeepLink): void {
  try {
    sessionStorage.setItem(CHAVE, JSON.stringify(link));
  } catch {
    // Session storage indisponível (ex.: modo privado): o fluxo degrada para
    // a navegação comum sem abrir o modal — o usuário ainda pode configurar
    // manualmente pelos cards de Profissionais.
  }
}

/** Lê e remove o comando pendente. Retorna `null` quando não há comando. */
export function consumirComissaoDeepLink(): ComissaoDeepLink | null {
  try {
    const raw = sessionStorage.getItem(CHAVE);
    if (!raw) return null;
    sessionStorage.removeItem(CHAVE);
    const parsed = JSON.parse(raw) as Partial<ComissaoDeepLink>;
    if (
      typeof parsed.funcionarioId === "string" &&
      parsed.funcionarioId.trim() !== "" &&
      typeof parsed.servicoId === "string" &&
      parsed.servicoId.trim() !== ""
    ) {
      return { funcionarioId: parsed.funcionarioId, servicoId: parsed.servicoId };
    }
    return null;
  } catch {
    return null;
  }
}