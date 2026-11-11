
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

// ==========================================
// CONFIGURAÇÕES
// ==========================================

const $ = id => document.getElementById(id);
const LETRAS = ["A", "B", "C", "D", "E"];

const DIAS = [
  "Domingo", "Segunda-feira", "Terça-feira",
  "Quarta-feira", "Quinta-feira",
  "Sexta-feira", "Sábado"
];

// ==========================================
// ESTADO
// ==========================================

let alunoAtual = null;
let perfilAluno = null;
let fichas = [];
let agenda = [];

let letraEscolhida = null;
let inicioSemana = segundaDaSemana(new Date());

let cancelarFichas = null;
let cancelarAgenda = null;
let versaoAuth = 0;

let salvando = false;
let correcaoId = null;
let letraCorrecao = null;

// ==========================================
// FUNÇÕES AUXILIARES
// ==========================================

function criar(tag, texto = "", classe = "") {
  const el = document.createElement(tag);
  el.textContent = String(texto);

  if (classe) el.className = classe;

  return el;
}

function dataISO(d) {
  return [
    d.getFullYear(),
    String(d.getMonth() + 1).padStart(2, "0"),
    String(d.getDate()).padStart(2, "0")
  ].join("-");
}

function hojeISO() {
  return dataISO(new Date());
}

function dataLocal(valor) {
  const [ano, mes, dia] = valor.split("-").map(Number);

  return new Date(ano, mes - 1, dia, 12);
}

function dataBR(valor) {
  const [ano, mes, dia] = valor.split("-");
  return `${dia}/${mes}/${ano}`;
}

function segundaDaSemana(data) {
  const d = new Date(data);
  d.setHours(12, 0, 0, 0);

  const dia = d.getDay();
  d.setDate(d.getDate() - ((dia + 6) % 7));

  return d;
}

function adicionarDias(data, quantidade) {
  const resultado = new Date(data);
  resultado.setDate(resultado.getDate() + quantidade);
  return resultado;
}

function inicioAgendamento(h) {
  return new Date(`${h.data}T${h.hora}:00`);
}

function duracao(h) {
  const valor = Number(h.duracaoMinutos);

  return Number.isFinite(valor) && valor > 0
    ? valor
    : 60;
}

function fimAgendamento(h) {
  return new Date(
    inicioAgendamento(h).getTime() +
    duracao(h) * 60000
  );
}

function horarioComecou(h) {
  return inicioAgendamento(h).getTime() <= Date.now();
}

function horarioTerminou(h) {
  return fimAgendamento(h).getTime() <= Date.now();
}

function formatarDataHora(h) {
  return `${dataBR(h.data)} às ${h.hora}`;
}

function letraDaFicha(f) {
  const letra = String(f.letra || "").toUpperCase();

  if (LETRAS.includes(letra)) return letra;

  const titulo = String(f.titulo || "");

  const encontrado = titulo.match(
    /^treino\s+([ABCDE])(?:\b|[\s\-–:])/i
  );

  return encontrado
    ? encontrado[1].toUpperCase()
    : null;
}

function fichaPorLetra(letra) {
  return fichas.find(f =>
    letraDaFicha(f) === letra
  );
}

function gruposDaFicha(f) {
  if (
    Array.isArray(f.gruposMusculares) &&
    f.gruposMusculares.length
  ) {
    return f.gruposMusculares.join(", ");
  }

  const grupos = [...new Set(
    (f.exercicios || [])
      .map(e => e.grupo)
      .filter(Boolean)
  )];

  return grupos.join(", ") || "Grupos não informados";
}

function nomeTreino(letra) {
  return letra ? `Treino ${letra}` : "Treino";
}

function statusHorario(h) {
  if (h.presenca === "presente") {
    return "presente";
  }

  if (horarioTerminou(h)) {
    return "falta";
  }

  return "agendado";
}

