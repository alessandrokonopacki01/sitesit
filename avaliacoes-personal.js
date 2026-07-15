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
  INFORMACOES_PROTOCOLOS,
  calcularComposicaoCorporal,
  arredondarResultado
} from "./composicao-corporal.js";


let personalAtual = null;
let composicaoCalculada = null;


/* =========================================================
   VOLTAR
========================================================= */

window.voltar = function () {
  window.location.href = "personal.html";
};


/* =========================================================
   AUTENTICAÇÃO
========================================================= */

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  personalAtual = user;

  definirDataAtual();

  await carregarAlunos();

  atualizarCamposDobras();
});


/* =========================================================
   DATA ATUAL
========================================================= */

function definirDataAtual() {
  const campoData =
    document.getElementById("dataAvaliacao");

  if (campoData.value) {
    return;
  }

  const hoje = new Date();

  const ano =
    hoje.getFullYear();

  const mes =
    String(
      hoje.getMonth() + 1
    ).padStart(2, "0");

  const dia =
    String(
      hoje.getDate()
    ).padStart(2, "0");

  campoData.value =
    `${ano}-${mes}-${dia}`;
}


/* =========================================================
   CARREGAR ALUNOS
========================================================= */

async function carregarAlunos() {
  try {
    const consulta = query(
      collection(db, "usuarios"),

      where(
        "tipo",
        "==",
        "aluno"
      ),

      where(
        "personalId",
        "==",
        personalAtual.uid
      )
    );

    const resultado =
      await getDocs(consulta);

    const select =
      document.getElementById(
        "alunoSelect"
      );

    select.innerHTML = `
      <option value="">
        Selecione o aluno
      </option>
    `;

    resultado.forEach((docAluno) => {
      const aluno =
        docAluno.data();

      const option =
        document.createElement(
          "option"
        );

      option.value =
        docAluno.id;

      option.textContent =
        aluno.nome ||
        "Aluno sem nome";

      select.appendChild(option);
    });

  } catch (erro) {
    console.error(
      "Erro ao carregar alunos:",
      erro
    );

    alert(
      "Não foi possível carregar os alunos."
    );
  }
}


/* =========================================================
   ATUALIZAR CAMPOS DAS DOBRAS
========================================================= */

function atualizarCamposDobras() {
  const protocoloSelecionado =
    document.getElementById(
      "protocolo"
    ).value;

  const sexo =
    document.getElementById(
      "sexo"
    ).value;

  const configuracao =
    INFORMACOES_PROTOCOLOS[
      protocoloSelecionado
    ];

  if (!configuracao) {
    alert(
      "O protocolo selecionado não foi encontrado."
    );

    return;
  }

  composicaoCalculada = null;

  limparResultados();

  atualizarCampoIdade(configuracao);

  atualizarDescricaoProtocolo(
    configuracao
  );

  criarCamposDobras(
    configuracao,
    sexo
  );
}

window.atualizarCamposDobras =
  atualizarCamposDobras;


/* =========================================================
   MOSTRAR OU OCULTAR IDADE
========================================================= */

function atualizarCampoIdade(
  configuracao
) {
  const grupoIdade =
    document.getElementById(
      "grupoIdade"
    );

  const campoIdade =
    document.getElementById(
      "idade"
    );

  if (configuracao.precisaIdade) {
    grupoIdade.style.display =
      "block";

    campoIdade.required = true;
  } else {
    grupoIdade.style.display =
      "none";

    campoIdade.required = false;
  }
}


/* =========================================================
   DESCRIÇÃO DO PROTOCOLO
========================================================= */

function atualizarDescricaoProtocolo(
  configuracao
) {
  const descricao =
    document.getElementById(
      "descricaoProtocolo"
    );

  descricao.innerHTML = `
    <p>
      <strong>
        ${configuracao.nome}
      </strong>
    </p>

    <p>
      Informe as dobras em milímetros.
    </p>
  `;
}


/* =========================================================
   CRIAR CAMPOS DAS DOBRAS
========================================================= */

