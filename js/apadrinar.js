// PetMatch — Apadrinar: lista pública + flujo para apadrinar
import {
  auth, db, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, collection, getDocs, query, where,
  serverTimestamp, track, esc, safeUrl,
} from "./firebase-config.js";
import { urlWhatsApp } from "./whatsapp.js";
import { fmt, FREC, barra, alCorriente, lineaDeVida, mensajeApadrinar } from "./apad-lib.js";

const $ = (id) => document.getElementById(id);
let user = null, userData = {}, pets = [];

onAuthStateChanged(auth, async (u) => {
  user = u;
  if (u) { try { const s = await getDoc(doc(db, "users", u.uid)); userData = s.exists() ? s.data() : {}; } catch (_) {} }
  await cargar();
  const id = new URLSearchParams(location.search).get("pet");
  if (id) abrir(id);
});

async function cargar() {
  try {
    const s = await getDocs(query(collection(db, "pets"), where("apadrinable", "==", true)));
    pets = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => (p.status || "available") === "available");
    const ref = new URLSearchParams(location.search).get("refugio");
    if (ref) pets = pets.filter((p) => p.shelterId === ref);
  } catch (e) { console.error(e); pets = []; }
  $("apPets").innerHTML = pets.length ? pets.map(cardPet).join("")
    : `<p class="ap-empty">Todavía no hay animales abiertos a apadrinamiento. Pronto habrá; mientras tanto puedes <a href="catalogo.html">conocer a los que buscan hogar</a>.</p>`;
}

function cardPet(p) {
  return `<article class="ap-pet"><div class="ap-pet-img" style="background-image:url('${esc(safeUrl(p.photoURL))}')" role="img" aria-label="Foto de ${esc(p.nombre)}"></div>
    <div class="ap-pet-b"><h3>${esc(p.nombre)}</h3>
    <div class="ap-mut">${esc([p.raza, p.edad].filter(Boolean).join(" · "))}${p.shelterVerified ? " · ✓ Refugio verificado" : ""}</div>
    ${barra(p.apadrinaCubierto, p.apadrinaMeta)}
    <div>${(p.apadrinaCubre || []).map((c) => `<span class="ap-tag">${esc(c)}</span>`).join("")}</div>
    <div style="flex:1"></div>
    <button class="ap-btn" type="button" data-id="${esc(p.id)}">Apadrinar a ${esc(p.nombre)}</button></div></article>`;
}
$("apPets").addEventListener("click", (e) => { const b = e.target.closest("[data-id]"); if (b) abrir(b.dataset.id); });

/* ---------- ventana ---------- */
let foco = null;
function mostrar(html) { foco = document.activeElement; $("apBody").innerHTML = html; $("apOv").hidden = false; document.body.style.overflow = "hidden"; $("apX").focus(); }
function cerrar() { $("apOv").hidden = true; document.body.style.overflow = ""; if (foco && foco.focus) foco.focus(); }
$("apX").onclick = cerrar;
$("apOv").addEventListener("click", (e) => { if (e.target === $("apOv")) cerrar(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("apOv").hidden) cerrar(); });

async function abrir(id) {
  const p = pets.find((x) => x.id === id);
  if (!p) return;
  track && track("apadrinar_ver", { pet: id });
  let posts = [];
  try { const s = await getDocs(query(collection(db, "sponsorPosts"), where("petId", "==", id))); posts = s.docs.map((d) => d.data()); } catch (_) {}
  const corriente = alCorriente(posts);
  let acceso;
  if (!user) acceso = `<a class="ap-btn" href="auth.html?tab=login" style="width:100%">Inicia sesión para apadrinar</a><p class="ap-mut" style="text-align:center">¿Aún no tienes cuenta? <a href="auth.html">Regístrate gratis</a></p>`;
  else if (userData.role === "shelter") acceso = `<p class="ap-alert">Estás con una cuenta de refugio. Para apadrinar usa una cuenta de adoptante.</p>`;
  else if (userData.suspended) acceso = `<p class="ap-alert">Tu cuenta está suspendida.</p>`;
  else acceso = formulario(p);
  mostrar(`
    <h2 id="apTit">Apadrinar a ${esc(p.nombre)}</h2>
    <div class="ap-mut">${esc([p.raza, p.edad, p.city].filter(Boolean).join(" · "))}</div>
    <div style="margin:8px 0">
      <span class="ap-tag ${p.shelterVerified ? "ok" : "wa"}">${p.shelterVerified ? "✓ Refugio verificado" : "Refugio en revisión"}</span>
      <span class="ap-tag ${corriente ? "ok" : "wa"}">${corriente ? "Refugio al corriente" : "Sin novedades recientes"}</span>
    </div>
    <div class="ap-c">${esc(p.shelterName || "Refugio")} · ${esc(p.descripcion || "")}</div>
    ${p.apadrinaMeta ? `<div style="margin-top:10px">${barra(p.apadrinaCubierto, p.apadrinaMeta)}</div>` : ""}
    <div style="margin-top:6px">${(p.apadrinaCubre || []).map((c) => `<span class="ap-tag">${esc(c)}</span>`).join("")}</div>
    ${acceso}
    <div class="ap-safe"><b>Tu aportación está protegida:</b> va directo al refugio, sin comisión de PetMatch. Tú y el refugio confirman cada aportación y el refugio publica recibos y novedades. Cancelas cuando quieras.</div>
    <div class="ap-k">LÍNEA DE VIDA DE ${esc(p.nombre.toUpperCase())}</div>
    ${lineaDeVida(posts)}`);
  if (user && userData.role !== "shelter" && !userData.suspended) enlazar(p);
}

