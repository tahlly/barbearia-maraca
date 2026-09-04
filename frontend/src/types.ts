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
  userRole?: "profissional" | "recepcionista";
}

export type AppointmentStatus = "confirmado" | "pendente" | "concluido" | "cancelado";

export interface Appointment {
  code: string;
  clientName: string;
  phone: string;
  email: string;
  serviceIds: string[];
  professionalId: string;
  dateIso: string;
  time: string;
  status: AppointmentStatus;
  createdAt: string;
}

export interface BookingDraft {
  serviceIds: string[];
  professionalId: string;
  dateIso: string;
  time: string;
  clientName: string;
  phone: string;
  email: string;
}

export interface AdminAppointment extends Appointment {
  id: string;
  serviceName?: string;
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
  senha: string;
  createdAt: string;
  googleId?: string;
  avatarUrl?: string;
}
