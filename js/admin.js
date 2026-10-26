// PetMatch — Panel de administración (fase 1)
import {
  auth, db, storage, onAuthStateChanged, signOut,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs, query, where, serverTimestamp,
  ref, uploadBytes, getDownloadURL, esc, safeUrl,
} from "./firebase-config.js";
import { comprimirImagen } from "./imagen.js";
import { ESTADOS, geocodificar } from "./geo.js";

const $ = (id) => document.getElementById(id);
let adminUser = null;
const D = { users: [], profiles: {}, pets: [], swipes: [], log: [] };

/* ---------- utilidades ---------- */
const ts = (t) => (t && t.toDate ? t.toDate() : t ? new Date(t) : null);
const fecha = (t) => { const d = ts(t); return d && !isNaN(d) ? d.toLocaleString("es-MX", { dateStyle: "medium", timeStyle: "short" }) : "—"; };
function msg(texto, tipo = "ok") {
  $("adMsg").innerHTML = `<div class="${tipo === "ok" ? "ok-msg" : "error-msg"}">${esc(texto)}</div>`;
  clearTimeout(msg._t); msg._t = setTimeout(() => ($("adMsg").innerHTML = ""), 6000);
}
async function bitacora(accion, tipo, id, detalle = "") {
  try {
    const e = { adminId: adminUser.uid, adminEmail: adminUser.email || "", accion, tipo, objetivo: id, detalle, timestamp: serverTimestamp() };
    await addDoc(collection(db, "adminLog"), e);
    D.log.unshift({ ...e, timestamp: new Date() });
  } catch (e) { console.warn("bitácora", e); }
}
const shelters = () => D.users.filter((u) => u.role === "shelter");
const adopters = () => D.users.filter((u) => u.role !== "shelter");
const userById = (id) => D.users.find((u) => u.id === id);
const petsOf = (sid) => D.pets.filter((p) => p.shelterId === sid);
const st = (p) => p.status || "available";

/* ---------- acceso ---------- */
$("btnLogout").onclick = () => signOut(auth).then(() => (location.href = "index.html"));
$("btnRefrescar").onclick = () => cargar(true);
onAuthStateChanged(auth, async (user) => {
  if (!user) { location.href = "auth.html?tab=login"; return; }
  adminUser = user;
  try {
    const a = await getDoc(doc(db, "admins", user.uid));
    if (!a.exists()) throw new Error("no-admin");
  } catch (e) {
    $("adGate").innerHTML = `<h2>Sin acceso</h2><p class="sub">Esta cuenta (${esc(user.email || user.uid)}) no es administradora.</p><p class="sub">Tu UID: <code>${esc(user.uid)}</code></p><p><a class="ad-btn" href="index.html">Volver al inicio</a></p>`;
    return;
  }
  $("adGate").hidden = true; $("adApp").hidden = false;
  await cargar();
});

async function cargar(aviso) {
  try {
    const [u, p, pets, sw, lg] = await Promise.all([
      getDocs(collection(db, "users")), getDocs(collection(db, "adopterProfiles")),
      getDocs(collection(db, "pets")), getDocs(collection(db, "swipes")),
      getDocs(collection(db, "adminLog")).catch(() => ({ docs: [] })),
    ]);
    D.users = u.docs.map((d) => ({ id: d.id, ...d.data() }));
    D.profiles = {}; p.docs.forEach((d) => (D.profiles[d.id] = d.data()));
    D.pets = pets.docs.map((d) => ({ id: d.id, ...d.data() }));
    D.swipes = sw.docs.map((d) => ({ id: d.id, ...d.data() }));
    D.log = lg.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (ts(b.timestamp) || 0) - (ts(a.timestamp) || 0));
    pintar();
    if (aviso) msg("Datos actualizados.");
  } catch (e) {
    console.error(e);
    msg("No se pudieron leer los datos. ¿Publicaste las reglas de Firestore y creaste tu documento admins/" + adminUser.uid + "? (" + e.code + ")", "err");
  }
}

