import { icon } from "../ui/icons.js";

/**
 * Seção de contatos & horários — componente reutilizável.
 *
 * Fonte única de DADOS e ESTRUTURA usada pela Home (Landing) e pela view de
 * Contatos do Cliente. Alterações aqui refletem automaticamente nas duas
 * telas; apenas a cascata CSS (via wrapper) diferencia os contextos: a Home
 * usa `.contact__inner` + mapa, e o painel do cliente usa `.contact-section
 * --panel` com cards responsivos.
 */
export function contactSectionHtml(): string {
  return `
    <div class="contact__info">
      <div class="contact__item">
        <span class="contact__icon" aria-hidden="true">${icon("clock", 20)}</span>
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
        <span class="contact__icon" aria-hidden="true">${icon("pin", 20)}</span>
        <div>
          <h3>Endereço</h3>
          <p>R. Francisco Real, 763</p>
        </div>
      </div>
      <div class="contact__item">
        <span class="contact__icon" aria-hidden="true">${icon("phone", 20)}</span>
        <div>
          <h3>Telefone</h3>
          <p><a href="tel:+5521999999999">(21) 99999-9999</a></p>
        </div>
      </div>
      <div class="contact__item">
        <span class="contact__icon" aria-hidden="true">${icon("mail", 20)}</span>
        <div>
          <h3>E-mail</h3>
          <p><a href="mailto:contato@barbeariamaraca.com.br">contato@barbeariamaraca.com.br</a></p>
        </div>
      </div>
      <div class="contact__socials">
        <a href="https://wa.me/5521999999999" target="_blank" rel="noopener noreferrer" class="social-btn" aria-label="WhatsApp">${icon("whatsapp", 20)}</a>
        <a href="https://www.instagram.com/" target="_blank" rel="noopener noreferrer" class="social-btn" aria-label="Instagram">${icon("instagram", 20)}</a>
      </div>
    </div>
  `;
}