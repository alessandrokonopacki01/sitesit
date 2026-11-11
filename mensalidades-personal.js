
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
  updateDoc,
  deleteDoc,
  onSnapshot,
  serverTimestamp,
  runTransaction
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  moeda,
  statusAtual,
  criarCartao,
  criarBotao,
  elemento,
  ordenar,
  competenciaAtual,
  competenciaDeData,
  cobrancasVisiveis
} from "./mensalidades-comum.js";

const $ = id => document.getElementById(id);

let personalAtual = null;
let alunos = [];
let registros = [];
let editandoId = null;

let cancelarEscuta = null;
let versaoAuth = 0;
let emOperacao = false;

// ==========================================
// ELEMENTOS E EVENTOS
// ==========================================

$("voltar").onclick = () => location.href = "personal.html";

$("btnCancelarEdicao").onclick = limparFormulario;

$("filtroMensalidades").onchange = renderizar;
$("mesCobrancas").onchange = renderizar;
$("incluirAtrasadas").onchange = renderizar;

$("mesCobrancas").max = competenciaAtual();
$("mesCobrancas").value = competenciaAtual();

// ==========================================
// AUTENTICAÇÃO
// ==========================================

onAuthStateChanged(auth, async user => {
  const versao = ++versaoAuth;

  if (cancelarEscuta) cancelarEscuta();

  cancelarEscuta = null;
  personalAtual = null;
  registros = [];

  if (!user) {
    return location.replace("index.html");
  }

  try {
    const perfil = await getDoc(
      doc(db, "usuarios", user.uid)
    );

    if (versao !== versaoAuth) return;

    if (
      !perfil.exists() ||
      perfil.data().tipo !== "personal"
    ) {
      return location.replace("index.html");
    }

    personalAtual = user;

    await carregarAlunos();

    if (versao !== versaoAuth) return;

    const consulta = query(
      collection(db, "mensalidades"),
      where("personalId", "==", user.uid)
    );

    cancelarEscuta = onSnapshot(
      consulta,
      snap => {
        registros = snap.docs.map(d => ({
          id: d.id,
          ...d.data()
        }));

        renderizar();
      },
      erro => {
        console.error(erro);
        $("listaMensalidades").textContent =
          "Erro ao carregar as cobranças.";
      }
    );

  } catch (erro) {
    console.error(erro);
    alert("Não foi possível carregar as mensalidades.");
  }
});

// ==========================================
// CARREGAR ALUNOS
// ==========================================

async function carregarAlunos() {
  const consulta = query(
    collection(db, "usuarios"),
    where("tipo", "==", "aluno"),
    where("personalId", "==", personalAtual.uid)
  );

  const resultado = await getDocs(consulta);

  alunos = resultado.docs.map(d => ({
    id: d.id,
    ...d.data()
  })).sort((a, b) =>
    (a.nome || "").localeCompare(b.nome || "", "pt-BR")
  );

  for (const nome of ["alunoSelect", "alunoRecorrencia"]) {
    const select = $(nome);

    select.replaceChildren(
      new Option("Selecione o aluno", "")
    );

    for (const aluno of alunos) {
      select.add(
        new Option(aluno.nome || "Aluno", aluno.id)
      );
    }
  }
}

// ==========================================
// ÍNDICE DE RECORRÊNCIA
// ==========================================

function indicePlanoId(alunoId) {
  return `indice_${personalAtual.uid}_${alunoId}`;
}

// ==========================================
// CRIAR PLANO MENSAL
// ==========================================