/* ---------- pestañas ---------- */
let tabActual = "resumen";
$("adTabs").addEventListener("click", (e) => {
  const b = e.target.closest("[data-tab]"); if (!b) return;
  tabActual = b.dataset.tab;
  document.querySelectorAll("#adTabs .sp-tab").forEach((x) => x.classList.toggle("active", x === b));
  ["resumen", "refugios", "animales", "adoptantes", "bitacora"].forEach((t) => ($("tab-" + t).hidden = t !== tabActual));
  pintar();
});
function pintar() {
  ({ resumen: pResumen, refugios: pRefugios, animales: pAnimales, adoptantes: pAdoptantes, bitacora: pBitacora })[tabActual]();
}

/* ---------- RESUMEN ---------- */
function pResumen() {
  const sh = shelters(), ad = adopters();
  const ver = sh.filter((s) => s.verified).length;
  const disp = D.pets.filter((p) => st(p) === "available").length;
  const adop = D.pets.filter((p) => st(p) === "adopted").length;
  const hid = D.pets.filter((p) => st(p) === "hidden").length;
  const likes = D.swipes.filter((s) => s.liked).length;
  const sem = Date.now() - 7 * 864e5;
  const nuevos = D.users.filter((u) => { const d = ts(u.createdAt); return d && d.getTime() > sem; }).length;
  const sinFoto = D.pets.filter((p) => !p.photoURL && st(p) !== "adopted");
  const sinUbic = D.pets.filter((p) => !p.estado && st(p) !== "adopted");
  const sinWa = sh.filter((s) => !s.whatsapp);
  const pend = sh.filter((s) => !s.verified);
  const k = (n, t) => `<div class="sp-kpi"><b>${n}</b><span>${t}</span></div>`;
  const lista = (tit, arr, fn) => arr.length ? `<div class="ad-todo"><b>${tit} (${arr.length})</b><ul>${arr.slice(0, 8).map(fn).join("")}${arr.length > 8 ? `<li>…y ${arr.length - 8} más</li>` : ""}</ul></div>` : "";
  $("tab-resumen").innerHTML = `
    <div class="sp-kpis">${k(D.users.length, "usuarios")}${k(ad.length, "adoptantes")}${k(sh.length, `refugios (${ver} verificados)`)}${k(disp, "animales disponibles")}${k(adop, "adoptados")}${k(hid, "ocultos")}${k(likes, "“Me interesa”")}${k(D.swipes.length - likes, "pasados")}${k(nuevos, "registros 7 días")}</div>
    ${lista("Refugios por verificar", pend, (s) => `<li>${esc(s.shelterName || s.name || s.email)} — <button class="ad-btn" data-go="refugios">revisar</button></li>`)}
    ${lista("Refugios sin WhatsApp", sinWa, (s) => `<li>${esc(s.shelterName || s.name || s.email)}</li>`)}
    ${lista("Animales sin foto", sinFoto, (p) => `<li>${esc(p.nombre)} · ${esc(p.shelterName || "")} — <button class="ad-btn" data-edit="${esc(p.id)}">subir foto</button></li>`)}
    ${lista("Animales sin estado/ubicación", sinUbic, (p) => `<li>${esc(p.nombre)} · ${esc(p.shelterName || "")} — <button class="ad-btn" data-edit="${esc(p.id)}">editar</button></li>`)}
    <p class="ad-sub">Visitas y tráfico: consúltalas en Google Analytics (analytics.google.com).</p>`;
}
$("tab-resumen").addEventListener("click", (e) => {
  const g = e.target.closest("[data-go]"); if (g) document.querySelector(`[data-tab="${g.dataset.go}"]`).click();
  const ed = e.target.closest("[data-edit]"); if (ed) editarAnimal(ed.dataset.edit);
});

