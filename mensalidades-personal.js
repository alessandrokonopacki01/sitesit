
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  moeda,
  statusAtual,
  criarCartao,
  criarBotao,
  elemento,
  ordenar,
  competenciaAtual,
  competenciaDeData,
  cobrancasVisiveis
} from "./mensalidades-comum.js";

// ==========================================
// CONFIGURAÇÕES E ESTADO
// ==========================================

const $ = id => document.getElementById(id);

let personalAtual = null;
let alunos = [];
let registros = [];

let editandoId = null;
let cancelarEscuta = null;
let cancelarEscutaAlunos = null;

let versaoAuth = 0;
let emOperacao = false;

// ==========================================
// NAVEGAÇÃO E FILTROS
// ==========================================

$("voltar").onclick = () => {
  location.href = "personal.html";
};

$("btnCancelarEdicao").onclick = limparFormulario;

$("filtroMensalidades").onchange = renderizar;
$("mesCobrancas").onchange = renderizar;
$("incluirAtrasadas").onchange = renderizar;

$("mesCobrancas").max = competenciaAtual();
$("mesCobrancas").value = competenciaAtual();

// ==========================================
// AUTENTICAÇÃO
// ==========================================

onAuthStateChanged(auth, async usuario => {
  const versao = ++versaoAuth;

  encerrarEscutas();

  personalAtual = null;
  alunos = [];
  registros = [];

  if (!usuario) {
    location.replace("index.html");
    return;
  }

  try {
    const perfil = await getDoc(
      doc(db, "usuarios", usuario.uid)
    );

    if (versao !== versaoAuth) return;

    if (
      !perfil.exists() ||
      perfil.data().tipo !== "personal"
    ) {
      location.replace("index.html");
      return;
    }

    personalAtual = usuario;

    observarAlunos();
    observarMensalidades();

  } catch (erro) {
    console.error(erro);

    alert(
      "Não foi possível carregar o sistema de mensalidades."
    );
  }
});

// ==========================================
// ALUNOS EM TEMPO REAL
// ==========================================

function observarAlunos() {
  const consulta = query(
    collection(db, "usuarios"),
    where("tipo", "==", "aluno"),
    where("personalId", "==", personalAtual.uid)
  );

  cancelarEscutaAlunos = onSnapshot(
    consulta,

    snapshot => {
      alunos = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })).sort((a, b) =>
        (a.nome || "").localeCompare(
          b.nome || "",
          "pt-BR"
        )
      );

      atualizarSeletoresAlunos();
    },

    erro => {
      console.error("Erro ao carregar alunos:", erro);
    }
  );
}

function atualizarSeletoresAlunos() {
  for (const id of [
    "alunoSelect",
    "alunoRecorrencia"
  ]) {
    const select = $(id);
    const anterior = select.value;

    select.replaceChildren(
      new Option("Selecione o aluno", "")
    );

    for (const aluno of alunos) {
      // Alunos cancelados não podem criar
      // novas recorrências.
      if (
        id === "alunoRecorrencia" &&
        aluno.matriculaCancelada === true
      ) {
        continue;
      }

      const nome = aluno.nome || "Aluno";

      select.add(
        new Option(
          aluno.matriculaCancelada === true
            ? `${nome} (matrícula cancelada)`
            : nome,
          aluno.id
        )
      );
    }

    if (
      [...select.options].some(
        opcao => opcao.value === anterior
      )
    ) {
      select.value = anterior;
    }
  }
}

// ==========================================
// MENSALIDADES EM TEMPO REAL
// ==========================================

function observarMensalidades() {
  const consulta = query(
    collection(db, "mensalidades"),
    where("personalId", "==", personalAtual.uid)
  );

  cancelarEscuta = onSnapshot(
    consulta,

    snapshot => {
      registros = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      renderizar();
    },

    erro => {
      console.error(erro);

      $("listaMensalidades").textContent =
        "Não foi possível carregar as mensalidades.";
    }
  );
}

// ==========================================
// IDENTIFICADOR DA RECORRÊNCIA
// ==========================================

