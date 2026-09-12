import { CONFIG } from "../config.js";

/** Evento global emitido quando a sessão/estado do usuário muda (ex.: nova foto). */
export const SESSION_UPDATED_EVENT = "maraca:session-updated";

/**
 * Chaves de sessionStorage que pertencem ao usuário/sessão.
 *
 * Preferências de dispositivo (tema em `maraca.theme`, colapso do painel em
 * `maraca.panel.collapsed`) vivem em localStorage e NÃO entram aqui — não são
 * dados do usuário e devem ser preservadas entre sessões.
 */
const USER_STORAGE_KEYS: readonly string[] = [
  CONFIG.sessionKey,
  "maraca.profilePhoto",
  "maraca.attempts",
  "maraca.lockout",
];

/**
 * Limpa todo o estado local do usuário (logout, sessão expirada em 401).
 *
 * Por padrão notifica a UI via `SESSION_UPDATED_EVENT` para que componentes
 * montados (sidebar) descartem imediatamente referências em memória à foto de
 * perfil (background-image) antes do próximo login. Use `notify = false` em
 * caminhos chamados com alta frequência (ex.: `getSession`) para evitar loops.
 */
export function clearUserStorage(notify = true): void {
  for (const key of USER_STORAGE_KEYS) {
    sessionStorage.removeItem(key);
  }
  if (notify) {
    window.dispatchEvent(new CustomEvent(SESSION_UPDATED_EVENT));
  }
}