/* ---------- REFUGIOS ---------- */
let fRef = "";
function pRefugios() {
  const q = fRef.toLowerCase();
  const arr = shelters().filter((s) => !q || [s.shelterName, s.name, s.email, s.city].join(" ").toLowerCase().includes(q));
  $("tab-refugios").innerHTML = `
    <div class="ad-tools"><input id="qRef" type="search" placeholder="Buscar refugio, correo, ciudad" value="${esc(fRef)}" aria-label="Buscar refugios"></div>
    ${arr.length ? arr.map(cardRefugio).join("") : '<p class="ad-empty">No hay refugios.</p>'}`;
  $("qRef").oninput = (e) => { fRef = e.target.value; const p = e.target.selectionStart; pRefugios(); $("qRef").focus(); $("qRef").setSelectionRange(p, p); };
}
function cardRefugio(s) {
  const n = petsOf(s.id).length;
  const wa = s.whatsapp ? `<span class="ad-badge ok">WhatsApp ✓</span>` : `<span class="ad-badge wa">Sin WhatsApp</span>`;
  return `<div class="ad-card" data-sid="${esc(s.id)}">
    <h4>${esc(s.shelterName || s.name || "Refugio sin nombre")}</h4>
    <div>${s.verified ? '<span class="ad-badge ok">Verificado</span>' : '<span class="ad-badge wa">Por verificar</span>'}${wa}${s.suspended ? '<span class="ad-badge no">Suspendido</span>' : ""}<span class="ad-badge gr">${n} animales</span></div>
    <div class="ad-sub">${esc(s.email || "")} · ${esc([s.city, s.estado].filter(Boolean).join(", "))} · Registro: ${fecha(s.createdAt)}${s.whatsapp ? " · +" + esc(s.whatsapp) : ""}</div>
    <div class="ad-acts">
      <button class="ad-btn ${s.verified ? "" : "ok"}" data-a="ver">${s.verified ? "Quitar verificación" : "✓ Verificar"}</button>
      <button class="ad-btn" data-a="animales">Ver animales</button>
      <button class="ad-btn" data-a="nuevo">+ Subir animal</button>
      <button class="ad-btn" data-a="datos">Editar datos</button>
      <button class="ad-btn dan" data-a="susp">${s.suspended ? "Reactivar" : "Suspender"}</button>
      <button class="ad-btn dan" data-a="borrar">Eliminar datos</button>
    </div></div>`;
}
$("tab-refugios").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const sid = b.closest("[data-sid]").dataset.sid, s = userById(sid), a = b.dataset.a;
  if (a === "ver") {
    const v = !s.verified; b.disabled = true;
    try {
      await updateDoc(doc(db, "users", sid), { verified: v });
      await Promise.all(petsOf(sid).map((p) => updateDoc(doc(db, "pets", p.id), { shelterVerified: v })));
      s.verified = v; petsOf(sid).forEach((p) => (p.shelterVerified = v));
      await bitacora(v ? "verificar_refugio" : "quitar_verificacion", "refugio", sid, s.shelterName || s.email);
      msg(v ? "Refugio verificado." : "Verificación retirada.");
    } catch (er) { msg("Error: " + er.code, "err"); }
    pRefugios();
  }
  if (a === "animales") { fAnim.shelter = sid; document.querySelector('[data-tab="animales"]').click(); }
  if (a === "nuevo") editarAnimal(null, sid);
  if (a === "datos") editarUsuario(sid);
  if (a === "susp") await suspender(sid, pRefugios);
  if (a === "borrar") borrarUsuario(sid, pRefugios);
});

async function suspender(id, repintar) {
  const u = userById(id), v = !u.suspended;
  if (v && !confirm(`¿Suspender a ${u.shelterName || u.name || u.email}? No podrá publicar ni dar “Me interesa” hasta reactivarlo.`)) return;
  try {
    await updateDoc(doc(db, "users", id), { suspended: v });
    u.suspended = v;
    await bitacora(v ? "suspender" : "reactivar", u.role === "shelter" ? "refugio" : "adoptante", id, u.email || "");
    msg(v ? "Usuario suspendido." : "Usuario reactivado.");
  } catch (er) { msg("Error: " + er.code, "err"); }
  repintar();
}

