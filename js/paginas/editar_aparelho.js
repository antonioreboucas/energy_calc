let modoPotenciaEditar = "potencia";
let aparelhoIdEditando = null;

function inicializarEditarAparelho() {
  aparelhoIdEditando = new URLSearchParams(location.search).get("id");
  if (!aparelhoIdEditando) {
    mostrarToast("Aparelho não encontrado.", "erro");
    setTimeout(() => (location.href = "aparelhos"), 1200);
    return;
  }

  document.getElementById("form-editar-aparelho").addEventListener("submit", salvarEdicaoAparelho);
  configurarSlidersEditar();
  configurarModoPotenciaEditar();
  carregarAparelhoParaEdicao();
}

function configurarSlidersEditar() {
  const horas = document.getElementById("ea-horas");
  const dias = document.getElementById("ea-dias");
  const horasValor = document.getElementById("ea-horas-valor");
  const diasValor = document.getElementById("ea-dias-valor");
  horas.addEventListener("input", () => {
    horasValor.textContent = `${horas.value}h`;
    atualizarPotenciaEquivalenteEditar();
  });
  dias.addEventListener("input", () => {
    diasValor.textContent = dias.value;
    atualizarPotenciaEquivalenteEditar();
  });
}

// Mesmo cálculo de novo_aparelho.js::calcularPotenciaEquivalente — ver
// CLAUDE.md/GEMINI.md do frontend pra o porquê disso ser resolvido no
// cliente em vez de virar uma coluna/modo no backend.
function configurarModoPotenciaEditar() {
  document.getElementById("ea-kwh-mes").addEventListener("input", atualizarPotenciaEquivalenteEditar);
  document.getElementById("ea-quantidade").addEventListener("input", atualizarPotenciaEquivalenteEditar);
}

function alternarModoPotencia(modo) {
  modoPotenciaEditar = modo;
  document.querySelectorAll(".toggle-modo-btn").forEach((b) => b.classList.toggle("ativo", b.dataset.modo === modo));
  document.getElementById("campo-potencia-watts").style.display = modo === "potencia" ? "block" : "none";
  document.getElementById("campo-consumo-kwh").style.display = modo === "kwh" ? "block" : "none";
  document.getElementById("ea-potencia").required = modo === "potencia";
  document.getElementById("ea-kwh-mes").required = modo === "kwh";
  atualizarPotenciaEquivalenteEditar();
}

function calcularPotenciaEquivalenteEditar() {
  const kwhMes = Number(document.getElementById("ea-kwh-mes").value);
  const quantidade = Number(document.getElementById("ea-quantidade").value) || 1;
  const horas = Number(document.getElementById("ea-horas").value);
  const dias = Number(document.getElementById("ea-dias").value);
  if (!kwhMes || !horas || !dias) return null;
  return Math.round(((kwhMes * 1000) / (quantidade * horas * dias)) * 10) / 10;
}

function atualizarPotenciaEquivalenteEditar() {
  const el = document.getElementById("ea-potencia-equivalente");
  if (modoPotenciaEditar !== "kwh") return;
  const watts = calcularPotenciaEquivalenteEditar();
  el.textContent = watts ? `Equivale a uma potência média de ~${Math.round(watts)} W.` : "";
}

async function carregarAparelhoParaEdicao() {
  try {
    const a = await apiGet(`/aparelhos/${aparelhoIdEditando}`);

    document.getElementById("ea-id").value = a.id;
    document.getElementById("ea-nome").value = a.nome;
    document.getElementById("ea-ambiente").value = a.ambiente;
    if ([...document.getElementById("ea-categoria").options].some((o) => o.value === a.categoria)) {
      document.getElementById("ea-categoria").value = a.categoria;
    }
    document.getElementById("ea-potencia").value = a.potencia_watts;
    document.getElementById("ea-quantidade").value = a.quantidade;
    document.getElementById("ea-eficiencia").value = a.eficiencia || "";
    document.getElementById("ea-horas").value = a.horas_dia;
    document.getElementById("ea-horas-valor").textContent = `${a.horas_dia}h`;
    document.getElementById("ea-dias").value = a.dias_mes;
    document.getElementById("ea-dias-valor").textContent = a.dias_mes;
    document.getElementById("ea-observacoes").value = a.observacoes || "";

    document.getElementById("editar-aparelho-subtitulo").textContent = `Editando "${a.nome}".`;
    document.getElementById("card-form-editar").style.display = "block";
  } catch (erro) {
    mostrarToast("Não foi possível carregar esse aparelho.", "erro");
    setTimeout(() => (location.href = "aparelhos"), 1200);
  }
}

async function salvarEdicaoAparelho(evento) {
  evento.preventDefault();

  let potenciaWatts;
  if (modoPotenciaEditar === "kwh") {
    potenciaWatts = calcularPotenciaEquivalenteEditar();
    if (!potenciaWatts) {
      mostrarToast("Informe o consumo mensal (kWh) e as horas de uso por dia.", "erro");
      return;
    }
  } else {
    potenciaWatts = Number(document.getElementById("ea-potencia").value);
  }

  const dados = {
    nome: document.getElementById("ea-nome").value,
    categoria: document.getElementById("ea-categoria").value,
    ambiente: document.getElementById("ea-ambiente").value,
    potencia_watts: potenciaWatts,
    quantidade: Number(document.getElementById("ea-quantidade").value),
    horas_dia: Number(document.getElementById("ea-horas").value),
    dias_mes: Number(document.getElementById("ea-dias").value),
    eficiencia: document.getElementById("ea-eficiencia").value || null,
    observacoes: document.getElementById("ea-observacoes").value || null,
  };

  await comCarregamento(document.getElementById("btn-salvar-editar-aparelho"), "Salvando...", async () => {
    try {
      await apiPost(`/aparelhos/${aparelhoIdEditando}`, dados);
      mostrarToast("Aparelho atualizado!");
      window.location.href = "aparelhos";
    } catch (erro) {
      tratarErroApi(erro);
    }
  });
}
