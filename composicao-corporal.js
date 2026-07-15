/*
  ==========================================================
  BIBLIOTECA DE COMPOSIÇÃO CORPORAL
  ==========================================================

  Unidades utilizadas:

  - Peso: quilogramas
  - Altura: centímetros
  - Dobras cutâneas: milímetros
  - Idade: anos

  Protocolos disponíveis:

  - jacksonPollock3
  - jacksonPollock7
  - durninWomersley
  - guedes
  - faulkner
*/


/* ==========================================================
   CONSTANTES
========================================================== */

export const PROTOCOLOS = {
  JACKSON_POLLOCK_3: "jacksonPollock3",
  JACKSON_POLLOCK_7: "jacksonPollock7",
  DURNIN_WOMERSLEY: "durninWomersley",
  GUEDES: "guedes",
  FAULKNER: "faulkner"
};


/*
  Informações utilizadas pelo formulário para saber quais
  campos devem ser apresentados em cada protocolo.
*/

export const INFORMACOES_PROTOCOLOS = {
  jacksonPollock3: {
    nome: "Jackson e Pollock — 3 dobras",
    precisaIdade: true,
    sexos: ["M", "F"],

    dobras: {
      M: [
        {
          id: "peitoral",
          nome: "Peitoral"
        },
        {
          id: "abdomen",
          nome: "Abdômen"
        },
        {
          id: "coxa",
          nome: "Coxa"
        }
      ],

      F: [
        {
          id: "triceps",
          nome: "Tríceps"
        },
        {
          id: "supraIliaca",
          nome: "Supra-ilíaca"
        },
        {
          id: "coxa",
          nome: "Coxa"
        }
      ]
    }
  },

  jacksonPollock7: {
    nome: "Jackson e Pollock — 7 dobras",
    precisaIdade: true,
    sexos: ["M", "F"],

    dobras: {
      M: [
        {
          id: "peitoral",
          nome: "Peitoral"
        },
        {
          id: "axilarMedia",
          nome: "Axilar média"
        },
        {
          id: "triceps",
          nome: "Tríceps"
        },
        {
          id: "subescapular",
          nome: "Subescapular"
        },
        {
          id: "abdomen",
          nome: "Abdômen"
        },
        {
          id: "supraIliaca",
          nome: "Supra-ilíaca"
        },
        {
          id: "coxa",
          nome: "Coxa"
        }
      ],

      F: [
        {
          id: "peitoral",
          nome: "Peitoral"
        },
        {
          id: "axilarMedia",
          nome: "Axilar média"
        },
        {
          id: "triceps",
          nome: "Tríceps"
        },
        {
          id: "subescapular",
          nome: "Subescapular"
        },
        {
          id: "abdomen",
          nome: "Abdômen"
        },
        {
          id: "supraIliaca",
          nome: "Supra-ilíaca"
        },
        {
          id: "coxa",
          nome: "Coxa"
        }
      ]
    }
  },

  durninWomersley: {
    nome: "Durnin e Womersley — 4 dobras",
    precisaIdade: true,
    sexos: ["M", "F"],

    dobras: {
      M: [
        {
          id: "biceps",
          nome: "Bíceps"
        },
        {
          id: "triceps",
          nome: "Tríceps"
        },
        {
          id: "subescapular",
          nome: "Subescapular"
        },
        {
          id: "supraIliaca",
          nome: "Supra-ilíaca"
        }
      ],

      F: [
        {
          id: "biceps",
          nome: "Bíceps"
        },
        {
          id: "triceps",
          nome: "Tríceps"
        },
        {
          id: "subescapular",
          nome: "Subescapular"
        },
        {
          id: "supraIliaca",
          nome: "Supra-ilíaca"
        }
      ]
    }
  },

  guedes: {
    nome: "Guedes — 3 dobras",
    precisaIdade: false,
    sexos: ["M", "F"],

    dobras: {
      M: [
        {
          id: "triceps",
          nome: "Tríceps"
        },
        {
          id: "supraIliaca",
          nome: "Supra-ilíaca"
        },
        {
          id: "abdomen",
          nome: "Abdômen"
        }
      ],

      F: [
        {
          id: "subescapular",
          nome: "Subescapular"
        },
        {
          id: "supraIliaca",
          nome: "Supra-ilíaca"
        },
        {
          id: "coxa",
          nome: "Coxa"
        }
      ]
    }
  },

  faulkner: {
    nome: "Faulkner tradicional — 4 dobras",
    precisaIdade: false,
    sexos: ["M", "F"],

    dobras: {
      M: [
        {
          id: "triceps",
          nome: "Tríceps"
        },
        {
          id: "subescapular",
          nome: "Subescapular"
        },
        {
          id: "supraIliaca",
          nome: "Supra-ilíaca"
        },
        {
          id: "abdomen",
          nome: "Abdômen"
        }
      ],

      F: [
        {
          id: "triceps",
          nome: "Tríceps"
        },
        {
          id: "subescapular",
          nome: "Subescapular"
        },
        {
          id: "supraIliaca",
          nome: "Supra-ilíaca"
        },
        {
          id: "abdomen",
          nome: "Abdômen"
        }
      ]
    }
  }
};


