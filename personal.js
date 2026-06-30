import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged,
  signOut
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  getDocs
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let dadosPersonal = null;

window.sair = async function () {
  await signOut(auth);
  window.location.href = "index.html";
};

window.copiarCodigo = function () {
  const codigo = document.getElementById("codigoPersonal").innerText;

  navigator.clipboard.writeText(codigo)
    .then(() => {
      alert("Código copiado: " + codigo);
    })
    .catch(() => {
      alert("Não foi possível copiar o código.");
    });
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  const refPersonal = doc(db, "usuarios", user.uid);
  const snapPersonal = await getDoc(refPersonal);

  if (!snapPersonal.exists()) {
    alert("Usuário não encontrado.");
    window.location.href = "index.html";
    return;
  }

  dadosPersonal = snapPersonal.data();

  if (dadosPersonal.tipo !== "personal") {
    alert("Esta página é exclusiva para personais.");
    window.location.href = "index.html";
    return;
  }

  document.getElementById("nomePersonal").innerText = dadosPersonal.nome;
  document.getElementById("codigoPersonal").innerText = dadosPersonal.codigoPersonal;

  carregarAlunos(user.uid);
});

async function carregarAlunos(personalId) {
  const q = query(
    collection(db, "usuarios"),
    where("tipo", "==", "aluno"),
    where("personalId", "==", personalId)
  );

  const resultado = await getDocs(q);

  const lista = document.getElementById("listaAlunos");
  const total = document.getElementById("totalAlunos");

  lista.innerHTML = "";

  if (resultado.empty) {
    lista.innerHTML = "<p>Nenhum aluno vinculado ainda.</p>";
    total.innerText = "0 alunos";
    return;
  }

  total.innerText = `${resultado.size} aluno(s)`;

  resultado.forEach((docAluno) => {
    const aluno = docAluno.data();

    const item = document.createElement("div");
    item.style.background = "#101014";
    item.style.padding = "14px";
    item.style.borderRadius = "12px";
    item.style.marginBottom = "10px";

    item.innerHTML = `
      <strong>${aluno.nome}</strong>
      <p style="text-align:left; margin-top:5px;">${aluno.email}</p>
    `;

    lista.appendChild(item);
  });
}