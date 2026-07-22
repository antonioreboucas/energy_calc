// Cores validadas contra a superfície do app (ver skill dataviz — ambas
// passam lightness/chroma/contraste/CVD): verde = energia/kWh, azul = custo/R$.
const COR_VERDE = "#006b2c";
const COR_AZUL = "#0051d5";
const COR_GRADE = "#e2e7ff"; // surface-container-high — grade recessiva

const OPCOES_BASE = {
  responsive: true,
  maintainAspectRatio: false,
  plugins: { legend: { display: false } },
  scales: {
    x: { grid: { display: false }, ticks: { color: "#3e4a3d" } },
    y: {
      beginAtZero: true,
      grid: { color: COR_GRADE, drawTicks: false },
      ticks: { color: "#3e4a3d" },
    },
  },
};

// Plugin customizado para texto no centro do Doughnut chart
const centerTextPlugin = {
  id: 'centerText',
  beforeDraw: function(chart) {
    if (chart.config.type !== 'doughnut') return;
    var width = chart.width,
        height = chart.height,
        ctx = chart.ctx;
    ctx.restore();
    var fontSize = (height / 100).toFixed(2);
    ctx.font = "bold " + fontSize + "em Inter, sans-serif";
    ctx.textBaseline = "middle";
    ctx.fillStyle = "#131b2e"; // var(--on-surface)

    var text = "100%",
        textX = Math.round((width - ctx.measureText(text).width) / 2),
        textY = height / 2 - 10;
    ctx.fillText(text, textX, textY);
    
    ctx.font = (fontSize * 0.4).toFixed(2) + "em Inter, sans-serif";
    ctx.fillStyle = "#3e4a3d"; // var(--on-surface-variant)
    var text2 = "Distribuição Total",
        textX2 = Math.round((width - ctx.measureText(text2).width) / 2),
        textY2 = height / 2 + 15;
    ctx.fillText(text2, textX2, textY2);
    ctx.save();
  }
};

Chart.register(centerTextPlugin);

async function inicializarDashboard() {
  try {
    const [dados, metaResp, residencias] = await Promise.all([
      apiGet("/dashboard/"),
      // Meta é informação complementar (barra "Meta Mensal") — uma falha
      // aqui não pode derrubar o resto do dashboard.
      apiGet("/metas/minha-meta").catch(() => ({ meta: null })),
      // Idem — usada só pra decidir se mostra o convite de boas-vindas.
      apiGet("/residencias/").catch(() => null),
    ]);
    preencherCards(dados.cards);
    preencherTendencia(dados.evolucao_mensal);
    preencherMetaMensal(metaResp.meta);
    preencherInsightCobertura(dados.cards);
    renderizarGraficoCategoria(dados.consumo_por_categoria);
    renderizarGraficoEvolucao(dados.evolucao_mensal);
    renderizarGraficoGastos(dados.gastos_mensais);
    renderizarGraficoRanking(dados.ranking_aparelhos);
    verificarOnboarding(residencias);
  } catch (erro) {
    mostrarToast(erro.message, "erro");
  }
}

function preencherCards(cards) {
  // Consumo Mensal — a distinção real/estimado (mesma origem dos badges de
  // fatura no histórico) fica só na explicação do botão (i) do título; ver
  // agregados_reais_e_simulados no backend.
  const consumoKwh = cards.consumo_mensal_kwh || 0;
  document.getElementById("card-consumo-mensal").innerHTML = `${consumoKwh} <span class="unidade">kWh</span>`;

  // Valor Estimado
  document.getElementById("card-valor-estimado").textContent = formatarMoeda(cards.valor_estimado || 0);

  // Vencimento só existe quando o mês corrente tem uma Fatura real enviada
  // (RegistroConsumo calculado não tem data de vencimento).
  const linhaVencimento = document.getElementById("linha-vencimento");
  if (cards.vencimento) {
    document.getElementById("card-vencimento").textContent = cards.vencimento;
    linhaVencimento.style.display = "";
  } else {
    linhaVencimento.style.display = "none";
  }

  // Potencial de Economia
  document.getElementById("card-economia").textContent = formatarMoeda(cards.economia_possivel || 0);

  // Aparelhos
  document.getElementById("card-aparelhos").textContent = cards.quantidade_aparelhos || 0;
}