function formulario(p) {
  return `
    <label>1 · ¿Cómo quieres ayudar?</label>
    <div class="ap-seg" id="apFrec"><button type="button" data-f="mensual" aria-pressed="true">Cada mes</button><button type="button" data-f="unica" aria-pressed="false">Una vez</button><button type="button" data-f="especie" aria-pressed="false">En especie</button></div>
    <div id="apMontoBox">
      <label for="apMonto">2 · Escribe cuánto quieres aportar (MXN)</label>
      <div class="ap-money"><span>$</span><input id="apMonto" type="number" inputmode="numeric" min="1" step="1" placeholder="0" aria-describedby="apAyuda"></div>
      <div class="ap-mut" id="apAyuda" style="margin-top:4px">Pon lo que puedas. No hay mínimo ni máximo y puedes cambiarlo cuando quieras.</div>
    </div>
    <div id="apMsg" role="status"></div>
    <div class="ap-acts"><button class="ap-btn" id="apGo" type="button" style="width:100%">Apadrinar a ${esc(p.nombre)}</button></div>`;
}

function enlazar(p) {
  let frec = "mensual";
  $("apFrec").addEventListener("click", (e) => {
    const b = e.target.closest("[data-f]"); if (!b) return;
    frec = b.dataset.f;
    $("apFrec").querySelectorAll("button").forEach((x) => x.setAttribute("aria-pressed", String(x === b)));
    $("apMontoBox").style.display = frec === "especie" ? "none" : "block";
  });
  $("apGo").onclick = async () => {
    const monto = Math.round(Number($("apMonto").value) || 0);
    if (frec !== "especie" && monto < 1) { $("apMsg").innerHTML = `<p class="ap-alert">Escribe el monto que quieres aportar.</p>`; $("apMonto").focus(); return; }
    $("apGo").disabled = true; $("apGo").textContent = "Registrando…";
    const sid = `${user.uid}_${p.id}`;
    try {
      const ref = doc(db, "sponsorships", sid);
      const ya = await getDoc(ref);
      if (ya.exists() && !ya.data().cancelado) {
        $("apBody").innerHTML = `<h2 id="apTit">Ya eres padrino de ${esc(p.nombre)}</h2><p>Puedes ver y administrar tu apadrinamiento en <b>Mis ahijados</b>.</p><a class="ap-btn" href="ahijados.html">Ir a Mis ahijados</a>`;
        return;
      }
      if (ya.exists()) {
        await updateDoc(ref, { cancelado: false, pausado: false, monto: frec === "especie" ? 0 : monto, updatedAt: serverTimestamp() });
      } else {
        await setDoc(ref, {
          sponsorId: user.uid, sponsorName: userData.name || user.displayName || "", petId: p.id, petName: p.nombre, petPhoto: p.photoURL || "",
          shelterId: p.shelterId, shelterName: p.shelterName || "", frecuencia: frec, monto: frec === "especie" ? 0 : monto,
          estado: "pendiente", pausado: false, cancelado: false, createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
        });
      }
      track && track("apadrinar_inicio", { pet: p.id, frec });
      exito(p, frec, monto);
    } catch (e) {
      console.error(e);
      $("apMsg").innerHTML = `<p class="ap-alert">No se pudo registrar (${esc(e.code || "error")}). Intenta de nuevo.</p>`;
      $("apGo").disabled = false; $("apGo").textContent = `Apadrinar a ${p.nombre}`;
    }
  };
}

function exito(p, frec, monto) {
  const texto = mensajeApadrinar(userData.name || user.displayName, p, monto, frec);
  const wa = urlWhatsApp(p.shelterWhatsapp, texto);
  $("apBody").innerHTML = `
    <h2 id="apTit">¡Ya eres padrino de ${esc(p.nombre)}!</h2>
    <p>Gracias por ayudar a quien no puede pedir ayuda. Ahora sigue esto:</p>
    <div class="ap-c ap-step" style="margin-bottom:8px"><div class="ap-n">1</div><div>Escribe al refugio para pedir los datos de su aportación.</div></div>
    <div class="ap-c ap-step" style="margin-bottom:8px"><div class="ap-n">2</div><div>Haz tu depósito y confírmalo en <b>Mis ahijados</b> con “Ya hice mi aportación”.</div></div>
    <div class="ap-c ap-step"><div class="ap-n">3</div><div>El refugio confirma que lo recibió: solo entonces queda registrado y se suma a la meta de ${esc(p.nombre)}.</div></div>
    ${wa ? `<div class="ap-wa-box"><b>Mensaje que se enviará al refugio</b><br>“${esc(texto)}”</div><a class="ap-btn wa" style="width:100%" href="${esc(wa)}" target="_blank" rel="noopener">Abrir WhatsApp con el refugio</a>`
         : `<p class="ap-alert">Este refugio aún no registró su WhatsApp. Cuando lo haga, podrás escribirle desde Mis ahijados.</p>`}
    <div class="ap-acts"><a class="ap-btn sec" href="ahijados.html" style="width:100%">Ir a Mis ahijados</a></div>`;
}
