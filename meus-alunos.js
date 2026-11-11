
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
  updateDoc,
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
      console.error("Erro ao carregar alunos:", erro);

      $("listaAlunos").textContent =
        "Não foi possível carregar os alunos.";
    }
  );
}

// ==========================================
// SITUAÇÃO DA MATRÍCULA
// ==========================================

function matriculaBloqueada(aluno) {
  return aluno.matriculaBloqueada === true;
}

function atualizarContadores() {
  const bloqueados = alunos.filter(
    matriculaBloqueada
  ).length;

  $("totalAlunos").textContent = alunos.length;

  $("totalAtivos").textContent =
    alunos.length - bloqueados;

  $("totalBloqueados").textContent = bloqueados;
}

// ==========================================
// CRIAÇÃO SEGURA DE ELEMENTOS
// ==========================================

function elemento(tag, texto = "", classe = "") {
  const el = document.createElement(tag);

  el.textContent = String(texto);

  if (classe) el.className = classe;

  return el;
}

// ==========================================
// EXIBIR LISTA
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
    const bloqueado = matriculaBloqueada(aluno);

    const card = elemento(
      "article",
      "",
      "aluno-card"
    );

    card.appendChild(
      elemento(
        "h3",
        aluno.nome || "Aluno sem nome"
      )
    );

    card.appendChild(
      elemento(
        "p",
        aluno.email || "E-mail não informado"
      )
    );

    const status = elemento(
      "span",
      bloqueado
        ? "Matrícula bloqueada"
        : "Matrícula ativa",
      `matricula-status ${
        bloqueado ? "bloqueada" : "ativa"
      }`
    );

    card.appendChild(status);

    const acoes = elemento(
      "div",
      "",
      "aluno-acoes"
    );

    const botao = elemento(
      "button",
      bloqueado
        ? "Desbloquear matrícula"
        : "Bloquear matrícula",
      bloqueado
        ? "btn-desbloquear"
        : "btn-bloquear"
    );

    botao.type = "button";

    botao.addEventListener("click", async () => {
      botao.disabled = true;

      try {
        await alterarMatricula(
          aluno.id,
          !bloqueado
        );
      } catch (erro) {
        console.error(erro);

        alert(
          erro.message ||
          "Não foi possível atualizar a matrícula."
        );
      } finally {
        botao.disabled = false;
      }
    });

    acoes.appendChild(botao);
    card.appendChild(acoes);
    lista.appendChild(card);
  });
}

// ==========================================
// BLOQUEAR OU DESBLOQUEAR MATRÍCULA
// ==========================================

async function alterarMatricula(alunoId, bloquear) {
  if (!personalAtual) {
    throw new Error("Personal não autenticado.");
  }

  const aluno = alunos.find(a => a.id === alunoId);

  if (!aluno || aluno.personalId !== personalAtual.uid) {
    throw new Error(
      "Este aluno não está vinculado ao seu perfil."
    );
  }

  const mensagem = bloquear
    ? `Bloquear a matrícula de ${aluno.nome || "este aluno"}?`
    : `Desbloquear a matrícula de ${aluno.nome || "este aluno"}?`;

  if (!confirm(mensagem)) return;

  const referencia = doc(
    db,
    "usuarios",
    alunoId
  );

  // Confirma o vínculo antes da alteração.
  const documento = await getDoc(referencia);

  if (!documento.exists()) {
    throw new Error("Aluno não encontrado.");
  }

  const dadosAtuais = documento.data();

  if (
    dadosAtuais.tipo !== "aluno" ||
    dadosAtuais.personalId !== personalAtual.uid
  ) {
    throw new Error(
      "O aluno não está mais vinculado a este personal."
    );
  }

  await updateDoc(referencia, {
    matriculaBloqueada: bloquear,
    matriculaAtualizadaEm: serverTimestamp(),
    matriculaAtualizadaPor: personalAtual.uid
  });

  alert(
    bloquear
      ? "Matrícula bloqueada com sucesso!"
      : "Matrícula desbloqueada com sucesso!"
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
