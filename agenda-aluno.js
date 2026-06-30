import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs,
  updateDoc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let alunoAtual = null;
let dadosAluno = null;

window.voltar = function () {
  window.location.href = "aluno.html";
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  alunoAtual = user;

  const refAluno = doc(db, "usuarios", user.uid);
  const snapAluno = await getDoc(refAluno);

  if (!snapAluno.exists()) {
    alert("Aluno não encontrado.");
    window.location.href = "index.html";
    return;
  }

  dadosAluno = snapAluno.data();

  if (!dadosAluno.personalId) {
    document.getElementById("listaHorarios").innerHTML =
      "<p>Conecte-se a um personal para ver horários.</p>";
    return;
  }

  carregarHorarios();
});

async function carregarHorarios() {
  const q = query(
    collection(db, "agenda"),
    where("personalId", "==", dadosAluno.personalId),
    where("status", "==", "disponivel")
  );

  const resultado = await getDocs(q);
  const lista = document.getElementById("listaHorarios");

  lista.innerHTML = "";

  if (resultado.empty) {
    lista.innerHTML = "<p>Nenhum horário disponível no momento.</p>";
    return;
  }

  resultado.forEach((docHorario) => {
    const horario = docHorario.data();

    const item = document.createElement("div");
    item.style.background = "#101014";
    item.style.padding = "14px";
    item.style.borderRadius = "12px";
    item.style.marginBottom = "12px";

    item.innerHTML = `
      <strong>${horario.data} às ${horario.hora}</strong>
      <button style="margin-top:10px;" onclick="solicitarHorario('${docHorario.id}')">
        Solicitar horário
      </button>
    `;

    lista.appendChild(item);
  });
}

window.solicitarHorario = async function (horarioId) {
  await updateDoc(doc(db, "agenda", horarioId), {
    alunoId: alunoAtual.uid,
    alunoNome: dadosAluno.nome,
    status: "solicitado"
  });

  alert("Horário solicitado com sucesso!");
  carregarHorarios();
};