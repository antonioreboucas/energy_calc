function inicializarCadastro() {
  document.getElementById("form-cadastro").addEventListener("submit", fazerCadastro);
  inicializarGoogleSignIn("google-signin-container");
}

async function fazerCadastro(evento) {
  evento.preventDefault();
  const nome = document.getElementById("nome").value;
  const email = document.getElementById("email").value;
  const senha = document.getElementById("senha").value;

  await comCarregamento(document.getElementById("btn-cadastrar"), "Criando conta...", async () => {
    try {
      const resultado = await apiPost("/auth/register", { nome, email, password: senha });
      salvarToken(resultado.access_token);
      mostrarToast("Conta criada! Verifique seu e-mail para confirmar.");
      setTimeout(() => {
        location.href = "dashboard";
      }, 1200);
    } catch (erro) {
      mostrarToast(erro.message, "erro");
    }
  });
}
