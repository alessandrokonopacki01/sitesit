
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  query,
  where,
  onSnapshot,
  doc,
  getDoc,
  getDocs,
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

const COLECAO_AGENDA = "agenda";
const COLECAO_BLOQUEIOS = "agendaBloqueios";

// Compatibilidade com horários antigos,
// que não possuíam duração cadastrada.
const DURACAO_PADRAO = 60;

const DIAS_SEMANA = [
  "Domingo",
  "Segunda",
  "Terça",
  "Quarta",
  "Quinta",
  "Sexta",
  "Sábado"
];

// Limite seguro para uma transação de bloqueio.
const LIMITE_REMOCOES = 400;

// ==========================================
// ESTADO
// ==========================================

let personalAtual = null;
let horarios = [];
let bloqueios = [];

let cancelarAgenda = null;
let cancelarBloqueios = null;

let versaoAutenticacao = 0;
let processandoBloqueio = false;
let gerandoAgenda = false;

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function elemento(tag, texto = "", classe = "") {
  const el = document.createElement(tag);

  el.textContent = String(texto);

  if (classe) el.className = classe;

  return el;
}

function minutos(hora) {
  if (!/^\d{2}:\d{2}$/.test(hora || "")) {
    return NaN;
  }

  const [h, m] = hora.split(":").map(Number);

  if (h > 23 || m > 59) return NaN;

  return h * 60 + m;
}

function horaTexto(valor) {
  const h = Math.floor(valor / 60);
  const m = valor % 60;

  return (
    String(h).padStart(2, "0") +
    ":" +
    String(m).padStart(2, "0")
  );
}

function dataLocal(data) {
  const [ano, mes, dia] = data.split("-").map(Number);

  return new Date(ano, mes - 1, dia, 12);
}

function dataISO(data) {
  const ano = data.getFullYear();
  const mes = String(data.getMonth() + 1).padStart(2, "0");
  const dia = String(data.getDate()).padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

function hojeISO() {
  return dataISO(new Date());
}

function dataBR(data) {
  if (!data) return "--";

  const [ano, mes, dia] = data.split("-");

  return `${dia}/${mes}/${ano}`;
}

function dataValida(data) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || "")) {
    return false;
  }

  const [ano, mes, dia] = data.split("-").map(Number);
  const d = new Date(ano, mes - 1, dia, 12);

  return (
    d.getFullYear() === ano &&
    d.getMonth() + 1 === mes &&
    d.getDate() === dia
  );
}

function duracaoHorario(h) {
  const valor = Number(h.duracaoMinutos);

  return Number.isFinite(valor) && valor > 0
    ? valor
    : DURACAO_PADRAO;
}

function intervalosColidem(a, b, c, d) {
  return a < d && b > c;
}

function diasSelecionados(container) {
  return [...container.querySelectorAll(
    'input[type="checkbox"]:checked'
  )].map(input => Number(input.value));
}

function mostrarErro(erro) {
  console.error(erro);
  alert(
    erro.message ||
    "Não foi possível concluir a operação."
  );
}

function obterMesAtual() {
  return hojeISO().slice(0, 7);
}

// ==========================================
// NAVEGAÇÃO
// ==========================================

window.voltar = () => {
  location.href = "personal.html";
};

// ==========================================
// AUTENTICAÇÃO
// ==========================================

onAuthStateChanged(auth, async usuario => {
  const versao = ++versaoAutenticacao;

  encerrarEscutas();
  personalAtual = null;

  if (!usuario) {
    location.href = "index.html";
    return;
  }

  try {
    const perfil = await getDoc(
      doc(db, "usuarios", usuario.uid)
    );

    if (versao !== versaoAutenticacao) return;

    if (
      !perfil.exists() ||
      perfil.data().tipo !== "personal"
    ) {
      location.href = "index.html";
      return;
    }

    personalAtual = usuario;

    configurarDatas();
    observarAgenda();
    observarBloqueios();

  } catch (erro) {
    mostrarErro(erro);
  }
});

function encerrarEscutas() {
  if (cancelarAgenda) cancelarAgenda();
  if (cancelarBloqueios) cancelarBloqueios();

  cancelarAgenda = null;
  cancelarBloqueios = null;
}

