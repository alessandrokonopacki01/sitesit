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
  carregarAvaliacoes();
});

async function carregarAvaliacoes() {
  const q = query(
    collection(db, "avaliacoes"),
    where("alunoId", "==", alunoAtual.uid)
  );

  const resultado = await getDocs(q);
  const lista = document.getElementById("listaAvaliacoes");

  lista.innerHTML = "";

  if (resultado.empty) {
    lista.innerHTML = "<p>Nenhuma avaliação cadastrada ainda.</p>";
    return;
  }

  resultado.forEach((docAvaliacao) => {
    const avaliacao = docAvaliacao.data();

    const imc = avaliacao.altura
      ? (avaliacao.peso / Math.pow(avaliacao.altura / 100, 2)).toFixed(1)
      : "-";

    const item = document.createElement("div");
    item.style.background = "#101014";
    item.style.padding = "14px";
    item.style.borderRadius = "12px";
    item.style.marginBottom = "12px";

    item.innerHTML = `
      <strong>Data: ${avaliacao.data}</strong>
      <p style="text-align:left;">Peso: ${avaliacao.peso || "-"} kg</p>
      <p style="text-align:left;">Altura: ${avaliacao.altura || "-"} cm</p>
      <p style="text-align:left;">IMC: ${imc}</p>
      <p style="text-align:left;">Gordura: ${avaliacao.gordura || "-"}%</p>
      <p style="text-align:left;">Cintura: ${avaliacao.cintura || "-"} cm</p>
      <p style="text-align:left;">Braço: ${avaliacao.braco || "-"} cm</p>
      <p style="text-align:left;">Coxa: ${avaliacao.coxa || "-"} cm</p>
      <p style="text-align:left; margin-top:8px;">Obs: ${avaliacao.observacoes || "Sem observações"}</p>
    `;

    lista.appendChild(item);
  });
}