function indicePlanoId(alunoId) {
  return (
    `indice_${personalAtual.uid}_${alunoId}`
  );
}

// ==========================================
// VALIDAÇÃO DE DATAS
// ==========================================

function dataValida(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || "")) {
    return false;
  }

  const [ano, mes, dia] = data
    .split("-")
    .map(Number);

  const teste = new Date(
    ano,
    mes - 1,
    dia,
    12
  );

  return (
    teste.getFullYear() === ano &&
    teste.getMonth() + 1 === mes &&
    teste.getDate() === dia
  );
}

// ==========================================
// CRIAR PLANO MENSAL RECORRENTE
// ==========================================

$("formRecorrencia").addEventListener(
  "submit",
  async evento => {
    evento.preventDefault();

    if (!personalAtual || emOperacao) return;

    const alunoId = $("alunoRecorrencia").value;

    const aluno = alunos.find(
      a => a.id === alunoId
    );

    const nomePlano =
      $("nomePlanoRecorrencia").value.trim();

    const valorPlano =
      Number($("valorRecorrencia").value);

    const primeiraData =
      $("primeiroVencimento").value;

    if (!aluno) {
      alert("Selecione um aluno.");
      return;
    }

    if (aluno.matriculaCancelada === true) {
      alert(
        "A matrícula deste aluno está cancelada.\n\n" +
        "Reative a matrícula antes de criar um plano mensal."
      );

      return;
    }

    if (
      !nomePlano ||
      !Number.isFinite(valorPlano) ||
      valorPlano <= 0 ||
      !dataValida(primeiraData)
    ) {
      alert(
        "Preencha corretamente os dados do plano."
      );

      return;
    }

    const diaVencimento = Number(
      primeiraData.split("-")[2]
    );

    const referenciaPlano = doc(
      collection(db, "mensalidades")
    );

    const referenciaIndice = doc(
      db,
      "mensalidades",
      indicePlanoId(alunoId)
    );

    const referenciaAluno = doc(
      db,
      "usuarios",
      alunoId
    );

    emOperacao = true;

    $("btnCriarRecorrencia").disabled = true;

    try {
      await runTransaction(db, async tx => {
        // Todas as leituras ocorrem antes
        // de qualquer gravação.

        const alunoSnap = await tx.get(
          referenciaAluno
        );

        const indiceSnap = await tx.get(
          referenciaIndice
        );

        if (!alunoSnap.exists()) {
          throw new Error(
            "Aluno não encontrado."
          );
        }

        const cadastro = alunoSnap.data();

        // VERIFICAÇÃO PRINCIPAL
        if (
          cadastro.tipo !== "aluno" ||
          cadastro.personalId !== personalAtual.uid ||
          cadastro.matriculaCancelada === true
        ) {
          throw new Error(
            "A matrícula está cancelada ou " +
            "o aluno não pertence a este personal."
          );
        }

        let planoAnteriorSnap = null;

        if (
          indiceSnap.exists() &&
          indiceSnap.data().planoAtivoId
        ) {
          const planoAnteriorId =
            indiceSnap.data().planoAtivoId;

          planoAnteriorSnap = await tx.get(
            doc(
              db,
              "mensalidades",
              planoAnteriorId
            )
          );
        }

        if (
          planoAnteriorSnap?.exists() &&
          planoAnteriorSnap.data().ativo === true
        ) {
          throw new Error(
            "Este aluno já possui um plano mensal ativo.\n\n" +
            "Cancele a recorrência anterior antes."
          );
        }

        // PLANO RECORRENTE
        tx.set(referenciaPlano, {
          registroTipo: "recorrencia",

          personalId: personalAtual.uid,

          alunoId,
          alunoNome: cadastro.nome || "Aluno",

          nomePlano,

          valorPlano:
            Math.round(valorPlano * 100) / 100,

          primeiraData,
          diaVencimento,

          ativo: true,

          encerramentoCompetencia: null,

          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp()
        });

        // ÍNDICE POR ALUNO
        tx.set(referenciaIndice, {
          registroTipo: "indiceRecorrencia",

          personalId: personalAtual.uid,
          alunoId,

          planoAtivoId: referenciaPlano.id,

          atualizadoEm: serverTimestamp()
        });
      });

      $("formRecorrencia").reset();

      $("nomePlanoRecorrencia").value =
        "Plano Mensal";

      alert(
        "Plano mensal ativado!\n\n" +
        "As mensalidades serão calculadas " +
        "automaticamente a cada mês."
      );

    } catch (erro) {
      console.error(erro);

      alert(
        erro.message ||
        "Não foi possível criar o plano."
      );

    } finally {
      emOperacao = false;

      $("btnCriarRecorrencia").disabled = false;
    }
  }
);

