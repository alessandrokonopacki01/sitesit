
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

let diasMarcados = new Set();
let selecionados = new Map();

let cancelarAgenda = null;
let versaoAutenticacao = 0;
let enviando = false;

let mesAtual = hojeISO().slice(0, 7);

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
  const d = new Date();

  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

function dataISO(ano, mes, dia) {
  return [
    ano,
    String(mes).padStart(2, "0"),
    String(dia).padStart(2, "0")
  ].join("-");
}

function dataBR(data) {
  const [ano, mes, dia] = data.split("-");
  return `${dia}/${mes}/${ano}`;
}

function deslocarMes(mes, quantidade) {
  const [ano, numero] = mes.split("-").map(Number);

  const d = new Date(ano, numero - 1 + quantidade, 1);

  return dataISO(
    d.getFullYear(),
    d.getMonth() + 1,
    1
  ).slice(0, 7);
}

function minutos(hora) {
  const [h, m] = hora.split(":").map(Number);
  return h * 60 + m;
}

function duracao(h) {
  const valor = Number(h.duracaoMinutos);
  return Number.isFinite(valor) && valor > 0
    ? valor
    : 60;
}

function colidem(a, b) {
  if (a.data !== b.data) return false;

  const inicioA = minutos(a.hora);
  const inicioB = minutos(b.hora);

  return (
    inicioA < inicioB + duracao(b) &&
    inicioB < inicioA + duracao(a)
  );
}

function reservado(h) {
  return ["solicitado", "confirmado"].includes(h.status);
}

function disponiveis() {
  return horarios.filter(h =>
    h.status === "disponivel" &&
    horarioFuturo(h.data, h.hora)
  );
}

function meusAgendamentos() {
  return horarios.filter(h =>
    h.alunoId === usuarioAtual?.uid &&
    reservado(h) &&
    horarioFuturo(h.data, h.hora)
  );
}

function mensagem(texto) {
  $("mensagemSolicitacao").textContent = texto;
}

function datasMarcadas() {
  return [...diasMarcados].sort();
}

function podeSelecionar(h, selecao = selecionados) {
  const ocupados = [
    ...meusAgendamentos(),
    ...selecao.values()
  ];

  return !ocupados.some(outro =>
    outro.id !== h.id && colidem(h, outro)
  );
}

// ==========================================
// NAVEGAÇÃO
// ==========================================

$("btnVoltar").onclick = () => {
  location.href = "aluno.html";
};

$("mesAnterior").onclick = () => {
  const anterior = deslocarMes(mesAtual, -1);

  if (anterior < hojeISO().slice(0, 7)) return;

  mesAtual = anterior;
  atualizarInterface();
};

$("mesProximo").onclick = () => {
  mesAtual = deslocarMes(mesAtual, 1);
  atualizarInterface();
};

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

  diasMarcados.clear();
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
      mensagem("Conecte-se a um personal para agendar.");
      atualizarInterface();
      return;
    }

    observarAgenda();

  } catch (erro) {
    console.error(erro);
    mensagem("Não foi possível carregar a agenda.");
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
      mensagem("Erro ao carregar horários.");
    }
  );
}

// ==========================================
// CALENDÁRIO MULTISSELEÇÃO
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
    ano, mes - 1, 1
  ).getDay();

  const totalDias = new Date(
    ano, mes, 0
  ).getDate();

  const datasDisponiveis = new Set(
    disponiveis().map(h => h.data)
  );

  for (let i = 0; i < primeiroDia; i++) {
    calendario.appendChild(
      elemento("span", "", "calendario-vazio")
    );
  }

  for (let dia = 1; dia <= totalDias; dia++) {
    const data = dataISO(ano, mes, dia);

    const marcado = diasMarcados.has(data);
    const disponivel = datasDisponiveis.has(data);

    const btn = elemento(
      "button",
      String(dia),
      "calendario-dia"
    );

    btn.type = "button";

    if (disponivel) {
      btn.classList.add("tem-horarios");
    }

    if (marcado) {
      btn.classList.add("dia-ativo", "tem-selecao");
    }

    btn.setAttribute(
      "aria-pressed",
      String(marcado)
    );

    btn.setAttribute(
      "aria-label",
      `${marcado ? "Desmarcar" : "Marcar"} ${dataBR(data)}`
    );

    btn.disabled =
      data < hojeISO() || (!disponivel && !marcado);

    btn.onclick = () => {
      if (diasMarcados.has(data)) {
        diasMarcados.delete(data);
      } else {
        diasMarcados.add(data);
      }

      atualizarInterface();
    };

    calendario.appendChild(btn);
  }
}

