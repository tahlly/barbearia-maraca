/**
 * DDs brasileiros válidos: 11–99, exceto 20–29.
 * Aceita qualquer 2 dígitos na entrada, mas marca visualmente
 * como inválido quando o DDD não está na faixa aceita.
 */
function isValidDDD(ddd: string): boolean {
  const num = Number(ddd);
  if (num >= 11 && num <= 99 && !(num >= 20 && num <= 29)) return true;
  return false;
}

export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
}

/**
 * Retorna `true` se o telefone formatado possui DDD válido.
 * Útil para exibir feedback visual leve sem bloquear a digitação.
 */
export function isPhoneDddValid(value: string): boolean {
  const match = value.match(/^\((\d{2})\)/);
  return match ? isValidDDD(match[1]) : false;
}

export function attachPhoneMask(input: HTMLInputElement): void {
  input.addEventListener("input", () => {
    input.value = maskPhone(input.value);
  });
}

export function maskBookingCode(value: string): string {
  return value
    .toUpperCase()
    .replace(/[^A-Z0-9-]/g, "")
    .slice(0, 8);
}

export function attachCodeMask(input: HTMLInputElement): void {
  input.addEventListener("input", () => {
    input.value = maskBookingCode(input.value);
  });
}

export function attachUppercaseMask(input: HTMLInputElement): void {
  input.addEventListener("input", () => {
    const upper = input.value.toUpperCase();
    if (upper === input.value) return;
    const { selectionStart, selectionEnd } = input;
    input.value = upper;
    if (selectionStart !== null && selectionEnd !== null) {
      input.setSelectionRange(selectionStart, selectionEnd);
    }
  });
}
