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

import {
  PROTOCOLOS,
  INFORMACOES_PROTOCOLOS,
  calcularComposicaoCorporal,
  arredondarResultado
} from "./composicao-corporal.js";

let personalAtual = null;

/*
  Guarda temporariamente o último cálculo realizado.
  Esses dados serão usados ao salvar a avaliação.
*/
let composicaoCalculada = null;


/* =========================
   BOTÃO VOLTAR
========================= */

window.voltar = function () {
  window.location.href = "personal.html";
};


/* =========================
   VERIFICAÇÃO DO LOGIN
========================= */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  personalAtual = user;

  await carregarAlunos();

  definirDataAtual();

  trocarDobras();
});


/* =========================
   DATA ATUAL
========================= */

function definirDataAtual() {
  const campoData = document.getElementById("dataAvaliacao");

  if (!campoData.value) {
    const hoje = new Date();

    const ano = hoje.getFullYear();
    const mes = String(hoje.getMonth() + 1).padStart(2, "0");
    const dia = String(hoje.getDate()).padStart(2, "0");

    campoData.value = `${ano}-${mes}-${dia}`;
  }
}


/* =========================
   CARREGAR ALUNOS
========================= */

async function carregarAlunos() {
  try {
    const q = query(
      collection(db, "usuarios"),
      where("tipo", "==", "aluno"),
      where("personalId", "==", personalAtual.uid)
    );

    const resultado = await getDocs(q);

    const select = document.getElementById("alunoSelect");

    select.innerHTML = `
      <option value="">Selecione o aluno</option>
    `;

    resultado.forEach((docAluno) => {
      const aluno = docAluno.data();

      const option = document.createElement("option");

      option.value = docAluno.id;
      option.textContent = aluno.nome || "Aluno sem nome";

      select.appendChild(option);
    });

  } catch (erro) {
    console.error("Erro ao carregar alunos:", erro);

    alert("Não foi possível carregar os alunos.");
  }
}


/* =========================
   CAMPOS DAS DOBRAS
========================= */

function trocarDobras() {
  const sexo = document.getElementById("sexo").value;
  const divDobras = document.getElementById("dobras");

  /*
    Sempre que o sexo mudar, o cálculo anterior deixa
    de ser válido.
  */
  composicaoCalculada = null;

  limparResultados();

  if (sexo === "M") {
    divDobras.innerHTML = `
      <label for="dobraPeitoral">
        Dobra peitoral (mm)
      </label>

      <input
        type="number"
        id="dobraPeitoral"
        placeholder="Exemplo: 12"
        min="1"
        step="0.1"
      >

      <label for="dobraAbdomen">
        Dobra abdominal (mm)
      </label>

      <input
        type="number"
        id="dobraAbdomen"
        placeholder="Exemplo: 22"
        min="1"
        step="0.1"
      >

      <label for="dobraCoxa">
        Dobra da coxa (mm)
      </label>

      <input
        type="number"
        id="dobraCoxa"
        placeholder="Exemplo: 18"
        min="1"
        step="0.1"
      >
    `;
  } else {
    divDobras.innerHTML = `
      <label for="dobraTriceps">
        Dobra do tríceps (mm)
      </label>

      <input
        type="number"
        id="dobraTriceps"
        placeholder="Exemplo: 18"
        min="1"
        step="0.1"
      >

      <label for="dobraSupraIliaca">
        Dobra supra-ilíaca (mm)
      </label>

      <input
        type="number"
        id="dobraSupraIliaca"
        placeholder="Exemplo: 20"
        min="1"
        step="0.1"
      >

      <label for="dobraCoxa">
        Dobra da coxa (mm)
      </label>

      <input
        type="number"
        id="dobraCoxa"
        placeholder="Exemplo: 24"
        min="1"
        step="0.1"
      >
    `;
  }
}

window.trocarDobras = trocarDobras;


/* =========================
   PEGAR VALOR DA DOBRA
========================= */

function pegarValor(id) {
  const campo = document.getElementById(id);

  if (!campo) {
    return 0;
  }

  return Number(campo.value);
}


/* =========================
   CÁLCULO DA COMPOSIÇÃO
========================= */

function calcularComposicao() {
  try {
    const sexo =
      document.getElementById("sexo").value;

    const idade =
      Number(document.getElementById("idade").value);

    const peso =
      Number(document.getElementById("peso").value);

    const altura =
      Number(document.getElementById("altura").value);

    let dobras;

    if (sexo === "M") {
      dobras = {
        peitoral: Number(
          document.getElementById("dobraPeitoral").value
        ),

        abdomen: Number(
          document.getElementById("dobraAbdomen").value
        ),

        coxa: Number(
          document.getElementById("dobraCoxa").value
        )
      };
    } else {
      dobras = {
        triceps: Number(
          document.getElementById("dobraTriceps").value
        ),

        supraIliaca: Number(
          document.getElementById("dobraSupraIliaca").value
        ),

        coxa: Number(
          document.getElementById("dobraCoxa").value
        )
      };
    }

    composicaoCalculada =
      calcularJacksonPollock3({
        sexo,
        idade,
        peso,
        altura,
        dobras
      });

    mostrarResultados(composicaoCalculada);

    return composicaoCalculada;

  } catch (erro) {
    console.error("Erro no cálculo:", erro);

    alert(erro.message);

    return null;
  }
}

window.calcularComposicao = calcularComposicao;