// ==========================================
// DATAS INICIAIS
// ==========================================

function configurarDatas() {
  const hoje = hojeISO();

  $("dataHorario").min = hoje;
  $("dataHorario").value = hoje;

  $("mesAgenda").min = obterMesAtual();
  $("mesAgenda").value = obterMesAtual();

  $("dataBloqueio").min = hoje;
  $("dataInicioBloqueio").min = hoje;
  $("dataFimBloqueio").min = hoje;

  $("dataBloqueio").value = hoje;
  $("dataInicioBloqueio").value = hoje;
  $("dataFimBloqueio").value = hoje;
}

// ==========================================
// CONSULTAS ATUALIZADAS
// ==========================================

async function buscarAgendaAtual() {
  const consulta = query(
    collection(db, COLECAO_AGENDA),
    where("personalId", "==", personalAtual.uid)
  );

  const resultado = await getDocs(consulta);

  return resultado.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

async function buscarBloqueiosAtuais() {
  const consulta = query(
    collection(db, COLECAO_BLOQUEIOS),
    where("personalId", "==", personalAtual.uid)
  );

  const resultado = await getDocs(consulta);

  return resultado.docs.map(d => ({
    id: d.id,
    ...d.data()
  }));
}

// ==========================================
// OBSERVAR AGENDA
// ==========================================

function observarAgenda() {
  const consulta = query(
    collection(db, COLECAO_AGENDA),
    where("personalId", "==", personalAtual.uid)
  );

  cancelarAgenda = onSnapshot(
    consulta,
    snapshot => {
      horarios = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      horarios.sort(ordenarHorarios);

      renderizarAgenda();
    },

    erro => {
      console.error(erro);

      mostrarMensagem(
        $("listaAgenda"),
        "Não foi possível carregar a agenda."
      );
    }
  );
}

// ==========================================
// EXIBIR AGENDA
// ==========================================


// ==========================================
// FILTROS DA AGENDA
// ==========================================

let filtroAgenda = "solicitado";

document.querySelectorAll(".filtro-agenda").forEach(btn => {
  btn.addEventListener("click", () => {
    filtroAgenda = btn.dataset.filtro;

    document.querySelectorAll(".filtro-agenda")
      .forEach(b => {
        b.classList.toggle(
          "ativo",
          b.dataset.filtro === filtroAgenda
        );
      });

    renderizarAgenda();
  });
});

// ==========================================
// RENDERIZAR AGENDA COM FILTROS
// ==========================================

function renderizarAgenda() {
  const lista = $("listaAgenda");
  lista.replaceChildren();

  const futuros = horarios
    .filter(h => horarioFuturo(h.data, h.hora))
    .sort(ordenarHorarios);

  const solicitados = futuros.filter(
    h => h.status === "solicitado"
  );

  const confirmados = futuros.filter(
    h => h.status === "confirmado"
  );

  const disponiveis = futuros.filter(
    h => h.status === "disponivel"
  );

  $("qtdSolicitados").textContent = solicitados.length;
  $("qtdConfirmados").textContent = confirmados.length;
  $("qtdDisponiveis").textContent = disponiveis.length;

  // SOLICITAÇÕES AGRUPADAS POR ALUNO
  if (filtroAgenda === "solicitado") {
    renderizarSolicitacoes(solicitados);
    return;
  }

  const filtrados = futuros.filter(h =>
    filtroAgenda === "todos" ||
    h.status === filtroAgenda
  );

  if (!filtrados.length) {
    mostrarMensagem(
      lista,
      "Nenhum horário encontrado neste filtro."
    );
    return;
  }

  filtrados.forEach(h => {
    const status = h.status === "confirmado"
      ? "Confirmado"
      : h.status === "solicitado"
        ? "Aguardando confirmação"
        : "Disponível";

    const card = criarCartao(
      h,
      status,
      h.alunoNome
        ? `Aluno: ${h.alunoNome}`
        : ""
    );

    card.appendChild(
      elemento(
        "p",
        `Duração: ${duracaoHorario(h)} minutos`,
        "agenda-detalhes"
      )
    );

    const acoes = elemento("div", "", "agenda-acoes");

    if (h.status === "solicitado") {
      acoes.appendChild(
        botao("Confirmar", () => confirmarAgendamento(h.id))
      );
    }

    if (["solicitado", "confirmado"].includes(h.status)) {
      acoes.appendChild(
        botao(
          "Cancelar e liberar",
          () => liberarHorario(h.id),
          "agenda-btn-secundario"
        )
      );
    }

    if (h.status === "disponivel") {
      acoes.appendChild(
        botao(
          "Excluir",
          () => excluirHorario(h.id),
          "agenda-btn-secundario"
        )
      );
    }

    card.appendChild(acoes);
    lista.appendChild(card);
  });
}

// ==========================================
// SOLICITAÇÕES AGRUPADAS POR ALUNO
// ==========================================

function renderizarSolicitacoes(solicitados) {
  const lista = $("listaAgenda");

  if (!solicitados.length) {
    mostrarMensagem(
      lista,
      "Nenhuma solicitação pendente."
    );
    return;
  }

  const grupos = new Map();

  solicitados.forEach(h => {
    // Horários sem aluno identificado ficam separados.
    const chave = h.alunoId || `sem-aluno-${h.id}`;

    if (!grupos.has(chave)) {
      grupos.set(chave, {
        alunoId: h.alunoId,
        alunoNome: h.alunoNome || "Aluno",
        horarios: []
      });
    }

    grupos.get(chave).horarios.push(h);
  });

  grupos.forEach(grupo => {
    const card = elemento(
      "article",
      "",
      "agenda-grupo-solicitacao"
    );

    const cabecalho = elemento(
      "div",
      "",
      "agenda-solicitacao-topo"
    );

    cabecalho.appendChild(
      elemento("h3", grupo.alunoNome)
    );

    cabecalho.appendChild(
      elemento(
        "span",
        `${grupo.horarios.length} horário(s)`,
        "agenda-contador"
      )
    );

    card.appendChild(cabecalho);

    const listaHorarios = elemento(
      "div",
      "",
      "agenda-solicitacao-horarios"
    );

    grupo.horarios.forEach(h => {
      const linha = elemento(
        "div",
        "",
        "agenda-solicitacao-linha"
      );

      linha.appendChild(
        elemento(
          "span",
          `${dataBR(h.data)} às ${h.hora}`
        )
      );

      const acoes = elemento(
        "div",
        "",
        "agenda-acoes-individuais"
      );

      acoes.appendChild(
        botao(
          "Confirmar",
          () => confirmarAgendamento(h.id)
        )
      );

      acoes.appendChild(
        botao(
          "Cancelar",
          () => liberarHorario(h.id),
          "agenda-btn-secundario"
        )
      );

      linha.appendChild(acoes);
      listaHorarios.appendChild(linha);
    });

    card.appendChild(listaHorarios);

    if (grupo.alunoId) {
      const confirmarTodos = botao(
        `Confirmar ${grupo.horarios.length} horário(s)`,
        () => confirmarSolicitacoesEmLote(grupo.horarios),
        "agenda-confirmar-grupo"
      );

      card.appendChild(confirmarTodos);
    }

    lista.appendChild(card);
  });
}


// ==========================================
// ALTERAÇÃO SEGURA DE AGENDAMENTOS
// ==========================================

async function alterarHorario(id, validar, executar) {
  if (!personalAtual) return;

  await runTransaction(db, async tx => {
    const ref = doc(db, COLECAO_AGENDA, id);

    const snap = await tx.get(ref);

    if (!snap.exists()) {
      throw new Error("Horário não encontrado.");
    }

    const dados = snap.data();

    if (
      dados.personalId !== personalAtual.uid ||
      !validar(dados)
    ) {
      throw new Error(
        "O horário foi alterado. Atualize a agenda."
      );
    }

    executar(tx, ref, dados);
  });
}

async function confirmarAgendamento(id) {
  try {
    await alterarHorario(
      id,
      h => h.status === "solicitado" && !!h.alunoId,
      (tx, ref) => {
        tx.update(ref, {
          status: "confirmado",
          confirmadoEm: serverTimestamp()
        });
      }
    );

    alert("Agendamento confirmado!");

  } catch (erro) {
    mostrarErro(erro);
  }
}

async function liberarHorario(id) {
  if (!confirm(
    "Cancelar este agendamento e liberar o horário?"
  )) return;

  try {
    await alterarHorario(
      id,
      h => ["solicitado", "confirmado"].includes(h.status),
      (tx, ref) => {
        tx.update(ref, {
          status: "disponivel",
          alunoId: null,
          alunoNome: null,
          canceladoEm: serverTimestamp()
        });
      }
    );

    alert("Agendamento cancelado!");

  } catch (erro) {
    mostrarErro(erro);
  }
}

async function excluirHorario(id) {
  if (!confirm("Excluir este horário?")) return;

  try {
    await alterarHorario(
      id,
      h => h.status === "disponivel",
      (tx, ref) => tx.delete(ref)
    );

    alert("Horário excluído!");

  } catch (erro) {
    mostrarErro(erro);
  }
}

// ==========================================
// VERIFICAÇÃO DE BLOQUEIOS
// ==========================================

function bloqueioAtingeHorario(b, data, inicio, fim) {
  if (b.tipo === "fixo") {
    const diaSemana = dataLocal(data).getDay();

    return (
      (b.diasSemana || []).includes(diaSemana) &&
      intervalosColidem(
        inicio,
        fim,
        minutos(b.inicio),
        minutos(b.fim)
      )
    );
  }

  if (b.tipo === "especifico") {
    return (
      b.data === data &&
      intervalosColidem(
        inicio,
        fim,
        minutos(b.inicio),
        minutos(b.fim)
      )
    );
  }

  if (b.tipo === "diaInteiro") {
    return (
      data >= b.dataInicio &&
      data <= b.dataFim
    );
  }

  return false;
}

function horarioBloqueado(
  data,
  hora,
  duracao,
  listaBloqueios
) {
  const inicio = minutos(hora);
  const fim = inicio + duracao;

  return listaBloqueios.some(b =>
    bloqueioAtingeHorario(b, data, inicio, fim)
  );
}

// ==========================================
// VERIFICAÇÃO DE CONFLITOS ENTRE VAGAS
// ==========================================

function horarioConflitante(
  data,
  hora,
  duracao,
  listaHorarios
) {
  const inicio = minutos(hora);
  const fim = inicio + duracao;

  return listaHorarios.some(h => {
    if (h.data !== data) return false;

    return intervalosColidem(
      inicio,
      fim,
      minutos(h.hora),
      minutos(h.hora) + duracaoHorario(h)
    );
  });
}

// ==========================================
// CRIAÇÃO DE HORÁRIO
// ==========================================

async function criarHorario(data, hora, duracao) {
  const id = (
    `${personalAtual.uid}_${data}_${hora.replace(":", "-")}`
  );

  const ref = doc(db, COLECAO_AGENDA, id);

  await runTransaction(db, async tx => {
    const snap = await tx.get(ref);

    if (snap.exists()) {
      throw new Error("Horário já cadastrado.");
    }

    tx.set(ref, {
      personalId: personalAtual.uid,
      alunoId: null,
      alunoNome: null,
      data,
      hora,
      duracaoMinutos: duracao,
      status: "disponivel",
      criadoEm: serverTimestamp()
    });
  });

  return id;
}

// ==========================================
// CADASTRO INDIVIDUAL
// ==========================================

$("formHorario").addEventListener("submit", async e => {
  e.preventDefault();

  if (!personalAtual) return;

  const data = $("dataHorario").value;
  const hora = $("horaHorario").value;

  if (!dataValida(data) || !horarioFuturo(data, hora)) {
    alert("Escolha uma data e hora futuras.");
    return;
  }

  const duracao = DURACAO_PADRAO;
  const enviar = e.currentTarget.querySelector(
    'button[type="submit"]'
  );

  enviar.disabled = true;

  try {
    const [agendaAtual, bloqueiosAtuais] = await Promise.all([
      buscarAgendaAtual(),
      buscarBloqueiosAtuais()
    ]);

    if (horarioBloqueado(
      data,
      hora,
      duracao,
      bloqueiosAtuais
    )) {
      throw new Error(
        "Este horário está dentro de um período bloqueado."
      );
    }

    if (horarioConflitante(
      data,
      hora,
      duracao,
      agendaAtual
    )) {
      throw new Error(
        "Já existe um atendimento neste período."
      );
    }

    await criarHorario(data, hora, duracao);

    alert("Horário criado com sucesso!");

    $("horaHorario").value = "";

  } catch (erro) {
    mostrarErro(erro);
  } finally {
    enviar.disabled = false;
  }
});

// ==========================================
// GERAR DATAS DO MÊS
// ==========================================

function datasDoMes(mesSelecionado, diasSemana) {
  const [ano, mes] = mesSelecionado
    .split("-")
    .map(Number);

  const quantidade = new Date(ano, mes, 0).getDate();

  const datas = [];

  for (let dia = 1; dia <= quantidade; dia++) {
    const data = new Date(ano, mes - 1, dia, 12);

    if (diasSemana.includes(data.getDay())) {
      datas.push(dataISO(data));
    }
  }

  return datas;
}

// ==========================================
// GERAÇÃO AUTOMÁTICA MENSAL
// ==========================================

$("formAgendaMensal").addEventListener(
  "submit",
  async e => {
    e.preventDefault();

    if (!personalAtual || gerandoAgenda) return;

    const mes = $("mesAgenda").value;

    const diasSemana = diasSelecionados(
      document.querySelector(
        "#formAgendaMensal .dias-semana"
      )
    );

    const inicio = minutos(
      $("inicioExpediente").value
    );

    const fim = minutos(
      $("fimExpediente").value
    );

    const duracao = Number(
      $("duracaoAtendimento").value
    );

    if (
      !mes ||
      !diasSemana.length ||
      !Number.isFinite(inicio) ||
      !Number.isFinite(fim) ||
      inicio >= fim ||
      !Number.isInteger(duracao) ||
      duracao <= 0
    ) {
      alert("Verifique as configurações da agenda.");
      return;
    }

    if (mes < obterMesAtual()) {
      alert("Selecione o mês atual ou um mês futuro.");
      return;
    }

    const datas = datasDoMes(mes, diasSemana);

    if (!datas.length) {
      alert("Nenhum dia de atendimento selecionado.");
      return;
    }

    const resultado = $("resultadoGeracao");
    const botaoGerar = $("btnGerarAgenda");

    let criados = 0;
    let ignorados = 0;
    let falhas = 0;

    gerandoAgenda = true;
    botaoGerar.disabled = true;

    resultado.textContent = "Preparando agenda mensal...";

    try {
      const [agendaAtual, bloqueiosAtuais] =
        await Promise.all([
          buscarAgendaAtual(),
          buscarBloqueiosAtuais()
        ]);

      const candidatos = [];

      for (const data of datas) {
        for (
          let horario = inicio;
          horario + duracao <= fim;
          horario += duracao
        ) {
          const hora = horaTexto(horario);

          if (!horarioFuturo(data, hora)) {
            ignorados++;
            continue;
          }

          if (
            horarioBloqueado(
              data,
              hora,
              duracao,
              bloqueiosAtuais
            )
          ) {
            ignorados++;
            continue;
          }

          if (
            horarioConflitante(
              data,
              hora,
              duracao,
              agendaAtual
            )
          ) {
            ignorados++;
            continue;
          }

          candidatos.push({
            data,
            hora,
            duracao
          });
        }
      }

      if (!candidatos.length) {
        resultado.textContent =
          "Nenhum horário novo para cadastrar.";

        alert(
          "Todos os períodos já estão ocupados, bloqueados ou no passado."
        );

        return;
      }

      const confirmar = confirm(
        `Gerar ${candidatos.length} horários disponíveis ` +
        `para ${mes}?\n\n` +
        "Os agendamentos existentes serão preservados."
      );

      if (!confirmar) {
        resultado.textContent = "Geração cancelada.";
        return;
      }

      // Transações individuais impedem sobrescrever
      // documentos existentes.
      for (const candidato of candidatos) {
        try {
          await criarHorario(
            candidato.data,
            candidato.hora,
            candidato.duracao
          );

          criados++;

          // Atualiza o conjunto local para impedir
          // sobreposições nesta mesma geração.
          agendaAtual.push({
            ...candidato,
            status: "disponivel",
            duracaoMinutos: candidato.duracao
          });

        } catch (erro) {
          console.warn(
            "Horário não criado:",
            candidato,
            erro
          );

          falhas++;
        }

        resultado.textContent =
          `Criados: ${criados} de ${candidatos.length}`;
      }

      resultado.textContent =
        `Agenda gerada: ${criados} novos horários. ` +
        `${ignorados} ignorados. ${falhas} falhas.`;

      alert(
        `Geração finalizada!\n\n` +
        `Novos horários: ${criados}\n` +
        `Ignorados: ${ignorados}\n` +
        `Falhas: ${falhas}`
      );

    } catch (erro) {
      mostrarErro(erro);
      resultado.textContent =
        "Erro durante a geração da agenda.";
    } finally {
      gerandoAgenda = false;
      botaoGerar.disabled = false;
    }
  }
);

// ==========================================
// TIPOS DE BLOQUEIO
// ==========================================

$("tipoBloqueio").addEventListener(
  "change",
  atualizarCamposBloqueio
);

function atualizarCamposBloqueio() {
  const tipo = $("tipoBloqueio").value;

  $("camposBloqueioFixo").hidden =
    tipo !== "fixo";

  $("camposBloqueioEspecifico").hidden =
    tipo !== "especifico";

  $("camposDiaInteiro").hidden =
    tipo !== "diaInteiro";
}

atualizarCamposBloqueio();

// ==========================================
// MONTAR BLOQUEIO
// ==========================================

function montarBloqueio() {
  const tipo = $("tipoBloqueio").value;
  const motivo = $("motivoBloqueio").value;

  const dados = {
    personalId: personalAtual.uid,
    tipo,
    motivo
  };

  if (tipo === "fixo") {
    const diasSemana = diasSelecionados(
      $("camposBloqueioFixo")
    );

    const inicio = $("inicioFixo").value;
    const fim = $("fimFixo").value;

    if (
      !diasSemana.length ||
      !Number.isFinite(minutos(inicio)) ||
      !Number.isFinite(minutos(fim)) ||
      minutos(inicio) >= minutos(fim)
    ) {
      throw new Error(
        "Informe dias e horários válidos."
      );
    }

    return {
      ...dados,
      diasSemana,
      inicio,
      fim
    };
  }

  if (tipo === "especifico") {
    const data = $("dataBloqueio").value;
    const inicio = $("inicioEspecifico").value;
    const fim = $("fimEspecifico").value;

    if (
      !dataValida(data) ||
      data < hojeISO() ||
      !Number.isFinite(minutos(inicio)) ||
      !Number.isFinite(minutos(fim)) ||
      minutos(inicio) >= minutos(fim)
    ) {
      throw new Error(
        "Informe uma data e um período válidos."
      );
    }

    return {
      ...dados,
      data,
      inicio,
      fim
    };
  }

  if (tipo === "diaInteiro") {
    const dataInicio = $("dataInicioBloqueio").value;
    const dataFim = $("dataFimBloqueio").value;

    if (
      !dataValida(dataInicio) ||
      !dataValida(dataFim) ||
      dataInicio < hojeISO() ||
      dataFim < dataInicio
    ) {
      throw new Error(
        "Informe um intervalo de datas válido."
      );
    }

    return {
      ...dados,
      dataInicio,
      dataFim
    };
  }

  throw new Error("Tipo de bloqueio inválido.");
}

// ==========================================
// SALVAR BLOQUEIO
// ==========================================

$("formBloqueio").addEventListener(
  "submit",
  async e => {
    e.preventDefault();

    if (!personalAtual || processandoBloqueio) return;

    const botaoSalvar = $("btnSalvarBloqueio");

    processandoBloqueio = true;
    botaoSalvar.disabled = true;

    try {
      const novoBloqueio = montarBloqueio();

      const agendaAtual = await buscarAgendaAtual();

      const atingidos = agendaAtual.filter(h => {
        if (!dataValida(h.data)) return false;

        if (!horarioFuturo(h.data, h.hora)) {
          return false;
        }

        const inicio = minutos(h.hora);
        const fim = inicio + duracaoHorario(h);

        return bloqueioAtingeHorario(
          novoBloqueio,
          h.data,
          inicio,
          fim
        );
      });

      const reservados = atingidos.filter(h =>
        ["solicitado", "confirmado"].includes(h.status)
      );

      if (reservados.length) {
        const detalhes = reservados
          .slice(0, 5)
          .map(h =>
            `${dataBR(h.data)} às ${h.hora} — ` +
            `${h.alunoNome || "Aluno"}`
          )
          .join("\n");

        throw new Error(
          `Existem ${reservados.length} agendamentos ` +
          `nesse período.\n\n${detalhes}\n\n` +
          "Cancele ou reorganize esses agendamentos antes."
        );
      }

      const livres = atingidos.filter(h =>
        h.status === "disponivel"
      );

      if (livres.length > LIMITE_REMOCOES) {
        throw new Error(
          "Este bloqueio atinge muitos horários. " +
          "Divida-o em períodos menores."
        );
      }

      const confirmar = confirm(
        `Adicionar bloqueio: ${novoBloqueio.motivo}?\n\n` +
        `${livres.length} horários disponíveis ` +
        "serão removidos da agenda.\n\n" +
        "Reservas existentes não serão apagadas."
      );

      if (!confirmar) return;

      const refBloqueio = doc(
        collection(db, COLECAO_BLOQUEIOS)
      );

      // Lê novamente todos os horários envolvidos.
      // Se algum foi reservado enquanto o personal
      // configurava o bloqueio, a operação falha.
      await runTransaction(db, async tx => {
        const referencias = livres.map(h =>
          doc(db, COLECAO_AGENDA, h.id)
        );

        const documentos = [];

        for (const ref of referencias) {
          documentos.push(await tx.get(ref));
        }

        for (const snap of documentos) {
          if (!snap.exists()) continue;

          const h = snap.data();

          if (
            h.personalId !== personalAtual.uid ||
            h.status !== "disponivel"
          ) {
            throw new Error(
              "Um dos horários foi reservado. " +
              "Revise a agenda e tente novamente."
            );
          }
        }

        // Todas as leituras foram feitas.
        // Agora as alterações são aplicadas juntas.
        for (const snap of documentos) {
          if (snap.exists()) {
            tx.delete(snap.ref);
          }
        }

        tx.set(refBloqueio, {
          ...novoBloqueio,
          criadoEm: serverTimestamp()
        });
      });

      alert(
        "Bloqueio cadastrado!\n" +
        `${livres.length} vagas livres removidas.`
      );

    } catch (erro) {
      mostrarErro(erro);
    } finally {
      processandoBloqueio = false;
      botaoSalvar.disabled = false;
    }
  }
);

// ==========================================
// OBSERVAR BLOQUEIOS
// ==========================================

function observarBloqueios() {
  const consulta = query(
    collection(db, COLECAO_BLOQUEIOS),
    where("personalId", "==", personalAtual.uid)
  );

  cancelarBloqueios = onSnapshot(
    consulta,
    snapshot => {
      bloqueios = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      renderizarBloqueios();
    },

    erro => {
      console.error(erro);

      mostrarMensagem(
        $("listaBloqueios"),
        "Não foi possível carregar os bloqueios."
      );
    }
  );
}

// ==========================================
// DESCRIÇÃO DOS BLOQUEIOS
// ==========================================

function descricaoBloqueio(b) {
  if (b.tipo === "fixo") {
    const dias = (b.diasSemana || [])
      .map(d => DIAS_SEMANA[d])
      .join(", ");

    return (
      `${dias}\n${b.inicio} às ${b.fim}`
    );
  }

  if (b.tipo === "especifico") {
    return (
      `${dataBR(b.data)}\n` +
      `${b.inicio} às ${b.fim}`
    );
  }

  if (b.tipo === "diaInteiro") {
    return (
      `${dataBR(b.dataInicio)} até ` +
      `${dataBR(b.dataFim)}`
    );
  }

  return "Bloqueio";
}

// ==========================================
// RENDERIZAR BLOQUEIOS
// ==========================================

function renderizarBloqueios() {
  const lista = $("listaBloqueios");
  lista.replaceChildren();

  if (!bloqueios.length) {
    mostrarMensagem(
      lista,
      "Nenhum bloqueio cadastrado."
    );
    return;
  }

  bloqueios.forEach(b => {
    const card = elemento(
      "article",
      "",
      "agenda-item"
    );

    card.appendChild(
      elemento("strong", b.motivo || "Indisponível")
    );

    const descricao = elemento(
      "p",
      descricaoBloqueio(b),
      "agenda-detalhes"
    );

    descricao.style.whiteSpace = "pre-line";
    card.appendChild(descricao);

    const excluir = botao(
      "Remover bloqueio",
      () => removerBloqueio(b.id),
      "agenda-btn-secundario"
    );

    card.appendChild(excluir);
    lista.appendChild(card);
  });
}

// ==========================================
// REMOVER BLOQUEIO
// ==========================================

async function removerBloqueio(id) {
  if (!personalAtual) return;

  if (!confirm(
    "Remover este bloqueio?\n\n" +
    "Os horários removidos anteriormente " +
    "não serão recriados automaticamente."
  )) return;

  try {
    const ref = doc(db, COLECAO_BLOQUEIOS, id);

    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);

      if (!snap.exists()) {
        throw new Error("Bloqueio não encontrado.");
      }

      if (
        snap.data().personalId !== personalAtual.uid
      ) {
        throw new Error("Bloqueio não autorizado.");
      }

      tx.delete(ref);
    });

    alert("Bloqueio removido!");

  } catch (erro) {
    mostrarErro(erro);
  }
}

