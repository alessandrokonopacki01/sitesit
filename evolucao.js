
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  query,
  where,
  doc,
  getDoc,
  getDocs,
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

// ==========================================
// ELEMENTOS E VARIÁVEIS
// ==========================================

const $ = id => document.getElementById(id);

let usuarioAtual = null;
let tipoUsuario = null;
let avaliacoes = [];
let graficos = {};

let cancelarEscuta = null;
let versaoConsulta = 0;

const NOMES_MEDIDAS = {
  bracoDireito: "Braço direito",
  bracoEsquerdo: "Braço esquerdo",
  coxaDireita: "Coxa direita",
  coxaEsquerda: "Coxa esquerda",
  panturrilhaDireita: "Panturrilha direita",
  panturrilhaEsquerda: "Panturrilha esquerda",
  ombros: "Ombros",
  peitoral: "Peitoral",
  pescoco: "Pescoço",
  abdomen: "Abdômen",
  cintura: "Cintura",
  gluteos: "Glúteos",
  braco: "Braço (avaliação antiga)",
  coxa: "Coxa (avaliação antiga)"
};

const COMPOSICAO = {
  percentualGordura: {
    nome: "Percentual de gordura",
    unidade: "%"
  },
  massaGorda: {
    nome: "Massa gorda",
    unidade: "kg"
  },
  massaMagra: {
    nome: "Massa magra",
    unidade: "kg"
  }
};

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function numero(valor) {
  if (
    valor === null ||
    valor === undefined ||
    valor === ""
  ) return null;

  const convertido = typeof valor === "string"
    ? Number(valor.replace(",", "."))
    : Number(valor);

  return Number.isFinite(convertido)
    ? convertido
    : null;
}

function formatarNumero(valor, casas = 2) {
  return Number(valor).toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas
  });
}

function dataValida(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || "")) {
    return false;
  }

  const d = new Date(`${data}T12:00:00`);

  return !Number.isNaN(d.getTime()) &&
    d.getFullYear() === Number(data.slice(0, 4)) &&
    d.getMonth() + 1 === Number(data.slice(5, 7)) &&
    d.getDate() === Number(data.slice(8, 10));
}

function formatarData(data) {
  if (!dataValida(data)) return "--";

  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function obterValor(avaliacao, parametro) {
  // Compatibilidade com avaliações antigas.
  if (parametro === "percentualGordura") {
    return numero(
      avaliacao.percentualGordura ??
      avaliacao.gordura
    );
  }

  return numero(avaliacao[parametro]);
}

function mostrarMensagem(texto) {
  $("mensagemEvolucao").textContent = texto;
}

// ==========================================
// AUTENTICAÇÃO
// ==========================================

$("btnVoltar").addEventListener("click", () => {
  location.href = tipoUsuario === "personal"
    ? "personal.html"
    : "aluno.html";
});

onAuthStateChanged(auth, async usuario => {
  versaoConsulta++;

  if (cancelarEscuta) {
    cancelarEscuta();
    cancelarEscuta = null;
  }

  destruirGraficos();
  avaliacoes = [];
  usuarioAtual = null;
  tipoUsuario = null;

  if (!usuario) {
    location.href = "index.html";
    return;
  }

  const versao = versaoConsulta;

  try {
    const perfil = await getDoc(
      doc(db, "usuarios", usuario.uid)
    );

    if (versao !== versaoConsulta) return;

    if (!perfil.exists()) {
      throw new Error("Perfil não encontrado.");
    }

    const dados = perfil.data();

    if (!["personal", "aluno"].includes(dados.tipo)) {
      throw new Error("Tipo de usuário inválido.");
    }

    usuarioAtual = usuario;
    tipoUsuario = dados.tipo;

    if (tipoUsuario === "personal") {
      $("secaoSelecionarAluno").hidden = false;
      await carregarAlunos();
    } else {
      $("secaoSelecionarAluno").hidden = true;

      $("nomeAlunoEvolucao").textContent =
        dados.nome || "Minha evolução física";

      observarAvaliacoes(usuario.uid);
    }

  } catch (erro) {
    console.error(erro);
    mostrarMensagem(
      erro.message || "Erro ao carregar o perfil."
    );
  }
});

// ==========================================
// LISTA DE ALUNOS DO PERSONAL
// ==========================================

async function carregarAlunos() {
  mostrarMensagem("Carregando alunos...");

  const consulta = query(
    collection(db, "usuarios"),
    where("tipo", "==", "aluno"),
    where("personalId", "==", usuarioAtual.uid)
  );

  const resultado = await getDocs(consulta);

  const select = $("alunoEvolucao");

  select.replaceChildren(
    new Option("Selecione um aluno", "")
  );

  const alunos = resultado.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));

  alunos.sort((a, b) =>
    (a.nome || "").localeCompare(b.nome || "")
  );

  alunos.forEach(aluno => {
    select.add(
      new Option(
        aluno.nome || "Aluno sem nome",
        aluno.id
      )
    );
  });

  if (!alunos.length) {
    mostrarMensagem("Nenhum aluno vinculado ao personal.");
  } else {
    mostrarMensagem("Selecione um aluno para visualizar a evolução.");
  }
}

