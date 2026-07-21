let residenciasCacheNovo = [];
let modoPotencia = "potencia";

function inicializarNovoAparelho() {
  document.getElementById("form-novo-aparelho").addEventListener("submit", salvarNovoAparelho);
  configurarSlidersNovoAparelho();
  configurarModoPotencia();
  carregarResidenciasNovoAparelho();
  carregarResumoPlanoNovoAparelho();
}

function configurarSlidersNovoAparelho() {
  const horas = document.getElementById("na-horas");
  const dias = document.getElementById("na-dias");
  const horasValor = document.getElementById("na-horas-valor");
  const diasValor = document.getElementById("na-dias-valor");
  horas.addEventListener("input", () => {
    horasValor.textContent = `${horas.value}h`;
    atualizarPotenciaEquivalente();
  });
  dias.addEventListener("input", () => {
    diasValor.textContent = dias.value;
    atualizarPotenciaEquivalente();
  });
}

// Modo alternativo pra quem não sabe a potência do aparelho, só o consumo
// mensal (comum em etiquetas Procel/INMETRO de geladeira/freezer, que
// listam kWh/mês em vez de watts — mais fiel pra aparelhos de ciclo
// intermitente do que assumir potência constante). Em vez de mudar o
// schema/backend, resolvemos a potência média equivalente a partir do
// consumo informado — dali pra frente o aparelho se comporta como
// qualquer outro (mesmas fórmulas, comparador, recomendações etc.).
function configurarModoPotencia() {
  const kwhMes = document.getElementById("na-kwh-mes");
  const quantidade = document.getElementById("na-quantidade");
  kwhMes.addEventListener("input", atualizarPotenciaEquivalente);
  quantidade.addEventListener("input", atualizarPotenciaEquivalente);
}

function alternarModoPotencia(modo) {
  modoPotencia = modo;
  document.querySelectorAll(".toggle-modo-btn").forEach((b) => b.classList.toggle("ativo", b.dataset.modo === modo));
  document.getElementById("campo-potencia-watts").style.display = modo === "potencia" ? "block" : "none";
  document.getElementById("campo-consumo-kwh").style.display = modo === "kwh" ? "block" : "none";
  document.getElementById("na-potencia").required = modo === "potencia";
  document.getElementById("na-kwh-mes").required = modo === "kwh";
  atualizarPotenciaEquivalente();
}

function calcularPotenciaEquivalente() {
  const kwhMes = Number(document.getElementById("na-kwh-mes").value);
  const quantidade = Number(document.getElementById("na-quantidade").value) || 1;
  const horas = Number(document.getElementById("na-horas").value);
  const dias = Number(document.getElementById("na-dias").value);
  if (!kwhMes || !horas || !dias) return null;
  // Inverso de consumo_mensal_kwh = potencia*quantidade*horas/1000*dias
  // (mesma fórmula do backend, ver consumo_service.py) — resolvendo pra potência.
  // Arredonda pra 1 casa decimal só pra não salvar/exibir uma dízima longa
  // (não afeta a precisão do consumo reproduzido de forma perceptível).
  return Math.round(((kwhMes * 1000) / (quantidade * horas * dias)) * 10) / 10;
}

function atualizarPotenciaEquivalente() {
  const el = document.getElementById("na-potencia-equivalente");
  if (modoPotencia !== "kwh") return;
  const watts = calcularPotenciaEquivalente();
  el.textContent = watts ? `Equivale a uma potência média de ~${Math.round(watts)} W.` : "";
}

async function carregarResidenciasNovoAparelho() {
  const form = document.getElementById("form-novo-aparelho");
  const aviso = document.getElementById("aviso-sem-residencia");
  const selectWrap = document.getElementById("campo-residencia-wrap");
  const select = document.getElementById("na-residencia");

  try {
    residenciasCacheNovo = await apiGet("/residencias/");

    if (!residenciasCacheNovo.length) {
      form.style.display = "none";
      aviso.style.display = "block";
      return;
    }

    aviso.style.display = "none";
    form.style.display = "block";

    if (residenciasCacheNovo.length > 1) {
      selectWrap.style.display = "block";
      select.innerHTML = residenciasCacheNovo.map((r) => `<option value="${r.id}">${r.nome}</option>`).join("");
    }
  } catch (erro) {
    mostrarToast("Erro ao carregar residências.", "erro");
  }
}

// Mesma lógica de aparelhos.js::obterLimiteAparelhos — /minha-assinatura não
// devolve limites, precisa cruzar com /planos/ pra saber o limite do plano atual.
async function carregarResumoPlanoNovoAparelho() {
  const subtitulo = document.getElementById("novo-aparelho-subtitulo");
  try {
    const [assinatura, planos, aparelhos] = await Promise.all([
      apiGet("/assinaturas/minha-assinatura"),
      apiGet("/planos/"),
      apiGet("/aparelhos/"),
    ]);
    const planoAtual = planos.find((p) => p.tipo === assinatura.plano?.tipo);
    const limite = planoAtual ? planoAtual.limite_aparelhos : null;

    if (limite == null) {
      subtitulo.textContent = "Seu plano Premium permite aparelhos ilimitados.";
      return;
    }
    subtitulo.textContent =
      aparelhos.length >= limite
        ? "Você atingiu o limite do plano gratuito — assine para adicionar mais."
        : `Restam ${limite - aparelhos.length} de ${limite} aparelhos no seu plano gratuito.`;
  } catch (erro) {
    // Resumo de plano é só informativo — mantém o texto padrão do HTML.
  }
}

async function salvarNovoAparelho(evento) {
  evento.preventDefault();

  const residenciaId =
    residenciasCacheNovo.length === 1
      ? residenciasCacheNovo[0].id
      : Number(document.getElementById("na-residencia").value);

  if (!residenciaId) {
    mostrarToast("Selecione uma residência.", "erro");
    return;
  }

  let potenciaWatts;
  if (modoPotencia === "kwh") {
    potenciaWatts = calcularPotenciaEquivalente();
    if (!potenciaWatts) {
      mostrarToast("Informe o consumo mensal (kWh) e as horas de uso por dia.", "erro");
      return;
    }
  } else {
    potenciaWatts = Number(document.getElementById("na-potencia").value);
  }

  const dados = {
    residencia_id: residenciaId,
    nome: document.getElementById("na-nome").value,
    categoria: document.getElementById("na-categoria").value,
    ambiente: document.getElementById("na-ambiente").value,
    potencia_watts: potenciaWatts,
    quantidade: Number(document.getElementById("na-quantidade").value),
    horas_dia: Number(document.getElementById("na-horas").value),
    dias_mes: Number(document.getElementById("na-dias").value),
    eficiencia: document.getElementById("na-eficiencia").value || null,
  };

  await comCarregamento(document.getElementById("btn-salvar-novo-aparelho"), "Salvando...", async () => {
    try {
      await apiPost("/aparelhos/", dados);
      mostrarToast("Aparelho salvo!");
      window.location.href = "aparelhos";
    } catch (erro) {
      tratarErroApi(erro);
    }
  });
}
