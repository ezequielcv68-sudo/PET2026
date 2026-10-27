// PetMatch — Mis ahijados (lado del padrino)
import {
  auth, db, onAuthStateChanged, doc, getDoc, setDoc, updateDoc, collection, addDoc, getDocs, query, where,
  serverTimestamp, track, esc, safeUrl,
} from "./firebase-config.js";
import { urlWhatsApp } from "./whatsapp.js";
import { fmt, FREC, fecha, tsd, activo, alCorriente, lineaDeVida } from "./apad-lib.js";

const $ = (id) => document.getElementById(id);
let user = null, userData = {}, items = [];

function aviso(t, tipo = "ok") { $("ahMsg").innerHTML = `<div class="${tipo === "ok" ? "ok-msg" : "error-msg"}">${esc(t)}</div>`; clearTimeout(aviso._t); aviso._t = setTimeout(() => ($("ahMsg").innerHTML = ""), 6000); }

onAuthStateChanged(auth, async (u) => {
  if (!u) { location.href = "auth.html?tab=login"; return; }
  user = u;
  try { const s = await getDoc(doc(db, "users", u.uid)); userData = s.exists() ? s.data() : {}; } catch (_) {}
  if (userData.role === "shelter") { location.href = "padrinos.html"; return; }
  await cargar();
});

async function cargar() {
  try {
    const [s, p] = await Promise.all([
      getDocs(query(collection(db, "sponsorships"), where("sponsorId", "==", user.uid))),
      getDocs(query(collection(db, "sponsorPayments"), where("sponsorId", "==", user.uid))),
    ]);
    const pagos = p.docs.map((d) => ({ id: d.id, ...d.data() }));
    items = await Promise.all(s.docs.map(async (d) => {
      const sp = { id: d.id, ...d.data() };
      let pet = null, posts = [];
      try { const g = await getDoc(doc(db, "pets", sp.petId)); pet = g.exists() ? g.data() : null; } catch (_) {}
      try { const q = await getDocs(query(collection(db, "sponsorPosts"), where("petId", "==", sp.petId))); posts = q.docs.map((x) => x.data()); } catch (_) {}
      return { sp, pet, posts, pagos: pagos.filter((x) => x.sponsorshipId === sp.id).sort((a, b) => (tsd(b.creado) || 0) - (tsd(a.creado) || 0)) };
    }));
    pintar();
  } catch (e) { console.error(e); $("ahArea").innerHTML = `<p class="ap-empty">No se pudo cargar (${esc(e.code || "error")}).</p>`; }
}

function estadoTag(sp) {
  if (sp.cancelado) return `<span class="ap-tag no">Cancelado</span>`;
  if (sp.estado === "finalizado") return `<span class="ap-tag">Finalizado</span>`;
  if (sp.pausado) return `<span class="ap-tag wa">En pausa</span>`;
  if (sp.estado === "activo") return `<span class="ap-tag ok">Activo</span>`;
  return `<span class="ap-tag wa">Pendiente de confirmar</span>`;
}

function pintar() {
  const vis = items.filter((i) => !i.sp.cancelado || true);
  if (!vis.length) { $("ahArea").innerHTML = `<div class="ap-card"><b>Aún no apadrinas a nadie.</b><p class="ap-mut">Cuando apadrines a un animal aparecerá aquí.</p><a class="ap-btn" href="apadrinar.html">Ver quién necesita padrino</a></div>`; return; }
  $("ahArea").innerHTML = vis.map(cardItem).join("");
}

