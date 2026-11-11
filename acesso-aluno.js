
/*
  FITCOACH — CONTROLE DE MATRÍCULA DO ALUNO

  Verifica a situação da matrícula antes
  de carregar o painel principal.

  Mantém o aluno.js original.
*/

import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================
// ELEMENTOS
// ==========================================

const painel = document.querySelector("main.app");
const modal = document.getElementById("modalPersonal");

let cancelarEscuta = null;
let versaoAutenticacao = 0;
let moduloAluno = null;

// ==========================================
// TELA DE AVISO
// ==========================================

const aviso = document.createElement("section");

aviso.id = "avisoMatricula";

aviso.style.cssText = `
  max-width: 480px;
  margin: 60px auto;
  padding: 25px;
  background: #18181e;
  color: white;
  border: 1px solid #30303a;
  border-radius: 16px;
  text-align: center;
  font-family: inherit;
`;

document.body.appendChild(aviso);

function mostrarAviso(titulo, mensagem, bloqueado = false) {
  if (painel) painel.hidden = true;
  if (modal) modal.hidden = true;

  aviso.replaceChildren();
  aviso.hidden = false;

  const icone = document.createElement("div");
  icone.textContent = bloqueado ? "🔒" : "⏳";
  icone.style.fontSize = "42px";

  const h2 = document.createElement("h2");
  h2.textContent = titulo;
  h2.style.margin = "18px 0";

  const texto = document.createElement("p");
  texto.textContent = mensagem;
  texto.style.cssText = `
    color: #aaa;
    font-size: 14px;
    line-height: 1.6;
  `;

  aviso.append(icone, h2, texto);

  if (bloqueado) {
    const orientacao = document.createElement("p");

    orientacao.textContent =
      "Entre em contato com seu personal para regularizar sua matrícula.";

    orientacao.style.cssText = `
      margin-top: 18px;
      color: #4ade80;
      font-size: 14px;
    `;

    aviso.appendChild(orientacao);
  }
}

// ==========================================
// LIBERAR PAINEL
// ==========================================

async function liberarPainel(uid, versao) {
  try {
    // Importa o código original somente após
    // confirmar que a matrícula está ativa.
    if (!moduloAluno) {
      moduloAluno = import("./aluno.js");
    }

    await moduloAluno;

    // Evita liberar uma sessão antiga.
    if (
      versao !== versaoAutenticacao ||
      auth.currentUser?.uid !== uid
    ) {
      return;
    }

    aviso.hidden = true;

    if (painel) painel.hidden = false;

    if (modal) modal.hidden = false;

  } catch (erro) {
    console.error("Erro ao abrir painel:", erro);

    mostrarAviso(
      "Erro ao carregar",
      "Não foi possível abrir o painel do aluno."
    );
  }
}

// ==========================================
// AUTENTICAÇÃO
// ==========================================

onAuthStateChanged(auth, usuario => {
  const versao = ++versaoAutenticacao;

  if (cancelarEscuta) {
    cancelarEscuta();
    cancelarEscuta = null;
  }

  mostrarAviso(
    "Verificando matrícula",
    "Estamos consultando a situação da sua matrícula."
  );

  if (!usuario) {
    location.replace("index.html");
    return;
  }

  // ========================================
  // MONITORAMENTO EM TEMPO REAL
  // ========================================

  cancelarEscuta = onSnapshot(
    doc(db, "usuarios", usuario.uid),

    async documento => {
      if (versao !== versaoAutenticacao) return;

      if (!documento.exists()) {
        mostrarAviso(
          "Conta não encontrada",
          "Não foi possível localizar seu cadastro."
        );
        return;
      }

      const dados = documento.data();

      if (dados.tipo !== "aluno") {
        location.replace("index.html");
        return;
      }

      // ====================================
      // MATRÍCULA BLOQUEADA
      // ====================================

      if (dados.matriculaBloqueada === true) {
        mostrarAviso(
          "Matrícula suspensa",
          "Seu acesso ao FitCoach está temporariamente suspenso.",
          true
        );
        return;
      }

      // ====================================
      // MATRÍCULA ATIVA
      // ====================================

      await liberarPainel(usuario.uid, versao);
    },

    erro => {
      console.error("Erro ao verificar matrícula:", erro);

      mostrarAviso(
        "Erro de conexão",
        "Não foi possível verificar sua matrícula. Verifique sua conexão e tente novamente."
      );
    }
  );
});

// ==========================================
// ENCERRAMENTO
// ==========================================

window.addEventListener("pagehide", () => {
  if (cancelarEscuta) {
    cancelarEscuta();
    cancelarEscuta = null;
  }
});
