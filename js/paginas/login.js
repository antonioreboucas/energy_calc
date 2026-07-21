function inicializarLogin() {
  document.getElementById("form-login").addEventListener("submit", fazerLogin);
  inicializarGoogleSignIn("google-signin-container");
}

async function fazerLogin(evento) {
  evento.preventDefault();
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  await comCarregamento(document.getElementById("btn-entrar"), "Entrando...", async () => {
    try {
      const resultado = await apiPost("/auth/login", { email, password: senha });
      salvarToken(resultado.access_token);
      location.href = "dashboard";
    } catch (erro) {
      mostrarToast(erro.message, "erro");
    }
  });
}