/* ==========================================================
   FUNÇÕES DE VALIDAÇÃO
========================================================== */

function validarNumero(valor, nomeCampo) {
  const numero = Number(valor);

  if (!Number.isFinite(numero) || numero <= 0) {
    throw new Error(
      `${nomeCampo} deve ser um número maior que zero.`
    );
  }

  return numero;
}


function validarIdade(idade) {
  const idadeValidada = validarNumero(
    idade,
    "Idade"
  );

  if (
    idadeValidada < 7 ||
    idadeValidada > 120
  ) {
    throw new Error(
      "A idade informada está fora do intervalo permitido."
    );
  }

  return idadeValidada;
}


function validarSexo(sexo) {
  const sexoNormalizado =
    String(sexo).trim().toUpperCase();

  if (
    sexoNormalizado !== "M" &&
    sexoNormalizado !== "F"
  ) {
    throw new Error(
      "O sexo deve ser informado como M ou F."
    );
  }

  return sexoNormalizado;
}


function validarDobras(dobras, nomesObrigatorios) {
  if (!dobras || typeof dobras !== "object") {
    throw new Error(
      "As dobras cutâneas não foram informadas."
    );
  }

  const dobrasValidadas = {};

  nomesObrigatorios.forEach((nome) => {
    dobrasValidadas[nome] = validarNumero(
      dobras[nome],
      `Dobra ${nome}`
    );
  });

  return dobrasValidadas;
}


/* ==========================================================
   FUNÇÕES AUXILIARES
========================================================== */

function somarDobras(dobras) {
  return Object.values(dobras).reduce(
    (total, valor) => total + valor,
    0
  );
}


export function calcularPercentualSiri(
  densidadeCorporal
) {
  const densidade = validarNumero(
    densidadeCorporal,
    "Densidade corporal"
  );

  return (495 / densidade) - 450;
}


export function calcularPercentualBrozek(
  densidadeCorporal
) {
  const densidade = validarNumero(
    densidadeCorporal,
    "Densidade corporal"
  );

  return (457 / densidade) - 414.2;
}


export function calcularIMC({
  peso,
  altura
}) {
  const pesoKg = validarNumero(
    peso,
    "Peso"
  );

  const alturaCm = validarNumero(
    altura,
    "Altura"
  );

  const alturaMetros = alturaCm / 100;

  const imc =
    pesoKg / Math.pow(alturaMetros, 2);

  return {
    peso: pesoKg,
    altura: alturaCm,
    imc,
    classificacao: classificarIMC(imc)
  };
}


export function classificarIMC(imc) {
  const valor = validarNumero(
    imc,
    "IMC"
  );

  if (valor < 18.5) {
    return "Abaixo do peso";
  }

  if (valor < 25) {
    return "Peso adequado";
  }

  if (valor < 30) {
    return "Sobrepeso";
  }

  if (valor < 35) {
    return "Obesidade grau I";
  }

  if (valor < 40) {
    return "Obesidade grau II";
  }

  return "Obesidade grau III";
}


function calcularMassas({
  peso,
  percentualGordura
}) {
  const pesoKg = validarNumero(
    peso,
    "Peso"
  );

  const gordura = Number(
    percentualGordura
  );

  if (
    !Number.isFinite(gordura) ||
    gordura < 0 ||
    gordura > 75
  ) {
    throw new Error(
      "O percentual de gordura ficou fora do intervalo esperado. Confira as medidas."
    );
  }

  const massaGorda =
    pesoKg * gordura / 100;

  const massaMagra =
    pesoKg - massaGorda;

  return {
    massaGorda,
    massaMagra
  };
}


