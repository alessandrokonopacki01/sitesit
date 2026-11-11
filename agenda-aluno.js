
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
  runTransaction,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  horarioFuturo,
  ordenarHorarios,
  criarCartao,
  botao,
  mostrarMensagem
} from "./agenda-comum.js";

// ==========================================
// CONFIGURAÇÕES
// ==========================================

const $ = id => document.getElementById(id);

const LIMITE_SOLICITACOES = 40;

const MESES = [
  "Janeiro", "Fevereiro", "Março",
  "Abril", "Maio", "Junho",
  "Julho", "Agosto", "Setembro",
  "Outubro", "Novembro", "Dezembro"
];

// ==========================================
// ESTADO
// ==========================================

let usuarioAtual = null;
let dadosAluno = null;

let horarios = [];
let selecionados = new Map();

let cancelarAgenda = null;
let versaoAutenticacao = 0;
let enviando = false;

let dataSelecionada = hojeISO();
let mesAtual = dataSelecionada.slice(0, 7);

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function elemento(tag, texto = "", classe = "") {
  const el = document.createElement(tag);

  el.textContent = String(texto);

  if (classe) el.className = classe;

  return el;
}

function hojeISO() {
  const agora = new Date();

  const ano = agora.getFullYear();
  const mes = String(agora.getMonth() + 1).padStart(2, "0");
  const dia = String(agora.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function dataISO(ano, mes, dia) {
  return (
    `${ano}-` +
    `${String(mes).padStart(2, "0")}-` +
    `${String(dia).padStart(2, "0")}`
  );
}

function dataBR(data) {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function mesDeslocado(mes, deslocamento) {
  const [ano, numero] = mes.split("-").map(Number);

  const data = new Date(
    ano,
    numero - 1 + deslocamento,
    1
  );

  return dataISO(
    data.getFullYear(),
    data.getMonth() + 1,
    1
  ).slice(0, 7);
}

function statusReservado(h) {
  return (
    h.status === "solicitado" ||
    h.status === "confirmado"
  );
}

function duracaoHorario(h) {
  const duracao = Number(h.duracaoMinutos);

  return Number.isFinite(duracao) && duracao > 0
    ? duracao
    : 60;
}

function minutos(hora) {
  const [h, m] = String(hora).split(":").map(Number);
  return h * 60 + m;
}

function intervalosColidem(a, b, c, d) {
  return a < d && b > c;
}

function mesmoPeriodo(a, b) {
  if (a.data !== b.data) return false;

  const inicioA = minutos(a.hora);
  const inicioB = minutos(b.hora);

  return intervalosColidem(
    inicioA,
    inicioA + duracaoHorario(a),
    inicioB,
    inicioB + duracaoHorario(b)
  );
}

function meusAgendamentos() {
  return horarios.filter(h =>
    h.alunoId === usuarioAtual?.uid &&
    statusReservado(h) &&
    horarioFuturo(h.data, h.hora)
  );
}

function disponiveis() {
  return horarios.filter(h =>
    h.status === "disponivel" &&
    horarioFuturo(h.data, h.hora)
  );
}

function mensagem(texto) {
  $("mensagemSolicitacao").textContent = texto;
}

// ==========================================
// NAVEGAÇÃO
// ==========================================

$("btnVoltar").onclick = () => {
  location.href = "aluno.html";
};

$("mesAnterior").onclick = () => {
  const anterior = mesDeslocado(mesAtual, -1);

  if (anterior < hojeISO().slice(0, 7)) return;

  mesAtual = anterior;
  selecionarPrimeiroDiaMes();
  atualizarInterface();
};

$("mesProximo").onclick = () => {
  mesAtual = mesDeslocado(mesAtual, 1);
  selecionarPrimeiroDiaMes();
  atualizarInterface();
};

function selecionarPrimeiroDiaMes() {
  const datas = disponiveis()
    .filter(h => h.data.startsWith(mesAtual))
    .map(h => h.data)
    .sort();

  dataSelecionada = datas[0] || `${mesAtual}-01`;
}

// ==========================================
// AUTENTICAÇÃO
// ==========================================

onAuthStateChanged(auth, async usuario => {
  const versao = ++versaoAutenticacao;

  if (cancelarAgenda) {
    cancelarAgenda();
    cancelarAgenda = null;
  }

  usuarioAtual = null;
  dadosAluno = null;
  horarios = [];
  selecionados.clear();

  if (!usuario) {
    location.replace("index.html");
    return;
  }

  try {
    const perfil = await getDoc(
      doc(db, "usuarios", usuario.uid)
    );

    if (versao !== versaoAutenticacao) return;

    if (
      !perfil.exists() ||
      perfil.data().tipo !== "aluno"
    ) {
      location.replace("index.html");
      return;
    }

    usuarioAtual = usuario;
    dadosAluno = perfil.data();

    if (!dadosAluno.personalId) {
      $("mensagemHorarios").textContent =
        "Conecte-se a um personal para agendar.";

      mostrarMensagem(
        $("listaMeusHorarios"),
        "Nenhum agendamento."
      );

      atualizarInterface();
      return;
    }

    observarAgenda();

  } catch (erro) {
    console.error(erro);

    $("mensagemHorarios").textContent =
      "Não foi possível carregar sua agenda.";
  }
});

// ==========================================
// AGENDA EM TEMPO REAL
// ==========================================

function observarAgenda() {
  const consulta = query(
    collection(db, "agenda"),
    where("personalId", "==", dadosAluno.personalId)
  );

  cancelarAgenda = onSnapshot(
    consulta,

    snapshot => {
      horarios = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })).sort(ordenarHorarios);

      // Remove seleções que deixaram de estar
      // disponíveis depois de uma atualização.
      const idsDisponiveis = new Set(
        disponiveis().map(h => h.id)
      );

      for (const id of selecionados.keys()) {
        if (!idsDisponiveis.has(id)) {
          selecionados.delete(id);
        }
      }

      atualizarInterface();
    },

    erro => {
      console.error(erro);

      $("mensagemHorarios").textContent =
        "Erro ao carregar horários disponíveis.";
    }
  );
}

