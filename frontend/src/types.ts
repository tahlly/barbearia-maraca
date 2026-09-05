export type ServiceIcon = "scissors" | "beard" | "layers" | "sparkle";

export type UserRole = "admin" | "recepcionista" | "profissional" | "cliente";

export interface Service {
  id: string;
  name: string;
  description: string;
  category: string;
  durationMin: number;
  price: number;
  icon: ServiceIcon;
  active: boolean;
}

export interface Professional {
  id: string;
  name: string;
  role: string;
  category: string;
  active: boolean;
  email?: string;
  photo?: string;
  userRole?: "profissional" | "recepcionista";
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
 * O backend resolve cliente a partir do token JWT.
 */
export interface BookingDraft {
  funcionario_id: string;
  servico_id: string;
  data: string;
  hora: string;
  observacao?: string | null;
}

export interface Session {
  token: string;
  userName: string;
  userEmail: string;
  expiresAt: number;
  role: UserRole;
}

export interface Cliente {
  id: string;
  nome: string;
  email: string;
  telefone: string;
  createdAt: string;
  googleId?: string;
  avatarUrl?: string;
}