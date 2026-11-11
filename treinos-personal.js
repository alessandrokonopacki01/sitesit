
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  doc,
  getDoc,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================
// CONFIGURAÇÕES
// ==========================================

const $ = id => document.getElementById(id);
const LETRAS = ["A", "B", "C", "D", "E"];

// ==========================================
// ESTADO
// ==========================================

let personalAtual = null;
let alunos = [];
let biblioteca = [];
let fichasExistentes = [];

let letraAtual = "A";
let gruposSelecionados = new Set();
let fichaAtual = [];
let fichaEmEdicao = null;

let salvando = false;
let carregando = false;
let alterado = false;
let versaoAuth = 0;

// ==========================================
// AUXILIARES
// ==========================================

function el(tag, texto = "", classe = "") {
  const elemento = document.createElement(tag);
  elemento.textContent = String(texto);

  if (classe) elemento.className = classe;

  return elemento;
}

function normalizar(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}

function gruposDisponiveis() {
  return [...new Set(
    biblioteca
      .map(ex => String(ex.grupo || "").trim())
      .filter(Boolean)
  )].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function gruposEscolhidos() {
  return gruposDisponiveis().filter(grupo =>
    gruposSelecionados.has(normalizar(grupo))
  );
}

function tituloTreino() {
  const grupos = gruposEscolhidos();

  return grupos.length
    ? `Treino ${letraAtual} - ${grupos.join(" e ")}`
    : `Treino ${letraAtual}`;
}

function letraDaFicha(ficha) {
  if (LETRAS.includes(ficha.letra)) {
    return ficha.letra;
  }

  const titulo = String(ficha.titulo || "");
  const resultado = titulo.match(
    /^treino\s+([ABCDE])(?:\b|[\s\-–:])/i
  );

  return resultado ? resultado[1].toUpperCase() : null;
}

function gruposDaFicha(ficha) {
  if (Array.isArray(ficha.gruposMusculares)) {
    return ficha.gruposMusculares;
  }

  // Compatibilidade com fichas antigas:
  // recupera os grupos presentes nos exercícios.
  const grupos = new Set(
    (ficha.exercicios || [])
      .map(ex => normalizar(ex.grupo))
      .filter(Boolean)
  );

  return gruposDisponiveis().filter(grupo =>
    grupos.has(normalizar(grupo))
  );
}

function alunoSelecionado() {
  return $("alunoSelect").value;
}

function fichaCorrespondente() {
  const alunoId = alunoSelecionado();

  if (!alunoId) return null;

  return fichasExistentes.find(ficha =>
    ficha.alunoId === alunoId &&
    ficha.status === "ativo" &&
    letraDaFicha(ficha) === letraAtual
  ) || null;
}

function avisar(texto, erro = false) {
  const aviso = $("mensagemFicha");

  aviso.textContent = texto;
  aviso.classList.toggle("erro", erro);
}

function confirmarDescarte() {
  return !alterado || confirm(
    "Existem alterações não salvas. Deseja descartá-las?"
  );
}

function marcarAlteracao() {
  alterado = true;
}

// ==========================================
// NAVEGAÇÃO
// ==========================================

$("btnVoltar").addEventListener("click", () => {
  if (!confirmarDescarte()) return;
  location.href = "personal.html";
});

// ==========================================
// AUTENTICAÇÃO
// ==========================================

onAuthStateChanged(auth, async usuario => {
  const versao = ++versaoAuth;

  personalAtual = null;

  if (!usuario) {
    location.replace("index.html");
    return;
  }

  try {
    const perfil = await getDoc(
      doc(db, "usuarios", usuario.uid)
    );

    if (versao !== versaoAuth) return;

    if (
      !perfil.exists() ||
      perfil.data().tipo !== "personal"
    ) {
      location.replace("index.html");
      return;
    }

    personalAtual = usuario;

    carregando = true;
    avisar("Carregando dados...");

    await carregarDados();

    if (versao !== versaoAuth) return;

    carregando = false;
    avisar("");

    renderizarTudo();

  } catch (erro) {
    console.error(erro);
    carregando = false;
    avisar("Erro ao carregar os dados.", true);
  }
});

// ==========================================
// CARREGAR DADOS
// ==========================================

async function carregarDados() {
  const uid = personalAtual.uid;

  const [resultadoAlunos, resultadoExercicios, resultadoFichas] =
    await Promise.all([
      getDocs(query(
        collection(db, "usuarios"),
        where("tipo", "==", "aluno"),
        where("personalId", "==", uid)
      )),

      getDocs(query(
        collection(db, "exercicios"),
        where("personalId", "==", uid)
      )),

      getDocs(query(
        collection(db, "treinos"),
        where("personalId", "==", uid)
      ))
    ]);

  alunos = resultadoAlunos.docs.map(d => ({
    id: d.id,
    ...d.data()
  })).sort((a, b) =>
    (a.nome || "").localeCompare(b.nome || "", "pt-BR")
  );

  biblioteca = resultadoExercicios.docs.map(d => ({
    id: d.id,
    ...d.data()
  })).sort((a, b) =>
    (a.nome || "").localeCompare(b.nome || "", "pt-BR")
  );

  fichasExistentes = resultadoFichas.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  const select = $("alunoSelect");

  select.replaceChildren(
    new Option("Selecione o aluno", "")
  );

  alunos.forEach(aluno => {
    select.add(
      new Option(aluno.nome || "Aluno", aluno.id)
    );
  });
}

// ==========================================
// SELEÇÃO DE ALUNO E LETRA
// ==========================================

$("alunoSelect").addEventListener("change", e => {
  if (!confirmarDescarte()) {
    e.target.value = e.target.dataset.anterior || "";
    return;
  }

  e.target.dataset.anterior = e.target.value;
  carregarFichaSelecionada();
});

document.querySelectorAll(
  "#seletorLetras [data-letra]"
).forEach(botao => {
  botao.addEventListener("click", () => {
    const novaLetra = botao.dataset.letra;

    if (novaLetra === letraAtual) return;
    if (!confirmarDescarte()) return;

    letraAtual = novaLetra;

    carregarFichaSelecionada();
  });
});

function carregarFichaSelecionada() {
  gruposSelecionados.clear();
  fichaAtual = [];
  fichaEmEdicao = null;
  alterado = false;

  const existente = fichaCorrespondente();

  if (existente) {
    fichaEmEdicao = existente.id;

    gruposDaFicha(existente).forEach(grupo => {
      gruposSelecionados.add(normalizar(grupo));
    });

    fichaAtual = (existente.exercicios || []).map(ex => ({
      ...ex,
      series: Number(ex.series) || 3,
      repeticoes: String(ex.repeticoes || "10"),
      descanso: ex.descanso || "60s",
      observacao: ex.observacao || ""
    }));
  }

  avisar("");
  renderizarTudo();
}

// ==========================================
// RESUMO
// ==========================================

function renderizarResumo() {
  document.querySelectorAll(
    "#seletorLetras [data-letra]"
  ).forEach(botao => {
    botao.classList.toggle(
      "ativo",
      botao.dataset.letra === letraAtual
    );
  });

  $("letraResumo").textContent = letraAtual;
  $("tituloResumo").textContent = `Treino ${letraAtual}`;

  $("gruposResumo").textContent =
    gruposEscolhidos().join(" e ") ||
    "Selecione os grupos musculares";

  $("avisoFichaExistente").textContent = fichaEmEdicao
    ? "Ficha existente carregada. As alterações atualizarão esta ficha."
    : "Nova ficha de treino.";
}

// ==========================================
// GRUPOS MUSCULARES
// ==========================================

function renderizarGrupos() {
  const lista = $("listaGrupos");
  lista.replaceChildren();

  const grupos = gruposDisponiveis();

  if (!grupos.length) {
    lista.appendChild(el(
      "p",
      "Nenhum exercício cadastrado na biblioteca.",
      "fit-vazio"
    ));
    return;
  }

  grupos.forEach(grupo => {
    const chave = normalizar(grupo);
    const ativo = gruposSelecionados.has(chave);

    const botao = el(
      "button",
      grupo,
      "fit-grupo"
    );

    botao.type = "button";
    botao.classList.toggle("ativo", ativo);
    botao.setAttribute("aria-pressed", String(ativo));

    botao.addEventListener("click", () => {
      if (salvando) return;

      if (gruposSelecionados.has(chave)) {
        gruposSelecionados.delete(chave);
      } else {
        gruposSelecionados.add(chave);
      }

      // Os exercícios já adicionados não são
      // apagados ao alterar o filtro.
      marcarAlteracao();
      renderizarTudo();
    });

    lista.appendChild(botao);
  });
}

// ==========================================
// BIBLIOTECA FILTRADA
// ==========================================

$("buscaExercicio").addEventListener(
  "input",
  renderizarBiblioteca
);

function renderizarBiblioteca() {
  const lista = $("listaExercicios");
  lista.replaceChildren();

  if (!gruposSelecionados.size) {
    lista.appendChild(el(
      "p",
      "Selecione pelo menos um grupo muscular.",
      "fit-vazio"
    ));
    return;
  }

  const busca = normalizar($("buscaExercicio").value);

  const filtrados = biblioteca.filter(ex =>
    gruposSelecionados.has(normalizar(ex.grupo)) &&
    normalizar(ex.nome).includes(busca)
  );

  if (!filtrados.length) {
    lista.appendChild(el(
      "p",
      "Nenhum exercício encontrado nesses grupos.",
      "fit-vazio"
    ));
    return;
  }

  filtrados.forEach(ex => {
    const incluido = fichaAtual.some(item =>
      item.exercicioId === ex.id
    );

    const card = el("article", "", "fit-exercicio");
    const topo = el("div", "", "fit-exercicio-topo");
    const informacoes = el("div");

    informacoes.appendChild(
      el("strong", ex.nome || "Exercício")
    );

    informacoes.appendChild(
      el("p", ex.grupo || "")
    );

    if (ex.equipamento) {
      informacoes.appendChild(
        el("p", `Equipamento: ${ex.equipamento}`)
      );
    }

    topo.appendChild(informacoes);

    const adicionar = el(
      "button",
      incluido ? "Adicionado" : "+ Adicionar",
      "fit-btn-adicionar"
    );

    adicionar.type = "button";
    adicionar.disabled = incluido || salvando;

    adicionar.addEventListener("click", () => {
      adicionarExercicio(ex.id);
    });

    topo.appendChild(adicionar);
    card.appendChild(topo);
    lista.appendChild(card);
  });
}

// ==========================================
// ADICIONAR EXERCÍCIO À FICHA
// ==========================================

function adicionarExercicio(id) {
  const base = biblioteca.find(ex => ex.id === id);

  if (!base || salvando) return;

  if (fichaAtual.some(ex => ex.exercicioId === id)) {
    return;
  }

  fichaAtual.push({
    exercicioId: base.id,
    nome: base.nome,
    grupo: base.grupo || "",
    equipamento: base.equipamento || "",
    video: base.video || "",
    descricao: base.descricao || "",
    series: 3,
    repeticoes: "10",
    descanso: "60s",
    observacao: ""
  });

  marcarAlteracao();
  renderizarTudo();
}

// ==========================================
// EDITAR EXERCÍCIOS DA FICHA
// ==========================================

function criarCampo(labelTexto, tipo, valor, atualizar) {
  const campo = el("div", "", "fit-campo");

  const label = el("label", labelTexto);

  const input = document.createElement("input");
  input.type = tipo;
  input.value = valor;
  input.setAttribute("aria-label", labelTexto);

  if (tipo === "number") {
    input.min = "1";
    input.max = "50";
    input.step = "1";
  }

  input.addEventListener("input", () => {
    atualizar(input.value);
    marcarAlteracao();
  });

  campo.appendChild(label);
  campo.appendChild(input);

  return campo;
}

function renderizarFicha() {
  const lista = $("listaFicha");
  lista.replaceChildren();

  $("contadorExercicios").textContent =
    `${fichaAtual.length} exercício(s)`;

  if (!fichaAtual.length) {
    lista.appendChild(el(
      "p",
      "Nenhum exercício selecionado.",
      "fit-vazio"
    ));
    return;
  }

  fichaAtual.forEach((ex, index) => {
    const card = el("article", "", "fit-item-ficha");

    const topo = el("div", "", "fit-item-topo");
    const info = el("div");

    info.appendChild(el(
      "strong",
      `${index + 1}. ${ex.nome}`
    ));

    info.appendChild(el("p", ex.grupo || ""));

    topo.appendChild(info);
    card.appendChild(topo);

    const grid = el("div", "", "fit-config-grid");

    grid.appendChild(criarCampo(
      "Séries",
      "number",
      ex.series,
      valor => ex.series = Number(valor)
    ));

    grid.appendChild(criarCampo(
      "Repetições",
      "text",
      ex.repeticoes,
      valor => ex.repeticoes = valor
    ));

    const descansoCampo = el("div", "", "fit-campo");
    descansoCampo.appendChild(el("label", "Descanso"));

    const descanso = document.createElement("select");
    descanso.setAttribute(
      "aria-label",
      `Descanso de ${ex.nome}`
    );

    const opcoes = [
      ["", "Não informado"],
      ["30s", "30 s"],
      ["45s", "45 s"],
      ["60s", "60 s"],
      ["90s", "90 s"],
      ["120s", "120 s"],
      ["180s", "180 s"]
    ];

    if (
      ex.descanso &&
      !opcoes.some(opcao => opcao[0] === ex.descanso)
    ) {
      opcoes.push([ex.descanso, ex.descanso]);
    }

    opcoes.forEach(([valor, texto]) => {
      descanso.add(new Option(texto, valor));
    });

    descanso.value = ex.descanso || "";

    descanso.addEventListener("change", () => {
      ex.descanso = descanso.value;
      marcarAlteracao();
    });

    descansoCampo.appendChild(descanso);
    grid.appendChild(descansoCampo);
    card.appendChild(grid);

    const obsCampo = el(
      "div",
      "",
      "fit-campo fit-observacao"
    );

    obsCampo.appendChild(el("label", "Observações"));

    const obs = document.createElement("textarea");
    obs.rows = 2;
    obs.maxLength = 1000;
    obs.value = ex.observacao || "";
    obs.placeholder = "Orientações para o aluno";
    obs.setAttribute(
      "aria-label",
      `Observações de ${ex.nome}`
    );

    obs.addEventListener("input", () => {
      ex.observacao = obs.value;
      marcarAlteracao();
    });

    obsCampo.appendChild(obs);
    card.appendChild(obsCampo);

    const acoes = el("div", "", "fit-acoes-item");

    const subir = el("button", "↑ Subir");
    subir.disabled = index === 0 || salvando;

    subir.addEventListener("click", () => {
      trocarPosicoes(index, index - 1);
    });

    const descer = el("button", "↓ Descer");
    descer.disabled =
      index === fichaAtual.length - 1 || salvando;

    descer.addEventListener("click", () => {
      trocarPosicoes(index, index + 1);
    });

    const remover = el(
      "button",
      "Remover",
      "fit-remover"
    );

    remover.disabled = salvando;

    remover.addEventListener("click", () => {
      fichaAtual.splice(index, 1);
      marcarAlteracao();
      renderizarTudo();
    });

    acoes.append(subir, descer, remover);
    card.appendChild(acoes);
    lista.appendChild(card);
  });
}

function trocarPosicoes(origem, destino) {
  if (
    destino < 0 ||
    destino >= fichaAtual.length ||
    salvando
  ) return;

  [fichaAtual[origem], fichaAtual[destino]] =
    [fichaAtual[destino], fichaAtual[origem]];

  marcarAlteracao();
  renderizarTudo();
}

// ==========================================
// VALIDAÇÕES
// ==========================================

function validarFicha() {
  if (!alunoSelecionado()) {
    throw new Error("Selecione um aluno.");
  }

  if (!gruposSelecionados.size) {
    throw new Error(
      "Selecione pelo menos um grupo muscular."
    );
  }

  if (!fichaAtual.length) {
    throw new Error(
      "Adicione pelo menos um exercício à ficha."
    );
  }

  for (const ex of fichaAtual) {
    if (
      !Number.isInteger(ex.series) ||
      ex.series < 1 ||
      ex.series > 50
    ) {
      throw new Error(
        `Informe séries válidas para ${ex.nome}.`
      );
    }

    if (!String(ex.repeticoes || "").trim()) {
      throw new Error(
        `Informe as repetições de ${ex.nome}.`
      );
    }
  }
}

// ==========================================
// SALVAR FICHA
// ==========================================

$("btnSalvarTreino").addEventListener(
  "click",
  salvarTreino
);

async function salvarTreino() {
  if (!personalAtual || salvando || carregando) {
    return;
  }

  try {
    validarFicha();

    salvando = true;
    $("btnSalvarTreino").disabled = true;
    $("btnSalvarTreino").textContent = "Salvando...";

    const alunoId = alunoSelecionado();

    const dados = {
      personalId: personalAtual.uid,
      alunoId,
      letra: letraAtual,
      gruposMusculares: gruposEscolhidos(),
      titulo: tituloTreino(),
      tipo: "ficha",
      status: "ativo",

      exercicios: fichaAtual.map(ex => ({
        exercicioId: ex.exercicioId,
        nome: ex.nome,
        grupo: ex.grupo,
        equipamento: ex.equipamento || "",
        video: ex.video || "",
        descricao: ex.descricao || "",
        series: Number(ex.series),
        repeticoes: String(ex.repeticoes).trim(),
        descanso: ex.descanso || "",
        observacao: ex.observacao || ""
      })),

      atualizadoEm: serverTimestamp()
    };

    // Para fichas novas, usa identificação fixa
    // por personal, aluno e letra.
    const id = fichaEmEdicao || (
      `${personalAtual.uid}_${alunoId}_${letraAtual}`
    );

    const referencia = doc(db, "treinos", id);

    await runTransaction(db, async tx => {
      const snap = await tx.get(referencia);

      if (snap.exists()) {
        const existente = snap.data();

        if (
          existente.personalId !== personalAtual.uid ||
          existente.alunoId !== alunoId ||
          (
            letraDaFicha(existente) &&
            letraDaFicha(existente) !== letraAtual
          )
        ) {
          throw new Error(
            "Conflito com uma ficha já cadastrada."
          );
        }

        tx.update(referencia, dados);
      } else {
        tx.set(referencia, {
          ...dados,
          criadoEm: serverTimestamp()
        });
      }
    });

    const fichaLocal = {
      id,
      ...dados
    };

    const indice = fichasExistentes.findIndex(
      ficha => ficha.id === id
    );

    if (indice >= 0) {
      fichasExistentes[indice] = fichaLocal;
    } else {
      fichasExistentes.push(fichaLocal);
    }

    fichaEmEdicao = id;
    alterado = false;

    avisar("Ficha salva com sucesso!");
    alert("Ficha salva com sucesso!");

  } catch (erro) {
    console.error(erro);
    avisar(erro.message || "Erro ao salvar.", true);

  } finally {
    salvando = false;
    $("btnSalvarTreino").disabled = false;
    $("btnSalvarTreino").textContent = "Salvar ficha";
  }
}

// ==========================================
// ATUALIZAÇÃO DA INTERFACE
// ==========================================

function renderizarTudo() {
  renderizarResumo();
  renderizarGrupos();
  renderizarBiblioteca();
  renderizarFicha();
}
