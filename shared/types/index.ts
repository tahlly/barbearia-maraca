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
  // OBRIGATÓRIO quando o solicitante é recepcionista/admin (cria para um
  // cliente informado). Ignorado/desnecessário para o papel cliente, cujo
  // registro é resolvido pelo token JWT.
  cliente_id?: string;
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
  cargo: CargoFuncionario;
  especialidade: string | null;
  foto: string | null;
  descricao: string | null;
  /** Nomes das categorias que o profissional atende. */
  categorias: string[];
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
  /** Nomes das categorias que o profissional atende. */
  categorias: string[];
}

/** Body de criação de funcionário. */
export interface CreateFuncionarioRequest {
  nome: string;
  email: string;
  senha: string;
  telefone?: string;
  cargo?: CargoFuncionario;
  especialidade?: string;
  /** undefined → não mexer; [] → limpar; [nome, ...] → reescrever. */
  categorias?: string[];
}

/** Body de atualização de funcionário. */
export interface UpdateFuncionarioRequest {
  nome?: string;
  telefone?: string;
  cargo?: CargoFuncionario;
  especialidade?: string;
  foto?: string;
  descricao?: string;
  /** undefined → não mexer; [] → limpar; [nome, ...] → reescrever. */
  categorias?: string[];
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

// --- Contratos HTTP do Domínio Financeiro (Despesas / Faturamento) ---
// Valores monetários são SEMPRE strings decimais normalizadas (ex.: "45.90") —
// nunca numbers — para preservar a precisão decimal exata de moeda no JSON.

export type TipoDespesa = 'fixa' | 'variavel' | 'comissao' | 'outro';

/**
 * Resumo de despesas de um período.
 * Endpoint: `GET /api/despesas/resumo`.
 * Acesso: somente usuários com a permissão efetiva `ver_financeiro`
 * (admin tem por padrão; overrides no banco contam). Caso contrário → 403.
 */
export interface DespesaResumoDTO {
  /** Data inicial do período (YYYY-MM-DD). */
  inicio: string;
  /** Data final do período (YYYY-MM-DD). */
  fim: string;
  /** Soma das despesas do período, string decimal normalizada (ex.: "57.50"). */
  despesaTotal: string;
}

/**
 * Resumo de faturamento (agendamentos concluídos) de um período.
 * Endpoint: `GET /api/agendamentos/faturamento`.
 *
 * `despesaTotal`, `lucroLiquido` e `margem` são campos financeiros sensíveis e
 * SÓ aparecem na resposta quando o solicitante possui a permissão efetiva
 * `ver_financeiro` (admin tem por padrão; overrides no banco contam). Para
 * demais usuários (ex.: profissional sem override) estes três campos são
 * OMITIDOS do JSON — nunca retornados como "0.00" fake.
 */
export interface FaturamentoResumoDTO {
  /** Data inicial do período (YYYY-MM-DD). */
  inicio: string;
  /** Data final do período (YYYY-MM-DD). */
  fim: string;
  /** Faturamento no período (soma dos serviços de agendamentos concluídos). */
  valorTotal: string;
  /** Quantidade de agendamentos concluídos no período. */
  quantidade: number;
  /** Ticket médio = valorTotal / quantidade (string decimal normalizada). */
  ticketMedio: string;
  /** Detalhamento por serviço. */
  porServico: Array<{
    servicoId: string;
    servicoNome: string;
    quantidade: number;
    valorTotal: string;
  }>;
  /** Soma das despesas do período. SÓ para quem tem `ver_financeiro`. */
  despesaTotal?: string;
  /** Lucro líquido = valorTotal − despesaTotal. SÓ para quem tem `ver_financeiro`. */
  lucroLiquido?: string;
  /** Margem = lucro / faturamento × 100 (percentual, 2 casas). SÓ para quem tem `ver_financeiro`. */
  margem?: string;
}

// --- Contratos HTTP do Dashboard (gráficos da seção 3.1) ---

/**
 * Distribuição de agendamentos por status em um período.
 * Endpoint: `GET /api/dashboard/graficos`.
 *
 * O mapa SEMPRE contém as 4 chaves do enum `status_agendamento`
 * (`pendente`, `confirmado`, `cancelado`, `concluido`) — status sem
 * agendamentos no período vêm com `0`. A decisão de agrupar visualmente
 * (ex.: confirmado + pendente na renderização) é EXCLUSIVA do Frontend;
 * o backend devolve os contadores brutos por status.
 */
export interface DistribuicaoStatusDTO {
  pendente: number;
  confirmado: number;
  cancelado: number;
  concluido: number;
}

/** Contagem de agendamentos em um único dia. */
export interface AgendamentosDiaDTO {
  /** Data no formato YYYY-MM-DD (fuso do servidor). */
  data: string;
  /** Quantidade de agendamentos naquele dia. */
  quantidade: number;
}

/**
 * Contagem de agendamentos por dia dentro de uma janela (7 ou 30 dias).
 * Endpoint: `GET /api/dashboard/graficos`.
 *
 * A janela é definida pelo parâmetro `dias` (7 ou 30), terminando em HOJE
 * (dias corridos, ambos os extremos inclusivos). Todos os dias da janela
 * estão presentes no array — dias sem agendamentos vêm com `quantidade: 0`,
 * para o gráfico de barras/linha não precisar completar lacunas.
 */
export interface AgendamentosPorDiaDTO {
  /** Data inicial da janela (YYYY-MM-DD, hoje − (dias − 1)). */
  inicio: string;
  /** Data final da janela (YYYY-MM-DD, HOJE). */
  fim: string;
  /** Contagens por dia, sempre com `dias` itens (zeros preenchidos). */
  dias: AgendamentosDiaDTO[];
}

/** Contagem de agendamentos em um slot de 30 minutos. */
export interface HorarioPicoDTO {
  /**
   * Hora de início REAL do agendamento (coluna `hora`, tipo `time`) no
   * formato HH:MM — sem arredondar para hora cheia (ex.: "09:30", "13:00").
   * Slots são de 30 minutos e refletem o horário armazenado em banco.
   */
  hora: string;
  /** Quantidade de agendamentos no slot. */
  quantidade: number;
}

/** Contagem de agendamentos CONCLUÍDOS por serviço (barras horizontais). */
export interface ServicoMaisVendidoDTO {
  servicoId: string;
  servicoNome: string;
  /** Quantidade de agendamentos concluídos do serviço no período. */
  quantidade: number;
}

/**
 * Resposta completa dos gráficos do Dashboard.
 * Endpoint: `GET /api/dashboard/graficos`.
 * Acesso: somente usuários com a permissão efetiva `ver_financeiro`
 * (admin por padrão; overrides no banco contam). Caso contrário → 403.
 *
 * `inicio`/`fim` definem o período base (default: ano corrente) que rege a
 * Distribuição por status, os Horários de pico e os Serviços mais vendidos.
 * O gráfico de Agendamentos por dia usa a janela própria `dias` (7/30),
 * terminando em hoje.
 */
export interface DashboardGraficosDTO {
  /** Data inicial do período base (YYYY-MM-DD). */
  inicio: string;
  /** Data final do período base (YYYY-MM-DD). */
  fim: string;
  /** Contagem bruta por status (todas as 4 chaves presentes). */
  distribuicaoStatus: DistribuicaoStatusDTO;
  /** Agendamentos por dia na janela 7/30 (zeros preenchidos). */
  agendamentosPorDia: AgendamentosPorDiaDTO;
  /** Agendamentos por slot de 30 minutos no período base. */
  horariosPico: HorarioPicoDTO[];
  /** Agendamentos concluídos por serviço no período base (mais vendidos). */
  servicosMaisVendidos: ServicoMaisVendidoDTO[];
}