function criarCamposDobras(
  configuracao,
  sexo
) {
  const divDobras =
    document.getElementById(
      "dobras"
    );

  const listaDobras =
    configuracao.dobras[sexo];

  if (!listaDobras) {
    divDobras.innerHTML = `
      <p>
        Este protocolo não está disponível
        para o sexo selecionado.
      </p>
    `;

    return;
  }

  divDobras.innerHTML = "";

  listaDobras.forEach((dobra) => {
    const grupo =
      document.createElement("div");

    grupo.className =
      "campo-dobra";

    const label =
      document.createElement("label");

    label.setAttribute(
      "for",
      `dobra-${dobra.id}`
    );

    label.textContent =
      `${dobra.nome} (mm)`;

    const input =
      document.createElement("input");

    input.type = "number";

    input.id =
      `dobra-${dobra.id}`;

    input.dataset.dobra =
      dobra.id;

    input.placeholder =
      `${dobra.nome} em mm`;

    input.min = "1";
    input.step = "0.1";

    input.addEventListener(
      "input",
      invalidarCalculo
    );

    grupo.appendChild(label);
    grupo.appendChild(input);

    divDobras.appendChild(grupo);
  });
}


/* =========================================================
   INVALIDAR CÁLCULO ANTERIOR
========================================================= */

function invalidarCalculo() {
  composicaoCalculada = null;

  limparResultados();
}


/* =========================================================
   COLETAR DOBRAS
========================================================= */

function coletarDobras() {
  const campos =
    document.querySelectorAll(
      "#dobras input[data-dobra]"
    );

  const dobras = {};

  campos.forEach((campo) => {
    dobras[campo.dataset.dobra] =
      Number(campo.value);
  });

  return dobras;
}


/* =========================================================
   CALCULAR COMPOSIÇÃO
========================================================= */

function calcularComposicao() {
  try {
    const protocolo =
      document.getElementById(
        "protocolo"
      ).value;

    const sexo =
      document.getElementById(
        "sexo"
      ).value;

    const idade =
      document.getElementById(
        "idade"
      ).value;

    const peso =
      Number(
        document.getElementById(
          "peso"
        ).value
      );

    const altura =
      Number(
        document.getElementById(
          "altura"
        ).value
      );

    const configuracao =
      INFORMACOES_PROTOCOLOS[
        protocolo
      ];

    if (!peso || peso <= 0) {
      alert(
        "Informe um peso válido."
      );

      return null;
    }

    if (!altura || altura <= 0) {
      alert(
        "Informe uma altura válida."
      );

      return null;
    }

    if (
      configuracao.precisaIdade &&
      (
        !idade ||
        Number(idade) <= 0
      )
    ) {
      alert(
        "Informe uma idade válida."
      );

      return null;
    }

    const dobras =
      coletarDobras();

    const resultado =
      calcularComposicaoCorporal({
        protocolo,
        sexo,

        idade:
          idade === ""
            ? null
            : Number(idade),

        peso,
        altura,
        dobras
      });

    composicaoCalculada =
      arredondarResultado(
        resultado
      );

    mostrarResultados(
      composicaoCalculada
    );

    return composicaoCalculada;

  } catch (erro) {
    console.error(
      "Erro no cálculo da composição:",
      erro
    );

    alert(
      erro.message ||
      "Não foi possível calcular a composição corporal."
    );

    return null;
  }
}

window.calcularComposicao =
  calcularComposicao;


/* =========================================================
   MOSTRAR RESULTADOS
========================================================= */

function mostrarResultados(
  resultado
) {
  document.getElementById(
    "resultadoProtocolo"
  ).textContent =
    resultado.protocolo;

  document.getElementById(
    "resultadoIMC"
  ).textContent =
    resultado.imc.toFixed(2);

  document.getElementById(
    "resultadoClassificacaoIMC"
  ).textContent =
    resultado.classificacaoIMC;

  document.getElementById(
    "resultadoDobras"
  ).textContent =
    resultado.somaDobras.toFixed(2);

  document.getElementById(
    "resultadoGordura"
  ).textContent =
    `${resultado.percentualGordura.toFixed(2)}%`;

  document.getElementById(
    "resultadoMG"
  ).textContent =
    resultado.massaGorda.toFixed(2);

  document.getElementById(
    "resultadoMM"
  ).textContent =
    resultado.massaMagra.toFixed(2);

  document.getElementById(
    "resultadoDensidade"
  ).textContent =
    resultado.densidadeCorporal === null
      ? "Não utilizada"
      : resultado.densidadeCorporal.toFixed(6);
}


