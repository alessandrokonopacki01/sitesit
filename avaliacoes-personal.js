
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  getDoc,
  doc,
  addDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  INFORMACOES_PROTOCOLOS,
  calcularComposicaoCorporal,
  arredondarResultado
} from "./composicao-corporal.js";

const $ = id => document.getElementById(id);

let personalAtual = null;
let composicaoCalculada = null;
let salvando = false;

const CAMPOS_MEDIDAS = [
  "bracoDireito",
  "bracoEsquerdo",
  "coxaDireita",
  "coxaEsquerda",
  "panturrilhaDireita",
  "panturrilhaEsquerda",
  "ombros",
  "peitoral",
  "pescoco",
  "abdomen",
  "cintura",
  "gluteos"
];

// ==========================================
// NAVEGAÇÃO E AUTENTICAÇÃO
// ==========================================

window.voltar = () => {
  window.location.href = "personal.html";
};

onAuthStateChanged(auth, async user => {
  if (!user) {
    location.href = "index.html";
    return;
  }

  try {
    const perfil = await getDoc(
      doc(db, "usuarios", user.uid)
    );

    if (!perfil.exists() || perfil.data().tipo !== "personal") {
      location.href = "index.html";
      return;
    }

    personalAtual = user;

    definirDataAtual();
    await carregarAlunos();
    atualizarCamposDobras();

  } catch (erro) {
    console.error("Erro de inicialização:", erro);
    alert("Não foi possível carregar as avaliações.");
  }
});

// ==========================================
// DATA DA AVALIAÇÃO
// ==========================================

function definirDataAtual() {
  if ($("dataAvaliacao").value) return;

  const hoje = new Date();

  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1).padStart(2, "0");
  const dia = String(hoje.getDate()).padStart(2, "0");

  $("dataAvaliacao").value = `${ano}-${mes}-${dia}`;
}

// ==========================================
// CARREGAMENTO DOS ALUNOS
// ==========================================

async function carregarAlunos() {
  const consulta = query(
    collection(db, "usuarios"),
    where("tipo", "==", "aluno"),
    where("personalId", "==", personalAtual.uid)
  );

  const resultado = await getDocs(consulta);

  const select = $("alunoSelect");

  select.replaceChildren(
    new Option("Selecione o aluno", "")
  );

  resultado.forEach(documento => {
    const aluno = documento.data();

    select.add(
      new Option(
        aluno.nome || "Aluno sem nome",
        documento.id
      )
    );
  });
}

// ==========================================
// PROTOCOLOS DE COMPOSIÇÃO CORPORAL
// ==========================================

function atualizarCamposDobras() {
  const protocolo = $("protocolo").value;
  const sexo = $("sexo").value;

  const config = INFORMACOES_PROTOCOLOS[protocolo];

  if (!config) {
    alert("Protocolo não encontrado.");
    return;
  }

  invalidarCalculo();

  $("grupoIdade").style.display =
    config.precisaIdade ? "block" : "none";

  $("idade").required = !!config.precisaIdade;

  const descricao = $("descricaoProtocolo");
  descricao.replaceChildren();

  const titulo = document.createElement("strong");
  titulo.textContent = config.nome;

  const texto = document.createElement("p");
  texto.textContent = "Informe as dobras em milímetros (mm).";

  descricao.append(titulo, texto);

  criarCamposDobras(config, sexo);
}

window.atualizarCamposDobras = atualizarCamposDobras;

// ==========================================
// CAMPOS DINÂMICOS DAS DOBRAS
// ==========================================

function criarCamposDobras(config, sexo) {
  const container = $("dobras");
  container.replaceChildren();

  const lista = config.dobras[sexo];

  if (!lista) {
    const aviso = document.createElement("p");
    aviso.textContent =
      "Protocolo indisponível para o sexo selecionado.";

    container.appendChild(aviso);
    return;
  }

  lista.forEach(dobra => {
    const grupo = document.createElement("div");
    grupo.className = "campo-dobra";

    const label = document.createElement("label");
    label.htmlFor = `dobra-${dobra.id}`;
    label.textContent = `${dobra.nome} (mm)`;

    const input = document.createElement("input");
    input.type = "number";
    input.id = `dobra-${dobra.id}`;
    input.dataset.dobra = dobra.id;
    input.min = "0.1";
    input.step = "0.1";
    input.placeholder = "Medida em mm";

    input.addEventListener("input", invalidarCalculo);

    grupo.append(label, input);
    container.appendChild(grupo);
  });
}

// ==========================================
// CONTROLE DOS RESULTADOS
// ==========================================

function invalidarCalculo() {
  composicaoCalculada = null;
  limparResultados();
}