function minhasAulas() {
  if (!alunoAtual || !perfilAluno?.personalId) return [];

  return agenda.filter(h =>
    h.alunoId === alunoAtual.uid &&
    h.personalId === perfilAluno.personalId &&
    h.status === "confirmado" &&
    h.data &&
    h.hora
  ).sort((a, b) =>
    `${a.data}T${a.hora}`.localeCompare(
      `${b.data}T${b.hora}`
    )
  );
}

function mostrarAviso(texto, erro = false) {
  const aviso = $("mensagemTreinos");

  aviso.textContent = texto;
  aviso.classList.toggle("erro", erro);
}

function mensagemVazia(container, texto) {
  container.replaceChildren(
    criar("p", texto, "treinos-vazio")
  );
}

// ==========================================
// NAVEGAÇÃO
// ==========================================

$("btnVoltar").onclick = () => {
  location.href = "aluno.html";
};

$("semanaAnterior").onclick = () => {
  inicioSemana = adicionarDias(inicioSemana, -7);
  renderizarSemana();
};

$("semanaProxima").onclick = () => {
  inicioSemana = adicionarDias(inicioSemana, 7);
  renderizarSemana();
};

$("semanaAtual").onclick = () => {
  inicioSemana = segundaDaSemana(new Date());
  renderizarSemana();
};

// ==========================================
// AUTENTICAÇÃO
// ==========================================

onAuthStateChanged(auth, async usuario => {
  const versao = ++versaoAuth;

  encerrarEscutas();

  alunoAtual = null;
  perfilAluno = null;
  fichas = [];
  agenda = [];
  letraEscolhida = null;

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
      perfil.data().tipo !== "aluno"
    ) {
      location.replace("index.html");
      return;
    }

    alunoAtual = usuario;
    perfilAluno = perfil.data();

    if (!perfilAluno.personalId) {
      mostrarAviso(
        "Conecte-se a um personal para receber suas fichas."
      );
      renderizarTudo();
      return;
    }

    observarFichas();
    observarAgenda();

  } catch (erro) {
    console.error(erro);

    mostrarAviso(
      "Não foi possível carregar seus treinos.",
      true
    );
  }
});

// ==========================================
// CARREGAMENTO EM TEMPO REAL
// ==========================================

function observarFichas() {
  const uid = alunoAtual.uid;
  const personalId = perfilAluno.personalId;

  const consulta = query(
    collection(db, "treinos"),
    where("alunoId", "==", uid),
    where("status", "==", "ativo")
  );

  cancelarFichas = onSnapshot(
    consulta,

    snapshot => {
      fichas = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })).filter(f => f.personalId === personalId);

      // Uma letra por ficha.
      // A interface não apresenta fichas sem letra.
      fichas.sort((a, b) =>
        String(letraDaFicha(a) || "").localeCompare(
          String(letraDaFicha(b) || "")
        )
      );

      if (
        !letraEscolhida ||
        !fichaPorLetra(letraEscolhida)
      ) {
        letraEscolhida =
          LETRAS.find(l => fichaPorLetra(l)) || null;
      }

      renderizarTudo();
    },

    erro => {
      console.error(erro);
      mostrarAviso("Erro ao carregar fichas.", true);
    }
  );
}

function observarAgenda() {
  const uid = alunoAtual.uid;
  const personalId = perfilAluno.personalId;

  // Mantém o mesmo padrão de consulta da agenda.
  const consulta = query(
    collection(db, "agenda"),
    where("personalId", "==", personalId)
  );

  cancelarAgenda = onSnapshot(
    consulta,

    snapshot => {
      agenda = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })).filter(h => h.alunoId === uid);

      renderizarTudo();
    },

    erro => {
      console.error(erro);
      mostrarAviso(
        "Erro ao carregar seus agendamentos.",
        true
      );
    }
  );
}

// ==========================================
// ESCOLHA DA FICHA
// ==========================================