function borrarUsuario(id, repintar) {
  const u = userById(id), esRef = u.role === "shelter";
  const nombre = u.shelterName || u.name || u.email || id;
  const pets = esRef ? petsOf(id) : [];
  const sw = D.swipes.filter((s) => s.adopterId === id || s.shelterId === id);
  abrir(`Eliminar datos de ${nombre}`, `
    <p>Se borrará de Firestore: ficha de usuario${esRef ? `, <b>${pets.length} animales</b>` : ", perfil del test"} y <b>${sw.length} registros</b> de likes/pasos.</p>
    <p class="ad-sub"><b>Importante:</b> la cuenta de acceso (Authentication) <u>no</u> se puede borrar desde aquí. Después elimínala a mano en Firebase Console → Authentication → Users (${esc(u.email || id)}).</p>
    <label for="cfBorrar">Escribe <b>ELIMINAR</b> para confirmar</label>
    <input id="cfBorrar" autocomplete="off">
    <div class="ad-acts"><button class="ad-btn dan" id="okBorrar" disabled>Eliminar definitivamente</button><button class="ad-btn" id="noBorrar">Cancelar</button></div>`);
  $("cfBorrar").oninput = (e) => ($("okBorrar").disabled = e.target.value.trim() !== "ELIMINAR");
  $("noBorrar").onclick = cerrar;
  $("okBorrar").onclick = async () => {
    $("okBorrar").disabled = true; $("okBorrar").textContent = "Eliminando…";
    try {
      for (const s of sw) await deleteDoc(doc(db, "swipes", s.id));
      for (const p of pets) await deleteDoc(doc(db, "pets", p.id));
      await deleteDoc(doc(db, "adopterProfiles", id)).catch(() => {});
      await deleteDoc(doc(db, "users", id));
      D.swipes = D.swipes.filter((s) => !sw.includes(s));
      D.pets = D.pets.filter((p) => !pets.includes(p));
      D.users = D.users.filter((x) => x.id !== id); delete D.profiles[id];
      await bitacora("eliminar_datos", esRef ? "refugio" : "adoptante", id, `${nombre} (${u.email || ""}) · ${pets.length} animales · ${sw.length} registros`);
      cerrar(); msg("Datos eliminados. Falta borrar la cuenta en Authentication (consola de Firebase).");
    } catch (er) { msg("Error al eliminar: " + er.code, "err"); cerrar(); }
    repintar();
  };
}

function editarUsuario(id) {
  const u = userById(id), esRef = u.role === "shelter";
  abrir("Editar datos", `
    ${esRef ? `<label for="eNom">Nombre del refugio</label><input id="eNom" value="${esc(u.shelterName || "")}">` : `<label for="eNom">Nombre</label><input id="eNom" value="${esc(u.name || "")}">`}
    <div class="ad-2"><div><label for="eCity">Ciudad</label><input id="eCity" value="${esc(u.city || "")}"></div>
    <div><label for="eEst">Estado</label><select id="eEst"><option value="">—</option>${ESTADOS.map((e) => e.n).map((k) => `<option ${u.estado === k ? "selected" : ""}>${esc(k)}</option>`).join("")}</select></div></div>
    ${esRef ? `<label for="eWa">WhatsApp (solo dígitos, con lada de país, ej. 527771234567)</label><input id="eWa" inputmode="numeric" value="${esc(u.whatsapp || "")}">` : ""}
    <div class="ad-acts"><button class="ad-btn pri" id="gU">Guardar</button><button class="ad-btn" id="cU">Cancelar</button></div>`);
  $("cU").onclick = cerrar;
  $("gU").onclick = async () => {
    const d = { city: $("eCity").value.trim(), estado: $("eEst").value };
    if (esRef) { d.shelterName = $("eNom").value.trim(); d.whatsapp = $("eWa").value.replace(/\D/g, ""); } else d.name = $("eNom").value.trim();
    try {
      await updateDoc(doc(db, "users", id), d); Object.assign(u, d);
      if (esRef) await Promise.all(petsOf(id).map((p) => { const x = { shelterName: d.shelterName, shelterWhatsapp: d.whatsapp }; Object.assign(p, x); return updateDoc(doc(db, "pets", p.id), x); }));
      await bitacora("editar_usuario", esRef ? "refugio" : "adoptante", id, Object.keys(d).join(","));
      cerrar(); msg("Datos guardados."); pintar();
    } catch (er) { msg("Error: " + er.code, "err"); }
  };
}

