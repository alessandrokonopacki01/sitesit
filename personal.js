
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  autorizarPersonal,
  pararMonitoramentoAssinatura
} from "./bloqueio-personal.js";

// ==========================================
// ELEMENTOS E ESTADO
// ==========================================

let dadosPersonal = null;
let versaoAutenticacao = 0;

const $ = id => document.getElementById(id);

// Oculta o painel enquanto a assinatura
// ainda está sendo verificada.
const painel = document.querySelector("main.app");

if (painel) {
  painel.hidden = true;
}

// ==========================================
// SAIR DA CONTA
// ==========================================

window.sair = async function () {
  pararMonitoramentoAssinatura();

  try {
    await signOut(auth);
    window.location.replace("index.html");
  } catch (erro) {
    console.error("Erro ao sair:", erro);
    alert("Não foi possível sair da conta.");
  }
};

// ==========================================
// COPIAR CÓDIGO DO PERSONAL
// ==========================================

window.copiarCodigo = async function () {
  const codigo = $("codigoPersonal")?.textContent?.trim();

  if (!codigo || codigo === "Carregando...") {
    alert("Código ainda não disponível.");
    return;
  }

  try {
    await navigator.clipboard.writeText(codigo);

    alert("Código copiado: " + codigo);
  } catch (erro) {
    console.error(erro);
    alert("Não foi possível copiar o código.");
  }
};

// ==========================================
// AUTENTICAÇÃO E BLOQUEIO
// ==========================================

onAuthStateChanged(auth, async user => {
  const versao = ++versaoAutenticacao;

  if (painel) painel.hidden = true;

  dadosPersonal = null;
  pararMonitoramentoAssinatura();

  if (!user) {
    window.location.replace("index.html");
    return;
  }

  try {
    // Primeiro verificamos a assinatura.
    // Nenhuma informação dos alunos é carregada
    // antes da autorização.

    const autorizado = await autorizarPersonal(user);

    if (versao !== versaoAutenticacao) return;

    if (!autorizado) {
      return;
    }

    // ======================================
    // PERFIL DO PERSONAL
    // ======================================

    const refPersonal = doc(
      db,
      "usuarios",
      user.uid
    );

    const snapPersonal = await getDoc(refPersonal);

    if (versao !== versaoAutenticacao) return;

    if (!snapPersonal.exists()) {
      alert("Usuário não encontrado.");
      window.location.replace("index.html");
      return;
    }

    dadosPersonal = snapPersonal.data();

    if (dadosPersonal.tipo !== "personal") {
      alert("Esta página é exclusiva para personais.");
      window.location.replace("index.html");
      return;
    }

    // ======================================
    // DADOS DO PAINEL
    // ======================================

    $("nomePersonal").textContent =
      dadosPersonal.nome || "Personal";

    $("codigoPersonal").textContent =
      dadosPersonal.codigoPersonal ||
      "Código não cadastrado";

    // Somente agora o painel é exibido.
    if (painel) painel.hidden = false;

    await carregarAlunos(user.uid, versao);

  } catch (erro) {
    console.error("Erro ao carregar painel:", erro);

    if (versao === versaoAutenticacao) {
      if (painel) painel.hidden = true;

      alert(
        "Não foi possível verificar o acesso ao FitCoach."
      );
    }
  }
});

// ==========================================
// CARREGAR ALUNOS VINCULADOS
// ==========================================

async function carregarAlunos(personalId, versao) {
  const lista = $("listaAlunos");
  const total = $("totalAlunos");

  lista.replaceChildren();

  const carregando = document.createElement("p");
  carregando.textContent = "Carregando alunos...";

  lista.appendChild(carregando);

  try {
    const consulta = query(
      collection(db, "usuarios"),
      where("tipo", "==", "aluno"),
      where("personalId", "==", personalId)
    );

    const resultado = await getDocs(consulta);

    // Evita apresentar resultados antigos caso
    // o usuário tenha trocado de conta.
    if (versao !== versaoAutenticacao) return;

    lista.replaceChildren();

    if (resultado.empty) {
      const mensagem = document.createElement("p");
      mensagem.textContent =
        "Nenhum aluno vinculado ainda.";

      lista.appendChild(mensagem);
      total.textContent = "0 alunos";
      return;
    }

    total.textContent =
      `${resultado.size} aluno(s)`;

    resultado.forEach(documento => {
      const aluno = documento.data();

      const item = document.createElement("div");

      item.style.background = "#101014";
      item.style.padding = "14px";
      item.style.borderRadius = "12px";
      item.style.marginBottom = "10px";

      const nome = document.createElement("strong");
      nome.textContent =
        aluno.nome || "Aluno sem nome";

      const email = document.createElement("p");
      email.textContent =
        aluno.email || "E-mail não informado";

      email.style.textAlign = "left";
      email.style.marginTop = "5px";

      item.appendChild(nome);
      item.appendChild(email);

      lista.appendChild(item);
    });

  } catch (erro) {
    console.error("Erro ao carregar alunos:", erro);

    if (versao !== versaoAutenticacao) return;

    lista.replaceChildren();

    const mensagem = document.createElement("p");
    mensagem.textContent =
      "Não foi possível carregar os alunos.";

    lista.appendChild(mensagem);
  }
}

// ==========================================
// ENCERRAMENTO
// ==========================================

window.addEventListener("pagehide", () => {
  pararMonitoramentoAssinatura();
});
