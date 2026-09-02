import { addRoute, initRouter, updateNavLinks, setGuard } from './router';
import { renderHome } from './pages/home';
import { renderLogin, mountLogin } from './pages/login';
import { renderServicos, mountServicos } from './pages/servicos';
import { renderDashboard, mountDashboard } from './pages/dashboard';

addRoute('/', 'Inicio', renderHome);
addRoute('/login', 'Login', renderLogin, mountLogin);
addRoute('/servicos', 'Servicos', renderServicos, () => { mountServicos(); });
addRoute('/dashboard', 'Dashboard', renderDashboard, mountDashboard);

setGuard((path) => {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const protectedRoutes = ['/dashboard'];

  if (protectedRoutes.includes(path) && !user) {
    window.location.href = '/login';
    return false;
  }

  if (path === '/login' && user) {
    window.location.href = '/dashboard';
    return false;
  }

  return true;
});

function getNavLinks() {
  const user = JSON.parse(localStorage.getItem('user') || 'null');
  const links = [
    { path: '/', label: 'Inicio' },
    { path: '/servicos', label: 'Servicos' },
  ];

  if (user) {
    links.push({ path: '/dashboard', label: 'Dashboard' });
  } else {
    links.push({ path: '/login', label: 'Entrar' });
  }

  return links;
}

updateNavLinks(getNavLinks());

document.addEventListener('DOMContentLoaded', () => {
  initRouter();
});