$("formRecorrencia").addEventListener(
  "submit",
  async event => {
    event.preventDefault();

    if (!personalAtual || emOperacao) return;

    const aluno = alunos.find(
      a => a.id === $("alunoRecorrencia").value
    );

    const nomePlano =
      $("nomePlanoRecorrencia").value.trim();

    const valorPlano =
      Number($("valorRecorrencia").value);

    const primeiraData =
      $("primeiroVencimento").value;

    if (
      !aluno ||
      !nomePlano ||
      !(valorPlano > 0) ||
      !/^\d{4}-\d{2}-\d{2}$/.test(primeiraData)
    ) {
      return alert(
        "Preencha corretamente o plano mensal."
      );
    }

    const [ano, mes, dia] = primeiraData
      .split("-")
      .map(Number);

    const teste = new Date(
      ano,
      mes - 1,
      dia,
      12
    );

    if (
      teste.getFullYear() !== ano ||
      teste.getMonth() + 1 !== mes ||
      teste.getDate() !== dia
    ) {
      return alert("Data inicial inválida.");
    }

    const refPlano = doc(
      collection(db, "mensalidades")
    );

    const refIndice = doc(
      db,
      "mensalidades",
      indicePlanoId(aluno.id)
    );

    emOperacao = true;

    $("btnCriarRecorrencia").disabled = true;

    try {
      await runTransaction(db, async tx => {
        const indice = await tx.get(refIndice);

        const planoAtivo = indice.exists()
          ? indice.data().planoAtivoId
          : null;

        if (planoAtivo) {
          const plano = await tx.get(
            doc(db, "mensalidades", planoAtivo)
          );

          if (
            plano.exists() &&
            plano.data().ativo === true
          ) {
            throw new Error(
              "Este aluno já tem um plano mensal ativo. " +
              "Cancele-o antes de criar outro."
            );
          }
        }

        tx.set(refPlano, {
          registroTipo: "recorrencia",
          personalId: personalAtual.uid,
          alunoId: aluno.id,
          alunoNome: aluno.nome || "Aluno",
          nomePlano,
          valorPlano:
            Math.round(valorPlano * 100) / 100,
          primeiraData,
          diaVencimento: dia,
          ativo: true,
          encerramentoCompetencia: null,
          criadoEm: serverTimestamp(),
          atualizadoEm: serverTimestamp()
        });

        tx.set(refIndice, {
          registroTipo: "indiceRecorrencia",
          personalId: personalAtual.uid,
          alunoId: aluno.id,
          planoAtivoId: refPlano.id,
          atualizadoEm: serverTimestamp()
        });
      });

      $("formRecorrencia").reset();

      $("nomePlanoRecorrencia").value =
        "Plano Mensal";

      alert("Mensalidade recorrente ativada!");

    } catch (erro) {
      console.error(erro);

      alert(
        erro.message ||
        "Não foi possível ativar o plano."
      );

    } finally {
      emOperacao = false;

      $("btnCriarRecorrencia").disabled = false;
    }
  }
);

// ==========================================
// CANCELAR RECORRÊNCIA
// ==========================================

async function cancelarRecorrencia(plano) {
  const confirmar = confirm(
    `Cancelar a recorrência de ${plano.alunoNome}?\n\n` +
    "A cobrança do mês atual e o histórico " +
    "serão preservados. Não haverá novas " +
    "cobranças nos próximos meses."
  );

  if (!confirmar) return;

  const refPlano = doc(
    db,
    "mensalidades",
    plano.id
  );

  const refIndice = doc(
    db,
    "mensalidades",
    indicePlanoId(plano.alunoId)
  );

  await runTransaction(db, async tx => {
    const [snapPlano, snapIndice] = await Promise.all([
      tx.get(refPlano),
      tx.get(refIndice)
    ]);

    if (
      !snapPlano.exists() ||
      snapPlano.data().personalId !== personalAtual.uid
    ) {
      throw new Error("Plano não encontrado.");
    }

    if (!snapPlano.data().ativo) {
      throw new Error("Plano já cancelado.");
    }

    tx.update(refPlano, {
      ativo: false,
      encerramentoCompetencia: competenciaAtual(),
      canceladoEm: serverTimestamp(),
      atualizadoEm: serverTimestamp()
    });

    if (
      snapIndice.exists() &&
      snapIndice.data().planoAtivoId === plano.id
    ) {
      tx.update(refIndice, {
        planoAtivoId: null,
        atualizadoEm: serverTimestamp()
      });
    }
  });

  alert(
    "Recorrência cancelada. Histórico preservado."
  );
}

