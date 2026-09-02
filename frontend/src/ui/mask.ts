export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);
  if (digits.length === 0) return "";
  if (digits.length <= 2) return `(${digits}`;
  if (digits.length <= 6) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2)}`;
  }
  return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
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
