
/*
  FITCOACH — CONTROLE DE ACESSO DO PERSONAL

  Verifica:
  - Tipo de usuário
  - Existência da assinatura
  - Vencimento
  - Bloqueio manual
  - Liberação manual

  Não modifica nem exclui os dados do personal.
*/

import { db } from "./firebase.js";

import {
  doc,
  getDoc,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  assinaturaAtiva,
  statusAssinatura
} from "./assinaturas-comum.js";

// ==========================================
// CONFIGURAÇÕES
// ==========================================

const PAGINA_LOGIN = "index.html";
const PAGINA_BLOQUEIO = "minha-assinatura.html";

let cancelarMonitoramento = null;
let usuarioMonitorado = null;

// ==========================================
// REDIRECIONAMENTOS
// ==========================================

function irParaLogin() {
  window.location.replace(PAGINA_LOGIN);
}

function irParaAssinatura() {
  if (
    !window.location.pathname.endsWith(
      "/" + PAGINA_BLOQUEIO
    )
  ) {
    window.location.replace(PAGINA_BLOQUEIO);
  }
}

// ==========================================
// PARAR MONITORAMENTO ANTERIOR
// ==========================================

export function pararMonitoramentoAssinatura() {
  if (cancelarMonitoramento) {
    cancelarMonitoramento();
    cancelarMonitoramento = null;
  }

  usuarioMonitorado = null;
}

// ==========================================
// VERIFICAÇÃO INICIAL
// ==========================================

export async function autorizarPersonal(usuario) {
  if (!usuario) {
    irParaLogin();
    return false;
  }

  pararMonitoramentoAssinatura();

  // Verifica o perfil cadastrado.
  let perfil;

  try {
    const documento = await getDoc(
      doc(db, "usuarios", usuario.uid)
    );

    if (!documento.exists()) {
      irParaLogin();
      return false;
    }

    perfil = documento.data();

  } catch (erro) {
    console.error("Erro ao verificar perfil:", erro);
    alert("Não foi possível verificar sua conta.");
    return false;
  }

  if (perfil.tipo !== "personal") {
    irParaLogin();
    return false;
  }

  // Uma assinatura para cada personal.
  const referencia = doc(
    db,
    "assinaturas",
    usuario.uid
  );

  usuarioMonitorado = usuario.uid;

  // Aguarda a primeira resposta do Firestore antes
  // de liberar as funcionalidades.
  return new Promise(resolve => {
    let primeiraResposta = true;
    let finalizado = false;

    function resolverUmaVez(valor) {
      if (finalizado) return;
      finalizado = true;
      resolve(valor);
    }

    const cancelar = onSnapshot(
      referencia,

      documento => {
        if (usuarioMonitorado !== usuario.uid) {
          resolverUmaVez(false);
          return;
        }

        const assinatura = documento.exists()
          ? documento.data()
          : null;

        const permitido = assinaturaAtiva(assinatura);
        const status = statusAssinatura(assinatura);

        if (!permitido) {
          console.warn(
            "Acesso suspenso. Situação:",
            status
          );

          resolverUmaVez(false);
          irParaAssinatura();
          return;
        }

        if (primeiraResposta) {
          primeiraResposta = false;
          resolverUmaVez(true);
        }
      },

      erro => {
        console.error(
          "Não foi possível verificar assinatura:",
          erro
        );

        resolverUmaVez(false);
        alert(
          "Não foi possível verificar sua assinatura."
        );
      }
    );

    cancelarMonitoramento = cancelar;
  });
}

// ==========================================
// REVALIDAÇÃO AO RETORNAR À ABA
// ==========================================

// A verificação periódica é necessária porque uma
// assinatura pode vencer sem ocorrer alteração no
// documento do Firebase.

let ultimaVerificacao = "";

document.addEventListener("visibilitychange", async () => {
  if (document.hidden || !usuarioMonitorado) return;

  const hoje = new Date().toDateString();

  if (hoje === ultimaVerificacao) return;

  ultimaVerificacao = hoje;

  try {
    const documento = await getDoc(
      doc(db, "assinaturas", usuarioMonitorado)
    );

    const assinatura = documento.exists()
      ? documento.data()
      : null;

    if (!assinaturaAtiva(assinatura)) {
      irParaAssinatura();
    }

  } catch (erro) {
    console.error("Falha ao revalidar assinatura:", erro);
  }
});

window.addEventListener(
  "pagehide",
  pararMonitoramentoAssinatura
);
