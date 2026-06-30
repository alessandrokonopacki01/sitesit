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
  serverTimestamp
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
  carregarAlunos();
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

window.salvarAvaliacao = async function () {
  const alunoId = document.getElementById("alunoSelect").value;
  const data = document.getElementById("dataAvaliacao").value;
  const peso = document.getElementById("peso").value;
  const altura = document.getElementById("altura").value;
  const gordura = document.getElementById("gordura").value;
  const cintura = document.getElementById("cintura").value;
  const braco = document.getElementById("braco").value;
  const coxa = document.getElementById("coxa").value;
  const observacoes = document.getElementById("observacoes").value.trim();

  if (!alunoId || !data || !peso || !altura) {
    alert("Preencha aluno, data, peso e altura.");
    return;
  }

  await addDoc(collection(db, "avaliacoes"), {
    personalId: personalAtual.uid,
    alunoId,
    data,
    peso: Number(peso),
    altura: Number(altura),
    gordura: Number(gordura),
    cintura: Number(cintura),
    braco: Number(braco),
    coxa: Number(coxa),
    observacoes,
    criadoEm: serverTimestamp()
  });

  alert("Avaliação salva com sucesso!");

  document.getElementById("peso").value = "";
  document.getElementById("altura").value = "";
  document.getElementById("gordura").value = "";
  document.getElementById("cintura").value = "";
  document.getElementById("braco").value = "";
  document.getElementById("coxa").value = "";
  document.getElementById("observacoes").value = "";
};