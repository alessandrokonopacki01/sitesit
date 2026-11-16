
const DADOS = {
  "Peitoral": "Supino reto com barra|Barra e banco;Supino inclinado com barra|Barra e banco inclinado;Supino declinado com barra|Barra e banco declinado;Supino reto com halteres|Halteres e banco;Supino inclinado com halteres|Halteres e banco inclinado;Supino declinado com halteres|Halteres e banco declinado;Crucifixo reto com halteres|Halteres e banco;Crucifixo inclinado com halteres|Halteres e banco inclinado;Crucifixo na máquina|Peck deck;Crossover alto|Polia;Crossover médio|Polia;Crossover baixo|Polia;Supino na máquina|Máquina de supino;Flexão de braços|Peso corporal;Flexão de braços inclinada|Banco",

  "Costas": "Puxada frontal aberta|Polia alta;Puxada frontal fechada|Polia alta;Puxada supinada|Polia alta;Puxada neutra|Polia alta;Puxada unilateral|Polia alta;Remada baixa com triângulo|Polia baixa;Remada baixa aberta|Polia baixa;Remada curvada com barra|Barra;Remada curvada supinada|Barra;Remada cavalinho|Barra T;Remada unilateral com halter|Halter e banco;Remada articulada|Máquina;Remada na máquina pegada neutra|Máquina;Remada sentada com elástico|Elástico;Pulldown com braços estendidos|Polia alta;Pullover com halter|Halter e banco;Barra fixa pronada|Barra fixa;Barra fixa supinada|Barra fixa;Barra fixa assistida|Máquina assistida;Hiperextensão lombar|Banco romano",

  "Ombros": "Desenvolvimento com halteres|Halteres;Desenvolvimento com barra|Barra;Desenvolvimento na máquina|Máquina;Desenvolvimento Arnold|Halteres;Elevação lateral com halteres|Halteres;Elevação lateral unilateral|Halter;Elevação lateral na polia|Polia;Elevação lateral na máquina|Máquina;Elevação frontal com halteres|Halteres;Elevação frontal com barra|Barra;Elevação frontal na polia|Polia;Crucifixo inverso com halteres|Halteres;Crucifixo inverso na máquina|Peck deck inverso;Face pull|Polia alta;Encolhimento com halteres|Halteres",

  "Bíceps": "Rosca direta com barra|Barra;Rosca direta na barra W|Barra W;Rosca alternada com halteres|Halteres;Rosca simultânea com halteres|Halteres;Rosca martelo|Halteres;Rosca concentrada|Halter;Rosca Scott com barra W|Banco Scott;Rosca Scott na máquina|Máquina;Rosca na polia baixa|Polia;Rosca unilateral na polia|Polia;Rosca inclinada com halteres|Banco inclinado e halteres;Rosca inversa com barra|Barra",

  "Tríceps": "Tríceps na polia com corda|Polia;Tríceps na polia com barra|Polia;Tríceps na polia pegada inversa|Polia;Tríceps francês unilateral|Halter;Tríceps francês bilateral|Halter;Tríceps testa com barra W|Barra W e banco;Tríceps testa com halteres|Halteres e banco;Tríceps coice|Halter;Tríceps banco|Banco;Mergulho nas paralelas|Paralelas;Tríceps na máquina|Máquina;Supino fechado|Barra e banco",

  "Quadríceps": "Agachamento livre|Barra;Agachamento com halter|Halter;Agachamento no Smith|Smith;Agachamento frontal|Barra;Agachamento sumô|Halter;Agachamento no hack|Hack;Leg press 45 graus|Leg press;Leg press horizontal|Leg press horizontal;Cadeira extensora|Máquina;Cadeira extensora unilateral|Máquina;Afundo com halteres|Halteres;Passada caminhando|Halteres;Agachamento búlgaro|Banco e halteres;Step-up no banco|Banco;Agachamento com peso corporal|Peso corporal",

  "Posteriores de coxa": "Mesa flexora|Máquina;Mesa flexora unilateral|Máquina;Cadeira flexora|Máquina;Cadeira flexora unilateral|Máquina;Flexora em pé|Máquina;Stiff com barra|Barra;Stiff com halteres|Halteres;Levantamento terra romeno|Barra;Levantamento terra romeno unilateral|Halter;Bom dia com barra|Barra;Flexão nórdica assistida|Peso corporal;Flexão de joelhos com bola|Bola suíça",

  "Glúteos": "Elevação pélvica com barra|Barra e banco;Elevação pélvica na máquina|Máquina;Elevação pélvica unilateral|Banco;Ponte de glúteos|Colchonete;Coice na polia|Polia baixa;Coice no solo|Colchonete;Cadeira abdutora|Máquina;Abdução de quadril na polia|Polia baixa;Abdução lateral deitada|Colchonete;Agachamento sumô com kettlebell|Kettlebell;Passada reversa|Halteres;Extensão de quadril na máquina|Máquina",

  "Panturrilhas": "Panturrilha em pé na máquina|Máquina;Panturrilha sentada na máquina|Máquina;Panturrilha no leg press|Leg press;Panturrilha em pé com halteres|Halteres;Panturrilha unilateral em degrau|Degrau;Panturrilha em pé no Smith|Smith;Panturrilha sentada com halter|Halter e banco;Panturrilha no solo|Peso corporal",

  "Abdômen": "Abdominal tradicional|Colchonete;Abdominal curto|Colchonete;Abdominal reverso|Colchonete;Abdominal bicicleta|Colchonete;Abdominal oblíquo|Colchonete;Abdominal infra com pernas elevadas|Colchonete;Abdominal na máquina|Máquina;Abdominal na polia alta|Polia;Prancha frontal|Colchonete;Prancha lateral|Colchonete;Prancha com toque no ombro|Colchonete;Elevação de joelhos na paralela|Paralelas;Elevação de pernas na barra|Barra fixa;Dead bug|Colchonete;Bird dog|Colchonete"
};

export const EXERCICIOS_PADRAO = Object.entries(DADOS)
  .flatMap(([grupo, itens]) =>
    itens.split(";").map(entrada => {
      const [nome, equipamento] = entrada.split("|");

      return {
        nome,
        grupo,
        equipamento,
        video: "",
        descricao: ""
      };
    })
  );
