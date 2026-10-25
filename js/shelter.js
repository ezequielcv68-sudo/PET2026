import {
  auth, db, storage, onAuthStateChanged, signOut,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs, query, where, serverTimestamp,
  ref, uploadBytes, getDownloadURL,
} from "./firebase-config.js";
import { abrirTarjeta } from "./sharecard.js";
import { comprimirImagen } from "./imagen.js";
import { ESTADOS, inferirEstado, normalizarEstado, geocodificar } from "./geo.js";
import { normalizarWhatsApp, urlWhatsApp, mensajeAlAdoptante } from "./whatsapp.js";

let uid = null;
let shelterName = "";
let shelterWhatsapp = "";
let shelterCity = "";
let shelterEstado = "";
let shelterVerified = false;
let selectedFile = null;
let editingPetId = null;

const petsArea = document.getElementById("petsArea");
document.getElementById("btnLogout").onclick = () => signOut(auth).then(() => window.location.href = "index.html");

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "auth.html?tab=login"; return; }
  uid = user.uid;

  const userSnap = await getDoc(doc(db, "users", uid));
  if (!userSnap.exists() || userSnap.data().role !== "shelter") {
    window.location.href = "onboarding.html";
    return;
  }
  shelterName = userSnap.data().shelterName || userSnap.data().name || "Refugio";
  shelterCity = userSnap.data().city || "";
  shelterWhatsapp = normalizarWhatsApp(userSnap.data().whatsapp);
  shelterEstado = normalizarEstado(userSnap.data().estado) || inferirEstado(shelterCity);
  llenarEstados();
  shelterVerified = userSnap.data().verified === true;
  document.getElementById("shelterNameTag").innerHTML = `${escapeHtml(shelterName)} · ${shelterVerified ? '<span class="ok">✓ Verificado</span>' : '<span class="pend">En revisión</span>'}`;

  await cargarMascotas();
});


// ---------- Ubicación: estados ----------
function soloMunicipio(texto, estado) {
  let t = String(texto || "").trim();
  if (estado) t = t.replace(new RegExp("[,\\s]+" + estado.replace(/[.*+?^${}()|[\]\\]/g, "\\$&") + "$", "i"), "").trim();
  return t;
}
function llenarEstados() {
  for (const id of ["pEstado", "cfgEstado"]) {
    const sel = document.getElementById(id);
    if (!sel || sel.options.length) continue;
    sel.innerHTML = `<option value="">Elige el estado…</option>` + ESTADOS.map(e => `<option value="${e.n}">${e.n}</option>`).join("");
  }
}

// ---------- Interesados nuevos (desde la última vez que abriste cada mascota) ----------
function claveVistos() { return `pm_vistos_${uid}`; }
function leerVistos() {
  try { return JSON.parse(localStorage.getItem(claveVistos()) || "{}"); } catch (e) { return {}; }
}
function marcarVistos(petId) {
  try {
    const v = leerVistos(); v[petId] = Date.now();
    localStorage.setItem(claveVistos(), JSON.stringify(v));
  } catch (e) {}
}
async function contarNuevos() {
  try {
    const snap = await getDocs(query(collection(db, "swipes"), where("shelterId", "==", uid), where("liked", "==", true)));
    const vistos = leerVistos();
    const out = {};
    snap.forEach((d) => {
      const s = d.data();
      const t = s.timestamp && s.timestamp.toMillis ? s.timestamp.toMillis() : 0;
      if (t > (vistos[s.petId] || 0)) out[s.petId] = (out[s.petId] || 0) + 1;
    });
    return out;
  } catch (e) {
    console.warn("No se pudo contar interesados nuevos:", e);
    return {};
  }
}
function mostrarBanner(total) {
  let el = document.getElementById("avisoNuevos");
  if (!el) {
    el = document.createElement("div");
    el.id = "avisoNuevos";
    petsArea.parentNode.insertBefore(el, petsArea);
  }
  el.innerHTML = "";
  if (!total) return;
  el.style.cssText = "background:#FDEBE5;border:1.5px solid #E8836B;color:#8a3a26;padding:12px 16px;border-radius:14px;margin:0 0 18px;font-weight:600;font-size:0.92rem;";
  el.textContent = `🔔 Tienes ${total} ${total === 1 ? "interesado nuevo" : "interesados nuevos"}. ¡Respóndeles pronto!`;
}

