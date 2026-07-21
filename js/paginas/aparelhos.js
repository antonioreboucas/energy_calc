let residenciasCache = [];
let aparelhosCache = [];
let tarifasPorResidenciaCache = {};
let aparelhosCarregando = false;
let aparelhosErro = false;

const ICONES_CATEGORIA = {
  Eletrodomésticos: '<path d="M5 3h14a1 1 0 0 1 1 1v16a1 1 0 0 1-1 1H5a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z"/><path d="M4 11h16"/><circle cx="8" cy="7" r=".6" fill="currentColor" stroke="none"/><circle cx="8" cy="15" r=".6" fill="currentColor" stroke="none"/>',
  Eletrônicos: '<rect x="2" y="4" width="20" height="13" rx="2"/><path d="M8 21h8"/><path d="M12 17v4"/>',
  Iluminação: '<circle cx="12" cy="9" r="6"/><path d="M9 21h6"/><path d="M10 17h4"/><path d="M12 3V1"/>',
  Climatização: '<path d="M12 2v20"/><path d="M2 12h20"/><path d="M5 5l14 14"/><path d="M19 5L5 19"/>',
  Aquecimento: '<path d="M12 2c1.5 3 4 4.5 4 8a4 4 0 0 1-8 0c0-1 .3-1.8.8-2.6" /><path d="M12 22a4 4 0 0 0 4-4c0-1.5-1-2.5-2-3" />',
  Lavanderia: '<rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="12" cy="13" r="5"/><circle cx="7" cy="6" r=".6" fill="currentColor" stroke="none"/>',
  Outros: '<circle cx="12" cy="12" r="9"/><path d="M9.5 9a2.5 2.5 0 0 1 5 0c0 1.5-2 1.8-2 3.5"/><path d="M12 17h.01"/>',
};

function iconePorCategoria(categoria) {
  return ICONES_CATEGORIA[categoria] || ICONES_CATEGORIA.Outros;
}

function inicializarAparelhos() {
  document.getElementById("form-simular").addEventListener("submit", simular);
  carregarTudo();
}

function mostrarLoadingAba(containerId, texto = "Carregando...") {
  const el = document.getElementById(containerId);
  if (!el) return;
  el.innerHTML = `<div class="aba-carregando"><span class="spinner"></span> ${texto}</div>`;
}

async function carregarTudo() {
  await carregarResidencias();
  await Promise.all([carregarAparelhos(), carregarResumoPlano()]);
}

function mudarAba(nome) {
  document.querySelectorAll(".aba").forEach((el) => el.classList.toggle("ativa", el.dataset.aba === nome));
  document.getElementById("aba-lista").style.display = nome === "lista" ? "block" : "none";
  document.getElementById("aba-simular").style.display = nome === "simular" ? "block" : "none";
  document.getElementById("aba-comparar").style.display = nome === "comparar" ? "block" : "none";
  document.getElementById("aba-recomendacoes").style.display = nome === "recomendacoes" ? "block" : "none";
  if (nome === "comparar") montarCheckboxesComparar();
  if (nome === "recomendacoes") carregarRecomendacoes();
  atualizarIndicadorAbas();
}

function atualizarIndicadorAbas() {
  const abas = document.querySelector('.abas');
  const indicador = abas?.querySelector('.abas-indicator');
  const ativa = abas?.querySelector('.aba.ativa');
  if (!abas || !indicador || !ativa) return;

  const abasRect = abas.getBoundingClientRect();
  const ativaRect = ativa.getBoundingClientRect();
  const left = ativaRect.left - abasRect.left + abas.scrollLeft;

  indicador.style.width = `${ativaRect.width}px`;
  indicador.style.transform = `translateX(${left}px)`;
}

async function carregarResidencias() {
  try {
    residenciasCache = await apiGet("/residencias/");
    const aviso = document.getElementById("aviso-sem-residencia");
    const cardNovo = document.getElementById("card-novo-aparelho");

    if (!residenciasCache.length) {
      aviso.style.display = "block";
      cardNovo.style.display = "none";
      return;
    }
    aviso.style.display = "none";
    cardNovo.style.display = "flex";
  } catch (erro) {
    mostrarToast("Erro ao carregar residências.", "erro");
  }
}

