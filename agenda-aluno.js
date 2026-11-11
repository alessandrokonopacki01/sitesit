
import { auth, db } from './firebase.js';

import {
  onAuthStateChanged
} from 'https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js';

import {
  doc,
  getDoc,
  collection,
  query,
  where,
  onSnapshot,
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

const listaDisponiveis = document.getElementById('listaHorarios');
const listaMeus = document.getElementById('listaMeusHorarios');

let usuario = null;
let dadosAluno = null;
let cancelarEscuta = null;

window.voltar = () => {
  location.href = 'aluno.html';
};

onAuthStateChanged(auth, async (user) => {
  if (cancelarEscuta) {
    cancelarEscuta();
    cancelarEscuta = null;
  }

  if (!user) {
    location.href = 'index.html';
    return;
  }

  usuario = user;

  try {
    const snap = await getDoc(
      doc(db, 'usuarios', user.uid)
    );

    if (!snap.exists() || snap.data().tipo !== 'aluno') {
      location.href = 'index.html';
      return;
    }

    dadosAluno = snap.data();

    if (!dadosAluno.personalId) {
      mostrarMensagem(
        listaDisponiveis,
        'Conecte-se a um personal para visualizar os horários.'
      );

      mostrarMensagem(
        listaMeus,
        'Nenhum agendamento.'
      );

      return;
    }

    const q = query(
      collection(db, 'agenda'),
      where('personalId', '==', dadosAluno.personalId)
    );

    cancelarEscuta = onSnapshot(q, (snapAgenda) => {
      const horarios = snapAgenda.docs.map(d => ({
        id: d.id,
        ...d.data()
      }))
      .filter(h => horarioFuturo(h.data, h.hora))
      .sort(ordenarHorarios);

      const disponiveis = horarios.filter(
        h => h.status === 'disponivel'
      );

      const meus = horarios.filter(
        h => h.alunoId === usuario.uid &&
        ['solicitado', 'confirmado'].includes(h.status)
      );

      listaDisponiveis.replaceChildren();
      listaMeus.replaceChildren();

      if (!disponiveis.length) {
        mostrarMensagem(
          listaDisponiveis,
          'Nenhum horário disponível no momento.'
        );
      }

      for (const h of disponiveis) {
        const card = criarCartao(h, 'Disponível');

        card.appendChild(
          botao('Solicitar horário', () => solicitar(h.id))
        );

        listaDisponiveis.appendChild(card);
      }

      if (!meus.length) {
        mostrarMensagem(
          listaMeus,
          'Você não possui agendamentos futuros.'
        );
      }

      for (const h of meus) {
        const card = criarCartao(
          h,
          h.status === 'confirmado'
            ? 'Confirmado'
            : 'Aguardando confirmação'
        );

        card.appendChild(
          botao(
            'Cancelar',
            () => cancelar(h.id),
            'agenda-btn-secundario'
          )
        );

        listaMeus.appendChild(card);
      }

    }, (erro) => {
      console.error(erro);

      mostrarMensagem(
        listaDisponiveis,
        'Não foi possível carregar a agenda.'
      );
    });

  } catch (erro) {
    console.error(erro);
    mostrarMensagem(
      listaDisponiveis,
      'Erro ao carregar agenda.'
    );
  }
});

async function solicitar(id) {
  if (!usuario || !dadosAluno?.personalId) return;

  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'agenda', id);
      const snap = await tx.get(ref);

      if (!snap.exists()) {
        throw new Error('Este horário foi removido.');
      }

      const h = snap.data();

      if (
        h.personalId !== dadosAluno.personalId ||
        h.status !== 'disponivel' ||
        !horarioFuturo(h.data, h.hora)
      ) {
        throw new Error(
          'Este horário não está mais disponível.'
        );
      }

      tx.update(ref, {
        alunoId: usuario.uid,
        alunoNome: dadosAluno.nome || 'Aluno',
        status: 'solicitado',
        solicitadoEm: serverTimestamp()
      });
    });

    alert(
      'Solicitação enviada! Aguarde a confirmação do personal.'
    );

  } catch (erro) {
    alert(
      erro.message || 'Não foi possível solicitar o horário.'
    );
  }
}

async function cancelar(id) {
  if (!confirm('Deseja cancelar este agendamento?')) return;

  try {
    await runTransaction(db, async (tx) => {
      const ref = doc(db, 'agenda', id);
      const snap = await tx.get(ref);

      if (!snap.exists()) {
        throw new Error('Agendamento não encontrado.');
      }

      const h = snap.data();

      if (
        h.alunoId !== usuario.uid ||
        h.personalId !== dadosAluno.personalId ||
        !['solicitado', 'confirmado'].includes(h.status)
      ) {
        throw new Error(
          'Este agendamento não pode ser cancelado.'
        );
      }

      tx.update(ref, {
        alunoId: null,
        alunoNome: null,
        status: 'disponivel',
        canceladoEm: serverTimestamp()
      });
    });

    alert(
      'Agendamento cancelado. O horário voltou a ficar disponível.'
    );

  } catch (erro) {
    alert(
      erro.message || 'Não foi possível cancelar o agendamento.'
    );
  }
}
