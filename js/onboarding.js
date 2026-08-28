import {
  auth, db, onAuthStateChanged, signOut,
  doc, setDoc, getDoc, serverTimestamp,
} from "./firebase-config.js";

let uid = null;
let coords = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "auth.html?tab=login"; return; }
  uid = user.uid;
  const userDoc = await getDoc(doc(db, "users", uid));
  if (userDoc.exists() && userDoc.data().city) {
    document.getElementById("obCity").value = userDoc.data().city;
  }
});

document.getElementById("btnLogout").onclick = () => signOut(auth).then(() => window.location.href = "index.html");

// ---------- Chips de selección única por grupo ----------
document.querySelectorAll("[data-group]").forEach(group => {
  group.querySelectorAll(".choice-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      group.querySelectorAll(".choice-chip").forEach(c => c.classList.remove("selected"));
      chip.classList.add("selected");
    });
  });
});

function getSelected(groupName) {
  const group = document.querySelector(`[data-group="${groupName}"]`);
  const sel = group.querySelector(".choice-chip.selected");
  return sel ? sel.dataset.value : null;
}

// ---------- Geolocalización ----------
document.getElementById("btnUbicacion").addEventListener("click", () => {
  const msg = document.getElementById("ubicacionMsg");
  if (!navigator.geolocation) {
    msg.textContent = "Tu navegador no soporta ubicación. No hay problema, usaremos tu ciudad.";
    return;
  }
  msg.textContent = "Obteniendo ubicación...";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      msg.textContent = "✓ Ubicación guardada. Buscaremos mascotas cerca de ti.";
    },
    () => { msg.textContent = "No pudimos acceder a tu ubicación. Usaremos tu ciudad."; },
  );
});

// ---------- Guardar perfil ----------
document.getElementById("btnGuardar").addEventListener("click", async () => {
  const btn = document.getElementById("btnGuardar");
  const perfil = {
    vivienda: getSelected("vivienda"),
    ninos: getSelected("ninos"),
    otrasMascotas: getSelected("otras_mascotas"),
    horasSolo: getSelected("horas_solo"),
    energia: getSelected("energia"),
    experiencia: getSelected("experiencia"),
    especiePreferida: getSelected("especie"),
    tamanoPreferido: getSelected("tamano"),
    city: document.getElementById("obCity").value.trim(),
    lat: coords ? coords.lat : null,
    lng: coords ? coords.lng : null,
    updatedAt: serverTimestamp(),
  };

  const faltantes = Object.entries(perfil).filter(([k, v]) => v === null && k !== "lat" && k !== "lng");
  if (faltantes.length) {
    document.getElementById("obMsg").innerHTML = `<div class="error-msg">Contesta todas las preguntas antes de continuar.</div>`;
    return;
  }
  if (!perfil.city) {
    document.getElementById("obMsg").innerHTML = `<div class="error-msg">Escribe tu ciudad.</div>`;
    return;
  }

  btn.disabled = true;
  btn.textContent = "Guardando...";
  try {
    await setDoc(doc(db, "adopterProfiles", uid), perfil);
    window.location.href = "swipe.html";
  } catch (err) {
    btn.disabled = false;
    btn.textContent = "Ver mis matches →";
    document.getElementById("obMsg").innerHTML = `<div class="error-msg">Error al guardar. Intenta de nuevo.</div>`;
  }
});
