import {
  auth, db, storage, onAuthStateChanged, signOut,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs, query, where, serverTimestamp,
  ref, uploadBytes, getDownloadURL,
} from "./firebase-config.js";
import { abrirTarjeta } from "./sharecard.js";

let uid = null;
let shelterName = "";
let shelterCity = "";
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
  shelterVerified = userSnap.data().verified === true;
  document.getElementById("shelterNameTag").textContent = shelterName + (shelterVerified ? " ✓" : "");

  await cargarMascotas();
});

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

async function cargarMascotas() {
  const snap = await getDocs(query(collection(db, "pets"), where("shelterId", "==", uid)));
  const pets = snap.docs.map(d => ({ id: d.id, ...d.data() }));
  const nuevos = pets.length ? await contarNuevos() : {};
  mostrarBanner(Object.values(nuevos).reduce((x, y) => x + y, 0));

  if (!pets.length) {
    petsArea.innerHTML = `
      <div class="empty-state">
        <span class="paw-big">🐾</span>
        <h3>Aún no has subido mascotas</h3>
        <p>Toca el botón + para publicar a tu primer perrito o gatito.</p>
      </div>`;
    return;
  }

  petsArea.innerHTML = "";
  for (const pet of pets) {
    const row = document.createElement("div");
    row.className = "pet-row";
    row.innerHTML = `
      <img src="${pet.photoURL || ""}" alt="${escapeHtml(pet.nombre || "")}">
      <div class="p-body">
        <h3>${escapeHtml(pet.nombre || "Sin nombre")}</h3>
        <div class="meta">${pet.especie === "gato" ? "🐈 Gato" : "🐕 Perro"} · ${escapeHtml(pet.raza || "")} · ${escapeHtml(pet.edad || "")}</div>
      </div>
      <span class="status-pill ${pet.status === "adopted" ? "adopted" : ""}">${pet.status === "adopted" ? "Adoptado" : "Disponible"}</span>
    `;
    const actions = document.createElement("div");
    actions.style.display = "flex";
    actions.style.flexDirection = "column";
    actions.style.gap = "6px";
    actions.style.marginLeft = "10px";

    const btnInteresados = document.createElement("button");
    btnInteresados.className = "btn-ghost";
    btnInteresados.style.fontSize = "0.72rem";
    const nNuevos = nuevos[pet.id] || 0;
    btnInteresados.textContent = nNuevos ? `Interesados 🔔${nNuevos}` : "Interesados";
    if (nNuevos) btnInteresados.style.cssText += "color:#D96B50;border-color:#E8836B;font-weight:700;";
    btnInteresados.onclick = () => {
      marcarVistos(pet.id);
      btnInteresados.textContent = "Interesados";
      btnInteresados.style.color = ""; btnInteresados.style.borderColor = ""; btnInteresados.style.fontWeight = "";
      verInteresados(pet);
    };

    const btnTarjeta = document.createElement("button");
    btnTarjeta.className = "btn-ghost";
    btnTarjeta.style.fontSize = "0.72rem";
    btnTarjeta.textContent = "🖼️ Tarjeta";
    btnTarjeta.onclick = () => abrirTarjeta(pet);

    const btnToggle = document.createElement("button");
    btnToggle.className = "btn-ghost";
    btnToggle.style.fontSize = "0.72rem";
    btnToggle.textContent = pet.status === "adopted" ? "Reactivar" : "Marcar adoptado";
    btnToggle.onclick = async () => {
      await updateDoc(doc(db, "pets", pet.id), { status: pet.status === "adopted" ? "available" : "adopted" });
      cargarMascotas();
    };

    const btnEditar = document.createElement("button");
    btnEditar.className = "btn-ghost";
    btnEditar.style.fontSize = "0.72rem";
    btnEditar.textContent = "Editar";
    btnEditar.onclick = () => abrirModalEditar(pet);

    const btnBorrar = document.createElement("button");
    btnBorrar.className = "btn-ghost";
    btnBorrar.style.fontSize = "0.72rem";
    btnBorrar.style.color = "#c0392b";
    btnBorrar.style.borderColor = "rgba(192, 57, 43, 0.3)";
    btnBorrar.textContent = "Borrar";
    btnBorrar.onclick = async () => {
      if (confirm(`¿Estás seguro de que deseas eliminar a "${pet.nombre || "esta mascota"}"?`)) {
        await deleteDoc(doc(db, "pets", pet.id));
        await cargarMascotas();
      }
    };

    actions.appendChild(btnInteresados);
    actions.appendChild(btnTarjeta);
    actions.appendChild(btnToggle);
    actions.appendChild(btnEditar);
    actions.appendChild(btnBorrar);
    row.appendChild(actions);
    petsArea.appendChild(row);
  }
}

