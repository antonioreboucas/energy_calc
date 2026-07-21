let arquivoSelecionado = null;
const PDFJS_WORKER_URL = "https://unpkg.com/pdfjs-dist@3.11.122/build/pdf.worker.min.js";

// Estado do modal de progresso do envio — controladorEnvioFatura é o
// AbortController da requisição em andamento (permite cancelar de verdade,
// não só esconder o modal); canceladoEnvioFatura evita que o fluxo
// continue atualizando a UI depois que o usuário já cancelou (ex.: clique
// em Cancelar bem no instante em que a extração local do PDF termina).
let controladorEnvioFatura = null;
let canceladoEnvioFatura = false;

function abrirModalProgressoFatura() {
  canceladoEnvioFatura = false;
  document.getElementById("progresso-icone-sucesso").style.display = "none";
  document.getElementById("progresso-icone-carregando").style.display = "flex";
  document.getElementById("progresso-titulo").textContent = "Enviando fatura";
  document.getElementById("progresso-etapa").textContent = "Preparando arquivo...";
  const btnCancelar = document.getElementById("btn-cancelar-envio-fatura");
  btnCancelar.style.display = "";
  btnCancelar.disabled = false;
  abrirModal("modal-progresso-fatura");
}

function atualizarEtapaEnvioFatura(texto) {
  if (canceladoEnvioFatura) return;
  document.getElementById("progresso-etapa").textContent = texto;
}

function mostrarSucessoEnvioFatura() {
  if (canceladoEnvioFatura) return;
  document.getElementById("progresso-icone-carregando").style.display = "none";
  document.getElementById("progresso-icone-sucesso").style.display = "flex";
  document.getElementById("progresso-titulo").textContent = "Fatura enviada!";
  document.getElementById("progresso-etapa").textContent = "Redirecionando para o histórico...";
  document.getElementById("btn-cancelar-envio-fatura").style.display = "none";
}

// Único jeito de fechar o modal enquanto o envio está em andamento — sem
// clique-fora, sem X, sem Esc. Aborta a requisição de verdade (não só
// esconde o modal e deixa o upload terminando escondido).
function cancelarEnvioFatura() {
  canceladoEnvioFatura = true;
  if (controladorEnvioFatura) {
    controladorEnvioFatura.abort();
  }
  fecharModal("modal-progresso-fatura");
  mostrarToast("Envio cancelado.", "info");
}

// Só troca separador se houver vírgula (decimal BR: "0,02455"). Leituras de
// medidor já vêm com ponto decimal ("17202.0") — tratar isso como milhar e
// removê-lo produziria 172020, por isso o ponto não pode ser removido
// incondicionalmente.
function normalizarNumero(texto) {
  if (!texto) return null;
  let limpo = String(texto).trim();
  if (limpo.includes(",")) {
    limpo = limpo.replace(/\./g, "").replace(",", ".");
  }
  const valor = Number(limpo);
  return Number.isFinite(valor) ? valor : null;
}

// Reconstrói o texto agrupando itens por linha (mesma coordenada Y, com
// tolerância) e ordenando cada linha por X — o pdf.js entrega os itens na
// ordem interna do content stream do PDF, não necessariamente na ordem
// visual da esquerda pra direita (confirmado contra uma fatura real: um
// rótulo de coluna aparecia fora de ordem). Espaço só é inserido quando há
// um gap real entre o fim de um item e o início do próximo — sem isso,
// caracteres acentuados que o pdf.js separa em itens próprios (ex.: "é" em
// "Energ" + "é" + "tica") viram espaços indevidos no meio da palavra.
function reconstruirTextoPdf(items) {
  const linhas = new Map();
  const TOLERANCIA_Y = 2;

  for (const item of items) {
    if (item.str === undefined) continue;
    const y = item.transform[5];
    let chaveY = null;
    for (const k of linhas.keys()) {
      if (Math.abs(k - y) <= TOLERANCIA_Y) { chaveY = k; break; }
    }
    if (chaveY === null) chaveY = y;
    if (!linhas.has(chaveY)) linhas.set(chaveY, []);
    linhas.get(chaveY).push(item);
  }

  const ysOrdenados = [...linhas.keys()].sort((a, b) => b - a);
  let texto = "";
  for (const y of ysOrdenados) {
    const itensLinha = linhas.get(y).slice().sort((a, b) => a.transform[4] - b.transform[4]);
    let linha = "";
    let fimAnterior = null;
    for (const item of itensLinha) {
      const x = item.transform[4];
      if (fimAnterior !== null && (x - fimAnterior) > 1.5) {
        linha += " ";
      }
      linha += item.str;
      fimAnterior = x + item.width;
    }
    texto += linha.trim() + "\n";
  }
  return texto;
}

