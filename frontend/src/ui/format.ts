const brlFormatter = new Intl.NumberFormat("pt-BR", {
  style: "currency",
  currency: "BRL",
});

export function formatCurrency(value: number): string {
  return brlFormatter.format(value);
}

export function parseIsoDate(iso: string): Date {
  const [year, month, day] = iso.split("-").map(Number);
  return new Date(year ?? 1970, (month ?? 1) - 1, day ?? 1);
}

export function toIsoDate(date: Date): string {
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

const longDate = new Intl.DateTimeFormat("pt-BR", {
  weekday: "long",
  day: "2-digit",
  month: "long",
  year: "numeric",
});

const shortDate = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "2-digit",
  year: "numeric",
});

const mediumDate = new Intl.DateTimeFormat("pt-BR", {
  weekday: "short",
  day: "2-digit",
  month: "short",
});

export function formatDateLong(iso: string): string {
  return longDate.format(parseIsoDate(iso));
}

export function formatDateShort(iso: string): string {
  return shortDate.format(parseIsoDate(iso));
}

export function formatDateMedium(iso: string): string {
  return mediumDate.format(parseIsoDate(iso)).replace(/\./g, "");
}

const dayMonth = new Intl.DateTimeFormat("pt-BR", {
  day: "2-digit",
  month: "short",
});

function isoOffsetFromToday(days: number): string {
  const date = new Date();
  date.setDate(date.getDate() + days);
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${date.getFullYear()}-${month}-${day}`;
}

export function formatDateRelative(iso: string): string {
  if (iso === isoOffsetFromToday(0)) return "Hoje";
  if (iso === isoOffsetFromToday(-1)) return "Ontem";
  if (iso === isoOffsetFromToday(1)) return "Amanhã";
  return dayMonth.format(parseIsoDate(iso)).replace(/\./g, "");
}

export function isSameIsoDate(a: string, b: string): boolean {
  return a === b;
}