// ==========================================
// CANCELAR SOMENTE A RECORRÊNCIA
// ==========================================

async function cancelarRecorrencia(plano) {
  if (!personalAtual) return;

  const confirmado = confirm(
    `Cancelar o plano mensal de ${plano.alunoNome}?\n\n` +
    "A matrícula continuará ativa.\n" +
    "As cobranças dos próximos meses serão interrompidas.\n" +
    "O histórico financeiro será preservado."
  );

  if (!confirmado) return;

  const referenciaPlano = doc(
    db,
    "mensalidades",
    plano.id
  );

  const referenciaIndice = doc(
    db,
    "mensalidades",
    indicePlanoId(plano.alunoId)
  );

  await runTransaction(db, async tx => {
    const planoSnap = await tx.get(
      referenciaPlano
    );

    const indiceSnap = await tx.get(
      referenciaIndice
    );

    if (!planoSnap.exists()) {
      throw new Error("Plano não encontrado.");
    }

    const dados = planoSnap.data();

    if (
      dados.personalId !== personalAtual.uid ||
      dados.registroTipo !== "recorrencia" ||
      dados.ativo !== true
    ) {
      throw new Error(
        "Plano inválido ou já cancelado."
      );
    }

    tx.update(referenciaPlano, {
      ativo: false,

      encerramentoCompetencia:
        competenciaAtual(),

      canceladoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });

    if (
      indiceSnap.exists() &&
      indiceSnap.data().planoAtivoId === plano.id
    ) {
      tx.update(referenciaIndice, {
        planoAtivoId: null,
        atualizadoEm: serverTimestamp()
      });
    }
  });

  alert(
    "Recorrência cancelada com sucesso!\n\n" +
    "A matrícula do aluno permanece ativa."
  );
}

// ==========================================
// EXIBIR PLANOS MENSAIS
// ==========================================

function renderizarRecorrencias() {
  const lista = $("listaRecorrencias");

  lista.replaceChildren();

  const planos = registros
    .filter(
      r => r.registroTipo === "recorrencia"
    )
    .sort((a, b) =>
      (a.alunoNome || "").localeCompare(
        b.alunoNome || "",
        "pt-BR"
      )
    );

  if (!planos.length) {
    lista.appendChild(
      elemento(
        "p",
        "Nenhum plano mensal cadastrado."
      )
    );

    return;
  }

  for (const plano of planos) {
    const card = elemento(
      "article",
      "",
      "mens-item"
    );

    card.appendChild(
      elemento(
        "strong",
        plano.alunoNome || "Aluno"
      )
    );

    card.appendChild(
      elemento(
        "h3",
        plano.nomePlano || "Plano Mensal"
      )
    );

    card.appendChild(
      elemento(
        "p",
        `${moeda(plano.valorPlano)} por mês · ` +
        `Vencimento no dia ${plano.diaVencimento}`
      )
    );

    card.appendChild(
      elemento(
        "p",
        `Primeiro vencimento: ${
          plano.primeiraData
            ? plano.primeiraData
                .split("-")
                .reverse()
                .join("/")
            : "Não informado"
        }`
      )
    );

    card.appendChild(
      elemento(
        "span",
        plano.ativo ? "Ativo" : "Cancelado",
        `mens-status ${
          plano.ativo ? "pago" : "atrasado"
        }`
      )
    );

    if (plano.ativo) {
      const acoes = elemento(
        "div",
        "",
        "mens-acoes"
      );

      acoes.appendChild(
        criarBotao(
          "Cancelar recorrência",
          () => cancelarRecorrencia(plano),
          "mens-excluir"
        )
      );

      card.appendChild(acoes);
    }

    lista.appendChild(card);
  }
}