$("alunoEvolucao").addEventListener("change", event => {
  const alunoId = event.target.value;

  const nome = event.target.selectedOptions[0]?.textContent;

  $("nomeAlunoEvolucao").textContent = alunoId
    ? nome
    : "Selecione um aluno";

  observarAvaliacoes(alunoId);
});

// ==========================================
// CARREGAR AVALIAÇÕES EM TEMPO REAL
// ==========================================

function observarAvaliacoes(alunoId) {
  versaoConsulta++;

  if (cancelarEscuta) {
    cancelarEscuta();
    cancelarEscuta = null;
  }

  avaliacoes = [];
  destruirGraficos();
  limparResumo();

  if (!alunoId) {
    mostrarMensagem("Selecione um aluno.");
    return;
  }

  const versao = versaoConsulta;

  mostrarMensagem("Carregando avaliações físicas...");

  const consulta = query(
    collection(db, "avaliacoes"),
    where("alunoId", "==", alunoId)
  );

  cancelarEscuta = onSnapshot(
    consulta,
    snapshot => {
      if (versao !== versaoConsulta) return;

      avaliacoes = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }))
      .filter(a => {
        if (!dataValida(a.data)) return false;

        // O aluno vê suas avaliações.
        // O personal vê as avaliações feitas por ele.
        if (tipoUsuario === "personal") {
          return a.personalId === usuarioAtual.uid;
        }

        return a.alunoId === usuarioAtual.uid;
      })
      .sort((a, b) =>
        a.data.localeCompare(b.data) ||
        a.id.localeCompare(b.id)
      );

      atualizarPagina();
    },

    erro => {
      console.error(erro);
      mostrarMensagem(
        "Não foi possível carregar as avaliações."
      );
    }
  );
}

// ==========================================
// RESUMO DA EVOLUÇÃO
// ==========================================

function limparResumo() {
  $("totalAvaliacoes").textContent = "0";
  $("pesoAtual").textContent = "--";
  $("variacaoPeso").textContent = "--";
  $("gorduraAtual").textContent = "--";
}

function obterSerie(parametro) {
  return avaliacoes
    .map(a => ({
      data: a.data,
      valor: obterValor(a, parametro)
    }))
    .filter(p => p.valor !== null);
}

function atualizarResumo() {
  $("totalAvaliacoes").textContent =
    avaliacoes.length;

  const pesos = obterSerie("peso");
  const gorduras = obterSerie("percentualGordura");

  if (pesos.length) {
    const primeiro = pesos[0].valor;
    const ultimo = pesos[pesos.length - 1].valor;

    const diferenca = ultimo - primeiro;

    $("pesoAtual").textContent =
      `${formatarNumero(ultimo)} kg`;

    const sinal = diferenca > 0 ? "+" : "";

    $("variacaoPeso").textContent =
      `${sinal}${formatarNumero(diferenca)} kg`;
  }

  if (gorduras.length) {
    const atual = gorduras[gorduras.length - 1].valor;

    $("gorduraAtual").textContent =
      `${formatarNumero(atual)}%`;
  }
}

// ==========================================
// CRIAÇÃO DOS GRÁFICOS
// ==========================================

function destruirGraficos() {
  Object.values(graficos).forEach(grafico => {
    grafico.destroy();
  });

  graficos = {};
}