function montarResultado({
  protocolo,
  sexo,
  idade = null,
  peso,
  altura,
  dobras,
  densidadeCorporal = null,
  percentualGordura,
  equacaoConversao = null,
  observacao = null
}) {
  const dadosIMC = calcularIMC({
    peso,
    altura
  });

  const massas = calcularMassas({
    peso,
    percentualGordura
  });

  return {
    protocolo,
    sexo,
    idade,

    peso: Number(peso),
    altura: Number(altura),

    dobras,
    somaDobras: somarDobras(dobras),

    densidadeCorporal,
    equacaoConversao,

    percentualGordura,

    massaGorda: massas.massaGorda,
    massaMagra: massas.massaMagra,

    imc: dadosIMC.imc,
    classificacaoIMC:
      dadosIMC.classificacao,

    observacao
  };
}


/* ==========================================================
   JACKSON E POLLOCK — 3 DOBRAS
========================================================== */

export function calcularJacksonPollock3({
  sexo,
  idade,
  peso,
  altura,
  dobras
}) {
  const sexoValidado =
    validarSexo(sexo);

  const idadeValidada =
    validarIdade(idade);

  validarNumero(peso, "Peso");
  validarNumero(altura, "Altura");

  let dobrasValidadas;

  if (sexoValidado === "M") {
    dobrasValidadas = validarDobras(
      dobras,
      [
        "peitoral",
        "abdomen",
        "coxa"
      ]
    );
  } else {
    dobrasValidadas = validarDobras(
      dobras,
      [
        "triceps",
        "supraIliaca",
        "coxa"
      ]
    );
  }

  const soma =
    somarDobras(dobrasValidadas);

  let densidadeCorporal;

  if (sexoValidado === "M") {
    densidadeCorporal =
      1.10938
      - (0.0008267 * soma)
      + (0.0000016 * Math.pow(soma, 2))
      - (0.0002574 * idadeValidada);
  } else {
    densidadeCorporal =
      1.0994921
      - (0.0009929 * soma)
      + (0.0000023 * Math.pow(soma, 2))
      - (0.0001392 * idadeValidada);
  }

  const percentualGordura =
    calcularPercentualSiri(
      densidadeCorporal
    );

  return montarResultado({
    protocolo:
      "Jackson e Pollock — 3 dobras",

    sexo: sexoValidado,
    idade: idadeValidada,
    peso,
    altura,

    dobras: dobrasValidadas,

    densidadeCorporal,
    percentualGordura,

    equacaoConversao: "Siri"
  });
}


/* ==========================================================
   JACKSON E POLLOCK — 7 DOBRAS
========================================================== */

export function calcularJacksonPollock7({
  sexo,
  idade,
  peso,
  altura,
  dobras
}) {
  const sexoValidado =
    validarSexo(sexo);

  const idadeValidada =
    validarIdade(idade);

  validarNumero(peso, "Peso");
  validarNumero(altura, "Altura");

  const dobrasValidadas =
    validarDobras(
      dobras,
      [
        "peitoral",
        "axilarMedia",
        "triceps",
        "subescapular",
        "abdomen",
        "supraIliaca",
        "coxa"
      ]
    );

  const soma =
    somarDobras(dobrasValidadas);

  let densidadeCorporal;

  if (sexoValidado === "M") {
    densidadeCorporal =
      1.112
      - (0.00043499 * soma)
      + (
        0.00000055 *
        Math.pow(soma, 2)
      )
      - (
        0.00028826 *
        idadeValidada
      );
  } else {
    densidadeCorporal =
      1.097
      - (0.00046971 * soma)
      + (
        0.00000056 *
        Math.pow(soma, 2)
      )
      - (
        0.00012828 *
        idadeValidada
      );
  }

  const percentualGordura =
    calcularPercentualSiri(
      densidadeCorporal
    );

  return montarResultado({
    protocolo:
      "Jackson e Pollock — 7 dobras",

    sexo: sexoValidado,
    idade: idadeValidada,
    peso,
    altura,

    dobras: dobrasValidadas,

    densidadeCorporal,
    percentualGordura,

    equacaoConversao: "Siri"
  });
}


/* ==========================================================
   DURNIN E WOMERSLEY — 4 DOBRAS
========================================================== */

