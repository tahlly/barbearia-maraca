import { describe, it, expect } from 'vitest';
import { isSenhaForte, SENHA_FORTE_MESSAGE, SENHA_FORTE_REGEX } from '../ui/password';

describe('isSenhaForte — política de senha forte (issue #55)', () => {
  it('aceita senha forte (8+, maiúscula e especial)', () => {
    expect(isSenhaForte('SenhaForte!123')).toBe(true);
  });

  it('aceita exatamente 8 caracteres com complexidade', () => {
    expect(isSenhaForte('Abcdefg!')).toBe(true);
  });

  it('aceita senha sem números (maiúscula + especial bastam)', () => {
    expect(isSenhaForte('Password!')).toBe(true);
  });

  it('aceita letra maiúscula acentuada como maiúscula', () => {
    expect(isSenhaForte('SENHÀFORTE!123')).toBe(true);
  });

  it('rejeita letra minúscula acentuada como maiúscula', () => {
    expect(isSenhaForte('senhàforte!123')).toBe(false);
  });

  it('rejeita senha sem maiúscula', () => {
    expect(isSenhaForte('senha!123')).toBe(false);
  });

  it('rejeita senha sem caractere especial', () => {
    expect(isSenhaForte('Senha1234')).toBe(false);
  });

  it('rejeita senha curta (7 caracteres)', () => {
    expect(isSenhaForte('Ab!123')).toBe(false);
  });

  it('rejeita senha padrão do seed (123456)', () => {
    expect(isSenhaForte('123456')).toBe(false);
  });

  it('rejeita string vazia e somente espaços', () => {
    expect(isSenhaForte('')).toBe(false);
    expect(isSenhaForte('   ')).toBe(false);
  });
});

describe('SENHA_FORTE_MESSAGE', () => {
  it('expõe mensagem pt-BR clara da política', () => {
    expect(SENHA_FORTE_MESSAGE).toContain('no mínimo 8 caracteres');
    expect(SENHA_FORTE_MESSAGE).toContain('maiúscula');
    expect(SENHA_FORTE_MESSAGE).toContain('especial');
  });

  it('usa exatamente a mesma regex do backend (PR #52)', () => {
    expect(SENHA_FORTE_REGEX.source).toBe('^(?=.*[A-ZÀ-Ü])(?=.*[^A-Za-z0-9À-ÿ\\s]).{8,}$');
  });
});