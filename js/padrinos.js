// PetMatch — Apadrinamientos (lado del refugio)
import {
  auth, db, storage, onAuthStateChanged, doc, getDoc, updateDoc, collection, addDoc, getDocs, query, where,
  serverTimestamp, ref, uploadBytes, getDownloadURL, esc, safeUrl,
} from "./firebase-config.js";
import { comprimirImagen } from "./imagen.js";
import { fmt, FREC, fecha, tsd, activo, alCorriente } from "./apad-lib.js";

const $ = (id) => document.getElementById(id);
let uid = null, pets = [], sps = [], pagos = [], posts = [];

function aviso(t, tipo = "ok") { $("pdMsg").innerHTML = `<div class="${tipo === "ok" ? "ok-msg" : "error-msg"}">${esc(t)}</div>`; clearTimeout(aviso._t); aviso._t = setTimeout(() => ($("pdMsg").innerHTML = ""), 6000); }

onAuthStateChanged(auth, async (u) => {
  if (!u) { location.href = "auth.html?tab=login"; return; }
  uid = u.uid;
  const s = await getDoc(doc(db, "users", uid));
  if (!s.exists() || s.data().role !== "shelter") { location.href = "swipe.html"; return; }
  if (s.data().suspended) { location.href = "index.html"; return; }
  await cargar();
});

async function cargar() {
  try {
    const q = (c, f = "shelterId") => getDocs(query(collection(db, c), where(f, "==", uid)));
    const [a, b, c, d] = await Promise.all([q("pets"), q("sponsorships"), q("sponsorPayments"), q("sponsorPosts")]);
    pets = a.docs.map((x) => ({ id: x.id, ...x.data() }));
    sps = b.docs.map((x) => ({ id: x.id, ...x.data() }));
    pagos = c.docs.map((x) => ({ id: x.id, ...x.data() })).sort((x, y) => (tsd(y.creado) || 0) - (tsd(x.creado) || 0));
    posts = d.docs.map((x) => ({ id: x.id, ...x.data() }));
    await sincronizar();
    pintar();
  } catch (e) { console.error(e); $("pdArea").innerHTML = `<p class="ap-empty">No se pudo cargar (${esc(e.code || "error")}).</p>`; }
}

/** Mantiene en cada animal los totales públicos (meta cubierta y padrinos) a partir de los apadrinamientos confirmados. */
async function sincronizar() {
  for (const p of pets.filter((x) => x.apadrinable)) {
    const act = sps.filter((s) => s.petId === p.id && activo(s));
    const cubierto = act.filter((s) => s.frecuencia === "mensual").reduce((t, s) => t + (Number(s.monto) || 0), 0);
    if ((p.apadrinaCubierto || 0) !== cubierto || (p.apadrinaPadrinos || 0) !== act.length) {
      try { await updateDoc(doc(db, "pets", p.id), { apadrinaCubierto: cubierto, apadrinaPadrinos: act.length }); p.apadrinaCubierto = cubierto; p.apadrinaPadrinos = act.length; } catch (e) { console.warn(e); }
    }
  }
}

function pintar() {
  const apad = pets.filter((p) => p.apadrinable);
  const porConfirmar = pagos.filter((x) => !x.confirmadoRefugio);
  const nuevos = sps.filter((s) => s.estado === "pendiente" && !s.cancelado);
  const mensual = sps.filter(activo).filter((s) => s.frecuencia === "mensual").reduce((t, s) => t + (Number(s.monto) || 0), 0);
  $("pdArea").innerHTML = `
    <div class="sp-kpis"><div class="sp-kpi"><b>${apad.length}</b><span>animales con apadrinamiento</span></div>
      <div class="sp-kpi"><b>${sps.filter(activo).length}</b><span>padrinos activos</span></div>
      <div class="sp-kpi"><b>${fmt(mensual)}</b><span>ayuda mensual confirmada</span></div>
      <div class="sp-kpi ${porConfirmar.length ? "hot" : ""}"><b>${porConfirmar.length}</b><span>aportaciones por confirmar</span></div></div>
    ${!apad.length ? `<div class="ap-alert">Aún no tienes animales abiertos a apadrinamiento. En tu panel, edita un animal y activa <b>“Recibir apadrinamientos”</b>.</div>` : ""}
    <div class="ap-k">POR CONFIRMAR</div>
    ${porConfirmar.length ? porConfirmar.map((x) => `<div class="ap-card"><b>${esc(x.sponsorName || "Un padrino")}</b> dice que aportó <b>${fmt(x.monto)}</b> para <b>${esc(x.petName)}</b><div class="ap-mut">${fecha(x.creado)}</div>
      <div class="ap-acts"><button class="ap-btn" data-a="recibi" data-id="${esc(x.id)}" type="button">Sí, lo recibí</button></div><p class="ap-mut" style="margin:6px 0 0">Confirma solo si ya viste el depósito. Esta confirmación es la que da validez al apadrinamiento.</p></div>`).join("")
      : `<p class="ap-empty">No hay aportaciones pendientes.</p>`}
    ${nuevos.length ? `<div class="ap-k">PADRINOS NUEVOS (esperando su primera aportación)</div>${nuevos.map((s) => `<div class="ap-card"><b>${esc(s.sponsorName || "Un padrino")}</b> quiere apadrinar a <b>${esc(s.petName)}</b> ${s.frecuencia === "especie" ? "en especie" : "con " + fmt(s.monto) + " " + (FREC[s.frecuencia] || "")}<div class="ap-mut">Te escribirá por WhatsApp. Pásale los datos para depositar.</div></div>`).join("")}` : ""}
    <div class="ap-k">TUS APADRINADOS</div>
    ${apad.map(cardPet).join("") || ""}
    <div class="ap-k">PUBLICAR RECIBO O NOVEDAD</div>
    ${apad.length ? formPost(apad) : `<p class="ap-empty">Activa el apadrinamiento en algún animal para publicar.</p>`}`;
}