function cardItem({ sp, pet, posts, pagos }) {
  const adoptado = pet && pet.status === "adopted";
  const wa = pet && pet.shelterWhatsapp ? urlWhatsApp(pet.shelterWhatsapp, `Hola${sp.shelterName ? ", " + sp.shelterName : ""}. Soy ${(userData.name || "").split(" ")[0] || "un padrino"}, apadrino a ${sp.petName} desde PetMatch. 🐾`) : "";
  const pend = pagos.some((x) => !x.confirmadoRefugio);
  return `<article class="ap-card" data-sid="${esc(sp.id)}">
    <div class="ap-row"><div class="ap-th" style="background-image:url('${esc(safeUrl((pet && pet.photoURL) || sp.petPhoto))}')" role="img" aria-label="Foto de ${esc(sp.petName)}"></div>
      <div style="flex:1;min-width:0"><h3 style="margin:0">${esc(sp.petName)}</h3><div class="ap-mut">${esc(sp.shelterName || "")}${pet && pet.shelterVerified ? " · ✓ Verificado" : ""}</div>
      <div style="margin-top:4px">${estadoTag(sp)}${alCorriente(posts) ? '<span class="ap-tag ok">Refugio al corriente</span>' : ""}</div></div></div>
    ${adoptado && !sp.cancelado ? `<div class="ap-alert"><b>¡${esc(sp.petName)} fue adoptado!</b> Gracias por acompañarlo. Elige qué quieres hacer con tu ayuda:<div class="ap-acts"><a class="ap-btn" href="apadrinar.html?refugio=${esc(sp.shelterId)}">Apadrinar a otro del mismo refugio</a><button class="ap-btn dan" data-a="cancelar" type="button">Detener mi ayuda</button></div></div>` : ""}
    <div style="margin-top:8px">
      <div class="ap-kv"><span>Tu aportación</span><b>${sp.frecuencia === "especie" ? "En especie" : fmt(sp.monto) + " " + (FREC[sp.frecuencia] || "")}</b></div>
      <div class="ap-kv"><span>Desde</span><b>${fecha(sp.createdAt)}</b></div>
      <div class="ap-kv"><span>Aportaciones</span><b>${pagos.filter((x) => x.confirmadoRefugio).length} confirmadas${pend ? " · " + pagos.filter((x) => !x.confirmadoRefugio).length + " por confirmar" : ""}</b></div>
    </div>
    ${pagos.length ? `<div class="ap-k">TUS APORTACIONES</div>${pagos.slice(0, 6).map((x) => `<div class="ap-kv"><span>${fecha(x.creado)} · ${fmt(x.monto)}</span><b>${x.confirmadoRefugio ? "✓ Confirmada por el refugio" : "Esperando al refugio"}</b></div>`).join("")}` : ""}
    <div class="ap-acts" id="ac-${esc(sp.id)}">
      ${!sp.cancelado && sp.estado !== "finalizado" ? `<button class="ap-btn" data-a="pago" type="button">Ya hice mi aportación</button>` : ""}
      ${wa ? `<a class="ap-btn wa" href="${esc(wa)}" target="_blank" rel="noopener">Escribir al refugio</a>` : ""}
      ${!sp.cancelado && sp.estado !== "finalizado" ? `<button class="ap-btn sec" data-a="pausar" type="button">${sp.pausado ? "Reanudar" : "Pausar"}</button><button class="ap-btn sec" data-a="monto" type="button">Cambiar monto</button><button class="ap-btn dan" data-a="cancelar" type="button">Cancelar</button>` : ""}
      ${sp.cancelado ? `<a class="ap-btn" href="apadrinar.html?pet=${esc(sp.petId)}">Volver a apadrinar</a>` : ""}
    </div>
    <div id="fm-${esc(sp.id)}"></div>
    <details style="margin-top:12px"><summary style="cursor:pointer;font-weight:700;min-height:44px;display:flex;align-items:center">Línea de vida de ${esc(sp.petName)}</summary>${lineaDeVida(posts)}</details>
  </article>`;
}

$("ahArea").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const card = b.closest("[data-sid]"), sid = card.dataset.sid, it = items.find((x) => x.sp.id === sid), sp = it.sp, a = b.dataset.a;
  const box = $("fm-" + sid);
  if (a === "pago" || a === "monto") {
    box.innerHTML = `<div class="ap-c" style="margin-top:10px"><label for="in-${esc(sid)}" style="font-weight:700;font-size:.85rem">${a === "pago" ? "¿Cuánto aportaste? (MXN)" : "Nuevo monto mensual (MXN)"}</label><input class="ap-in" id="in-${esc(sid)}" type="number" inputmode="numeric" min="1" value="${sp.monto || ""}"><div class="ap-acts"><button class="ap-btn" data-a="${a}-ok" type="button">${a === "pago" ? "Confirmar mi aportación" : "Guardar monto"}</button></div>${a === "pago" ? '<p class="ap-mut" style="margin:6px 0 0">El refugio también la confirmará cuando vea el depósito.</p>' : ""}</div>`;
    $("in-" + sid).focus(); return;
  }
  try {
    if (a === "pago-ok") {
      const monto = Math.round(Number($("in-" + sid).value) || 0); if (monto < 1) return aviso("Escribe el monto.", "err");
      b.disabled = true;
      await addDoc(collection(db, "sponsorPayments"), { sponsorshipId: sid, petId: sp.petId, petName: sp.petName, shelterId: sp.shelterId, sponsorId: user.uid, sponsorName: userData.name || "", monto, creado: serverTimestamp(), confirmadoRefugio: false });
      track && track("apadrinar_pago", { pet: sp.petId });
      aviso("Listo. Cuando el refugio confirme que recibió tu aportación, quedará registrada.");
    } else if (a === "monto-ok") {
      const monto = Math.round(Number($("in-" + sid).value) || 0); if (monto < 1) return aviso("Escribe el monto.", "err");
      await updateDoc(doc(db, "sponsorships", sid), { monto, updatedAt: serverTimestamp() }); aviso("Monto actualizado.");
    } else if (a === "pausar") {
      await updateDoc(doc(db, "sponsorships", sid), { pausado: !sp.pausado, updatedAt: serverTimestamp() }); aviso(sp.pausado ? "Apadrinamiento reanudado." : "Apadrinamiento en pausa.");
    } else if (a === "cancelar") {
      if (!confirm(`¿Cancelar tu apadrinamiento de ${sp.petName}? Puedes volver a apadrinar cuando quieras.`)) return;
      await updateDoc(doc(db, "sponsorships", sid), { cancelado: true, updatedAt: serverTimestamp() }); aviso("Apadrinamiento cancelado. Gracias por tu ayuda.");
    }
    await cargar();
  } catch (er) { console.error(er); aviso("No se pudo guardar (" + (er.code || "error") + ").", "err"); }
});