function renderizarSeletorTreinos() {
  const container = $("seletorTreinos");
  container.replaceChildren();

  LETRAS.forEach(letra => {
    const ficha = fichaPorLetra(letra);

    const btn = criar("button", letra);

    btn.type = "button";
    btn.disabled = !ficha;

    btn.classList.toggle(
      "ativo",
      letraEscolhida === letra
    );

    btn.setAttribute(
      "aria-pressed",
      String(letraEscolhida === letra)
    );

    btn.title = ficha
      ? gruposDaFicha(ficha)
      : `Treino ${letra} não cadastrado`;

    btn.onclick = () => {
      letraEscolhida = letra;
      renderizarTudo();
    };

    container.appendChild(btn);
  });
}

// ==========================================
// EXERCÍCIOS DA FICHA
// ==========================================

function renderizarFicha() {
  const resumo = $("resumoTreino");
  const lista = $("listaExercicios");

  resumo.replaceChildren();
  lista.replaceChildren();

  const ficha = fichaPorLetra(letraEscolhida);

  if (!ficha) {
    resumo.appendChild(
      criar(
        "p",
        "Seu personal ainda não disponibilizou uma ficha."
      )
    );
    return;
  }

  resumo.appendChild(
    criar("strong", nomeTreino(letraEscolhida))
  );

  resumo.appendChild(
    criar("p", gruposDaFicha(ficha))
  );

  const exercicios = Array.isArray(ficha.exercicios)
    ? ficha.exercicios
    : [];

  if (!exercicios.length) {
    mensagemVazia(
      lista,
      ficha.descricao ||
      "Nenhum exercício informado nesta ficha."
    );
    return;
  }

  exercicios.forEach((ex, index) => {
    const card = criar(
      "article",
      "",
      "treino-exercicio"
    );

    card.appendChild(
      criar(
        "strong",
        `${index + 1}. ${ex.nome || "Exercício"}`
      )
    );

    const detalhes = [
      ["Grupo", ex.grupo],
      ["Séries", ex.series],
      ["Repetições", ex.repeticoes],
      ["Descanso", ex.descanso],
      ["Observações", ex.observacao]
    ];

    detalhes.forEach(([rotulo, valor]) => {
      if (
        valor === undefined ||
        valor === null ||
        String(valor).trim() === ""
      ) return;

      card.appendChild(
        criar("p", `${rotulo}: ${valor}`)
      );
    });

    if (ex.video) {
      try {
        const url = new URL(ex.video);

        if (
          url.protocol === "https:" ||
          url.protocol === "http:"
        ) {
          const link = criar("a", "▶ Ver demonstração");

          link.href = url.href;
          link.target = "_blank";
          link.rel = "noopener noreferrer";

          card.appendChild(link);
        }
      } catch {
        // Ignora links inválidos.
      }
    }

    lista.appendChild(card);
  });
}

// ==========================================
// REGISTRO DE PRESENÇA
// ==========================================

function renderizarRegistroPresenca() {
  const lista = $("listaRegistroPresenca");
  lista.replaceChildren();

  const hoje = hojeISO();

  const pendentes = minhasAulas().filter(h =>
    h.data === hoje &&
    h.presenca !== "presente"
  );

  const concluidas = minhasAulas().filter(h =>
    h.data === hoje &&
    h.presenca === "presente"
  );

  if (!pendentes.length && !concluidas.length) {
    mensagemVazia(
      lista,
      "Você não possui horários confirmados para hoje."
    );
    return;
  }

  concluidas.forEach(h => {
    const card = criar(
      "article",
      "",
      "treino-presenca"
    );

    card.appendChild(
      criar("h3", `✓ ${h.hora} — Presença registrada`)
    );

    card.appendChild(
      criar(
        "p",
        `${nomeTreino(h.treinoLetra)} realizado.`
      )
    );

    lista.appendChild(card);
  });

  pendentes.forEach(h => {
    const card = criar(
      "article",
      "",
      "treino-presenca"
    );

    card.appendChild(
      criar("h3", `Treino agendado às ${h.hora}`)
    );

    const podeRegistrar = horarioComecou(h);

    card.appendChild(
      criar(
        "p",
        !podeRegistrar
          ? "A presença poderá ser registrada a partir do início do horário."
          : "Selecione a ficha realizada e registre sua presença."
      )
    );

    const btn = criar(
      "button",
      "✓ Registrar treino realizado"
    );

    btn.disabled =
      !podeRegistrar ||
      !fichaPorLetra(letraEscolhida) ||
      salvando;

    btn.onclick = () => {
      registrarPresenca(
        h.id,
        letraEscolhida,
        horarioTerminou(h)
      );
    };

    card.appendChild(btn);
    lista.appendChild(card);
  });
}

