function formatarMoeda(valor) {
  return valor != null && !Number.isNaN(Number(valor))
    ? Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })
    : '0,00';
}

function formatarNumero(valor, digits = 2) {
  return valor != null && !Number.isNaN(Number(valor))
    ? Number(valor).toLocaleString('pt-BR', { minimumFractionDigits: digits, maximumFractionDigits: digits })
    : '0,00';
}

// UC e número do cliente identificam a instalação/conta na concessionária —
// ficam mascarados por padrão, com um botão de olho pra revelar sob demanda.
function campoMascaradoHtml(valor, rotulo) {
  if (!valor) return '—';
  const mascara = '•'.repeat(8);
  const valorSeguro = String(valor).replace(/"/g, '&quot;');
  return `
    <span class="campo-mascarado">
      <span class="dado-sensivel" data-valor="${valorSeguro}" data-mascara="${mascara}">${mascara}</span>
      <button type="button" class="btn-olho" onclick="alternarDadoSensivel(this)" aria-label="Mostrar ${rotulo}" aria-pressed="false">
        <svg class="icone-olho-aberto" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/></svg>
        <svg class="icone-olho-fechado" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" style="display:none"><path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c6.5 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3.5 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" x2="22" y1="2" y2="22"/></svg>
      </button>
    </span>`;
}

function alternarDadoSensivel(botao) {
  const span = botao.previousElementSibling;
  if (!span) return;

  const revelado = span.classList.toggle('revelado');
  span.textContent = revelado ? span.dataset.valor : span.dataset.mascara;
  botao.setAttribute('aria-pressed', revelado ? 'true' : 'false');

  const rotulo = botao.getAttribute('aria-label').replace(/^(Mostrar|Ocultar) /, '');
  botao.setAttribute('aria-label', `${revelado ? 'Ocultar' : 'Mostrar'} ${rotulo}`);
  botao.querySelector('.icone-olho-aberto').style.display = revelado ? 'none' : '';
  botao.querySelector('.icone-olho-fechado').style.display = revelado ? '' : 'none';
}

// Rótulo técnico da fatura (UC, TUSD, ICMS...) + botão de info que revela
// uma explicação curta em texto simples — inline, não popover flutuante,
// porque o painel de "Ver detalhes" tem overflow:hidden (necessário pra
// animação de abrir/fechar) e cortaria qualquer coisa posicionada por fora.
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

async function inicializarHistorico() {
  exigirLogin();
  await carregarHistorico();
}

async function carregarHistorico() {
  const el = document.getElementById("lista-historico");
  el.innerHTML = '<p class="caption text-center texto-secundario">Carregando faturas...</p>';

  try {
    // Busca os dados agregados por mês do endpoint existente do dashboard
    const res = await apiGet(`/dashboard/energia/historico`);
    const historico = res.historico || [];

    if (!historico.length) {
      el.innerHTML = '<p class="estado-vazio">Nenhuma fatura encontrada.</p>';
      return;
    }

    // Reverte para mostrar o mais recente primeiro (a API já manda cronológico ou podemos forçar)
    const historicoOrdenado = [...historico].reverse();
    
    // Calcula totais
    const anoAtual = new Date().getFullYear();
    let totalAnoReais = 0;
    let somaKwhMeses = 0;
    let countMeses = 0;
    
    historicoOrdenado.forEach(item => {
      if (item.ano === anoAtual) {
        totalAnoReais += (item.custo_total || 0);
      }
      // ultimos 6 meses para media
      if (countMeses < 6) {
        somaKwhMeses += (item.consumo_total_kwh || 0);
        countMeses++;
      }
    });

    const mediaMensal = countMeses > 0 ? Math.round(somaKwhMeses / countMeses) : 0;
    
    document.getElementById("resumo-ano-label").innerText = anoAtual;
    document.getElementById("resumo-media").innerText = `${mediaMensal.toLocaleString('pt-BR')} kWh`;
    document.getElementById("resumo-total").innerText = `R$ ${totalAnoReais.toLocaleString('pt-BR', {minimumFractionDigits: 2})}`;

    // % de meses com fatura real enviada/analisada (origem === "real") vs.
    // só estimativa calculada a partir dos aparelhos (origem === "simulada").
    const totalMeses = historico.length;
    const mesesAnalisados = historico.filter(h => h.origem === "real").length;
    const percentualAnalisadas = totalMeses > 0 ? Math.round((mesesAnalisados / totalMeses) * 100) : 0;
    document.getElementById("resumo-status").innerText = `${percentualAnalisadas}% Analisadas`;

    // Atualiza meses do período (ex: Jan - Jun)
    if (historicoOrdenado.length > 0) {
      const primeiroDoAno = historico.find(h => h.ano === anoAtual);
      const ultimoDoAno = historicoOrdenado.find(h => h.ano === anoAtual);
      if (primeiroDoAno && ultimoDoAno) {
        document.getElementById("resumo-periodo").innerText = `${NOMES_MES[primeiroDoAno.mes - 1]} - ${NOMES_MES[ultimoDoAno.mes - 1]} ${anoAtual}`;
      }
    }

    // Renderiza lista
    el.innerHTML = historicoOrdenado.map((r, index) => {
      const isReal = r.origem === "real";
      
      const mesCompleto = new Date(r.ano, r.mes - 1).toLocaleString('pt-BR', { month: 'long' });
      const mesCapitalizado = mesCompleto.charAt(0).toUpperCase() + mesCompleto.slice(1);
      
      const badgeHtml = isReal
        ? `<div class="badge-status-analisada">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M22 11.08V12a10 10 0 1 1-5.93-9.14"/><path d="m9 11 3 3L22 4"/></svg>
             Fatura Real
           </div>`
        : `<div class="badge-status-processamento">
             <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="10"/><polyline points="12 6 12 12 16 14"/></svg>
             Estimativa (Simulada)
           </div>`;
           
      const iconCircleHtml = isReal
        ? `<div class="card-fatura-icone-analisada">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect width="16" height="20" x="4" y="2" rx="2" ry="2"/><line x1="9" x2="9" y1="22" y2="22"/><line x1="15" x2="15" y1="22" y2="22"/><path d="m9 12 2 2 4-4"/></svg>
           </div>`
        : `<div class="card-fatura-icone-processamento">
             <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/></svg>
           </div>`;

      const tarifaHtml = r.valor_kwh != null
        ? `<div class="card-historico-group">
             <p class="label-md" style="font-size: 15px; font-weight: 700;">R$ ${formatarMoeda(r.valor_kwh)}/kWh</p>
             <p class="caption texto-secundario">Tarifa</p>
           </div>`
        : "";

      const dadosBasicosHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
          <div>
            ${campoComInfoHtml('UC', 'Número que identifica sua unidade consumidora — o "endereço" da sua conta na concessionária.')}
            <p class="label-sm">${campoMascaradoHtml(r.uc, 'UC')}</p>
          </div>
          <div>
            ${campoComInfoHtml('Cliente', 'Código que identifica você como cliente na concessionária — usado, por exemplo, pra cadastrar débito automático.')}
            <p class="label-sm">${campoMascaradoHtml(r.codigo_cliente, 'número do cliente')}</p>
          </div>
          <div>
            ${campoComInfoHtml('Referência', 'Mês e ano a que essa fatura se refere — o período de consumo cobrado.')}
            <p class="label-sm">${r.referencia || `${String(r.mes).padStart(2, '0')}/${r.ano}`}</p>
          </div>
          <div>
            ${campoComInfoHtml('Vencimento', 'Data limite pra pagar essa fatura sem multa nem juros.')}
            <p class="label-sm">${r.vencimento || '—'}</p>
          </div>
        </div>`;

      const detalhesFaturaHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
          <div>
            ${campoComInfoHtml('Bandeira', 'Bandeira tarifária do mês (verde, amarela ou vermelha) — indica se as condições de geração de energia no país encarecem a tarifa.')}
            <p class="label-sm">${r.bandeira || '—'}</p>
          </div>
          <div>
            ${campoComInfoHtml('Dias Faturados', 'Quantidade de dias entre a leitura anterior e a atual do medidor, cobertos por essa fatura.')}
            <p class="label-sm">${r.dias_faturados ?? '—'}</p>
          </div>
          <div>
            ${campoComInfoHtml('Classe', 'Classificação da sua unidade consumidora perante a concessionária (ex: Residencial, Comercial).')}
            <p class="label-sm">${r.classe || '—'}</p>
          </div>
          <div>
            ${campoComInfoHtml('Subclasse', 'Detalhamento da classe da sua unidade consumidora.')}
            <p class="label-sm">${r.subclasse || '—'}</p>
          </div>
        </div>`;

      const tarifasHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
          <div>
            ${campoComInfoHtml('Tarifa TE', 'Valor cobrado pela energia elétrica (TE = Tarifa de Energia) que você efetivamente consumiu.')}
            <p class="label-sm">R$ ${formatarMoeda(r.valor_te)}</p>
          </div>
          <div>
            ${campoComInfoHtml('Tarifa TUSD', 'Valor cobrado pelo uso da rede elétrica — fios, postes e transformadores (TUSD = Tarifa de Uso do Sistema de Distribuição).')}
            <p class="label-sm">R$ ${formatarMoeda(r.valor_tusd)}</p>
          </div>
          <div>
            ${campoComInfoHtml('Bandeira', 'Valor adicional cobrado nessa fatura por causa da bandeira tarifária do mês.')}
            <p class="label-sm">R$ ${formatarMoeda(r.valor_bandeira)}</p>
          </div>
          <div>
            ${campoComInfoHtml('Média/kWh', 'Tarifa média por kWh consumido, considerando todos os custos da fatura.')}
            <p class="label-sm">R$ ${formatarMoeda(r.tarifa_media_kwh)}</p>
          </div>
        </div>`;

      const impostosHtml = `
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:12px;margin-top:12px;">
          <div>
            ${campoComInfoHtml('ICMS', 'Imposto estadual sobre a energia consumida, já incluído no valor da fatura.')}
            <p class="label-sm">R$ ${formatarMoeda(r.valor_icms)}</p>
          </div>
          <div>
            ${campoComInfoHtml('PIS', 'Contribuição federal (PIS/PASEP) incluída no valor da fatura.')}
            <p class="label-sm">R$ ${formatarMoeda(r.valor_pis)}</p>
          </div>
          <div>
            ${campoComInfoHtml('COFINS', 'Outra contribuição federal incluída no valor da fatura, cobrada junto com o PIS.')}
            <p class="label-sm">R$ ${formatarMoeda(r.valor_cofins)}</p>
          </div>
          <div>
            ${campoComInfoHtml('Juros', 'Juros de mora cobrados por atraso no pagamento de uma fatura anterior.')}
            <p class="label-sm">R$ ${formatarMoeda(r.juros)}</p>
          </div>
        </div>`;

      // Os detalhes extras (UC, tarifas, impostos...) só existem pra faturas
      // reais analisadas — um mês simulado não tem nada aí pra mostrar, então
      // nem o botão "Ver detalhes" aparece nesse caso (bloco fica vazio, sem
      // gerar um <div> vazio ocupando espaço de gap no card).
      const secaoDetalhesHtml = isReal
        ? `<div>
             <button class="btn-ver-detalhes" id="btn-detalhes-${index}" onclick="alternarDetalhesFatura(${index})" aria-expanded="false" aria-controls="detalhes-fatura-${index}">
               <span class="texto-btn-detalhes">Ver detalhes</span>
               <svg class="icone-chevron" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="6 9 12 15 18 9"/></svg>
             </button>
             <div class="detalhes-fatura-collapse" id="detalhes-fatura-${index}">
               <div>
                 ${dadosBasicosHtml}
                 ${detalhesFaturaHtml}
                 ${tarifasHtml}
                 ${impostosHtml}
               </div>
             </div>
           </div>`
        : "";

      return `
        <div class="card card-historico-item" style="${isReal ? 'border-left: 4px solid var(--primary);' : ''}">
          <div class="card-historico-top">
            ${iconCircleHtml}
            <div>
              <h3 class="label-md" style="font-size: 16px;">${mesCapitalizado} ${r.ano}</h3>
              <p class="caption texto-secundario">${r.concessionaria || "Referência"}</p>
            </div>
          </div>

          <div class="card-historico-stats-row">
            <div class="card-historico-group">
              <p class="label-md" style="font-size: 16px; font-weight: 700;">${r.consumo_total_kwh ? r.consumo_total_kwh.toLocaleString('pt-BR') : 0} kWh</p>
              <p class="caption texto-secundario">Consumo</p>
            </div>

            <div class="card-historico-group">
              <p class="label-md" style="font-size: 16px; font-weight: 700; color: var(--primary);">R$ ${(r.custo_total || 0).toLocaleString('pt-BR', {minimumFractionDigits: 2})}</p>
              <p class="caption texto-secundario">Valor Total</p>
            </div>

            ${tarifaHtml}
          </div>

          ${secaoDetalhesHtml}

          <div class="flex justify-between items-center">
            ${badgeHtml}
            <div class="flex gap-sm">
              <button class="btn-icone" aria-label="Baixar" onclick="baixarFaturaSimulada()">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/><polyline points="7 10 12 15 17 10"/><line x1="12" x2="12" y1="15" y2="3"/></svg>
              </button>
              <button class="btn-icone" aria-label="Opções" onclick="mostrarToast('Opções da fatura', 'info')">
                <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><circle cx="12" cy="12" r="1"/><circle cx="12" cy="5" r="1"/><circle cx="12" cy="19" r="1"/></svg>
              </button>
            </div>
          </div>
        </div>
      `;
    }).join("");

  } catch (erro) {
    el.innerHTML = '<p class="estado-vazio">Erro ao carregar faturas.</p>';
  }
}

function alternarDetalhesFatura(indice) {
  const painel = document.getElementById(`detalhes-fatura-${indice}`);
  const botao = document.getElementById(`btn-detalhes-${indice}`);
  if (!painel || !botao) return;

  const expandido = painel.classList.toggle("aberto");
  botao.classList.toggle("aberto", expandido);
  botao.setAttribute("aria-expanded", expandido ? "true" : "false");
  botao.querySelector(".texto-btn-detalhes").textContent = expandido ? "Ocultar detalhes" : "Ver detalhes";
}

async function baixarFaturaSimulada() {
  mostrarToast("Iniciando download da fatura...", "info");
  try {
    const params = new URLSearchParams();
    params.set("formato", "pdf");
    const token = localStorage.getItem("token");

    const resposta = await fetch(`${API_BASE}/dashboard/historico/exportar?${params}`, {
      headers: { Authorization: `Bearer ${token}` },
    });

    if (!resposta.ok) {
      const corpo = await resposta.json().catch(() => null);
      const detalhe = corpo && corpo.detail;
      const mensagem = (detalhe && typeof detalhe === "object" && detalhe.mensagem) || (typeof detalhe === "string" && detalhe) || "Erro ao baixar fatura.";
      if (detalhe && typeof detalhe === "object" && detalhe.erro === "upgrade_necessario") {
        mostrarModalUpgrade(mensagem);
        return;
      }
      throw new Error(mensagem);
    }

    const blob = await resposta.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `fatura.pdf`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  } catch (erro) {
    mostrarToast(erro.message, "erro");
  }
}
