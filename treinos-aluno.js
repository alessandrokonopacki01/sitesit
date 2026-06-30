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

    let exerciciosHtml = "";

if (treino.exercicios && treino.exercicios.length > 0) {
  treino.exercicios.forEach((exercicio, index) => {
    exerciciosHtml += `
      <div style="background:#1c1c24; padding:12px; border-radius:10px; margin-top:10px;">
        <strong>${index + 1}. ${exercicio.nome}</strong>
        <p style="text-align:left;">Grupo: ${exercicio.grupo || "-"}</p>
        <p style="text-align:left;">Séries: ${exercicio.series || "-"}</p>
        <p style="text-align:left;">Repetições: ${exercicio.repeticoes || "-"}</p>
        <p style="text-align:left;">Carga: ${exercicio.carga || "-"}</p>
        <p style="text-align:left;">Descanso: ${exercicio.descanso || "-"}</p>
        <p style="text-align:left;">Obs: ${exercicio.observacao || "-"}</p>
        ${
          exercicio.video
            ? `<p style="text-align:left;"><a href="${exercicio.video}" target="_blank" style="color:#22c55e;">Ver vídeo</a></p>`
            : ""
        }
      </div>
    `;
  });
} else {
  exerciciosHtml = `<p style="text-align:left; margin-top:8px; white-space:pre-line;">${treino.descricao || ""}</p>`;
}

item.innerHTML = `
  <strong>${treino.titulo}</strong>
  ${exerciciosHtml}
`;

    lista.appendChild(item);
  });
}