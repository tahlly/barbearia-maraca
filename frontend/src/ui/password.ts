/**
 * Política de senha forte (issue #55), espelhada do backend
 * (`backend/src/utils/senha.ts: SENHA_REGEX`):
 * - mínimo 8 caracteres;
 * - ao menos 1 letra maiúscula (inclui acentuadas `À`–`Ü`);
 * - ao menos 1 caractere especial (qualquer caractere fora de letras,
 *   números e espaços — inclusive caracteres acentuados `À`–`ÿ`).
 *
 * Mantenha este padrão idêntico ao usado no backend.
 */
export const SENHA_FORTE_REGEX = /^(?=.*[A-ZÀ-Ü])(?=.*[^A-Za-z0-9À-ÿ\s]).{8,}$/;

/** Mensagem pt-BR exibida no formulário (mesma semântica do backend). */
export const SENHA_FORTE_MESSAGE =
  "Senha deve ter no mínimo 8 caracteres, com letra maiúscula e caractere especial";

/** Retorna `true` quando a senha atende à política de senha forte. */
export function isSenhaForte(senha: string): boolean {
  return SENHA_FORTE_REGEX.test(senha);
}