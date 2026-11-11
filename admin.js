
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  doc,
  getDoc,
  getDocs,
  query,
  where,
  onSnapshot,
  setDoc,
  updateDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  PLANOS,
  hojeLocal,
  adicionarDias,
  diasRestantes,
  statusAssinatura,
  textoAssinatura,
  formatarData
} from "./assinaturas-comum.js";

// ==========================================
// CONFIGURAÇÃO DO ADMINISTRADOR
// ==========================================

// Substitua pelo UID da sua conta no Firebase Authentication.
// Essa verificação controla a interface, não protege o banco.
const ADMIN_UID = "UFf18ucxwNU7Q4yoWTWWiPsJWkW2";

// ==========================================
// ELEMENTOS E ESTADO
// ==========================================

const $ = id => document.getElementById(id);

let usuarioAdmin = null;
let personais = [];
let assinaturas = new Map();
let pagamentos = [];
let personalSelecionadoId = null;

let configuracao = {
  diasTeste: 7,
  diasMensal: 30,
  diasAnual: 365,
  valorMensal: 0,
  valorAnual: 0
};

let cancelarPersonais = null;
let cancelarAssinaturas = null;
let cancelarPagamentos = null;
let cancelarConfiguracao = null;

const moeda = valor =>
  Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });

function elemento(tag, texto = "", classe = "") {
  const el = document.createElement(tag);
  el.textContent = String(texto);
  if (classe) el.className = classe;
  return el;
}

function informarErro(erro) {
  console.error(erro);
  alert(erro.message || "Não foi possível concluir a operação.");
}

function obterPersonal(id) {
  return personais.find(p => p.id === id);
}

function dadosAssinatura(id) {
  return assinaturas.get(id) || null;
}

function duracaoPlano(plano) {
  const dias = {
    teste: configuracao.diasTeste,
    mensal: configuracao.diasMensal,
    anual: configuracao.diasAnual
  }[plano];

  if (!Number.isInteger(Number(dias)) || Number(dias) <= 0) {
    throw new Error("Configure a duração do plano.");
  }

  return Number(dias);
}

function valorPlano(plano) {
  if (plano === "teste") return 0;

  return Number(
    plano === "mensal"
      ? configuracao.valorMensal
      : configuracao.valorAnual
  );
}

// ==========================================
// AUTENTICAÇÃO DO ADMIN
// ==========================================

onAuthStateChanged(auth, async usuario => {
  encerrarEscutas();

  $("painelAdmin").hidden = true;
  $("telaVerificacao").hidden = false;

  if (!usuario) {
    negarAcesso("Entre com sua conta para continuar.");
    return;
  }

  if (
    ADMIN_UID === "COLE_AQUI_SEU_UID" ||
    usuario.uid !== ADMIN_UID
  ) {
    negarAcesso("Esta conta não possui acesso administrativo.");
    return;
  }

  try {
    const perfil = await getDoc(
      doc(db, "usuarios", usuario.uid)
    );

    if (!perfil.exists()) {
      negarAcesso("Perfil administrativo não encontrado.");
      return;
    }

    usuarioAdmin = usuario;

    $("telaVerificacao").hidden = true;
    $("painelAdmin").hidden = false;

    iniciarPainel();

  } catch (erro) {
    console.error(erro);
    negarAcesso("Não foi possível verificar sua conta.");
  }
});

function negarAcesso(mensagem) {
  usuarioAdmin = null;
  $("mensagemVerificacao").textContent = mensagem;
  $("btnVoltarLogin").hidden = false;
}

$("btnVoltarLogin").onclick = () => {
  location.href = "index.html";
};

$("btnSair").onclick = async () => {
  encerrarEscutas();
  await signOut(auth);
  location.href = "index.html";
};

function encerrarEscutas() {
  [
    cancelarPersonais,
    cancelarAssinaturas,
    cancelarPagamentos,
    cancelarConfiguracao
  ].forEach(cancelar => {
    if (cancelar) cancelar();
  });

  cancelarPersonais = null;
  cancelarAssinaturas = null;
  cancelarPagamentos = null;
  cancelarConfiguracao = null;
}

// ==========================================
// INICIALIZAÇÃO
// ==========================================

