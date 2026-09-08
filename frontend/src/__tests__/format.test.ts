import { describe, it, expect } from 'vitest';
import { escapeHtml } from '../ui/dom';
import { formatCurrency, todayIso } from '../ui/format';

/* ------------------------------------------------------------------ */
/*  escapeHtml                                                        */
/* ------------------------------------------------------------------ */
describe('escapeHtml', () => {
  it('escapa ampersand', () => {
    expect(escapeHtml('a & b')).toBe('a &amp; b');
  });

  it('escapa tag de abertura', () => {
    expect(escapeHtml('<div>')).toBe('&lt;div&gt;');
  });

  it('escapa aspas duplas', () => {
    expect(escapeHtml('say "hi"')).toBe('say &quot;hi&quot;');
  });

  it('escapa aspas simples', () => {
    expect(escapeHtml("it's")).toBe('it&#039;s');
  });

  it('retorna string vazia sem alteração', () => {
    expect(escapeHtml('')).toBe('');
  });

  it('não altera texto sem caracteres especiais', () => {
    expect(escapeHtml('hello world')).toBe('hello world');
  });

  it('escapa múltiplos caracteres misturados', () => {
    expect(escapeHtml('<b>"O\'A"</b>')).toBe('&lt;b&gt;&quot;O&#039;A&quot;&lt;/b&gt;');
  });
});

/* ------------------------------------------------------------------ */
/*  formatCurrency                                                    */
/* ------------------------------------------------------------------ */
describe('formatCurrency', () => {
  it('formata zero como R$ 0,00', () => {
    expect(formatCurrency(0)).toBe('R$\u00a00,00');
  });

  it('formata valor inteiro simples', () => {
    expect(formatCurrency(25)).toBe('R$\u00a025,00');
  });

  it('formata valor com centavos', () => {
    expect(formatCurrency(19.9)).toBe('R$\u00a019,90');
  });

  it('formata valor grande com separador de milhar', () => {
    expect(formatCurrency(1234.56)).toBe('R$\u00a01.234,56');
  });
});

/* ------------------------------------------------------------------ */
/*  todayIso                                                          */
/* ------------------------------------------------------------------ */
describe('todayIso', () => {
  it('retorna string no formato YYYY-MM-DD', () => {
    const result = todayIso();
    expect(result).toMatch(/^\d{4}-\d{2}-\d{2}$/);
  });

  it('retorna a data de hoje', () => {
    const result = todayIso();
    const now = new Date();
    const expected = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
    expect(result).toBe(expected);
  });
});