function obterCoeficientesDurnin(
  sexo,
  idade
) {
  if (sexo === "M") {
    if (idade < 20) {
      return {
        constante: 1.162,
        coeficiente: 0.063
      };
    }

    if (idade < 30) {
      return {
        constante: 1.1631,
        coeficiente: 0.0632
      };
    }

    if (idade < 40) {
      return {
        constante: 1.1422,
        coeficiente: 0.0544
      };
    }

    if (idade < 50) {
      return {
        constante: 1.162,
        coeficiente: 0.07
      };
    }

    return {
      constante: 1.1715,
      coeficiente: 0.0779
    };
  }

  if (idade < 20) {
    return {
      constante: 1.1549,
      coeficiente: 0.0678
    };
  }

  if (idade < 30) {
    return {
      constante: 1.1599,
      coeficiente: 0.0717
    };
  }

  if (idade < 40) {
    return {
      constante: 1.1423,
      coeficiente: 0.0632
    };
  }

  if (idade < 50) {
    return {
      constante: 1.1333,
      coeficiente: 0.0612
    };
  }

  return {
    constante: 1.1339,
    coeficiente: 0.0645
  };
}


export function calcularDurninWomersley({
  sexo,
  idade,
  peso,
  altura,
  dobras
}) {
  const sexoValidado =
    validarSexo(sexo);

  const idadeValidada =
    validarIdade(idade);

  validarNumero(peso, "Peso");
  validarNumero(altura, "Altura");

  if (
    idadeValidada < 16 ||
    idadeValidada > 72
  ) {
    throw new Error(
      "O protocolo Durnin e Womersley é indicado para idades entre 16 e 72 anos."
    );
  }

  const dobrasValidadas =
    validarDobras(
      dobras,
      [
        "biceps",
        "triceps",
        "subescapular",
        "supraIliaca"
      ]
    );

  const soma =
    somarDobras(dobrasValidadas);

  const coeficientes =
    obterCoeficientesDurnin(
      sexoValidado,
      idadeValidada
    );

  const densidadeCorporal =
    coeficientes.constante
    - (
      coeficientes.coeficiente *
      Math.log10(soma)
    );

  const percentualGordura =
    calcularPercentualSiri(
      densidadeCorporal
    );

  return montarResultado({
    protocolo:
      "Durnin e Womersley — 4 dobras",

    sexo: sexoValidado,
    idade: idadeValidada,
    peso,
    altura,

    dobras: dobrasValidadas,

    densidadeCorporal,
    percentualGordura,

    equacaoConversao: "Siri"
  });
}


/* ==========================================================
   GUEDES — 3 DOBRAS
========================================================== */

export function calcularGuedes({
  sexo,
  idade = null,
  peso,
  altura,
  dobras
}) {
  const sexoValidado =
    validarSexo(sexo);

  validarNumero(peso, "Peso");
  validarNumero(altura, "Altura");

  let dobrasValidadas;
  let densidadeCorporal;

  if (sexoValidado === "M") {
    dobrasValidadas = validarDobras(
      dobras,
      [
        "triceps",
        "supraIliaca",
        "abdomen"
      ]
    );

    const soma =
      somarDobras(dobrasValidadas);

    densidadeCorporal =
      1.17136
      - (
        0.06706 *
        Math.log10(soma)
      );
  } else {
    dobrasValidadas = validarDobras(
      dobras,
      [
        "subescapular",
        "supraIliaca",
        "coxa"
      ]
    );

    const soma =
      somarDobras(dobrasValidadas);

    densidadeCorporal =
      1.16650
      - (
        0.07063 *
        Math.log10(soma)
      );
  }

  const percentualGordura =
    calcularPercentualSiri(
      densidadeCorporal
    );

  return montarResultado({
    protocolo: "Guedes — 3 dobras",

    sexo: sexoValidado,

    idade:
      idade === null ||
      idade === ""
        ? null
        : Number(idade),

    peso,
    altura,

    dobras: dobrasValidadas,

    densidadeCorporal,
    percentualGordura,

    equacaoConversao: "Siri",

    observacao:
      "Utilizar preferencialmente em adultos jovens pertencentes à população para a qual a equação foi desenvolvida."
  });
}


/* ==========================================================
   FAULKNER TRADICIONAL — 4 DOBRAS
========================================================== */

