/** Converte string decimal (ex.: "12.50") para centavos inteiros (BigInt). */
export function paraCentavos(valor: string): bigint {
  const [inteiro, centavos] = valor.split('.');
  const centavosDigitos = centavos?.padEnd(2, '0').slice(0, 2) ?? '00';
  return BigInt(inteiro) * 100n + BigInt(centavosDigitos);
}

/** Converte centavos inteiros para string decimal com 2 casas. */
export function deCentavos(centavos: bigint): string {
  const negativo = centavos < 0n;
  const abs = negativo ? -centavos : centavos;
  const inteiro = (abs / 100n).toString();
  const frac = (abs % 100n).toString().padStart(2, '0');
  return negativo ? `-${inteiro}.${frac}` : `${inteiro}.${frac}`;
}

/** Garante 2 casas decimais (ex.: "57.5" → "57.50"). */
export function normalizarDecimal(valor: string): string {
  return Number(valor).toFixed(2);
}