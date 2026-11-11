
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection, query, where, getDocs, getDoc, doc,
  addDoc, updateDoc, deleteDoc, onSnapshot,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  moeda, statusAtual, criarCartao,
  criarBotao, elemento, ordenar
} from "./mensalidades-comum.js";

const $ = id => document.getElementById(id);

let personalAtual = null;
let mensalidades = [];
let alunos = [];
let editandoId = null;
let cancelarEscuta = null;

$("voltar").onclick = () => location.href = "personal.html";
$("btnCancelarEdicao").onclick = limparFormulario;
$("filtroMensalidades").onchange = renderizar;

onAuthStateChanged(auth, async user => {
  if (cancelarEscuta) {
    cancelarEscuta();
    cancelarEscuta = null;
  }

  if (!user) {
    location.href = "index.html";
    return;
  }

  try {
    const perfil = await getDoc(doc(db, "usuarios", user.uid));

    if (!perfil.exists() || perfil.data().tipo !== "personal") {
      location.href = "index.html";
      return;
    }

    personalAtual = user;

    await carregarAlunos();

    const consulta = query(
      collection(db, "mensalidades"),
      where("personalId", "==", user.uid)
    );

    cancelarEscuta = onSnapshot(consulta, snapshot => {
      mensalidades = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      renderizar();
    }, erro => {
      console.error(erro);
      $("listaMensalidades").textContent =
        "Erro ao carregar mensalidades.";
    });

  } catch (erro) {
    console.error(erro);
    alert("Não foi possível carregar os dados.");
  }
});

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
  }));

  alunos.sort((a, b) =>
    (a.nome || "").localeCompare(b.nome || "")
  );

  const select = $("alunoSelect");
  select.replaceChildren(new Option("Selecione o aluno", ""));

  alunos.forEach(aluno => {
    select.add(new Option(aluno.nome || "Aluno", aluno.id));
  });
}

$("formMensalidade").addEventListener("submit", async event => {
  event.preventDefault();

  if (!personalAtual) return;

  const alunoId = $("alunoSelect").value;
  const aluno = alunos.find(a => a.id === alunoId);

  const nomePlano = $("nomePlano").value.trim();
  const valorPlano = Number($("valorPlano").value);
  const vencimento = $("vencimento").value;
  const status = $("statusPagamento").value;

  if (
    !aluno ||
    !nomePlano ||
    !Number.isFinite(valorPlano) ||
    valorPlano <= 0 ||
    !vencimento
  ) {
    alert("Preencha os campos corretamente.");
    return;
  }

  const botao = $("btnSalvar");
  botao.disabled = true;

  try {
    const dados = {
      personalId: personalAtual.uid,
      alunoId,
      alunoNome: aluno.nome || "Aluno",
      nomePlano,
      valorPlano,
      vencimento,
      status,
      atualizadoEm: serverTimestamp()
    };

    if (editandoId) {
      const registro = mensalidades.find(m => m.id === editandoId);

      if (!registro || registro.personalId !== personalAtual.uid) {
        throw new Error("Mensalidade não encontrada.");
      }

      // Preserva a data original de pagamento nas edições.
      if (status === "pago" && registro.status !== "pago") {
        dados.pagoEm = serverTimestamp();
      }

      if (status !== "pago") {
        dados.pagoEm = null;
      }

      await updateDoc(
        doc(db, "mensalidades", editandoId),
        dados
      );

      alert("Mensalidade atualizada!");
    } else {
      await addDoc(collection(db, "mensalidades"), {
        ...dados,
        criadoEm: serverTimestamp(),
        pagoEm: status === "pago" ? serverTimestamp() : null
      });

      alert("Mensalidade cadastrada!");
    }

    limparFormulario();

  } catch (erro) {
    console.error(erro);
    alert(erro.message || "Erro ao salvar mensalidade.");
  } finally {
    botao.disabled = false;
  }
});

