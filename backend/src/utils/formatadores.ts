/**
 * Normaliza um valor de data (Date do driver PG ou string "YYYY-MM-DD")
 * para o formato "YYYY-MM-DD" usando componentes LOCAIS do Date
 * (evita deslocamento de timezone ao usar toISOString).
 */
export function formatarData(valor: unknown): string {
  if (typeof valor === 'string') {
    // Já vem como "YYYY-MM-DD" — extrai só a parte de data por segurança
    return valor.slice(0, 10);
  }

  if (valor instanceof Date) {
    const ano = valor.getFullYear();
    const mes = String(valor.getMonth() + 1).padStart(2, '0');
    const dia = String(valor.getDate()).padStart(2, '0');
    return `${ano}-${mes}-${dia}`;
  }

  // Fallback: toString e extrair padrão YYYY-MM-DD
  const texto = String(valor);
  const match = texto.match(/^(\d{4}-\d{2}-\d{2})/);
  if (match) {
    return match[1];
  }

  throw new Error(`Valor de data inesperado: ${texto}`);
}

/**
 * Normaliza um valor de hora (pode vir "HH:MM:SS" ou "HH:MM") para "HH:MM".
 */
export function formatarHora(valor: unknown): string {
  const texto = String(valor);
  // Pega apenas HH:MM (primeiros 5 caracteres)
  return texto.slice(0, 5);
}