// ==========================================
// DIAS MARCADOS
// ==========================================

function renderizarDiasMarcados() {
  const container = $("diasMarcados");
  container.replaceChildren();

  const datas = datasMarcadas();

  if (!datas.length) {
    container.appendChild(
      elemento("p", "Nenhum dia selecionado.")
    );
    return;
  }

  datas.forEach(data => {
    const item = elemento(
      "div",
      "",
      "dia-marcado-item"
    );

    item.appendChild(
      elemento("span", dataBR(data))
    );

    const remover = elemento("button", "×");
    remover.type = "button";
    remover.disabled = enviando;

    remover.onclick = () => {
      diasMarcados.delete(data);
      atualizarInterface();
    };

    item.appendChild(remover);
    container.appendChild(item);
  });
}

$("btnLimparDias").onclick = () => {
  if (enviando) return;

  diasMarcados.clear();
  atualizarInterface();
};

// ==========================================
// HORÁRIOS DISPONÍVEIS POR DIA
// ==========================================

function renderizarHorarios() {
  $("tituloHorarios").textContent =
    "Horários dos dias selecionados";

  const grade = $("gradeHorarios");
  const aviso = $("mensagemHorarios");

  grade.replaceChildren();
  aviso.textContent = "";

  const datas = datasMarcadas();

  if (!datas.length) {
    aviso.textContent =
      "Selecione um ou mais dias no calendário.";
    return;
  }

  let totalDisponivel = 0;

  datas.forEach(data => {
    const horariosDia = disponiveis()
      .filter(h => h.data === data)
      .sort(ordenarHorarios);

    const grupo = elemento(
      "div",
      "",
      "agenda-grupo-dia"
    );

    grupo.appendChild(
      elemento("h3", dataBR(data))
    );

    const botoes = elemento(
      "div",
      "",
      "agenda-grade-dia"
    );

    horariosDia.forEach(h => {
      totalDisponivel++;

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
        String(marcado)
      );

      btn.onclick = () => alternarHorario(h);

      botoes.appendChild(btn);
    });

    if (!horariosDia.length) {
      grupo.appendChild(
        elemento("p", "Sem horários disponíveis.")
      );
    } else {
      grupo.appendChild(botoes);
    }

    grade.appendChild(grupo);
  });

  if (!totalDisponivel) {
    aviso.textContent =
      "Não há horários disponíveis nos dias escolhidos.";
  }
}

// ==========================================
// SELEÇÃO INDIVIDUAL
// ==========================================

function alternarHorario(h) {
  if (enviando) return;

  if (selecionados.has(h.id)) {
    selecionados.delete(h.id);
  } else {
    if (selecionados.size >= LIMITE_SOLICITACOES) {
      alert("Limite de 40 horários por solicitação.");
      return;
    }

    if (!podeSelecionar(h)) {
      alert("Já existe um horário seu nesse período.");
      return;
    }

    selecionados.set(h.id, h);
  }

  mensagem("");
  atualizarInterface();
}

// ==========================================
// HORÁRIO COMUM A VÁRIOS DIAS
// ==========================================

function horariosComuns() {
  const datas = datasMarcadas();

  if (!datas.length) return [];

  const listas = datas.map(data =>
    disponiveis().filter(h => h.data === data)
  );

  const primeira = listas[0] || [];

  const comuns = primeira.filter(h =>
    listas.every(lista =>
      lista.some(outro =>
        outro.hora === h.hora &&
        duracao(outro) === duracao(h)
      )
    )
  );

  return [...new Set(
    comuns.map(h => h.hora)
  )].sort();
}

function renderizarHorarioComum() {
  const select = $("horarioComum");
  const valorAnterior = select.value;

  select.replaceChildren(
    new Option("Selecione um horário", "")
  );

  const comuns = horariosComuns();

  comuns.forEach(hora => {
    select.add(new Option(hora, hora));
  });

  if (comuns.includes(valorAnterior)) {
    select.value = valorAnterior;
  }

  $("btnAplicarHorario").disabled =
    enviando || !comuns.length;

  $("avisoHorarioComum").textContent =
    !diasMarcados.size
      ? "Marque os dias no calendário."
      : !comuns.length
        ? "Não há horários iguais disponíveis em todos os dias selecionados."
        : `${comuns.length} horário(s) em comum.`;
}

