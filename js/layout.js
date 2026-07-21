// Injeta os partials de navegação via fetch()+innerHTML — sem framework,
// sem lógica no lado do PHP (decisão explícita do projeto).

async function carregarParcial(url, elementoId) {
  const el = document.getElementById(elementoId);
  if (!el) return;
  try {
    const resposta = await fetch(url);
    if (!resposta.ok) throw new Error(`${url} respondeu ${resposta.status}`);
    el.innerHTML = await resposta.text();
  } catch (e) {
    // Não deixa a nav sumir em silêncio — loga pra dar pra debugar no devtools
    // (offline sem cache do partial ainda, ou o arquivo não foi encontrado).
    console.error("Falha ao carregar partial de navegação:", url, e);
  }
}

async function carregarLayoutAutenticado(paginaAtiva) {
  exigirLogin();
  await Promise.all([
    carregarParcial("partials/app-bar.html", "app-bar"),
    carregarParcial("partials/bottom-nav.html", "bottom-nav"),
    carregarParcial("partials/modal-upgrade.html", "modal-upgrade-slot"),
  ]);
  destacarAbaAtiva(paginaAtiva);
  atualizarBadgeNotificacoes();
  preencherPerfil();
  document.addEventListener("click", fecharDropdownsFora);
  mostrarBotaoVoltar();
}

async function carregarLayoutPublico() {
  await carregarParcial("partials/nav-publico.html", "nav-publico");
}

function destacarAbaAtiva(pagina) {
  document.querySelectorAll(".bottom-nav-item").forEach((el) => {
    el.classList.toggle("ativo", el.dataset.pagina === pagina);
  });
}

function fecharDropdownsFora(evento) {
  [
    { painel: "painel-notificacoes", botao: "btn-notificacoes" },
    { painel: "menu-perfil", botao: "btn-perfil" },
  ].forEach(({ painel: idPainel, botao: idBotao }) => {
    const painel = document.getElementById(idPainel);
    const botao = document.getElementById(idBotao);
    if (!painel || painel.classList.contains("modal-hidden")) return;
    if (!painel.contains(evento.target) && !botao.contains(evento.target)) {
      painel.classList.add("modal-hidden");
    }
  });
}

function iniciaisDoNome(nome) {
  if (!nome) return "?";
  const partes = nome.trim().split(/\s+/);
  if (partes.length === 1) return partes[0][0].toUpperCase();
  return (partes[0][0] + partes[partes.length - 1][0]).toUpperCase();
}

function preencherPerfil() {
  const usuario = getUsuarioAtual();
  if (!usuario) return;
  const avatar = document.getElementById("avatar-iniciais");
  const nome = document.getElementById("perfil-nome");
  const email = document.getElementById("perfil-email");
  if (avatar) avatar.textContent = iniciaisDoNome(usuario.nome);
  if (nome) nome.textContent = usuario.nome || "—";
  if (email) email.textContent = usuario.email || "—";
}

function alternarMenuPerfil() {
  const menu = document.getElementById("menu-perfil");
  if (!menu) return;
  document.getElementById("painel-notificacoes")?.classList.add("modal-hidden");
  menu.classList.toggle("modal-hidden");
}

function mostrarBotaoVoltar() {
  const botao = document.getElementById("btn-voltar");
  if (!botao) return;

  const bottomNavPages = ["dashboard", "aparelhos", "historico", "metas", "insights"];
  const path = window.location.pathname.replace(/\/+$/, "");
  const slug = path.split("/").filter(Boolean).pop() || "dashboard";

  if (!bottomNavPages.includes(slug)) {
    botao.style.display = "inline-flex";
    botao.onclick = voltarPagina;
  } else {
    botao.style.display = "none";
  }
}

function voltarPagina() {
  if (window.history.length > 1) {
    window.history.back();
    return;
  }
  window.location.href = "dashboard";
}

async function alternarPainelNotificacoes() {
  const painel = document.getElementById("painel-notificacoes");
  if (!painel) return;

  document.getElementById("menu-perfil")?.classList.add("modal-hidden");

  if (!painel.classList.contains("modal-hidden")) {
    painel.classList.add("modal-hidden");
    return;
  }

  painel.classList.remove("modal-hidden");
  painel.innerHTML = '<p class="caption">Carregando...</p>';

  try {
    const notificacoes = await apiGet("/notificacoes/");
    if (!notificacoes.length) {
      painel.innerHTML = '<p class="estado-vazio caption">Nenhuma notificação.</p>';
      return;
    }
    painel.innerHTML = notificacoes
      .map(
        (n) => `
      <div class="notificacao-item ${n.lida ? "" : "nao-lida"}" data-id="${n.id}">
        <p class="label-md">${n.mensagem}</p>
        <p class="caption">${new Date(n.created_at).toLocaleString("pt-BR")}</p>
      </div>`
      )
      .join("");

    painel.querySelectorAll(".notificacao-item").forEach((el) => {
      el.addEventListener("click", async () => {
        await apiPost(`/notificacoes/${el.dataset.id}/marcar-lida`).catch(() => {});
        el.classList.remove("nao-lida");
        atualizarBadgeNotificacoes();
      });
    });
  } catch (erro) {
    painel.innerHTML = '<p class="estado-vazio caption">Erro ao carregar notificações.</p>';
  }
}

async function atualizarBadgeNotificacoes() {
  const badge = document.getElementById("badge-notificacao");
  if (!badge) return;
  try {
    const naoLidas = await apiGet("/notificacoes/?apenas_nao_lidas=true");
    badge.style.display = naoLidas.length ? "block" : "none";
  } catch (e) {
    // badge não é crítico — falha silenciosa
  }
}

function registrarServiceWorker() {
  if ("serviceWorker" in navigator) {
    navigator.serviceWorker.register("service-worker.js").catch(() => {});
  }
}

registrarServiceWorker();
