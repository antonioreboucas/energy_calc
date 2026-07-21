const ROTULOS_RECOMENDACAO = {
  economia_personalizada: "Economia personalizada",
  troca_equipamento: "Troca de equipamento",
  ranking_consumo: "Maior consumidor",
};

function inicializarRecomendacoes() {
  carregarRecomendacoes();
}

async function carregarRecomendacoes() {
  const el = document.getElementById("lista-recomendacoes");
  mostrarLoadingAba("lista-recomendacoes", "Carregando recomendações...");
  try {
    const lista = await apiGet("/recomendacoes/");
    if (!lista.length) {
      el.innerHTML = '<p class="estado-vazio">Nenhuma recomendação ainda. Clique em "Gerar novas" pra receber sugestões personalizadas.</p>';
      return;
    }
    el.innerHTML = lista.map(renderizarRecomendacao).join("");
  } catch (erro) {
    el.innerHTML = '<p class="estado-vazio">Erro ao carregar recomendações.</p>';
  }
}

function renderizarRecomendacao(r) {
  return `
    <div class="card">
      <span class="chip ativo mb-lg">${ROTULOS_RECOMENDACAO[r.tipo] || r.tipo}</span>
      <p class="body-md">${r.descricao}</p>
      ${
        r.economia_kwh_potencial
          ? `<p class="caption mt-lg">Economia potencial: ${formatarKwh(r.economia_kwh_potencial)} (${formatarMoeda(r.economia_valor_potencial)})</p>`
          : ""
      }
    </div>`;
}

async function gerarRecomendacoes() {
  await comCarregamento(document.getElementById("btn-gerar-recomendacoes"), "Gerando...", async () => {
    try {
      const geradas = await apiPost("/recomendacoes/gerar");
      mostrarToast(geradas.length ? `${geradas.length} recomendação(ões) gerada(s)!` : "Nenhuma recomendação nova no momento.");
      carregarRecomendacoes();
    } catch (erro) {
      tratarErroApi(erro);
    }
  });
}
