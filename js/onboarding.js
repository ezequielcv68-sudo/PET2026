import {
  auth, db, onAuthStateChanged, signOut,
  doc, setDoc, getDoc, updateDoc, serverTimestamp,
} from "./firebase-config.js";

let uid = null;
let coords = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "auth.html?tab=login"; return; }
  uid = user.uid;

  // 1. Cargar teléfono y ciudad desde la colección users
  const userDoc = await getDoc(doc(db, "users", uid));
  if (userDoc.exists()) {
    const uData = userDoc.data();
    if (uData.city) document.getElementById("obCity").value = uData.city;
    if (uData.phone && document.getElementById("obPhone")) {
      document.getElementById("obPhone").value = uData.phone;
    }
  }

  // 2. Cargar perfil de rutina previo en adopterProfiles
  try {
    const profileDoc = await getDoc(doc(db, "adopterProfiles", uid));
    if (profileDoc.exists()) {
      const data = profileDoc.data();

      if (data.city) document.getElementById("obCity").value = data.city;
      if (data.phone && document.getElementById("obPhone")) {
        document.getElementById("obPhone").value = data.phone;
      }

      if (data.lat && data.lng) {
        coords = { lat: data.lat, lng: data.lng };
        const msg = document.getElementById("ubicacionMsg");
        if (msg) msg.textContent = "✓ Ubicación guardada previamente.";
      }

      const savedFields = [
        { group: "vivienda", val: data.vivienda },
        { group: "tipo_vivienda", val: data.tipoVivienda },
        { group: "acuerdo_familiar", val: data.acuerdoFamiliar },
        { group: "plan_viajes", val: data.planViajes },
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

// ---------- Chips de selección única ----------
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
    msg.textContent = "Tu navegador no soporta ubicación. Usaremos tu ciudad.";
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

// ---------- Función genérica para recopilar y guardar datos ----------
async function procesarGuardado() {
  const phoneInput = document.getElementById("obPhone");
  const phone = phoneInput ? phoneInput.value.trim() : "";
  const city = document.getElementById("obCity").value.trim();

  const perfil = {
    phone,
    vivienda: getSelected("vivienda"),
    tipoVivienda: getSelected("tipo_vivienda"),
    acuerdoFamiliar: getSelected("acuerdo_familiar"),
    planViajes: getSelected("plan_viajes"),
    ninos: getSelected("ninos"),
    otrasMascotas: getSelected("otras_mascotas"),
    horasSolo: getSelected("horas_solo"),
    energia: getSelected("energia"),
    experiencia: getSelected("experiencia"),
    especiePreferida: getSelected("especie"),
    tamanoPreferido: getSelected("tamano"),
    city,
    lat: coords ? coords.lat : null,
    lng: coords ? coords.lng : null,
    updatedAt: serverTimestamp(),
  };

  if (phoneInput && (!phone || phone.length < 10)) {
    document.getElementById("obMsg").innerHTML = `<div class="error-msg">Ingresa un número de teléfono/WhatsApp válido de 10 dígitos.</div>`;
    return null;
  }

  const faltantes = Object.entries(perfil).filter(([k, v]) => 
    v === null && 
    k !== "lat" && 
    k !== "lng" && 
    k !== "tipoVivienda" && 
    k !== "acuerdoFamiliar" && 
    k !== "planViajes"
  );

  if (faltantes.length) {
    document.getElementById("obMsg").innerHTML = `<div class="error-msg">Contesta todas las preguntas principales antes de continuar.</div>`;
    return null;
  }

  if (!perfil.city) {
    document.getElementById("obMsg").innerHTML = `<div class="error-msg">Escribe tu ciudad.</div>`;
    return null;
  }

  // Guardar en ambas colecciones
  await setDoc(doc(db, "adopterProfiles", uid), perfil, { merge: true });
  await setDoc(doc(db, "users", uid), { phone, city }, { merge: true });

  return perfil;
}

// Acción 1: Guardar cambios únicamente (Permanecer en la vista)
const btnSoloGuardar = document.getElementById("btnSoloGuardar");
if (btnSoloGuardar) {
  btnSoloGuardar.addEventListener("click", async () => {
    btnSoloGuardar.disabled = true;
    btnSoloGuardar.textContent = "Guardando...";
    document.getElementById("obMsg").innerHTML = "";

    try {
      const res = await procesarGuardado();
      if (res) {
        document.getElementById("obMsg").innerHTML = `<div class="ok-msg">✓ Tus datos se actualizaron correctamente.</div>`;
      }
    } catch (err) {
      console.error(err);
      document.getElementById("obMsg").innerHTML = `<div class="error-msg">Error al guardar los datos. Intenta de nuevo.</div>`;
    } finally {
      btnSoloGuardar.disabled = false;
      btnSoloGuardar.textContent = "Guardar cambios";
    }
  });
}

// Acción 2: Guardar e ir directamente a los matches (Redirección)
const btnGuardar = document.getElementById("btnGuardar");
if (btnGuardar) {
  btnGuardar.addEventListener("click", async () => {
    btnGuardar.disabled = true;
    btnGuardar.textContent = "Guardando...";
    document.getElementById("obMsg").innerHTML = "";

    try {
      const res = await procesarGuardado();
      if (res) {
        window.location.href = "swipe.html";
      } else {
        btnGuardar.disabled = false;
        btnGuardar.textContent = "Ver mis matches →";
      }
    } catch (err) {
      console.error(err);
      btnGuardar.disabled = false;
      btnGuardar.textContent = "Ver mis matches →";
      document.getElementById("obMsg").innerHTML = `<div class="error-msg">Error al guardar los datos. Intenta de nuevo.</div>`;
    }
  });
}
