// Wrapper fino de fetch pra API FastAPI do EnergyCalc.
// API_BASE vem de js/config.js (carregado antes deste arquivo).

class ApiError extends Error {
  constructor(status, mensagem, erro) {
    super(mensagem);
    this.status = status;
    this.erro = erro; // "limite_free" | "upgrade_necessario" | undefined
  }
}

async function apiRequest(metodo, caminho, corpo) {
  const headers = { "Content-Type": "application/json" };
  const token = localStorage.getItem("token");
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let resposta;
  try {
    resposta = await fetch(`${API_BASE}${caminho}`, {
      method: metodo,
      headers,
      body: corpo !== undefined ? JSON.stringify(corpo) : undefined,
    });
    // Se a requisição passou do fetch, o servidor está alcançável.
    if (typeof esconderBannerOffline === "function") esconderBannerOffline();
  } catch (falhaDeRede) {
    if (typeof mostrarBannerOffline === "function") mostrarBannerOffline();
    
    localStorage.removeItem("token");
    if (!location.pathname.endsWith("login")) {
      location.href = "login";
    }
    
    throw new ApiError(0, "Não foi possível conectar ao servidor. Verifique sua conexão.");
  }

  if (resposta.status === 401) {
    localStorage.removeItem("token");
    if (!location.pathname.endsWith("login")) {
      location.href = "login";
    }
    throw new ApiError(401, "Sessão expirada. Faça login novamente.");
  }

  if (resposta.status === 204) return null;

  const dados = await resposta.json().catch(() => null);

  if (!resposta.ok) {
    const detalhe = dados && dados.detail;
    if (detalhe && typeof detalhe === "object") {
      throw new ApiError(resposta.status, detalhe.mensagem || "Erro inesperado.", detalhe.erro);
    }
    throw new ApiError(resposta.status, (typeof detalhe === "string" && detalhe) || "Erro inesperado.");
  }

  return dados;
}

const apiGet = (caminho) => apiRequest("GET", caminho);
const apiPost = (caminho, corpo) => apiRequest("POST", caminho, corpo ?? {});
const apiPut = (caminho, corpo) => apiRequest("PUT", caminho, corpo ?? {});
const apiDelete = (caminho) => apiRequest("DELETE", caminho);