async function extrairTextoPdf(file) {
  if (!window.pdfjsLib) {
    throw new Error("PDF.js não está carregado.");
  }

  window.pdfjsLib.GlobalWorkerOptions.workerSrc = PDFJS_WORKER_URL;
  const pdfData = await file.arrayBuffer();
  const loadingTask = window.pdfjsLib.getDocument({ data: pdfData });
  const pdf = await loadingTask.promise;

  let texto = "";
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    texto += reconstruirTextoPdf(content.items) + "\n";
  }

  return texto;
}

// Regex calibrados e testados contra uma fatura real (Enel Ceará, modelo
// "Documento Auxiliar da Nota Fiscal de Energia Elétrica Eletrônica" —
// Ajuste Sinief 01/2019/CONFAZ). Cada um busca uma âncora textual curta e
// captura só os números logo em seguida — tolerante a lixo que o pdf.js às
// vezes concatena na mesma linha reconstruída (QR code, colunas vizinhas
// na mesma altura). Espelha 1:1 os mesmos padrões usados no backend
// (app/services/fatura_parser_service.py), que é quem processa o arquivo
// se essa extração local falhar ou não rodar (ex.: navegador sem PDF.js).
function parseDadosFaturaTexto(texto, concessionaria) {
  const dados = {};
  let m;

  m = texto.match(/\d{2}\/\d{2}\/\d{4}\s+(\d{1,2})\/(\d{4})\s+(\d{2}\/\d{2}\/\d{4})/);
  if (m) {
    dados.mes = Number(m[1]);
    dados.ano = Number(m[2]);
    dados.vencimento = m[3];
    dados.referencia = `${String(m[1]).padStart(2, "0")}/${m[2]}`;
  }

  m = texto.match(/(\d{5,10})\s*\/\s*(\d{5,10})\s+R\$\s*([\d.,]+)/);
  if (m) {
    dados.uc = m[1];
    dados.codigo_cliente = m[2];
    dados.valor_total = normalizarNumero(m[3]);
  }

  m = texto.match(/Band\.\s*Tarif\.:\s*(\w+)/);
  if (m) dados.bandeira = m[1];

  m = texto.match(/\b(MONOF[ÁA]SICO|BIF[ÁA]SICO|TRIF[ÁA]SICO)\b/i);
  if (m) dados.tipo_fornecimento = m[1].toUpperCase();

  m = texto.match(/(\d{2}\/\d{2}\/\d{4})\s+(\d{2}\/\d{2}\/\d{4})\s+(\d{1,3})\s+(\d{2}\/\d{2}\/\d{4})/);
  if (m) dados.proxima_leitura = m[4];

  m = texto.match(/CIP ILUM PUB PREF MUNICIPAL\s+([\d,]+)/);
  if (m) dados.cip = normalizarNumero(m[1]);

  m = texto.match(/Juros Morat[óo]rios\s+([\d,]+)/i);
  if (m) dados.juros = normalizarNumero(m[1]);

  m = texto.match(/Adicional Band\.\s*\w+\s+kWh\s+\d+\s+([\d,]+)\s+([\d,]+)/);
  if (m) {
    dados.tarifa_bandeira = normalizarNumero(m[1]);
    dados.valor_bandeira = normalizarNumero(m[2]);
  }

  m = texto.match(/Energia Ativa Fornecida TE\s+kWh\s+\d+\s+([\d,]+)\s+([\d,]+)/);
  if (m) {
    dados.tarifa_te = normalizarNumero(m[1]);
    dados.valor_te = normalizarNumero(m[2]);
  }

  m = texto.match(/Energia Ativa Fornecida TUSD\s+kWh\s+\d+\s+([\d,]+)\s+([\d,]+)/);
  if (m) {
    dados.tarifa_tusd = normalizarNumero(m[1]);
    dados.valor_tusd = normalizarNumero(m[2]);
  }

  m = texto.match(/Subtotal Faturamento\s+([\d,]+)/);
  if (m) dados.subtotal_faturamento = normalizarNumero(m[1]);

  m = texto.match(/Subtotal Outros\s+([\d,]+)/);
  if (m) dados.subtotal_outros = normalizarNumero(m[1]);

  m = texto.match(/PIS\/PASEP\s+[\d,]+\s+([\d,]+)\s+([\d,]+)/);
  if (m) {
    dados.aliquota_pis = normalizarNumero(m[1]);
    dados.valor_pis = normalizarNumero(m[2]);
  }

  m = texto.match(/COFINS\s+[\d,]+\s+([\d,]+)\s+([\d,]+)/);
  if (m) {
    dados.aliquota_cofins = normalizarNumero(m[1]);
    dados.valor_cofins = normalizarNumero(m[2]);
  }

  // "ICMS" às vezes sai quebrado em "I CMS" (glifo/kerning do PDF)
  m = texto.match(/I\s?CMS\s+[\d,]+\s+([\d,]+)\s+([\d,]+)/);
  if (m) {
    dados.aliquota_icms = normalizarNumero(m[1]);
    dados.valor_icms = normalizarNumero(m[2]);
  }

  m = texto.match(/[\w.\-]{5,20}\s+\S{1,10}\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.]+)\s+(\d{2}\/\d{2}\/\d{4})\s+([\d.]+)\s+[\d.]+\s+([\d.]+)\s+(\d{1,3})\b/);
  if (m) {
    dados.data_leitura_anterior = m[1];
    dados.leitura_anterior = normalizarNumero(m[2]);
    dados.data_leitura_atual = m[3];
    dados.leitura_atual = normalizarNumero(m[4]);
    dados.consumo_kwh = normalizarNumero(m[5]);
    dados.dias_faturados = Number(m[6]);
  }

  if (!dados.mes || !dados.ano || dados.valor_total == null || dados.consumo_kwh == null) {
    return null;
  }

  dados.valor_kwh = dados.consumo_kwh ? Number((dados.valor_total / dados.consumo_kwh).toFixed(4)) : 0;
  dados.concessionaria = concessionaria;

  return dados;
}