function preencherTendencia(evolucaoMensal) {
  const linha = document.getElementById("card-consumo-tendencia");
  const icone = document.getElementById("icone-tendencia");
  const txt = document.getElementById("txt-tendencia");

  // evolucao_mensal vem em ordem cronológica crescente (mais antigo primeiro)
  // — precisamos dos 2 últimos meses pra comparar. Sem histórico suficiente,
  // não dá pra calcular tendência nenhuma (nada de "--%" fixo pra sempre).
  if (!evolucaoMensal || evolucaoMensal.length < 2) {
    linha.style.display = "none";
    return;
  }

  const atual = evolucaoMensal[evolucaoMensal.length - 1].consumo_kwh;
  const anterior = evolucaoMensal[evolucaoMensal.length - 2].consumo_kwh;
  if (!anterior) {
    linha.style.display = "none";
    return;
  }

  const variacao = ((atual - anterior) / anterior) * 100;
  const subiu = variacao > 0;

  linha.style.display = "";
  txt.textContent = `${subiu ? "+" : ""}${variacao.toFixed(1)}%`;

  // Consumo subindo é "ruim" (vermelho, seta pra cima); descendo é "bom"
  // (verde, seta pra baixo) — inverso do que normalmente se espera de uma
  // métrica financeira "pra cima é bom".
  icone.innerHTML = subiu
    ? '<polyline points="22 7 13.5 15.5 8.5 10.5 2 17"/><polyline points="16 7 22 7 22 13"/>'
    : '<polyline points="22 17 13.5 8.5 8.5 13.5 2 7"/><polyline points="16 17 22 17 22 11"/>';
  const cor = subiu ? "var(--error)" : "var(--primary)";
  icone.style.color = cor;
  txt.style.color = cor;
}

function preencherMetaMensal(meta) {
  const fill = document.getElementById("barra-meta-fill");
  const usado = document.getElementById("meta-usado");
  const total = document.getElementById("meta-total");

  if (!meta || meta.teto_kwh == null) {
    fill.style.width = "0%";
    usado.textContent = "Sem meta";
    total.textContent = "cadastrada";
    return;
  }

  const projetado = meta.projecao_mensal_kwh || 0;
  const percentual = Math.min(100, Math.round((projetado / meta.teto_kwh) * 100));
  fill.style.width = `${percentual}%`;
  fill.style.background = percentual >= 100 ? "var(--error)" : "var(--primary)";
  usado.textContent = `${percentual}%`;
  total.textContent = formatarKwh(meta.teto_kwh);
}

function preencherInsightCobertura(cards) {
  const bloco = document.getElementById("insight-cobertura");
  const txt = document.getElementById("txt-insight-cobertura");
  const cobertura = cards.cobertura_aparelhos_percentual;

  // Só existe quando há Fatura real E aparelhos cadastrados com consumo
  // calculado pro mesmo mês pra comparar (ver cards() no backend) — sem
  // isso não há nada de concreto a dizer, o card fica oculto.
  if (cobertura == null) {
    bloco.style.display = "none";
    return;
  }

  bloco.style.display = "";
  if (cobertura >= 85 && cobertura <= 115) {
    txt.textContent = `Seus aparelhos cadastrados batem com sua fatura real (${cobertura}% do consumo) — boa precisão nas estimativas.`;
  } else if (cobertura < 85) {
    txt.textContent = `Seus aparelhos cadastrados explicam só ${cobertura}% do consumo da sua fatura real — pode haver equipamentos não cadastrados ou consumo em standby.`;
  } else {
    txt.textContent = `Seus aparelhos cadastrados projetam ${cobertura}% do consumo real — mais do que a fatura mostrou. Pode ser que você os use menos horas do que o configurado.`;
  }
}

// Convite de boas-vindas pra quem ainda não tem residência cadastrada —
// sem uma, praticamente nada no app funciona (aparelho, tarifa e meta
// dependem de residencia_id), então esse é o único bloqueio real de
// onboarding que existe hoje. `residencias` vem null se a chamada falhou
// (ver Promise.all em inicializarDashboard) — nesse caso não mostra nada,
// pra não arriscar interromper quem na verdade já tem residência cadastrada
// só por causa de uma falha de rede passageira.
function verificarOnboarding(residencias) {
  if (!Array.isArray(residencias) || residencias.length > 0) return;

  const modal = document.getElementById("modal-boas-vindas");
  document.getElementById("btn-boas-vindas-depois").addEventListener("click", () => {
    fecharModal("modal-boas-vindas");
  });
  modal.addEventListener("click", (evento) => {
    if (evento.target === modal) fecharModal("modal-boas-vindas");
  });

  abrirModal("modal-boas-vindas");
}

