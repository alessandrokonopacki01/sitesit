import { auth, db } from "./firebase.js";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

import {
  doc,
  setDoc,
  getDoc,
  serverTimestamp
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

window.mostrarCadastro = function () {
  document.getElementById("loginBox").classList.add("oculto");
  document.getElementById("cadastroBox").classList.remove("oculto");
};

window.mostrarLogin = function () {
  document.getElementById("cadastroBox").classList.add("oculto");
  document.getElementById("loginBox").classList.remove("oculto");
};

window.cadastrar = async function () {
  const nome = document.getElementById("cadastroNome").value.trim();
  const email = document.getElementById("cadastroEmail").value.trim();
  const senha = document.getElementById("cadastroSenha").value.trim();
  const tipo = document.getElementById("cadastroTipo").value;

  if (!nome || !email || !senha || !tipo) {
    alert("Preencha todos os campos.");
    return;
  }

  try {
    const credencial = await createUserWithEmailAndPassword(auth, email, senha);
    const uid = credencial.user.uid;

    let codigoPersonal = null;

    if (tipo === "personal") {
      codigoPersonal = nome
        .toUpperCase()
        .replaceAll(" ", "")
        .substring(0, 10) + Math.floor(Math.random() * 999);
    }

    await setDoc(doc(db, "usuarios", uid), {
      uid,
      nome,
      email,
      tipo,
      personalId: null,
      codigoPersonal,
      criadoEm: serverTimestamp()
    });

    alert("Conta criada com sucesso!");

  } catch (erro) {
    alert("Erro ao cadastrar: " + erro.message);
  }
};

window.login = async function () {
  const email = document.getElementById("loginEmail").value.trim();
  const senha = document.getElementById("loginSenha").value.trim();

  if (!email || !senha) {
    alert("Digite e-mail e senha.");
    return;
  }

  try {
    await signInWithEmailAndPassword(auth, email, senha);
  } catch (erro) {
    alert("Erro ao entrar: " + erro.message);
  }
};

window.sair = async function () {
  await signOut(auth);
};

onAuthStateChanged(auth, async (usuario) => {
  if (usuario) {
    const ref = doc(db, "usuarios", usuario.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      const dados = snap.data();

      document.getElementById("loginBox").classList.add("oculto");
      document.getElementById("cadastroBox").classList.add("oculto");
      document.getElementById("painelBox").classList.remove("oculto");

      document.getElementById("bemVindo").innerText = `Olá, ${dados.nome}`;
      document.getElementById("tipoUsuario").innerText = `Conta: ${dados.tipo}`;

      if (dados.tipo === "personal") {
        document.getElementById("tipoUsuario").innerText += ` | Código: ${dados.codigoPersonal}`;
      }
    }
  } else {
    document.getElementById("painelBox").classList.add("oculto");
    document.getElementById("loginBox").classList.remove("oculto");
  }
});