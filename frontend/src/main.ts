import { initRouter, registerAnchor, registerRoute } from "./router.js";
import { initTheme } from "./theme.js";
import { initModals } from "./ui/modal.js";
import { initNavbar } from "./features/navbar.js";
import { renderLanding } from "./views/landing.js";
import { renderLogin } from "./views/login.js";
import { renderLoginCliente } from "./views/loginCliente.js";
import { renderMinhaConta } from "./views/minhaConta.js";
import { renderManage } from "./views/manage.js";
import { renderPlaceholderPanel } from "./views/placeholderPanel.js";
import { ensureSeed } from "./data/seed.js";

const renderProfissional = renderPlaceholderPanel("profissional");

function init(): void {
  ensureSeed();

  initTheme();
  initNavbar();
  initModals();

  registerRoute("/", renderLanding);
  registerRoute("/login", renderLogin);
  registerRoute("/login-cliente", renderLoginCliente);
  registerRoute("/minha-conta", renderMinhaConta);
  registerRoute("/minha-conta/proximos", renderMinhaConta);
  registerRoute("/minha-conta/historico", renderMinhaConta);
  registerRoute("/minha-conta/perfil", renderMinhaConta);
  registerRoute("/admin", renderManage);
  registerRoute("/admin/agendamentos", renderManage);
  registerRoute("/admin/servicos", renderManage);
  registerRoute("/admin/profissionais", renderManage);
  registerRoute("/admin/configuracoes", renderManage);
  registerRoute("/profissional", renderProfissional);
  registerRoute("/recepcionista", renderManage);
  registerRoute("/recepcionista/agendamentos", renderManage);
  registerRoute("/recepcionista/servicos", renderManage);
  registerRoute("/recepcionista/profissionais", renderManage);
  registerRoute("/recepcionista/configuracoes", renderManage);

  registerAnchor("inicio");
  registerAnchor("servicos");
  registerAnchor("sobre");
  registerAnchor("contato");

  const appContainer = document.getElementById("app");
  if (appContainer) {
    initRouter(appContainer);
  }
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
