// ============================================================
// CONFIGURACIÓN DE FIREBASE
// (Lote 1: se agregan recuperar contraseña, Google y Analytics.
//  Todos los exports anteriores se conservan.)
// ============================================================

import { initializeApp } from "https://www.gstatic.com/firebasejs/10.13.0/firebase-app.js";
import {
  getAnalytics, logEvent, isSupported,
} from "https://www.gstatic.com/firebasejs/10.13.0/firebase-analytics.js";
import {
  getAuth,
  onAuthStateChanged,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  updateProfile,
  sendPasswordResetEmail,
  GoogleAuthProvider,
  signInWithPopup,
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

// ---------- Analytics (opcional y a prueba de fallos) ----------
// Si el navegador bloquea Analytics, track() simplemente no hace nada.
let analytics = null;
isSupported()
  .then((ok) => { if (ok) analytics = getAnalytics(app); })
  .catch(() => {});

export function track(nombreEvento, params = {}) {
  try {
    if (analytics) logEvent(analytics, nombreEvento, params);
  } catch (e) { /* ignorar */ }
}

// ---------- Utilidades compartidas ----------
export const GUEST_KEY = "patitas_guest_perfil";     // perfil del test sin registro
export const PENDING_KEY = "patitas_pending_like";   // mascota a la que dio "Me interesa" antes de registrarse

export function esc(s) {
  return String(s ?? "").replace(/[&<>"']/g, (m) => (
    { "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m]
  ));
}

// Solo permite http(s) y data:image como origen de una imagen.
export function safeUrl(u, fallback = "") {
  const s = String(u ?? "").trim();
  return /^(https?:\/\/|data:image\/)/i.test(s) ? s : fallback;
}

export {
  onAuthStateChanged, createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut, updateProfile,
  sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs, query, where, orderBy, serverTimestamp,
  ref, uploadBytes, getDownloadURL,
};