export function calcularFaulkner({
  sexo,
  idade = null,
  peso,
  altura,
  dobras
}) {
  const sexoValidado =
    validarSexo(sexo);

  validarNumero(peso, "Peso");
  validarNumero(altura, "Altura");

  const dobrasValidadas =
    validarDobras(
      dobras,
      [
        "triceps",
        "subescapular",
        "supraIliaca",
        "abdomen"
      ]
    );

  const soma =
    somarDobras(dobrasValidadas);

  const percentualGordura =
    (soma * 0.153) + 5.783;

  return montarResultado({
    protocolo:
      "Faulkner tradicional — 4 dobras",

    sexo: sexoValidado,

    idade:
      idade === null ||
      idade === ""
        ? null
        : Number(idade),

    peso,
    altura,

    dobras: dobrasValidadas,

    densidadeCorporal: null,
    percentualGordura,

    equacaoConversao:
      "Equação direta",

    observacao:
      "Método tradicionalmente conhecido como Faulkner. Sua origem e aplicabilidade são discutidas na literatura."
  });
}


/* ==========================================================
   RELAÇÃO CINTURA-ALTURA
========================================================== */

export function calcularRelacaoCinturaAltura({
  cintura,
  altura
}) {
  const cinturaCm =
    validarNumero(
      cintura,
      "Cintura"
    );

  const alturaCm =
    validarNumero(
      altura,
      "Altura"
    );

  const relacao =
    cinturaCm / alturaCm;

  let classificacao;

  if (relacao < 0.4) {
    classificacao =
      "Abaixo do intervalo esperado";
  } else if (relacao < 0.5) {
    classificacao =
      "Faixa considerada adequada";
  } else if (relacao < 0.6) {
    classificacao =
      "Risco aumentado";
  } else {
    classificacao =
      "Risco muito aumentado";
  }

  return {
    cintura: cinturaCm,
    altura: alturaCm,
    relacao,
    classificacao
  };
}


/* ==========================================================
   RELAÇÃO CINTURA-QUADRIL
========================================================== */

export function calcularRelacaoCinturaQuadril({
  cintura,
  quadril
}) {
  const cinturaCm =
    validarNumero(
      cintura,
      "Cintura"
    );

  const quadrilCm =
    validarNumero(
      quadril,
      "Quadril"
    );

  return {
    cintura: cinturaCm,
    quadril: quadrilCm,
    relacao:
      cinturaCm / quadrilCm
  };
}


/* ==========================================================
   FUNÇÃO GERAL

   Permite chamar qualquer protocolo usando uma função única.
========================================================== */

export function calcularComposicaoCorporal({
  protocolo,
  sexo,
  idade,
  peso,
  altura,
  dobras
}) {
  switch (protocolo) {
    case PROTOCOLOS.JACKSON_POLLOCK_3:
      return calcularJacksonPollock3({
        sexo,
        idade,
        peso,
        altura,
        dobras
      });

    case PROTOCOLOS.JACKSON_POLLOCK_7:
      return calcularJacksonPollock7({
        sexo,
        idade,
        peso,
        altura,
        dobras
      });

    case PROTOCOLOS.DURNIN_WOMERSLEY:
      return calcularDurninWomersley({
        sexo,
        idade,
        peso,
        altura,
        dobras
      });

    case PROTOCOLOS.GUEDES:
      return calcularGuedes({
        sexo,
        idade,
        peso,
        altura,
        dobras
      });

    case PROTOCOLOS.FAULKNER:
      return calcularFaulkner({
        sexo,
        idade,
        peso,
        altura,
        dobras
      });

    default:
      throw new Error(
        "O protocolo de composição corporal selecionado não existe."
      );
  }
}


/* ==========================================================
   ARREDONDAR RESULTADOS

   Esta função pode ser chamada antes de salvar no Firebase.
========================================================== */

export function arredondarResultado(
  resultado
) {
  return {
    ...resultado,

    peso:
      Number(resultado.peso.toFixed(2)),

    altura:
      Number(resultado.altura.toFixed(2)),

    somaDobras:
      Number(
        resultado.somaDobras.toFixed(2)
      ),

    densidadeCorporal:
      resultado.densidadeCorporal === null
        ? null
        : Number(
            resultado.densidadeCorporal.toFixed(6)
          ),

    percentualGordura:
      Number(
        resultado.percentualGordura.toFixed(2)
      ),

    massaGorda:
      Number(
        resultado.massaGorda.toFixed(2)
      ),

    massaMagra:
      Number(
        resultado.massaMagra.toFixed(2)
      ),

    imc:
      Number(resultado.imc.toFixed(2))
  };
}