function limparResultados() {
  [
    "resultadoProtocolo",
    "resultadoIMC",
    "resultadoClassificacaoIMC",
    "resultadoDobras",
    "resultadoGordura",
    "resultadoMG",
    "resultadoMM",
    "resultadoDensidade"
  ].forEach(id => {
    const campo = $(id);
    if (campo) campo.textContent = "-";
  });
}

// ==========================================
// COLETA DAS DOBRAS CUTÂNEAS
// ==========================================

function coletarDobras() {
  const dobras = {};

  document.querySelectorAll(
    "#dobras input[data-dobra]"
  ).forEach(input => {
    if (input.value.trim() === "") {
      throw new Error(
        "Preencha todas as dobras do protocolo."
      );
    }

    const valor = Number(input.value);

    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error(
        "Informe medidas válidas para as dobras."
      );
    }

    dobras[input.dataset.dobra] = valor;
  });

  return dobras;
}

// ==========================================
// CÁLCULO DA COMPOSIÇÃO CORPORAL
// ==========================================

function calcularComposicao() {
  try {
    const protocolo = $("protocolo").value;
    const sexo = $("sexo").value;
    const idadeTexto = $("idade").value;

    const peso = Number($("peso").value);
    const altura = Number($("altura").value);

    if (!Number.isFinite(peso) || peso <= 0) {
      throw new Error("Informe um peso válido.");
    }

    if (!Number.isFinite(altura) || altura <= 0) {
      throw new Error("Informe uma altura válida.");
    }

    const configuracao = INFORMACOES_PROTOCOLOS[protocolo];

    if (
      configuracao.precisaIdade &&
      (!idadeTexto || Number(idadeTexto) <= 0)
    ) {
      throw new Error("Informe uma idade válida.");
    }

    const dobras = coletarDobras();

    const resultado = calcularComposicaoCorporal({
      protocolo,
      sexo,
      idade: idadeTexto === ""
        ? null
        : Number(idadeTexto),
      peso,
      altura,
      dobras
    });

    composicaoCalculada = arredondarResultado(resultado);

    mostrarResultados(composicaoCalculada);

    return composicaoCalculada;

  } catch (erro) {
    console.error(erro);
    alert(erro.message || "Erro ao calcular composição.");

    invalidarCalculo();
    return null;
  }
}

window.calcularComposicao = calcularComposicao;

// ==========================================
// EXIBIÇÃO DOS RESULTADOS
// ==========================================

function mostrarResultados(r) {
  $("resultadoProtocolo").textContent = r.protocolo;
  $("resultadoIMC").textContent = r.imc.toFixed(2);

  $("resultadoClassificacaoIMC").textContent =
    r.classificacaoIMC;

  $("resultadoDobras").textContent =
    r.somaDobras.toFixed(2);

  $("resultadoGordura").textContent =
    `${r.percentualGordura.toFixed(2)}%`;

  $("resultadoMG").textContent =
    r.massaGorda.toFixed(2);

  $("resultadoMM").textContent =
    r.massaMagra.toFixed(2);

  $("resultadoDensidade").textContent =
    r.densidadeCorporal == null
      ? "Não utilizada"
      : r.densidadeCorporal.toFixed(6);
}

// ==========================================
// NOVAS MEDIDAS CORPORAIS
// ==========================================

function coletarMedidas() {
  const medidas = {};

  CAMPOS_MEDIDAS.forEach(id => {
    const texto = $(id).value.trim();

    if (texto === "") {
      medidas[id] = null;
      return;
    }

    const valor = Number(texto);

    if (!Number.isFinite(valor) || valor <= 0) {
      throw new Error(
        `Informe uma medida válida para ${id}.`
      );
    }

    medidas[id] = valor;
  });

  return medidas;
}

// ==========================================
// SALVAR AVALIAÇÃO NO FIREBASE
// ==========================================

window.salvarAvaliacao = async function () {
  if (!personalAtual || salvando) return;

  const alunoId = $("alunoSelect").value;
  const data = $("dataAvaliacao").value;

  const peso = Number($("peso").value);
  const altura = Number($("altura").value);

  if (!alunoId) {
    alert("Selecione um aluno.");
    return;
  }

  if (!data) {
    alert("Informe a data da avaliação.");
    return;
  }

  if (
    !Number.isFinite(peso) || peso <= 0 ||
    !Number.isFinite(altura) || altura <= 0
  ) {
    alert("Informe peso e altura válidos.");
    return;
  }

  let medidas;

  try {
    medidas = coletarMedidas();
  } catch (erro) {
    alert(erro.message);
    return;
  }

  const composicao = calcularComposicao();

  if (!composicao) return;

  const observacoes = $("observacoes").value.trim();

  salvando = true;

  try {
    const dados = {
      personalId: personalAtual.uid,
      alunoId,
      data,
      peso,
      altura,

      // Medidas corporais individualizadas
      ...medidas,

      protocoloId: $("protocolo").value,
      protocolo: composicao.protocolo,
      sexo: composicao.sexo,
      idade: composicao.idade,

      dobras: composicao.dobras,
      somaDobras: composicao.somaDobras,

      densidadeCorporal:
        composicao.densidadeCorporal,

      equacaoConversao:
        composicao.equacaoConversao || null,

      gordura: composicao.percentualGordura,
      percentualGordura: composicao.percentualGordura,

      massaGorda: composicao.massaGorda,
      massaMagra: composicao.massaMagra,

      imc: composicao.imc,
      classificacaoIMC: composicao.classificacaoIMC,

      observacaoProtocolo:
        composicao.observacao || null,

      observacoes,

      criadoEm: serverTimestamp()
    };

    await addDoc(collection(db, "avaliacoes"), dados);

    alert("Avaliação física salva com sucesso!");

    limparFormulario();

  } catch (erro) {
    console.error("Erro ao salvar avaliação:", erro);
    alert(
      erro.message || "Não foi possível salvar a avaliação."
    );
  } finally {
    salvando = false;
  }
};