let filtroActual = "all";
let ultimaLista = { pets: [], nuevos: {}, totalInteresados: 0 };

function diasDesde(pet) {
  const t = pet.createdAt && pet.createdAt.toMillis ? pet.createdAt.toMillis() : 0;
  return t ? Math.floor((Date.now() - t) / 86400000) : null;
}
function completitud(pet) {
  const campos = [pet.photoURL, pet.nombre, pet.raza, pet.edad, pet.tamano, pet.energia, pet.descripcion && String(pet.descripcion).length >= 40, pet.buenoConNinos !== undefined && pet.buenoConNinos !== null && pet.buenoConNinos !== "", pet.buenoConOtrasMascotas !== undefined && pet.buenoConOtrasMascotas !== null && pet.buenoConOtrasMascotas !== ""];
  const ok = campos.filter(Boolean).length;
  return Math.round((ok / campos.length) * 100);
}

async function contarTotalInteresados() {
  try {
    const snap = await getDocs(query(collection(db, "swipes"), where("shelterId", "==", uid), where("liked", "==", true)));
    return typeof snap.size === "number" ? snap.size : snap.docs.length;
  } catch (e) { return 0; }
}

function pintarResumen() {
  const { pets, nuevos, totalInteresados } = ultimaLista;
  const disp = pets.filter(p => p.status !== "adopted").length;
  const adop = pets.filter(p => p.status === "adopted").length;
  const nNuevos = Object.values(nuevos).reduce((x, y) => x + y, 0);
  const h = new Date().getHours();
  const saludo = h < 12 ? "Buenos días" : h < 19 ? "Buenas tardes" : "Buenas noches";
  document.getElementById("spHello").textContent = `${saludo}, ${shelterName} 👋`;

  document.getElementById("spKpis").innerHTML = `
    <div class="sp-kpi"><b>${disp}</b><span>Disponibles</span></div>
    <div class="sp-kpi ${nNuevos ? "hot" : ""}"><b>${nNuevos}</b><span>Interesados nuevos</span></div>
    <div class="sp-kpi"><b>${totalInteresados}</b><span>Total de interesados</span></div>
    <div class="sp-kpi"><b>${adop}</b><span>Adoptados</span></div>`;

  // Qué hacer hoy (reglas simples)
  const tips = [];
  if (nNuevos) tips.push(`Responde a tus ${nNuevos} ${nNuevos === 1 ? "interesado nuevo" : "interesados nuevos"}: entre más rápido contestas, más adopciones.`);
  if (!shelterWhatsapp) tips.unshift("Agrega el WhatsApp de tu refugio en la configuración del perfil: así los interesados te escriben directo con su información.");
  const incompletas = pets.filter(p => p.status !== "adopted" && completitud(p) < 80);
  if (incompletas.length) tips.push(`Completa la ficha de ${incompletas.slice(0, 2).map(p => p.nombre || "un animal").join(" y ")}: las fichas completas reciben más “Me interesa”.`);
  const largos = pets.filter(p => p.status !== "adopted" && (diasDesde(p) || 0) >= 14);
  if (largos.length) tips.push(`${largos[0].nombre || "Un animal"} lleva ${diasDesde(largos[0])} días publicado: compártelo en historias con su tarjeta.`);
  if (pets.length && !pets.some(p => p.status === "adopted")) tips.push("Cuando alguien sea adoptado, márcalo: tus adopciones se ven en tu panel.");
  document.getElementById("spTodo").innerHTML = tips.length
    ? `<div class="sp-todo"><h4>💡 Qué hacer hoy</h4><ul>${tips.slice(0, 3).map(t => `<li>${escapeHtml(t)}</li>`).join("")}</ul></div>` : "";

  // Primeros pasos para refugios nuevos
  const chk = document.getElementById("spCheck");
  const pasos = [
    ["Crea tu cuenta de refugio", true],
    ["Publica tu primer animal", pets.length > 0],
    ["Agrega tus redes sociales (⋯ menú)", !!ultimaLista.tieneRedes],
    ["Comparte una tarjeta en historias", false],
  ];
  if (pets.length >= 3) { chk.innerHTML = ""; return; }
  const hechos = pasos.filter(x => x[1]).length;
  chk.innerHTML = `<div class="sp-check"><b>Primeros pasos · ${hechos} de ${pasos.length}</b>
    <div class="sp-meter" style="margin-top:8px"><i style="width:${Math.round(hechos / pasos.length * 100)}%"></i></div>
    <ol>${pasos.map(x => `<li class="${x[1] ? "done" : ""}">${x[0]}</li>`).join("")}</ol></div>`;
}