function renderizarGraficoCategoria(itens) {
  if (!itens || !itens.length) {
    document.getElementById("vazio-categoria").style.display = "block";
    return;
  }
  
  // Cores personalizadas para o gráfico de donut
  const cores = [COR_VERDE, COR_AZUL, "#a36700", "#d2d9f4"]; // Verde, Azul, Ouro, Cinza claro
  
  new Chart(document.getElementById("grafico-categoria"), {
    type: "doughnut",
    data: {
      labels: itens.map((i) => i.categoria),
      datasets: [
        {
          data: itens.map((i) => i.consumo_kwh),
          backgroundColor: cores,
          borderWidth: 0,
          cutout: '75%',
        },
      ],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      layout: { padding: 10 }
    },
  });

  // Renderizar legenda HTML
  const legendaContainer = document.getElementById("legenda-categoria-container");
  const totalKwh = itens.reduce((acc, curr) => acc + curr.consumo_kwh, 0);
  
  legendaContainer.innerHTML = itens.map((item, index) => {
    const cor = cores[index % cores.length];
    const perc = Math.round((item.consumo_kwh / totalKwh) * 100);
    return `
      <div class="legenda-item">
        <span class="bolinha" style="background-color: ${cor};"></span>
        <span>${item.categoria} (${perc}%)</span>
      </div>
    `;
  }).join("");
}

function renderizarGraficoEvolucao(itens) {
  if (!itens || !itens.length) {
    document.getElementById("vazio-evolucao").style.display = "block";
    return;
  }
  
  // Média móvel dos últimos 3 meses (incluindo o mês do próprio ponto) —
  // não existe nenhuma fonte de "média regional"/benchmark externo nesse
  // projeto (mesmo motivo já documentado no insight de cobertura do
  // dashboard), então a comparação honesta é contra o histórico do próprio
  // usuário. Pros primeiros pontos da janela, sem 3 meses anteriores
  // completos ainda, usa a média do que existir até ali em vez de deixar
  // undefined. Antes disso era `consumo_kwh * (0.8 + Math.random() * 0.4)`
  // — um valor recalculado (e diferente) a cada render, por isso a linha
  // "mudava sozinha" a cada refresh da página.
  const dadosMedia = itens.map((_, indice) => {
    const janela = itens.slice(Math.max(0, indice - 2), indice + 1);
    const soma = janela.reduce((total, item) => total + item.consumo_kwh, 0);
    return soma / janela.length;
  });
  
  new Chart(document.getElementById("grafico-evolucao"), {
    type: "line",
    data: {
      labels: itens.map((i) => `${NOMES_MES[i.mes - 1]}`),
      datasets: [
        {
          label: "Consumo",
          data: itens.map((i) => i.consumo_kwh),
          borderColor: COR_VERDE,
          borderWidth: 2,
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
          tension: 0.4, // Curva suave
        },
        {
          label: "Média",
          data: dadosMedia,
          borderColor: COR_AZUL,
          borderWidth: 2,
          borderDash: [5, 5],
          pointRadius: 0,
          pointHoverRadius: 4,
          fill: false,
          tension: 0.4,
        }
      ],
    },
    options: OPCOES_BASE,
  });
}

