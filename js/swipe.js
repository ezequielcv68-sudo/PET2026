import {
  auth, db, onAuthStateChanged, signOut,
  doc, setDoc, getDoc, collection, getDocs, query, where, serverTimestamp,
} from "./firebase-config.js";
import { ordenarPorMatch } from "./matching.js";

let uid = null;
let perfil = null;
let deck = [];
let index = 0;

const deckArea = document.getElementById("deckArea");
document.getElementById("btnLogout").onclick = () => signOut(auth).then(() => window.location.href = "index.html");

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "auth.html?tab=login"; return; }
  uid = user.uid;

  const perfilSnap = await getDoc(doc(db, "adopterProfiles", uid));
  if (!perfilSnap.exists()) { window.location.href = "onboarding.html"; return; }
  perfil = perfilSnap.data();

  await cargarDeck();
});

async function cargarDeck() {
  // Mascotas disponibles
  const petsSnap = await getDocs(query(collection(db, "pets"), where("status", "==", "available")));
  const mascotas = petsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

  // Ya calificadas por este usuario
  const swipesSnap = await getDocs(query(collection(db, "swipes"), where("adopterId", "==", uid)));
  const yaCalificadas = new Set(swipesSnap.docs.map(d => d.data().petId));

  const disponibles = mascotas.filter(p => !yaCalificadas.has(p.id));
  deck = ordenarPorMatch(perfil, disponibles);
  index = 0;
  render();
}

function render() {
  deckArea.innerHTML = "";
  if (index >= deck.length) {
    deckArea.innerHTML = `
      <div class="empty-state">
        <span class="paw-big">🐾</span>
        <h3>¡Ya viste a todos los disponibles!</h3>
        <p>Vuelve más tarde, los refugios suben mascotas nuevas seguido.</p>
      </div>`;
    return;
  }

  const wrap = document.createElement("div");
  wrap.className = "deck-wrap";

  // Renderiza hasta 2 tarjetas (la de atrás da profundidad visual)
  const visibles = deck.slice(index, index + 2).reverse();
  visibles.forEach((pet, i) => {
    const isTop = i === visibles.length - 1;
    const card = document.createElement("div");
    card.className = "pet-card";
    card.style.zIndex = i + 1;
    if (!isTop) card.style.transform = "scale(0.96) translateY(10px)";

    card.innerHTML = `
      <div class="photo" style="background-image:url('${pet.photoURL || fotoDefault(pet.especie)}')">
        <div class="stamp">${pet.matchScore}% match</div>
        <div class="swipe-indicator like">ME GUSTA</div>
        <div class="swipe-indicator nope">PASO</div>
      </div>
      <div class="info">
        <div class="name-row"><h2>${escapeHtml(pet.nombre || "Sin nombre")}</h2><span class="age">${pet.edad || "?"}</span></div>
        <div class="tag-row">
          <span class="tag">${etiquetaEspecie(pet.especie)}</span>
          <span class="tag">${pet.raza || "Raza mixta"}</span>
          <span class="tag">${etiquetaTamano(pet.tamano)}</span>
          <span class="tag">${etiquetaEnergia(pet.energia)}</span>
        </div>
        <p class="desc">${escapeHtml(pet.descripcion || "")}</p>
        <div class="shelter-line">📍 ${escapeHtml(pet.shelterName || "Refugio")} · ${escapeHtml(pet.city || "")}</div>
      </div>
    `;
    wrap.appendChild(card);
    if (isTop) attachDrag(card, pet);
  });

  deckArea.appendChild(wrap);

  const actions = document.createElement("div");
  actions.className = "deck-actions";
  actions.innerHTML = `
    <button class="deck-btn pass" id="btnPass">✕</button>
    <button class="deck-btn like" id="btnLike">♥</button>
  `;
  deckArea.appendChild(actions);

  document.getElementById("btnPass").onclick = () => {
    const topCard = wrap.querySelector(".pet-card:last-child");
    animarSalida(topCard, -1, () => commitSwipe(false));
  };
  document.getElementById("btnLike").onclick = () => {
    const topCard = wrap.querySelector(".pet-card:last-child");
    animarSalida(topCard, 1, () => commitSwipe(true));
  };
}

function attachDrag(card, pet) {
  let startX = 0, startY = 0, dx = 0, dragging = false;
  const likeInd = card.querySelector(".swipe-indicator.like");
  const nopeInd = card.querySelector(".swipe-indicator.nope");

  function onDown(e) {
    dragging = true;
    const p = e.touches ? e.touches[0] : e;
    startX = p.clientX; startY = p.clientY;
    card.style.transition = "none";
  }
  function onMove(e) {
    if (!dragging) return;
    const p = e.touches ? e.touches[0] : e;
    dx = p.clientX - startX;
    const dy = p.clientY - startY;
    const rot = dx / 18;
    card.style.transform = `translate(${dx}px, ${dy}px) rotate(${rot}deg)`;
    likeInd.style.opacity = Math.max(0, Math.min(1, dx / 90));
    nopeInd.style.opacity = Math.max(0, Math.min(1, -dx / 90));
  }
  function onUp() {
    if (!dragging) return;
    dragging = false;
    card.style.transition = "";
    if (dx > 110) { animarSalida(card, 1, () => commitSwipe(true)); }
    else if (dx < -110) { animarSalida(card, -1, () => commitSwipe(false)); }
    else {
      card.style.transform = "translate(0,0) rotate(0)";
      likeInd.style.opacity = 0; nopeInd.style.opacity = 0;
    }
    dx = 0;
  }

  card.addEventListener("pointerdown", onDown);
  window.addEventListener("pointermove", onMove);
  window.addEventListener("pointerup", onUp);
}

function animarSalida(card, dir, cb) {
  if (!card) return cb();
  card.style.transition = "transform .35s ease, opacity .35s ease";
  card.style.transform = `translate(${dir * 500}px, -40px) rotate(${dir * 30}deg)`;
  card.style.opacity = "0";
  setTimeout(cb, 260);
}

async function commitSwipe(liked) {
  const pet = deck[index];
  index++;
  render();
  try {
    await setDoc(doc(db, "swipes", `${uid}_${pet.id}`), {
      adopterId: uid,
      petId: pet.id,
      shelterId: pet.shelterId || null,
      liked,
      matchScore: pet.matchScore,
      petName: pet.nombre || "",
      petPhoto: pet.photoURL || "",
      petSpecies: pet.especie || "",
      timestamp: serverTimestamp(),
    });
  } catch (err) {
    console.error("No se pudo guardar el swipe:", err);
  }
}

function fotoDefault(especie) {
  return especie === "gato"
    ? "https://images.unsplash.com/photo-1596854407944-bf87f6fdd49e?q=80&w=800&auto=format&fit=crop"
    : "https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=800&auto=format&fit=crop";
}
function etiquetaEspecie(e) { return e === "gato" ? "🐈 Gato" : "🐕 Perro"; }
function etiquetaTamano(t) { return { pequeno: "Pequeño", mediano: "Mediano", grande: "Grande" }[t] || t || ""; }
function etiquetaEnergia(e) { return { bajo: "Tranquilo", medio: "Activo", alto: "Muy activo" }[e] || e || ""; }
function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