// ==========================================
// CALENDÁRIO
// ==========================================

function renderizarCalendario() {
  const [ano, mes] = mesAtual.split("-").map(Number);

  $("tituloMes").textContent =
    `${MESES[mes - 1]} de ${ano}`;

  $("mesAnterior").disabled =
    mesAtual <= hojeISO().slice(0, 7);

  const calendario = $("calendarioDias");
  calendario.replaceChildren();

  const primeiroDia = new Date(
    ano,
    mes - 1,
    1
  ).getDay();

  const totalDias = new Date(
    ano,
    mes,
    0
  ).getDate();

  const diasDisponiveis = new Set(
    disponiveis().map(h => h.data)
  );

  const diasSelecionados = new Set(
    [...selecionados.values()].map(h => h.data)
  );

  for (let i = 0; i < primeiroDia; i++) {
    calendario.appendChild(
      elemento("span", "", "calendario-vazio")
    );
  }

  for (let dia = 1; dia <= totalDias; dia++) {
    const data = dataISO(ano, mes, dia);

    const possuiHorario = diasDisponiveis.has(data);
    const possuiSelecao = diasSelecionados.has(data);

    const ativo = data === dataSelecionada;

    const botaoDia = elemento(
      "button",
      String(dia),
      "calendario-dia"
    );

    botaoDia.type = "button";

    botaoDia.setAttribute(
      "aria-label",
      `Selecionar dia ${dataBR(data)}`
    );

    if (possuiHorario) {
      botaoDia.classList.add("tem-horarios");
    }

    if (possuiSelecao) {
      botaoDia.classList.add("tem-selecao");
    }

    if (ativo) {
      botaoDia.classList.add("dia-ativo");
      botaoDia.setAttribute("aria-pressed", "true");
    } else {
      botaoDia.setAttribute("aria-pressed", "false");
    }

    if (data < hojeISO() || (!possuiHorario && !possuiSelecao)) {
      botaoDia.disabled = true;
    }

    botaoDia.onclick = () => {
      dataSelecionada = data;
      atualizarInterface();
    };

    calendario.appendChild(botaoDia);
  }
}

// ==========================================
// HORÁRIOS DO DIA
// ==========================================

