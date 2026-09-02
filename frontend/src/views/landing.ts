import { $, clearElement, escapeHtml } from "../ui/dom.js";
import { initBookingWizard, type BookingWizardHandle } from "../features/bookingWizard.js";
import { loadServices } from "../services/catalog.js";
import { getSession } from "../services/auth.js";
import { navigateTo } from "../router.js";
import { formatCurrency } from "../ui/format.js";

function renderServicesSection(wizard: BookingWizardHandle): void {
  const grid = $("#services-grid");
  if (!grid) return;
  clearElement(grid);

  const services = loadServices().filter((s) => s.active);
  if (services.length === 0) {
    grid.innerHTML = `<p class="options-empty">Nossos serviços estão sendo atualizados. Entre em contato para agendar.</p>`;
    return;
  }

  for (const service of services) {
    const card = document.createElement("article");
    card.className = "service-card";
    card.innerHTML = `
      <div class="service-card__head">
        <h3 class="service-card__name">${escapeHtml(service.name)}</h3>
        <span class="service-card__duration"><i class='bx bx-time-five'></i>${service.durationMin} min</span>
      </div>
      <p class="service-card__desc">${escapeHtml(service.description)}</p>
      <div class="service-card__footer">
        <div class="service-card__price-block">
          <span class="service-card__price-label">Preço</span>
          <strong class="service-card__price">${formatCurrency(service.price)}</strong>
        </div>
        <button type="button" class="btn btn--primary btn--sm" data-service-id="${escapeHtml(service.id)}">Agendar</button>
      </div>`;
    const btn = card.querySelector<HTMLButtonElement>("button[data-service-id]")!;
    const handler = (): void => {
      const session = getSession();
      if (!session) {
        navigateTo("/login-cliente");
        return;
      }
      void wizard.openNew(service.id);
    };
    btn.addEventListener("click", handler);
    grid.appendChild(card);
  }
}

export function renderLanding(container: HTMLElement): () => void {
  container.innerHTML = `
    <section class="hero" id="inicio">
      <picture>
        <source media="(min-width: 768px)" srcset="assets/images/desktop-hero-image.jpg">
        <img src="assets/images/mobile-hero-image.jpg" alt="" class="hero__bg">
      </picture>
      <div class="hero__overlay" aria-hidden="true"></div>
      <div class="container hero__content">
        <p class="hero__tag"><i class='bx bx-minus'></i>Estilo, Tradição &amp; Excelência</p>
        <h1 class="hero__title">O cuidado que<br>sua presença<br>exige</h1>
        <p class="hero__subtitle">
          Aliamos as técnicas mais refinadas do corte clássico ao conforto de um
          espaço exclusivo. Sinta a experiência premium de se cuidar com especialistas.
        </p>
        <div class="hero__actions">
          <a href="#/login-cliente" class="hero__btn hero__btn--primary">Realizar ou acompanhar agendamento</a>
        </div>
      </div>
    </section>

    <section class="services section" id="servicos">
      <div class="container">
        <span class="section__eyebrow">O que fazemos de melhor</span>
        <h2 class="section__title">Nossos Serviços</h2>
        <div class="services__grid" id="services-grid"></div>
      </div>
    </section>

    <section class="about section" id="sobre">
      <div class="container about__inner">
        <div class="about__content">
          <span class="section__eyebrow">Sobre Nós</span>
          <h2 class="section__title">Mais que uma barbearia, um ritual de presença</h2>
          <p>
            Fundada no coração do Montese, a <strong>Barbearia Maracá</strong> nasceu da
            ideia de que cuidar da aparência é um ato de respeito próprio. Unimos a
            tradição das barbearias clássicas a um espaço moderno, com música boa,
            café e conversa honesta.
          </p>
          <p>
            Nossa equipe reúne barbeiros e especialistas em nails designer formados
            e em constante atualização, para entregar sempre o mesmo padrão de
            excelência — do primeiro corte ao centésimo.
          </p>
          <dl class="about__metrics">
            <div class="about__metric">
              <dt>Clientes atendidos</dt>
              <dd>10k+</dd>
            </div>
            <div class="about__metric">
              <dt>Especialistas</dt>
              <dd>15+</dd>
            </div>
            <div class="about__metric">
              <dt>Nota média</dt>
              <dd>4.9 <i class='bx bx-star' style="color: var(--color-gold)" aria-hidden="true"></i></dd>
            </div>
          </dl>
        </div>
        <div class="about__media">
          <picture>
            <source media="(min-width: 768px)" srcset="assets/images/about-image.jpg">
            <img src="assets/images/about-mobila-image.jpg" alt="Interior e cadeiras da Barbearia Maracá" loading="lazy">
          </picture>
        </div>
      </div>
    </section>

    <section class="contact section" id="contato">
      <div class="container">
        <span class="section__eyebrow">Contato &amp; Horários</span>
        <h2 class="section__title">Visite-nos</h2>
        <div class="contact__inner">
          <div class="contact__info">
            <div class="contact__item">
              <span class="contact__icon" aria-hidden="true"><i class='bx bx-time-five'></i></span>
              <div>
                <h3>Horário de funcionamento</h3>
                <ul class="hours-list">
                  <li><span>Segunda a sexta</span><span>09:00 — 19:00</span></li>
                  <li><span>Sábado</span><span>09:00 — 18:00</span></li>
                  <li><span>Domingo</span><span>Fechado</span></li>
                </ul>
              </div>
            </div>
            <div class="contact__item">
              <span class="contact__icon" aria-hidden="true"><i class='bx bx-map'></i></span>
              <div>
                <h3>Endereço</h3>
                <p>Rua fictícia Maracá, 123 — Montese<br>Belém — PA, 66.010-000</p>
              </div>
            </div>
            <div class="contact__item">
              <span class="contact__icon" aria-hidden="true"><i class='bx bx-envelope'></i></span>
              <div>
                <h3>E-mail</h3>
                <p><a href="mailto:contato@barbeariamaraca.com.br">contato@barbeariamaraca.com.br</a></p>
              </div>
            </div>
            <div class="contact__socials">
              <a href="#" class="social-btn" aria-label="Instagram da Barbearia Maracá"><i class='bx bxl-instagram'></i></a>
              <a href="#" class="social-btn" aria-label="WhatsApp da Barbearia Maracá"><i class='bx bxl-whatsapp'></i></a>
              <a href="#" class="social-btn" aria-label="Telefone da Barbearia Maracá"><i class='bx bx-phone'></i></a>
            </div>
          </div>
          <div class="map-placeholder" role="img" aria-label="Mapa interativo da localização da Barbearia Maracá">
            <span class="map-placeholder__pin"><i class='bx bx-map'></i></span>
            <strong>Mapa Interativo</strong>
            <small>Integração com Google Maps será conectada pelo time de back-end.</small>
          </div>
        </div>
      </div>
    </section>
  `;

  const wizard = initBookingWizard();
  renderServicesSection(wizard);

  const yearEl = $("#footer-year");
  if (yearEl) yearEl.textContent = String(new Date().getFullYear());

  const cleanups: Array<() => void> = [];

  return () => {
    cleanups.forEach((fn) => fn());
  };
}