// ==========================================
// CONFIRMAR SOLICITAÇÕES EM GRUPO
// ==========================================

async function confirmarSolicitacoesEmLote(grupo) {
  if (!personalAtual || !grupo?.length) return;

  const alunoId = grupo[0].alunoId;
  const alunoNome = grupo[0].alunoNome || "Aluno";

  if (!alunoId || grupo.some(h => h.alunoId !== alunoId)) {
    alert("Grupo de solicitações inválido.");
    return;
  }

  if (grupo.length > 400) {
    alert("Há solicitações demais para uma única operação.");
    return;
  }

  const confirmar = confirm(
    `Confirmar ${grupo.length} horário(s) ` +
    `de ${alunoNome}?\n\n` +
    "Todos serão confirmados de uma só vez."
  );

  if (!confirmar) return;

  try {
    const ids = [...new Set(grupo.map(h => h.id))];

    await runTransaction(db, async tx => {
      const documentos = [];

      // Primeiro, lê todos os documentos.
      for (const id of ids) {
        const ref = doc(db, "agenda", id);
        const snap = await tx.get(ref);

        documentos.push({ ref, snap });
      }

      // Verifica se as solicitações continuam válidas.
      for (const { snap } of documentos) {
        if (!snap.exists()) {
          throw new Error(
            "Um dos horários foi removido."
          );
        }

        const h = snap.data();

        if (
          h.personalId !== personalAtual.uid ||
          h.alunoId !== alunoId ||
          h.status !== "solicitado" ||
          !horarioFuturo(h.data, h.hora)
        ) {
          throw new Error(
            "Uma solicitação foi alterada. " +
            "Atualize a agenda e tente novamente."
          );
        }
      }

      // Confirma todos na mesma transação.
      for (const { ref } of documentos) {
        tx.update(ref, {
          status: "confirmado",
          confirmadoEm: serverTimestamp()
        });
      }
    });

    alert(
      `${ids.length} agendamento(s) confirmado(s)!`
    );

    // A lista será atualizada pelo onSnapshot.

  } catch (erro) {
    console.error(erro);

    alert(
      erro.message ||
      "Não foi possível confirmar os agendamentos."
    );
  }
}

// ==========================================
// ENCERRAMENTO
// ==========================================

window.addEventListener("pagehide", () => {
  encerrarEscutas();
});
