import type { Dependente, DependenteProps, Parentesco } from "../types.js";
import { getSession } from "./auth.js";

/* ------------------------------------------------------------------ */
/*  Dependentes — modo MOCK (localStorage) com assinatura async/await  */
/*  pronta para o backend.                                            */
/*                                                                    */
/*  TODO(backend): quando o endpoint existir, substitua o corpo dos    */
/*  métodos por fetch via httpJson, mantendo a MESMA assinatura:      */
/*    GET    /api/dependentes       -> listarDependentes()            */
/*    POST   /api/dependentes       -> criarDependente(input)         */
/*    PUT    /api/dependentes/:id   -> atualizarDependente(id,input)  */
/*    DELETE /api/dependentes/:id   -> excluirDependente(id)          */
/*  Nada nas views muda: elas consomem apenas estas funções.          */
/* ------------------------------------------------------------------ */

export const DEPENDENTES_UPDATED_EVENT = "maraca:dependentes-updated";

export const PARENTESCO_LABEL: Record<Parentesco, string> = {
  conjuge: "Cônjuge",
  filho: "Filho(a)",
  pai_mae: "Pai/Mãe",
  irmao: "Irmão",
  outros: "Outros",
};

export const PARENTESCO_OPTIONS: Array<{ value: Parentesco; label: string }> = [
  { value: "conjuge", label: "Cônjuge" },
  { value: "filho", label: "Filho(a)" },
  { value: "pai_mae", label: "Pai/Mãe" },
  { value: "irmao", label: "Irmão" },
  { value: "outros", label: "Outros" },
];

/** Chave do mock por usuário: evita vazar dependentes entre contas no mesmo navegador. */
function storageKey(): string {
  const email = getSession()?.userEmail ?? "anon";
  return `maraca.dependentes.${email.toLowerCase()}`;
}

function readLocal(): Dependente[] {
  try {
    const raw = localStorage.getItem(storageKey());
    if (!raw) return [];
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? (parsed as Dependente[]) : [];
  } catch {
    return [];
  }
}

function writeLocal(list: Dependente[]): void {
  localStorage.setItem(storageKey(), JSON.stringify(list));
}

function notify(): void {
  window.dispatchEvent(new CustomEvent(DEPENDENTES_UPDATED_EVENT));
}

function newId(): string {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `${Date.now()}-${Math.random().toString(16).slice(2)}`;
}

/** Lista os dependentes do usuário logado. */
export async function listarDependentes(): Promise<Dependente[]> {
  return readLocal();
}

/** Cria um novo dependente. */
export async function criarDependente(input: DependenteProps): Promise<Dependente> {
  const created: Dependente = {
    id: newId(),
    nome: input.nome.trim().toUpperCase(),
    parentesco: input.parentesco,
  };
  writeLocal([...readLocal(), created]);
  notify();
  return created;
}

/** Atualiza um dependente existente. */
export async function atualizarDependente(id: string, input: DependenteProps): Promise<Dependente> {
  const list = readLocal();
  const index = list.findIndex((d) => d.id === id);
  if (index < 0) throw new Error("Dependente não encontrado.");
  const updated: Dependente = {
    ...list[index]!,
    nome: input.nome.trim().toUpperCase(),
    parentesco: input.parentesco,
  };
  list[index] = updated;
  writeLocal(list);
  notify();
  return updated;
}

/** Exclui um dependente pelo id. */
export async function excluirDependente(id: string): Promise<void> {
  writeLocal(readLocal().filter((d) => d.id !== id));
  notify();
}