function pintarTarjetas() {
  const { pets, nuevos } = ultimaLista;
  let lista = pets;
  if (filtroActual === "available") lista = pets.filter(p => p.status !== "adopted");
  if (filtroActual === "adopted") lista = pets.filter(p => p.status === "adopted");

  if (!pets.length) {
    petsArea.innerHTML = `
      <div class="empty-state">
        <span class="paw-big">🐾</span>
        <h3>Aún no has subido animales</h3>
        <p>Toca “＋ Publicar animal” para subir a tu primer perrito o gatito.</p>
      </div>`;
    return;
  }
  if (!lista.length) { petsArea.innerHTML = `<div class="empty-state"><p>No hay animales en esta sección.</p></div>`; return; }

  petsArea.innerHTML = "";
  const grid = document.createElement("div");
  grid.className = "sp-grid";
  petsArea.appendChild(grid);

  for (const pet of lista) {
    const adoptado = pet.status === "adopted";
    const nNuevos = nuevos[pet.id] || 0;
    const dias = diasDesde(pet);
    const comp = completitud(pet);
    const card = document.createElement("div");
    card.className = "sp-card" + (adoptado ? " adopted" : "");
    const foto = pet.photoURL ? String(pet.photoURL).replace(/"/g, "%22") : "";
    card.innerHTML = `
      <div class="sp-photo" style="${foto ? `background-image:url('${foto.replace(/'/g, "%27")}')` : ""}">
        <div class="sp-pills">
          <span class="sp-pill ${adoptado ? "done" : "ok"}">${adoptado ? "Adoptado" : "Disponible"}</span>
          ${nNuevos ? `<span class="sp-pill new">🔔 ${nNuevos} ${nNuevos === 1 ? "nuevo" : "nuevos"}</span>` : ""}
        </div>
        ${foto ? `<img src="${escapeHtml(pet.photoURL)}" alt="${escapeHtml(pet.nombre || "")}">` : ""}
      </div>
      <div class="sp-body">
        <h3>${escapeHtml(pet.nombre || "Sin nombre")}</h3>
        <div class="sp-meta">${pet.especie === "gato" ? "🐈 Gato" : "🐕 Perro"} · ${escapeHtml(pet.raza || "")} · ${escapeHtml(pet.edad || "")}</div>
        ${dias !== null ? `<div class="sp-days">Publicado hace ${dias === 0 ? "menos de un día" : dias + (dias === 1 ? " día" : " días")}</div>` : ""}
        ${adoptado ? "" : `<div class="sp-meter"><i style="width:${comp}%"></i></div><div class="sp-meterlbl">Ficha ${comp}% completa${comp < 100 ? " · edítala para mejorarla" : " ✓"}</div>`}
        <div class="sp-actions"></div>
      </div>`;
    const actions = card.querySelector(".sp-actions");

    const btnInteresados = document.createElement("button");
    btnInteresados.className = "sp-primary" + (nNuevos ? "" : " calm");
    btnInteresados.textContent = nNuevos ? `Ver interesados (${nNuevos})` : "Ver interesados";
    btnInteresados.onclick = () => {
      marcarVistos(pet.id);
      btnInteresados.textContent = "Ver interesados";
      btnInteresados.classList.add("calm");
      const pill = card.querySelector(".sp-pill.new"); if (pill) pill.remove();
      verInteresados(pet);
    };

    const row2 = document.createElement("div");
    row2.className = "sp-row2";
    const btnTarjeta = document.createElement("button");
    btnTarjeta.className = "sp-sec";
    btnTarjeta.textContent = "🖼️ Compartir";
    btnTarjeta.onclick = () => abrirTarjeta(pet);
    const btnEditar = document.createElement("button");
    btnEditar.className = "sp-sec";
    btnEditar.textContent = "✏️ Editar";
    btnEditar.onclick = () => abrirModalEditar(pet);

    const dots = document.createElement("div");
    dots.className = "sp-dots";
    dots.innerHTML = `<button class="sp-sec" style="width:44px" aria-label="Más">⋯</button><div class="sp-menu"></div>`;
    const menu = dots.querySelector(".sp-menu");
    const btnToggle = document.createElement("button");
    btnToggle.textContent = adoptado ? "↩️ Reactivar" : "🏡 Marcar adoptado";
    btnToggle.onclick = async () => {
      await updateDoc(doc(db, "pets", pet.id), { status: adoptado ? "available" : "adopted" });
      cargarMascotas();
    };
    const btnBorrar = document.createElement("button");
    btnBorrar.className = "danger";
    btnBorrar.textContent = "🗑️ Borrar";
    btnBorrar.onclick = async () => {
      if (confirm(`¿Estás seguro de que deseas eliminar a "${pet.nombre || "este animal"}"?`)) {
        await deleteDoc(doc(db, "pets", pet.id));
        await cargarMascotas();
      }
    };
    menu.appendChild(btnToggle);
    menu.appendChild(btnBorrar);
    dots.querySelector("button").onclick = (ev) => {
      ev.stopPropagation();
      document.querySelectorAll(".sp-menu.open").forEach(m => { if (m !== menu) m.classList.remove("open"); });
      menu.classList.toggle("open");
    };

    row2.appendChild(btnTarjeta);
    row2.appendChild(btnEditar);
    row2.appendChild(dots);
    actions.appendChild(btnInteresados);
    actions.appendChild(row2);
    grid.appendChild(card);
  }
}

async function cargarMascotas() {
  const snap = await getDocs(query(collection(db, "pets"), where("shelterId", "==", uid)));
  const pets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const nuevos = pets.length ? await contarNuevos() : {};
  const totalInteresados = pets.length ? await contarTotalInteresados() : 0;
  let tieneRedes = false;
  try {
    const u = await getDoc(doc(db, "users", uid));
    const d = u.exists() ? u.data() : {};
    tieneRedes = !!(d.facebook || d.instagram);
  } catch (e) {}
  ultimaLista = { pets, nuevos, totalInteresados, tieneRedes };
  const prev = document.getElementById("avisoNuevos"); if (prev) prev.remove();
  pintarResumen();
  pintarTarjetas();
}

// Pestañas, menú ⋯ y botones de publicar
document.querySelectorAll("#spTabs .sp-tab").forEach(b => {
  b.onclick = () => {
    filtroActual = b.dataset.f;
    document.querySelectorAll("#spTabs .sp-tab").forEach(x => x.classList.toggle("on", x === b));
    pintarTarjetas();
  };
});
const spMenu = document.getElementById("spMenu");
document.getElementById("btnMore").onclick = (ev) => { ev.stopPropagation(); spMenu.classList.toggle("open"); };
document.addEventListener("click", () => { document.querySelectorAll(".sp-menu.open").forEach(m => m.classList.remove("open")); });

// ---------- Modal y Formulario ----------
const modalOverlay = document.getElementById("modalOverlay");
const abrirNuevo = () => { resetForm(); modalOverlay.style.display = "flex"; };
document.getElementById("btnAdd").onclick = abrirNuevo;
document.getElementById("btnAddTop").onclick = abrirNuevo;
document.getElementById("btnCancelar").onclick = () => { modalOverlay.style.display = "none"; };

function abrirModalEditar(pet) {
  resetForm();
  editingPetId = pet.id;
  document.getElementById("modalTitle").textContent = "Editar animal";
  document.getElementById("btnGuardarPet").textContent = "Guardar cambios";

  document.getElementById("pNombre").value = pet.nombre || "";
  document.getElementById("pRaza").value = pet.raza || "";
  document.getElementById("pEdad").value = pet.edad || "";
  document.getElementById("pDescripcion").value = pet.descripcion || "";
  document.getElementById("pCiudad").value = pet.municipio || soloMunicipio(pet.city || shelterCity, normalizarEstado(pet.estado) || inferirEstado(pet.city));
  document.getElementById("pEstado").value = normalizarEstado(pet.estado) || inferirEstado(pet.city) || shelterEstado;

  setChipSelected("pEspecie", pet.especie);
  setChipSelected("pTamano", pet.tamano);
  setChipSelected("pEnergia", pet.energia);
  setChipSelected("pDificultad", pet.nivelDificultad);
  setChipSelected("pNinos", String(pet.buenoConNinos));
  setChipSelected("pOtrasMascotas", String(pet.buenoConOtrasMascotas));

  if (pet.photoURL) {
    const wrap = document.getElementById("photoPreviewWrap");
    const img = document.createElement("img");
    img.src = pet.photoURL;
    wrap.appendChild(img);
  }

  modalOverlay.style.display = "flex";
}

function setChipSelected(groupName, value) {
  if (value === undefined || value === null) return;
  const group = document.querySelector(`[data-group="${groupName}"]`);
  const chip = group?.querySelector(`.choice-chip[data-value="${value}"]`);
  if (chip) chip.classList.add("selected");
}

document.querySelectorAll("[data-group]").forEach(group => {
  group.querySelectorAll(".choice-chip").forEach(chip => {
    chip.addEventListener("click", () => {
      group.querySelectorAll(".choice-chip").forEach(c => c.classList.remove("selected"));
      chip.classList.add("selected");
    });
  });
});

function getSelected(groupName) {
  const group = document.querySelector(`[data-group="${groupName}"]`);
  const sel = group?.querySelector(".choice-chip.selected");
  return sel ? sel.dataset.value : null;
}

document.getElementById("photoDrop").addEventListener("click", () => document.getElementById("pFoto").click());
document.getElementById("pFoto").addEventListener("change", (e) => {
  selectedFile = e.target.files[0];
  const wrap = document.getElementById("photoPreviewWrap");
  wrap.innerHTML = "";
  if (selectedFile) {
    const img = document.createElement("img");
    img.src = URL.createObjectURL(selectedFile);
    wrap.appendChild(img);
  }
});

function resetForm() {
  editingPetId = null;
  document.getElementById("modalTitle").textContent = "Nuevo animal";
  document.getElementById("btnGuardarPet").textContent = "Publicar animal";
  document.getElementById("pNombre").value = "";
  document.getElementById("pRaza").value = "";
  document.getElementById("pEdad").value = "";
  document.getElementById("pDescripcion").value = "";
  document.getElementById("pCiudad").value = soloMunicipio(shelterCity, shelterEstado);
  document.getElementById("pEstado").value = shelterEstado || "";
  document.getElementById("photoPreviewWrap").innerHTML = "";
  selectedFile = null;
  document.querySelectorAll(".choice-chip.selected").forEach(c => c.classList.remove("selected"));
  document.getElementById("petMsg").innerHTML = "";
}

document.getElementById("btnGuardarPet").addEventListener("click", async () => {
  const btn = document.getElementById("btnGuardarPet");
  const nombre = document.getElementById("pNombre").value.trim();
  const especie = getSelected("pEspecie");
  const raza = document.getElementById("pRaza").value.trim();
  const edad = document.getElementById("pEdad").value.trim();
  const tamano = getSelected("pTamano");
  const energia = getSelected("pEnergia");
  const nivelDificultad = getSelected("pDificultad");
  const buenoConNinos = getSelected("pNinos");
  const buenoConOtrasMascotas = getSelected("pOtrasMascotas");
  const descripcion = document.getElementById("pDescripcion").value.trim();
  const municipio = document.getElementById("pCiudad").value.trim();
  const estado = document.getElementById("pEstado").value;

  if (!nombre || !especie || !tamano || !energia || !nivelDificultad || !estado || !municipio) {
    document.getElementById("petMsg").innerHTML = `<div class="error-msg">Completa nombre, especie, tamaño, energía, cuidado, estado y municipio.</div>`;
    return;
  }
  // «Cuernavaca, Morelos» (así lo siguen mostrando las tarjetas de siempre)
  const city = municipio.toLowerCase().includes(estado.toLowerCase()) ? municipio : `${municipio}, ${estado}`;

  btn.disabled = true;
  btn.textContent = editingPetId ? "Guardando..." : "Publicando...";

  try {
    let photoURL = null;
    if (selectedFile) {
      const archivo = await comprimirImagen(selectedFile);
      const fileRef = ref(storage, `pets/${uid}/${Date.now()}_${archivo.name}`);
      await uploadBytes(fileRef, archivo);
      photoURL = await getDownloadURL(fileRef);
    }

    // Coordenadas para el mapa y «cerca de mí» (si falla la red, queda el centro del estado)
    const geo = await geocodificar(municipio, estado);

    const petData = {
      shelterId: uid,
      shelterName,
      shelterVerified,
      shelterWhatsapp,
      nombre, especie, raza, edad, tamano, energia,
      nivelDificultad,
      buenoConNinos: buenoConNinos === "true",
      buenoConOtrasMascotas: buenoConOtrasMascotas === "true",
      descripcion, city, estado, municipio,
      updatedAt: serverTimestamp(),
    };
    if (geo) { petData.lat = geo.lat; petData.lng = geo.lng; }

    if (photoURL) petData.photoURL = photoURL;

    if (editingPetId) {
      await updateDoc(doc(db, "pets", editingPetId), petData);
    } else {
      petData.photoURL = photoURL || "";
      petData.status = "available";
      petData.createdAt = serverTimestamp();
      await addDoc(collection(db, "pets"), petData);
    }

    modalOverlay.style.display = "none";
    resetForm();
    await cargarMascotas();
  } catch (err) {
    console.error(err);
    document.getElementById("petMsg").innerHTML = `<div class="error-msg">Error al guardar. Intenta de nuevo.</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = editingPetId ? "Guardar cambios" : "Publicar animal";
  }
});

