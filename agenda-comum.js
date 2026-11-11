
export function horarioFuturo(data, hora) {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(data || '') ||
      !/^\d{2}:\d{2}$/.test(hora || '')) return false;

  const instante = new Date(`${data}T${hora}:00`);

  return !Number.isNaN(instante.getTime()) &&
    instante.getTime() > Date.now();
}

export function formatarHorario(item) {
  const [ano, mes, dia] = (item.data || '').split('-');
  return `${dia}/${mes}/${ano} às ${item.hora || '--:--'}`;
}

export function ordenarHorarios(a, b) {
  return `${a.data}T${a.hora}`
    .localeCompare(`${b.data}T${b.hora}`);
}

export function elemento(tag, texto, classe) {
  const no = document.createElement(tag);

  if (texto != null) no.textContent = String(texto);
  if (classe) no.className = classe;

  return no;
}

export function botao(texto, acao, classe = '') {
  const no = elemento('button', texto, classe);
  no.type = 'button';

  no.addEventListener('click', async () => {
    no.disabled = true;

    try {
      await acao();
    } finally {
      no.disabled = false;
    }
  });

  return no;
}

export function criarCartao(horario, status, detalhes = '') {
  const cartao = elemento('article', '', 'agenda-item');

  cartao.appendChild(
    elemento('strong', formatarHorario(horario))
  );

  cartao.appendChild(
    elemento('p', `Status: ${status}`, 'agenda-status')
  );

  if (detalhes) {
    cartao.appendChild(
      elemento('p', detalhes, 'agenda-detalhes')
    );
  }

  return cartao;
}

export function mostrarMensagem(container, mensagem) {
  container.replaceChildren(
    elemento('p', mensagem, 'agenda-vazio')
  );
}
