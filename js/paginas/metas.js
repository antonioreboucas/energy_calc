function inicializarMetas() {
  document.getElementById("form-meta").addEventListener("submit", salvarMeta);
  const agora = new Date();
  document.getElementById("meta-mes").value = agora.getMonth() + 1;
  document.getElementById("meta-ano").value = agora.getFullYear();
  carregarResidenciasParaMeta();
  carregarMetas();
}

async function carregarResidenciasParaMeta() {
  try {
    const residencias = await apiGet("/residencias/");
    const select = document.getElementById("meta-residencia");
    select.innerHTML = '<option value="">Todas</option>' + residencias.map((r) => `<option value="${r.id}">${r.nome}</option>`).join("");
  } catch (erro) {
    // segue sem o filtro por residência
  }
}

async function carregarMetas() {
  const el = document.getElementById("lista-metas");
  try {
    const metas = await apiGet("/metas/");
    if (!metas.length) {
      el.innerHTML = '<p class="estado-vazio">Nenhuma meta cadastrada ainda.</p>';
      return;
    }
    el.innerHTML = metas.map(renderizarMeta).join("");
  } catch (erro) {
    el.innerHTML = '<p class="estado-vazio">Erro ao carregar metas.</p>';
  }
}

function renderizarMeta(m) {
  const emReais = m.tipo === "REAIS";
  const formatar = emReais ? formatarMoeda : formatarKwh;
  const dentro = m.projecao.dentro_da_meta;
  const ehReal = m.projecao.origem === "real";
  // Mesma distinção real/estimado que os badges de fatura no histórico —
  // a projeção pode vir de uma fatura real já enviada ou só do cálculo a
  // partir dos aparelhos cadastrados (ver meta_router.py::_calcular_projecao).
  const origemHtml = ehReal
    ? `<span class="badge-status-analisada">Baseado em fatura real</span>`
    : `<span class="badge-status-processamento">Estimativa (aparelhos)</span>`;
  return `
    <div class="card">
      <div class="flex justify-between items-center mb-lg">
        <p class="label-md">${NOMES_MES[m.mes - 1]}/${m.ano}</p>
        <button class="btn-icone" onclick="excluirMeta(${m.id})" aria-label="Excluir">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" /></svg>
        </button>
      </div>
      <p class="caption">Alvo: ${formatar(m.valor_alvo)}</p>
      <p class="caption">Projeção: ${formatar(m.projecao.valor_projetado)} (${m.projecao.percentual_atingido}%)</p>
      <div class="flex items-center gap-sm mt-lg">
        <span class="chip ${dentro ? "ativo" : "alerta"}">${dentro ? "Dentro da meta" : "Acima da meta"}</span>
        ${origemHtml}
      </div>
    </div>`;
}

async function salvarMeta(evento) {
  evento.preventDefault();
  const dados = {
    tipo: document.getElementById("meta-tipo").value,
    valor_alvo: Number(document.getElementById("meta-valor").value),
    mes: Number(document.getElementById("meta-mes").value),
    ano: Number(document.getElementById("meta-ano").value),
    residencia_id: document.getElementById("meta-residencia").value ? Number(document.getElementById("meta-residencia").value) : null,
  };
  await comCarregamento(document.getElementById("btn-salvar-meta"), "Salvando...", async () => {
    try {
      await apiPost("/metas/", dados);
      fecharModal("modal-meta");
      mostrarToast("Meta criada!");
      carregarMetas();
    } catch (erro) {
      tratarErroApi(erro);
    }
  });
}

async function excluirMeta(id) {
  const ok = await confirmarExclusao("Tem certeza que deseja excluir essa meta?");
  if (!ok) return;
  try {
    await apiDelete(`/metas/${id}`);
    mostrarToast("Meta excluída.");
    carregarMetas();
  } catch (erro) {
    tratarErroApi(erro);
  }
}