/* ---------- ANIMALES ---------- */
const fAnim = { q: "", shelter: "", status: "" };
function pAnimales() {
  const q = fAnim.q.toLowerCase();
  const arr = D.pets.filter((p) => (!fAnim.shelter || p.shelterId === fAnim.shelter) && (!fAnim.status || st(p) === fAnim.status) &&
    (!q || [p.nombre, p.raza, p.especie, p.shelterName, p.city].join(" ").toLowerCase().includes(q)));
  $("tab-animales").innerHTML = `
    <div class="ad-tools">
      <input id="qAn" type="search" placeholder="Buscar animal, raza, refugio" value="${esc(fAnim.q)}" aria-label="Buscar animales">
      <select id="sAn" aria-label="Refugio"><option value="">Todos los refugios</option>${shelters().map((s) => `<option value="${esc(s.id)}" ${fAnim.shelter === s.id ? "selected" : ""}>${esc(s.shelterName || s.email)}</option>`).join("")}</select>
      <select id="stAn" aria-label="Estatus">${[["", "Todos"], ["available", "Disponibles"], ["adopted", "Adoptados"], ["hidden", "Ocultos"]].map(([v, t]) => `<option value="${v}" ${fAnim.status === v ? "selected" : ""}>${t}</option>`).join("")}</select>
      <button class="ad-btn pri" id="nvAn">+ Nuevo animal</button>
    </div>
    <p class="ad-sub">${arr.length} animales</p>
    <div class="ad-grid">${arr.map(cardAnimal).join("") || '<p class="ad-empty">Sin resultados.</p>'}</div>`;
  $("qAn").oninput = (e) => { fAnim.q = e.target.value; const p = e.target.selectionStart; pAnimales(); $("qAn").focus(); $("qAn").setSelectionRange(p, p); };
  $("sAn").onchange = (e) => { fAnim.shelter = e.target.value; pAnimales(); };
  $("stAn").onchange = (e) => { fAnim.status = e.target.value; pAnimales(); };
  $("nvAn").onclick = () => editarAnimal(null, fAnim.shelter || "");
}
function cardAnimal(p) {
  const s = st(p), n = D.swipes.filter((x) => x.petId === p.id && x.liked).length;
  const badge = s === "adopted" ? '<span class="ad-badge gr">Adoptado</span>' : s === "hidden" ? '<span class="ad-badge no">Oculto</span>' : '<span class="ad-badge ok">Disponible</span>';
  return `<div class="ad-card" data-pid="${esc(p.id)}"><div class="ad-row">
    <div class="ad-thumb" style="background-image:url('${esc(safeUrl(p.photoURL))}')" role="img" aria-label="Foto de ${esc(p.nombre)}"></div>
    <div class="grow"><h4>${esc(p.nombre || "Sin nombre")}</h4>${badge}${p.photoURL ? "" : '<span class="ad-badge wa">Sin foto</span>'}
    <div class="ad-sub">${esc(p.especie || "")} · ${esc(p.raza || "")} · ${esc(p.shelterName || "")}<br>${esc([p.municipio || p.city, p.estado].filter(Boolean).join(", "))} · ♥ ${n}</div></div></div>
    <div class="ad-acts"><button class="ad-btn" data-a="edit">Editar / foto</button>
    <button class="ad-btn" data-a="likes">Interesados</button>
    <button class="ad-btn" data-a="${s === "adopted" ? "disp" : "adop"}">${s === "adopted" ? "Marcar disponible" : "Marcar adoptado"}</button>
    <button class="ad-btn" data-a="${s === "hidden" ? "disp" : "hide"}">${s === "hidden" ? "Mostrar" : "Ocultar"}</button>
    <button class="ad-btn dan" data-a="del">Eliminar</button></div></div>`;
}
$("tab-animales").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const id = b.closest("[data-pid]").dataset.pid, p = D.pets.find((x) => x.id === id), a = b.dataset.a;
  if (a === "edit") return editarAnimal(id);
  if (a === "likes") return verInteresados(id);
  if (a === "del") {
    if (!confirm(`¿Eliminar a ${p.nombre} definitivamente? También se borrarán sus “Me interesa”.`)) return;
    try {
      for (const s of D.swipes.filter((x) => x.petId === id)) await deleteDoc(doc(db, "swipes", s.id));
      await deleteDoc(doc(db, "pets", id));
      D.swipes = D.swipes.filter((x) => x.petId !== id); D.pets = D.pets.filter((x) => x.id !== id);
      await bitacora("eliminar_animal", "animal", id, `${p.nombre} · ${p.shelterName || ""}`); msg("Animal eliminado.");
    } catch (er) { msg("Error: " + er.code, "err"); }
    return pAnimales();
  }
  const nuevo = { adop: "adopted", disp: "available", hide: "hidden" }[a];
  try {
    await updateDoc(doc(db, "pets", id), { status: nuevo, updatedAt: serverTimestamp() }); p.status = nuevo;
    await bitacora("estatus_animal", "animal", id, `${p.nombre} → ${nuevo}`); msg("Estatus actualizado.");
  } catch (er) { msg("Error: " + er.code, "err"); }
  pAnimales();
});

