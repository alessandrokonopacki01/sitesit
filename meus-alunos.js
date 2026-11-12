
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  query,
  where,
  doc,
  getDoc,
  getDocs,
  runTransaction,
  onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  autorizarPersonal,
  pararMonitoramentoAssinatura
} from "./bloqueio-personal.js";

// ==========================================
// ELEMENTOS E ESTADO
// ==========================================

const $ = id => document.getElementById(id);

let personalAtual = null;
let alunos = [];
let cancelarAlunos = null;
let versaoAutenticacao = 0;
let operacaoEmAndamento = false;

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function elemento(tag, texto = "", classe = "") {
  const el = document.createElement(tag);
  el.textContent = String(texto);

  if (classe) el.className = classe;

  return el;
}

function competenciaAtual() {
  const agora = new Date();

  return (
    `${agora.getFullYear()}-` +
    `${String(agora.getMonth() + 1).padStart(2, "0")}`
  );
}

function matriculaCancelada(aluno) {
  return aluno.matriculaCancelada === true;
}

function matriculaBloqueada(aluno) {
  return (
    aluno.matriculaBloqueada === true &&
    !matriculaCancelada(aluno)
  );
}

function situacaoMatricula(aluno) {
  if (matriculaCancelada(aluno)) {
    return "cancelada";
  }

  if (matriculaBloqueada(aluno)) {
    return "bloqueada";
  }

  return "ativa";
}

function verificarPersonal() {
  if (!personalAtual) {
    throw new Error("Personal não autenticado.");
  }
}

function obterAluno(alunoId) {
  verificarPersonal();

  const aluno = alunos.find(a => a.id === alunoId);

  if (
    !aluno ||
    aluno.personalId !== personalAtual.uid
  ) {
    throw new Error(
      "Aluno não vinculado a este personal."
    );
  }

  return aluno;
}

async function executarAcao(botao, acao) {
  if (operacaoEmAndamento) return;

  operacaoEmAndamento = true;
  botao.disabled = true;

  try {
    await acao();
  } catch (erro) {
    console.error(erro);

    alert(
      erro.message ||
      "Não foi possível concluir a operação."
    );
  } finally {
    operacaoEmAndamento = false;
    botao.disabled = false;
  }
}

// ==========================================
// NAVEGAÇÃO
// ==========================================

$("btnVoltar").addEventListener("click", () => {
  location.href = "personal.html";
});

// ==========================================
// AUTENTICAÇÃO
// ==========================================

onAuthStateChanged(auth, async usuario => {
  const versao = ++versaoAutenticacao;

  if (cancelarAlunos) {
    cancelarAlunos();
    cancelarAlunos = null;
  }

  pararMonitoramentoAssinatura();

  personalAtual = null;
  alunos = [];

  $("painelAlunos").hidden = true;
  $("avisoAcesso").hidden = false;

  if (!usuario) {
    location.replace("index.html");
    return;
  }

  try {
    const autorizado = await autorizarPersonal(usuario);

    if (versao !== versaoAutenticacao) return;

    if (!autorizado) {
      $("avisoAcesso").textContent =
        "Acesso não autorizado.";
      return;
    }

    const perfil = await getDoc(
      doc(db, "usuarios", usuario.uid)
    );

    if (versao !== versaoAutenticacao) return;

    if (
      !perfil.exists() ||
      perfil.data().tipo !== "personal"
    ) {
      location.replace("index.html");
      return;
    }

    personalAtual = usuario;

    $("painelAlunos").hidden = false;
    $("avisoAcesso").hidden = true;

    observarAlunos();

  } catch (erro) {
    console.error(erro);

    $("avisoAcesso").textContent =
      "Não foi possível verificar seu acesso.";
  }
});

// ==========================================
// LISTAR ALUNOS EM TEMPO REAL
// ==========================================