// ==========================================
// EXIBIR PLANOS MENSAIS
// ==========================================

function renderizarRecorrencias() {
  const lista = $("listaRecorrencias");

  lista.replaceChildren();

  const planos = registros
    .filter(r => r.registroTipo === "recorrencia")
    .sort((a, b) =>
      (a.alunoNome || "").localeCompare(
        b.alunoNome || "",
        "pt-BR"
      )
    );

  if (!planos.length) {
    lista.appendChild(
      elemento(
        "p",
        "Nenhum plano recorrente cadastrado."
      )
    );
    return;
  }

  for (const p of planos) {
    const card = elemento(
      "article",
      "",
      "mens-item"
    );

    card.appendChild(
      elemento("strong", p.alunoNome || "Aluno")
    );

    card.appendChild(
      elemento("h3", p.nomePlano || "Plano Mensal")
    );

    card.appendChild(
      elemento(
        "p",
        `${moeda(p.valorPlano)} por mês · ` +
        `dia ${p.diaVencimento}`
      )
    );

    card.appendChild(
      elemento(
        "p",
        `Primeiro vencimento: ` +
        p.primeiraData.split("-").reverse().join("/")
      )
    );

    card.appendChild(
      elemento(
        "span",
        p.ativo ? "Ativo" : "Cancelado",
        `mens-status ${p.ativo ? "pago" : "atrasado"}`
      )
    );

    if (p.ativo) {
      const acoes = elemento(
        "div",
        "",
        "mens-acoes"
      );

      acoes.appendChild(
        criarBotao(
          "Cancelar recorrência",
          () => cancelarRecorrencia(p),
          "mens-excluir"
        )
      );

      card.appendChild(acoes);
    }

    lista.appendChild(card);
  }
}

// ==========================================
// CONFIRMAR OU REVERTER PAGAMENTO
// ==========================================

async function alterarPagamento(m) {
  const pagar = m.status !== "pago";

  if (!confirm(
    pagar
      ? `Confirmar pagamento de ${moeda(m.valorPlano)}?`
      : "Reverter este pagamento?"
  )) {
    return;
  }

  const referencia = doc(
    db,
    "mensalidades",
    m.id
  );

  await runTransaction(db, async tx => {
    const existente = await tx.get(referencia);

    if (existente.exists()) {
      if (
        existente.data().personalId !== personalAtual.uid ||
        existente.data().registroTipo === "recorrencia"
      ) {
        throw new Error("Cobrança inválida.");
      }

      tx.update(referencia, {
        status: pagar ? "pago" : "pendente",
        pagoEm: pagar ? serverTimestamp() : null,
        atualizadoEm: serverTimestamp()
      });

    } else {
      if (!m.virtual || !m.planoRecorrenteId) {
        throw new Error("Cobrança não encontrada.");
      }

      const planoSnap = await tx.get(
        doc(
          db,
          "mensalidades",
          m.planoRecorrenteId
        )
      );

      if (
        !planoSnap.exists() ||
        planoSnap.data().personalId !== personalAtual.uid
      ) {
        throw new Error("Matrícula não encontrada.");
      }

      tx.set(referencia, {
        registroTipo: "cobrancaRecorrente",
        planoRecorrenteId: m.planoRecorrenteId,
        competencia: m.competencia,
        personalId: m.personalId,
        alunoId: m.alunoId,
        alunoNome: m.alunoNome,
        nomePlano: m.nomePlano,
        valorPlano: m.valorPlano,
        vencimento: m.vencimento,
        status: pagar ? "pago" : "pendente",
        pagoEm: pagar ? serverTimestamp() : null,
        criadoEm: serverTimestamp(),
        atualizadoEm: serverTimestamp()
      });
    }
  });

  alert(
    pagar
      ? "Pagamento confirmado!"
      : "Pagamento revertido!"
  );
}

