import { CONFIG } from "../config.js";

export interface AdminProfile {
  id: string;
  nome: string;
  email: string;
  senha: string;
  createdAt: string;
}

const LEGACY_ADMIN_KEY = "maraca.v2.demoAdmin";

function readList(): AdminProfile[] {
  const raw = localStorage.getItem(CONFIG.adminsKey);
  if (!raw) return [];
  try {
    const parsed = JSON.parse(raw) as AdminProfile[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

function writeList(list: AdminProfile[]): void {
  localStorage.setItem(CONFIG.adminsKey, JSON.stringify(list));
}

function createId(): string {
  return `ADM-${Date.now().toString(36).toUpperCase()}${Math.random().toString(36).slice(2, 6).toUpperCase()}`;
}

export function listAdmins(): AdminProfile[] {
  const list = readList();
  if (list.length > 0) return list;

  const legacyRaw = localStorage.getItem(LEGACY_ADMIN_KEY);
  let migrated: AdminProfile | null = null;
  if (legacyRaw) {
    try {
      const parsed = JSON.parse(legacyRaw) as { nome?: string; email?: string; senha?: string };
      if (parsed && typeof parsed.nome === "string" && typeof parsed.email === "string" && typeof parsed.senha === "string") {
        migrated = {
          id: createId(),
          nome: parsed.nome,
          email: parsed.email.trim().toLowerCase(),
          senha: parsed.senha,
          createdAt: new Date().toISOString(),
        };
      }
    } catch {
      /* ignore */
    }
  }

  const seed = migrated ?? {
    id: createId(),
    nome: CONFIG.demoAdmin.name,
    email: CONFIG.demoAdmin.email,
    senha: CONFIG.demoAdmin.password,
    createdAt: new Date().toISOString(),
  };

  const profiles = [seed];
  writeList(profiles);
  localStorage.removeItem(LEGACY_ADMIN_KEY);
  return profiles;
}

export function findAdminByEmail(email: string): AdminProfile | null {
  const normalized = email.trim().toLowerCase();
  return listAdmins().find((a) => a.email.toLowerCase() === normalized) ?? null;
}

export function validateAdminLogin(email: string, senha: string): AdminProfile | null {
  const admin = findAdminByEmail(email);
  if (!admin) return null;
  return admin.senha === senha ? admin : null;
}

export function createAdmin(data: { nome: string; email: string; senha: string }): AdminProfile {
  const admin: AdminProfile = {
    id: createId(),
    nome: data.nome.trim(),
    email: data.email.trim().toLowerCase(),
    senha: data.senha,
    createdAt: new Date().toISOString(),
  };
  writeList([...listAdmins(), admin]);
  return admin;
}

export function updateAdmin(id: string, data: { nome?: string; email?: string; senha?: string }): AdminProfile | null {
  const list = listAdmins();
  const index = list.findIndex((a) => a.id === id);
  if (index < 0) return null;
  const current = list[index]!;
  const updated: AdminProfile = {
    ...current,
    nome: data.nome !== undefined ? data.nome.trim() : current.nome,
    email: data.email !== undefined ? data.email.trim().toLowerCase() : current.email,
    senha: data.senha !== undefined ? data.senha : current.senha,
  };
  list[index] = updated;
  writeList(list);
  return updated;
}

export function deleteAdmin(id: string): void {
  writeList(listAdmins().filter((a) => a.id !== id));
}

export function isLastAdmin(): boolean {
  return listAdmins().length <= 1;
}