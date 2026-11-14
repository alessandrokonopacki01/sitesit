
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

// ==========================================
// CONFIGURAÇÕES
// ==========================================

let alunoAtual = null;
let versaoAutenticacao = 0;

const $ = id => document.getElementById(id);

const CAMPOS_MEDIDAS = [
  ["ombros", "Ombros"],
  ["peitoral", "Peitoral"],
  ["pescoco", "Pescoço"],
  ["bracoDireito", "Braço direito"],
  ["bracoEsquerdo", "Braço esquerdo"],
  ["abdomen", "Abdômen"],
  ["cintura", "Cintura"],
  ["gluteos", "Glúteos"],
  ["coxaDireita", "Coxa direita"],
  ["coxaEsquerda", "Coxa esquerda"],
  ["panturrilhaDireita", "Panturrilha direita"],
  ["panturrilhaEsquerda", "Panturrilha esquerda"]
];

// ==========================================
// NAVEGAÇÃO
// ==========================================

window.voltar = function () {
  window.location.href = "aluno.html";
};

// ==========================================
// ESTILOS
// ==========================================

const estilo = document.createElement("style");

estilo.textContent = `
  .avaliacao-item {
    background: #101014;
    border: 1px solid #30303a;
    border-radius: 12px;
    padding: 16px;
    margin-bottom: 14px;
  }

  .avaliacao-data {
    font-size: 15px;
    font-weight: 700;
    margin-bottom: 12px;
  }

  .avaliacao-grupo {
    margin-top: 14px;
    padding-top: 12px;
    border-top: 1px solid #30303a;
  }

  .avaliacao-grupo h3 {
    font-size: 14px;
    margin: 0 0 12px;
  }

  .avaliacao-linha {
    display: flex;
    justify-content: space-between;
    align-items: baseline;
    gap: 12px;
    padding: 7px 0;
    font-size: 13px;
  }

  .avaliacao-linha span {
    color: #aaa;
  }

  .avaliacao-linha strong {
    text-align: right;
    font-weight: 600;
  }

  .avaliacao-observacoes {
    white-space: pre-wrap;
    overflow-wrap: anywhere;
    font-size: 13px;
    line-height: 1.6;
    margin: 8px 0;
  }

  .avaliacao-item details {
    margin-top: 12px;
  }

  .avaliacao-item summary {
    cursor: pointer;
    font-size: 14px;
    font-weight: 700;
    padding: 8px 0;
  }

  .avaliacao-vazio {
    color: #aaa;
    font-size: 13px;
  }
`;

document.head.appendChild(estilo);

// ==========================================
// ELEMENTOS AUXILIARES
// ==========================================

function criarElemento(tag, texto = "", classe = "") {
  const elemento = document.createElement(tag);

  elemento.textContent = String(texto);

  if (classe) {
    elemento.className = classe;
  }

  return elemento;
}

function existeValor(valor) {
  return (
    valor !== undefined &&
    valor !== null &&
    valor !== ""
  );
}

function numeroFormatado(valor, casas = 1) {
  if (!existeValor(valor)) {
    return "-";
  }

  const numero = Number(valor);

  if (!Number.isFinite(numero)) {
    return "-";
  }

  return numero.toLocaleString("pt-BR", {
    minimumFractionDigits: 0,
    maximumFractionDigits: casas
  });
}

function valorComUnidade(valor, unidade, casas = 1) {
  const numero = numeroFormatado(valor, casas);

  return numero === "-"
    ? "-"
    : `${numero} ${unidade}`;
}

function formatarData(data) {
  if (
    typeof data === "string" &&
    /^\d{4}-\d{2}-\d{2}$/.test(data)
  ) {
    const [ano, mes, dia] = data.split("-");

    return `${dia}/${mes}/${ano}`;
  }

  return data || "Não informada";
}

function adicionarLinha(container, titulo, valor) {
  const linha = criarElemento(
    "div",
    "",
    "avaliacao-linha"
  );

  const rotulo = criarElemento(
    "span",
    titulo
  );

  const conteudo = criarElemento(
    "strong",
    valor
  );

  linha.append(rotulo, conteudo);

  container.appendChild(linha);
}

