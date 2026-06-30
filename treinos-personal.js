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
let exerciciosGaleria = [];
let fichaAtual = [];

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
  await carregarExercicios();
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

async function carregarExercicios() {
  const q = query(
    collection(db, "exercicios"),
    where("personalId", "==", personalAtual.uid)
  );

  const resultado = await getDocs(q);
  const select = document.getElementById("exercicioSelect");

  exerciciosGaleria = [];

  resultado.forEach((docExercicio) => {
    const exercicio = {
      id: docExercicio.id,
      ...docExercicio.data()
    };

    exerciciosGaleria.push(exercicio);

    const option = document.createElement("option");
    option.value = exercicio.id;
    option.textContent = `${exercicio.nome} - ${exercicio.grupo}`;

    select.appendChild(option);
  });
}

window.adicionarExercicioAoTreino = function () {
  const exercicioId = document.getElementById("exercicioSelect").value;
  const series = document.getElementById("series").value;
  const repeticoes = document.getElementById("repeticoes").value.trim();
  const carga = document.getElementById("carga").value.trim();
  const descanso = document.getElementById("descanso").value.trim();
  const observacao = document.getElementById("observacaoExercicio").value.trim();

  if (!exercicioId || !series || !repeticoes) {
    alert("Selecione o exercício e preencha séries e repetições.");
    return;
  }

  const exercicioBase = exerciciosGaleria.find(ex => ex.id === exercicioId);

  if (!exercicioBase) {
    alert("Exercício não encontrado.");
    return;
  }

  fichaAtual.push({
    exercicioId: exercicioBase.id,
    nome: exercicioBase.nome,
    grupo: exercicioBase.grupo,
    equipamento: exercicioBase.equipamento || "",
    video: exercicioBase.video || "",
    descricao: exercicioBase.descricao || "",
    series: Number(series),
    repeticoes,
    carga,
    descanso,
    observacao
  });

  limparCamposExercicio();
  renderizarFicha();
};

function limparCamposExercicio() {
  document.getElementById("exercicioSelect").value = "";
  document.getElementById("series").value = "";
  document.getElementById("repeticoes").value = "";
  document.getElementById("carga").value = "";
  document.getElementById("descanso").value = "";
  document.getElementById("observacaoExercicio").value = "";
}

function renderizarFicha() {
  const lista = document.getElementById("listaFicha");

  lista.innerHTML = "";

  if (fichaAtual.length === 0) {
    lista.innerHTML = "<p>Nenhum exercício adicionado.</p>";
    return;
  }

  fichaAtual.forEach((exercicio, index) => {
    const item = document.createElement("div");
    item.style.background = "#101014";
    item.style.padding = "14px";
    item.style.borderRadius = "12px";
    item.style.marginBottom = "12px";

    item.innerHTML = `
      <strong>${index + 1}. ${exercicio.nome}</strong>
      <p style="text-align:left;">Grupo: ${exercicio.grupo}</p>
      <p style="text-align:left;">Séries: ${exercicio.series}</p>
      <p style="text-align:left;">Repetições: ${exercicio.repeticoes}</p>
      <p style="text-align:left;">Carga: ${exercicio.carga || "-"}</p>
      <p style="text-align:left;">Descanso: ${exercicio.descanso || "-"}</p>
      <p style="text-align:left;">Obs: ${exercicio.observacao || "-"}</p>
      <button onclick="removerExercicio(${index})" style="margin-top:10px; background:#ef4444;">
        Remover
      </button>
    `;

    lista.appendChild(item);
  });
}

window.removerExercicio = function (index) {
  fichaAtual.splice(index, 1);
  renderizarFicha();
};

window.salvarTreino = async function () {
  const alunoId = document.getElementById("alunoSelect").value;
  const titulo = document.getElementById("tituloTreino").value.trim();

  if (!alunoId || !titulo) {
    alert("Selecione o aluno e digite o título do treino.");
    return;
  }

  if (fichaAtual.length === 0) {
    alert("Adicione pelo menos um exercício.");
    return;
  }

  await addDoc(collection(db, "treinos"), {
    personalId: personalAtual.uid,
    alunoId,
    titulo,
    tipo: "ficha",
    exercicios: fichaAtual,
    status: "ativo",
    criadoEm: serverTimestamp()
  });

  alert("Ficha salva com sucesso!");

  document.getElementById("alunoSelect").value = "";
  document.getElementById("tituloTreino").value = "";
  fichaAtual = [];
  renderizarFicha();
};