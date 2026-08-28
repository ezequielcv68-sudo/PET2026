import { db, collection, getDocs, query, where } from "./firebase-config.js";

const area = document.getElementById("catalogArea");

(async () => {
  try {
    const snap = await getDocs(query(collection(db, "pets"), where("status", "==", "available")));
    const pets = snap.docs.map(d => ({ id: d.id, ...d.data() }));

    if (!pets.length) {
      area.innerHTML = `
        <div class="empty-state" style="grid-column: 1 / -1;">
          <span class="paw-big">🐾</span>
          <h3>Todavía no hay mascotas publicadas</h3>
          <p>Vuelve pronto, los refugios están subiendo perfiles.</p>
        </div>`;
      return;
    }

    area.innerHTML = "";
    pets.forEach(pet => {
      const item = document.createElement("a");
      item.href = `auth.html`;
      item.className = "match-item";
      item.innerHTML = `
        <img src="${pet.photoURL || ""}" alt="${escapeHtml(pet.nombre || "")}">
        <div class="m-info">
          <h3>${escapeHtml(pet.nombre || "Sin nombre")}</h3>
          <div class="pct" style="color:var(--ink-soft);">${pet.especie === "gato" ? "🐈 Gato" : "🐕 Perro"} · ${escapeHtml(pet.city || "")}</div>
        </div>
      `;
      area.appendChild(item);
    });
  } catch (err) {
    console.error(err);
    area.innerHTML = `<div class="error-msg">No se pudo cargar el catálogo.</div>`;
  }
})();

function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
