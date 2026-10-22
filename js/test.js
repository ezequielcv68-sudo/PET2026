// ============================================================
// TEST SIN REGISTRO (modo invitado)
// Contesta 8 preguntas, calcula el match en el navegador con el
// mismo motor de matching.js y guarda el perfil en localStorage.
// Al registrarse, auth.js copia ese perfil a adopterProfiles.
// ============================================================
import {
  db, auth, collection, getDocs, onAuthStateChanged,
  track, esc, safeUrl, GUEST_KEY, PENDING_KEY,
} from "./firebase-config.js";
import { ordenarPorMatch, explicarMatch } from "./matching.js";

const FOTO_DEFAULT = {
  perro: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=800&auto=format&fit=crop",
  gato: "https://images.unsplash.com/photo-1596854407944-bf87f6fdd49e?q=80&w=800&auto=format&fit=crop",
};

let usuarioActual = null;
onAuthStateChanged(auth, (u) => { usuarioActual = u; });

const vistaTest = document.getElementById("vistaTest");
const vistaResultados = document.getElementById("vistaResultados");
const resArea = document.getElementById("resArea");

// ---------- Chips de selección única ----------
document.querySelectorAll("[data-group]").forEach(group => {
  group.querySelectorAll(".choice-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      group.querySelectorAll(".choice-chip").forEach(c => c.classList.remove("selected"));
      chip.classList.add("selected");
    });
  });
});

function valor(grupo) {
  const sel = document.querySelector(`[data-group="${grupo}"] .choice-chip.selected`);
  return sel ? sel.dataset.value : null;
}

// ---------- Recuperar respuestas guardadas ----------
function leerGuardado() {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY) || "null"); }
  catch (e) { return null; }
}

(function precargar() {
  const g = leerGuardado();
  if (!g) return;
  const mapa = {
    especie: g.especiePreferida, vivienda: g.vivienda, ninos: g.ninos,
    otrasMascotas: g.otrasMascotas, horasSolo: g.horasSolo, energia: g.energia,
    experiencia: g.experiencia, tamanoPreferido: g.tamanoPreferido,
  };
  for (const [grupo, v] of Object.entries(mapa)) {
    if (!v) continue;
    document.querySelector(`[data-group="${grupo}"] .choice-chip[data-value="${v}"]`)?.classList.add("selected");
  }
})();

// ---------- Enviar ----------
document.getElementById("btnVerMatches").addEventListener("click", async () => {
  const btn = document.getElementById("btnVerMatches");
  const msg = document.getElementById("testMsg");

  const perfil = {
    especiePreferida: valor("especie"),
    vivienda: valor("vivienda"),
    ninos: valor("ninos"),
    otrasMascotas: valor("otrasMascotas"),
    horasSolo: valor("horasSolo"),
    energia: valor("energia"),
    experiencia: valor("experiencia"),
    tamanoPreferido: valor("tamanoPreferido"),
  };

  const faltan = Object.values(perfil).some(v => !v);
  if (faltan) {
    msg.innerHTML = `<div class="error-msg">Contesta las 8 preguntas para ver tus matches.</div>`;
    return;
  }
  msg.innerHTML = "";

  try { localStorage.setItem(GUEST_KEY, JSON.stringify(perfil)); } catch (e) {}

  btn.disabled = true;
  btn.textContent = "Buscando…";
  try {
    const snap = await getDocs(collection(db, "pets"));
    const mascotas = snap.docs
      .map(d => ({ id: d.id, ...d.data() }))
      .filter(p => p.status !== "adopted");

    const ordenadas = ordenarPorMatch(perfil, mascotas);
    track("test_completado", { resultados: ordenadas.length, especie: perfil.especiePreferida });
    pintarResultados(perfil, ordenadas);
  } catch (err) {
    console.error(err);
    msg.innerHTML = `<div class="error-msg">No pudimos cargar las mascotas. Intenta de nuevo.</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Ver mis matches →";
  }
});

document.getElementById("btnRehacer").addEventListener("click", () => {
  vistaResultados.classList.add("hidden");
  vistaTest.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---------- Resultados ----------
function pintarResultados(perfil, lista) {
  vistaTest.classList.add("hidden");
  vistaResultados.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });

  const titulo = document.getElementById("resTitulo");
  const sub = document.getElementById("resSub");
  resArea.innerHTML = "";

  if (!lista.length) {
    titulo.textContent = "Aún no hay mascotas que encajen";
    sub.textContent = "Todavía estamos sumando refugios. Crea tu cuenta y te avisamos cuando lleguen mascotas para ti.";
    return;
  }

  titulo.textContent = "Estas mascotas van contigo";
  sub.textContent = `Encontramos ${lista.length} ${lista.length === 1 ? "mascota" : "mascotas"}. Te mostramos las que mejor encajan.`;

  lista.slice(0, 12).forEach(pet => {
    const { razones, avisos } = explicarMatch(perfil, pet);
    const foto = safeUrl(pet.photoURL, FOTO_DEFAULT[pet.especie === "gato" ? "gato" : "perro"]);
    const tamanoTxt = { pequeno: "Pequeño", mediano: "Mediano", grande: "Grande" }[pet.tamano] || "";
    const subTxt = [pet.especie === "gato" ? "Gato" : "Perro", pet.raza, pet.edad, tamanoTxt, pet.city]
      .filter(Boolean).join(" · ");

    const card = document.createElement("div");
    card.className = "res-card";
    card.innerHTML = `
      <div class="res-photo" style="background-image:url('${esc(foto)}')">
        <span class="res-pct">${esc(pet.matchScore)}% match</span>
      </div>
      <div class="res-body">
        <h3>${esc(pet.nombre || "Sin nombre")}</h3>
        <div class="res-sub">${esc(subTxt)}</div>
        ${razones.length ? `<ul class="res-why">${razones.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
        ${avisos.length ? `<ul class="res-warn">${avisos.map(a => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}
        <div class="res-actions">
          <a class="btn-sm outline" href="catalogo.html?m=${encodeURIComponent(pet.id)}">Ver más</a>
          <button class="btn-sm" type="button" data-id="${esc(pet.id)}">Me interesa</button>
        </div>
      </div>
    `;
    card.querySelector("button[data-id]").addEventListener("click", () => {
      try { sessionStorage.setItem(PENDING_KEY, pet.id); } catch (e) {}
      track("test_me_interesa", { pet_id: pet.id });
      window.location.href = usuarioActual ? "swipe.html" : "auth.html";
    });
    resArea.appendChild(card);
  });
}