function iniciarPainel() {
  observarConfiguracao();
  observarPersonais();
  observarAssinaturas();
  observarPagamentos();

  $("dataInicioAssinatura").value = hojeLocal();
}

// ==========================================
// CONFIGURAÇÃO DOS PLANOS
// ==========================================

function observarConfiguracao() {
  const ref = doc(db, "configuracoes", "planos");

  cancelarConfiguracao = onSnapshot(ref, snapshot => {
    if (snapshot.exists()) {
      configuracao = {
        ...configuracao,
        ...snapshot.data()
      };
    }

    $("diasTeste").value = configuracao.diasTeste;
    $("diasMensal").value = configuracao.diasMensal;
    $("diasAnual").value = configuracao.diasAnual;
    $("valorMensal").value = configuracao.valorMensal;
    $("valorAnual").value = configuracao.valorAnual;

    if (personalSelecionadoId) {
      atualizarFormularioPlano();
    }

  }, erro => console.error("Configurações:", erro));
}

$("formPlanos").addEventListener("submit", async e => {
  e.preventDefault();

  const botao = $("btnSalvarPlanos");
  botao.disabled = true;

  try {
    const dados = {
      diasTeste: Number($("diasTeste").value),
      diasMensal: Number($("diasMensal").value),
      diasAnual: Number($("diasAnual").value),
      valorMensal: Number($("valorMensal").value),
      valorAnual: Number($("valorAnual").value)
    };

    if (
      ![dados.diasTeste, dados.diasMensal, dados.diasAnual]
        .every(v => Number.isInteger(v) && v > 0)
    ) {
      throw new Error("Informe durações válidas.");
    }

    if (
      ![dados.valorMensal, dados.valorAnual]
        .every(v => Number.isFinite(v) && v >= 0)
    ) {
      throw new Error("Informe valores válidos.");
    }

    await setDoc(
      doc(db, "configuracoes", "planos"),
      {
        ...dados,
        atualizadoEm: serverTimestamp()
      },
      { merge: true }
    );

    configuracao = dados;
    alert("Configurações dos planos salvas!");

  } catch (erro) {
    informarErro(erro);
  } finally {
    botao.disabled = false;
  }
});

// ==========================================
// CARREGAMENTO DOS PERSONAIS
// ==========================================

function observarPersonais() {
  const consulta = query(
    collection(db, "usuarios"),
    where("tipo", "==", "personal")
  );

  cancelarPersonais = onSnapshot(consulta, snapshot => {
    personais = snapshot.docs.map(d => ({
      id: d.id,
      ...d.data()
    }));

    personais.sort((a, b) =>
      (a.nome || "").localeCompare(b.nome || "")
    );

    atualizarPainel();

  }, erro => {
    console.error(erro);
    $("listaPersonais").textContent =
      "Não foi possível carregar os personais.";
  });
}

// ==========================================
// CARREGAMENTO DAS ASSINATURAS
// ==========================================

function observarAssinaturas() {
  cancelarAssinaturas = onSnapshot(
    collection(db, "assinaturas"),
    snapshot => {
      assinaturas = new Map(
        snapshot.docs.map(d => [d.id, d.data()])
      );

      atualizarPainel();
    },
    erro => console.error("Assinaturas:", erro)
  );
}

// ==========================================
// CARREGAMENTO DOS PAGAMENTOS
// ==========================================

function observarPagamentos() {
  cancelarPagamentos = onSnapshot(
    collection(db, "pagamentosAssinaturas"),
    snapshot => {
      pagamentos = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      atualizarFinanceiro();
      renderizarPagamentos();
    },
    erro => console.error("Pagamentos:", erro)
  );
}

// ==========================================
// INDICADORES GERAIS
// ==========================================

function atualizarPainel() {
  let ativos = 0;
  let testes = 0;
  let vencidos = 0;

  personais.forEach(personal => {
    const status = statusAssinatura(
      dadosAssinatura(personal.id)
    );

    if (["ativo", "liberado"].includes(status)) {
      ativos++;
    }

    if (status === "teste") {
      testes++;
    }

    if (["vencido", "bloqueado"].includes(status)) {
      vencidos++;
    }
  });

  $("totalPersonais").textContent = personais.length;
  $("totalAtivos").textContent = ativos;
  $("totalTestes").textContent = testes;
  $("totalVencidos").textContent = vencidos;

  renderizarPersonais();
}

