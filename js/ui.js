// Helpers genéricos de UI — toast, modal, tratamento padrão de erro de API.

function mostrarToast(mensagem, tipo = "info") {
  let toast = document.getElementById("toast-global");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast-global";
    document.body.appendChild(toast);
  }
  toast.className = `toast ${tipo === "erro" ? "erro" : ""}`;
  toast.textContent = mensagem;
  toast.style.display = "block";
  clearTimeout(toast._timer);
  toast._timer = setTimeout(() => {
    toast.style.display = "none";
  }, 3500);
}

function mostrarBannerOffline() {
  let banner = document.getElementById("banner-offline-global");
  if (!banner) {
    banner = document.createElement("div");
    banner.id = "banner-offline-global";
    banner.style.cssText = "position:fixed; top:0; left:0; width:100%; background:var(--error); color:var(--on-error); text-align:center; padding:10px; z-index:9999; font-weight:600; font-size:14px; box-shadow:0 4px 6px rgba(0,0,0,0.1);";
    banner.innerHTML = `<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="vertical-align:middle; margin-right:8px; margin-top:-2px;"><path d="m2 2 20 20"/><path d="M8.53 8.53C5.52 9.61 2 12 2 12s2.89 3.52 7.78 5.92"/><path d="M15.47 15.47A9.45 9.45 0 0 0 22 12s-2.89-3.52-7.78-5.92"/></svg> Sem conexão com o servidor. O aplicativo funcionará em modo offline.`;
    document.body.prepend(banner);
  }
  banner.style.display = "block";
}

function esconderBannerOffline() {
  const banner = document.getElementById("banner-offline-global");
  if (banner) banner.style.display = "none";
}

function abrirModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.remove("modal-hidden");
}

function fecharModal(id) {
  const el = document.getElementById(id);
  if (el) el.classList.add("modal-hidden");
}

function mostrarModalUpgrade(mensagem) {
  const texto = document.getElementById("upgrade-mensagem");
  if (texto) texto.textContent = mensagem;
  abrirModal("modal-upgrade");
}

const HTML_MODAL_CONFIRMAR = `
<div class="modal-overlay modal-hidden" id="modal-confirmar">
  <div class="modal modal-confirmar">
    <div class="modal-confirmar-icone">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" /><line x1="10" y1="11" x2="10" y2="17" /><line x1="14" y1="11" x2="14" y2="17" /></svg>
    </div>
    <h2 class="headline-md mb-lg" id="modal-confirmar-titulo">Excluir?</h2>
    <p class="body-md texto-secundario mb-lg" id="modal-confirmar-mensagem"></p>
    <div class="flex gap-sm">
      <button class="btn btn-ghost btn-block" id="modal-confirmar-btn-cancelar">Cancelar</button>
      <button class="btn btn-danger btn-block" id="modal-confirmar-btn-ok">Excluir</button>
    </div>
  </div>
</div>`;

// Modal de confirmação genérico pra ações destrutivas (excluir aparelho,
// residência, meta, cancelar assinatura) — substitui window.confirm(), que
// não combina com o resto da UI, não pode ser estilizado e trava a thread
// principal. Cria o modal sob demanda (uma vez só) e injeta no <body>, então
// nenhuma página precisa declarar esse HTML — só chamar a função.
function confirmarExclusao(mensagem, opcoes = {}) {
  return new Promise((resolve) => {
    if (!document.getElementById("modal-confirmar")) {
      document.body.insertAdjacentHTML("beforeend", HTML_MODAL_CONFIRMAR);
    }

    document.getElementById("modal-confirmar-titulo").textContent = opcoes.titulo || "Excluir?";
    document.getElementById("modal-confirmar-mensagem").textContent = mensagem;
    const btnOk = document.getElementById("modal-confirmar-btn-ok");
    const btnCancelar = document.getElementById("modal-confirmar-btn-cancelar");
    const overlay = document.getElementById("modal-confirmar");
    btnOk.textContent = opcoes.textoConfirmar || "Excluir";

    const finalizar = (resultado) => {
      btnOk.removeEventListener("click", aoConfirmar);
      btnCancelar.removeEventListener("click", aoCancelar);
      overlay.removeEventListener("click", aoClicarFora);
      fecharModal("modal-confirmar");
      resolve(resultado);
    };
    const aoConfirmar = () => finalizar(true);
    const aoCancelar = () => finalizar(false);
    const aoClicarFora = (evento) => {
      if (evento.target === overlay) finalizar(false);
    };

    btnOk.addEventListener("click", aoConfirmar);
    btnCancelar.addEventListener("click", aoCancelar);
    overlay.addEventListener("click", aoClicarFora);

    abrirModal("modal-confirmar");
  });
}