async function inicializarEnviarFatura() {
  const uploadArea = document.getElementById("upload-area");
  const fileInput = document.getElementById("file-input");
  const uploadTexto = document.getElementById("upload-texto");

  // Prevent default drag behaviors
  ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, preventDefaults, false);
  });

  function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
  }

  // Highlight drop area when item is dragged over it
  ['dragenter', 'dragover'].forEach(eventName => {
    uploadArea.addEventListener(eventName, highlight, false);
  });

  ['dragleave', 'drop'].forEach(eventName => {
    uploadArea.addEventListener(eventName, unhighlight, false);
  });

  function highlight(e) {
    uploadArea.classList.add('dragover');
  }

  function unhighlight(e) {
    uploadArea.classList.remove('dragover');
  }

  // Handle dropped files
  uploadArea.addEventListener('drop', handleDrop, false);

  function handleDrop(e) {
    let dt = e.dataTransfer;
    let files = dt.files;
    handleFiles(files);
  }

  // Handle file input change
  fileInput.addEventListener('change', function() {
    handleFiles(this.files);
  });

  function handleFiles(files) {
    if (files.length > 0) {
      arquivoSelecionado = files[0];
      uploadTexto.innerText = `Arquivo selecionado: ${arquivoSelecionado.name}`;
      uploadTexto.style.color = 'var(--primary)';
      uploadTexto.style.fontWeight = '600';
    }
  }

  // Handle button click
  document.getElementById("btn-analisar").addEventListener("click", async function() {
    if (!arquivoSelecionado) {
      mostrarToast("Selecione ou arraste um arquivo de fatura primeiro.", "aviso");
      return;
    }

    const concessionariaAtiva = document.querySelector(".card-concessionaria.ativo");
    const concessionariaNome = concessionariaAtiva ? concessionariaAtiva.querySelector(".label-md").innerText : "Desconhecida";
    const isPdf = arquivoSelecionado.type === "application/pdf" || arquivoSelecionado.name.toLowerCase().endsWith('.pdf');
    const formData = new FormData();
    formData.append("arquivo", arquivoSelecionado);
    formData.append("concessionaria", concessionariaNome);

    abrirModalProgressoFatura();

    if (isPdf) {
      atualizarEtapaEnvioFatura("Lendo o PDF localmente...");
      try {
        const texto = await extrairTextoPdf(arquivoSelecionado);
        const dadosExtraidos = parseDadosFaturaTexto(texto, concessionariaNome);
        if (dadosExtraidos) {
          formData.append("parsed_payload", JSON.stringify(dadosExtraidos));
        }
      } catch (erro) {
        console.warn("Falha na extração PDF local:", erro);
      }
    }

    // Cancelado enquanto a extração local rodava (ela mesma não é
    // interrompível) — não segue pro upload.
    if (canceladoEnvioFatura) return;

    controladorEnvioFatura = new AbortController();
    atualizarEtapaEnvioFatura("Enviando para o servidor...");

    try {
      const token = localStorage.getItem("token");
      const headers = {};
      if (token) headers["Authorization"] = `Bearer ${token}`;

      let resposta;
      try {
        resposta = await fetch(`${API_BASE}/faturas/upload`, {
          method: "POST",
          headers: headers,
          body: formData,
          signal: controladorEnvioFatura.signal,
        });
        if (typeof esconderBannerOffline === "function") esconderBannerOffline();
      } catch (rede) {
        if (rede.name === "AbortError") return; // cancelarEnvioFatura() já tratou a UI

        if (typeof mostrarBannerOffline === "function") mostrarBannerOffline();
        fecharModal("modal-progresso-fatura");

        localStorage.removeItem("token");
        if (!location.pathname.endsWith("login")) {
          location.href = "login";
        }

        throw new Error("Não foi possível conectar ao servidor. Verifique sua conexão.");
      }

      atualizarEtapaEnvioFatura("Analisando dados da fatura...");
      const dados = await resposta.json();
      if (canceladoEnvioFatura) return;

      if (!resposta.ok) {
        throw new Error(dados.detail?.mensagem || dados.detail || "Erro ao processar fatura.");
      }

      mostrarSucessoEnvioFatura();
      setTimeout(() => {
        fecharModal("modal-progresso-fatura");
        window.location.href = "historico";
      }, 1200);

    } catch (e) {
      if (!canceladoEnvioFatura) {
        fecharModal("modal-progresso-fatura");
        mostrarToast(e.message, "erro");
      }
    } finally {
      controladorEnvioFatura = null;
    }
  });
}

function selecionarConcessionaria(nome) {
  document.getElementById("btn-enel").classList.remove("ativo");
  document.getElementById("btn-equatorial").classList.remove("ativo");
  document.getElementById(`btn-${nome}`).classList.add("ativo");
}