// ==========================================
// ATUALIZAR PRESENÇA NO FIRESTORE
// ==========================================

async function registrarPresenca(
  agendamentoId,
  letra,
  corrigindo = false
) {
  if (salvando || !alunoAtual || !perfilAluno) {
    return false;
  }

  const ficha = fichaPorLetra(letra);

  if (!ficha) {
    alert("Selecione uma ficha válida.");
    return false;
  }

  if (!confirm(
    corrigindo
      ? `Corrigir ausência e registrar Treino ${letra}?`
      : `Confirmar que realizou o Treino ${letra}?`
  )) {
    return false;
  }

  salvando = true;
  renderizarRegistroPresenca();

  try {
    const ref = doc(db, "agenda", agendamentoId);

    await runTransaction(db, async tx => {
      const snap = await tx.get(ref);

      if (!snap.exists()) {
        throw new Error(
          "Agendamento não encontrado."
        );
      }

      const h = snap.data();

      if (
        h.alunoId !== alunoAtual.uid ||
        h.personalId !== perfilAluno.personalId ||
        h.status !== "confirmado"
      ) {
        throw new Error(
          "Este agendamento não está confirmado."
        );
      }

      if (h.presenca === "presente") {
        throw new Error(
          "A presença já foi registrada."
        );
      }

      if (!horarioComecou(h)) {
        throw new Error(
          "O horário do treino ainda não começou."
        );
      }

      tx.update(ref, {
        presenca: "presente",
        treinoId: ficha.id,
        treinoLetra: letra,
        treinoTitulo: ficha.titulo || `Treino ${letra}`,
        presencaRegistradaEm: serverTimestamp(),
        presencaCorrigidaEm: corrigindo
          ? serverTimestamp()
          : null
      });
    });

    mostrarAviso(
      corrigindo
        ? "Ausência corrigida com sucesso!"
        : `Treino ${letra} registrado com sucesso!`
    );

    alert(
      corrigindo
        ? "Presença corrigida!"
        : "Treino registrado!"
    );

    return true;

  } catch (erro) {
    console.error(erro);

    mostrarAviso(
      erro.message || "Erro ao registrar presença.",
      true
    );

    alert(erro.message || "Erro ao registrar presença.");

    return false;

  } finally {
    salvando = false;
    renderizarRegistroPresenca();
  }
}

// ==========================================
// TREINOS DA SEMANA
// ==========================================

