export type ServiceIcon = "scissors" | "beard" | "layers" | "sparkle";

export type UserRole = "admin" | "recepcionista" | "profissional" | "cliente";

export interface Service {
  id: string;
  name: string;
  description: string;
  categories: string[];
  durationMin: number;
  price: number;
  icon: ServiceIcon;
  active: boolean;
}

export type CargoFuncionario = "barbeiro" | "recepcionista" | "administrador";

export interface Professional {
  id: string;
  name: string;
  role: string;
  categories: string[];
  active: boolean;
  email?: string;
  photo?: string;
  userRole?: "profissional" | "recepcionista";
  photoUrl?: string;
  cargo?: CargoFuncionario;
}

export type AppointmentStatus = "confirmado" | "pendente" | "concluido" | "cancelado";

/**
 * Espelho do `AgendamentoDTO` do backend (contrato HTTP compartilhado).
 * Campos em camelCase conforme serialização do backend (knex snake→camel).
 */
export interface Appointment {
  id: string;
  clienteId: string;
  clienteNome: string | null;
  funcionarioId: string;
  funcionarioNome: string | null;
  servicoId: string;
  servicoNome: string | null;
  data: string;
  hora: string;
  status: AppointmentStatus;
  observacao?: string | null;
  criadoEm?: string;
}

/**
 * Body de criação de agendamento, alinhado a `CreateAgendamentoRequest`.
 * O backend resolve cliente a partir do token JWT quando `clienteId` não é
 * informado; recepcionista/admin devem informar `clienteId` (agendar em nome
 * do cliente).
 */
export interface BookingDraft {
    funcionario_id: string;
    servico_id: string;
    data: string;
    hora: string;
    observacao?: string | null;
    clienteId?: string;
    /** Offset do navegador em minutos relativos a UTC (ex.: -180 para UTC-3). */
    timezoneOffsetMinutes?: number;
  }

export interface Session {
  token: string;
  userName: string;
  userEmail: string;
  expiresAt: number;
  role: UserRole;
  precisaTrocarSenha?: boolean;
  /** Permissões efetivas do usuário logado (RBAC granular, Item 1). */
  permissoes?: Record<string, boolean>;
  /** URL da foto de perfil (ex.: data URL local ou imagem do Google). */
  avatarUrl?: string;
}

export interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  senha: string;
  createdAt: string;
  googleId?: string;
  avatarUrl?: string;
}

/* ------------------------------------------------------------------ */
/*  Dependentes (modo mock no frontend; contrato em preparação)        */
/* ------------------------------------------------------------------ */

export type Parentesco = "conjuge" | "filho" | "pai_mae" | "irmao" | "outros";

/**
 * DTO de escrita de dependente (payload de criação/edição).
 * Quando o backend integrar, este é o body de POST/PUT /api/dependentes.
 */
export interface DependenteProps {
  nome: string;
  parentesco: Parentesco;
}

/**
 * Entidade dependente (compõe DependenteProps + id gerado).
 * Espelho do futuro `DependenteDTO` do backend.
 */
export interface Dependente extends DependenteProps {
  id: string;
}
