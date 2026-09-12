import { httpJson } from "./api.js";

// ── Tipos de contrato HTTP (espelho dos endpoints de permissões) ──────────
// GET /permissoes            → { chave, descricao }[]
// GET /permissoes/usuarios   → UsuarioComPermissoes[]
// PUT /permissoes/usuarios/:id → { permissao, concedida } → { ok: true }

export interface PermissaoCatalogoItem {
  chave: string;
  descricao: string;
}

export interface UsuarioComPermissoes {
  usuarioId: string;
  email: string;
  nome: string;
  cargo: string;
  permissoes: Record<string, boolean>;
}

/**
 * Rótulos padrão das permissões — texto canônico dos cabeçalhos do modal
 * (aprovado; ordem das colunas = ordem do catálogo do backend). Usado como
 * fonte primária das chaves conhecidas e fallback quando
 * `listarPermissoesCatalogo` falha ou retorna um catálogo incompleto.
 */
export const PERMISSOES_LABELS: Record<string, string> = {
  agendar_para_cliente: "AGENDAR, REAGENDAR OU CANCELAR AGENDAMENTO",
  criar_admin: "CRIAR NOVOS ADMINISTRADORES",
  editar_servicos_categorias: "EDITAR SERVIÇOS E CATEGORIAS",
  excluir_desativar_funcionario: "EXCLUIR OU DESATIVAR FUNCIONÁRIOS",
  gerenciar_permissoes: "GERENCIAR PERMISSÕES DE USUÁRIOS",
  ver_financeiro: "VISUALIZAR DADOS FINANCEIROS",
};

/**
 * Lista o catálogo de permissões disponíveis.
 * GET /api/permissoes — requer a permissão efetiva `gerenciar_permissoes`.
 */
export async function listarPermissoesCatalogo(): Promise<PermissaoCatalogoItem[]> {
  return httpJson<PermissaoCatalogoItem[]>("/permissoes");
}

/**
 * Lista os funcionários com suas permissões efetivas (matriz + overrides).
 * GET /api/permissoes/usuarios — requer a permissão efetiva `gerenciar_permissoes`.
 */
export async function listarUsuariosComPermissoes(): Promise<UsuarioComPermissoes[]> {
  return httpJson<UsuarioComPermissoes[]>("/permissoes/usuarios");
}

/**
 * Concede ou revoga uma permissão a um funcionário.
 * PUT /api/permissoes/usuarios/:id — requer `gerenciar_permissoes`; o backend
 * bloqueia alterar o próprio usuário (`403`) e a revogação da última
 * permissão de gerenciamento (`400`).
 */
export async function atualizarPermissaoUsuario(
  usuarioId: string,
  permissao: string,
  concedida: boolean,
): Promise<void> {
  await httpJson<{ ok: boolean }>(
    `/permissoes/usuarios/${encodeURIComponent(usuarioId)}`,
    {
      method: "PUT",
      body: JSON.stringify({ permissao, concedida }),
    },
  );
}