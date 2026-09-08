import { z } from 'zod';

/**
 * Política de senha forte, alinhada ao frontend (issue #55):
 * - mínimo 8 caracteres;
 * - ao menos 1 letra maiúscula (inclui acentuadas `À`–`Ü`);
 * - ao menos 1 caractere especial (qualquer caractere fora de letras,
 *   números e espaços — inclusive caracteres acentuados `À`–`ÿ`).
 *
 * Mantenha este padrão idêntico ao usado na SPA
 * (`frontend/src/views/loginCliente.ts`).
 */
export const SENHA_REGEX = /^(?=.*[A-ZÀ-Ü])(?=.*[^A-Za-z0-9À-ÿ\s]).{8,}$/;

/** Mensagem padrão de erro para senha que não atende à política. */
export const MENSAGEM_SENHA_FRACA =
  'Senha deve ter no mínimo 8 caracteres, com letra maiúscula e caractere especial';

/** Schema Zod: senha obrigatória atendendo à política forte. */
export const senhaForteSchema = z.string().regex(SENHA_REGEX, MENSAGEM_SENHA_FRACA);

/** Schema Zod: senha opcional — só valida a política quando o campo estiver presente. */
export const senhaForteOpcionalSchema = senhaForteSchema.optional();

/** Schema Zod: senha opcional com teto de 64 caracteres (cadastro de funcionário). */
export const senhaForteFuncionarioOpcionalSchema = z
  .string()
  .max(64, 'Senha deve ter no máximo 64 caracteres')
  .regex(SENHA_REGEX, MENSAGEM_SENHA_FRACA)
  .optional();