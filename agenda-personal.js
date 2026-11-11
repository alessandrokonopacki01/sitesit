
import { auth, db } from './firebase.js';

import {
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

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
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js';

import {
  horarioFuturo,
  ordenarHorarios,
  botao,
  criarCartao,
  mostrarMensagem
} from './agenda-comum.js';

const lista = document.getElementById('listaAgenda');
const dataInput = document.getElementById('dataHorario');
const horaInput = document.getElementById('horaHorario');
const formulario = document.getElementById('formHorario');

let personal = null;
let cancelarEscuta = null;

window.voltar = () => {
  location.href = 'personal.html';
};

function definirDataMinima() {
  const agora = new Date();

  const local = new Date(
    agora.getTime() - agora.getTimezoneOffset() * 60000
  );

  dataInput.min = local.toISOString().slice(0, 10);
}

definirDataMinima();

onAuthStateChanged(auth, async (user) => {
  if (cancelarEscuta) {
    cancelarEscuta();
    cancelarEscuta = null;
  }

  if (!user) {
    location.href = 'index.html';
    return;
  }

  try {
    const snap = await getDoc(
      doc(db, 'usuarios', user.uid)
    );

    if (!snap.exists() || snap.data().tipo !== 'personal') {
      location.href = 'index.html';
      return;
    }

    personal = user;

    const q = query(
      collection(db, 'agenda'),
      where('personalId', '==', user.uid)
    );

    cancelarEscuta = onSnapshot(q, (snapshot) => {
      const horarios = snapshot.docs.map(d => ({
        id: d.id,
        ...d.data()
      })).sort(ordenarHorarios);

      lista.replaceChildren();

      const futuros = horarios.filter(h =>
        horarioFuturo(h.data, h.hora)
      );

      if (!futuros.length) {
        mostrarMensagem(lista, 'Nenhum horário futuro.');
        return;
      }

      for (const h of futuros) {
        const status = h.status === 'solicitado'
          ? 'Solicitado'
          : h.status === 'confirmado'
          ? 'Confirmado'
          : 'Disponível';

        const card = criarCartao(
          h,
          status,
          h.alunoNome ? `Aluno: ${h.alunoNome}` : ''
        );

        const acoes = document.createElement('div');
        acoes.className = 'agenda-acoes';

        if (h.status === 'solicitado') {
          acoes.appendChild(
            botao('Confirmar', () => confirmar(h.id))
          );
        }

        if (['solicitado', 'confirmado'].includes(h.status)) {
          acoes.appendChild(
            botao(
              'Cancelar e liberar',
              () => liberar(h.id),
              'agenda-btn-secundario'
            )
          );
        }

        if (h.status === 'disponivel') {
          acoes.appendChild(
            botao(
              'Excluir horário',
              () => excluir(h.id),
              'agenda-btn-secundario'
            )
          );
        }

        card.appendChild(acoes);
        lista.appendChild(card);
      }

    }, (erro) => {
      console.error(erro);
      mostrarMensagem(lista, 'Não foi possível carregar a agenda.');
    });

  } catch (erro) {
    console.error(erro);
    mostrarMensagem(lista, 'Erro ao carregar a agenda.');
  }
});

formulario.addEventListener('submit', async (event) => {
  event.preventDefault();

  if (!personal) return;

  const data = dataInput.value;
  const hora = horaInput.value;

  if (!horarioFuturo(data, hora)) {
    alert('Escolha uma data e hora futuras.');
    return;
  }

  const enviar = formulario.querySelector(
    'button[type="submit"]'
  );

  enviar.disabled = true;

  try {
    const q = query(
      collection(db, 'agenda'),
      where('personalId', '==', personal.uid)
    );

    const existentes = await getDocs(q);

    if (existentes.docs.some(d =>
      d.data().data === data &&
      d.data().hora === hora
    )) {
      throw new Error('Você já cadastrou esse horário.');
    }

    const id = `${personal.uid}_${data}_${hora.replace(':', '-')}`;

    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'agenda', id);
      const snap = await tx.get(ref);

      if (snap.exists()) {
        throw new Error('Você já cadastrou esse horário.');
      }

      tx.set(ref, {
        personalId: personal.uid,
        alunoId: null,
        alunoNome: null,
        data,
        hora,
        status: 'disponivel',
        criadoEm: serverTimestamp()
      });
    });

    formulario.reset();
    definirDataMinima();

    alert('Horário criado!');

  } catch (erro) {
    alert(erro.message || 'Erro ao criar horário.');
  } finally {
    enviar.disabled = false;
  }
});

async function alterar(id, validar, operacao, mensagem) {
  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'agenda', id);
      const snap = await tx.get(ref);

      if (!snap.exists()) {
        throw new Error('Horário não encontrado.');
      }

      const h = snap.data();

      if (h.personalId !== personal.uid || !validar(h)) {
        throw new Error(
          'O horário foi alterado. Atualize sua agenda.'
        );
      }

      operacao(tx, ref);
    });

    alert(mensagem);

  } catch (erro) {
    alert(erro.message || 'Não foi possível alterar o horário.');
  }
}

async function confirmar(id) {
  await alterar(
    id,
    h => h.status === 'solicitado' && !!h.alunoId,
    (tx, ref) => tx.update(ref, {
      status: 'confirmado',
      confirmadoEm: serverTimestamp()
    }),
    'Agendamento confirmado!'
  );
}

async function liberar(id) {
  if (!confirm(
    'Cancelar este agendamento e disponibilizar o horário novamente?'
  )) return;

  await alterar(
    id,
    h => ['solicitado', 'confirmado'].includes(h.status),
    (tx, ref) => tx.update(ref, {
      status: 'disponivel',
      alunoId: null,
      alunoNome: null,
      canceladoEm: serverTimestamp()
    }),
    'Horário liberado!'
  );
}

async function excluir(id) {
  if (!confirm('Excluir este horário disponível?')) return;

  await alterar(
    id,
    h => h.status === 'disponivel',
    (tx, ref) => tx.delete(ref),
    'Horário excluído!'
  );
}
