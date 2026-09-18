import { initRouter, registerAnchor, registerRoute } from "./router.js";
import { initTheme } from "./theme.js";
import { initModals } from "./ui/modal.js";
import { initNavbar } from "./features/navbar.js";
import { renderLanding } from "./views/landing.js";
import { renderPrivacidade } from "./views/privacidade.js";
import { renderTermos } from "./views/termos.js";
import { renderLogin } from "./views/login.js";
import { renderLoginCliente } from "./views/loginCliente.js";
import { renderPagamentoRetorno } from "./views/pagamentoRetorno.js";
import { renderMinhaConta } from "./views/minhaConta.js";
import { renderManage } from "./views/manage.js";
import { renderFinanceiro } from "./views/financeiro.js";
import { renderProfissional } from "./views/profissional.js";
import { ensureCatalogLoaded } from "./services/catalog.js";

function init(): void {
  initTheme();
  initNavbar();
  initModals();

  registerRoute("/", renderLanding);
  registerRoute("/privacidade", renderPrivacidade);
  registerRoute("/termos", renderTermos);
  registerRoute("/login", renderLogin);
  registerRoute("/login-cliente", renderLoginCliente);
  registerRoute("/pagamento/retorno", renderPagamentoRetorno);
  registerRoute("/minha-conta", renderMinhaConta);
  registerRoute("/minha-conta/servicos", renderMinhaConta);
  registerRoute("/minha-conta/contatos", renderMinhaConta);
  registerRoute("/minha-conta/dependentes", renderMinhaConta);
  registerRoute("/minha-conta/configuracoes", renderMinhaConta);
  // Alias para o caminho "/cliente/dependentes" solicitado na spec da feature.
  registerRoute("/cliente/dependentes", renderMinhaConta);
  registerRoute("/admin", renderManage);
  registerRoute("/admin/agendamentos", renderManage);
  registerRoute("/admin/servicos", renderManage);
  registerRoute("/admin/profissionais", renderManage);
  registerRoute("/admin/financeiro", renderFinanceiro);
  registerRoute("/admin/configuracoes", renderManage);
  registerRoute("/profissional", renderProfissional);
  registerRoute("/profissional/faturamento", renderProfissional);
  registerRoute("/profissional/configuracoes", renderProfissional);
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

  /* Popula o cache de catálogo (serviços e profissionais) no boot.
     É fire-and-forget, mas idempotente: o Dashboard faz `await` nesta mesma
     promessa (ensureCatalogLoaded) antes de renderizar métricas que dependem
     do cache — por isso nunca enxerga o cache vazio no primeiro render. */
  void ensureCatalogLoaded().catch(() => {
    /* Silencioso: falha de rede no boot não deve quebrar a SPA;
       as views tratam os próprios erros ao carregar dados. */
  });
}

if (document.readyState === "loading") {
  document.addEventListener("DOMContentLoaded", init);
} else {
  init();
}