// ---------- Interesados con consulta dual en Firestore ----------
const interesadosOverlay = document.getElementById("interesadosOverlay");
document.getElementById("btnCerrarInteresados").onclick = () => { interesadosOverlay.style.display = "none"; };

async function verInteresados(pet) {
  document.getElementById("interesadosTitle").textContent = `Interesados en ${pet.nombre}`;
  const area = document.getElementById("interesadosArea");
  area.innerHTML = `<div class="center-loading">Cargando…</div>`;
  interesadosOverlay.style.display = "flex";

  const snap = await getDocs(query(
    collection(db, "swipes"),
    where("shelterId", "==", uid),
    where("petId", "==", pet.id),
    where("liked", "==", true),
  ));

  if (snap.empty) {
    area.innerHTML = `<p style="color:var(--ink-soft); font-size:0.9rem;">Nadie le ha dado match todavía.</p>`;
    return;
  }

  area.innerHTML = "";
  for (const d of snap.docs) {
    // El adoptante comparte estos datos al dar like (ver swipe.js → snapshotAdoptante)
    const a = d.data().adopter || {};

    const name = a.name || "Adoptante";
    const email = a.email || "";
    const city = a.city || "Sin ciudad";
    const phone = a.phone || "";
    const bio = a.biografia || "Sin carta de presentación.";

    const L = {
      vivienda: { depto: "Departamento", casa_sin_patio: "Casa sin patio", casa_patio_chico: "Casa patio chico", casa_patio_grande: "Casa patio grande" },
      horas: { menos2: "<2 h", "2a4": "2–4 h", "4a8": "4–8 h", mas8: ">8 h" },
      exp: { primera_vez: "Primera vez", algo: "Algo de exp.", mucha: "Mucha exp." },
      tipo: { propia: "Vivienda propia", renta_permitida: "Renta (con permiso)", renta_sin_permiso: "Renta (sin permiso aún)" },
      acuerdo: { si: "Familia de acuerdo", en_proceso: "Familia aún lo platica" },
      viajes: { familiares: "Viajes: familiares/amigos", pension: "Viajes: pensión", viaja: "Viaja con el animal" },
    };

    // Etiquetas rápidas para el refugio
    const vivienda = L.vivienda[a.vivienda] || "Vivienda no descrita";
    const horasSolo = a.horasSolo ? `${L.horas[a.horasSolo] || a.horasSolo} solo/día` : "Horas n/d";
    const ninosTag = a.ninos === "si" ? "👶 Con niños" : "Sin niños";
    const mascotasTag = a.otrasMascotas === "si" ? "🐾 Tiene mascotas" : "Sin mascotas";
    const expTag = a.experiencia ? `⭐ ${L.exp[a.experiencia] || a.experiencia}` : "Sin exp. registrada";
    const extras = [L.tipo[a.tipoVivienda], L.acuerdo[a.acuerdoFamiliar], L.viajes[a.planViajes]].filter(Boolean);

    const cleanPhone = phone.replace(/\D/g, "");
    const waUrl = urlWhatsApp(phone, mensajeAlAdoptante(name, shelterName, pet.nombre, d.data().matchScore)) || null;

    const row = document.createElement("div");
    row.style.padding = "14px 0";
    row.style.borderBottom = "1px solid var(--line)";
    row.innerHTML = `
      <div style="display:flex; justify-content:space-between; align-items:baseline;">
        <strong style="font-size:1rem;">${escapeHtml(name)}</strong>
        <span style="color:var(--mint); font-weight:700; font-size:0.9rem;">${d.data().matchScore || 90}% match</span>
      </div>

      <!-- Datos de contacto básico -->
      <div style="font-size:0.82rem; color:var(--ink-soft); margin:4px 0 8px;">
        📍 ${escapeHtml(city)} · ✉️ <a href="mailto:${escapeHtml(email)}" style="color:var(--ink); font-weight:600;">${escapeHtml(email || "Sin correo")}</a><br>
        📞 ${phone ? escapeHtml(phone) : "Teléfono no registrado"}
      </div>

      <!-- Badges de compatibilidad visual rápida -->
      <div class="tag-row" style="margin: 6px 0;">
        <span class="tag">🏠 ${escapeHtml(vivienda)}</span>
        <span class="tag">⏱️ ${escapeHtml(horasSolo)}</span>
        <span class="tag">${ninosTag}</span>
        <span class="tag">${mascotasTag}</span>
        <span class="tag">${escapeHtml(expTag)}</span>
        ${extras.map(x => `<span class="tag">${escapeHtml(x)}</span>`).join("")}
      </div>

      <!-- Carta de motivación -->
      <div style="font-size:0.83rem; background:var(--bg-soft); padding:10px 12px; border-radius:10px; margin:8px 0; color:var(--ink); line-height:1.4;">
        <strong>Motivación:</strong> <em>"${escapeHtml(bio)}"</em>
      </div>

      ${waUrl ? `<a href="${waUrl}" target="_blank" class="btn-whatsapp" style="margin-top:4px; display:inline-block;">💬 Contactar por WhatsApp</a>` : ""}
    `;
    area.appendChild(row);
  }
}

