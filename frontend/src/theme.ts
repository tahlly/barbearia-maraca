const STORAGE_KEY = "maraca.theme";

function getSavedTheme(): "light" | "dark" | null {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved === "light" || saved === "dark") return saved;
  return null;
}

function isLightTheme(): boolean {
  return document.body.classList.contains("light-theme");
}

function syncToggleStates(light: boolean): void {
  document.querySelectorAll<HTMLElement>("[data-theme-toggle]").forEach((toggle) => {
    const icon = toggle.querySelector("i");
    if (icon) {
      icon.className = light ? "bx bx-moon" : "bx bx-sun";
    }
    toggle.setAttribute("aria-label", light ? "Alternar para tema escuro" : "Alternar para tema claro");
  });
}

function logoSource(light: boolean): string {
  return light ? "assets/images/logo-maraca-green.png" : "assets/images/logo-maraca.png";
}

function heroSource(light: boolean): { desktop: string; mobile: string } {
  return light
    ? {
        desktop: "assets/images/desktop-hero-image-white.jpg",
        mobile: "assets/images/mobile-hero-image-white.jpg",
      }
    : {
        desktop: "assets/images/desktop-hero-image.jpg",
        mobile: "assets/images/mobile-hero-image.jpg",
      };
}

export function syncHeroImages(root: ParentNode = document): void {
  root.querySelectorAll<HTMLPictureElement>(".hero picture").forEach((picture) => {
    const { desktop, mobile } = heroSource(isLightTheme());
    const source = picture.querySelector<HTMLSourceElement>("source");
    const img = picture.querySelector<HTMLImageElement>("img");
    if (source) source.srcset = desktop;
    if (img) img.src = mobile;
  });
}

export function syncLogoImages(root: ParentNode = document): void {
  root.querySelectorAll<HTMLImageElement>("[data-logo]").forEach((img) => {
    img.src = logoSource(isLightTheme());
  });
}

function applyTheme(light: boolean): void {
  document.body.classList.toggle("light-theme", light);
  syncToggleStates(light);
  syncLogoImages();
  syncHeroImages();
}

function saveTheme(light: boolean): void {
  localStorage.setItem(STORAGE_KEY, light ? "light" : "dark");
}

function bindToggle(toggle: HTMLElement): () => void {
  const handleToggle = (): void => {
    const nextLight = !isLightTheme();
    applyTheme(nextLight);
    saveTheme(nextLight);
  };
  toggle.addEventListener("click", handleToggle);
  return () => toggle.removeEventListener("click", handleToggle);
}

export function initTheme(): () => void {
  const saved = getSavedTheme();
  const light = saved === "light";
  applyTheme(light);

  return bindThemeToggles(document);
}

export function bindThemeToggles(root: ParentNode = document): () => void {
  const toggles = Array.from(root.querySelectorAll<HTMLElement>("[data-theme-toggle]"));
  syncToggleStates(isLightTheme());
  const cleanups = toggles.map(bindToggle);
  return () => cleanups.forEach((fn) => fn());
}
