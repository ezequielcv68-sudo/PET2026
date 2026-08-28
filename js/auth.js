import {
  auth, db,
  createUserWithEmailAndPassword, signInWithEmailAndPassword, updateProfile,
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

// ---------- Registro ----------
function showMsg(elId, text, ok = false) {
  const el = document.getElementById(elId);
  el.innerHTML = `<div class="${ok ? 'ok-msg' : 'error-msg'}">${text}</div>`;
}

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

    await setDoc(doc(db, "users", cred.user.uid), {
      role: selectedRole,
      name,
      shelterName: selectedRole === "shelter" ? shelterName : null,
      email,
      city,
      createdAt: serverTimestamp(),
    });

    if (selectedRole === "shelter") {
      window.location.href = "shelter.html";
    } else {
      window.location.href = "onboarding.html";
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Crear cuenta";
    showMsg("registerMsg", traducirError(err.code));
  }
});

// ---------- Login ----------
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
      showMsg("loginMsg", "No encontramos tu perfil. Contacta soporte.");
      return;
    }
    const data = userDoc.data();
    if (data.role === "shelter") {
      window.location.href = "shelter.html";
    } else {
      const profileDoc = await getDoc(doc(db, "adopterProfiles", cred.user.uid));
      window.location.href = profileDoc.exists() ? "swipe.html" : "onboarding.html";
    }
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Iniciar sesión";
    showMsg("loginMsg", traducirError(err.code));
  }
});

function traducirError(code) {
  const map = {
    "auth/email-already-in-use": "Ese correo ya tiene una cuenta. Intenta iniciar sesión.",
    "auth/invalid-email": "El correo no es válido.",
    "auth/weak-password": "La contraseña es muy débil (mínimo 6 caracteres).",
    "auth/user-not-found": "No existe una cuenta con ese correo.",
    "auth/wrong-password": "Contraseña incorrecta.",
    "auth/invalid-credential": "Correo o contraseña incorrectos.",
  };
  return map[code] || "Ocurrió un error. Intenta de nuevo.";
}
