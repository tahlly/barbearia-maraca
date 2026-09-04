import { CONFIG } from "../config.js";
import type { UserRole } from "../types.js";

export interface UsuarioInterno {
  id: string;
  nome: string;
  email: string;
  senha: string;
  role: "profissional" | "recepcionista";
  professionalId?: string;
  createdAt: string;
}

function readList(): UsuarioInterno[] {
  const raw = localStorage.getItem(CONFIG.usuariosKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as UsuarioInterno[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(list: UsuarioInterno[]): void {
  localStorage.setItem(CONFIG.usuariosKey, JSON.stringify(list));
}

function createId(): string {
  return `USR-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function listUsuariosInternos(): UsuarioInterno[] {
  return readList();
}

export function findUsuarioByEmail(email: string): UsuarioInterno | null {
  const normalized = email.trim().toLowerCase();
  return readList().find((u) => u.email.toLowerCase() === normalized) ?? null;
}

export function validateUsuarioInterno(
  email: string,
  senha: string,
): UsuarioInterno | null {
  const usuario = findUsuarioByEmail(email);
  if (!usuario) return null;
  return usuario.senha === senha ? usuario : null;
}

export function createUsuarioInterno(data: {
  nome: string;
  email: string;
  senha: string;
  role: "profissional" | "recepcionista";
  professionalId?: string;
}): UsuarioInterno {
  const usuario: UsuarioInterno = {
    id: createId(),
    nome: data.nome.trim(),
    email: data.email.trim().toLowerCase(),
    senha: data.senha,
    role: data.role,
    professionalId: data.professionalId,
    createdAt: new Date().toISOString(),
  };
  writeList([...readList(), usuario]);
  return usuario;
}

export function updateUsuarioInterno(id: string, data: { nome?: string; email?: string; senha?: string }): UsuarioInterno | null {
  const list = readList();
  const index = list.findIndex((u) => u.id === id);
  if (index < 0) return null;
  const current = list[index]!;
  const updated: UsuarioInterno = {
    ...current,
    nome: data.nome !== undefined ? data.nome.trim() : current.nome,
    email: data.email !== undefined ? data.email.trim().toLowerCase() : current.email,
    senha: data.senha !== undefined ? data.senha : current.senha,
  };
  list[index] = updated;
  writeList(list);
  return updated;
}

export function findByProfessionalId(professionalId: string): UsuarioInterno | null {
  return readList().find((u) => u.professionalId === professionalId) ?? null;
}

export function deleteUsuarioInterno(id: string): void {
  writeList(readList().filter((u) => u.id !== id));
}

export function roleLabel(role: UserRole): string {
  const map: Record<UserRole, string> = {
    admin: "Administrador",
    recepcionista: "Recepcionista",
    profissional: "Profissional",
    cliente: "Cliente",
  };
  return map[role] ?? "Usuário";
}
