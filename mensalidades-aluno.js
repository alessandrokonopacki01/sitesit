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
  carregarMensalidades();
});

async function carregarMensalidades() {
  const q = query(
    collection(db, "mensalidades"),
    where("alunoId", "==", alunoAtual.uid)
  );

  const resultado = await getDocs(q);
  const lista = document.getElementById("listaMensalidades");

  lista.innerHTML = "";

  if (resultado.empty) {
    lista.innerHTML = "<p>Nenhuma mensalidade cadastrada ainda.</p>";
    return;
  }

  resultado.forEach((docMensalidade) => {
    const mensalidade = docMensalidade.data();

    const item = document.createElement("div");
    item.style.background = "#101014";
    item.style.padding = "14px";
    item.style.borderRadius = "12px";
    item.style.marginBottom = "12px";

    let corStatus = "#aaa";

    if (mensalidade.status === "pago") {
      corStatus = "#22c55e";
    }

    if (mensalidade.status === "pendente") {
      corStatus = "#facc15";
    }

    if (mensalidade.status === "atrasado") {
      corStatus = "#ef4444";
    }

    item.innerHTML = `
      <strong>${mensalidade.nomePlano}</strong>
      <p style="text-align:left;">Valor: R$ ${mensalidade.valorPlano.toFixed(2)}</p>
      <p style="text-align:left;">Vencimento: ${mensalidade.vencimento}</p>
      <p style="text-align:left; color:${corStatus}; font-weight:bold;">Status: ${mensalidade.status}</p>
    `;

    lista.appendChild(item);
  });
}