// ==========================================
// CONFIRMAR OU REVERTER PAGAMENTO
// ==========================================

async function alterarPagamento(mensalidade) {
  if (!personalAtual) return;

  const pagar = mensalidade.status !== "pago";

  const confirmado = confirm(
    pagar
      ? `Confirmar pagamento de ${moeda(mensalidade.valorPlano)}?`
      : "Deseja reverter este pagamento?"
  );

  if (!confirmado) return;

  const referencia = doc(
    db,
    "mensalidades",
    mensalidade.id
  );

  await runTransaction(db, async tx => {
    const existente = await tx.get(
      referencia
    );

    if (existente.exists()) {
      const dados = existente.data();

      if (
        dados.personalId !== personalAtual.uid ||
        [
          "recorrencia",
          "indiceRecorrencia"
        ].includes(dados.registroTipo)
      ) {
        throw new Error(
          "Esta cobrança não pode ser modificada."
        );
      }

      // Verifica o status mais recente.
      if (
        (dados.status === "pago") === pagar
      ) {
        throw new Error(
          "O pagamento foi alterado em outra sessão. " +
          "Atualize a página."
        );
      }

      tx.update(referencia, {
        status: pagar ? "pago" : "pendente",

        pagoEm: pagar
          ? serverTimestamp()
          : null,

        atualizadoEm: serverTimestamp()
      });

    } else {
      // Cobrança virtual ainda não gravada.
      if (
        !mensalidade.virtual ||
        !mensalidade.planoRecorrenteId ||
        !pagar
      ) {
        throw new Error(
          "Cobrança não encontrada."
        );
      }

      const planoSnap = await tx.get(
        doc(
          db,
          "mensalidades",
          mensalidade.planoRecorrenteId
        )
      );

      if (!planoSnap.exists()) {
        throw new Error(
          "Plano recorrente não encontrado."
        );
      }

      const plano = planoSnap.data();

      if (
        plano.personalId !== personalAtual.uid ||
        plano.alunoId !== mensalidade.alunoId ||
        plano.registroTipo !== "recorrencia"
      ) {
        throw new Error(
          "Dados da cobrança incompatíveis."
        );
      }

      tx.set(referencia, {
        registroTipo: "cobrancaRecorrente",

        planoRecorrenteId:
          mensalidade.planoRecorrenteId,

        competencia: mensalidade.competencia,

        personalId: personalAtual.uid,

        alunoId: mensalidade.alunoId,
        alunoNome: mensalidade.alunoNome,

        nomePlano: mensalidade.nomePlano,
        valorPlano: mensalidade.valorPlano,

        vencimento: mensalidade.vencimento,

        status: "pago",

        pagoEm: serverTimestamp(),

        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
    }
  });

  alert(
    pagar
      ? "Pagamento confirmado!"
      : "Pagamento revertido!"
  );
}

// ==========================================
// COBRANÇAS AVULSAS
// ==========================================

$("formMensalidade").addEventListener(
  "submit",
  async evento => {
    evento.preventDefault();

    if (!personalAtual || emOperacao) return;

    const aluno = alunos.find(
      a => a.id === $("alunoSelect").value
    );

    const nomePlano =
      $("nomePlano").value.trim();

    const valorPlano =
      Number($("valorPlano").value);

    const vencimento =
      $("vencimento").value;

    const status =
      $("statusPagamento").value;

    if (
      !aluno ||
      !nomePlano ||
      !Number.isFinite(valorPlano) ||
      valorPlano <= 0 ||
      !dataValida(vencimento)
    ) {
      alert(
        "Preencha corretamente todos os campos."
      );

      return;
    }

    emOperacao = true;

    $("btnSalvar").disabled = true;

    try {
      const dados = {
        registroTipo: "avulsa",

        personalId: personalAtual.uid,

        alunoId: aluno.id,
        alunoNome: aluno.nome || "Aluno",

        nomePlano,

        valorPlano:
          Math.round(valorPlano * 100) / 100,

        vencimento,
        status,

        atualizadoEm: serverTimestamp()
      };

      if (editandoId) {
        const atual = registros.find(
          r => r.id === editandoId
        );

        if (
          !atual ||
          atual.personalId !== personalAtual.uid ||
          [
            "recorrencia",
            "indiceRecorrencia",
            "cobrancaRecorrente"
          ].includes(atual.registroTipo)
        ) {
          throw new Error(
            "Cobrança avulsa não encontrada."
          );
        }

        if (
          status === "pago" &&
          atual.status !== "pago"
        ) {
          dados.pagoEm = serverTimestamp();
        }

        if (status !== "pago") {
          dados.pagoEm = null;
        }

        await updateDoc(
          doc(db, "mensalidades", editandoId),
          dados
        );

      } else {
        await addDoc(
          collection(db, "mensalidades"),
          {
            ...dados,

            criadoEm: serverTimestamp(),

            pagoEm: status === "pago"
              ? serverTimestamp()
              : null
          }
        );
      }

      alert("Cobrança salva com sucesso!");

      limparFormulario();

    } catch (erro) {
      console.error(erro);

      alert(
        erro.message ||
        "Não foi possível salvar a cobrança."
      );

    } finally {
      emOperacao = false;

      $("btnSalvar").disabled = false;
    }
  }
);

// ==========================================
// LIMPAR FORMULÁRIO AVULSO
// ==========================================

function limparFormulario() {
  editandoId = null;

  $("formMensalidade").reset();

  $("tituloFormulario").textContent =
    "Nova cobrança avulsa";

  $("btnSalvar").textContent =
    "Salvar cobrança";

  $("btnCancelarEdicao").hidden = true;
}

// ==========================================
// EDITAR COBRANÇA AVULSA
// ==========================================

function editarAvulsa(mensalidade) {
  const select = $("alunoSelect");

  const existe = [...select.options].some(
    opcao => opcao.value === mensalidade.alunoId
  );

  if (!existe) {
    select.add(
      new Option(
        mensalidade.alunoNome || "Aluno antigo",
        mensalidade.alunoId
      )
    );
  }

  editandoId = mensalidade.id;

  select.value = mensalidade.alunoId;

  $("nomePlano").value =
    mensalidade.nomePlano || "";

  $("valorPlano").value =
    mensalidade.valorPlano;

  $("vencimento").value =
    mensalidade.vencimento || "";

  $("statusPagamento").value =
    mensalidade.status === "pago"
      ? "pago"
      : "pendente";

  $("tituloFormulario").textContent =
    "Editar cobrança avulsa";

  $("btnSalvar").textContent =
    "Salvar alterações";

  $("btnCancelarEdicao").hidden = false;

  $("formMensalidade").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

// ==========================================
// EXCLUIR COBRANÇA AVULSA
// ==========================================

async function excluirAvulsa(mensalidade) {
  if (!personalAtual) return;

  const confirmado = confirm(
    `Excluir a cobrança de ${mensalidade.alunoNome}?\n\n` +
    "Esta ação não pode ser desfeita."
  );

  if (!confirmado) return;

  const referencia = doc(
    db,
    "mensalidades",
    mensalidade.id
  );

  // Transação para verificar novamente
  // se a cobrança pode ser excluída.
  await runTransaction(db, async tx => {
    const snap = await tx.get(referencia);

    if (!snap.exists()) {
      throw new Error(
        "Cobrança não encontrada."
      );
    }

    const dados = snap.data();

    if (
      dados.personalId !== personalAtual.uid ||
      [
        "recorrencia",
        "indiceRecorrencia",
        "cobrancaRecorrente"
      ].includes(dados.registroTipo)
    ) {
      throw new Error(
        "Esta cobrança não pode ser excluída."
      );
    }

    tx.delete(referencia);
  });

  if (editandoId === mensalidade.id) {
    limparFormulario();
  }

  alert("Cobrança excluída!");
}

// ==========================================
// LISTAGEM E FILTROS
// ==========================================

function renderizar() {
  if (!personalAtual) return;

  renderizarRecorrencias();

  const mes =
    $("mesCobrancas").value ||
    competenciaAtual();

  const incluirAtrasadas =
    $("incluirAtrasadas").checked;

  const filtro =
    $("filtroMensalidades").value;

  const todas = cobrancasVisiveis(
    registros,
    mes
  );

  // Exibe o mês selecionado e,
  // opcionalmente, pendências anteriores.
  const visiveis = todas.filter(m => {
    const competencia =
      m.competencia ||
      competenciaDeData(m.vencimento);

    return (
      competencia === mes ||
      (
        incluirAtrasadas &&
        competencia < mes &&
        statusAtual(m) !== "pago"
      )
    );
  });

  const registrosFiltrados = visiveis
    .filter(
      m =>
        filtro === "todos" ||
        statusAtual(m) === filtro
    )
    .sort(ordenar);

  // ========================================
  // RESUMO FINANCEIRO
  // ========================================

  let recebido = 0;
  let pendente = 0;
  let atrasado = 0;
  let total = 0;

  for (const m of visiveis) {
    const valor = Number(m.valorPlano) || 0;

    total += valor;

    const status = statusAtual(m);

    if (status === "pago") {
      recebido += valor;

    } else if (status === "atrasado") {
      atrasado += valor;

    } else {
      pendente += valor;
    }
  }

  $("totalRecebido").textContent =
    moeda(recebido);

  $("totalPendente").textContent =
    moeda(pendente);

  $("totalAtrasado").textContent =
    moeda(atrasado);

  $("totalGeral").textContent =
    moeda(total);

  // ========================================
  // LISTA DE COBRANÇAS
  // ========================================

  const lista = $("listaMensalidades");

  lista.replaceChildren();

  if (!registrosFiltrados.length) {
    lista.appendChild(
      elemento(
        "p",
        "Nenhuma cobrança encontrada."
      )
    );

    return;
  }

  for (const mensalidade of registrosFiltrados) {
    const card = criarCartao(
      mensalidade,
      true
    );

    if (
      mensalidade.registroTipo ===
      "cobrancaRecorrente"
    ) {
      card.appendChild(
        elemento(
          "p",
          `Referência: ${mensalidade.competencia}`
        )
      );
    }

    const acoes = elemento(
      "div",
      "",
      "mens-acoes"
    );

    // PAGAMENTO
    acoes.appendChild(
      criarBotao(
        mensalidade.status === "pago"
          ? "Reverter pagamento"
          : "Marcar como pago",

        () => alterarPagamento(mensalidade),

        mensalidade.status === "pago"
          ? "mens-secundario"
          : ""
      )
    );

    // COBRANÇAS AVULSAS
    if (
      ![
        "recorrencia",
        "indiceRecorrencia",
        "cobrancaRecorrente"
      ].includes(mensalidade.registroTipo)
    ) {
      acoes.appendChild(
        criarBotao(
          "Editar",
          () => editarAvulsa(mensalidade),
          "mens-secundario"
        )
      );

      acoes.appendChild(
        criarBotao(
          "Excluir",
          () => excluirAvulsa(mensalidade),
          "mens-excluir"
        )
      );
    }

    card.appendChild(acoes);
    lista.appendChild(card);
  }
}

// ==========================================
// ATUALIZAR AO VOLTAR À PÁGINA
// ==========================================

document.addEventListener(
  "visibilitychange",
  () => {
    if (document.hidden) return;

    $("mesCobrancas").max =
      competenciaAtual();

    if (
      $("mesCobrancas").value >
      competenciaAtual()
    ) {
      $("mesCobrancas").value =
        competenciaAtual();
    }

    renderizar();
  }
);

// ==========================================
// ENCERRAMENTO
// ==========================================

function encerrarEscutas() {
  if (cancelarEscuta) {
    cancelarEscuta();
    cancelarEscuta = null;
  }

  if (cancelarEscutaAlunos) {
    cancelarEscutaAlunos();
    cancelarEscutaAlunos = null;
  }
}

window.addEventListener(
  "pagehide",
  encerrarEscutas
);