// ---------- Exportar datos a CSV con consulta dual ----------
document.getElementById("btnExportarCSV").onclick = async () => {
  const btn = document.getElementById("btnExportarCSV");
  btn.textContent = "Generando...";
  btn.disabled = true;

  try {
    const petsSnap = await getDocs(query(collection(db, "pets"), where("shelterId", "==", uid)));
    const pets = petsSnap.docs.map(d => ({ id: d.id, ...d.data() }));

    let csvContent = "\uFEFFAnimal,Especie,Estado,Nombre Adoptante,Correo Adoptante,Telefono Adoptante,Ciudad Adoptante,Match Score (%)\n";

    for (const pet of pets) {
      const swipesSnap = await getDocs(query(
        collection(db, "swipes"),
        where("shelterId", "==", uid),
        where("petId", "==", pet.id),
        where("liked", "==", true)
      ));

      const estado = pet.status === "adopted" ? "Adoptado" : "Disponible";
      if (swipesSnap.empty) {
        csvContent += [pet.nombre, pet.especie, estado, "Sin interesados", "N/A", "N/A", "N/A", "N/A"].map(csvCell).join(",") + "\n";
      } else {
        for (const swipeDoc of swipesSnap.docs) {
          const sw = swipeDoc.data();
          const a = sw.adopter || {};
          csvContent += [
            pet.nombre, pet.especie, estado,
            a.name || "N/A", a.email || "N/A", a.phone || "N/A", a.city || "N/A",
            sw.matchScore ?? "N/A",
          ].map(csvCell).join(",") + "\n";
        }
      }
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_PetMatch_${new Date().toISOString().slice(0, 10)}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

  } catch (err) {
    console.error(err);
    alert("Error al descargar el reporte.");
  } finally {
    btn.textContent = "📊 Descargar Datos (CSV)";
    btn.disabled = false;
  }
};

function csvCell(v) {
  let t = String(v ?? "");
  if (/^[=+\-@\t\r]/.test(t)) t = "'" + t;   // evita inyección de fórmulas en Excel
  return `"${t.replace(/"/g, '""')}"`;
}

function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
// ---------- CONFIGURACIÓN DE REDES SOCIALES ----------
const configOverlay = document.getElementById("configOverlay");
const btnConfigRefugio = document.getElementById("btnConfigRefugio");

if (btnConfigRefugio) {
  btnConfigRefugio.onclick = async () => {
    configOverlay.style.display = "flex";
    document.getElementById("cfgMsg").innerHTML = "Cargando...";
    
    try {
      const snap = await getDoc(doc(db, "users", uid));
      if(snap.exists()) {
        const d = snap.data();
        document.getElementById("cfgWa").value = d.whatsapp || "";
        document.getElementById("cfgFb").value = d.facebook || "";
        document.getElementById("cfgIg").value = d.instagram || "";
        document.getElementById("cfgEstado").value = normalizarEstado(d.estado) || inferirEstado(d.city) || "";
        document.getElementById("cfgCiudad").value = soloMunicipio(d.city || "", normalizarEstado(d.estado) || inferirEstado(d.city));
      }
      document.getElementById("cfgMsg").innerHTML = "";
    } catch(err) {
      document.getElementById("cfgMsg").innerHTML = "Error al cargar datos.";
    }
  };
}

document.getElementById("btnCerrarConfig").onclick = () => {
  configOverlay.style.display = "none";
};

document.getElementById("btnGuardarConfig").onclick = async () => {
  const btn = document.getElementById("btnGuardarConfig");
  btn.disabled = true;
  btn.textContent = "Guardando...";
  
  try {
    const cfgEstado = document.getElementById("cfgEstado").value;
    const cfgMun = document.getElementById("cfgCiudad").value.trim();
    const waCrudo = document.getElementById("cfgWa").value.trim();
    const wa = normalizarWhatsApp(waCrudo);
    if (waCrudo && !wa) {
      document.getElementById("cfgMsg").innerHTML = `<div class="error-msg" style="margin-top:8px;">Revisa el número de WhatsApp (10 dígitos con lada).</div>`;
      btn.disabled = false; btn.textContent = "Guardar Configuración";
      return;
    }
    const datos = {
      whatsapp: wa,
      facebook: document.getElementById("cfgFb").value.trim(),
      instagram: document.getElementById("cfgIg").value.trim()
    };
    if (cfgEstado) {
      datos.estado = cfgEstado;
      if (cfgMun) datos.city = cfgMun.toLowerCase().includes(cfgEstado.toLowerCase()) ? cfgMun : `${cfgMun}, ${cfgEstado}`;
    }
    await updateDoc(doc(db, "users", uid), datos);
    if (wa !== shelterWhatsapp) {
      shelterWhatsapp = wa;
      // Los animales ya publicados también llevan el número (solo se muestra tras «Me interesa»)
      try {
        const mine = await getDocs(query(collection(db, "pets"), where("shelterId", "==", uid)));
        await Promise.all(mine.docs.map((p) => updateDoc(doc(db, "pets", p.id), { shelterWhatsapp: wa })));
      } catch (e) { console.warn("No se pudo actualizar el WhatsApp en los animales:", e); }
    }
    if (cfgEstado) { shelterEstado = cfgEstado; if (datos.city) shelterCity = datos.city; }
    document.getElementById("cfgMsg").innerHTML = `<div class="ok-msg" style="color:var(--mint); margin-top:8px; font-weight:bold;">✓ Guardado con éxito</div>`;
    
    // Cerrar el modal automáticamente después de un segundo
    setTimeout(() => { 
      configOverlay.style.display = "none"; 
      document.getElementById("cfgMsg").innerHTML = ""; 
    }, 1500);
    
  } catch (err) {
    console.error("Error al guardar redes:", err);
    document.getElementById("cfgMsg").innerHTML = `<div class="error-msg" style="margin-top:8px;">Error al guardar.</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Guardar Configuración";
  }
};
