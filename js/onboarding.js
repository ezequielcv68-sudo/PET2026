// ============================================================
// ONBOARDING DEL ADOPTANTE ("Cuéntanos tu rutina")
// Reescrito completo: el archivo anterior estaba cortado.
// Guarda en adopterProfiles los campos que lee matching.js / swipe.js.
// ============================================================
import {
  auth, db, onAuthStateChanged, signOut,
  doc, setDoc, getDoc, updateDoc, serverTimestamp, track,
} from "./firebase-config.js";

let uid = null;
let coords = null;

const $ = (id) => document.getElementById(id);

// data-group del HTML  ->  campo guardado en adopterProfiles
const CAMPOS = {
  vivienda: "vivienda",
  tipo_vivienda: "tipoVivienda",
  acuerdo_familiar: "acuerdoFamiliar",
  plan_viajes: "planViajes",
  ninos: "ninos",
  otras_mascotas: "otrasMascotas",
  horas_solo: "horasSolo",
  energia: "energia",
  experiencia: "experiencia",
  especie: "especiePreferida",
  tamano: "tamanoPreferido",
};

// Estas preguntas alimentan el motor de match: son obligatorias.
const OBLIGATORIAS = [
  "vivienda", "ninos", "otras_mascotas", "horas_solo",
  "energia", "experiencia", "especie", "tamano",
];

// ---------- Chips de selección única ----------
document.querySelectorAll("[data-group]").forEach((group) => {
  group.querySelectorAll(".choice-chip").forEach((chip) => {
    chip.addEventListener("click", () => {
      group.querySelectorAll(".choice-chip").forEach((c) => c.classList.remove("selected"));
      chip.classList.add("selected");
    });
  });
});

function valor(grupo) {
  const sel = document.querySelector(`[data-group="${grupo}"] .choice-chip.selected`);
  return sel ? sel.dataset.value : null;
}

function marcar(grupo, v) {
  if (!v) return;
  const group = document.querySelector(`[data-group="${grupo}"]`);
  if (!group) return;
  group.querySelectorAll(".choice-chip").forEach((c) => {
    c.classList.toggle("selected", c.dataset.value === v);
  });
}

function mensaje(texto, ok = false) {
  const el = $("obMsg");
  el.innerHTML = "";
  const div = document.createElement("div");
  div.className = ok ? "ok-msg" : "error-msg";
  div.textContent = texto;
  el.appendChild(div);
}

// ---------- Sesión y datos guardados ----------
$("btnLogout").onclick = () => signOut(auth).then(() => { window.location.href = "index.html"; });

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "auth.html?tab=login"; return; }
  uid = user.uid;

  // 1. Datos básicos de la cuenta
  try {
    const userDoc = await getDoc(doc(db, "users", uid));
    if (userDoc.exists()) {
      const u = userDoc.data();
      if (u.role === "shelter") { window.location.href = "shelter.html"; return; }
      if (u.city) $("obCity").value = u.city;
      if (u.phone) $("obPhone").value = u.phone;
    }
  } catch (err) {
    console.error("No se pudo leer el usuario:", err);
  }

  // 2. Perfil previo (o el que viene del test sin registro)
  try {
    const profileDoc = await getDoc(doc(db, "adopterProfiles", uid));
    if (profileDoc.exists()) {
      const data = profileDoc.data();

      if (data.city) $("obCity").value = data.city;
      if (data.phone) $("obPhone").value = data.phone;
      if (data.biografia) $("obBio").value = data.biografia;

      if (data.lat && data.lng) {
        coords = { lat: data.lat, lng: data.lng };
        $("ubicacionMsg").textContent = "✓ Ubicación guardada previamente.";
      }

      for (const [grupo, campo] of Object.entries(CAMPOS)) {
        marcar(grupo, data[campo]);
      }
    }
  } catch (err) {
    console.error("No se pudo leer el perfil:", err);
  }
});

// ---------- Ubicación ----------
$("btnUbicacion").addEventListener("click", () => {
  const msg = $("ubicacionMsg");
  if (!navigator.geolocation) {
    msg.textContent = "Tu navegador no permite obtener la ubicación.";
    return;
  }
  msg.textContent = "Buscando tu ubicación…";
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      coords = { lat: pos.coords.latitude, lng: pos.coords.longitude };
      msg.textContent = "✓ Ubicación guardada. Te mostraremos primero los animales cercanos.";
    },
    () => {
      msg.textContent = "No pudimos obtener tu ubicación. Puedes continuar sin ella.";
    },
    { enableHighAccuracy: false, timeout: 10000 },
  );
});

// ---------- Guardar ----------
async function guardar() {
  if (!uid) { mensaje("Tu sesión aún no está lista. Espera un segundo e inténtalo de nuevo."); return false; }

  const perfil = {};
  for (const [grupo, campo] of Object.entries(CAMPOS)) {
    const v = valor(grupo);
    if (v) perfil[campo] = v;
  }

  const faltan = OBLIGATORIAS.filter((g) => !valor(g));
  if (faltan.length) {
    mensaje("Contesta todas las preguntas principales (vivienda, niños, otros animales, horas solo, energía, experiencia, especie y tamaño).");
    return false;
  }

  const phone = $("obPhone").value.trim();
  const city = $("obCity").value.trim();
  const biografia = $("obBio").value.trim();

  if (phone.replace(/\D/g, "").length < 10) {
    mensaje("Escribe un teléfono o WhatsApp de al menos 10 dígitos para que el refugio pueda contactarte.");
    return false;
  }
  if (!city) {
    mensaje("Escribe tu ciudad.");
    return false;
  }

  const data = { ...perfil, phone, city, biografia, updatedAt: serverTimestamp() };
  if (coords) { data.lat = coords.lat; data.lng = coords.lng; }

  try {
    await setDoc(doc(db, "adopterProfiles", uid), data, { merge: true });
    await updateDoc(doc(db, "users", uid), { phone, city });
    track("perfil_guardado");
    return true;
  } catch (err) {
    console.error("No se pudo guardar el perfil:", err);
    mensaje("No pudimos guardar tus respuestas. Intenta de nuevo.");
    return false;
  }
}

$("btnSoloGuardar").addEventListener("click", async () => {
  const btn = $("btnSoloGuardar");
  btn.disabled = true;
  const ok = await guardar();
  btn.disabled = false;
  if (ok) mensaje("✓ Cambios guardados.", true);
});

$("btnGuardar").addEventListener("click", async () => {
  const btn = $("btnGuardar");
  btn.disabled = true;
  const ok = await guardar();
  if (ok) {
    window.location.href = "swipe.html";
  } else {
    btn.disabled = false;
  }
});
