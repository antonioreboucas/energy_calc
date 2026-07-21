// Guarda de rota + leitura do payload do JWT no cliente — só pra UI
// (esconder/mostrar botão, mostrar nome/role). A validação de verdade do
// token é sempre feita pelo backend em cada request (ver api.js).

function base64UrlDecode(str) {
  const base64 = str.replace(/-/g, "+").replace(/_/g, "/");
  const pad = base64.length % 4 === 0 ? "" : "=".repeat(4 - (base64.length % 4));
  return decodeURIComponent(
    atob(base64 + pad)
      .split("")
      .map((c) => "%" + c.charCodeAt(0).toString(16).padStart(2, "0"))
      .join("")
  );
}

function getUsuarioAtual() {
  const token = localStorage.getItem("token");
  if (!token) return null;
  try {
    const payload = JSON.parse(base64UrlDecode(token.split(".")[1]));
    return payload;
  } catch (e) {
    return null;
  }
}

function estaLogado() {
  return !!localStorage.getItem("token");
}

function exigirLogin() {
  if (!estaLogado()) {
    location.href = "login";
  }
}

function salvarToken(token) {
  localStorage.setItem("token", token);
}

function logout() {
  localStorage.removeItem("token");
  location.href = "login";
}

// Login com Google — preencha com o Client ID real quando
// backend/.env's GOOGLE_CLIENT_ID estiver configurado. Vazio = o botão
// continua visível (fidelidade ao design), mas avisa que ainda não está
// configurado em vez de abrir o fluxo de verdade — POST /auth/google
// responderia 503 de qualquer forma sem essa config no backend.
const GOOGLE_CLIENT_ID = "";

const ICONE_GOOGLE = `<svg width="18" height="18" viewBox="0 0 48 48"><path fill="#FFC107" d="M43.6 20.5H42V20H24v8h11.3C33.7 32.7 29.3 36 24 36c-6.6 0-12-5.4-12-12s5.4-12 12-12c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.5 29.6 4.5 24 4.5 12.7 4.5 3.5 13.7 3.5 25S12.7 45.5 24 45.5 44.5 36.3 44.5 25c0-1.5-.2-3-.9-4.5z"/><path fill="#FF3D00" d="M6.3 14.7l6.6 4.8C14.6 15.9 18.9 13 24 13c3.1 0 5.9 1.2 8 3.1l5.7-5.7C34.6 6.5 29.6 4.5 24 4.5c-7.6 0-14.1 4.3-17.7 10.2z"/><path fill="#4CAF50" d="M24 45.5c5.5 0 10.4-1.9 14.3-5.1l-6.6-5.6C29.6 36.6 26.9 37.5 24 37.5c-5.3 0-9.7-3.3-11.3-8l-6.6 5.1C9.8 41.1 16.4 45.5 24 45.5z"/><path fill="#1976D2" d="M43.6 20.5H42V20H24v8h11.3c-.8 2.3-2.3 4.2-4.2 5.6l6.6 5.6C41.8 36 44.5 31 44.5 25c0-1.5-.2-3-.9-4.5z"/></svg>`;

function inicializarGoogleSignIn(idContainer) {
  const container = document.getElementById(idContainer);
  if (!container) return;

  if (!GOOGLE_CLIENT_ID) {
    container.innerHTML = `<button type="button" class="btn btn-google btn-block">${ICONE_GOOGLE} Conta Google</button>`;
    container.querySelector("button").addEventListener("click", () => {
      mostrarToast("Login com Google ainda não está configurado neste ambiente.", "erro");
    });
    return;
  }

  const script = document.createElement("script");
  script.src = "https://accounts.google.com/gsi/client";
  script.async = true;
  script.onload = () => {
    google.accounts.id.initialize({
      client_id: GOOGLE_CLIENT_ID,
      callback: aoReceberCredencialGoogle,
    });
    google.accounts.id.renderButton(container, { theme: "outline", size: "large", width: 320 });
  };
  document.head.appendChild(script);
}

async function aoReceberCredencialGoogle(resposta) {
  try {
    const resultado = await apiPost("/auth/google", { id_token: resposta.credential });
    salvarToken(resultado.access_token);
    location.href = "dashboard";
  } catch (erro) {
    mostrarToast(erro.message, "erro");
  }
}
