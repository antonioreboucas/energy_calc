const STATUS_ASSINATURA = {
  TRIAL: { texto: "Período de Teste", classe: "chip-info" },
  ATIVO: { texto: "Plano Ativo", classe: "ativo" },
  INADIMPLENTE: { texto: "Pagamento Pendente", classe: "alerta" },
  CANCELADO: { texto: "Cancelado", classe: "chip-neutro" },
  EXPIRADO: { texto: "Expirado", classe: "chip-neutro" },
};

const ROTULO_METODO_PAGAMENTO = {
  CARTAO: "Cartão de crédito",
  PIX: "PIX",
  BOLETO: "Boleto",
};

const ROTULO_STATUS_PAGAMENTO = {
  APROVADO: "Aprovado",
  PENDENTE: "Pendente",
  RECUSADO: "Recusado",
  ESTORNADO: "Estornado",
};

function inicializarAssinatura() {
  carregarAssinatura();
}

async function carregarAssinatura() {
  try {
    const assinatura = await apiGet("/assinaturas/minha-assinatura");
    renderizarAssinatura(assinatura);
  } catch (erro) {
    document.getElementById("card-assinatura").innerHTML = `<p class="estado-vazio">${erro.message}</p>`;
  }
}

function textoRenovacao(a) {
  if (!a.vencimento) {
    return a.plano.tipo === "PREMIUM" ? "Renovação automática ativa" : "Sem cobrança — plano gratuito";
  }
  const data = new Date(a.vencimento).toLocaleDateString("pt-BR", { day: "2-digit", month: "short", year: "numeric" });
  return a.renovacao_automatica ? `Próximo faturamento: ${data}` : `Acesso até: ${data}`;
}

function renderizarAssinatura(a) {
  const isPremium = a.plano.tipo === "PREMIUM";
  const status = STATUS_ASSINATURA[a.status] || { texto: a.status, classe: "chip-neutro" };
  const ultimoPagamento = a.historico_pagamentos[0];

  document.getElementById("card-assinatura").innerHTML = `
    <span class="chip ${status.classe}">${status.texto}</span>
    <p class="card-assinatura-plano">${a.plano.nome}</p>
    <p class="caption card-assinatura-renovacao">${textoRenovacao(a)}</p>
    <p class="card-assinatura-preco">${a.plano.preco_mensal > 0 ? formatarMoeda(a.plano.preco_mensal) : "R$ 0"}<span class="plano-periodo">/mês</span></p>
    ${
      ultimoPagamento
        ? `<div class="info-metodo-pagamento">
             <span class="info-metodo-pagamento-icone">
               <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><rect x="2" y="5" width="20" height="14" rx="2" /><path d="M2 10h20" /></svg>
             </span>
             <div>
               <p class="caption">Método de pagamento</p>
               <p class="label-md">${ROTULO_METODO_PAGAMENTO[ultimoPagamento.metodo] || ultimoPagamento.metodo}</p>
             </div>
           </div>`
        : ""
    }
  `;

  const acoes = document.getElementById("acoes-assinatura");
  if (!isPremium) {
    acoes.innerHTML = `
      <button class="btn btn-primary btn-block" onclick="fazerUpgrade('mensal', this)">↑ Upgrade para Premium (mensal)</button>
      <button class="btn btn-outline-neutro btn-block" onclick="fazerUpgrade('anual', this)">Assinar plano anual</button>
    `;
  } else if (a.renovacao_automatica) {
    acoes.innerHTML = `
      <button class="btn btn-outline-neutro btn-block" onclick="mostrarToast('Gerenciamento de forma de pagamento em breve.')">✎ Alterar Pagamento</button>
      <button class="btn btn-texto-perigo btn-block" onclick="cancelarAssinatura(this)">⊗ Cancelar Assinatura</button>
    `;
  } else {
    acoes.innerHTML = `<button class="btn btn-primary btn-block" onclick="reativarAssinatura(this)">Reativar assinatura</button>`;
  }

  const pagamentos = document.getElementById("lista-pagamentos");
  if (!a.historico_pagamentos.length) {
    pagamentos.innerHTML = '<p class="estado-vazio caption">Nenhum pagamento ainda.</p>';
  } else {
    pagamentos.innerHTML = a.historico_pagamentos
      .map((p) => {
        const data = p.pago_em ? new Date(p.pago_em) : null;
        const dataTexto = data ? `${NOMES_MES[data.getMonth()]} ${data.getFullYear()}` : "Aguardando pagamento";
        const dataCompleta = data ? data.toLocaleDateString("pt-BR") : "—";
        return `
      <div class="card pagamento-item">
        <span class="pagamento-item-icone">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M14 3v4a1 1 0 0 0 1 1h4" /><path d="M6 3h8l5 5v12a1 1 0 0 1-1 1H6a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1z" /></svg>
        </span>
        <div class="pagamento-item-info">
          <p class="label-md">Assinatura — ${dataTexto}</p>
          <p class="caption">${dataCompleta} · Fatura #${p.id}</p>
        </div>
        <div class="pagamento-item-valor">
          <p class="label-md">${formatarMoeda(p.valor)}</p>
          <span class="chip ${p.status === "APROVADO" ? "ativo" : "alerta"}">${ROTULO_STATUS_PAGAMENTO[p.status] || p.status}</span>
        </div>
      </div>`;
      })
      .join("");
  }
}

async function fazerUpgrade(ciclo, botao) {
  await comCarregamento(botao, "Redirecionando...", async () => {
    try {
      const resultado = await apiPost("/assinaturas/upgrade", { ciclo });
      if (resultado.checkout_url) {
        location.href = resultado.checkout_url;
      }
    } catch (erro) {
      // Ex: Stripe ainda não configurado no backend (503) — mensagem já vem clara.
      mostrarToast(erro.message, "erro");
    }
  });
}

async function cancelarAssinatura(botao) {
  const ok = await confirmarExclusao("Tem certeza que deseja cancelar sua assinatura Premium?", {
    titulo: "Cancelar assinatura?",
    textoConfirmar: "Cancelar assinatura",
  });
  if (!ok) return;
  await comCarregamento(botao, "Cancelando...", async () => {
    try {
      await apiPost("/assinaturas/cancelar");
      mostrarToast("Assinatura marcada para cancelamento ao fim do período atual.");
      carregarAssinatura();
    } catch (erro) {
      mostrarToast(erro.message, "erro");
    }
  });
}

async function reativarAssinatura(botao) {
  await comCarregamento(botao, "Reativando...", async () => {
    try {
      await apiPost("/assinaturas/reativar");
      mostrarToast("Assinatura reativada!");
      carregarAssinatura();
    } catch (erro) {
      mostrarToast(erro.message, "erro");
    }
  });
}