function limparFormulario() {
  editandoId = null;

  $("formMensalidade").reset();
  $("tituloFormulario").textContent = "Nova mensalidade";
  $("btnSalvar").textContent = "Salvar mensalidade";
  $("btnCancelarEdicao").hidden = true;
}

function editar(m) {
  editandoId = m.id;

  // Garante que um aluno antigo também possa ser editado.
  if (![...$("alunoSelect").options].some(o => o.value === m.alunoId)) {
    $("alunoSelect").add(
      new Option(m.alunoNome || "Aluno antigo", m.alunoId)
    );
  }

  $("alunoSelect").value = m.alunoId;
  $("nomePlano").value = m.nomePlano || "";
  $("valorPlano").value = Number(m.valorPlano) || 0;
  $("vencimento").value = m.vencimento || "";
  $("statusPagamento").value =
    m.status === "pago" ? "pago" : "pendente";

  $("tituloFormulario").textContent = "Editar mensalidade";
  $("btnSalvar").textContent = "Salvar alterações";
  $("btnCancelarEdicao").hidden = false;

  $("formMensalidade").scrollIntoView({
    behavior: "smooth",
    block: "center"
  });
}

async function alterarPagamento(m) {
  const pagar = m.status !== "pago";

  const confirmar = confirm(
    pagar
      ? `Confirmar o pagamento de ${moeda(m.valorPlano)}?`
      : "Voltar esta mensalidade para pendente?"
  );

  if (!confirmar) return;

  await updateDoc(doc(db, "mensalidades", m.id), {
    status: pagar ? "pago" : "pendente",
    pagoEm: pagar ? serverTimestamp() : null,
    atualizadoEm: serverTimestamp()
  });

  alert(pagar ? "Pagamento confirmado!" : "Pagamento revertido!");
}

async function excluir(m) {
  if (!confirm(
    `Excluir a mensalidade "${m.nomePlano}" de ${m.alunoNome}?`
  )) return;

  await deleteDoc(doc(db, "mensalidades", m.id));

  if (editandoId === m.id) limparFormulario();

  alert("Mensalidade excluída!");
}

function atualizarResumo() {
  let recebido = 0;
  let pendente = 0;
  let atrasado = 0;
  let total = 0;

  mensalidades.forEach(m => {
    const valor = Number(m.valorPlano) || 0;
    const status = statusAtual(m);

    total += valor;

    if (status === "pago") recebido += valor;
    else if (status === "atrasado") atrasado += valor;
    else pendente += valor;
  });

  $("totalRecebido").textContent = moeda(recebido);
  $("totalPendente").textContent = moeda(pendente);
  $("totalAtrasado").textContent = moeda(atrasado);
  $("totalGeral").textContent = moeda(total);
}

function renderizar() {
  atualizarResumo();

  const lista = $("listaMensalidades");
  lista.replaceChildren();

  const filtro = $("filtroMensalidades").value;

  const registros = mensalidades
    .filter(m =>
      filtro === "todos" || statusAtual(m) === filtro
    )
    .sort(ordenar);

  if (!registros.length) {
    lista.appendChild(
      elemento("p", "Nenhuma mensalidade encontrada.")
    );
    return;
  }

  registros.forEach(m => {
    const card = criarCartao(m, true);
    const acoes = elemento("div", "", "mens-acoes");

    acoes.appendChild(criarBotao(
      m.status === "pago" ? "Reverter pagamento" : "Marcar como pago",
      () => alterarPagamento(m),
      m.status === "pago" ? "mens-secundario" : ""
    ));

    acoes.appendChild(criarBotao(
      "Editar",
      () => editar(m),
      "mens-secundario"
    ));

    acoes.appendChild(criarBotao(
      "Excluir",
      () => excluir(m),
      "mens-excluir"
    ));

    card.appendChild(acoes);
    lista.appendChild(card);
  });
}

// Recalcula os atrasos quando o usuário retorna à aba.
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) renderizar();
});