function verInteresados(petId) {
  const p = D.pets.find((x) => x.id === petId);
  const l = D.swipes.filter((s) => s.petId === petId && s.liked);
  abrir(`Interesados en ${p.nombre}`, l.length ? l.map((s) => {
    const u = userById(s.adopterId), a = s.adopter || {};
    return `<div class="ad-log"><b>${esc(a.name || (u && u.name) || "Adoptante")}</b> · ${esc((u && u.email) || a.email || "")}<br><span class="ad-sub">${fecha(s.timestamp)} · compatibilidad ${s.matchScore ?? "—"}%</span></div>`;
  }).join("") : '<p class="ad-empty">Todavía nadie.</p>');
}

function editarAnimal(id, shelterId = "") {
  const nuevo = !id, p = nuevo ? { status: "available", shelterId } : D.pets.find((x) => x.id === id);
  const opt = (arr, v) => `<option value="">—</option>` + arr.map(([val, t]) => `<option value="${val}" ${String(v) === val ? "selected" : ""}>${esc(t)}</option>`).join("");
  const f = (k) => esc(p[k] ?? "");
  let archivo = null;
  abrir(nuevo ? "Nuevo animal" : `Editar a ${p.nombre}`, `
    <label for="pSh">Refugio</label>
    <select id="pSh" ${nuevo ? "" : "disabled"}><option value="">— elegir —</option>${shelters().map((s) => `<option value="${esc(s.id)}" ${p.shelterId === s.id ? "selected" : ""}>${esc(s.shelterName || s.email)}</option>`).join("")}</select>
    <div class="ad-2"><div><label for="pNom">Nombre</label><input id="pNom" value="${f("nombre")}"></div>
    <div><label for="pEsp">Especie</label><select id="pEsp">${opt([["perro","Perro"],["gato","Gato"]], p.especie)}</select></div></div>
    <div class="ad-2"><div><label for="pRaza">Raza</label><input id="pRaza" value="${f("raza")}"></div>
    <div><label for="pEdad">Edad</label><input id="pEdad" value="${f("edad")}"></div></div>
    <div class="ad-2"><div><label for="pTam">Tamaño</label><select id="pTam">${opt([["pequeno","Pequeño"],["mediano","Mediano"],["grande","Grande"]], p.tamano)}</select></div>
    <div><label for="pEne">Energía</label><select id="pEne">${opt([["bajo","Tranquilo"],["medio","Activo"],["alto","Muy activo"]], p.energia)}</select></div></div>
    <div class="ad-2"><div><label for="pDif">Nivel de cuidado</label><select id="pDif">${opt([["facil","Fácil"],["moderado","Moderado"],["dificil","Necesita experiencia"]], p.nivelDificultad)}</select></div>
    <div><label for="pSt">Estatus</label><select id="pSt"><option value="available" ${st(p) === "available" ? "selected" : ""}>Disponible</option><option value="adopted" ${st(p) === "adopted" ? "selected" : ""}>Adoptado</option><option value="hidden" ${st(p) === "hidden" ? "selected" : ""}>Oculto</option></select></div></div>
    <div class="ad-2"><div><label for="pNi">Bueno con niños</label><select id="pNi">${opt([["true","Sí"],["false","No / No probado"]], p.buenoConNinos)}</select></div>
    <div><label for="pOt">Con otras mascotas</label><select id="pOt">${opt([["true","Sí"],["false","No / No probado"]], p.buenoConOtrasMascotas)}</select></div></div>
    <div class="ad-2"><div><label for="pEs">Estado</label><select id="pEs"><option value="">—</option>${ESTADOS.map((e) => e.n).map((k) => `<option ${p.estado === k ? "selected" : ""}>${esc(k)}</option>`).join("")}</select></div>
    <div><label for="pMu">Municipio / ciudad</label><input id="pMu" value="${esc(p.municipio || p.city || "")}"></div></div>
    <label for="pDes">Descripción</label><textarea id="pDes">${f("descripcion")}</textarea>
    <label for="pFoto">Foto (se comprime sola)</label><input id="pFoto" type="file" accept="image/*">
    <img class="ad-prev" id="pPrev" alt="Vista previa" ${p.photoURL ? `src="${esc(safeUrl(p.photoURL))}"` : "hidden"}>
    <div class="ad-acts"><button class="ad-btn pri" id="gP">Guardar</button><button class="ad-btn" id="cP">Cancelar</button></div>`);
  $("cP").onclick = cerrar;
  $("pFoto").onchange = (e) => { archivo = e.target.files[0]; if (archivo) { $("pPrev").src = URL.createObjectURL(archivo); $("pPrev").hidden = false; } };
  $("gP").onclick = async () => {
    const sid = nuevo ? $("pSh").value : p.shelterId;
    if (!sid) return msg("Elige un refugio.", "err");
    if (!$("pNom").value.trim()) return msg("Falta el nombre.", "err");
    const s = userById(sid);
    $("gP").disabled = true; $("gP").textContent = "Guardando…";
    try {
      let photoURL = p.photoURL || "";
      if (archivo) {
        const blob = await comprimirImagen(archivo);
        const r = ref(storage, `pets/${sid}/${Date.now()}_${(blob.name || "foto.jpg").replace(/[^\w.\-]/g, "_")}`);
        await uploadBytes(r, blob); photoURL = await getDownloadURL(r);
      }
      const mu = $("pMu").value.trim(), es = $("pEs").value;
      const city = !es || mu.toLowerCase().includes(es.toLowerCase()) ? mu : `${mu}, ${es}`;
      let geo = null; if (mu && es) { try { geo = await geocodificar(mu, es); } catch (_) {} }
      const d = {
        shelterId: sid, shelterName: (s && (s.shelterName || s.name)) || "", shelterVerified: !!(s && s.verified), shelterWhatsapp: (s && s.whatsapp) || "",
        nombre: $("pNom").value.trim(), especie: $("pEsp").value, raza: $("pRaza").value.trim(), edad: $("pEdad").value.trim(),
        tamano: $("pTam").value, energia: $("pEne").value, nivelDificultad: $("pDif").value,
        buenoConNinos: $("pNi").value === "" ? null : $("pNi").value === "true", buenoConOtrasMascotas: $("pOt").value === "" ? null : $("pOt").value === "true", descripcion: $("pDes").value.trim(),
        estado: es, municipio: mu, city, photoURL, status: $("pSt").value, updatedAt: serverTimestamp(),
      };
      if (geo) { d.lat = geo.lat; d.lng = geo.lng; }
      if (nuevo) { d.createdAt = serverTimestamp(); const r = await addDoc(collection(db, "pets"), d); D.pets.push({ id: r.id, ...d }); await bitacora("crear_animal", "animal", r.id, `${d.nombre} · ${d.shelterName}`); }
      else { await updateDoc(doc(db, "pets", id), d); Object.assign(p, d); await bitacora("editar_animal", "animal", id, `${d.nombre}${archivo ? " (foto nueva)" : ""}`); }
      cerrar(); msg("Animal guardado."); pintar();
    } catch (er) { console.error(er); msg("Error al guardar: " + (er.code || er.message), "err"); $("gP").disabled = false; $("gP").textContent = "Guardar"; }
  };
}

