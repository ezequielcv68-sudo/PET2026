import {
  auth, db, onAuthStateChanged, signOut,
  doc, getDoc, collection, getDocs, query, where,
} from "./firebase-config.js";

const area = document.getElementById("matchesArea");
document.getElementById("btnLogout").onclick = () => signOut(auth).then(() => window.location.href = "index.html");

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "auth.html?tab=login"; return; }

  const snap = await getDocs(query(
    collection(db, "swipes"),
    where("adopterId", "==", user.uid),
    where("liked", "==", true),
  ));

  const matches = snap.docs.map(d => d.data());
  if (!matches.length) {
    area.innerHTML = `
      <div class="empty-state">
        <span class="paw-big">🐾</span>
        <h3>Todavía no tienes matches</h3>
        <p>Ve a "Descubrir" y desliza a la derecha en las mascotas que te gusten.</p>
      </div>`;
    return;
  }

  const grid = document.createElement("div");
  grid.className = "match-grid";

  for (const m of matches) {
    const petSnap = await getDoc(doc(db, "pets", m.petId));
    const pet = petSnap.exists() ? petSnap.data() : {};
    let contacto = "#";
    if (pet.shelterId) {
      const shelterUser = await getDoc(doc(db, "users", pet.shelterId));
      if (shelterUser.exists() && shelterUser.data().email) {
        contacto = `mailto:${shelterUser.data().email}?subject=${encodeURIComponent("Interesado en adoptar a " + (m.petName || ""))}`;
      }
    }

    const item = document.createElement("a");
    item.href = contacto;
    item.className = "match-item";
    item.innerHTML = `
      <img src="${m.petPhoto || ""}" alt="${escapeHtml(m.petName)}">
      <div class="m-info">
        <h3>${escapeHtml(m.petName || "Sin nombre")}</h3>
        <div class="pct">${m.matchScore}% match</div>
      </div>
    `;
    grid.appendChild(item);
  }

  area.innerHTML = "";
  area.appendChild(grid);
});

function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