function criarGrupo(titulo) {
  const grupo = criarElemento(
    "section",
    "",
    "avaliacao-grupo"
  );

  grupo.appendChild(
    criarElemento("h3", titulo)
  );

  return grupo;
}

// ==========================================
// AUTENTICAÇÃO
// ==========================================

onAuthStateChanged(auth, async usuario => {
  const versao = ++versaoAutenticacao;

  if (!usuario) {
    window.location.replace("index.html");
    return;
  }

  alunoAtual = usuario;

  await carregarAvaliacoes(
    usuario.uid,
    versao
  );
});

// ==========================================
// CARREGAR AVALIAÇÕES
// ==========================================

async function carregarAvaliacoes(
  alunoId,
  versao
) {
  const lista = $("listaAvaliacoes");

  if (!lista) return;

  lista.replaceChildren(
    criarElemento(
      "p",
      "Carregando avaliações...",
      "avaliacao-vazio"
    )
  );

  try {
    const consulta = query(
      collection(db, "avaliacoes"),
      where("alunoId", "==", alunoId)
    );

    const resultado = await getDocs(consulta);

    // Evita mostrar informações de uma sessão
    // anterior após troca de usuário.
    if (
      versao !== versaoAutenticacao ||
      auth.currentUser?.uid !== alunoId
    ) {
      return;
    }

    lista.replaceChildren();

    if (resultado.empty) {
      lista.appendChild(
        criarElemento(
          "p",
          "Nenhuma avaliação cadastrada ainda.",
          "avaliacao-vazio"
        )
      );

      return;
    }

    const avaliacoes = resultado.docs.map(
      documento => ({
        id: documento.id,
        ...documento.data()
      })
    );

    // Avaliações mais recentes primeiro.
    avaliacoes.sort((a, b) =>
      String(b.data || "").localeCompare(
        String(a.data || "")
      )
    );

    for (const avaliacao of avaliacoes) {
      lista.appendChild(
        criarCartaoAvaliacao(avaliacao)
      );
    }

  } catch (erro) {
    console.error(
      "Erro ao carregar avaliações:",
      erro
    );

    if (versao !== versaoAutenticacao) {
      return;
    }

    lista.replaceChildren(
      criarElemento(
        "p",
        "Não foi possível carregar suas avaliações.",
        "avaliacao-vazio"
      )
    );
  }
}

// ==========================================
// MONTAR CARTÃO DA AVALIAÇÃO
// ==========================================