// ==========================================
// LISTA E FILTROS DE PERSONAIS
// ==========================================

$("buscaPersonal").addEventListener(
  "input",
  renderizarPersonais
);

$("filtroStatus").addEventListener(
  "change",
  renderizarPersonais
);

function renderizarPersonais() {
  const lista = $("listaPersonais");
  lista.replaceChildren();

  const busca = $("buscaPersonal").value
    .toLocaleLowerCase("pt-BR")
    .trim();

  const filtro = $("filtroStatus").value;

  const filtrados = personais.filter(p => {
    const status = statusAssinatura(
      dadosAssinatura(p.id)
    );

    const texto = `${p.nome || ""} ${p.email || ""}`
      .toLocaleLowerCase("pt-BR");

    return texto.includes(busca) &&
      (filtro === "todos" || filtro === status);
  });

  if (!filtrados.length) {
    lista.appendChild(
      elemento("p", "Nenhum personal encontrado.")
    );
    return;
  }

  filtrados.forEach(personal => {
    const assinatura = dadosAssinatura(personal.id);
    const status = statusAssinatura(assinatura);

    const card = elemento("article", "", "admin-personal");

    card.appendChild(
      elemento("h3", personal.nome || "Personal sem nome")
    );

    card.appendChild(
      elemento("p", personal.email || "E-mail não informado")
    );

    const etiqueta = elemento(
      "span",
      textoAssinatura(status),
      `assinatura-status ${status}`
    );

    card.appendChild(etiqueta);

    if (assinatura) {
      card.appendChild(
        elemento(
          "p",
          `Plano: ${PLANOS[assinatura.plano]?.nome ||
            assinatura.plano || "Personalizado"}`
        )
      );

      card.appendChild(
        elemento(
          "p",
          `Vencimento: ${formatarData(assinatura.vencimento)}`
        )
      );

      card.appendChild(
        elemento(
          "p",
          `Dias restantes: ${diasRestantes(
            assinatura.vencimento
          )}`
        )
      );
    }

    const botao = elemento(
      "button",
      "Gerenciar assinatura"
    );

    botao.type = "button";
    botao.onclick = () => selecionarPersonal(personal.id);

    card.appendChild(botao);
    lista.appendChild(card);
  });
}

// ==========================================
// SELECIONAR PERSONAL
// ==========================================

function selecionarPersonal(id) {
  const personal = obterPersonal(id);

  if (!personal) return;

  personalSelecionadoId = id;

  $("personalIdSelecionado").value = id;

  $("personalSelecionado").textContent =
    `${personal.nome || "Personal"} — ${personal.email || ""}`;

  const assinatura = dadosAssinatura(id);

  $("planoSelecionado").value =
    assinatura?.plano || "teste";

  $("dataInicioAssinatura").value =
    assinatura?.inicio || hojeLocal();

  $("dataVencimentoAssinatura").value =
    assinatura?.vencimento ||
    adicionarDias(
      hojeLocal(),
      duracaoPlano($("planoSelecionado").value)
    );

  $("valorCobrado").value =
    assinatura?.valorCobrado ??
    valorPlano($("planoSelecionado").value);

  $("situacaoPagamento").value =
    assinatura?.statusPagamento || "pendente";

  if (!assinatura) {
    $("situacaoPagamento").value = "isento";
  }

  $("secaoAssinatura").hidden = false;

  $("secaoAssinatura").scrollIntoView({
    behavior: "smooth",
    block: "start"
  });
}

// ==========================================
// MUDANÇA DE PLANO E DATAS
// ==========================================

function atualizarFormularioPlano() {
  if (!personalSelecionadoId) return;

  const plano = $("planoSelecionado").value;
  const inicio = $("dataInicioAssinatura").value;

  if (!inicio) return;

  $("dataVencimentoAssinatura").value =
    adicionarDias(inicio, duracaoPlano(plano));

  $("valorCobrado").value = valorPlano(plano);

  $("situacaoPagamento").value =
    plano === "teste" ? "isento" : "pendente";
}

$("planoSelecionado").addEventListener(
  "change",
  atualizarFormularioPlano
);

$("dataInicioAssinatura").addEventListener(
  "change",
  atualizarFormularioPlano
);