// ==========================================
// LIMPAR FORMULÁRIO
// ==========================================

function limparFormulario() {
  $("peso").value = "";
  $("altura").value = "";
  $("idade").value = "";
  $("observacoes").value = "";

  CAMPOS_MEDIDAS.forEach(id => {
    $(id).value = "";
  });

  composicaoCalculada = null;

  atualizarCamposDobras();
  limparResultados();
}

// ==========================================
// INVALIDAR CÁLCULOS ALTERADOS
// ==========================================

["peso", "altura", "idade"].forEach(id => {
  $(id).addEventListener("input", invalidarCalculo);
});

window.gerarPdfAvaliacao = function () {
  if (!window.jspdf?.jsPDF) {
    alert("A biblioteca de PDF não foi carregada.");
    return;
  }

  const alunoSelect = $("alunoSelect");

  if (!alunoSelect.value) {
    alert("Selecione um aluno.");
    return;
  }

  // Recalcula com os valores atuais,
  // evitando emitir um relatório desatualizado.
  const resultado = calcularComposicao();

  if (!resultado) return;

  let medidas;

  try {
    medidas = coletarMedidas();
  } catch (erro) {
    alert(erro.message);
    return;
  }

  const { jsPDF } = window.jspdf;
  const pdf = new jsPDF();

  const nomeAluno =
    alunoSelect.selectedOptions[0].textContent.trim();

  const data = $("dataAvaliacao").value;

  if (!data) {
    alert("Informe a data da avaliação.");
    return;
  }

  const linhas = [
    ["Aluno", nomeAluno],
    ["Data", data.split("-").reverse().join("/")],
    ["Protocolo", resultado.protocolo],
    ["Peso", `${resultado.peso} kg`],
    ["Altura", `${resultado.altura} cm`],
    ["IMC", resultado.imc.toFixed(2)],
    ["Classificação", resultado.classificacaoIMC],
    ["Soma das dobras", `${resultado.somaDobras.toFixed(2)} mm`],
    ["Gordura corporal", `${resultado.percentualGordura.toFixed(2)}%`],
    ["Massa gorda", `${resultado.massaGorda.toFixed(2)} kg`],
    ["Massa magra", `${resultado.massaMagra.toFixed(2)} kg`]
  ];

  for (const [nome, valor] of Object.entries(medidas)) {
    if (valor !== null) {
      linhas.push([nome, `${valor} cm`]);
    }
  }

  const observacoes = $("observacoes").value.trim();

  pdf.setFont("helvetica", "bold");
  pdf.setFontSize(18);
  pdf.text("FITCOACH", 15, 20);

  pdf.setFontSize(13);
  pdf.text("Avaliação física", 15, 30);

  let y = 43;

  pdf.setFontSize(10);

  for (const [rotulo, valor] of linhas) {
    if (y > 275) {
      pdf.addPage();
      y = 20;
    }

    const texto = `${rotulo}: ${valor}`;

    pdf.setFont("helvetica", "normal");

    const partes = pdf.splitTextToSize(
      texto,
      175
    );

    pdf.text(partes, 15, y);
    y += partes.length * 6 + 3;
  }

  if (observacoes) {
    if (y > 245) {
      pdf.addPage();
      y = 20;
    }

    pdf.setFont("helvetica", "bold");
    pdf.text("Observações:", 15, y);
    y += 7;

    pdf.setFont("helvetica", "normal");

    const partes = pdf.splitTextToSize(
      observacoes,
      175
    );

    for (const parte of partes) {
      if (y > 275) {
        pdf.addPage();
        y = 20;
      }

      pdf.text(parte, 15, y);
      y += 6;
    }
  }

  pdf.save(
    `avaliacao-${alunoSelect.value}-${data}.pdf`
  );
};
