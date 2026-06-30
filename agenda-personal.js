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
  updateDoc,
  doc,
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
  carregarAgenda();
});

window.criarHorario = async function () {
  const data = document.getElementById("dataHorario").value;
  const hora = document.getElementById("horaHorario").value;

  if (!data || !hora) {
    alert("Escolha a data e o horário.");
    return;
  }

  await addDoc(collection(db, "agenda"), {
    personalId: personalAtual.uid,
    alunoId: null,
    alunoNome: null,
    data,
    hora,
    status: "disponivel",
    criadoEm: serverTimestamp()
  });

  alert("Horário criado com sucesso!");

  document.getElementById("dataHorario").value = "";
  document.getElementById("horaHorario").value = "";

  carregarAgenda();
};

async function carregarAgenda() {
  const q = query(
    collection(db, "agenda"),
    where("personalId", "==", personalAtual.uid)
  );

  const resultado = await getDocs(q);
  const lista = document.getElementById("listaAgenda");

  lista.innerHTML = "";

  if (resultado.empty) {
    lista.innerHTML = "<p>Nenhum horário criado ainda.</p>";
    return;
  }

  resultado.forEach((docAgenda) => {
    const itemAgenda = docAgenda.data();

    const item = document.createElement("div");
    item.style.background = "#101014";
    item.style.padding = "14px";
    item.style.borderRadius = "12px";
    item.style.marginBottom = "12px";

    let textoStatus = itemAgenda.status;

    if (itemAgenda.status === "solicitado") {
      textoStatus = `Solicitado por ${itemAgenda.alunoNome}`;
    }

    if (itemAgenda.status === "confirmado") {
      textoStatus = `Confirmado com ${itemAgenda.alunoNome}`;
    }

    item.innerHTML = `
      <strong>${itemAgenda.data} às ${itemAgenda.hora}</strong>
      <p style="text-align:left;">Status: ${textoStatus}</p>
      ${
        itemAgenda.status === "solicitado"
          ? `<button onclick="confirmarHorario('${docAgenda.id}')">Confirmar</button>`
          : ""
      }
    `;

    lista.appendChild(item);
  });
}

window.confirmarHorario = async function (agendaId) {
  await updateDoc(doc(db, "agenda", agendaId), {
    status: "confirmado"
  });

  alert("Horário confirmado!");
  carregarAgenda();
};