// ==========================================
// SALVAR ASSINATURA
// ==========================================

$("formAssinatura").addEventListener("submit", async e => {
  e.preventDefault();

  if (!personalSelecionadoId) return;

  const botao = $("btnSalvarAssinatura");
  botao.disabled = true;

  try {
    const plano = $("planoSelecionado").value;
    const inicio = $("dataInicioAssinatura").value;
    const vencimento = $("dataVencimentoAssinatura").value;
    const valor = Number($("valorCobrado").value);
    const pagamento = $("situacaoPagamento").value;

    if (!PLANOS[plano]) {
      throw new Error("Selecione um plano válido.");
    }

    if (!inicio || !vencimento || vencimento <= inicio) {
      throw new Error("Verifique as datas da assinatura.");
    }

    if (!Number.isFinite(valor) || valor < 0) {
      throw new Error("Valor inválido.");
    }

    if (!["pendente", "pago", "isento"].includes(pagamento)) {
      throw new Error("Situação de pagamento inválida.");
    }

    if (plano === "teste" && pagamento === "pago") {
      throw new Error("O teste gratuito não gera pagamento.");
    }

    if (pagamento === "pago" && valor <= 0) {
      throw new Error("Informe o valor do pagamento.");
    }

    const personalId = personalSelecionadoId;
    const personal = obterPersonal(personalId);

    const referencia = doc(
      db,
      "assinaturas",
      personalId
    );

    // Identificador único do pagamento deste período.
    const pagamentoId =
      `${personalId}_${inicio}_${vencimento}`;

    const refPagamento = doc(
      db,
      "pagamentosAssinaturas",
      pagamentoId
    );

    await runTransaction(db, async transacao => {
      const assinaturaAnterior = await transacao.get(
        referencia
      );

      let registroPagamento = null;

      if (pagamento === "pago") {
        registroPagamento = await transacao.get(
          refPagamento
        );
      }

      const anterior = assinaturaAnterior.exists()
        ? assinaturaAnterior.data()
        : {};

      transacao.set(referencia, {
        personalId,
        plano,
        inicio,
        vencimento,
        valorCobrado: valor,
        statusPagamento: pagamento,

        // Preserva bloqueios e liberações existentes.
        bloqueadoManualmente:
          anterior.bloqueadoManualmente === true,

        liberadoManualmente:
          anterior.liberadoManualmente === true,

        atualizadoEm: serverTimestamp()
      }, { merge: true });

      // Registra receita apenas uma vez por período.
      if (
        pagamento === "pago" &&
        !registroPagamento.exists()
      ) {
        transacao.set(refPagamento, {
          personalId,
          personalNome: personal?.nome || "Personal",
          plano,
          inicio,
          vencimento,
          valor,
          recebidoEm: serverTimestamp(),
          registradoPor: usuarioAdmin.uid
        });
      }
    });

    alert("Assinatura salva com sucesso!");
    $("secaoAssinatura").hidden = true;
    personalSelecionadoId = null;

  } catch (erro) {
    informarErro(erro);
  } finally {
    botao.disabled = false;
  }
});

// ==========================================
// RENOVAR ASSINATURA
// ==========================================

$("btnRenovar").onclick = async () => {
  if (!personalSelecionadoId) return;

  const id = personalSelecionadoId;
  const assinatura = dadosAssinatura(id);

  if (!assinatura) {
    alert("Cadastre primeiro uma assinatura.");
    return;
  }

  const dias = duracaoPlano(assinatura.plano);
  const hoje = hojeLocal();

  const inicio = assinatura.vencimento > hoje
    ? assinatura.vencimento
    : hoje;

  const vencimento = adicionarDias(inicio, dias);

  if (!confirm(
    `Renovar a assinatura até ${formatarData(vencimento)}?`
  )) return;

  try {
    await updateDoc(doc(db, "assinaturas", id), {
      inicio,
      vencimento,
      valorCobrado: valorPlano(assinatura.plano),
      statusPagamento:
        assinatura.plano === "teste"
          ? "isento"
          : "pendente",
      bloqueadoManualmente: false,
      liberadoManualmente: false,
      atualizadoEm: serverTimestamp()
    });

    alert("Assinatura renovada! Pagamento pendente.");

    selecionarPersonal(id);

  } catch (erro) {
    informarErro(erro);
  }
};

