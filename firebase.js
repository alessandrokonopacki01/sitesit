import { initializeApp } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-app.js";
import { getAuth } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";
import { getFirestore } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";

const firebaseConfig = {
  apiKey: "AIzaSyDcTR5WwQBD6LQpxUYRhlx3B4RNmw3CTKw",
  authDomain: "sitefit-b8bed.firebaseapp.com",
  projectId: "sitefit-b8bed",
  storageBucket: "sitefit-b8bed.firebasestorage.app",
  messagingSenderId: "546133381610",
  appId: "1:546133381610:web:cc1671d44093e678bee293"
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);