// ==========================================
// COBRANÇAS AVULSAS E ANTIGAS
// ==========================================

$("formMensalidade").addEventListener(
  "submit",
  async e => {
    e.preventDefault();

    if (!personalAtual) return;

    const aluno = alunos.find(
      a => a.id === $("alunoSelect").value
    );

    const nomePlano =
      $("nomePlano").value.trim();

    const valorPlano =
      Number($("valorPlano").value);

    const vencimento =
      $("vencimento").value;

    const status =
      $("statusPagamento").value;

    if (
      !aluno ||
      !nomePlano ||
      !(valorPlano > 0) ||
      !vencimento
    ) {
      return alert(
        "Preencha todos os campos corretamente."
      );
    }

    $("btnSalvar").disabled = true;

    try {
      const dados = {
        registroTipo: "avulsa",
        personalId: personalAtual.uid,
        alunoId: aluno.id,
        alunoNome: aluno.nome || "Aluno",
        nomePlano,
        valorPlano:
          Math.round(valorPlano * 100) / 100,
        vencimento,
        status,
        atualizadoEm: serverTimestamp()
      };

      if (editandoId) {
        const atual = registros.find(
          r => r.id === editandoId
        );

        if (
          !atual ||
          atual.personalId !== personalAtual.uid ||
          atual.registroTipo === "cobrancaRecorrente"
        ) {
          throw new Error(
            "Cobrança avulsa não encontrada."
          );
        }

        if (
          status === "pago" &&
          atual.status !== "pago"
        ) {
          dados.pagoEm = serverTimestamp();
        }

        if (status !== "pago") {
          dados.pagoEm = null;
        }

        await updateDoc(
          doc(db, "mensalidades", editandoId),
          dados
        );

      } else {
        await addDoc(
          collection(db, "mensalidades"),
          {
            ...dados,
            criadoEm: serverTimestamp(),
            pagoEm:
              status === "pago"
                ? serverTimestamp()
                : null
          }
        );
      }

      alert("Cobrança salva!");
      limparFormulario();

    } catch (erro) {
      console.error(erro);

      alert(
        erro.message ||
        "Erro ao salvar cobrança."
      );

    } finally {
      $("btnSalvar").disabled = false;
    }
  }
);

// ==========================================
// LIMPAR FORMULÁRIO
// ==========================================

function limparFormulario() {
  editandoId = null;

  $("formMensalidade").reset();

  $("tituloFormulario").textContent =
    "Nova cobrança avulsa";

  $("btnSalvar").textContent =
    "Salvar cobrança";

  $("btnCancelarEdicao").hidden = true;
}

// ==========================================
// EDITAR COBRANÇA AVULSA
// ==========================================

