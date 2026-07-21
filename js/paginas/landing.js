function inicializarLanding() {
  carregarPlanos();
  carregarConteudoLandingPage();
  document.getElementById("form-calc-rapida").addEventListener("submit", calcularRapido);
}

async function carregarConteudoLandingPage() {
  try {
    const secoes = await apiGet("/publico/landing-page/");
    const mapa = Object.fromEntries(secoes.map((s) => [s.secao, s.conteudo]));

    if (mapa.hero) {
      if (mapa.hero.titulo) document.getElementById("hero-titulo").textContent = mapa.hero.titulo;
      if (mapa.hero.subtitulo) document.getElementById("hero-subtitulo").textContent = mapa.hero.subtitulo;
    }
    if (mapa.calculadora_rapida?.titulo) {
      document.getElementById("calc-titulo").textContent = mapa.calculadora_rapida.titulo;
    }
    if (mapa.planos?.titulo) {
      document.getElementById("planos-titulo").textContent = mapa.planos.titulo;
    }
    if (mapa.cta) {
      if (mapa.cta.titulo) document.getElementById("cta-titulo").textContent = mapa.cta.titulo;
      if (mapa.cta.botao) document.getElementById("cta-botao").textContent = mapa.cta.botao;
    }

    preencherLista("lista-beneficios", mapa.beneficios?.itens, (item) => `<div class="card feature-card"><h3 class="feature-titulo">${item.titulo || ""}</h3><p class="body-md texto-secundario">${item.texto || item}</p></div>`);
    preencherLista("lista-como-funciona", mapa.como_funciona?.passos, (item, i) => `<div class="passo"><div class="passo-numero-col"><div class="passo-numero">${i + 1}</div><div class="passo-linha"></div></div><div class="passo-texto"><h3 class="feature-titulo">${item.titulo || ""}</h3><p class="body-md texto-secundario">${item.texto || item}</p></div></div>`);
    preencherLista("lista-faq", mapa.faq?.perguntas, (item) => `<div class="faq-item"><button class="faq-pergunta" onclick="alternarFaq(this)">${item.pergunta}<span class="faq-seta">⌄</span></button><div class="faq-resposta"><p class="body-md texto-secundario">${item.resposta}</p></div></div>`);
    preencherLista("lista-depoimentos", mapa.depoimentos?.itens, (item, i) => `<div class="card depoimento-card"><p class="body-md">"${item.texto}"</p><div class="depoimento-autor"><span class="avatar-depoimento cor-${(i % 3) + 1}">${iniciaisDoNome(item.nome)}</span><div><p class="label-md">${item.nome || ""}</p><p class="caption">${item.papel || ""}</p></div></div></div>`);
  } catch (erro) {
    // Sem conteúdo cadastrado ainda (create_landing_content não rodou), ou
    // as seções existem mas estão vazias — a página segue com os textos
    // padrão já presentes no HTML (ver preencherLista abaixo).
  }
}

// Só substitui o conteúdo estático já presente no HTML quando o CMS
// (/admin/landing-page) realmente tem itens cadastrados pra essa seção —
// caso contrário mantém o fallback que já está na página em vez de
// esvaziar a seção.
function preencherLista(id, itens, renderizar) {
  if (!itens || !itens.length) return;
  const el = document.getElementById(id);
  if (!el) return;
  el.innerHTML = itens.map(renderizar).join("");
}

async function carregarPlanos() {
  const el = document.getElementById("lista-planos");
  try {
    const planos = await apiGet("/planos/");
    el.innerHTML = planos
      .map((p) => {
        const isPremium = p.tipo === "PREMIUM";
        const itens = [
          p.limite_aparelhos ? `Até ${p.limite_aparelhos} aparelhos` : "Aparelhos ilimitados",
          p.limite_residencias ? `${p.limite_residencias} residência${p.limite_residencias > 1 ? "s" : ""}` : "Residências ilimitadas",
          p.dias_historico ? `Histórico de ${p.dias_historico} dias` : "Histórico completo",
          p.exportacao_habilitada ? "Exportação de relatórios" : "Simulador web",
        ];
        if (p.dashboards_avancados) itens.push("Recomendações com IA");
        return `
      <div class="card plano-card ${isPremium ? "plano-card-premium" : ""}">
        ${isPremium ? '<span class="plano-badge-popular">POPULAR</span>' : ""}
        <p class="plano-nome">${p.nome}</p>
        <p class="plano-preco">${p.preco_mensal > 0 ? formatarMoeda(p.preco_mensal) : "R$ 0"}<span class="plano-periodo">/mês</span></p>
        <ul class="plano-lista">
          ${itens.map((texto) => `<li>✓ ${texto}</li>`).join("")}
        </ul>
        <a href="cadastro" class="btn btn-block ${isPremium ? "btn-branco" : "btn-outline-primary"}">${isPremium ? "Ser Premium" : "Selecionar plano"}</a>
      </div>`;
      })
      .join("");
  } catch (erro) {
    el.innerHTML = '<p class="estado-vazio caption">Não foi possível carregar os planos.</p>';
  }
}

// alternarFaq() mora em ui.js agora — reaproveitada por central-ajuda.html
// também, não é mais exclusiva desta página.

async function calcularRapido(evento) {
  evento.preventDefault();
  const dados = {
    potencia_watts: Number(document.getElementById("calc-potencia").value),
    quantidade: Number(document.getElementById("calc-quantidade").value),
    horas_dia: Number(document.getElementById("calc-horas").value),
    dias_mes: Number(document.getElementById("calc-dias").value),
    valor_kwh: Number(document.getElementById("calc-tarifa").value),
  };
  await comCarregamento(document.getElementById("btn-calc-rapida"), "Calculando...", async () => {
    try {
      const resultado = await apiPost("/publico/calculadora-rapida", dados);
      document.getElementById("calc-consumo-diario").textContent = formatarKwh(resultado.consumo_diario_kwh);
      document.getElementById("calc-consumo-mensal").textContent = formatarKwh(resultado.consumo_mensal_kwh);
      document.getElementById("calc-custo").textContent = formatarMoeda(resultado.custo_estimado);
      document.getElementById("calc-resultado").style.display = "block";
    } catch (erro) {
      mostrarToast(erro.message, "erro");
    }
  });
}
