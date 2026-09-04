// Contratos HTTP compartilhados entre Backend e Frontend.
// O Backend é o dono padrão destes tipos (ver AGENTS.md).

export type AuthRole = 'admin' | 'recepcionista' | 'profissional' | 'cliente';

export interface AuthLoginRequest {
  email: string;
  password: string;
}

export interface AuthLoginResponse {
  token: string;
  userName: string | null;
  userEmail: string;
  expiresAt?: number;
  role: AuthRole;
  user?: AuthUsuario;
}

export interface AuthRegisterRequest {
  email: string;
  senha: string;
  nome: string;
  telefone?: string;
}

export interface AuthRegisterResponse {
  token: string;
  user: {
    id: string;
    email: string;
    nome: string | null;
    tipo: string;
  };
}

export interface GoogleLoginRequest {
  idToken: string;
}

export interface GoogleLoginResponse {
  token: string;
  userName: string | null;
  userEmail: string;
  expiresAt?: number;
  role: AuthRole;
  avatarUrl?: string | null;
}

export interface AuthLogoutResponse {
  mensagem: string;
}

export interface AuthUsuario {
  id: string;
  email: string;
  tipo: string;
  nome: string | null;
  cargo?: string | null;
  avatarUrl?: string | null;
}

export type AgendamentoStatus = 'pendente' | 'confirmado' | 'cancelado' | 'concluido';

export interface AgendamentoDTO {
  id: string;
  clienteId: string;
  clienteNome: string | null;
  funcionarioId: string;
  funcionarioNome: string | null;
  servicoId: string;
  servicoNome: string | null;
  data: string;
  hora: string;
  status: AgendamentoStatus;
  observacao: string | null;
  criadoEm?: string;
}

export interface CreateAgendamentoRequest {
  funcionario_id: string;
  servico_id: string;
  data: string;
  hora: string;
  observacao?: string | null;
}

// ---- Domínio Horários ----

export interface HorarioTrabalhoDTO {
  id: string;
  funcionario_id: string;
  funcionario_nome: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
  ativo: boolean;
  created_at: Date | string;
  updated_at: Date | string;
}

export interface CreateHorarioRequest {
  funcionario_id: string;
  dia_semana: number;
  hora_inicio: string;
  hora_fim: string;
}

export interface UpdateHorarioRequest {
  dia_semana?: number;
  hora_inicio?: string;
  hora_fim?: string;
}

// ── Funcionários ──────────────────────────────────────────────

export type CargoFuncionario = 'barbeiro' | 'recepcionista' | 'administrador';

/** Dados de exibição pública (sem email, sem usuario_id). */
export interface FuncionarioPublicoDTO {
  id: string;
  nome: string;
  especialidade: string | null;
  foto: string | null;
  descricao: string | null;
}

/** Dados completos do funcionário (admin/recep/próprio barbeiro). */
export interface FuncionarioDTO {
  id: string;
  usuarioId: string;
  nome: string;
  telefone: string | null;
  cargo: CargoFuncionario;
  especialidade: string | null;
  foto: string | null;
  descricao: string | null;
  ativo: boolean;
  email: string;
  createdAt: string;
  updatedAt: string;
}

/** Body de criação de funcionário. */
export interface CreateFuncionarioRequest {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  cargo?: CargoFuncionario;
  especialidade?: string;
}

/** Body de atualização de funcionário. */
export interface UpdateFuncionarioRequest {
  nome?: string;
  telefone?: string;
  cargo?: CargoFuncionario;
  especialidade?: string;
  foto?: string;
  descricao?: string;
}

/** Body de alternância de status (ativo/inativo). */
export interface UpdateFuncionarioStatusRequest {
  ativo: boolean;
}

// --- Contratos HTTP de Serviço ---
// `preco` é DECIMAL no banco; no JSON é serializado como string para preservar
// a precisão decimal exata de moeda (evita erros de ponto flutuante).

export interface ServicoDTO {
  id: string;
  nome: string;
  descricao?: string | null;
  duracao_minutos: number;
  preco: string;
  ativo: boolean;
}

export interface ServicoPublicoDTO {
  id: string;
  nome: string;
  descricao?: string | null;
  duracao_minutos: number;
  preco: string;
}

export interface CreateServicoRequest {
  nome: string;
  descricao?: string | null;
  duracao_minutos: number;
  preco: string | number;
}

export interface UpdateServicoRequest {
  nome?: string;
  descricao?: string | null;
  duracao_minutos?: number;
  preco?: string | number;
}

export interface UpdateServicoStatusRequest {
  ativo: boolean;
}

// --- Contratos HTTP de Clientes ---

/** Dados de exibição de um cliente (inclui email do usuário vinculado). */
export interface ClienteDTO {
  id: string;
  nome: string;
  email: string;
  telefone: string | null;
}

/** Body de criação de cliente. A senha é obrigatória para o fluxo demo atual. */
export interface CreateClienteRequest {
  nome: string;
  email: string;
  telefone?: string;
  senha?: string;
}

/** Body de atualização de cliente (campos opcionais). */
export interface UpdateClienteRequest {
  nome?: string;
  email?: string;
  telefone?: string;
}
