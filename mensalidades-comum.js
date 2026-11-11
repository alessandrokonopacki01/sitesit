
export function moeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

export function dataBR(data) {
  if (!data) return "Não informada";

  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

export function hojeLocal() {
  const agora = new Date();
  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

export function statusAtual(m) {
  if (m.status === "pago") return "pago";
  if (m.vencimento && m.vencimento < hojeLocal()) {
    return "atrasado";
  }
  return "pendente";
}

export function textoStatus(status) {
  return {
    pago: "Pago",
    pendente: "Pendente",
    atrasado: "Atrasado"
  }[status] || status;
}

export function elemento(tag, texto, classe = "") {
  const el = document.createElement(tag);
  el.textContent = texto == null ? "" : String(texto);
  if (classe) el.className = classe;
  return el;
}

export function criarBotao(texto, executar, classe = "") {
  const btn = elemento("button", texto, classe);
  btn.type = "button";

  btn.addEventListener("click", async () => {
    btn.disabled = true;

    try {
      await executar();
    } catch (erro) {
      console.error(erro);
      alert(erro.message || "Não foi possível concluir a ação.");
    } finally {
      btn.disabled = false;
    }
  });

  return btn;
}

export function criarCartao(m, mostrarAluno = false) {
  const status = statusAtual(m);
  const card = elemento("article", "", "mens-item");

  if (mostrarAluno) {
    card.appendChild(elemento("strong", m.alunoNome || "Aluno"));
  }

  card.appendChild(elemento("h3", m.nomePlano || "Mensalidade"));
  card.appendChild(elemento("p", `Valor: ${moeda(m.valorPlano)}`));
  card.appendChild(elemento("p", `Vencimento: ${dataBR(m.vencimento)}`));

  const etiqueta = elemento(
    "span",
    textoStatus(status),
    `mens-status ${status}`
  );

  card.appendChild(etiqueta);

  if (status === "pago" && m.pagoEm) {
    let dataPagamento = "";

    if (typeof m.pagoEm.toDate === "function") {
      dataPagamento = m.pagoEm.toDate().toLocaleDateString("pt-BR");
    } else if (typeof m.pagoEm === "string") {
      dataPagamento = dataBR(m.pagoEm.slice(0, 10));
    }

    if (dataPagamento) {
      card.appendChild(
        elemento("p", `Pagamento registrado: ${dataPagamento}`)
      );
    }
  }

  return card;
}

export function ordenar(a, b) {
  return (b.vencimento || "").localeCompare(a.vencimento || "");
}