function renderizarSemana() {
  const inicio = dataISO(inicioSemana);
  const fim = dataISO(adicionarDias(inicioSemana, 6));

  $("periodoSemana").textContent =
    `${dataBR(inicio)} a ${dataBR(fim)}`;

  const aulasSemana = minhasAulas().filter(h =>
    h.data >= inicio && h.data <= fim
  );

  const presentes = aulasSemana.filter(h =>
    statusHorario(h) === "presente"
  );

  const faltas = aulasSemana.filter(h =>
    statusHorario(h) === "falta"
  );

  const agendados = aulasSemana.filter(h =>
    statusHorario(h) === "agendado"
  );

  $("totalPresentes").textContent = presentes.length;
  $("totalFaltas").textContent = faltas.length;
  $("totalAgendados").textContent = agendados.length;

  const lista = $("listaSemana");
  lista.replaceChildren();

  if (!aulasSemana.length) {
    mensagemVazia(
      lista,
      "Não há aulas confirmadas nesta semana."
    );
    return;
  }

  aulasSemana.forEach(h => {
    const status = statusHorario(h);

    const linha = criar(
      "article",
      "",
      "semana-item"
    );

    const icone = criar(
      "div",
      status === "presente"
        ? "✓"
        : status === "falta"
          ? "✕"
          : "◷",
      `semana-icone ${status}`
    );

    linha.appendChild(icone);

    const info = criar(
      "div",
      "",
      "semana-info"
    );

    const dia = DIAS[dataLocal(h.data).getDay()];

    info.appendChild(
      criar(
        "strong",
        `${dia} · ${dataBR(h.data)}`
      )
    );

    info.appendChild(
      criar(
        "p",
        `Horário: ${h.hora}`
      )
    );

    let descricao = "";

    if (status === "presente") {
      descricao =
        `Presente — ${nomeTreino(h.treinoLetra)}`;
    } else if (status === "falta") {
      descricao = "Faltou à aula";
    } else {
      descricao = "Aula agendada";
    }

    info.appendChild(
      criar("p", descricao, status)
    );

    if (
      status === "presente" &&
      h.presencaCorrigidaEm
    ) {
      info.appendChild(
        criar(
          "p",
          "Presença registrada posteriormente"
        )
      );
    }

    linha.appendChild(info);

    if (status === "falta") {
      const corrigir = criar(
        "button",
        "Corrigir falta"
      );

      corrigir.type = "button";

      corrigir.onclick = () => {
        abrirCorrecao(h.id);
      };

      linha.appendChild(corrigir);
    }

    lista.appendChild(linha);
  });
}

// ==========================================
// MODAL DE CORREÇÃO
// ==========================================

function abrirCorrecao(id) {
  const h = minhasAulas().find(a => a.id === id);

  if (!h || statusHorario(h) !== "falta") {
    alert("Esta ausência não pode ser corrigida.");
    return;
  }

  if (!fichas.length) {
    alert(
      "Seu personal precisa disponibilizar uma ficha."
    );
    return;
  }

  correcaoId = id;
  letraCorrecao = letraEscolhida;

  $("descricaoCorrecao").textContent =
    `Aula de ${formatarDataHora(h)}. ` +
    "Selecione a ficha que você realizou.";

  const container = $("letrasCorrecao");
  container.replaceChildren();

  LETRAS.forEach(letra => {
    const ficha = fichaPorLetra(letra);

    if (!ficha) return;

    const btn = criar("button", letra);

    btn.type = "button";

    btn.classList.toggle(
      "ativo",
      letraCorrecao === letra
    );

    btn.onclick = () => {
      letraCorrecao = letra;

      container.querySelectorAll("button")
        .forEach(b => {
          b.classList.toggle(
            "ativo",
            b.textContent === letra
          );
        });
    };

    container.appendChild(btn);
  });

  if (!fichaPorLetra(letraCorrecao)) {
    letraCorrecao =
      LETRAS.find(l => fichaPorLetra(l)) || null;
  }

  container.querySelectorAll("button")
    .forEach(b => {
      b.classList.toggle(
        "ativo",
        b.textContent === letraCorrecao
      );
    });

  $("modalCorrecao").hidden = false;
}

function fecharCorrecao() {
  $("modalCorrecao").hidden = true;
  correcaoId = null;
  letraCorrecao = null;
}

$("btnCancelarCorrecao").onclick = fecharCorrecao;

$("btnSalvarCorrecao").onclick = async () => {
  if (!correcaoId || !letraCorrecao || salvando) {
    return;
  }

  const sucesso = await registrarPresenca(
    correcaoId,
    letraCorrecao,
    true
  );

  if (sucesso) fecharCorrecao();
};

// ==========================================
// ATUALIZAÇÃO GERAL
// ==========================================

function renderizarTudo() {
  renderizarSeletorTreinos();
  renderizarFicha();
  renderizarRegistroPresenca();
  renderizarSemana();
}

function encerrarEscutas() {
  if (cancelarFichas) cancelarFichas();
  if (cancelarAgenda) cancelarAgenda();

  cancelarFichas = null;
  cancelarAgenda = null;
}

window.addEventListener("pagehide", encerrarEscutas);