function editarAvulsa(m) {
  if (
    ![...$("alunoSelect").options].some(
      o => o.value === m.alunoId
    )
  ) {
    $("alunoSelect").add(
      new Option(
        m.alunoNome || "Aluno antigo",
        m.alunoId
      )
    );
  }

  editandoId = m.id;

  $("alunoSelect").value = m.alunoId;
  $("nomePlano").value = m.nomePlano || "";
  $("valorPlano").value = m.valorPlano;
  $("vencimento").value = m.vencimento || "";

  $("statusPagamento").value =
    m.status === "pago" ? "pago" : "pendente";

  $("tituloFormulario").textContent =
    "Editar cobrança avulsa";

  $("btnSalvar").textContent =
    "Salvar alterações";

  $("btnCancelarEdicao").hidden = false;

  $("formMensalidade").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

// ==========================================
// EXCLUIR COBRANÇA AVULSA
// ==========================================

async function excluirAvulsa(m) {
  if (!confirm(
    `Excluir a cobrança "${m.nomePlano}" ` +
    `de ${m.alunoNome}?`
  )) {
    return;
  }

  const snap = await getDoc(
    doc(db, "mensalidades", m.id)
  );

  if (
    !snap.exists() ||
    snap.data().personalId !== personalAtual.uid ||
    [
      "recorrencia",
      "cobrancaRecorrente",
      "indiceRecorrencia"
    ].includes(snap.data().registroTipo)
  ) {
    throw new Error(
      "Cobrança não pode ser excluída."
    );
  }

  await deleteDoc(
    doc(db, "mensalidades", m.id)
  );

  if (editandoId === m.id) {
    limparFormulario();
  }
}

// ==========================================
// EXIBIÇÃO E FILTROS
// ==========================================

function renderizar() {
  renderizarRecorrencias();

  const mes =
    $("mesCobrancas").value || competenciaAtual();

  const incluirAtrasadas =
    $("incluirAtrasadas").checked;

  const filtro =
    $("filtroMensalidades").value;

  const todas = cobrancasVisiveis(
    registros,
    mes
  );

  const visiveis = todas.filter(m => {
    const competencia =
      m.competencia ||
      competenciaDeData(m.vencimento);

    return (
      competencia === mes ||
      (
        incluirAtrasadas &&
        competencia < mes &&
        statusAtual(m) !== "pago"
      )
    );
  });

  const registrosFiltrados = visiveis
    .filter(
      m => filtro === "todos" ||
      statusAtual(m) === filtro
    )
    .sort(ordenar);

  let recebido = 0;
  let pendente = 0;
  let atrasado = 0;
  let total = 0;

  for (const m of visiveis) {
    const valor = Number(m.valorPlano) || 0;

    total += valor;

    const status = statusAtual(m);

    if (status === "pago") {
      recebido += valor;
    } else if (status === "atrasado") {
      atrasado += valor;
    } else {
      pendente += valor;
    }
  }

  $("totalRecebido").textContent =
    moeda(recebido);

  $("totalPendente").textContent =
    moeda(pendente);

  $("totalAtrasado").textContent =
    moeda(atrasado);

  $("totalGeral").textContent =
    moeda(total);

  const lista = $("listaMensalidades");

  lista.replaceChildren();

  if (!registrosFiltrados.length) {
    lista.appendChild(
      elemento(
        "p",
        "Nenhuma cobrança para este filtro."
      )
    );

    return;
  }

  for (const m of registrosFiltrados) {
    const card = criarCartao(m, true);

    if (
      m.registroTipo === "cobrancaRecorrente"
    ) {
      card.appendChild(
        elemento(
          "p",
          `Referência: ${m.competencia} · Plano mensal`
        )
      );
    }

    const acoes = elemento(
      "div",
      "",
      "mens-acoes"
    );

    acoes.appendChild(
      criarBotao(
        m.status === "pago"
          ? "Reverter pagamento"
          : "Marcar como pago",
        () => alterarPagamento(m),
        m.status === "pago"
          ? "mens-secundario"
          : ""
      )
    );

    if (
      m.registroTipo !== "cobrancaRecorrente"
    ) {
      acoes.appendChild(
        criarBotao(
          "Editar",
          () => editarAvulsa(m),
          "mens-secundario"
        )
      );

      acoes.appendChild(
        criarBotao(
          "Excluir",
          () => excluirAvulsa(m),
          "mens-excluir"
        )
      );
    }

    card.appendChild(acoes);
    lista.appendChild(card);
  }
}

// ==========================================
// ATUALIZAÇÃO AO VOLTAR À PÁGINA
// ==========================================

document.addEventListener(
  "visibilitychange",
  () => {
    if (!document.hidden) {
      $("mesCobrancas").max =
        competenciaAtual();

      if (
        $("mesCobrancas").value >
        competenciaAtual()
      ) {
        $("mesCobrancas").value =
          competenciaAtual();
      }

      renderizar();
    }
  }
);

window.addEventListener(
  "pagehide",
  () => {
    if (cancelarEscuta) cancelarEscuta();
  }
);
