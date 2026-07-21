function inicializarResidencias() {
  document.getElementById("form-residencia").addEventListener("submit", salvarResidencia);
  document.getElementById("form-tarifa").addEventListener("submit", salvarTarifa);
  carregarResidencias();
}

async function carregarResidencias() {
  const el = document.getElementById("lista-residencias");
  try {
    const residencias = await apiGet("/residencias/");
    if (!residencias.length) {
      el.innerHTML = '<p class="estado-vazio">Nenhuma residência cadastrada ainda.</p>';
      return;
    }
    el.innerHTML = residencias
      .map(
        (r) => `
      <div class="card" id="residencia-${r.id}">
        <div class="flex justify-between items-center">
          <div>
            <p class="label-md">${r.nome}</p>
            <p class="caption">${[r.cidade, r.estado].filter(Boolean).join(" - ") || "Sem localização"}${r.concessionaria ? " · " + r.concessionaria : ""}</p>
          </div>
          <button class="btn-icone" onclick="excluirResidencia(${r.id})" aria-label="Excluir">
            <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h18" /><path d="M8 6V4a1 1 0 0 1 1-1h6a1 1 0 0 1 1 1v2" /><path d="M19 6l-1 14a1 1 0 0 1-1 1H7a1 1 0 0 1-1-1L5 6" /></svg>
          </button>
        </div>
        <div class="flex gap-sm mt-lg">
          <button class="btn btn-secondary" onclick="alternarTarifas(${r.id})">Tarifas</button>
          <button class="btn btn-ghost" onclick="abrirModalTarifa(${r.id})">+ Tarifa</button>
        </div>
        <div id="tarifas-${r.id}" class="mt-lg" style="display:none;"></div>
      </div>`
      )
      .join("");
  } catch (erro) {
    el.innerHTML = '<p class="estado-vazio">Erro ao carregar residências.</p>';
  }
}

async function salvarResidencia(evento) {
  evento.preventDefault();
  const dados = {
    nome: document.getElementById("res-nome").value,
    estado: document.getElementById("res-estado").value || null,
    cidade: document.getElementById("res-cidade").value || null,
    concessionaria: document.getElementById("res-concessionaria").value || null,
  };
  await comCarregamento(document.getElementById("btn-salvar-residencia"), "Salvando...", async () => {
    try {
      await apiPost("/residencias/", dados);
      fecharModal("modal-residencia");
      evento.target.reset();
      mostrarToast("Residência criada!");
      carregarResidencias();
    } catch (erro) {
      tratarErroApi(erro);
    }
  });
}

async function excluirResidencia(id) {
  const ok = await confirmarExclusao("Tem certeza que deseja excluir essa residência?");
  if (!ok) return;
  try {
    await apiDelete(`/residencias/${id}`);
    mostrarToast("Residência excluída.");
    carregarResidencias();
  } catch (erro) {
    tratarErroApi(erro);
  }
}

async function alternarTarifas(id) {
  const el = document.getElementById(`tarifas-${id}`);
  if (el.style.display === "block") {
    el.style.display = "none";
    return;
  }
  el.style.display = "block";
  el.innerHTML = '<p class="caption">Carregando...</p>';
  try {
    const tarifas = await apiGet(`/tarifas/residencia/${id}`);
    if (!tarifas.length) {
      el.innerHTML = '<p class="estado-vazio caption">Nenhuma tarifa cadastrada.</p>';
      return;
    }
    el.innerHTML = tarifas
      .map(
        (t) => `
      <div class="flex justify-between caption" style="padding: var(--space-xs) 0;">
        <span>${formatarMoeda(t.valor_kwh)}/kWh (${t.origem})</span>
        <span>${new Date(t.vigencia_inicio).toLocaleDateString("pt-BR")}</span>
      </div>`
      )
      .join("");
  } catch (erro) {
    el.innerHTML = '<p class="estado-vazio caption">Erro ao carregar tarifas.</p>';
  }
}

function abrirModalTarifa(residenciaId) {
  document.getElementById("tarifa-residencia-id").value = residenciaId;
  abrirModal("modal-tarifa");
}

async function salvarTarifa(evento) {
  evento.preventDefault();
  const residenciaId = Number(document.getElementById("tarifa-residencia-id").value);
  const dados = {
    residencia_id: residenciaId,
    origem: document.getElementById("tarifa-origem").value,
    valor_kwh: Number(document.getElementById("tarifa-valor").value),
    bandeira: document.getElementById("tarifa-bandeira").value || null,
  };
  await comCarregamento(document.getElementById("btn-salvar-tarifa"), "Salvando...", async () => {
    try {
      await apiPost("/tarifas/", dados);
      fecharModal("modal-tarifa");
      evento.target.reset();
      mostrarToast("Tarifa cadastrada!");
      document.getElementById(`tarifas-${residenciaId}`).style.display = "none";
    } catch (erro) {
      tratarErroApi(erro);
    }
  });
}
