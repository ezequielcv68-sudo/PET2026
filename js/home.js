// ============================================================
// PORTADA CON DATOS REALES
//  · Contadores: animales esperando hogar, refugios y adoptados (solo cifras reales)
//  · Carrusel del hero: si ya hay animales publicados con foto, se muestran ellos
//    (si no hay ninguno, se queda el ejemplo que ya tenías)
// ============================================================
import { db, collection, getDocs, safeUrl } from "./firebase-config.js";

const $ = (s) => document.querySelector(s);
const ESPECIE = { perro: "Perro", gato: "Gato" };

function mezclar(a) {
  const r = a.slice();
  for (let i = r.length - 1; i > 0; i--) { const j = Math.floor(Math.random() * (i + 1)); [r[i], r[j]] = [r[j], r[i]]; }
  return r;
}

function pintarContadores(disp, adoptados, refugios) {
  const row = $(".hero-copy .trust-row");
  if (!row || !disp) return;
  const stats = [];
  stats.push(`<span class="stat">🐾 <b>${disp}</b> ${disp === 1 ? "espera hogar" : "esperan hogar"}</span>`);
  if (refugios) stats.push(`<span class="stat">🏠 <b>${refugios}</b> ${refugios === 1 ? "refugio" : "refugios"}</span>`);
  if (adoptados) stats.push(`<span class="stat">💛 <b>${adoptados}</b> ${adoptados === 1 ? "adoptado" : "adoptados"}</span>`);
  const box = document.createElement("div");
  box.className = "live-stats";
  box.innerHTML = stats.join("");
  row.insertAdjacentElement("afterend", box);
}

function usarAnimalesReales(lista) {
  const arr = window.__heroPets;
  const visual = $(".hero-visual");
  if (!Array.isArray(arr) || !visual || !lista.length) return;

  arr.length = 0;
  lista.forEach((p) => arr.push({
    id: p.id,
    name: p.nombre || "Sin nombre",
    match: [p.raza || ESPECIE[p.especie] || "", p.city].filter(Boolean).join(" · "),
    alert: `Conoce a ${p.nombre || "este amigo"}`,
    photo: p.foto,
  }));

  // Pinta ya el primero y ajusta el rótulo (ya no es un «match», es un animal real)
  const p0 = arr[0];
  $("#heroPetPhoto").src = p0.photo;
  $("#heroMiniPhoto").src = p0.photo;
  $("#heroPetName").textContent = p0.name;
  $("#heroPctText").textContent = p0.match;
  $("#heroMatchText").textContent = p0.alert;
  const t1 = $(".match-alert .t1");
  if (t1) t1.textContent = "Busca hogar";
  visual.dataset.petId = p0.id;

  visual.addEventListener("click", () => {
    const id = visual.dataset.petId;
    if (id) window.location.href = "catalogo.html?m=" + encodeURIComponent(id);
  });
}

(async function () {
  try {
    const snap = await getDocs(collection(db, "pets"));
    const todos = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const disp = todos.filter((p) => p.status !== "adopted");
    const adoptados = todos.length - disp.length;
    const refugios = new Set(disp.map((p) => p.shelterId).filter(Boolean)).size;

    pintarContadores(disp.length, adoptados, refugios);

    const conFoto = disp
      .map((p) => ({ ...p, foto: safeUrl(p.photoURL, "") }))
      .filter((p) => p.foto);
    usarAnimalesReales(mezclar(conFoto).slice(0, 6));
  } catch (e) {
    console.warn("Portada: se queda con los datos de ejemplo", e);
  }
})();