// Descobre o limite de aparelhos do plano atual combinando a assinatura
// (qual plano) com /planos/ (limites de cada plano) — /minha-assinatura não
// devolve os limites, só id/tipo/nome/preço do plano.
async function obterLimiteAparelhos() {
  try {
    const [assinatura, planos] = await Promise.all([apiGet("/assinaturas/minha-assinatura"), apiGet("/planos/")]);
    const planoAtual = planos.find((p) => p.tipo === assinatura.plano?.tipo);
    return planoAtual ? planoAtual.limite_aparelhos : null;
  } catch (erro) {
    return null;
  }
}

async function carregarResumoPlano() {
  const banner = document.getElementById("banner-limite");
  const cardNovo = document.getElementById("card-novo-aparelho");
  const subtitulo = document.getElementById("card-novo-aparelho-subtitulo");

  const limite = await obterLimiteAparelhos();
  const usados = aparelhosCache.length;

  if (limite == null) {
    banner.style.display = "none";
    subtitulo.textContent = "Toque para cadastrar mais um aparelho.";
    return;
  }

  banner.style.display = "flex";
  document.getElementById("banner-limite-uso").textContent = `${usados} de ${limite}`;

  if (usados >= limite) {
    subtitulo.textContent = "Assine para adicionar mais";
    cardNovo.href = "assinatura";
  } else {
    subtitulo.textContent = `Restam ${limite - usados} no seu plano gratuito.`;
    cardNovo.href = "novo_aparelho";
  }
}

async function obterTarifaResidencia(residenciaId) {
  if (residenciaId in tarifasPorResidenciaCache) return tarifasPorResidenciaCache[residenciaId];
  try {
    const tarifas = await apiGet(`/tarifas/residencia/${residenciaId}`);
    tarifasPorResidenciaCache[residenciaId] = tarifas[0]?.valor_kwh ?? null;
  } catch (erro) {
    tarifasPorResidenciaCache[residenciaId] = null;
  }
  return tarifasPorResidenciaCache[residenciaId];
}

async function carregarAparelhos() {
  const el = document.getElementById("lista-aparelhos");
  aparelhosCarregando = true;
  aparelhosErro = false;
  mostrarLoadingAba("lista-aparelhos", "Carregando aparelhos...");
  try {
    aparelhosCache = await apiGet("/aparelhos/");
    if (!aparelhosCache.length) {
      el.innerHTML = '<p class="estado-vazio">Nenhum aparelho cadastrado ainda.</p>';
      return;
    }

    el.innerHTML = aparelhosCache.map((a) => renderizarCardAparelho(a)).join("");

    // Gasto diário depende da tarifa vigente da residência — busca depois
    // de já ter desenhado os cards, pra lista aparecer rápido mesmo se a
    // tarifa demorar (ou não existir ainda).
    for (const a of aparelhosCache) {
      const valorKwh = await obterTarifaResidencia(a.residencia_id);
      const gastoEl = document.getElementById(`gasto-diario-${a.id}`);
      if (!gastoEl) continue;
      if (valorKwh == null) {
        gastoEl.textContent = "sem tarifa";
        continue;
      }
      const consumoDiario = (a.potencia_watts * a.quantidade * a.horas_dia) / 1000;
      gastoEl.textContent = formatarMoeda(consumoDiario * valorKwh);
    }
  } catch (erro) {
    aparelhosErro = true;
    el.innerHTML = '<p class="estado-vazio">Erro ao carregar aparelhos.</p>';
  } finally {
    aparelhosCarregando = false;
    if (document.querySelector('.aba[data-aba="comparar"].ativa')) {
      montarCheckboxesComparar();
    }
  }
}

function renderizarCardAparelho(a) {
  return `
    <div class="card aparelho-card" data-id="${a.id}" onclick="location.href='editar_aparelho?id=${a.id}'">
      <div class="flex justify-between items-center">
        <span class="aparelho-card-icone">
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round">${iconePorCategoria(a.categoria)}</svg>
        </span>
        <button class="btn-icone" onclick="excluirAparelho(event, ${a.id})" aria-label="Excluir">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" /></svg>
        </button>
      </div>
      <p class="aparelho-card-nome">${a.nome}</p>
      <p class="caption">${a.ambiente} • ${a.horas_dia}h/Dia</p>
      <hr class="aparelho-card-linha" />
      <div class="aparelho-card-rodape">
        <div>
          <p class="caption">POTÊNCIA</p>
          <p class="aparelho-card-valor aparelho-card-valor-verde">${a.potencia_watts} W</p>
        </div>
        <div>
          <p class="caption">CONSUMO DIÁRIO</p>
          <p class="aparelho-card-valor">${formatarKwh((a.potencia_watts * a.quantidade * a.horas_dia) / 1000)}</p>
        </div>
        <div>
          <p class="caption">GASTO DIÁRIO</p>
          <p class="aparelho-card-valor aparelho-card-valor-azul" id="gasto-diario-${a.id}">…</p>
        </div>
      </div>
    </div>`;
}

