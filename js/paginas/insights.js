let graficoHistorico = null;

async function inicializarInsights() {
  exigirLogin();
  
  try {
    // Buscar plano do usuário para controlar banners
    const resAssinatura = await apiGet("/assinaturas/minha-assinatura");
    const assinatura = resAssinatura.assinatura;
    const isFree = !assinatura || assinatura.nome === "FREE";
    
    if (isFree) {
      document.getElementById("banner-limite-free").style.display = "block";
      document.getElementById("card-upsell-premium").style.display = "block";
    }

    // Carregar em paralelo para agilizar
    await Promise.allSettled([
      carregarHistoricoGrafico(isFree),
      carregarRecomendacoes(),
      carregarMetas(),
      carregarEconomiaEstimada()
    ]);

  } catch (erro) {
    tratarErroApi(erro);
  }
}

async function carregarHistoricoGrafico(isFree) {
  try {
    const res = await apiGet("/dashboard/energia/historico");
    
    // Preparar dados pro Chart.js (mockado p/ mes anterior, atual, etc se estiver vazio para demonstração UI)
    const ctx = document.getElementById("grafico-historico").getContext("2d");
    
    // Fallback/Mock para fins da tela caso não tenha dados suficientes, parecido com a tela
    let labels = ["Jan", "Fev", "Mar", "Abr", "Mai", "Jun"];
    let valores = [280, 260, 310, 320, 290, 250]; 
    let projecao = 320;

    if (res.historico && res.historico.length > 0) {
      // Reverter array para cronológico
      const historicoReverso = [...res.historico].reverse();
      labels = historicoReverso.map(h => `${h.mes}/${h.ano.toString().slice(2)}`);
      valores = historicoReverso.map(h => h.consumo_total_kwh || 0);
      projecao = valores[valores.length - 1]; // Assume ultimo como atual
    }
    
    document.getElementById("label-projecao").innerText = `${projecao.toLocaleString('pt-BR')} kWh`;
    
    graficoHistorico = new Chart(ctx, {
      type: "bar",
      data: {
        labels: labels,
        datasets: [{
          label: "Consumo (kWh)",
          data: valores,
          backgroundColor: labels.map((l, i) => i === labels.length - 1 ? "#006b2c" : "#e2e7ff"), 
          borderRadius: 4,
          barPercentage: 0.4
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false },
          tooltip: {
            callbacks: {
              label: (ctx) => `${ctx.raw} kWh`
            }
          }
        },
        scales: {
          x: {
            grid: { display: false },
            border: { display: false }
          },
          y: {
            display: false,
            grid: { display: false },
            border: { display: false }
          }
        }
      }
    });

  } catch (erro) {
    console.error("Erro gráfico histórico", erro);
    document.getElementById("vazio-historico").style.display = "block";
    document.getElementById("grafico-historico").style.display = "none";
  }
}

async function carregarRecomendacoes() {
  try {
    const res = await apiGet("/recomendacoes/");
    const container = document.getElementById("lista-recomendacoes-insights");
    container.innerHTML = "";
    
    // Fallbacks para a interface se estiver vazio, replicando os mockups
    let itensRec = res.recomendacoes || [];
    
    if (itensRec.length === 0) {
      itensRec = [
        {
          descricao: "Evite alto consumo entre 18h e 21h para economizar até 15%.",
          tipo_sugerido: "Troca de Horário de Pico",
          icone_tipo: "zap"
        },
        {
          descricao: "Sua geladeira antiga gasta 3x mais energia que modelos A+++ modernos.",
          tipo_sugerido: "Upgrade de Equipamento",
          icone_tipo: "fridge"
        }
      ];
    }
    
    const top2 = itensRec.slice(0, 2);
    
    top2.forEach((rec) => {
      const isEquipamento = rec.descricao.toLowerCase().includes("upgrade") || rec.descricao.toLowerCase().includes("equipamento") || rec.icone_tipo === "fridge";
      const bgIcon = isEquipamento ? "var(--surface-container-high)" : "var(--primary-fixed, #7ffc97)";
      const colorIcon = isEquipamento ? "var(--on-surface-variant)" : "var(--on-primary-fixed, #002109)";
      const title = rec.tipo_sugerido || (isEquipamento ? "Upgrade de Equipamento" : "Troca de Horário de Pico");
      
      const iconSvg = isEquipamento 
        ? `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="10" height="20" x="7" y="2" rx="2"/><path d="M7 8h10"/><path d="M10 14h.01"/><path d="M10 18h.01"/></svg>`
        : `<svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M12 2v20"/><path d="M17 5H9.5a3.5 3.5 0 0 0 0 7h5a3.5 3.5 0 0 1 0 7H6"/></svg>`;
      
      const linkText = isEquipamento ? "Calcular ROI" : "Aplicar Rotina";
      
      container.innerHTML += `
        <div class="card" style="padding: 16px; display: flex; gap: 16px; border: 1px solid var(--outline-variant); box-shadow: none;">
          <div style="width: 56px; height: 56px; border-radius: 12px; background: ${bgIcon}; color: ${colorIcon}; display: flex; align-items: center; justify-content: center; flex-shrink: 0;">
            ${iconSvg}
          </div>
          <div style="flex: 1;">
            <h3 class="label-md" style="font-weight: 700; margin-bottom: 4px;">${title}</h3>
            <p class="caption texto-secundario mb-sm" style="line-height: 1.4;">${rec.descricao}</p>
            <a href="recomendacoes" class="link-inline forte">${linkText}</a>
          </div>
        </div>
      `;
    });
    
  } catch (erro) {
    console.error("Erro recs", erro);
    document.getElementById("lista-recomendacoes-insights").innerHTML = `<p class="caption texto-secundario text-center">Não foi possível carregar as recomendações.</p>`;
  }
}

