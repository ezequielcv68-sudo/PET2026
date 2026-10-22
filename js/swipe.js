import {
  auth, db, onAuthStateChanged, signOut,
  doc, setDoc, getDoc, collection, getDocs, query, where, serverTimestamp,
  track, esc, safeUrl, PENDING_KEY,
} from "./firebase-config.js";
import { ordenarPorMatch, calcularMatch, explicarMatch } from "./matching.js";

let uid = null;
let userData = {};
let perfil = null;
let deck = [];
let index = 0;

const deckArea = document.getElementById("deckArea");
document.getElementById("btnLogout").onclick = () => signOut(auth).then(() => window.location.href = "index.html");

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "auth.html?tab=login"; return; }
  uid = user.uid;

  const userSnap = await getDoc(doc(db, "users", uid));
  userData = userSnap.exists() ? userSnap.data() : {};
  if (userData.role === "shelter") { window.location.href = "shelter.html"; return; }

  const perfilSnap = await getDoc(doc(db, "adopterProfiles", uid));
  if (!perfilSnap.exists()) { window.location.href = "onboarding.html"; return; }
  perfil = perfilSnap.data();

  await procesarLikePendiente();
  await cargarDeck();
});

// Si la persona dio "Me interesa" en el catálogo o en el test antes de registrarse,
// aquí se guarda ese like una vez que ya tiene perfil.
async function procesarLikePendiente() {
  let petId = null;
  try { petId = sessionStorage.getItem(PENDING_KEY); } catch (e) {}
  if (!petId) return;
  try { sessionStorage.removeItem(PENDING_KEY); } catch (e) {}

  try {
    const snap = await getDoc(doc(db, "pets", petId));
    if (!snap.exists()) return;
    const pet = { id: snap.id, ...snap.data() };
    if (pet.status === "adopted" || pet.shelterId === uid) return;

    const { score } = calcularMatch(perfil, pet);
    await guardarSwipe(pet, true, score);
    mostrarToast(`Guardamos tu interés en ${pet.nombre || "la mascota"} 💛`);
  } catch (err) {
    console.error("No se pudo guardar el like pendiente:", err);
  }
}

function mostrarToast(texto) {
  const t = document.createElement("div");
  t.textContent = texto;
  t.style.cssText = "position:fixed;left:50%;bottom:90px;transform:translateX(-50%);background:#1C1A16;color:#FBF8F0;padding:12px 18px;border-radius:999px;font-size:0.88rem;box-shadow:0 10px 24px rgba(0,0,0,.25);z-index:200;max-width:90vw;text-align:center;";
  document.body.appendChild(t);
  setTimeout(() => t.remove(), 4000);
}

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

    const { razones, avisos } = explicarMatch(perfil, pet);
    const fotoSegura = safeUrl(pet.photoURL, fotoDefault(pet.especie));
    const porque = [...razones.slice(0, 2).map(r => "✓ " + r), ...avisos.slice(0, 1).map(a => "⚠ " + a)].join(" · ");
    card.innerHTML = `
      <div class="photo" style="background-image:url('${esc(fotoSegura)}')">
        <div class="stamp">${pet.matchScore}% match</div>
        <div class="swipe-indicator like">ME GUSTA</div>
        <div class="swipe-indicator nope">PASO</div>
      </div>
      <div class="info">
        <div class="name-row"><h2>${escapeHtml(pet.nombre || "Sin nombre")}</h2><span class="age">${esc(pet.edad || "?")}</span></div>
        <div class="tag-row">
          <span class="tag">${etiquetaEspecie(pet.especie)}</span>
          <span class="tag">${esc(pet.raza || "Raza mixta")}</span>
          <span class="tag">${etiquetaTamano(pet.tamano)}</span>
          <span class="tag">${etiquetaEnergia(pet.energia)}</span>
        </div>
        ${porque ? `<div style="font-size:0.78rem;color:#2E6B5D;margin-bottom:4px;">${esc(porque)}</div>` : ""}
        <p class="desc">${escapeHtml(pet.descripcion || "")}</p>
        <div class="shelter-line">📍 ${escapeHtml(pet.shelterName || "Refugio")}${pet.shelterVerified === true ? " ✓" : ""} · ${escapeHtml(pet.city || "")}</div>
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

// Datos del adoptante que ve el refugio SOLO cuando hay like.
// Se copian dentro del swipe para que el refugio no necesite leer el perfil completo.
function snapshotAdoptante() {
  return {
    name: userData.name || "",
    email: userData.email || "",
    city: perfil.city || userData.city || "",
    phone: perfil.phone || userData.phone || "",
    biografia: perfil.biografia || "",
    vivienda: perfil.vivienda || "",
    tipoVivienda: perfil.tipoVivienda || "",
    acuerdoFamiliar: perfil.acuerdoFamiliar || "",
    planViajes: perfil.planViajes || "",
    horasSolo: perfil.horasSolo || "",
    ninos: perfil.ninos || "",
    otrasMascotas: perfil.otrasMascotas || "",
    experiencia: perfil.experiencia || "",
  };
}

async function guardarSwipe(pet, liked, score) {
  const data = {
    adopterId: uid,
    petId: pet.id,
    shelterId: pet.shelterId || null,
    liked,
    matchScore: score,
    petName: pet.nombre || "",
    petPhoto: pet.photoURL || "",
    petSpecies: pet.especie || "",
    timestamp: serverTimestamp(),
  };
  if (liked) data.adopter = snapshotAdoptante();
  await setDoc(doc(db, "swipes", `${uid}_${pet.id}`), data);
  if (liked) track("like", { pet_id: pet.id, score });
}

async function commitSwipe(liked) {
  const pet = deck[index];
  index++;
  render();
  try {
    await guardarSwipe(pet, liked, pet.matchScore);
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