function observarAlunos() {
  const consulta = query(
    collection(db, "usuarios"),
    where("tipo", "==", "aluno"),
    where("personalId", "==", personalAtual.uid)
  );

  cancelarAlunos = onSnapshot(
    consulta,

    snapshot => {
      alunos = snapshot.docs.map(documento => ({
        id: documento.id,
        ...documento.data()
      }));

      alunos.sort((a, b) =>
        (a.nome || "").localeCompare(
          b.nome || "",
          "pt-BR"
        )
      );

      atualizarPagina();
    },

    erro => {
      console.error(
        "Erro ao carregar alunos:",
        erro
      );

      $("listaAlunos").textContent =
        "Não foi possível carregar os alunos.";
    }
  );
}

// ==========================================
// CONTADORES
// ==========================================

function atualizarContadores() {
  const ativos = alunos.filter(
    aluno => situacaoMatricula(aluno) === "ativa"
  ).length;

  const bloqueados = alunos.filter(
    aluno => situacaoMatricula(aluno) === "bloqueada"
  ).length;

  const cancelados = alunos.filter(
    aluno => situacaoMatricula(aluno) === "cancelada"
  ).length;

  $("totalAlunos").textContent = alunos.length;
  $("totalAtivos").textContent = ativos;
  $("totalBloqueados").textContent = bloqueados;

  const contadorCancelados = $("totalCancelados");

  if (contadorCancelados) {
    contadorCancelados.textContent = cancelados;
  }
}

// ==========================================
// EXIBIR LISTA DE ALUNOS
// ==========================================

function atualizarPagina() {
  atualizarContadores();

  const lista = $("listaAlunos");
  lista.replaceChildren();

  if (!alunos.length) {
    lista.appendChild(
      elemento(
        "p",
        "Nenhum aluno vinculado ao seu perfil."
      )
    );

    return;
  }

  alunos.forEach(aluno => {
    const situacao = situacaoMatricula(aluno);

    const card = elemento(
      "article",
      "",
      "aluno-card"
    );

    // NOME
    card.appendChild(
      elemento(
        "h3",
        aluno.nome || "Aluno sem nome"
      )
    );

    // EMAIL
    card.appendChild(
      elemento(
        "p",
        aluno.email || "E-mail não informado"
      )
    );

    // SITUAÇÃO
    const textosStatus = {
      ativa: "Matrícula ativa",
      bloqueada: "Matrícula bloqueada",
      cancelada: "Matrícula cancelada"
    };

    card.appendChild(
      elemento(
        "span",
        textosStatus[situacao],
        `matricula-status ${situacao}`
      )
    );

    const acoes = elemento(
      "div",
      "",
      "aluno-acoes"
    );

    // MATRÍCULA CANCELADA
    if (situacao === "cancelada") {
      const reativar = elemento(
        "button",
        "Reativar matrícula",
        "btn-desbloquear"
      );

      reativar.type = "button";

      reativar.addEventListener("click", () => {
        executarAcao(
          reativar,
          () => reativarMatricula(aluno.id)
        );
      });

      acoes.appendChild(reativar);
    }

    // MATRÍCULA ATIVA OU BLOQUEADA
    else {
      const bloqueado = situacao === "bloqueada";

      const botaoBloqueio = elemento(
        "button",
        bloqueado
          ? "Desbloquear matrícula"
          : "Bloquear matrícula",
        bloqueado
          ? "btn-desbloquear"
          : "btn-bloquear"
      );

      botaoBloqueio.type = "button";

      botaoBloqueio.addEventListener("click", () => {
        executarAcao(
          botaoBloqueio,
          () => alterarBloqueio(aluno.id, !bloqueado)
        );
      });

      acoes.appendChild(botaoBloqueio);

      const cancelar = elemento(
        "button",
        "Cancelar matrícula",
        "btn-cancelar-matricula"
      );

      cancelar.type = "button";

      cancelar.addEventListener("click", () => {
        executarAcao(
          cancelar,
          () => cancelarMatricula(aluno.id)
        );
      });

      acoes.appendChild(cancelar);
    }

    card.appendChild(acoes);
    lista.appendChild(card);
  });
}