function criarGrafico(canvasId, parametro, titulo, unidade) {
  const canvas = $(canvasId);

  if (graficos[canvasId]) {
    graficos[canvasId].destroy();
    delete graficos[canvasId];
  }

  if (!window.Chart) {
    mostrarMensagem(
      "Não foi possível carregar a biblioteca de gráficos."
    );
    return;
  }

  const pontos = obterSerie(parametro);

  if (!pontos.length) {
    canvas.style.display = "none";
    return;
  }

  canvas.style.display = "block";

  const datas = pontos.map(p => formatarData(p.data));
  const valores = pontos.map(p => p.valor);

  graficos[canvasId] = new window.Chart(canvas, {
    type: "line",

    data: {
      labels: datas,

      datasets: [{
        label: `${titulo} (${unidade})`,
        data: valores,

        borderColor: "#22c55e",
        backgroundColor: "rgba(34,197,94,0.12)",

        borderWidth: 3,
        pointRadius: 5,
        pointHoverRadius: 7,
        pointBackgroundColor: "#4ade80",
        pointBorderColor: "#ffffff",

        tension: 0.25,
        fill: true,
        spanGaps: false
      }]
    },

    options: {
      responsive: true,
      maintainAspectRatio: false,

      interaction: {
        mode: "index",
        intersect: false
      },

      plugins: {
        legend: {
          display: false
        },

        tooltip: {
          callbacks: {
            label: contexto => {
              return `${titulo}: ${
                formatarNumero(contexto.parsed.y)
              } ${unidade}`;
            }
          }
        }
      },

      scales: {
        x: {
          ticks: {
            color: "#aaa",
            maxRotation: 45
          },

          grid: {
            color: "rgba(255,255,255,0.06)"
          }
        },

        y: {
          ticks: {
            color: "#aaa"
          },

          grid: {
            color: "rgba(255,255,255,0.08)"
          },

          title: {
            display: true,
            text: unidade,
            color: "#aaa"
          }
        }
      }
    }
  });
}

// ==========================================
// GRÁFICO DE PESO
// ==========================================

function atualizarGraficoPeso() {
  criarGrafico(
    "graficoPeso",
    "peso",
    "Peso corporal",
    "kg"
  );
}

// ==========================================
// GRÁFICO DE COMPOSIÇÃO
// ==========================================

function atualizarGraficoComposicao() {
  const parametro = $("tipoComposicao").value;
  const config = COMPOSICAO[parametro];

  if (!config) return;

  criarGrafico(
    "graficoComposicao",
    parametro,
    config.nome,
    config.unidade
  );
}

$("tipoComposicao").addEventListener(
  "change",
  atualizarGraficoComposicao
);

// ==========================================
// GRÁFICO DE MEDIDAS CORPORAIS
// ==========================================

function atualizarGraficoMedidas() {
  const parametro = $("tipoMedida").value;

  const nome = NOMES_MEDIDAS[parametro];

  if (!nome) return;

  criarGrafico(
    "graficoMedidas",
    parametro,
    nome,
    "cm"
  );
}

$("tipoMedida").addEventListener(
  "change",
  atualizarGraficoMedidas
);

// ==========================================
// COMPATIBILIDADE COM AVALIAÇÕES ANTIGAS
// ==========================================

function adicionarMedidasAntigas() {
  const select = $("tipoMedida");

  const possuiBracoAntigo = avaliacoes.some(
    a => numero(a.braco) !== null
  );

  const possuiCoxaAntiga = avaliacoes.some(
    a => numero(a.coxa) !== null
  );

  ["braco", "coxa"].forEach(campo => {
    const existente = [...select.options].find(
      o => o.value === campo
    );

    if (existente) existente.remove();
  });

  if (possuiBracoAntigo) {
    select.add(
      new Option(
        "Braço (avaliações antigas)",
        "braco"
      )
    );
  }

  if (possuiCoxaAntiga) {
    select.add(
      new Option(
        "Coxa (avaliações antigas)",
        "coxa"
      )
    );
  }
}

// ==========================================
// ATUALIZAR TODA A PÁGINA
// ==========================================

function atualizarPagina() {
  limparResumo();

  if (!avaliacoes.length) {
    destruirGraficos();

    [
      "graficoPeso",
      "graficoComposicao",
      "graficoMedidas"
    ].forEach(id => {
      $(id).style.display = "none";
    });

    mostrarMensagem(
      "Este aluno ainda não possui avaliações físicas."
    );

    return;
  }

  adicionarMedidasAntigas();

  atualizarResumo();
  atualizarGraficoPeso();
  atualizarGraficoComposicao();
  atualizarGraficoMedidas();

  mostrarMensagem(
    `${avaliacoes.length} avaliação(ões) encontrada(s).`
  );
}

// ==========================================
// ENCERRAMENTO
// ==========================================

window.addEventListener("pagehide", () => {
  if (cancelarEscuta) cancelarEscuta();
  destruirGraficos();
});
