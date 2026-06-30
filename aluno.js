import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  updateDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let usuarioAtual = null;

window.abrirModal = function () {
  document.getElementById("modalPersonal").style.display = "flex";
};

window.fecharModal = function () {
  document.getElementById("modalPersonal").style.display = "none";
};

window.sair = async function () {
  await signOut(auth);
  window.location.href = "index.html";
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  usuarioAtual = user;

  const refUsuario = doc(db, "usuarios", user.uid);
  const snapUsuario = await getDoc(refUsuario);

  if (!snapUsuario.exists()) {
    alert("Usuário não encontrado.");
    window.location.href = "index.html";
    return;
  }

  const dados = snapUsuario.data();

  if (dados.tipo !== "aluno") {
    alert("Esta página é exclusiva para alunos.");
    window.location.href = "index.html";
    return;
  }

  document.getElementById("nomeAluno").innerText = dados.nome;

  if (dados.personalId) {
    carregarPersonal(dados.personalId);
  }
});

async function carregarPersonal(personalId) {
  const refPersonal = doc(db, "usuarios", personalId);
  const snapPersonal = await getDoc(refPersonal);

  if (snapPersonal.exists()) {
    const dadosPersonal = snapPersonal.data();
    document.getElementById("nomePersonal").innerText = dadosPersonal.nome;
  }
}

window.conectarPersonal = async function () {
  const codigo = document.getElementById("codigoPersonal").value.trim().toUpperCase();

  if (!codigo) {
    alert("Digite o código do personal.");
    return;
  }

  try {
    const q = query(
      collection(db, "usuarios"),
      where("tipo", "==", "personal"),
      where("codigoPersonal", "==", codigo)
    );

    const resultado = await getDocs(q);

    if (resultado.empty) {
      alert("Personal não encontrado.");
      return;
    }

    let personalEncontrado = null;

    resultado.forEach((docItem) => {
      personalEncontrado = {
        id: docItem.id,
        ...docItem.data()
      };
    });

    await updateDoc(doc(db, "usuarios", usuarioAtual.uid), {
      personalId: personalEncontrado.id
    });

    document.getElementById("nomePersonal").innerText = personalEncontrado.nome;

    fecharModal();
    alert("Personal conectado com sucesso!");

  } catch (erro) {
    alert("Erro ao conectar: " + erro.message);
  }
};