// ==========================================
// BLOQUEIO TEMPORÁRIO
// ==========================================

async function alterarBloqueio(alunoId, bloquear) {
  const aluno = obterAluno(alunoId);

  if (matriculaCancelada(aluno)) {
    throw new Error(
      "A matrícula está cancelada. Reative-a primeiro."
    );
  }

  const texto = bloquear
    ? `Bloquear temporariamente ${aluno.nome || "este aluno"}?`
    : `Desbloquear ${aluno.nome || "este aluno"}?`;

  if (!confirm(
    texto +
    "\n\nAs mensalidades continuarão sendo cobradas."
  )) {
    return;
  }

  const referencia = doc(
    db,
    "usuarios",
    alunoId
  );

  await runTransaction(db, async tx => {
    const snap = await tx.get(referencia);

    if (!snap.exists()) {
      throw new Error("Aluno não encontrado.");
    }

    const dados = snap.data();

    if (
      dados.tipo !== "aluno" ||
      dados.personalId !== personalAtual.uid ||
      dados.matriculaCancelada === true
    ) {
      throw new Error(
        "A matrícula foi alterada. Atualize a página."
      );
    }

    tx.update(referencia, {
      matriculaBloqueada: bloquear,
      matriculaAtualizadaEm: serverTimestamp(),
      matriculaAtualizadaPor: personalAtual.uid
    });
  });

  alert(
    bloquear
      ? "Matrícula bloqueada temporariamente!"
      : "Matrícula desbloqueada!"
  );
}

// ==========================================
// CANCELAR MATRÍCULA DEFINITIVAMENTE
// ==========================================