function cardPet(p) {
  const s = sps.filter((x) => x.petId === p.id && !x.cancelado);
  const corr = alCorriente(posts.filter((x) => x.petId === p.id));
  return `<div class="ap-card"><div class="ap-row"><div class="ap-th" style="background-image:url('${esc(safeUrl(p.photoURL))}')"></div>
    <div style="flex:1;min-width:0"><h3 style="margin:0">${esc(p.nombre)}</h3><div class="ap-mut">Meta ${fmt(p.apadrinaMeta)} · cubierto ${fmt(p.apadrinaCubierto)}</div>
    <span class="ap-tag ${corr ? "ok" : "wa"}">${corr ? "Refugio al corriente" : "Falta subir recibo o novedad"}</span></div></div>
    ${s.map((x) => `<div class="ap-kv"><span>${esc(x.sponsorName || "Padrino")} · ${x.frecuencia === "especie" ? "en especie" : fmt(x.monto) + " " + FREC[x.frecuencia]}</span><b>${x.pausado ? "En pausa" : x.estado === "activo" ? "Activo" : x.estado === "finalizado" ? "Finalizado" : "Pendiente"}</b></div>`).join("") || '<p class="ap-mut">Sin padrinos todavía.</p>'}
    ${p.status === "adopted" && s.some((x) => x.estado !== "finalizado") ? `<div class="ap-acts"><button class="ap-btn sec" data-a="finalizar" data-id="${esc(p.id)}" type="button">${esc(p.nombre)} fue adoptado: avisar a sus padrinos</button></div>` : ""}</div>`;
}

function formPost(apad) {
  return `<div class="ap-card">
    <label class="ap-mut" for="fpPet" style="font-weight:700">Animal</label><select class="ap-in" id="fpPet">${apad.map((p) => `<option value="${esc(p.id)}">${esc(p.nombre)}</option>`).join("")}</select>
    <label class="ap-mut" for="fpTipo" style="font-weight:700;display:block;margin-top:10px">Tipo</label><select class="ap-in" id="fpTipo"><option value="recibo">Recibo (compra con la ayuda)</option><option value="novedad">Novedad (cómo va)</option></select>
    <label class="ap-mut" for="fpCon" style="font-weight:700;display:block;margin-top:10px">Concepto (ej. Croquetas senior 20 kg)</label><input class="ap-in" id="fpCon">
    <label class="ap-mut" for="fpMonto" style="font-weight:700;display:block;margin-top:10px">Monto gastado (opcional)</label><input class="ap-in" id="fpMonto" type="number" inputmode="numeric" min="0">
    <label class="ap-mut" for="fpTxt" style="font-weight:700;display:block;margin-top:10px">Mensaje</label><textarea class="ap-in" id="fpTxt" rows="3" placeholder="Ej. Ya come mejor y subió medio kilo. ¡Gracias, padrinos!"></textarea>
    <label class="ap-mut" for="fpFoto" style="font-weight:700;display:block;margin-top:10px">Foto del recibo o del animal</label><input class="ap-in" id="fpFoto" type="file" accept="image/*">
    <div class="ap-acts"><button class="ap-btn" id="fpGo" data-a="publicar" type="button">Publicar</button></div></div>`;
}

$("pdArea").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const a = b.dataset.a; b.disabled = true;
  try {
    if (a === "recibi") {
      const x = pagos.find((p) => p.id === b.dataset.id);
      await updateDoc(doc(db, "sponsorPayments", x.id), { confirmadoRefugio: true, fechaRefugio: serverTimestamp() });
      const s = sps.find((q) => q.id === x.sponsorshipId);
      if (s && s.estado === "pendiente") await updateDoc(doc(db, "sponsorships", s.id), { estado: "activo", updatedAt: serverTimestamp() });
      aviso("Aportación confirmada. Ya se suma a la meta.");
    } else if (a === "finalizar") {
      for (const s of sps.filter((q) => q.petId === b.dataset.id && q.estado !== "finalizado")) await updateDoc(doc(db, "sponsorships", s.id), { estado: "finalizado", updatedAt: serverTimestamp() });
      aviso("Listo: sus padrinos podrán elegir apadrinar a otro de tu refugio.");
    } else if (a === "publicar") {
      const petId = $("fpPet").value, p = pets.find((x) => x.id === petId);
      const texto = $("fpTxt").value.trim(), concepto = $("fpCon").value.trim(), monto = Math.round(Number($("fpMonto").value) || 0), f = $("fpFoto").files[0];
      if (!texto && !concepto && !f) { aviso("Agrega un concepto, un mensaje o una foto.", "err"); b.disabled = false; return; }
      let fotoURL = "";
      if (f) { const blob = await comprimirImagen(f); const r = ref(storage, `pets/${uid}/${Date.now()}_${(blob.name || "foto.jpg").replace(/[^\w.\-]/g, "_")}`); await uploadBytes(r, blob); fotoURL = await getDownloadURL(r); }
      await addDoc(collection(db, "sponsorPosts"), { petId, petName: p.nombre, shelterId: uid, tipo: $("fpTipo").value, concepto, monto, texto, fotoURL, createdAt: serverTimestamp() });
      aviso("Publicado en la línea de vida de " + p.nombre + ".");
    }
    await cargar();
  } catch (er) { console.error(er); aviso("No se pudo guardar (" + (er.code || "error") + ").", "err"); b.disabled = false; }
});