const CHAVE_CONSENTIMENTO_COOKIES = "cookies_ok";

const HTML_MODAL_COOKIES = `
<div class="modal-overlay modal-hidden" id="modal-cookies">
  <div class="modal modal-confirmar">
    <div class="modal-confirmar-icone icone-neutro">
      <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2a10 10 0 1 0 10 10 4 4 0 0 1-5-5 4 4 0 0 1-5-5" /><path d="M8.5 8.5v.01" /><path d="M16 15.5v.01" /><path d="M12 12v.01" /><path d="M11 17v.01" /><path d="M7 14v.01" /></svg>
    </div>
    <h2 class="headline-md mb-sm">Este site usa cookies</h2>
    <p class="body-md texto-secundario mb-lg">Usamos apenas cookies essenciais e de serviços parceiros (como fontes e login). Não usamos cookies de rastreamento ou publicidade. <a href="politica-cookies" class="link-inline" target="_blank" rel="noopener">Ver política de cookies</a>.</p>
    <button type="button" class="btn btn-primary btn-block" id="modal-cookies-btn-ok">Entendi</button>
  </div>
</div>`;

// Aparece uma vez por navegador — grava a escolha em localStorage, não em
// cookie (seria irônico depender de cookie pra lembrar consentimento de
// cookies, e também não teria como aparecer de novo se o usuário limpasse
// justamente os cookies). Roda automaticamente ao carregar este arquivo, em
// vez de esperar uma chamada explícita da página como o resto de ui.js —
// desvio deliberado do padrão: js/ui.js está confirmado presente nas 19
// páginas HTML da raiz do site, então rodar aqui garante cobertura total
// sem precisar editar cada página (e sem risco de esquecer alguma).
function inicializarBannerCookies() {
  if (localStorage.getItem(CHAVE_CONSENTIMENTO_COOKIES)) return;

  if (!document.getElementById("modal-cookies")) {
    document.body.insertAdjacentHTML("beforeend", HTML_MODAL_COOKIES);

    const aceitar = () => {
      localStorage.setItem(CHAVE_CONSENTIMENTO_COOKIES, "1");
      fecharModal("modal-cookies");
    };

    document.getElementById("modal-cookies-btn-ok").addEventListener("click", aceitar);
    document.getElementById("modal-cookies").addEventListener("click", (evento) => {
      if (evento.target.id === "modal-cookies") aceitar();
    });
  }

  abrirModal("modal-cookies");
}

inicializarBannerCookies();

const LARGURA_MAXIMA_MOBILE = 768;

const HTML_BLOQUEIO_DESKTOP = `
<div id="bloqueio-desktop" class="bloqueio-desktop-escondido">
  <div class="bloqueio-desktop-icone">
    <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="14" height="20" x="5" y="2" rx="2" ry="2" /><path d="M12 18h.01" /></svg>
  </div>
  <h1 class="headline-md mb-sm">Acesse pelo celular</h1>
  <p class="body-md texto-secundario" style="max-width: 400px;">O EnergyCalc foi feito sob medida pra uso em smartphones. Abra este mesmo endereço no seu celular pra continuar.</p>
</div>`;

// Bloqueia o site inteiro fora de telas de celular — cobre tela toda,
// sem botão de fechar (não é dispensável, ao contrário dos outros modais
// deste arquivo). Usa min(largura, altura) em vez de só innerWidth: um
// celular em paisagem tem innerWidth maior que o limite, mas continua
// sendo um celular — sem o min(), giraria a tela e seria bloqueado à toa.
// Reavalia a cada resize (não só uma vez no load) pra cobrir quem
// redimensiona a janela ou gira o dispositivo depois da página já aberta.
function verificarDispositivoMovel() {
  if (!document.getElementById("bloqueio-desktop")) {
    document.body.insertAdjacentHTML("beforeend", HTML_BLOQUEIO_DESKTOP);
  }
  const overlay = document.getElementById("bloqueio-desktop");
  const ehMobile = Math.min(window.innerWidth, window.innerHeight) <= LARGURA_MAXIMA_MOBILE;
  overlay.classList.toggle("bloqueio-desktop-escondido", ehMobile);
}

