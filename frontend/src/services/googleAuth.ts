import { CONFIG } from "../config.js";
import type { Session, UserRole } from "../types.js";
import { ApiError, delay, httpJson, isMockMode } from "./api.js";
import { findClienteByEmail, registerCliente } from "./clientes.js";

export interface GoogleAuthResult {
  ok: boolean;
  session?: Session;
  message?: string;
  avatarUrl?: string;
}

export interface GoogleProfilePayload {
  sub: string;
  nome: string;
  email: string;
  avatarUrl?: string;
}

interface GoogleIdTokenPayload {
  sub?: string;
  email?: string;
  name?: string;
  picture?: string;
}

interface GoogleAccounts {
  accounts?: {
    id?: {
      initialize: (config: { client_id: string; callback: (res: { credential?: string }) => void }) => void;
      prompt: () => void;
    };
  };
}

const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const GIS_SCRIPT_ID = "google-gsi-script";

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as Record<string, unknown>).google) {
      resolve();
      return;
    }
    if (document.getElementById(GIS_SCRIPT_ID)) {
      document.getElementById(GIS_SCRIPT_ID)!.addEventListener("load", () => resolve());
      return;
    }
    const script = document.createElement("script");
    script.id = GIS_SCRIPT_ID;
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    script.onload = () => resolve();
    script.onerror = () => reject(new Error("Falha ao carregar o Google Identity Services."));
    document.head.appendChild(script);
  });
}

/**
 * Abre o seletor de contas do Google via Google Identity Services e retorna o
 * ID token do usuário escolhido. Requer GOOGLE_CLIENT_ID configurado.
 */
export function promptGoogleIdToken(): Promise<string> {
  const clientId = CONFIG.googleClientId;
  if (!clientId) {
    return Promise.reject(new Error("GOOGLE_CLIENT_ID não configurado."));
  }

  return loadGisScript().then(
    () =>
      new Promise<string>((resolve, reject) => {
        const google = (window as unknown as { google?: GoogleAccounts }).google;
        if (!google?.accounts?.id) {
          reject(new Error("Google Identity Services indisponível."));
          return;
        }
        google.accounts.id.initialize({
          client_id: clientId,
          callback: (res) => {
            if (res.credential) {
              resolve(res.credential);
            } else {
              reject(new Error("Autenticação com Google cancelada."));
            }
          },
        });
        google.accounts.id.prompt();
      }),
  );
}

/**
 * Decodifica o payload de um ID token JWT do Google (sem validação de
 * assinatura — a validação é feita pelo backend). Utilizado apenas para obter
 * nome/e-mail/foto exibidos no fluxo.
 */
export function decodeGoogleProfile(idToken: string): GoogleProfilePayload | null {
  try {
    const parts = idToken.split(".");
    if (parts.length !== 3) return null;
    const base64 = parts[1]!.replace(/-/g, "+").replace(/_/g, "/");
    const decoded = decodeURIComponent(
      atob(base64)
        .split("")
        .map((c) => "%" + ("00" + c.charCodeAt(0).toString(16)).slice(-2))
        .join(""),
    );
    const payload = JSON.parse(decoded) as GoogleIdTokenPayload;
    if (!payload.sub || !payload.email) return null;
    return {
      sub: payload.sub,
      email: payload.email,
      nome: payload.name || payload.email,
      avatarUrl: payload.picture,
    };
  } catch {
    return null;
  }
}

/**
 * Inicia o fluxo de autenticação com Google.
 *
 * Em modo real, dispara o fluxo do Google Identity Services (GIS), que abre o
 * seletor de contas do Google e devolve um ID token; o token é enviado ao
 * backend para validação. Em modo mock, simula a autenticação criando ou
 * autenticando um cliente localmente.
 */
export async function loginWithGoogle(
  googleToken?: string,
  googleProfile?: { sub: string; nome: string; email: string; avatarUrl?: string },
): Promise<GoogleAuthResult> {
  if (isMockMode()) {
    return mockGoogleLogin();
  }

  if (!googleToken || !googleProfile) {
    return { ok: false, message: "Autenticação do Google não concluída." };
  }

  try {
    const data = await httpJson<{
      token: string;
      userName: string | null;
      userEmail: string;
      expiresAt?: number;
      role: UserRole;
    }>("/auth/google", {
      method: "POST",
      body: JSON.stringify({ idToken: googleToken }),
    });
    const session: Session = {
      token: data.token,
      userName: data.userName ?? googleProfile.nome,
      userEmail: data.userEmail,
      expiresAt: data.expiresAt ?? Date.now() + CONFIG.sessionTtlMs,
      role: data.role,
    };
    sessionStorage.setItem(CONFIG.sessionKey, JSON.stringify(session));
    return { ok: true, session, avatarUrl: googleProfile.avatarUrl };
  } catch (error) {
    if (error instanceof ApiError) return { ok: false, message: error.message };
    return { ok: false, message: "Falha ao autenticar com Google. Tente novamente." };
  }
}

async function mockGoogleLogin(): Promise<GoogleAuthResult> {
  await delay(900);

  const email = "cliente.google@maraca.com";
  const nome = "Cliente do Google";
  let cliente = findClienteByEmail(email);

  if (!cliente) {
    cliente = registerCliente({
      nome,
      email,
      telefone: "",
      senha: "",
    });
  }

  const session: Session = {
    token: "google-mock-" + Math.random().toString(36).slice(2),
    userName: cliente.nome,
    userEmail: cliente.email,
    expiresAt: Date.now() + CONFIG.sessionTtlMs,
    role: "cliente",
  };
  sessionStorage.setItem(CONFIG.sessionKey, JSON.stringify(session));
  return { ok: true, session };
}
