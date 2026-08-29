import {
  auth, db, onAuthStateChanged, signOut,
  doc, setDoc, getDoc, serverTimestamp,
} from "./firebase-config.js";

let uid = null;
let coords = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "auth.html?tab=login"; return; }
  uid = user.uid;

  // 1. Obtener datos de la colección users
  const userDoc = await getDoc(doc(db, "users", uid));
  if (userDoc.exists() && userDoc.data().city) {
    document.getElementById("obCity").value = userDoc.data().city;
  }

  // 2. Cargar perfil de rutina previamente guardado en adopterProfiles
  try {
    const profileDoc = await getDoc(doc(db, "adopterProfiles", uid));
    if (profileDoc.exists()) {
      const data = profileDoc.data();

      // Rellenar ciudad y coordenadas guardadas previamente
      if (data.city) document.getElementById("obCity").value = data.city;
      if (data.lat && data.lng) {
        coords = { lat: data.lat, lng: data.lng };
        const msg = document.getElementById("ubicacionMsg");
        if (msg) msg.textContent = "✓ Ubicación guardada previamente.";
      }

      // Mapear y preseleccionar los botones (chips) que correspondan a cada grupo
      const savedFields = [
        { group: "vivienda", val: data.vivienda },
        { group: "ninos", val: data.ninos },
        { group: "otras_mascotas", val: data.otrasMascotas },
        { group: "horas_solo", val: data.horasSolo },
        { group: "energia", val: data.energia },
        { group: "experiencia", val: data.experiencia },
        { group: "especie", val: data.especiePreferida },
        { group: "tamano", val: data.tamanoPreferido }
      ];

      savedFields.forEach(({ group, val }) => {
        if (val) {
          const groupEl = document.querySelector(`[data-group="${group}"]`);
          if (groupEl) {
            const chip = groupEl.querySelector(`.choice-chip[data-value="${val}"]`);
            if (chip) chip.classList.add("selected");
          }
        }
      });
    }
  } catch (err) {
    console.error("Error al cargar la rutina previa:", err);
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
  const sel = group ? group.querySelector(".choice-chip.selected") : null;
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
