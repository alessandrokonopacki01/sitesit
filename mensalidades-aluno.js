
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
  onSnapshot
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

import {
  moeda,
  statusAtual,
  criarCartao,
  ordenar,
  elemento,
  cobrancasVisiveis,
  competenciaAtual
} from "./mensalidades-comum.js";

const $ = id => document.getElementById(id);

let registros = [];
let cancelarEscuta = null;
let versaoAuth = 0;

// ==========================================
// NAVEGAÇÃO
// ==========================================

$("voltar").onclick = () => {
  location.href = "aluno.html";
};

// ==========================================
// AUTENTICAÇÃO E CONSULTA
// ==========================================

onAuthStateChanged(auth, async user => {
  const versao = ++versaoAuth;

  if (cancelarEscuta) cancelarEscuta();

  cancelarEscuta = null;
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
      perfil.data().tipo !== "aluno"
    ) {
      return location.replace("index.html");
    }

    const consulta = query(
      collection(db, "mensalidades"),
      where("alunoId", "==", user.uid)
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

        $("listaPendentes").textContent =
          "Erro ao carregar mensalidades.";

        $("listaPagas").textContent =
          "Não foi possível carregar o histórico.";
      }
    );

  } catch (erro) {
    console.error(erro);

    $("listaPendentes").textContent =
      "Erro ao carregar seus dados.";
  }
});

// ==========================================
// LISTAS E RESUMO
// ==========================================

function renderizar() {
  const pendentesLista = $("listaPendentes");
  const pagasLista = $("listaPagas");

  pendentesLista.replaceChildren();
  pagasLista.replaceChildren();

  const mensalidades = cobrancasVisiveis(
    registros,
    competenciaAtual()
  );

  let aberto = 0;
  let atrasado = 0;
  let pago = 0;

  const pendentes = [];
  const pagas = [];

  for (const m of mensalidades) {
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
  }

  $("valorAberto").textContent = moeda(aberto);
  $("valorAtrasado").textContent = moeda(atrasado);
  $("valorPago").textContent = moeda(pago);

  pendentes.sort(ordenar);
  pagas.sort(ordenar);

  if (!pendentes.length) {
    pendentesLista.appendChild(
      elemento(
        "p",
        "Você não possui mensalidades em aberto."
      )
    );

  } else {
    for (const m of pendentes) {
      const card = criarCartao(m);

      if (
        m.registroTipo === "cobrancaRecorrente"
      ) {
        card.appendChild(
          elemento(
            "p",
            `Referência: ${m.competencia}`
          )
        );
      }

      pendentesLista.appendChild(card);
    }
  }

  if (!pagas.length) {
    pagasLista.appendChild(
      elemento(
        "p",
        "Nenhum pagamento registrado ainda."
      )
    );

  } else {
    for (const m of pagas) {
      pagasLista.appendChild(
        criarCartao(m)
      );
    }
  }
}

// ==========================================
// ATUALIZAÇÃO
// ==========================================

document.addEventListener(
  "visibilitychange",
  () => {
    if (!document.hidden) {
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