function criarCartaoAvaliacao(avaliacao) {
  const card = criarElemento(
    "article",
    "",
    "avaliacao-item"
  );

  card.appendChild(
    criarElemento(
      "div",
      `📅 Avaliação de ${formatarData(avaliacao.data)}`,
      "avaliacao-data"
    )
  );

  // ========================================
  // DADOS GERAIS
  // ========================================

  const gerais = criarGrupo(
    "Dados gerais"
  );

  adicionarLinha(
    gerais,
    "Peso",
    valorComUnidade(avaliacao.peso, "kg")
  );

  adicionarLinha(
    gerais,
    "Altura",
    valorComUnidade(avaliacao.altura, "cm")
  );

  let imc = avaliacao.imc;

  if (
    !existeValor(imc) &&
    Number(avaliacao.altura) > 0 &&
    Number(avaliacao.peso) > 0
  ) {
    const alturaMetros =
      Number(avaliacao.altura) / 100;

    imc = Number(avaliacao.peso) /
      (alturaMetros * alturaMetros);
  }

  adicionarLinha(
    gerais,
    "IMC",
    numeroFormatado(imc, 2)
  );

  if (avaliacao.classificacaoIMC) {
    adicionarLinha(
      gerais,
      "Classificação do IMC",
      avaliacao.classificacaoIMC
    );
  }

  card.appendChild(gerais);

  // ========================================
  // COMPOSIÇÃO CORPORAL
  // ========================================

  const composicao = criarGrupo(
    "Composição corporal"
  );

  if (avaliacao.protocolo) {
    adicionarLinha(
      composicao,
      "Protocolo",
      avaliacao.protocolo
    );
  }

  const gordura =
    existeValor(avaliacao.percentualGordura)
      ? avaliacao.percentualGordura
      : avaliacao.gordura;

  adicionarLinha(
    composicao,
    "Gordura corporal",
    valorComUnidade(gordura, "%", 2)
  );

  if (existeValor(avaliacao.massaGorda)) {
    adicionarLinha(
      composicao,
      "Massa gorda",
      valorComUnidade(
        avaliacao.massaGorda,
        "kg",
        2
      )
    );
  }

  if (existeValor(avaliacao.massaMagra)) {
    adicionarLinha(
      composicao,
      "Massa magra",
      valorComUnidade(
        avaliacao.massaMagra,
        "kg",
        2
      )
    );
  }

  if (existeValor(avaliacao.somaDobras)) {
    adicionarLinha(
      composicao,
      "Soma das dobras",
      valorComUnidade(
        avaliacao.somaDobras,
        "mm",
        2
      )
    );
  }

  card.appendChild(composicao);

  // ========================================
  // MEDIDAS CORPORAIS
  // ========================================

  const detalhes = document.createElement("details");

  const resumo = criarElemento(
    "summary",
    "📏 Ver medidas corporais"
  );

  detalhes.appendChild(resumo);

  const medidas = criarGrupo(
    "Perímetros corporais"
  );

  let totalMedidas = 0;

  for (const [campo, titulo] of CAMPOS_MEDIDAS) {
    if (!existeValor(avaliacao[campo])) {
      continue;
    }

    adicionarLinha(
      medidas,
      titulo,
      valorComUnidade(avaliacao[campo], "cm")
    );

    totalMedidas++;
  }

  // ========================================
  // COMPATIBILIDADE COM REGISTROS ANTIGOS
  // ========================================

  if (
    existeValor(avaliacao.braco) &&
    !existeValor(avaliacao.bracoDireito) &&
    !existeValor(avaliacao.bracoEsquerdo)
  ) {
    adicionarLinha(
      medidas,
      "Braço (registro antigo)",
      valorComUnidade(avaliacao.braco, "cm")
    );

    totalMedidas++;
  }

  if (
    existeValor(avaliacao.coxa) &&
    !existeValor(avaliacao.coxaDireita) &&
    !existeValor(avaliacao.coxaEsquerda)
  ) {
    adicionarLinha(
      medidas,
      "Coxa (registro antigo)",
      valorComUnidade(avaliacao.coxa, "cm")
    );

    totalMedidas++;
  }

  if (totalMedidas === 0) {
    medidas.appendChild(
      criarElemento(
        "p",
        "Nenhuma medida corporal registrada.",
        "avaliacao-vazio"
      )
    );
  }

  detalhes.appendChild(medidas);

  // ========================================
  // DOBRAS CUTÂNEAS
  // ========================================

  const dobras = avaliacao.dobras;

  if (
    dobras &&
    typeof dobras === "object" &&
    !Array.isArray(dobras)
  ) {
    const grupoDobras = criarGrupo(
      "Dobras cutâneas"
    );

    let totalDobras = 0;

    for (const [nome, valor] of Object.entries(dobras)) {
      if (!existeValor(valor)) {
        continue;
      }

      const rotulo = nome
        .replace(/([a-z])([A-Z])/g, "$1 $2")
        .replace(/^./, letra => letra.toUpperCase());

      adicionarLinha(
        grupoDobras,
        rotulo,
        valorComUnidade(valor, "mm", 2)
      );

      totalDobras++;
    }

    if (totalDobras > 0) {
      detalhes.appendChild(grupoDobras);
    }
  }

  card.appendChild(detalhes);

  // ========================================
  // OBSERVAÇÕES
  // ========================================

  const observacoes = criarGrupo(
    "Observações do personal"
  );

  observacoes.appendChild(
    criarElemento(
      "p",
      avaliacao.observacoes ||
        "Nenhuma observação registrada.",
      "avaliacao-observacoes"
    )
  );

  card.appendChild(observacoes);

  return card;
}