function renderizarGraficoGastos(itens) {
  if (!itens || !itens.length) {
    document.getElementById("vazio-gastos").style.display = "block";
    return;
  }

  // Cor por origem (mesmo dado que os badges "Fatura real"/"Estimado" já
  // usam em outras partes do dashboard/histórico — ver
  // agregados_reais_e_simulados no backend): fatura real em azul cheio,
  // valor calculado a partir dos aparelhos num azul claro.
  //
  // Um item "simulada" é rotulado com o mês SEGUINTE ao seu `mes` real —
  // a fatura que confirma (ou substitui) esse valor só chega no mês que
  // vem (referência de Julho só é faturada em Agosto — ver `referencia`
  // extraído no upload, enviar_fatura.js), então a estimativa calculada
  // agora é, na prática, uma prévia da fatura do próximo mês, não um
  // número fechado pro mês corrente. Só afeta o rótulo deste gráfico —
  // não mexe em `agregados_reais_e_simulados` nem em `itens` (chave real
  // usada por cards, histórico e projeção de Meta continua íntegra).
  const rotuloMes = (item) => {
    const mes = item.origem === "simulada" ? (item.mes % 12) + 1 : item.mes;
    return NOMES_MES[mes - 1];
  };

  new Chart(document.getElementById("grafico-gastos"), {
    type: "bar",
    data: {
      labels: itens.map(rotuloMes),
      datasets: [
        {
          data: itens.map((i) => i.custo),
          backgroundColor: itens.map((i) => i.origem === "real" ? COR_AZUL : "#dae2fd"),
          borderRadius: 4,
          maxBarThickness: 40,
        },
      ],
    },
    options: {
      ...OPCOES_BASE,
      plugins: {
        ...OPCOES_BASE.plugins,
        tooltip: {
          callbacks: {
            label: (contexto) => {
              const item = itens[contexto.dataIndex];
              const origemTexto = item.origem === "real" ? "Fatura real" : "Estimado";
              return `${formatarMoeda(item.custo)} — ${origemTexto}`;
            },
          },
        },
      },
      scales: {
        x: { grid: { display: false }, ticks: { color: "#3e4a3d", font: { weight: (ctx) => ctx.index === itens.length - 1 ? 'bold' : 'normal' } } },
        y: { display: false, beginAtZero: true } // Esconder eixo Y como no mockup
      }
    },
  });
}

function renderizarGraficoRanking(itens) {
  const container = document.getElementById("lista-ranking");
  
  if (!itens || !itens.length) {
    document.getElementById("vazio-ranking").style.display = "block";
    container.style.display = "none";
    return;
  }
  
  container.innerHTML = itens.map((item, index) => {
    // Definindo ícones e classes baseados no impacto (simulado via index)
    let iconeSvg, classeIcone, textoImpacto;
    
    if (index === 0) { // Alto impacto
      classeIcone = "ranking-icone-alto";
      textoImpacto = "Alto Impacto";
      iconeSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`; // Floco de neve (simulado com algo parecido ou usarei um icone generico pra ar)
      iconeSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12 2 3.09 3.09L22 7.18l-1.18 5.91L22 19l-6.91 2.09L12 22l-3.09-3.09L2 16.82l1.18-5.91L2 5l6.91-2.09L12 2z"/><path d="m12 22v-6"/><path d="m12 8V2"/><path d="m4.93 4.93 4.24 4.24"/><path d="m14.83 14.83 4.24 4.24"/><path d="m2 12h6"/><path d="m16 12h6"/><path d="m4.93 19.07 4.24-4.24"/><path d="m14.83 9.17 4.24-4.24"/></svg>`; // Snowflake
    } else if (index === 1) { // Contínuo
      classeIcone = "ranking-icone-continuo";
      textoImpacto = "Estável";
      iconeSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="10" height="20" x="7" y="2" rx="2"/><path d="M7 10h10"/><path d="M10 14h.01"/></svg>`; // Geladeira
    } else { // Moderado
      classeIcone = "ranking-icone-moderado";
      textoImpacto = "Moderado";
      iconeSvg = `<svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="12" x="4" y="4" rx="2"/><path d="M8 20h8"/><path d="M12 16v4"/></svg>`; // Monitor/Estação
    }
    
    // Status simulado
    const statusAtivo = index === 1 ? "Contínuo" : `Ativo ${8 + (index * 4)}h/dia`;

    return `
      <div class="ranking-item">
        <div class="ranking-icone-wrap ${classeIcone}">
          ${iconeSvg}
        </div>
        <div class="ranking-detalhes">
          <p class="ranking-nome">${item.nome}</p>
          <p class="ranking-status">${statusAtivo}</p>
        </div>
        <div class="ranking-valores">
          <p class="ranking-kwh ${index === 0 ? 'alto' : 'normal'}">${item.consumo_kwh} kWh</p>
          <p class="ranking-status">${textoImpacto}</p>
        </div>
      </div>
    `;
  }).join("");
}

