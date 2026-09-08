/**
 * Converte string de expiração JWT (ex.: "30s", "2h", "7d") ou número em milissegundos.
 * Sem unidade, assume segundos. Fallback: 30 minutos.
 */
export function parseExpiresInToMs(value: string | number | undefined): number {
  if (typeof value === 'number') return value * 1000;

  const raw = String(value ?? '');
  const match = raw.match(/^(\d+)\s*(s|m|h|d)?$/i);
  if (!match) return 30 * 60 * 1000; // fallback: 30 minutos

  const numeric = Number.parseInt(match[1], 10);
  const unit = (match[2] ?? 's').toLowerCase();

  const unitToMs: Record<string, number> = {
    s: 1_000,
    m: 60_000,
    h: 3_600_000,
    d: 86_400_000,
  };

  return numeric * (unitToMs[unit] ?? 1_000);
}
