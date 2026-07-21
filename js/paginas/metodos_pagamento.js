const LABELS_METODO_PAGAMENTO = { CARTAO: "Cartão", PIX: "Pix", BOLETO: "Boleto" };
const LABELS_STATUS_PAGAMENTO = {
  PENDENTE: "Pendente",
  APROVADO: "Aprovado",
  RECUSADO: "Recusado",
  ESTORNADO: "Estornado",
};

function inicializarMetodosPagamento() {
  carregarHistoricoPagamentos();
  document.getElementById("btn-portal-pagamento").addEventListener("click", abrirPortalPagamento);
}

async function carregarHistoricoPagamentos() {
  const el = document.getElementById("lista-pagamentos");
  try {
    const assinatura = await apiGet("/assinaturas/minha-assinatura");
    const pagamentos = assinatura.historico_pagamentos || [];

    if (!pagamentos.length) {
      el.innerHTML = '<p class="estado-vazio caption">Nenhum pagamento registrado ainda.</p>';
      return;
    }

    el.innerHTML = pagamentos
      .map((p) => {
        const status = p.status || "PENDENTE";
        const corStatus = status === "APROVADO" ? "var(--primary)" : status === "RECUSADO" ? "var(--error)" : "var(--on-surface-variant)";
        return `
      <div class="flex justify-between items-center">
        <div>
          <p class="label-md">${formatarMoeda(p.valor)}</p>
          <p class="caption texto-secundario">${LABELS_METODO_PAGAMENTO[p.metodo] || p.metodo} ${p.pago_em ? "· " + new Date(p.pago_em).toLocaleDateString("pt-BR") : ""}</p>
        </div>
        <span class="caption" style="font-weight: 600; color: ${corStatus};">${LABELS_STATUS_PAGAMENTO[status] || status}</span>
      </div>`;
      })
      .join("");
  } catch (erro) {
    el.innerHTML = '<p class="estado-vazio caption">Nenhum pagamento registrado ainda.</p>';
  }
}

async function abrirPortalPagamento() {
  await comCarregamento(document.getElementById("btn-portal-pagamento"), "Abrindo...", async () => {
    try {
      const resultado = await apiPost("/assinaturas/portal-pagamento");
      window.location.href = resultado.portal_url;
    } catch (erro) {
      tratarErroApi(erro);
    }
  });
}