function renderizarHorarios() {
  $("tituloHorarios").textContent =
    `Horários disponíveis — ${dataBR(dataSelecionada)}`;

  const grade = $("gradeHorarios");
  const aviso = $("mensagemHorarios");

  grade.replaceChildren();
  aviso.textContent = "";

  const disponiveisDia = disponiveis()
    .filter(h => h.data === dataSelecionada)
    .sort(ordenarHorarios);

  if (!disponiveisDia.length) {
    aviso.textContent =
      "Nenhum horário disponível nesta data.";
    return;
  }

  disponiveisDia.forEach(h => {
    const marcado = selecionados.has(h.id);

    const btn = elemento(
      "button",
      h.hora,
      "horario-opcao"
    );

    btn.type = "button";

    if (marcado) {
      btn.classList.add("selecionado");
    }

    btn.setAttribute(
      "aria-pressed",
      marcado ? "true" : "false"
    );

    btn.onclick = () => alternarSelecao(h);

    grade.appendChild(btn);
  });
}

// ==========================================
// SELECIONAR HORÁRIOS
// ==========================================

function alternarSelecao(h) {
  if (enviando) return;

  if (selecionados.has(h.id)) {
    selecionados.delete(h.id);
    mensagem("");
    atualizarInterface();
    return;
  }

  if (selecionados.size >= LIMITE_SOLICITACOES) {
    alert(
      `Selecione no máximo ${LIMITE_SOLICITACOES} ` +
      "horários por solicitação."
    );
    return;
  }

  // Não seleciona períodos que coincidam com
  // agendamentos já existentes do aluno.
  const ocupados = [
    ...meusAgendamentos(),
    ...selecionados.values()
  ];

  if (ocupados.some(outro => mesmoPeriodo(h, outro))) {
    alert(
      "Você já possui um agendamento ou seleção " +
      "neste mesmo período."
    );
    return;
  }

  selecionados.set(h.id, h);
  mensagem("");

  atualizarInterface();
}

// ==========================================
// LISTA DE HORÁRIOS SELECIONADOS
// ==========================================

function renderizarSelecionados() {
  const lista = $("listaSelecionados");
  lista.replaceChildren();

  const itens = [...selecionados.values()]
    .sort(ordenarHorarios);

  $("totalSelecionados").textContent = itens.length;

  $("btnSolicitarTodos").disabled =
    !itens.length || enviando;

  $("btnSolicitarTodos").textContent =
    itens.length === 1
      ? "Solicitar 1 horário"
      : `Solicitar ${itens.length} horários`;

  if (!itens.length) {
    lista.appendChild(
      elemento(
        "p",
        "Nenhum horário selecionado.",
        "agenda-vazio"
      )
    );
    return;
  }

  itens.forEach(h => {
    const linha = elemento(
      "div",
      "",
      "horario-selecionado-item"
    );

    linha.appendChild(
      elemento(
        "span",
        `${dataBR(h.data)} às ${h.hora}`
      )
    );

    const remover = elemento(
      "button",
      "Remover"
    );

    remover.type = "button";
    remover.disabled = enviando;

    remover.onclick = () => {
      selecionados.delete(h.id);
      atualizarInterface();
    };

    linha.appendChild(remover);
    lista.appendChild(linha);
  });
}

$("btnLimparSelecao").onclick = () => {
  if (enviando) return;

  selecionados.clear();
  mensagem("");
  atualizarInterface();
};

// ==========================================
// SOLICITAR VÁRIOS HORÁRIOS
// ==========================================