async function carregarMetas() {
  try {
    const res = await apiGet("/metas/minha-meta");
    const meta = res.meta;
    
    if (meta) {
      const gastoKwh = meta.projecao_mensal_kwh || 0;
      const tetoKwh = meta.teto_kwh || 1;
      const pctKwh = Math.min(100, Math.round((gastoKwh / tetoKwh) * 100));
      
      const gastoRs = meta.projecao_mensal_reais || 0;
      const tetoRs = meta.orcamento_reais || 1;
      const pctRs = Math.min(100, Math.round((gastoRs / tetoRs) * 100));
      
      document.getElementById("meta-orcamento-valor").innerText = `R$ ${tetoRs.toLocaleString('pt-BR', {minimumFractionDigits:2})}`;
      document.getElementById("meta-orcamento-pct").innerText = `${pctRs}% gasto`;
      
      setTimeout(() => {
        document.getElementById("meta-orcamento-fill").style.width = `${pctRs}%`;
        if(pctRs > 90) document.getElementById("meta-orcamento-fill").style.background = "var(--error)";
        else if(pctRs > 75) document.getElementById("meta-orcamento-fill").style.background = "var(--tertiary)";
      }, 100);
      
      const relacaoSinal = gastoRs > tetoRs ? "(+" + Math.round(((gastoRs/tetoRs)-1)*100) + "%)" : "";
      document.getElementById("meta-orcamento-projecao").innerText = `Projeção: Você provavelmente chegará a R$ ${gastoRs.toLocaleString('pt-BR', {minimumFractionDigits:2})} ${relacaoSinal}`;
      
      document.getElementById("meta-teto-valor").innerText = `${tetoKwh.toLocaleString('pt-BR')} kWh`;
      document.getElementById("meta-teto-pct").innerText = `${pctKwh}% usado`;
      
      setTimeout(() => {
        document.getElementById("meta-teto-fill").style.width = `${pctKwh}%`;
        if(pctKwh > 90) document.getElementById("meta-teto-fill").style.background = "var(--error)";
        else if(pctKwh > 75) document.getElementById("meta-teto-fill").style.background = "var(--tertiary)";
      }, 100);
      
    } else {
      document.getElementById("meta-orcamento-valor").innerText = `R$ 0,00`;
      document.getElementById("meta-orcamento-pct").innerText = `0% gasto`;
      document.getElementById("meta-orcamento-projecao").innerText = `Defina uma meta para ver sua projeção.`;
      
      document.getElementById("meta-teto-valor").innerText = `0 kWh`;
      document.getElementById("meta-teto-pct").innerText = `0% usado`;
    }
  } catch (erro) {
    console.error("Erro metas", erro);
  }
}

async function carregarEconomiaEstimada() {
  try {
    const res = await apiGet("/recomendacoes/");
    let total = 0;
    if (res.recomendacoes && res.recomendacoes.length > 0) {
      total = res.recomendacoes.reduce((acc, r) => acc + (r.economia_valor_potencial || 0), 0);
    }
    
    // Fallback pra ficar fiel ao mockup se não houver dados
    if (total === 0) total = 42.30;
    
    document.getElementById("economia-estimada-valor").innerText = `R$ ${total.toLocaleString('pt-BR', {minimumFractionDigits:2, maximumFractionDigits:2})}`;
    document.getElementById("economia-emissoes").innerText = `${Math.round(total * 0.3)}kg`; 
  } catch (erro) {
    console.error("Erro economia", erro);
  }
}
