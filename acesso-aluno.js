
/*
  FITCOACH — CONTROLE DE ACESSO DO ALUNO

  Situações:
  1. Matrícula ativa
  2. Bloqueio temporário
  3. Matrícula cancelada

  Preserva o aluno.js existente.
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

const $ = id => document.getElementById(id);

let cancelarEscuta = null;
let versaoAutenticacao = 0;
let moduloAluno = null;
let situacaoAtual = "verificando";

// ==========================================
// ESTILOS ADICIONAIS
// ==========================================

const estilos = document.createElement("style");

estilos.textContent = `
  #avisoMatricula {
    max-width: 480px;
    margin: 60px auto;
    padding: 25px;
    background: #18181e;
    color: white;
    border: 1px solid #30303a;
    border-radius: 16px;
    text-align: center;
    box-sizing: border-box;
  }

  #avisoMatricula h2 {
    font-size: 21px;
    margin: 15px 0;
  }

  #avisoMatricula p {
    color: #aaa;
    font-size: 14px;
    line-height: 1.6;
    text-align: center;
  }

  #avisoMatricula button {
    margin-top: 18px;
    padding: 12px 20px;
    border: none;
    border-radius: 10px;
    background: #34343d;
    color: white;
    cursor: pointer;
  }

  .fitcoach-aviso-cancelamento {
    background: #28202b;
    border: 1px solid #764a79;
    border-radius: 13px;
    padding: 18px;
    margin: 18px 0;
  }

  .fitcoach-aviso-cancelamento h2 {
    color: #e9b8e9;
    font-size: 18px;
    margin-bottom: 9px;
  }

  .fitcoach-aviso-cancelamento p {
    color: #ccc;
    font-size: 13px;
    line-height: 1.6;
    text-align: left;
  }

  .fitcoach-historico-legenda {
    margin: 15px 0;
    color: #aaa;
    font-size: 13px;
    text-align: left;
  }

  .fitcoach-acesso-desabilitado {
    display: none !important;
  }

  [hidden] {
    display: none !important;
  }
`;

document.head.appendChild(estilos);

// ==========================================
// TELA DE AVISO
// ==========================================

const aviso = document.createElement("section");

aviso.id = "avisoMatricula";
aviso.hidden = true;

document.body.appendChild(aviso);

function mostrarAviso(
  titulo,
  mensagem,
  bloqueado = false
) {
  situacaoAtual = bloqueado
    ? "bloqueada"
    : "verificando";

  if (painel) {
    painel.hidden = true;
  }

  fecharModal();

  aviso.replaceChildren();
  aviso.hidden = false;

  const icone = document.createElement("div");

  icone.textContent = bloqueado ? "🔒" : "⏳";
  icone.style.fontSize = "42px";

  const h2 = document.createElement("h2");
  h2.textContent = titulo;

  const texto = document.createElement("p");
  texto.textContent = mensagem;

  aviso.append(icone, h2, texto);

  if (bloqueado) {
    const orientacao = document.createElement("p");

    orientacao.textContent =
      "Entre em contato com seu personal " +
      "para regularizar sua matrícula.";

    orientacao.style.marginTop = "18px";
    orientacao.style.color = "#4ade80";

    aviso.appendChild(orientacao);
  }

  if (auth.currentUser) {
    const sair = document.createElement("button");

    sair.type = "button";
    sair.textContent = "Voltar ao login";

    sair.onclick = () => {
      location.href = "index.html";
    };

    aviso.appendChild(sair);
  }
}

// ==========================================
// CONTROLE DO MODAL
// ==========================================

function fecharModal() {
  if (!modal) return;

  modal.hidden = true;
  modal.style.display = "none";
}

function podeConectarPersonal() {
  return situacaoAtual === "ativa";
}

// Bloqueia a abertura do modal se a matrícula
// estiver cancelada ou bloqueada.
document.addEventListener(
  "click",
  evento => {
    const botaoConectar = evento.target.closest(
      ".destaque button"
    );

    if (
      botaoConectar &&
      !podeConectarPersonal()
    ) {
      evento.preventDefault();
      evento.stopImmediatePropagation();
    }
  },
  true
);

// ==========================================
// ELEMENTOS DO PAINEL
// ==========================================

function obterCartaoPorDestino(destino) {
  const cartoes = painel?.querySelectorAll(
    ".grid .card.item"
  ) || [];

  return [...cartoes].find(cartao =>
    cartao.getAttribute("onclick")?.includes(destino)
  );
}

function criarAvisoCancelamento() {
  let secao = $("avisoCancelamento");

  if (secao) return secao;

  secao = document.createElement("section");
  secao.id = "avisoCancelamento";
  secao.className = "fitcoach-aviso-cancelamento";

  const titulo = document.createElement("h2");
  titulo.textContent = "Matrícula cancelada";

  const texto = document.createElement("p");

  texto.textContent =
    "Sua matrícula foi encerrada. " +
    "Você pode consultar suas fichas, avaliações, " +
    "evolução física e histórico financeiro. " +
    "Para voltar a agendar treinos, " +
    "solicite a reativação ao seu personal.";

  secao.append(titulo, texto);

  const destaque = painel?.querySelector(
    ".card.destaque"
  );

  if (destaque) {
    destaque.insertAdjacentElement(
      "afterend",
      secao
    );
  } else {
    painel?.prepend(secao);
  }

  return secao;
}

// ==========================================
// EXIBIR OU OCULTAR FUNCIONALIDADES
// ==========================================

function atualizarFuncionalidades(cancelada) {
  const secaoCancelamento =
    criarAvisoCancelamento();

  secaoCancelamento.hidden = !cancelada;

  // A conexão com outro personal não é permitida
  // enquanto a matrícula estiver cancelada.
  const botaoConectar = painel?.querySelector(
    ".destaque button"
  );

  if (botaoConectar) {
    botaoConectar.classList.toggle(
      "fitcoach-acesso-desabilitado",
      cancelada
    );

    botaoConectar.disabled = cancelada;
  }

  // Oculta a entrada para novos agendamentos.
  const cartaoAgenda = obterCartaoPorDestino(
    "agenda-aluno.html"
  );

  if (cartaoAgenda) {
    cartaoAgenda.classList.toggle(
      "fitcoach-acesso-desabilitado",
      cancelada
    );
  }

  // Mantém disponíveis para consulta:
  // - Meus Treinos
  // - Avaliações
  // - Evolução Física
  // - Mensalidades

  const cartaoTreinos = obterCartaoPorDestino(
    "treinos-aluno.html"
  );

  const cartaoAvaliacoes = obterCartaoPorDestino(
    "avaliacoes-aluno.html"
  );

  const cartaoEvolucao = obterCartaoPorDestino(
    "evolucao.html"
  );

  const cartaoMensalidades = obterCartaoPorDestino(
    "mensalidades-aluno.html"
  );

  for (const cartao of [
    cartaoTreinos,
    cartaoAvaliacoes,
    cartaoEvolucao,
    cartaoMensalidades
  ]) {
    if (cartao) {
      cartao.classList.remove(
        "fitcoach-acesso-desabilitado"
      );
    }
  }
}

// ==========================================
// CARREGAR PAINEL ORIGINAL
// ==========================================

async function carregarPainelOriginal() {
  if (!moduloAluno) {
    moduloAluno = import("./aluno.js");
  }

  await moduloAluno;
}

// ==========================================
// LIBERAR PAINEL
// ==========================================

async function liberarPainel(
  uid,
  versao,
  cancelada
) {
  try {
    await carregarPainelOriginal();

    if (
      versao !== versaoAutenticacao ||
      auth.currentUser?.uid !== uid
    ) {
      return;
    }

    // O estado pode mudar enquanto
    // o módulo original está carregando.
    if (
      cancelada &&
      situacaoAtual !== "cancelada"
    ) {
      return;
    }

    if (
      !cancelada &&
      situacaoAtual !== "ativa"
    ) {
      return;
    }

    aviso.hidden = true;

    atualizarFuncionalidades(cancelada);

    if (painel) {
      painel.hidden = false;
    }

    fecharModal();

  } catch (erro) {
    console.error(
      "Erro ao carregar painel:",
      erro
    );

    mostrarAviso(
      "Erro ao carregar",
      "Não foi possível abrir seu painel."
    );
  }
}

// ==========================================
// MATRÍCULA CANCELADA
// ==========================================

function tratarMatriculaCancelada(
  uid,
  versao
) {
  situacaoAtual = "cancelada";

  fecharModal();

  liberarPainel(
    uid,
    versao,
    true
  );
}

// ==========================================
// MATRÍCULA ATIVA
// ==========================================

function tratarMatriculaAtiva(
  uid,
  versao
) {
  situacaoAtual = "ativa";

  liberarPainel(
    uid,
    versao,
    false
  );
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

  situacaoAtual = "verificando";

  mostrarAviso(
    "Verificando matrícula",
    "Estamos consultando a situação " +
    "da sua matrícula."
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
      if (versao !== versaoAutenticacao) {
        return;
      }

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
      // CANCELAMENTO DEFINITIVO
      // ====================================

      if (
        dados.matriculaCancelada === true
      ) {
        tratarMatriculaCancelada(
          usuario.uid,
          versao
        );

        return;
      }

      // ====================================
      // BLOQUEIO TEMPORÁRIO
      // ====================================

      if (
        dados.matriculaBloqueada === true
      ) {
        mostrarAviso(
          "Matrícula suspensa",
          "Seu acesso ao FitCoach está " +
          "temporariamente suspenso.",
          true
        );

        return;
      }

      // ====================================
      // MATRÍCULA ATIVA
      // ====================================

      tratarMatriculaAtiva(
        usuario.uid,
        versao
      );
    },

    erro => {
      console.error(
        "Erro ao verificar matrícula:",
        erro
      );

      mostrarAviso(
        "Erro de conexão",
        "Não foi possível verificar sua matrícula. " +
        "Confira sua conexão e tente novamente."
      );
    }
  );
});

// ==========================================
// ENCERRAMENTO
// ==========================================

window.addEventListener(
  "pagehide",
  () => {
    if (cancelarEscuta) {
      cancelarEscuta();
      cancelarEscuta = null;
    }
  }
);
