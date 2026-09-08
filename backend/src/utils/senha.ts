import { z } from 'zod';

/**
 * Política de senha forte, alinhada ao frontend (issue #55):
 * - mínimo 8 caracteres;
 * - ao menos 1 letra maiúscula (inclui acentuadas `À`–`Ü`);
 * - ao menos 1 caractere especial (qualquer caractere fora de letras,
 *   números e espaços — inclusive caracteres acentuados `À`–`ÿ`);
 * - teto máximo de 64 caracteres (uniformizado em todos os schemas de senha).
 *
 * Mantenha este padrão idêntico ao usado na SPA
 * (`frontend/src/views/loginCliente.ts`).
 */
export const SENHA_REGEX = /^(?=.*[A-ZÀ-Ü])(?=.*[^A-Za-z0-9À-ÿ\s]).{8,}$/;

/** Mensagem padrão de erro para senha que não atende à política. */
export const MENSAGEM_SENHA_FRACA =
  'Senha deve ter no mínimo 8 caracteres, com letra maiúscula e caractere especial';

/** Mensagem padrão de erro para senha acima do teto de caracteres. */
export const MENSAGEM_SENHA_MUITO_LONGA =
  'Senha deve ter no máximo 64 caracteres';

/** Schema Zod: senha obrigatória atendendo à política forte + teto de 64. */
export const senhaForteSchema = z
  .string()
  .max(64, MENSAGEM_SENHA_MUITO_LONGA)
  .regex(SENHA_REGEX, MENSAGEM_SENHA_FRACA);

/** Schema Zod: senha opcional — só valida a política quando o campo estiver presente. */
export const senhaForteOpcionalSchema = senhaForteSchema.optional();

/**
 * Schema Zod: senha opcional para cadastro de funcionário.
 * Com o teto de 64 já aplicado na base (`senhaForteSchema`), este alias é apenas
 * um sinônimo documentado de `senhaForteOpcionalSchema` — evita duplicação.
 */
export const senhaForteFuncionarioOpcionalSchema = senhaForteOpcionalSchema;