/* ---------- ADOPTANTES ---------- */
let fAd = "";
function pAdoptantes() {
  const q = fAd.toLowerCase();
  const arr = adopters().filter((u) => !q || [u.name, u.email, u.city].join(" ").toLowerCase().includes(q));
  $("tab-adoptantes").innerHTML = `
    <div class="ad-tools"><input id="qAd" type="search" placeholder="Buscar nombre, correo, ciudad" value="${esc(fAd)}" aria-label="Buscar adoptantes"></div>
    <p class="ad-sub">${arr.length} adoptantes</p>
    ${arr.map((u) => {
      const likes = D.swipes.filter((s) => s.adopterId === u.id && s.liked).length;
      return `<div class="ad-card" data-uid="${esc(u.id)}"><h4>${esc(u.name || "Sin nombre")}</h4>
      <div>${D.profiles[u.id] ? '<span class="ad-badge ok">Test hecho</span>' : '<span class="ad-badge gr">Sin test</span>'}${u.suspended ? '<span class="ad-badge no">Suspendido</span>' : ""}<span class="ad-badge gr">♥ ${likes}</span></div>
      <div class="ad-sub">${esc(u.email || "")} · ${esc(u.city || "")} · Registro: ${fecha(u.createdAt)}</div>
      <div class="ad-acts"><button class="ad-btn" data-a="ver">Ver perfil</button><button class="ad-btn dan" data-a="susp">${u.suspended ? "Reactivar" : "Suspender"}</button><button class="ad-btn dan" data-a="borrar">Eliminar datos</button></div></div>`;
    }).join("") || '<p class="ad-empty">Sin adoptantes.</p>'}`;
  $("qAd").oninput = (e) => { fAd = e.target.value; const p = e.target.selectionStart; pAdoptantes(); $("qAd").focus(); $("qAd").setSelectionRange(p, p); };
}
$("tab-adoptantes").addEventListener("click", async (e) => {
  const b = e.target.closest("[data-a]"); if (!b) return;
  const id = b.closest("[data-uid]").dataset.uid, a = b.dataset.a;
  if (a === "susp") await suspender(id, pAdoptantes);
  if (a === "borrar") borrarUsuario(id, pAdoptantes);
  if (a === "ver") {
    const u = userById(id), pr = D.profiles[id] || {};
    const ls = D.swipes.filter((s) => s.adopterId === id && s.liked);
    const skip = ["updatedAt", "createdAt"];
    abrir(u.name || "Adoptante", `
      <dl class="ad-kv"><dt>Correo</dt><dd>${esc(u.email || "")}</dd><dt>Ciudad</dt><dd>${esc(u.city || "")}</dd><dt>Registro</dt><dd>${fecha(u.createdAt)}</dd>
      ${Object.entries(pr).filter(([k, v]) => !skip.includes(k) && typeof v !== "object").map(([k, v]) => `<dt>${esc(k)}</dt><dd>${esc(String(v))}</dd>`).join("")}</dl>
      <h3>Le interesaron (${ls.length})</h3>${ls.map((s) => `<div class="ad-log">${esc(s.petName || s.petId)} · ${fecha(s.timestamp)}</div>`).join("") || '<p class="ad-empty">Ninguno.</p>'}`);
  }
});

