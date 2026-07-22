let graficoHistorico = null;
let historicoBruto = []; // cronológico (mais antigo primeiro) — guardado pra poder re-renderizar em modo "Anual" sem re-buscar

async function inicializarInsights() {
  exigirLogin();

  try {
    const assinatura = await apiGet("/assinaturas/minha-assinatura");
    const isFree = !assinatura.plano || assinatura.plano.tipo === "FREE";
    if (isFree) {
      document.getElementById("banner-limite-free").style.display = "block";
      document.getElementById("card-upsell-premium").style.display = "block";
    }
  } catch (erro) {
    // Falha aqui não pode esconder o resto da tela — só o banner/upsell
    // (que dependem do plano) ficam sem aparecer.
  }

  await Promise.allSettled([
    carregarHistoricoGrafico(),
    carregarRecomendacoesEEconomia(),
    carregarMetas(),
  ]);
}

async function carregarHistoricoGrafico() {
  try {
    const res = await apiGet("/dashboard/energia/historico");
    historicoBruto = (res.historico || []).slice().reverse();

    if (!historicoBruto.length) {
      document.getElementById("vazio-historico").style.display = "block";
      document.getElementById("grafico-historico").style.display = "none";
      document.getElementById("label-projecao").textContent = "--";
      return;
    }

    const ultimoMes = historicoBruto[historicoBruto.length - 1];
    document.getElementById("label-projecao").textContent = formatarKwh(ultimoMes.consumo_total_kwh || 0);
    renderizarGraficoHistorico("mensal");
  } catch (erro) {
    console.error("Erro gráfico histórico", erro);
    document.getElementById("vazio-historico").style.display = "block";
    document.getElementById("grafico-historico").style.display = "none";
  }
}

// Chamado pelos botões "Mensal"/"Anual" — reusa historicoBruto (já buscado),
// sem precisar de outra chamada à API.
function alternarModoHistorico(modo, botao) {
  botao.parentElement.querySelectorAll(".aba").forEach((b) => b.classList.remove("ativa"));
  botao.classList.add("ativa");
  renderizarGraficoHistorico(modo);
}

function renderizarGraficoHistorico(modo) {
  if (!historicoBruto.length) return;

  let labels, valores;
  if (modo === "anual") {
    const totalPorAno = new Map();
    historicoBruto.forEach((h) => {
      totalPorAno.set(h.ano, (totalPorAno.get(h.ano) || 0) + (h.consumo_total_kwh || 0));
    });
    const anos = [...totalPorAno.keys()].sort((a, b) => a - b);
    labels = anos.map(String);
    valores = anos.map((ano) => Math.round(totalPorAno.get(ano) * 100) / 100);
  } else {
    labels = historicoBruto.map((h) => `${NOMES_MES[h.mes - 1]}/${String(h.ano).slice(2)}`);
    valores = historicoBruto.map((h) => h.consumo_total_kwh || 0);
  }

  // Chart.js recusa reusar um canvas com uma instância ainda ativa —
  // precisa destruir antes de recriar ao trocar de aba.
  if (graficoHistorico) {
    graficoHistorico.destroy();
  }

  const ctx = document.getElementById("grafico-historico").getContext("2d");
  graficoHistorico = new Chart(ctx, {
    type: "bar",
    data: {
      labels,
      datasets: [{
        label: "Consumo (kWh)",
        data: valores,
        backgroundColor: labels.map((_, i) => (i === labels.length - 1 ? "#006b2c" : "#e2e7ff")),
        borderRadius: 4,
        barPercentage: 0.4,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => formatarKwh(ctx.raw) } },
      },
      scales: {
        x: { grid: { display: false }, border: { display: false } },
        y: { display: false, grid: { display: false }, border: { display: false } },
      },
    },
  });
}

// Recomendações e Economia Estimada vêm da mesma chamada (/recomendacoes/)
// — busca uma vez só, cada seção falha independente da outra na renderização.
async function carregarRecomendacoesEEconomia() {
  let recomendacoes = [];
  try {
    recomendacoes = await apiGet("/recomendacoes/");
  } catch (erro) {
    console.error("Erro ao carregar recomendações", erro);
    document.getElementById("lista-recomendacoes-insights").innerHTML =
      '<p class="caption texto-secundario text-center">Não foi possível carregar as recomendações.</p>';
    return;
  }

  renderizarRecomendacoesInsights(recomendacoes);
  renderizarEconomiaEstimada(recomendacoes);
}

