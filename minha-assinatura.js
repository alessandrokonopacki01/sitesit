
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  PLANOS,
  formatarData,
  diasRestantes,
  statusAssinatura,
  textoAssinatura
} from "./assinaturas-comum.js";

// ==========================================
// ELEMENTOS DA PÁGINA
// ==========================================

const $ = id => document.getElementById(id);

let personalAtual = null;
let assinaturaAtual = null;
let cancelarEscuta = null;

const STATUS_CLASSES = [
  "ativo",
  "teste",
  "vencido",
  "bloqueado",
  "liberado",
  "sem_assinatura"
];

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
  if (cancelarEscuta) {
    cancelarEscuta();
    cancelarEscuta = null;
  }

  if (!usuario) {
    location.href = "index.html";
    return;
  }

  try {
    const perfil = await getDoc(
      doc(db, "usuarios", usuario.uid)
    );

    if (
      !perfil.exists() ||
      perfil.data().tipo !== "personal"
    ) {
      location.href = "index.html";
      return;
    }

    personalAtual = usuario;

    carregarAssinatura();

  } catch (erro) {
    console.error("Erro ao carregar perfil:", erro);

    mostrarErro(
      "Não foi possível verificar sua conta."
    );
  }
});

// ==========================================
// CONSULTAR ASSINATURA EM TEMPO REAL
// ==========================================

function carregarAssinatura() {
  if (!personalAtual) return;

  // Uma assinatura por personal.
  // ID do documento = UID do personal.
  const referencia = doc(
    db,
    "assinaturas",
    personalAtual.uid
  );

  cancelarEscuta = onSnapshot(
    referencia,

    documento => {
      assinaturaAtual = documento.exists()
        ? documento.data()
        : null;

      atualizarPagina();
    },

    erro => {
      console.error("Erro ao consultar assinatura:", erro);

      mostrarErro(
        "Não foi possível carregar sua assinatura."
      );
    }
  );
}

// ==========================================
// ATUALIZAR A PÁGINA
// ==========================================

function atualizarPagina() {
  const assinatura = assinaturaAtual;

  const status = statusAssinatura(assinatura);
  const textoStatus = textoAssinatura(status);

  atualizarStatus(status, textoStatus);
  atualizarDadosPlano(assinatura, status);
  atualizarAviso(assinatura, status);
}

// ==========================================
// SITUAÇÃO DA ASSINATURA
// ==========================================

function atualizarStatus(status, textoStatus) {
  const etiqueta = $("statusAssinatura");

  STATUS_CLASSES.forEach(classe => {
    etiqueta.classList.remove(classe);
  });

  etiqueta.classList.add(status);
  etiqueta.textContent = textoStatus;
}

// ==========================================
// INFORMAÇÕES DO PLANO
// ==========================================

function atualizarDadosPlano(assinatura, status) {
  if (!assinatura) {
    $("nomePlano").textContent = "Nenhum plano cadastrado";

    $("mensagemPlano").textContent =
      "Entre em contato com o administrador para ativar sua assinatura.";

    $("planoAtual").textContent = "--";
    $("diasRestantes").textContent = "0";
    $("dataInicio").textContent = "--";
    $("dataVencimento").textContent = "--";

    return;
  }

  const plano = PLANOS[assinatura.plano];

  const nomePlano = plano?.nome ||
    assinatura.nomePlano ||
    "Plano personalizado";

  const dias = diasRestantes(assinatura.vencimento);

  $("nomePlano").textContent = nomePlano;
  $("planoAtual").textContent = nomePlano;

  $("diasRestantes").textContent =
    status === "liberado"
      ? "Liberado"
      : String(dias);

  $("dataInicio").textContent =
    formatarData(assinatura.inicio);

  $("dataVencimento").textContent =
    formatarData(assinatura.vencimento);


const whatsapp = "https://wa.me/5542999806150?text=" +
  encodeURIComponent(
    "Olá! Sou personal do FitCoach e gostaria de renovar minha assinatura. Pode me enviar a chave Pix?"
  );

const mensagens = {
  ativo:
    "Sua assinatura está ativa. Você pode continuar utilizando o FitCoach.",

  teste:
    "Você está utilizando o período de teste gratuito do FitCoach.",

  vencido:
    "Sua assinatura venceu. Solicite a renovação pelo WhatsApp.",

  bloqueado:
    "Seu acesso foi bloqueado. Entre em contato pelo WhatsApp.",

  liberado:
    "Seu acesso foi liberado manualmente pelo administrador.",

  sem_assinatura:
    "Você ainda não possui uma assinatura ativa. Solicite seu plano pelo WhatsApp."
};

$("mensagemPlano").textContent =
  mensagens[status] || "Consulte o administrador.";

const mensagemPlano = $("mensagemPlano");

// Evita criar links duplicados.
document.getElementById("linkRenovacao")?.remove();

if (["vencido", "bloqueado", "sem_assinatura"].includes(status)) {
  const link = document.createElement("a");

  link.id = "linkRenovacao";
  link.href = whatsapp;
  link.target = "_blank";
  link.rel = "noopener noreferrer";
  link.textContent = "💬 Solicitar renovação pelo WhatsApp";

  link.style.cssText = `
    display: inline-block;
    margin-top: 15px;
    padding: 12px 18px;
    background: #25D366;
    color: white;
    border-radius: 10px;
    text-decoration: none;
    font-weight: bold;
  `;

  mensagemPlano.insertAdjacentElement("afterend", link);
}


  $("mensagemPlano").textContent =
    mensagens[status] || "Consulte o administrador.";
}

// ==========================================
// AVISOS DE VENCIMENTO
// ==========================================

function atualizarAviso(assinatura, status) {
  const secao = $("avisoVencimento");

  secao.hidden = true;

  if (!assinatura) return;

  if (status === "bloqueado") {
    mostrarAviso(
      "Acesso bloqueado",
      "Entre em contato com o administrador para verificar sua assinatura."
    );
    return;
  }

  if (status === "vencido" || status === "sem_assinatura") {
    mostrarAviso(
      "Assinatura vencida ou incompleta",
      "Seu plano precisa ser renovado ou ativado pelo administrador."
    );
    return;
  }

  if (status === "liberado") return;

  const dias = diasRestantes(assinatura.vencimento);

  if (dias <= 3) {
    mostrarAviso(
      "Sua assinatura está próxima do vencimento",
      dias === 1
        ? "Resta apenas 1 dia de acesso ao FitCoach."
        : `Restam ${dias} dias de acesso ao FitCoach.`
    );
  }
}

function mostrarAviso(titulo, mensagem) {
  $("tituloAviso").textContent = titulo;
  $("textoAviso").textContent = mensagem;

  $("avisoVencimento").hidden = false;
}

// ==========================================
// TRATAMENTO DE ERROS
// ==========================================

function mostrarErro(mensagem) {
  $("nomePlano").textContent = "Erro na consulta";
  $("mensagemPlano").textContent = mensagem;

  $("planoAtual").textContent = "--";
  $("diasRestantes").textContent = "--";
  $("dataInicio").textContent = "--";
  $("dataVencimento").textContent = "--";

  $("statusAssinatura").textContent = "Indisponível";
  $("avisoVencimento").hidden = true;
}

// ==========================================
// ATUALIZAÇÃO AO RETORNAR PARA A ABA
// ==========================================

document.addEventListener("visibilitychange", () => {
  if (!document.hidden && personalAtual) {
    atualizarPagina();
  }
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
