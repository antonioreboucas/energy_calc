function inicializarPerfil() {
  preencherPerfilPagina();
  carregarResumoAssinatura();
  configurarPreferencias();
}

function preencherPerfilPagina() {
  const usuario = getUsuarioAtual();
  if (!usuario) return;
  document.getElementById("avatar-grande-iniciais").textContent = iniciaisDoNome(usuario.nome);
  document.getElementById("perfil-nome-grande").textContent = usuario.nome || "—";
  document.getElementById("perfil-email-grande").textContent = usuario.email || "—";
}

async function carregarResumoAssinatura() {
  const badge = document.getElementById("perfil-badge-plano");
  const renovacao = document.getElementById("perfil-renovacao");
  try {
    const assinatura = await apiGet("/assinaturas/minha-assinatura");
    const isPremium = assinatura.plano.tipo === "PREMIUM";
    badge.textContent = `PLANO ${isPremium ? "PREMIUM" : "FREE"}`;
    badge.className = `badge ${isPremium ? "premium" : "free"}`;
    renovacao.textContent = assinatura.vencimento
      ? `Próxima renovação: ${new Date(assinatura.vencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" })}`
      : isPremium
        ? "Renovação automática ativa"
        : "Sem cobrança — plano gratuito";
  } catch (erro) {
    badge.textContent = "—";
  }
}

// Notificações/Modo escuro são preferências só locais (localStorage) — não
// existe endpoint de preferências de usuário no backend ainda. Modo escuro
// grava a intenção (data-theme) mas não tem paleta escura definida no
// DESIGN-APP.MD, então só a estrutura fica pronta pra quando existir.
function configurarPreferencias() {
  const toggleNotificacoes = document.getElementById("toggle-notificacoes");
  const toggleModoEscuro = document.getElementById("toggle-modo-escuro");

  toggleNotificacoes.checked = localStorage.getItem("pref-notificacoes") !== "off";
  toggleModoEscuro.checked = localStorage.getItem("pref-modo-escuro") === "on";
  document.documentElement.dataset.theme = toggleModoEscuro.checked ? "dark" : "light";

  toggleNotificacoes.addEventListener("change", () => {
    localStorage.setItem("pref-notificacoes", toggleNotificacoes.checked ? "on" : "off");
  });

  toggleModoEscuro.addEventListener("change", () => {
    localStorage.setItem("pref-modo-escuro", toggleModoEscuro.checked ? "on" : "off");
    document.documentElement.dataset.theme = toggleModoEscuro.checked ? "dark" : "light";
    mostrarToast("Preferência salva — tema escuro visual chega em uma próxima atualização.");
  });
}