// ==========================================
// LIBERAR ACESSO
// ==========================================

$("btnLiberar").onclick = async () => {
  if (!personalSelecionadoId) return;

  const id = personalSelecionadoId;

  if (!confirm("Liberar manualmente o acesso deste personal?")) {
    return;
  }

  try {
    await setDoc(doc(db, "assinaturas", id), {
      personalId: id,
      liberadoManualmente: true,
      bloqueadoManualmente: false,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    alert("Acesso liberado!");

  } catch (erro) {
    informarErro(erro);
  }
};

// ==========================================
// BLOQUEAR ACESSO
// ==========================================

$("btnBloquear").onclick = async () => {
  if (!personalSelecionadoId) return;

  const id = personalSelecionadoId;

  if (!confirm("Bloquear o acesso deste personal?")) {
    return;
  }

  try {
    await setDoc(doc(db, "assinaturas", id), {
      personalId: id,
      bloqueadoManualmente: true,
      liberadoManualmente: false,
      atualizadoEm: serverTimestamp()
    }, { merge: true });

    alert("Personal bloqueado!");

  } catch (erro) {
    informarErro(erro);
  }
};

// ==========================================
// FECHAR EDIÇÃO
// ==========================================

$("btnCancelarSelecao").onclick = () => {
  personalSelecionadoId = null;
  $("personalIdSelecionado").value = "";
  $("secaoAssinatura").hidden = true;
};

// ==========================================
// RESUMO FINANCEIRO
// ==========================================

function atualizarFinanceiro() {
  const hoje = hojeLocal();
  const mesAtual = hoje.slice(0, 7);

  let total = 0;
  let recebidoMes = 0;

  pagamentos.forEach(p => {
    const valor = Number(p.valor) || 0;

    total += valor;

    let dataPagamento = null;

    if (p.recebidoEm?.toDate) {
      dataPagamento = p.recebidoEm.toDate();
    }

    if (dataPagamento) {
      const ano = dataPagamento.getFullYear();
      const mes = String(
        dataPagamento.getMonth() + 1
      ).padStart(2, "0");

      if (`${ano}-${mes}` === mesAtual) {
        recebidoMes += valor;
      }
    }
  });

  $("recebidoTotal").textContent = moeda(total);
  $("recebidoMes").textContent = moeda(recebidoMes);
}

// ==========================================
// HISTÓRICO FINANCEIRO
// ==========================================

function renderizarPagamentos() {
  const lista = $("listaPagamentos");
  lista.replaceChildren();

  if (!pagamentos.length) {
    lista.appendChild(
      elemento("p", "Nenhum pagamento registrado.")
    );
    return;
  }

  const ordenados = [...pagamentos].sort((a, b) => {
    const dataA = a.recebidoEm?.toMillis?.() || 0;
    const dataB = b.recebidoEm?.toMillis?.() || 0;

    return dataB - dataA;
  });

  ordenados.forEach(p => {
    const card = elemento("article", "", "admin-pagamento");

    const personal = obterPersonal(p.personalId);

    card.appendChild(
      elemento(
        "h3",
        personal?.nome || p.personalNome || "Personal"
      )
    );

    card.appendChild(
      elemento(
        "p",
        `Plano: ${PLANOS[p.plano]?.nome || p.plano}`
      )
    );

    card.appendChild(
      elemento(
        "p",
        `Valor recebido: ${moeda(p.valor)}`
      )
    );

    card.appendChild(
      elemento(
        "p",
        `Período: ${formatarData(p.inicio)} até ${
          formatarData(p.vencimento)
        }`
      )
    );

    if (p.recebidoEm?.toDate) {
      card.appendChild(
        elemento(
          "p",
          `Recebido em: ${
            p.recebidoEm.toDate().toLocaleDateString("pt-BR")
          }`
        )
      );
    }

    lista.appendChild(card);
  });
}

// ==========================================
// ATUALIZAÇÃO AO RETORNAR À ABA
// ==========================================

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && usuarioAdmin) {
    atualizarPainel();
    atualizarFinanceiro();
  }
});

// ==========================================
// ENCERRAMENTO
// ==========================================

window.addEventListener("pagehide", encerrarEscutas);
