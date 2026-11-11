
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

// ==========================================
// RECORRÊNCIA MENSAL
// ==========================================

export function competenciaAtual() {
  return hojeLocal().slice(0, 7);
}

export function competenciaDeData(data) {
  return String(data || "").slice(0, 7);
}

export function avancarCompetencia(competencia) {
  const [ano, mes] = competencia.split("-").map(Number);
  const d = new Date(ano, mes, 1, 12);

  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

export function vencimentoCompetencia(competencia, diaVencimento) {
  const [ano, mes] = competencia.split("-").map(Number);
  const ultimoDia = new Date(ano, mes, 0).getDate();

  const dia = Math.min(
    Math.max(Number(diaVencimento) || 1, 1),
    ultimoDia
  );

  return `${competencia}-${String(dia).padStart(2, "0")}`;
}

export function idCobrancaRecorrente(planoId, competencia) {
  return `mens_${planoId}_${competencia}`;
}

export function cobrancasVisiveis(registros, ate = competenciaAtual()) {
  const reais = registros.filter(r =>
    r.registroTipo !== "recorrencia" &&
    r.registroTipo !== "indiceRecorrencia"
  );

  const planos = registros.filter(r =>
    r.registroTipo === "recorrencia"
  );

  const porId = new Map(reais.map(r => [r.id, r]));

  const limite = competenciaAtual();
  const teto = ate < limite ? ate : limite;

  for (const plano of planos) {
    if (!plano.primeiraData || !plano.id) continue;

    const inicial = competenciaDeData(plano.primeiraData);

    const encerramento =
      plano.encerramentoCompetencia ||
      (plano.ativo === false ? "0000-00" : teto);

    const final = encerramento < teto ? encerramento : teto;

    if (inicial > final) continue;

    let competencia = inicial;

    // Limite defensivo de 600 meses.
    for (
      let i = 0;
      i < 600 && competencia <= final;
      i++
    ) {
      const id = idCobrancaRecorrente(plano.id, competencia);

      if (!porId.has(id)) {
        porId.set(id, {
          id,
          registroTipo: "cobrancaRecorrente",
          virtual: true,
          planoRecorrenteId: plano.id,
          competencia,
          personalId: plano.personalId,
          alunoId: plano.alunoId,
          alunoNome: plano.alunoNome,
          nomePlano: plano.nomePlano,
          valorPlano: plano.valorPlano,
          vencimento: vencimentoCompetencia(
            competencia,
            plano.diaVencimento
          ),
          status: "pendente"
        });
      }

      competencia = avancarCompetencia(competencia);
    }
  }

  return [...porId.values()].filter(r =>
    !r.vencimento ||
    competenciaDeData(r.vencimento) <= teto
  );
}