$("btnAplicarHorario").onclick = () => {
  if (enviando) return;

  const hora = $("horarioComum").value;

  if (!hora) {
    alert("Selecione um horário.");
    return;
  }

  const datas = datasMarcadas();
  const candidatos = [];

  for (const data of datas) {
    const h = disponiveis().find(item =>
      item.data === data && item.hora === hora
    );

    if (!h) {
      alert("Um dos horários não está mais disponível.");
      return;
    }

    candidatos.push(h);
  }

  const novaSelecao = new Map(selecionados);
  let adicionados = 0;
  let conflitos = 0;

  for (const h of candidatos) {
    if (novaSelecao.has(h.id)) continue;

    if (
      novaSelecao.size >= LIMITE_SOLICITACOES ||
      !podeSelecionar(h, novaSelecao)
    ) {
      conflitos++;
      continue;
    }

    novaSelecao.set(h.id, h);
    adicionados++;
  }

  selecionados = novaSelecao;

  mensagem(
    `${adicionados} horário(s) adicionado(s).` +
    (conflitos
      ? ` ${conflitos} ignorado(s) por conflito ou limite.`
      : "")
  );

  atualizarInterface();
};

// ==========================================
// HORÁRIOS SELECIONADOS
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
      elemento("p", "Nenhum horário selecionado.")
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

    const remover = elemento("button", "Remover");
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
// ENVIO DAS SOLICITAÇÕES
// ==========================================

$("btnSolicitarTodos").onclick = async () => {
  if (
    enviando ||
    !usuarioAtual ||
    !dadosAluno?.personalId
  ) return;

  const itens = [...selecionados.values()]
    .sort(ordenarHorarios);

  if (
    !itens.length ||
    itens.length > LIMITE_SOLICITACOES
  ) return;

  if (!confirm(
    `Solicitar ${itens.length} horário(s) ao personal?`
  )) return;

  enviando = true;
  atualizarInterface();
  mensagem("Enviando solicitações...");

  try {
    await runTransaction(db, async tx => {
      const documentos = [];

      // Todas as leituras antes das alterações.
      for (const h of itens) {
        const ref = doc(db, "agenda", h.id);
        const snap = await tx.get(ref);

        documentos.push({ ref, snap, h });
      }

      const atuais = [];

      for (const item of documentos) {
        if (!item.snap.exists()) {
          throw new Error("Um dos horários foi removido.");
        }

        const atual = item.snap.data();

        if (
          atual.personalId !== dadosAluno.personalId ||
          atual.status !== "disponivel" ||
          atual.data !== item.h.data ||
          atual.hora !== item.h.hora ||
          !horarioFuturo(atual.data, atual.hora)
        ) {
          throw new Error(
            "Um dos horários não está mais disponível."
          );
        }

        atuais.push(atual);
      }

      for (let i = 0; i < atuais.length; i++) {
        for (let j = i + 1; j < atuais.length; j++) {
          if (colidem(atuais[i], atuais[j])) {
            throw new Error(
              "Há horários sobrepostos na seleção."
            );
          }
        }
      }

      for (const item of documentos) {
        tx.update(item.ref, {
          alunoId: usuarioAtual.uid,
          alunoNome: dadosAluno.nome || "Aluno",
          status: "solicitado",
          solicitadoEm: serverTimestamp()
        });
      }
    });

    selecionados.clear();

    mensagem(
      `${itens.length} solicitação(ões) enviada(s)!`
    );

    alert("Solicitações enviadas ao personal!");

  } catch (erro) {
    console.error(erro);
    alert(erro.message || "Erro ao solicitar horários.");
    mensagem("Não foi possível enviar a seleção.");
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

    card.appendChild(
      botao(
        "Cancelar agendamento",
        () => cancelarAgendamento(h.id),
        "agenda-btn-secundario"
      )
    );

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
      const ref = doc(db, "agenda", id);
      const snap = await tx.get(ref);

      if (!snap.exists()) {
        throw new Error("Agendamento não encontrado.");
      }

      const h = snap.data();

      if (
        h.alunoId !== usuarioAtual.uid ||
        h.personalId !== dadosAluno.personalId ||
        !reservado(h)
      ) {
        throw new Error(
          "Este agendamento não pode ser cancelado."
        );
      }

      tx.update(ref, {
        alunoId: null,
        alunoNome: null,
        status: "disponivel",
        canceladoEm: serverTimestamp()
      });
    });

    alert("Agendamento cancelado!");

  } catch (erro) {
    console.error(erro);
    alert(erro.message || "Erro ao cancelar.");
  }
}

// ==========================================
// ATUALIZAR INTERFACE
// ==========================================

function atualizarInterface() {
  renderizarCalendario();
  renderizarDiasMarcados();
  renderizarHorarios();
  renderizarHorarioComum();
  renderizarSelecionados();
  renderizarMeusAgendamentos();
}

window.addEventListener("pagehide", () => {
  if (cancelarAgenda) cancelarAgenda();
});
