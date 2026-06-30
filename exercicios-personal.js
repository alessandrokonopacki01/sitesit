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
  carregarExercicios();
});

window.salvarExercicio = async function () {
  const nome = document.getElementById("nomeExercicio").value.trim();
  const grupo = document.getElementById("grupoMuscular").value.trim();
  const equipamento = document.getElementById("equipamento").value.trim();
  const video = document.getElementById("video").value.trim();
  const descricao = document.getElementById("descricao").value.trim();

  if (!nome || !grupo) {
    alert("Preencha pelo menos o nome e o grupo muscular.");
    return;
  }

  await addDoc(collection(db, "exercicios"), {
    personalId: personalAtual.uid,
    nome,
    grupo,
    equipamento,
    video,
    descricao,
    criadoEm: serverTimestamp()
  });

  alert("Exercício salvo com sucesso!");

  document.getElementById("nomeExercicio").value = "";
  document.getElementById("grupoMuscular").value = "";
  document.getElementById("equipamento").value = "";
  document.getElementById("video").value = "";
  document.getElementById("descricao").value = "";

  carregarExercicios();
};

async function carregarExercicios() {
  const q = query(
    collection(db, "exercicios"),
    where("personalId", "==", personalAtual.uid)
  );

  const resultado = await getDocs(q);
  const lista = document.getElementById("listaExercicios");

  lista.innerHTML = "";

  if (resultado.empty) {
    lista.innerHTML = "<p>Nenhum exercício cadastrado ainda.</p>";
    return;
  }

  resultado.forEach((docExercicio) => {
    const exercicio = docExercicio.data();

    const item = document.createElement("div");
    item.style.background = "#101014";
    item.style.padding = "14px";
    item.style.borderRadius = "12px";
    item.style.marginBottom = "12px";

    item.innerHTML = `
      <strong>${exercicio.nome}</strong>
      <p style="text-align:left;">Grupo: ${exercicio.grupo}</p>
      <p style="text-align:left;">Equipamento: ${exercicio.equipamento || "-"}</p>
      <p style="text-align:left;">Descrição: ${exercicio.descricao || "-"}</p>
      ${
        exercicio.video
          ? `<p style="text-align:left;"><a href="${exercicio.video}" target="_blank" style="color:#22c55e;">Ver vídeo</a></p>`
          : ""
      }
    `;

    lista.appendChild(item);
  });
}