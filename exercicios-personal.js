import { auth, db } from "./firebase.js";
import { EXERCICIOS_PADRAO } from "./catalogo-padrao.js";
import {
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  collection,
  query,
  where,
  getDocs,
  addDoc,
  serverTimestamp,
  writeBatch,
  doc
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

let personalAtual = null;

window.voltar = function () {
  window.location.href = "personal.html";
};

onAuthStateChanged(auth, async (user) => {
  if (!user) {
    window.location.href = "index.html";
    return;
  }

  personalAtual = user;
  carregarExercicios();
});

window.salvarExercicio = async function () {
  const nome = document.getElementById("nomeExercicio").value.trim();
  const grupo = document.getElementById("grupoMuscular").value.trim();
  const equipamento = document.getElementById("equipamento").value.trim();
  const video = document.getElementById("video").value.trim();
  const descricao = document.getElementById("descricao").value.trim();

  if (!nome || !grupo) {
    alert("Preencha pelo menos o nome e o grupo muscular.");
    return;
  }

  await addDoc(collection(db, "exercicios"), {
    personalId: personalAtual.uid,
    nome,
    grupo,
    equipamento,
    video,
    descricao,
    criadoEm: serverTimestamp()
  });

  alert("Exercício salvo com sucesso!");

  document.getElementById("nomeExercicio").value = "";
  document.getElementById("grupoMuscular").value = "";
  document.getElementById("equipamento").value = "";
  document.getElementById("video").value = "";
  document.getElementById("descricao").value = "";

  carregarExercicios();
};

async function carregarExercicios() {
  const q = query(
    collection(db, "exercicios"),
    where("personalId", "==", personalAtual.uid)
  );

  const resultado = await getDocs(q);
  const lista = document.getElementById("listaExercicios");

  lista.innerHTML = "";

  if (resultado.empty) {
    lista.innerHTML = "<p>Nenhum exercício cadastrado ainda.</p>";
    return;
  }

  resultado.forEach((docExercicio) => {
    const exercicio = docExercicio.data();

    const item = document.createElement("div");
    item.style.background = "#101014";
    item.style.padding = "14px";
    item.style.borderRadius = "12px";
    item.style.marginBottom = "12px";

    item.innerHTML = `
      <strong>${exercicio.nome}</strong>
      <p style="text-align:left;">Grupo: ${exercicio.grupo}</p>
      <p style="text-align:left;">Equipamento: ${exercicio.equipamento || "-"}</p>
      <p style="text-align:left;">Descrição: ${exercicio.descricao || "-"}</p>
      ${
        exercicio.video
          ? `<p style="text-align:left;"><a href="${exercicio.video}" target="_blank" style="color:#22c55e;">Ver vídeo</a></p>`
          : ""
      }
    `;

    lista.appendChild(item);
  });
}

let importandoPadrao = false;

function normalizarExercicio(valor) {
  return String(valor || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase()
    .replace(/\s+/g, " ");
}

window.importarExerciciosPadrao = async function () {
  if (importandoPadrao) return;

  if (!personalAtual) {
    alert("Faça login para importar os exercícios.");
    return;
  }

  const botao = document.getElementById("btnImportarPadrao");
  const status = document.getElementById("statusImportacao");

  const confirmar = confirm(
    `Deseja importar os ${EXERCICIOS_PADRAO.length} exercícios padrão?\n\n` +
    "Os exercícios existentes não serão apagados nem alterados."
  );

  if (!confirmar) return;

  importandoPadrao = true;
  botao.disabled = true;
  botao.textContent = "Importando exercícios...";
  status.textContent = "Verificando sua biblioteca...";

  try {
    const uid = personalAtual.uid;

    const consulta = query(
      collection(db, "exercicios"),
      where("personalId", "==", uid)
    );

    const resultado = await getDocs(consulta);

    const chaveExercicio = (ex) =>
      `${normalizarExercicio(ex.nome)}|${normalizarExercicio(ex.grupo)}`;

    const existentes = new Set(
      resultado.docs.map(d => chaveExercicio(d.data()))
    );

    const novos = EXERCICIOS_PADRAO.filter(ex =>
      !existentes.has(chaveExercicio(ex))
    );

    if (novos.length === 0) {
      status.textContent = "Sua biblioteca já possui todos os exercícios padrão.";
      alert("Nenhum exercício novo para importar.");
      return;
    }

    const lote = writeBatch(db);
    const colecao = collection(db, "exercicios");

    novos.forEach(exercicio => {
      const referencia = doc(colecao);

      lote.set(referencia, {
        personalId: uid,
        nome: exercicio.nome,
        grupo: exercicio.grupo,
        equipamento: exercicio.equipamento,
        video: exercicio.video,
        descricao: exercicio.descricao,
        origem: "padrao",
        criadoEm: serverTimestamp()
      });
    });

    status.textContent = `Salvando ${novos.length} exercícios...`;

    await lote.commit();

    status.textContent =
      `${novos.length} exercícios importados com sucesso!`;

    alert(
      `Importação concluída!\n\n` +
      `Importados: ${novos.length}\n` +
      `Já existentes: ${EXERCICIOS_PADRAO.length - novos.length}`
    );

    await carregarExercicios();

  } catch (erro) {
    console.error("Erro ao importar exercícios:", erro);

    status.textContent = "Erro durante a importação.";
    alert("Não foi possível importar. Confira o console.");
  } finally {
    importandoPadrao = false;
    botao.disabled = false;
    botao.textContent = "💪 Importar exercícios padrão (136)";
  }
};
