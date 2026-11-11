
import { auth, db } from "./firebase.js";

import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc, getDoc, collection, query, where, onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  moeda, statusAtual, criarCartao,
  ordenar, elemento
} from "./mensalidades-comum.js";

const $ = id => document.getElementById(id);

let mensalidades = [];
let cancelarEscuta = null;

$("voltar").onclick = () => {
  location.href = "aluno.html";
};

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

    if (!perfil.exists() || perfil.data().tipo !== "aluno") {
      location.href = "index.html";
      return;
    }

    const consulta = query(
      collection(db, "mensalidades"),
      where("alunoId", "==", user.uid)
    );

    cancelarEscuta = onSnapshot(consulta, snapshot => {
      mensalidades = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      }));

      renderizar();

    }, erro => {
      console.error(erro);
      $("listaPendentes").textContent =
        "Erro ao carregar mensalidades.";
      $("listaPagas").textContent =
        "Não foi possível carregar o histórico.";
    });

  } catch (erro) {
    console.error(erro);
    $("listaPendentes").textContent =
      "Erro ao carregar seus dados.";
  }
});

function renderizar() {
  const listaPendentes = $("listaPendentes");
  const listaPagas = $("listaPagas");

  listaPendentes.replaceChildren();
  listaPagas.replaceChildren();

  let aberto = 0;
  let atrasado = 0;
  let pago = 0;

  const pendentes = [];
  const pagas = [];

  mensalidades.forEach(m => {
    const valor = Number(m.valorPlano) || 0;
    const status = statusAtual(m);

    if (status === "pago") {
      pago += valor;
      pagas.push(m);
    } else {
      aberto += valor;
      pendentes.push(m);

      if (status === "atrasado") {
        atrasado += valor;
      }
    }
  });

  $("valorAberto").textContent = moeda(aberto);
  $("valorAtrasado").textContent = moeda(atrasado);
  $("valorPago").textContent = moeda(pago);

  pendentes.sort(ordenar);
  pagas.sort(ordenar);

  if (!pendentes.length) {
    listaPendentes.appendChild(
      elemento("p", "Você não possui mensalidades em aberto.")
    );
  } else {
    pendentes.forEach(m => {
      listaPendentes.appendChild(criarCartao(m));
    });
  }

  if (!pagas.length) {
    listaPagas.appendChild(
      elemento("p", "Nenhum pagamento registrado ainda.")
    );
  } else {
    pagas.forEach(m => {
      listaPagas.appendChild(criarCartao(m));
    });
  }
}

document.addEventListener("visibilitychange", () => {
  if (!document.hidden) renderizar();
});