/* ---------- BITÁCORA ---------- */
function pBitacora() {
  $("tab-bitacora").innerHTML = D.log.length ? D.log.slice(0, 200).map((l) =>
    `<div class="ad-log"><b>${esc(l.accion)}</b> · ${esc(l.tipo)} <span class="ad-sub">${esc(l.detalle || l.objetivo)}</span><br><span class="ad-sub">${fecha(l.timestamp)} · ${esc(l.adminEmail || "")}</span></div>`).join("")
    : '<p class="ad-empty">Aún no hay acciones registradas.</p>';
}

/* ---------- ventana ---------- */
let focoPrev = null;
function abrir(titulo, html) {
  focoPrev = document.activeElement;
  $("adModalTitle").textContent = titulo; $("adModalBody").innerHTML = html;
  $("adModal").hidden = false; document.body.style.overflow = "hidden"; $("adModalX").focus();
}
function cerrar() { $("adModal").hidden = true; document.body.style.overflow = ""; if (focoPrev && focoPrev.focus) focoPrev.focus(); }
$("adModalX").onclick = cerrar;
$("adModal").addEventListener("click", (e) => { if (e.target === $("adModal")) cerrar(); });
document.addEventListener("keydown", (e) => { if (e.key === "Escape" && !$("adModal").hidden) cerrar(); });