verificarDispositivoMovel();
window.addEventListener("resize", verificarDispositivoMovel);

// Chame em todo catch(erro) de chamada de API — decide sozinho entre modal
// de upgrade (limite_free/upgrade_necessario) e toast de erro genérico.
function tratarErroApi(erro) {
  if (erro && (erro.erro === "limite_free" || erro.erro === "upgrade_necessario")) {
    mostrarModalUpgrade(erro.message);
    return;
  }
  mostrarToast((erro && erro.message) || "Algo deu errado.", "erro");
}

// Desabilita o botão e troca o texto por um spinner enquanto `acao` roda —
// sem isso, o cold-start do Neon serverless (alguns segundos na primeira
// requisição depois de idle) faz um clique parecer que não fez nada.
async function comCarregamento(botao, textoCarregando, acao) {
  if (!botao || botao.disabled) return;
  const htmlOriginal = botao.innerHTML;
  botao.disabled = true;
  botao.innerHTML = `<span class="spinner"></span> ${textoCarregando}`;
  try {
    return await acao();
  } finally {
    botao.disabled = false;
    botao.innerHTML = htmlOriginal;
  }
}

function formatarMoeda(valor) {
  return (valor ?? 0).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

// Acordeão de FAQ — usado por index.html e central-ajuda.html (o `.faq-*`
// markup é o mesmo nas duas, só o conteúdo muda).
function alternarFaq(botao) {
  botao.parentElement.classList.toggle("aberto");
}

// Rótulo (fatura em historico.js, título de card em dashboard.js...) +
// botão de info que revela uma explicação curta em texto simples — inline,
// não popover flutuante: o painel de "Ver detalhes" de historico.js tem
// overflow:hidden (necessário pra animação de abrir/fechar) e cortaria
// qualquer coisa posicionada por fora. Movida pra cá (de historico.js)
// quando dashboard.js passou a precisar do mesmo padrão nos cards do topo
// — mesmo motivo de alternarFaq estar aqui em vez de em landing.js.
function campoComInfoHtml(rotulo, explicacao) {
  return `
    <div class="campo-info-wrapper">
      <p class="caption texto-secundario campo-label-info">
        ${rotulo}
        <button type="button" class="btn-info" onclick="alternarInfoCampo(this)" aria-label="O que é ${rotulo}?" aria-expanded="false">
          <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><line x1="12" y1="16" x2="12" y2="12"/><line x1="12" y1="8" x2="12.01" y2="8"/></svg>
        </button>
      </p>
      <p class="texto-info-campo">${explicacao}</p>
    </div>`;
}

function alternarInfoCampo(botao) {
  const wrapper = botao.closest(".campo-info-wrapper");
  const texto = wrapper && wrapper.querySelector(".texto-info-campo");
  if (!texto) return;

  const visivel = texto.classList.toggle("visivel");
  botao.setAttribute("aria-expanded", visivel ? "true" : "false");
}

function formatarKwh(valor) {
  return `${(valor ?? 0).toLocaleString("pt-BR", { maximumFractionDigits: 2 })} kWh`;
}

// Rótulo amigável por `tipo` de Recomendacao — mesmos 3 valores que o
// backend gera (recomendacao_service.py): economia_personalizada |
// troca_equipamento | ranking_consumo. Movido de recomendacoes.js pra cá
// quando insights.js passou a precisar do mesmo mapeamento (mesmo motivo
// de alternarFaq/campoComInfoHtml estarem aqui).
const ROTULOS_RECOMENDACAO = {
  economia_personalizada: "Economia personalizada",
  troca_equipamento: "Troca de equipamento",
  ranking_consumo: "Maior consumidor",
};

const NOMES_MES = [
  "Jan", "Fev", "Mar", "Abr", "Mai", "Jun",
  "Jul", "Ago", "Set", "Out", "Nov", "Dez",
];