async function cancelarMatricula(alunoId) {
  const aluno = obterAluno(alunoId);

  if (matriculaCancelada(aluno)) {
    throw new Error(
      "Esta matrícula já foi cancelada."
    );
  }

  const confirmado = confirm(
    `Cancelar a matrícula de ${aluno.nome || "este aluno"}?\n\n` +
    "O aluno perderá o acesso às novas atividades.\n\n" +
    "As mensalidades futuras serão interrompidas.\n\n" +
    "A cobrança do mês atual e o histórico de " +
    "pagamentos serão preservados.\n\n" +
    "Deseja continuar?"
  );

  if (!confirmado) return;

  // Localiza as recorrências financeiras do personal.
  const consulta = query(
    collection(db, "mensalidades"),
    where("personalId", "==", personalAtual.uid)
  );

  const resultado = await getDocs(consulta);

  const planosAtivos = resultado.docs.filter(snap => {
    const plano = snap.data();

    return (
      plano.registroTipo === "recorrencia" &&
      plano.alunoId === alunoId &&
      plano.ativo === true
    );
  });

  const alunoRef = doc(
    db,
    "usuarios",
    alunoId
  );

  const indiceRef = doc(
    db,
    "mensalidades",
    `indice_${personalAtual.uid}_${alunoId}`
  );

  const competencia = competenciaAtual();

  // ========================================
  // TRANSACÃO FIRESTORE
  // ========================================

  await runTransaction(db, async tx => {
    const alunoSnap = await tx.get(alunoRef);
    const indiceSnap = await tx.get(indiceRef);

    // Também verifica o plano registrado
    // no índice de recorrências.
    const referencias = new Map();

    planosAtivos.forEach(snap => {
      referencias.set(snap.id, snap.ref);
    });

    const planoIndice = indiceSnap.exists()
      ? indiceSnap.data().planoAtivoId
      : null;

    if (
      planoIndice &&
      !referencias.has(planoIndice)
    ) {
      referencias.set(
        planoIndice,
        doc(db, "mensalidades", planoIndice)
      );
    }

    const planosLidos = [];

    for (const ref of referencias.values()) {
      const snap = await tx.get(ref);

      planosLidos.push({
        ref,
        snap
      });
    }

    // Verifica a matrícula.
    if (!alunoSnap.exists()) {
      throw new Error(
        "Aluno não encontrado."
      );
    }

    const dadosAluno = alunoSnap.data();

    if (
      dadosAluno.tipo !== "aluno" ||
      dadosAluno.personalId !== personalAtual.uid
    ) {
      throw new Error(
        "Este aluno não pertence ao seu cadastro."
      );
    }

    if (dadosAluno.matriculaCancelada === true) {
      throw new Error(
        "Esta matrícula já foi cancelada."
      );
    }

    // Verifica o índice financeiro.
    if (indiceSnap.exists()) {
      const indice = indiceSnap.data();

      if (
        indice.personalId !== personalAtual.uid ||
        indice.alunoId !== alunoId
      ) {
        throw new Error(
          "O registro financeiro é incompatível."
        );
      }
    }

    // ======================================
    // ENCERRAR PLANOS RECORRENTES
    // ======================================

    for (const item of planosLidos) {
      if (!item.snap.exists()) continue;

      const plano = item.snap.data();

      if (
        plano.registroTipo !== "recorrencia" ||
        plano.personalId !== personalAtual.uid ||
        plano.alunoId !== alunoId ||
        plano.ativo !== true
      ) {
        continue;
      }

      tx.update(item.ref, {
        ativo: false,
        encerramentoCompetencia: competencia,
        canceladoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
    }

    // ======================================
    // LIMPAR ÍNDICE DA RECORRÊNCIA
    // ======================================

    if (indiceSnap.exists()) {
      tx.update(indiceRef, {
        planoAtivoId: null,
        atualizadoEm: serverTimestamp()
      });
    }

    // ======================================
    // CANCELAR MATRÍCULA
    // ======================================

    tx.update(alunoRef, {
      matriculaCancelada: true,
      matriculaBloqueada: false,
      matriculaCanceladaEm: serverTimestamp(),
      matriculaCanceladaPor: personalAtual.uid,
      matriculaAtualizadaEm: serverTimestamp(),
      matriculaAtualizadaPor: personalAtual.uid
    });
  });

  alert(
    "Matrícula cancelada com sucesso!\n\n" +
    "As recorrências foram encerradas e " +
    "o histórico financeiro foi preservado."
  );
}

// ==========================================
// REATIVAR MATRÍCULA
// ==========================================

async function reativarMatricula(alunoId) {
  const aluno = obterAluno(alunoId);

  if (!matriculaCancelada(aluno)) {
    throw new Error(
      "Esta matrícula não está cancelada."
    );
  }

  const confirmado = confirm(
    `Reativar a matrícula de ${aluno.nome || "este aluno"}?\n\n` +
    "O aluno poderá voltar a utilizar o FitCoach.\n\n" +
    "A mensalidade antiga NÃO será reativada.\n" +
    "Será necessário cadastrar um novo plano mensal."
  );

  if (!confirmado) return;

  const referencia = doc(
    db,
    "usuarios",
    alunoId
  );

  await runTransaction(db, async tx => {
    const snap = await tx.get(referencia);

    if (!snap.exists()) {
      throw new Error(
        "Aluno não encontrado."
      );
    }

    const dados = snap.data();

    if (
      dados.tipo !== "aluno" ||
      dados.personalId !== personalAtual.uid ||
      dados.matriculaCancelada !== true
    ) {
      throw new Error(
        "A matrícula foi alterada. Atualize a página."
      );
    }

    tx.update(referencia, {
      matriculaCancelada: false,
      matriculaBloqueada: false,
      matriculaReativadaEm: serverTimestamp(),
      matriculaAtualizadaEm: serverTimestamp(),
      matriculaAtualizadaPor: personalAtual.uid
    });
  });

  alert(
    "Matrícula reativada com sucesso!\n\n" +
    "Cadastre um novo plano em Mensalidades, " +
    "caso seja necessário."
  );
}

// ==========================================
// ENCERRAMENTO
// ==========================================

window.addEventListener("pagehide", () => {
  if (cancelarAlunos) {
    cancelarAlunos();
    cancelarAlunos = null;
  }

  pararMonitoramentoAssinatura();
});
