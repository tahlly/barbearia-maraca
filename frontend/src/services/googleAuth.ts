import { CONFIG } from "../config.js";
import type { Session, UserRole } from "../types.js";
import { ApiError, httpJson } from "./api.js";

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
      initialize: (config: {
        client_id: string;
        callback: (res: { credential?: string }) => void;
      }) => void;
      prompt: () => void;
    };
  };
}

const GIS_SCRIPT_URL = "https://accounts.google.com/gsi/client";
const GIS_SCRIPT_ID = "google-gsi-script";
const GIS_SCRIPT_TIMEOUT_MS = 15_000;

/**
 * Marcado quando a carga do script GIS falhou (onerror ou timeout). No retry o
 * elemento antigo é removido e o script é recriado: sem isso, o branch de
 * "elemento já existente no DOM" anexaria um listener de `load` a um elemento
 * cujo evento nunca mais será disparado e a Promise ficaria pendente para
 * sempre.
 */
let gisScriptLoadFailed = false;

function loadGisScript(): Promise<void> {
  return new Promise((resolve, reject) => {
    if ((window as unknown as Record<string, unknown>).google) {
      resolve();
      return;
    }

    const existing = document.getElementById(GIS_SCRIPT_ID);
    if (existing && !gisScriptLoadFailed) {
      // Carga ainda em andamento de uma tentativa anterior saudável.
      const timeoutId = setTimeout(() => {
        gisScriptLoadFailed = true;
        reject(new Error("Tempo esgotado ao carregar o Google Identity Services."));
      }, GIS_SCRIPT_TIMEOUT_MS);
      existing.addEventListener("load", () => {
        clearTimeout(timeoutId);
        resolve();
      });
      existing.addEventListener("error", () => {
        clearTimeout(timeoutId);
        gisScriptLoadFailed = true;
        reject(new Error("Falha ao carregar o Google Identity Services."));
      });
      return;
    }

    // Retry após falha: descarta o elemento que nunca mais disparará `load` e
    // recria o script do zero.
    if (existing) existing.remove();
    gisScriptLoadFailed = false;

    const script = document.createElement("script");
    script.id = GIS_SCRIPT_ID;
    script.src = GIS_SCRIPT_URL;
    script.async = true;
    const timeoutId = setTimeout(() => {
      script.remove();
      gisScriptLoadFailed = true;
      reject(new Error("Tempo esgotado ao carregar o Google Identity Services."));
    }, GIS_SCRIPT_TIMEOUT_MS);
    script.onload = () => {
      clearTimeout(timeoutId);
      resolve();
    };
    script.onerror = () => {
      clearTimeout(timeoutId);
      gisScriptLoadFailed = true;
      reject(new Error("Falha ao carregar o Google Identity Services."));
    };
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
 * Dispara o fluxo do Google Identity Services (GIS), que abre o seletor de
 * contas do Google e devolve um ID token; o token é enviado ao backend para
 * validação.
 */
export async function loginWithGoogle(
  googleToken?: string,
  googleProfile?: { sub: string; nome: string; email: string; avatarUrl?: string },
): Promise<GoogleAuthResult> {
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

/**
 * Fluxo completo de login com Google, pronto para ser usado por qualquer tela
 * (não apenas pelo login do cliente).
 *
 * Encapsula em uma única chamada: prompt do Google Identity Services → leitura
 * do perfil → POST /auth/google → persistência da sessão. Uma tela nova pode
 * plugar o botão Google com apenas:
 *
 *   const result = await loginComGoogle();
 *   if (result.ok && result.session) {
 *     redirectForRole(result.session.role);
 *   }
 *
 * Nenhuma tela precisa conhecer validação de token, endpoints ou sessionStorage.
 */
export async function loginComGoogle(): Promise<GoogleAuthResult> {
  let idToken: string;
  try {
    idToken = await promptGoogleIdToken();
  } catch (error) {
    return {
      ok: false,
      message: error instanceof Error ? error.message : "Login com Google indisponível.",
    };
  }

  const profile = decodeGoogleProfile(idToken);
  if (!profile) {
    return { ok: false, message: "Não foi possível ler as informações da conta Google." };
  }

  return loginWithGoogle(idToken, profile);
}