// ---------- Modal y Formulario ----------
const modalOverlay = document.getElementById("modalOverlay");
document.getElementById("btnAdd").onclick = () => { resetForm(); modalOverlay.style.display = "flex"; };
document.getElementById("btnCancelar").onclick = () => { modalOverlay.style.display = "none"; };

function abrirModalEditar(pet) {
  resetForm();
  editingPetId = pet.id;
  document.getElementById("modalTitle").textContent = "Editar mascota";
  document.getElementById("btnGuardarPet").textContent = "Guardar cambios";

  document.getElementById("pNombre").value = pet.nombre || "";
  document.getElementById("pRaza").value = pet.raza || "";
  document.getElementById("pEdad").value = pet.edad || "";
  document.getElementById("pDescripcion").value = pet.descripcion || "";
  document.getElementById("pCiudad").value = pet.city || shelterCity;

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
  document.getElementById("modalTitle").textContent = "Nueva mascota";
  document.getElementById("btnGuardarPet").textContent = "Publicar mascota";
  document.getElementById("pNombre").value = "";
  document.getElementById("pRaza").value = "";
  document.getElementById("pEdad").value = "";
  document.getElementById("pDescripcion").value = "";
  document.getElementById("pCiudad").value = shelterCity;
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
  const city = document.getElementById("pCiudad").value.trim();

  if (!nombre || !especie || !tamano || !energia || !nivelDificultad || !city) {
    document.getElementById("petMsg").innerHTML = `<div class="error-msg">Completa nombre, especie, tamaño, energía, cuidado y ciudad.</div>`;
    return;
  }

  btn.disabled = true;
  btn.textContent = editingPetId ? "Guardando..." : "Publicando...";

  try {
    let photoURL = null;
    if (selectedFile) {
      const fileRef = ref(storage, `pets/${uid}/${Date.now()}_${selectedFile.name}`);
      await uploadBytes(fileRef, selectedFile);
      photoURL = await getDownloadURL(fileRef);
    }

    const petData = {
      shelterId: uid,
      shelterName,
      shelterVerified,
      nombre, especie, raza, edad, tamano, energia,
      nivelDificultad,
      buenoConNinos: buenoConNinos === "true",
      buenoConOtrasMascotas: buenoConOtrasMascotas === "true",
      descripcion, city,
      updatedAt: serverTimestamp(),
    };

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
    btn.textContent = editingPetId ? "Guardar cambios" : "Publicar mascota";
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
      tipo: { propia: "Vivienda propia", renta_permitida: "Renta (con permiso)" },
      acuerdo: { si: "Familia de acuerdo", en_proceso: "Familia aún lo platica" },
      viajes: { familiares: "Viajes: familiares/amigos", pension: "Viajes: pensión", viaja: "Viaja con la mascota" },
    };

    // Etiquetas rápidas para el refugio
    const vivienda = L.vivienda[a.vivienda] || "Vivienda no descrita";
    const horasSolo = a.horasSolo ? `${L.horas[a.horasSolo] || a.horasSolo} solo/día` : "Horas n/d";
    const ninosTag = a.ninos === "si" ? "👶 Con niños" : "Sin niños";
    const mascotasTag = a.otrasMascotas === "si" ? "🐾 Tiene mascotas" : "Sin mascotas";
    const expTag = a.experiencia ? `⭐ ${L.exp[a.experiencia] || a.experiencia}` : "Sin exp. registrada";
    const extras = [L.tipo[a.tipoVivienda], L.acuerdo[a.acuerdoFamiliar], L.viajes[a.planViajes]].filter(Boolean);

    const cleanPhone = phone.replace(/\D/g, "");
    const waText = encodeURIComponent(`¡Hola ${name}! Te escribimos de ${shelterName} respecto a tu interés en adoptar a ${pet.nombre} en PetMatch 🐾`);
    const waUrl = cleanPhone ? `https://wa.me/${cleanPhone}?text=${waText}` : null;

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

    let csvContent = "\uFEFFMascota,Especie,Estado,Nombre Adoptante,Correo Adoptante,Telefono Adoptante,Ciudad Adoptante,Match Score (%)\n";

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
        document.getElementById("cfgFb").value = d.facebook || "";
        document.getElementById("cfgIg").value = d.instagram || "";
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
    await updateDoc(doc(db, "users", uid), {
      facebook: document.getElementById("cfgFb").value.trim(),
      instagram: document.getElementById("cfgIg").value.trim()
    });
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
