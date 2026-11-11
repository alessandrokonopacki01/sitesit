
/*
  FITCOACH — CONTROLE DE ASSINATURAS
  Funções compartilhadas
*/

export const PLANOS = {
  teste: {
    nome: "Teste gratuito",
    dias: 7
  },
  mensal: {
    nome: "Plano mensal",
    dias: 30
  },
  anual: {
    nome: "Plano anual",
    dias: 365
  }
};

// Data local no formato YYYY-MM-DD
export function hojeLocal() {
  const hoje = new Date();

  const ano = hoje.getFullYear();
  const mes = String(hoje.getMonth() + 1)
    .padStart(2, "0");
  const dia = String(hoje.getDate())
    .padStart(2, "0");

  return `${ano}-${mes}-${dia}`;
}

// Converte data para exibição brasileira
export function formatarData(data) {
  if (!data) return "--";

  const valor = typeof data?.toDate === "function"
    ? data.toDate()
    : data;

  if (valor instanceof Date) {
    return valor.toLocaleDateString("pt-BR");
  }

  const [ano, mes, dia] = String(valor).split("-");

  if (!ano || !mes || !dia) return "--";

  return `${dia}/${mes}/${ano}`;
}

// Converte YYYY-MM-DD em dias corridos.
// Usar UTC evita erros durante mudanças de horário.
function indiceDia(data) {
  if (typeof data !== "string") return NaN;

  const partes = data.split("-").map(Number);

  if (partes.length !== 3) return NaN;

  const [ano, mes, dia] = partes;

  const instante = Date.UTC(ano, mes - 1, dia);
  const verificada = new Date(instante);

  if (
    verificada.getUTCFullYear() !== ano ||
    verificada.getUTCMonth() + 1 !== mes ||
    verificada.getUTCDate() !== dia
  ) {
    return NaN;
  }

  return Math.floor(instante / 86400000);
}

// Adiciona dias corridos à data.
export function adicionarDias(data, dias) {
  const indice = indiceDia(data);

  if (!Number.isFinite(indice)) {
    throw new Error("Data inválida.");
  }

  if (!Number.isInteger(dias) || dias <= 0) {
    throw new Error("Duração inválida.");
  }

  const resultado = new Date(
    (indice + dias) * 86400000
  );

  return resultado.toISOString().slice(0, 10);
}

// Calcula quantos dias faltam.
export function diasRestantes(vencimento) {
  const fim = indiceDia(vencimento);
  const hoje = indiceDia(hojeLocal());

  if (!Number.isFinite(fim)) return 0;

  return Math.max(0, fim - hoje);
}

// Identifica a situação da assinatura.
export function statusAssinatura(assinatura) {
  if (!assinatura) return "sem_assinatura";

  if (assinatura.bloqueadoManualmente === true) {
    return "bloqueado";
  }

  if (assinatura.liberadoManualmente === true) {
    return "liberado";
  }

  if (!assinatura.vencimento) {
    return "sem_assinatura";
  }

  if (diasRestantes(assinatura.vencimento) === 0) {
    return "vencido";
  }

  if (assinatura.plano === "teste") {
    return "teste";
  }

  return "ativo";
}

// Verifica se o personal tem acesso ativo.
export function assinaturaAtiva(assinatura) {
  const status = statusAssinatura(assinatura);

  return [
    "ativo",
    "teste",
    "liberado"
  ].includes(status);
}

// Texto amigável para interface.
export function textoAssinatura(status) {
  const textos = {
    ativo: "Assinatura ativa",
    teste: "Período de teste",
    vencido: "Assinatura vencida",
    bloqueado: "Acesso bloqueado",
    liberado: "Acesso liberado",
    sem_assinatura: "Sem assinatura"
  };

  return textos[status] || "Situação desconhecida";
}

// Dados para criar ou renovar uma assinatura.
// A gravação no Firebase será feita pelo módulo admin.
export function gerarAssinatura(
  plano,
  dataInicio = hojeLocal(),
  duracaoPersonalizada = null
) {
  if (!PLANOS[plano]) {
    throw new Error("Plano inexistente.");
  }

  const duracao = duracaoPersonalizada ??
    PLANOS[plano].dias;

  const vencimento = adicionarDias(
    dataInicio,
    duracao
  );

  return {
    plano,
    inicio: dataInicio,
    vencimento,
    duracaoDias: duracao,
    bloqueadoManualmente: false,
    liberadoManualmente: false,
    statusPagamento:
      plano === "teste" ? "isento" : "pendente"
  };
}
