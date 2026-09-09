// DTOs internos do domínio Funcionário (camada backend).

/** Linha bruta da tabela `funcionario`. */
export interface FuncionarioRow {
  id: string;
  usuario_id: string;
  nome: string;
  telefone: string | null;
  cargo: string;
  especialidade: string | null;
  categoria: string | null;
  foto: string | null;
  descricao: string | null;
  ativo: boolean;
  created_at: string;
  updated_at: string;
}

/** Linha bruta da tabela `usuario` (campos mínimos). */
export interface UsuarioBasicoRow {
  id: string;
  email: string;
  senha_hash: string | null;
  tipo: string;
  google_id: string | null;
  avatar_url: string | null;
}

/** Dados de exibição pública (sem email, sem usuario_id). */
export interface FuncionarioPublicoDTO {
  id: string;
  nome: string;
  cargo: string;
  especialidade: string | null;
  categoria: string | null;
  foto: string | null;
  descricao: string | null;
  /** Nomes das categorias que o profissional atende (N:N via funcionario_categoria). */
  categorias: string[];
}

/** Dados completos do funcionário (inclui email do usuario). */
export interface FuncionarioCompletoDTO {
  id: string;
  usuarioId: string;
  nome: string;
  telefone: string | null;
  cargo: string;
  especialidade: string | null;
  categoria: string | null;
  foto: string | null;
  descricao: string | null;
  ativo: boolean;
  email: string;
  createdAt: string;
  updatedAt: string;
  /** Nomes das categorias que o profissional atende (N:N via funcionario_categoria). */
  categorias: string[];
}

/** Retorno de criação de funcionário. */
export interface FuncionarioCriadoDTO {
  id: string;
  usuarioId: string;
  nome: string;
  email: string;
  telefone: string | null;
  cargo: string;
  especialidade: string | null;
  /** Nomes das categorias atribuídas na criação. */
  categorias: string[];
}
