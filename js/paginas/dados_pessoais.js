function inicializarDadosPessoais() {
  const usuario = getUsuarioAtual();
  if (usuario) {
    document.getElementById("dp-nome").value = usuario.nome || "";
    document.getElementById("dp-email").value = usuario.email || "";
  }

  document.getElementById("form-dados-pessoais").addEventListener("submit", salvarDadosPessoais);
  document.getElementById("form-alterar-senha").addEventListener("submit", alterarSenha);
}

async function salvarDadosPessoais(evento) {
  evento.preventDefault();
  const emailAtual = getUsuarioAtual()?.email;
  const nome = document.getElementById("dp-nome").value.trim();
  const email = document.getElementById("dp-email").value.trim();
  const emailMudou = email !== emailAtual;

  await comCarregamento(document.getElementById("btn-salvar-dados"), "Salvando...", async () => {
    try {
      const resultado = await apiPut("/auth/me", { nome, email });
      salvarToken(resultado.access_token);
      mostrarToast(
        emailMudou
          ? "Dados atualizados! Verifique seu novo e-mail pra confirmar o endereço."
          : "Dados atualizados!"
      );
    } catch (erro) {
      tratarErroApi(erro);
    }
  });
}

async function alterarSenha(evento) {
  evento.preventDefault();
  const senhaAtual = document.getElementById("dp-senha-atual").value;
  const senhaNova = document.getElementById("dp-senha-nova").value;
  const senhaConfirmar = document.getElementById("dp-senha-confirmar").value;
  const erroEl = document.getElementById("dp-senha-erro");

  if (senhaNova !== senhaConfirmar) {
    erroEl.style.display = "block";
    return;
  }
  erroEl.style.display = "none";

  await comCarregamento(document.getElementById("btn-alterar-senha"), "Alterando...", async () => {
    try {
      await apiPost("/auth/alterar-senha", { senha_atual: senhaAtual, nova_senha: senhaNova });
      mostrarToast("Senha alterada com sucesso!");
      document.getElementById("form-alterar-senha").reset();
    } catch (erro) {
      tratarErroApi(erro);
    }
  });
}