function renderizarRecomendacoesInsights(recomendacoes) {
  const container = document.getElementById("lista-recomendacoes-insights");

  if (!recomendacoes.length) {
    container.innerHTML =
      '<p class="caption texto-secundario text-center py-md">Nenhuma recomendação ainda. Veja a página Recomendações pra gerar sugestões personalizadas.</p>';
    return;
  }

  container.innerHTML = recomendacoes.slice(0, 2).map((rec) => {
    const isEquipamento = rec.tipo === "troca_equipamento";
    const bgIcon = isEquipamento ? "var(--surface-container-high)" : "var(--primary-fixed, #7ffc97)";
    const colorIcon = isEquipamento ? "var(--on-surface-variant)" : "var(--on-primary-fixed, #002109)";
    const titulo = ROTULOS_RECOMENDACAO[rec.tipo] || rec.tipo;
    const iconSvg = isEquipamento
      ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="10" height="20" x="7" y="2" rx="2"/><path d="M7 8h10"/><path d="M10 14h.01"/><path d="M10 18h.01"/></svg>`
      : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
    const linkText = isEquipamento ? "Calcular ROI" : "Aplicar Rotina";

    return `
      <div class="card" style="padding: 16px; display: flex; gap: 16px; border: 1px solid var(--outline-variant); box-shadow: none;">
        <div style="width: 56px; height: 56px; border-radius: 12px; background: ${bgIcon}; color: ${colorIcon}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
          ${iconSvg}
        </div>
        <div style="flex: 1;">
          <h3 class="label-md" style="font-weight: 700; margin-bottom: 4px;">${titulo}</h3>
          <p class="caption texto-secundario mb-sm" style="line-height: 1.4;">${rec.descricao}</p>
          <a href="recomendacoes" class="link-inline forte">${linkText}</a>
        </div>
      </div>`;
  }).join("");
}

function renderizarEconomiaEstimada(recomendacoes) {
  const total = recomendacoes.reduce((acc, r) => acc + (r.economia_valor_potencial || 0), 0);
  document.getElementById("economia-estimada-valor").textContent = formatarMoeda(total);
}

async function carregarMetas() {
  try {
    const res = await apiGet("/metas/minha-meta");
    const meta = res.meta;

    if (meta && meta.orcamento_reais != null) {
      const gastoRs = meta.projecao_mensal_reais || 0;
      const tetoRs = meta.orcamento_reais;
      const pctRs = Math.min(100, Math.round((gastoRs / tetoRs) * 100));

      document.getElementById("meta-orcamento-valor").textContent = formatarMoeda(tetoRs);
      document.getElementById("meta-orcamento-pct").textContent = `${pctRs}% gasto`;
      document.getElementById("meta-orcamento-fill").style.width = `${pctRs}%`;
      document.getElementById("meta-orcamento-fill").style.background =
        pctRs > 90 ? "var(--error)" : pctRs > 75 ? "var(--tertiary)" : "var(--primary)";

      const relacaoSinal = gastoRs > tetoRs ? ` (+${Math.round((gastoRs / tetoRs - 1) * 100)}%)` : "";
      document.getElementById("meta-orcamento-projecao").textContent =
        `Projeção: você deve chegar a ${formatarMoeda(gastoRs)}${relacaoSinal}`;
    } else {
      document.getElementById("meta-orcamento-valor").textContent = "Sem meta";
      document.getElementById("meta-orcamento-pct").textContent = "";
      document.getElementById("meta-orcamento-fill").style.width = "0%";
      document.getElementById("meta-orcamento-projecao").textContent = "Defina uma meta em R$ pra ver sua projeção.";
    }

    if (meta && meta.teto_kwh != null) {
      const gastoKwh = meta.projecao_mensal_kwh || 0;
      const tetoKwh = meta.teto_kwh;
      const pctKwh = Math.min(100, Math.round((gastoKwh / tetoKwh) * 100));

      document.getElementById("meta-teto-valor").textContent = formatarKwh(tetoKwh);
      document.getElementById("meta-teto-pct").textContent = `${pctKwh}% usado`;
      document.getElementById("meta-teto-fill").style.width = `${pctKwh}%`;
      document.getElementById("meta-teto-fill").style.background =
        pctKwh > 90 ? "var(--error)" : pctKwh > 75 ? "var(--tertiary)" : "var(--secondary)";
    } else {
      document.getElementById("meta-teto-valor").textContent = "Sem meta";
      document.getElementById("meta-teto-pct").textContent = "";
      document.getElementById("meta-teto-fill").style.width = "0%";
    }
  } catch (erro) {
    console.error("Erro metas", erro);
  }
}
