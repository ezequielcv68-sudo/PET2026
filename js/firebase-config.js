// ============================================================
// CONFIGURACIÓN DE FIREBASE
// ------------------------------------------------------------
// 1. Ve a https://console.firebase.google.com → crea un proyecto
// 2. Agrega una "Web app" (ícono </>) y copia aquí tu config
// 3. Activa en el menú lateral: Authentication (método Correo/Contraseña),
//    Firestore Database (modo producción) y Storage
// 4. Pega las reglas de seguridad que están en README.md
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-auth.js";
import {
  getFirestore,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs, query, where, orderBy,
  serverTimestamp,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-firestore.js";
import {
  getStorage, ref, uploadBytes, getDownloadURL,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-storage.js";

// 👉 REEMPLAZA estos valores con los de tu proyecto de Firebase
const firebaseConfig = {
  apiKey: "AIzaSyC9wv_vYPZB5oCLkj76D8hmQdZzcubxj_s",
  authDomain: "pet-2026-e1001.firebaseapp.com",
  projectId: "pet-2026-e1001",
  storageBucket: "pet-2026-e1001.firebasestorage.app",
  messagingSenderId: "224748987381",
  appId: "1:224748987381:web:905739349170642625b6bc",
  measurementId: "G-QSSTFV80N2"
};
const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
export const storage = getStorage(app);

export {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs, query, where, orderBy, serverTimestamp,
  ref, uploadBytes, getDownloadURL,
};