async function excluirAparelho(evento, id) {
  evento.stopPropagation();
  const ok = await confirmarExclusao("Tem certeza que deseja excluir esse aparelho? Essa ação não pode ser desfeita.");
  if (!ok) return;
  try {
    await apiDelete(`/aparelhos/${id}`);
    mostrarToast("Aparelho excluído.");
    carregarTudo();
  } catch (erro) {
    tratarErroApi(erro);
  }
}

async function simular(evento) {
  evento.preventDefault();
  const dados = {
    potencia_watts: Number(document.getElementById("sim-potencia").value),
    quantidade: Number(document.getElementById("sim-quantidade").value),
    horas_dia: Number(document.getElementById("sim-horas").value),
    dias_mes: Number(document.getElementById("sim-dias").value),
    valor_kwh: Number(document.getElementById("sim-tarifa").value),
  };
  await comCarregamento(document.getElementById("btn-simular"), "Calculando...", async () => {
    try {
      const resultado = await apiPost("/aparelhos/simular", dados);
      document.getElementById("sim-consumo-diario").textContent = formatarKwh(resultado.consumo_diario_kwh);
      document.getElementById("sim-consumo-mensal").textContent = formatarKwh(resultado.consumo_mensal_kwh);
      document.getElementById("sim-custo").textContent = formatarMoeda(resultado.custo_estimado);
      document.getElementById("sim-resultado").style.display = "grid";
    } catch (erro) {
      mostrarToast(erro.message, "erro");
    }
  });
}

function montarCheckboxesComparar() {
  const el = document.getElementById("checkboxes-comparar");
  if (aparelhosCarregando) {
    mostrarLoadingAba("checkboxes-comparar", "Carregando aparelhos...");
    return;
  }
  if (aparelhosErro) {
    el.innerHTML = '<p class="estado-vazio">Erro ao carregar aparelhos. Tente novamente mais tarde.</p>';
    return;
  }
  if (!aparelhosCache.length) {
    el.innerHTML = '<p class="estado-vazio caption">Cadastre aparelhos primeiro.</p>';
    return;
  }
  el.innerHTML = aparelhosCache
    .map(
      (a) => `
    <label class="flex items-center gap-sm">
      <input type="checkbox" value="${a.id}" class="check-comparar" />
      ${a.nome} (${a.categoria})
    </label>`
    )
    .join("");
}

async function compararAparelhos() {
  const ids = [...document.querySelectorAll(".check-comparar:checked")].map((el) => Number(el.value));
  if (!ids.length) {
    mostrarToast("Selecione ao menos 1 aparelho.", "erro");
    return;
  }
  if (ids.length > 4) {
    mostrarToast("Selecione no máximo 4 aparelhos.", "erro");
    return;
  }

  const el = document.getElementById("resultado-comparacao");
  el.innerHTML = '<p class="caption">Calculando...</p>';
  try {
    const resultado = await comCarregamento(document.getElementById("btn-comparar"), "Comparando...", () =>
      apiPost("/aparelhos/comparar", { aparelho_ids: ids })
    );
    el.innerHTML = resultado
      .map(
        (r) => `
      <div class="card">
        <p class="label-md mb-lg">${r.nome}</p>
        <div class="grid-cards">
          <div><p class="caption">Consumo mensal</p><p class="body-md">${formatarKwh(r.consumo_mensal_kwh)}</p></div>
          <div><p class="caption">Custo estimado</p><p class="body-md">${formatarMoeda(r.custo_estimado)}</p></div>
        </div>
      </div>`
      )
      .join("");
  } catch (erro) {
    tratarErroApi(erro);
  }
}
