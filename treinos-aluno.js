import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let alunoAtual = null;

window.voltar = function () {
  window.location.href = "aluno.html";
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  alunoAtual = user;
  carregarTreinos();
});

async function carregarTreinos() {
  const q = query(
    collection(db, "treinos"),
    where("alunoId", "==", alunoAtual.uid),
    where("status", "==", "ativo")
  );

  const resultado = await getDocs(q);
  const lista = document.getElementById("listaTreinos");

  lista.innerHTML = "";

  if (resultado.empty) {
    lista.innerHTML = "<p>Nenhum treino disponível ainda.</p>";
    return;
  }

  resultado.forEach((docTreino) => {
    const treino = docTreino.data();

    const item = document.createElement("div");
    item.style.background = "#101014";
    item.style.padding = "14px";
    item.style.borderRadius = "12px";
    item.style.marginBottom = "12px";

    item.innerHTML = `
      <strong>${treino.titulo}</strong>
      <p style="text-align:left; margin-top:8px; white-space:pre-line;">${treino.descricao}</p>
    `;

    lista.appendChild(item);
  });
}