$("btnSolicitarTodos").onclick = async () => {
  if (
    enviando ||
    !usuarioAtual ||
    !dadosAluno?.personalId
  ) return;

  const itens = [...selecionados.values()]
    .sort(ordenarHorarios);

  if (!itens.length) return;

  if (itens.length > LIMITE_SOLICITACOES) {
    alert("Quantidade de horários acima do limite.");
    return;
  }

  const confirmar = confirm(
    `Enviar ${itens.length} solicitação(ões) ` +
    "de agendamento para seu personal?"
  );

  if (!confirmar) return;

  enviando = true;
  atualizarInterface();

  mensagem("Enviando solicitações...");

  try {
    // A transação lê todos os horários antes
    // de atualizar qualquer um deles.
    // Se algum estiver ocupado, nenhuma
    // solicitação do grupo será gravada.

    await runTransaction(db, async tx => {
      const documentos = [];

      for (const h of itens) {
        const referencia = doc(db, "agenda", h.id);

        const snap = await tx.get(referencia);

        documentos.push({
          referencia,
          snap,
          esperado: h
        });
      }

      const registrosAtuais = [];

      for (const item of documentos) {
        if (!item.snap.exists()) {
          throw new Error(
            "Um dos horários não existe mais."
          );
        }

        const atual = item.snap.data();
        const esperado = item.esperado;

        if (
          atual.personalId !== dadosAluno.personalId ||
          atual.status !== "disponivel" ||
          atual.data !== esperado.data ||
          atual.hora !== esperado.hora ||
          !horarioFuturo(atual.data, atual.hora)
        ) {
          throw new Error(
            "Um dos horários deixou de estar disponível. " +
            "Revise sua seleção."
          );
        }

        registrosAtuais.push(atual);
      }

      // Verifica conflitos dentro da própria seleção.
      for (let i = 0; i < registrosAtuais.length; i++) {
        for (let j = i + 1; j < registrosAtuais.length; j++) {
          if (mesmoPeriodo(
            registrosAtuais[i],
            registrosAtuais[j]
          )) {
            throw new Error(
              "Existem horários sobrepostos na seleção."
            );
          }
        }
      }

      // Todas as verificações foram concluídas.
      // Agora são feitas as atualizações.

      for (const item of documentos) {
        tx.update(item.referencia, {
          alunoId: usuarioAtual.uid,
          alunoNome: dadosAluno.nome || "Aluno",
          status: "solicitado",
          solicitadoEm: serverTimestamp()
        });
      }
    });

    selecionados.clear();

    mensagem(
      `${itens.length} horário(s) solicitado(s) com sucesso!`
    );

    alert(
      "Solicitações enviadas! " +
      "Aguarde a confirmação do personal."
    );

  } catch (erro) {
    console.error(erro);

    mensagem(
      "Não foi possível concluir a solicitação."
    );

    alert(
      erro.message ||
      "Erro ao enviar os agendamentos."
    );

  } finally {
    enviando = false;
    atualizarInterface();
  }
};

// ==========================================
// MEUS AGENDAMENTOS
// ==========================================

function renderizarMeusAgendamentos() {
  const lista = $("listaMeusHorarios");
  lista.replaceChildren();

  const meus = meusAgendamentos()
    .sort(ordenarHorarios);

  $("totalAgendamentos").textContent = meus.length;

  if (!meus.length) {
    mostrarMensagem(
      lista,
      "Você não possui agendamentos futuros."
    );
    return;
  }

  meus.forEach(h => {
    const status = h.status === "confirmado"
      ? "Confirmado"
      : "Aguardando confirmação";

    const card = criarCartao(h, status);

    const cancelar = botao(
      "Cancelar agendamento",
      () => cancelarAgendamento(h.id),
      "agenda-btn-secundario"
    );

    card.appendChild(cancelar);
    lista.appendChild(card);
  });
}

// ==========================================
// CANCELAR AGENDAMENTO
// ==========================================

async function cancelarAgendamento(id) {
  if (!usuarioAtual || !dadosAluno) return;

  if (!confirm("Cancelar este agendamento?")) {
    return;
  }

  try {
    await runTransaction(db, async tx => {
      const referencia = doc(db, "agenda", id);

      const snap = await tx.get(referencia);

      if (!snap.exists()) {
        throw new Error("Agendamento não encontrado.");
      }

      const h = snap.data();

      if (
        h.alunoId !== usuarioAtual.uid ||
        h.personalId !== dadosAluno.personalId ||
        !statusReservado(h)
      ) {
        throw new Error(
          "Este agendamento não pode ser cancelado."
        );
      }

      tx.update(referencia, {
        alunoId: null,
        alunoNome: null,
        status: "disponivel",
        canceladoEm: serverTimestamp()
      });
    });

    alert("Agendamento cancelado!");

  } catch (erro) {
    console.error(erro);

    alert(
      erro.message ||
      "Não foi possível cancelar o agendamento."
    );
  }
}

// ==========================================
// ATUALIZAÇÃO GERAL
// ==========================================

function atualizarInterface() {
  renderizarCalendario();
  renderizarHorarios();
  renderizarSelecionados();
  renderizarMeusAgendamentos();
}

// ==========================================
// ENCERRAMENTO
// ==========================================

window.addEventListener("pagehide", () => {
  if (cancelarAgenda) {
    cancelarAgenda();
    cancelarAgenda = null;
  }
});
