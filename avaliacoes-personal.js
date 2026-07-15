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
  const peso = Number(
    document.getElementById("peso").value
  );

  const alturaCm = Number(
    document.getElementById("altura").value
  );

  const idade = Number(
    document.getElementById("idade").value
  );

  const sexo = document.getElementById("sexo").value;

  if (!peso || peso <= 0) {
    alert("Informe um peso válido.");
    return null;
  }

  if (!alturaCm || alturaCm <= 0) {
    alert("Informe uma altura válida.");
    return null;
  }

  if (!idade || idade <= 0 || idade > 120) {
    alert("Informe uma idade válida.");
    return null;
  }

  let dobra1;
  let dobra2;
  let dobra3;
  let nomeDobra1;
  let nomeDobra2;
  let nomeDobra3;

  if (sexo === "M") {
    dobra1 = pegarValor("dobraPeitoral");
    dobra2 = pegarValor("dobraAbdomen");
    dobra3 = pegarValor("dobraCoxa");

    nomeDobra1 = "peitoral";
    nomeDobra2 = "abdomen";
    nomeDobra3 = "coxa";
  } else {
    dobra1 = pegarValor("dobraTriceps");
    dobra2 = pegarValor("dobraSupraIliaca");
    dobra3 = pegarValor("dobraCoxa");

    nomeDobra1 = "triceps";
    nomeDobra2 = "supraIliaca";
    nomeDobra3 = "coxa";
  }

  if (
    dobra1 <= 0 ||
    dobra2 <= 0 ||
    dobra3 <= 0
  ) {
    alert("Preencha corretamente as três dobras cutâneas.");

    return null;
  }

  const somaDobras = dobra1 + dobra2 + dobra3;

  let densidadeCorporal;

  if (sexo === "M") {
    densidadeCorporal =
      1.10938
      - (0.0008267 * somaDobras)
      + (0.0000016 * Math.pow(somaDobras, 2))
      - (0.0002574 * idade);
  } else {
    densidadeCorporal =
      1.0994921
      - (0.0009929 * somaDobras)
      + (0.0000023 * Math.pow(somaDobras, 2))
      - (0.0001392 * idade);
  }

  const percentualGordura =
    (495 / densidadeCorporal) - 450;

  const massaGorda =
    peso * percentualGordura / 100;

  const massaMagra =
    peso - massaGorda;

  const alturaMetros =
    alturaCm / 100;

  const imc =
    peso / Math.pow(alturaMetros, 2);

  /*
    Validação para evitar que uma medida digitada
    incorretamente gere resultado impossível.
  */
  if (
    !Number.isFinite(percentualGordura) ||
    percentualGordura < 0 ||
    percentualGordura > 70
  ) {
    alert(
      "O resultado ficou fora do intervalo esperado. Confira as medidas das dobras."
    );

    return null;
  }

  const dobras = {
    [nomeDobra1]: dobra1,
    [nomeDobra2]: dobra2,
    [nomeDobra3]: dobra3
  };

  composicaoCalculada = {
    protocolo: "Jackson e Pollock - 3 dobras",
    equacaoConversao: "Siri",
    sexo,
    idade,
    dobras,
    somaDobras,
    densidadeCorporal,
    percentualGordura,
    massaGorda,
    massaMagra,
    imc
  };

  mostrarResultados(composicaoCalculada);

  return composicaoCalculada;
}

window.calcularComposicao = calcularComposicao;


/* =========================
   MOSTRAR RESULTADOS
========================= */

function mostrarResultados(resultado) {
  document.getElementById(
    "resultadoIMC"
  ).textContent = resultado.imc.toFixed(1);

  document.getElementById(
    "resultadoDobras"
  ).textContent = resultado.somaDobras.toFixed(1);

  document.getElementById(
    "resultadoGordura"
  ).textContent =
    `${resultado.percentualGordura.toFixed(1)}%`;

  document.getElementById(
    "resultadoMG"
  ).textContent = resultado.massaGorda.toFixed(1);

  document.getElementById(
    "resultadoMM"
  ).textContent = resultado.massaMagra.toFixed(1);
}


/* =========================
   LIMPAR RESULTADOS
========================= */

function limparResultados() {
  document.getElementById(
    "resultadoIMC"
  ).textContent = "-";

  document.getElementById(
    "resultadoDobras"
  ).textContent = "-";

  document.getElementById(
    "resultadoGordura"
  ).textContent = "-";

  document.getElementById(
    "resultadoMG"
  ).textContent = "-";

  document.getElementById(
    "resultadoMM"
  ).textContent = "-";
}


/* =========================
   SALVAR AVALIAÇÃO
========================= */

window.salvarAvaliacao = async function () {
  const alunoId =
    document.getElementById("alunoSelect").value;

  const data =
    document.getElementById("dataAvaliacao").value;

  const peso =
    Number(document.getElementById("peso").value);

  const altura =
    Number(document.getElementById("altura").value);

  const cintura =
    Number(document.getElementById("cintura").value) || null;

  const braco =
    Number(document.getElementById("braco").value) || null;

  const coxa =
    Number(document.getElementById("coxa").value) || null;

  const observacoes =
    document.getElementById("observacoes").value.trim();

  if (!alunoId || !data || !peso || !altura) {
    alert("Preencha aluno, data, peso e altura.");

    return;
  }

  /*
    Calcula novamente antes de salvar.
    Assim, se o usuário alterar alguma medida depois de
    clicar em calcular, o sistema salva o valor atualizado.
  */
  const composicao = calcularComposicao();

  if (!composicao) {
    return;
  }

  try {
    await addDoc(collection(db, "avaliacoes"), {
      personalId: personalAtual.uid,
      alunoId,
      data,

      peso,
      altura,

      cintura,
      braco,
      coxa,

      gordura: Number(
        composicao.percentualGordura.toFixed(2)
      ),

      percentualGordura: Number(
        composicao.percentualGordura.toFixed(2)
      ),

      massaGorda: Number(
        composicao.massaGorda.toFixed(2)
      ),

      massaMagra: Number(
        composicao.massaMagra.toFixed(2)
      ),

      imc: Number(
        composicao.imc.toFixed(2)
      ),

      sexo: composicao.sexo,
      idade: composicao.idade,

      protocolo: composicao.protocolo,
      equacaoConversao: composicao.equacaoConversao,

      dobras: composicao.dobras,

      somaDobras: Number(
        composicao.somaDobras.toFixed(2)
      ),

      densidadeCorporal: Number(
        composicao.densidadeCorporal.toFixed(6)
      ),

      observacoes,

      criadoEm: serverTimestamp()
    });

    alert("Avaliação salva com sucesso!");

    limparFormulario();

  } catch (erro) {
    console.error("Erro ao salvar avaliação:", erro);

    alert(
      "Não foi possível salvar a avaliação. Confira o console e as permissões do Firebase."
    );
  }
};


/* =========================
   LIMPAR FORMULÁRIO
========================= */

function limparFormulario() {
  document.getElementById("peso").value = "";
  document.getElementById("altura").value = "";
  document.getElementById("idade").value = "";

  document.getElementById("cintura").value = "";
  document.getElementById("braco").value = "";
  document.getElementById("coxa").value = "";

  document.getElementById("observacoes").value = "";

  composicaoCalculada = null;

  trocarDobras();

  limparResultados();
}