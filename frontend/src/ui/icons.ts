import type { ServiceIcon } from "../types.js";

const BOXICON_MAP: Record<string, string> = {
  scissors: "bx-cut",
  beard: "bx-brush",
  layers: "bx-layer",
  sparkle: "bx-diamond",
  clock: "bx-time-five",
  pin: "bx-map",
  mail: "bx-envelope",
  phone: "bx-phone",
  instagram: "bxl-instagram",
  whatsapp: "bxl-whatsapp",
  shield: "bx-shield-quarter",
  "check-shield": "bx-check-shield",
  grid: "bx-grid-alt",
  users: "bx-group",
  calendar: "bx-calendar",
  sliders: "bx-slider-alt",
  logout: "bx-power-off",
  check: "bx-check-circle",
  x: "bx-x",
  plus: "bx-plus",
  edit: "bx-pencil",
  trash: "bx-trash",
  "chevron-left": "bx-chevron-left",
  "chevron-right": "bx-chevron-right",
  "chevrons-left": "bx-chevrons-left",
  "chevrons-right": "bx-chevrons-right",
  menu: "bx-menu",
  eye: "bx-show",
  "eye-off": "bx-hide",
  star: "bx-star",
  dollar: "bx-dollar-circle",
  trending: "bx-trending-up",
  "alert-circle": "bx-error-circle",
  user: "bx-user",
  search: "bx-search-alt",
  lock: "bx-lock-alt",
  money: "bx-wallet",
  cog: "bx-cog",
  "arrow-left": "bx-left-arrow-alt",
  "arrow-right": "bx-right-arrow-alt",
  "check-circle": "bx-check-circle",
  "error-circle": "bx-error-circle",
  "info-circle": "bx-info-circle",
  "user-plus": "bx-user-plus",
  "upload": "bx-upload",
  "calendar-event": "bx-calendar-event",
  "dollar-circle": "bx-dollar-circle",
  wallet: "bx-wallet",
  "trending-up": "bx-trending-up",
  "trending-down": "bx-trending-down",
};

export function icon(name: string, size = 20): string {
  const cls = BOXICON_MAP[name] ?? "bx-error-circle";
  return `<i class="bx ${cls}" style="font-size:${size}px" aria-hidden="true"></i>`;
}

export function serviceIcon(name: ServiceIcon, size = 22): string {
  return icon(name, size);
}
