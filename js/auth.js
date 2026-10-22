import {
  auth, db, track, esc, GUEST_KEY,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
  sendPasswordResetEmail, GoogleAuthProvider, signInWithPopup,
  doc, setDoc, getDoc, serverTimestamp,
} from "./firebase-config.js";

// ---------- Estado de UI ----------
let selectedRole = null;

const params = new URLSearchParams(window.location.search);
const registerView = document.getElementById("registerView");
const loginView = document.getElementById("loginView");

if (params.get("tab") === "login") {
  registerView.style.display = "none";
  loginView.style.display = "block";
}

document.getElementById("goLogin").onclick = () => {
  registerView.style.display = "none";
  loginView.style.display = "block";
};
document.getElementById("goRegister").onclick = () => {
  loginView.style.display = "none";
  registerView.style.display = "block";
};

// ---------- Perfil del test sin registro (modo invitado) ----------
function leerPerfilInvitado() {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY) || "null"); }
  catch (e) { return null; }
}

if (leerPerfilInvitado()) {
  document.getElementById("guestNote").style.display = "block";
}

// Copia el perfil del test a adopterProfiles para que el usuario no tenga
// que contestar todo otra vez. Devuelve true si se copió.
async function volcarPerfilInvitado(uid, city) {
  const g = leerPerfilInvitado();
  if (!g) return false;
  try {
    await setDoc(doc(db, "adopterProfiles", uid), {
      ...g,
      city: city || "",
      origen: "test_invitado",
      updatedAt: serverTimestamp(),
    }, { merge: true });
    try { localStorage.removeItem(GUEST_KEY); } catch (e) {}
    return true;
  } catch (err) {
    console.error("No se pudo copiar el perfil del test:", err);
    return false;
  }
}

// ---------- Selector de rol ----------
const roleCards = document.querySelectorAll(".role-card");
const lblName = document.getElementById("lblName");
const regName = document.getElementById("regName");
const lblShelterName = document.getElementById("lblShelterName");
const regShelterName = document.getElementById("regShelterName");

function selectRole(role) {
  selectedRole = role;
  roleCards.forEach(c => c.classList.toggle("selected", c.dataset.role === role));
  const isShelter = role === "shelter";
  lblShelterName.style.display = isShelter ? "block" : "none";
  regShelterName.style.display = isShelter ? "block" : "none";
  lblName.textContent = isShelter ? "Nombre de la persona responsable" : "Nombre completo";
}

roleCards.forEach(card => {
  card.addEventListener("click", () => selectRole(card.dataset.role));
});

if (params.get("role") === "shelter") selectRole("shelter");
else selectRole("adopter");

// ---------- Utilidades ----------
function showMsg(elId, text, ok = false) {
  const el = document.getElementById(elId);
  el.innerHTML = `<div class="${ok ? "ok-msg" : "error-msg"}">${esc(text)}</div>`;
}

// Decide a dónde mandar a alguien que ya tiene cuenta.
async function irSegunRol(uid, userData) {
  if (userData.role === "shelter") {
    window.location.href = "shelter.html";
    return;
  }
  const profileDoc = await getDoc(doc(db, "adopterProfiles", uid));
  window.location.href = profileDoc.exists() ? "swipe.html" : "onboarding.html";
}

// ---------- Registro con correo ----------
document.getElementById("btnRegister").addEventListener("click", async () => {
  const name = regName.value.trim();
  const shelterName = regShelterName.value.trim();
  const email = document.getElementById("regEmail").value.trim();
  const password = document.getElementById("regPassword").value;
  const city = document.getElementById("regCity").value.trim();
  const btn = document.getElementById("btnRegister");

  if (!selectedRole) return showMsg("registerMsg", "Elige si quieres adoptar o si eres un refugio.");
  if (!name) return showMsg("registerMsg", "Escribe tu nombre.");
  if (selectedRole === "shelter" && !shelterName) return showMsg("registerMsg", "Escribe el nombre del refugio.");
  if (!email || !password || password.length < 6) return showMsg("registerMsg", "Revisa tu correo y usa una contraseña de al menos 6 caracteres.");
  if (!city) return showMsg("registerMsg", "Escribe tu ciudad.");

  btn.disabled = true;
  btn.textContent = "Creando cuenta...";
  try {
    const cred = await createUserWithEmailAndPassword(auth, email, password);
    await updateProfile(cred.user, { displayName: selectedRole === "shelter" ? shelterName : name });

    const userData = {
      role: selectedRole,
      name,
      shelterName: selectedRole === "shelter" ? shelterName : null,
      email,
      city,
      createdAt: serverTimestamp(),
    };
    // Los refugios nacen sin verificar; se marcan a mano desde Firebase Console.
    if (selectedRole === "shelter") userData.verified = false;

    await setDoc(doc(db, "users", cred.user.uid), userData);
    track("sign_up", { method: "email", role: selectedRole });

    if (selectedRole === "shelter") {
      window.location.href = "shelter.html";
    } else {
      await volcarPerfilInvitado(cred.user.uid, city);
      window.location.href = "onboarding.html";
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Crear cuenta";
    showMsg("registerMsg", traducirError(err.code));
  }
});

// ---------- Login con correo ----------
document.getElementById("btnLogin").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();
  const password = document.getElementById("loginPassword").value;
  const btn = document.getElementById("btnLogin");
  if (!email || !password) return showMsg("loginMsg", "Escribe tu correo y contraseña.");

  btn.disabled = true;
  btn.textContent = "Entrando...";
  try {
    const cred = await signInWithEmailAndPassword(auth, email, password);
    const userDoc = await getDoc(doc(db, "users", cred.user.uid));
    if (!userDoc.exists()) {
      btn.disabled = false;
      btn.textContent = "Iniciar sesión";
      showMsg("loginMsg", "No encontramos tu perfil. Contacta soporte.");
      return;
    }
    track("login", { method: "email" });
    await irSegunRol(cred.user.uid, userDoc.data());
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Iniciar sesión";
    showMsg("loginMsg", traducirError(err.code));
  }
});