/* =========================================================
   LIMPAR RESULTADOS
========================================================= */

function limparResultados() {
  const ids = [
    "resultadoProtocolo",
    "resultadoIMC",
    "resultadoClassificacaoIMC",
    "resultadoDobras",
    "resultadoGordura",
    "resultadoMG",
    "resultadoMM",
    "resultadoDensidade"
  ];

  ids.forEach((id) => {
    const elemento =
      document.getElementById(id);

    if (elemento) {
      elemento.textContent = "-";
    }
  });
}


/* =========================================================
   SALVAR AVALIAÇÃO
========================================================= */

window.salvarAvaliacao =
  async function () {
    const alunoId =
      document.getElementById(
        "alunoSelect"
      ).value;

    const data =
      document.getElementById(
        "dataAvaliacao"
      ).value;

    const peso =
      Number(
        document.getElementById(
          "peso"
        ).value
      );

    const altura =
      Number(
        document.getElementById(
          "altura"
        ).value
      );

    const cintura =
      converterCampoOpcional(
        "cintura"
      );

    const braco =
      converterCampoOpcional(
        "braco"
      );

    const coxa =
      converterCampoOpcional(
        "coxa"
      );

    const observacoes =
      document.getElementById(
        "observacoes"
      ).value.trim();

    if (
      !alunoId ||
      !data ||
      !peso ||
      !altura
    ) {
      alert(
        "Preencha aluno, data, peso e altura."
      );

      return;
    }

    const composicao =
      calcularComposicao();

    if (!composicao) {
      return;
    }

    try {
      await addDoc(
        collection(
          db,
          "avaliacoes"
        ),
        {
          personalId:
            personalAtual.uid,

          alunoId,
          data,

          peso,
          altura,

          cintura,
          braco,
          coxa,

          protocoloId:
            document.getElementById(
              "protocolo"
            ).value,

          protocolo:
            composicao.protocolo,

          sexo:
            composicao.sexo,

          idade:
            composicao.idade,

          dobras:
            composicao.dobras,

          somaDobras:
            composicao.somaDobras,

          densidadeCorporal:
            composicao.densidadeCorporal,

          equacaoConversao:
            composicao.equacaoConversao,

          gordura:
            composicao.percentualGordura,

          percentualGordura:
            composicao.percentualGordura,

          massaGorda:
            composicao.massaGorda,

          massaMagra:
            composicao.massaMagra,

          imc:
            composicao.imc,

          classificacaoIMC:
            composicao.classificacaoIMC,

          observacaoProtocolo:
            composicao.observacao || null,

          observacoes,

          criadoEm:
            serverTimestamp()
        }
      );

      alert(
        "Avaliação salva com sucesso!"
      );

      limparFormulario();

    } catch (erro) {
      console.error(
        "Erro ao salvar avaliação:",
        erro
      );

      alert(
        "Não foi possível salvar a avaliação. Confira as permissões do Firebase."
      );
    }
  };


/* =========================================================
   CAMPO OPCIONAL
========================================================= */

function converterCampoOpcional(id) {
  const valor =
    document.getElementById(id).value;

  if (
    valor === "" ||
    valor === null
  ) {
    return null;
  }

  return Number(valor);
}


/* =========================================================
   LIMPAR FORMULÁRIO
========================================================= */

function limparFormulario() {
  document.getElementById(
    "peso"
  ).value = "";

  document.getElementById(
    "altura"
  ).value = "";

  document.getElementById(
    "idade"
  ).value = "";

  document.getElementById(
    "cintura"
  ).value = "";

  document.getElementById(
    "braco"
  ).value = "";

  document.getElementById(
    "coxa"
  ).value = "";

  document.getElementById(
    "observacoes"
  ).value = "";

  composicaoCalculada = null;

  atualizarCamposDobras();

  limparResultados();

  definirDataAtual();
}


/* =========================================================
   INVALIDAR RESULTADO AO ALTERAR DADOS
========================================================= */

[
  "peso",
  "altura",
  "idade"
].forEach((id) => {
  const campo =
    document.getElementById(id);

  if (campo) {
    campo.addEventListener(
      "input",
      invalidarCalculo
    );
  }
});