import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  orderBy
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let personalAtual = null;

window.voltar = function () {
  window.location.href = "personal.html";
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  personalAtual = user;

  await carregarAlunos();
  await carregarTreinos();
});

async function carregarAlunos() {
  const q = query(
    collection(db, "usuarios"),
    where("tipo", "==", "aluno"),
    where("personalId", "==", personalAtual.uid)
  );

  const resultado = await getDocs(q);
  const select = document.getElementById("alunoSelect");

  resultado.forEach((docAluno) => {
    const aluno = docAluno.data();

    const option = document.createElement("option");
    option.value = docAluno.id;
    option.textContent = aluno.nome;

    select.appendChild(option);
  });
}

window.salvarTreino = async function () {
  const alunoId = document.getElementById("alunoSelect").value;
  const titulo = document.getElementById("tituloTreino").value.trim();
  const descricao = document.getElementById("descricaoTreino").value.trim();

  if (!alunoId || !titulo || !descricao) {
    alert("Preencha todos os campos.");
    return;
  }

  await addDoc(collection(db, "treinos"), {
    personalId: personalAtual.uid,
    alunoId,
    titulo,
    descricao,
    status: "ativo",
    criadoEm: serverTimestamp()
  });

  alert("Treino salvo com sucesso!");

  document.getElementById("tituloTreino").value = "";
  document.getElementById("descricaoTreino").value = "";

  carregarTreinos();
};

async function carregarTreinos() {
  const q = query(
    collection(db, "treinos"),
    where("personalId", "==", personalAtual.uid)
  );

  const resultado = await getDocs(q);
  const lista = document.getElementById("listaTreinos");

  lista.innerHTML = "";

  if (resultado.empty) {
    lista.innerHTML = "<p>Nenhum treino criado ainda.</p>";
    return;
  }

  resultado.forEach((docTreino) => {
    const treino = docTreino.data();

    const item = document.createElement("div");
    item.style.background = "#101014";
    item.style.padding = "14px";
    item.style.borderRadius = "12px";
    item.style.marginBottom = "10px";

    item.innerHTML = `
      <strong>${treino.titulo}</strong>
      <p style="text-align:left; margin-top:8px;">${treino.descricao}</p>
    `;

    lista.appendChild(item);
  });
}