// ---------- Olvidé mi contraseña ----------
document.getElementById("btnForgot").addEventListener("click", async () => {
  const email = document.getElementById("loginEmail").value.trim();
  if (!email) return showMsg("loginMsg", "Escribe tu correo arriba y vuelve a tocar «¿Olvidaste tu contraseña?».");
  try {
    await sendPasswordResetEmail(auth, email);
  } catch (err) {
    // No revelamos si el correo existe o no: mismo mensaje en ambos casos,
    // salvo que el formato sea inválido.
    if (err.code === "auth/invalid-email") return showMsg("loginMsg", traducirError(err.code));
  }
  showMsg("loginMsg", "Si ese correo tiene una cuenta, te enviamos un enlace para crear una contraseña nueva. Revisa también spam.", true);
});

// ---------- Google ----------
async function continuarConGoogle(origen, btnId) {
  const btn = document.getElementById(btnId);
  const msgId = origen === "registro" ? "registerMsg" : "loginMsg";

  // Validamos ANTES de abrir el popup para no dejar cuentas a medias.
  const shelterName = regShelterName.value.trim();
  if (origen === "registro" && selectedRole === "shelter" && !shelterName) {
    return showMsg(msgId, "Escribe el nombre del refugio antes de continuar con Google.");
  }

  btn.disabled = true;
  try {
    const cred = await signInWithPopup(auth, new GoogleAuthProvider());
    const user = cred.user;
    const ref = doc(db, "users", user.uid);
    const snap = await getDoc(ref);

    if (snap.exists()) {
      track("login", { method: "google" });
      return await irSegunRol(user.uid, snap.data());
    }

    // Usuario nuevo. Desde "Iniciar sesión" siempre es adoptante;
    // los refugios se crean desde el registro eligiendo su rol.
    const role = origen === "registro" ? (selectedRole || "adopter") : "adopter";
    const city = document.getElementById("regCity").value.trim();
    const displayName = user.displayName || regName.value.trim() || "Sin nombre";

    const userData = {
      role,
      name: role === "shelter" ? (regName.value.trim() || displayName) : displayName,
      shelterName: role === "shelter" ? shelterName : null,
      email: user.email || "",
      city,
      authProvider: "google",
      createdAt: serverTimestamp(),
    };
    if (role === "shelter") userData.verified = false;

    await setDoc(ref, userData);
    track("sign_up", { method: "google", role });

    if (role === "shelter") {
      window.location.href = "shelter.html";
    } else {
      await volcarPerfilInvitado(user.uid, city);
      window.location.href = "onboarding.html";
    }
  } catch (err) {
    btn.disabled = false;
    if (err.code === "auth/popup-closed-by-user" || err.code === "auth/cancelled-popup-request") return;
    showMsg(msgId, traducirError(err.code));
  }
}

document.getElementById("btnGoogleReg").addEventListener("click", () => continuarConGoogle("registro", "btnGoogleReg"));
document.getElementById("btnGoogleLogin").addEventListener("click", () => continuarConGoogle("login", "btnGoogleLogin"));

function traducirError(code) {
  const map = {
    "auth/email-already-in-use": "Ese correo ya tiene una cuenta. Intenta iniciar sesión.",
    "auth/invalid-email": "El correo no es válido.",
    "auth/weak-password": "La contraseña es muy débil (mínimo 6 caracteres).",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
    "auth/too-many-requests": "Demasiados intentos. Espera unos minutos e inténtalo de nuevo.",
    "auth/popup-blocked": "Tu navegador bloqueó la ventana de Google. Permite ventanas emergentes e inténtalo de nuevo.",
    "auth/unauthorized-domain": "Este dominio no está autorizado en Firebase (Authentication → Settings → Authorized domains).",
    "auth/operation-not-allowed": "El acceso con Google no está activado en Firebase todavía.",
    "auth/account-exists-with-different-credential": "Ese correo ya tiene una cuenta con contraseña. Inicia sesión con tu correo y contraseña.",
  };
  return map[code] || "Ocurrió un error. Intenta de nuevo.";
}
