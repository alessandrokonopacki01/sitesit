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
  await carregarAlunos();
  await carregarMensalidades();
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

window.salvarMensalidade = async function () {
  const alunoId = document.getElementById("alunoSelect").value;
  const alunoNome = document.getElementById("alunoSelect").selectedOptions[0]?.textContent;
  const nomePlano = document.getElementById("nomePlano").value.trim();
  const valorPlano = document.getElementById("valorPlano").value;
  const vencimento = document.getElementById("vencimento").value;
  const status = document.getElementById("statusPagamento").value;

  if (!alunoId || !nomePlano || !valorPlano || !vencimento) {
    alert("Preencha todos os campos.");
    return;
  }

  await addDoc(collection(db, "mensalidades"), {
    personalId: personalAtual.uid,
    alunoId,
    alunoNome,
    nomePlano,
    valorPlano: Number(valorPlano),
    vencimento,
    status,
    criadoEm: serverTimestamp()
  });

  alert("Mensalidade salva com sucesso!");

  document.getElementById("nomePlano").value = "";
  document.getElementById("valorPlano").value = "";
  document.getElementById("vencimento").value = "";
  document.getElementById("statusPagamento").value = "pendente";

  carregarMensalidades();
};

async function carregarMensalidades() {
  const q = query(
    collection(db, "mensalidades"),
    where("personalId", "==", personalAtual.uid)
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

    item.innerHTML = `
      <strong>${mensalidade.alunoNome}</strong>
      <p style="text-align:left;">Plano: ${mensalidade.nomePlano}</p>
      <p style="text-align:left;">Valor: R$ ${mensalidade.valorPlano.toFixed(2)}</p>
      <p style="text-align:left;">Vencimento: ${mensalidade.vencimento}</p>
      <p style="text-align:left;">Status: ${mensalidade.status}</p>
    `;

    lista.appendChild(item);
  });
}