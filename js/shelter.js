import {
  auth, db, storage, onAuthStateChanged, signOut,
  doc, setDoc, getDoc, updateDoc, deleteDoc,
  collection, addDoc, getDocs, query, where, serverTimestamp,
  ref, uploadBytes, getDownloadURL,
} from "./firebase-config.js";

let uid = null;
let shelterName = "";
let shelterCity = "";
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
  document.getElementById("shelterNameTag").textContent = shelterName;

  await cargarMascotas();
});

async function cargarMascotas() {
  const snap = await getDocs(query(collection(db, "pets"), where("shelterId", "==", uid)));
  const pets = snap.docs.map(d => ({ id: d.id, ...d.data() }));

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
    btnInteresados.textContent = "Interesados";
    btnInteresados.onclick = () => verInteresados(pet);

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
    where("petId", "==", pet.id),
    where("liked", "==", true),
  ));

  if (snap.empty) {
    area.innerHTML = `<p style="color:var(--ink-soft); font-size:0.9rem;">Nadie le ha dado match todavía.</p>`;
    return;
  }

  area.innerHTML = "";
  for (const d of snap.docs) {
    const adopterId = d.data().adopterId;
    
    // Consulta simultánea a users y adopterProfiles
    const [adopterSnap, profileSnap] = await Promise.all([
      getDoc(doc(db, "users", adopterId)),
      getDoc(doc(db, "adopterProfiles", adopterId))
    ]);

    const uData = adopterSnap.exists() ? adopterSnap.data() : {};
    const pData = profileSnap.exists() ? profileSnap.data() : {};

    // Extraer datos esenciales
    const name = uData.name || uData.nombre || pData.name || pData.nombre || "Adoptante";
    const email = uData.email || pData.email || "";
    const city = uData.city || pData.city || "Sin ciudad";
    const phone = uData.phone || uData.telefono || uData.celular || pData.phone || pData.telefono || pData.celular || "";
    const bio = pData.biografia || uData.biografia || "Sin carta de presentación.";

    // Mapeo de etiquetas rápidas para el refugio
    const vivienda = pData.vivienda ? pData.vivienda.replace('_', ' ') : 'Vivienda no descrita';
    const horasSolo = pData.horasSolo ? `${pData.horasSolo} solo/día` : 'Horas n/d';
    const ninosTag = pData.ninos === 'si' ? '👶 Con niños' : 'Sin niños';
    const mascotasTag = pData.otrasMascotas === 'si' ? '🐾 Tiene mascotas' : 'Sin mascotas';
    const expTag = pData.experiencia ? `⭐ Exp: ${pData.experiencia}` : 'Sin exp. registrada';

    const cleanPhone = phone.replace(/\D/g, "");
    const waText = encodeURIComponent(`¡Hola ${name}! Te escribimos de ${shelterName} respecto a tu interés en adoptar a ${pet.nombre} en PatitasMatch 🐾`);
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
        📍 ${escapeHtml(city)} · ✉️ <a href="mailto:${email}" style="color:var(--ink); font-weight:600;">${escapeHtml(email || "Sin correo")}</a><br>
        📞 ${phone ? escapeHtml(phone) : "Teléfono no registrado"}
      </div>

      <!-- Badges de compatibilidad visual rápida -->
      <div class="tag-row" style="margin: 6px 0;">
        <span class="tag">🏠 ${escapeHtml(vivienda)}</span>
        <span class="tag">⏱️ ${escapeHtml(horasSolo)}</span>
        <span class="tag">${ninosTag}</span>
        <span class="tag">${mascotasTag}</span>
        <span class="tag">${escapeHtml(expTag)}</span>
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
        where("petId", "==", pet.id),
        where("liked", "==", true)
      ));

      if (swipesSnap.empty) {
        csvContent += `"${pet.nombre}","${pet.especie}","${pet.status === "adopted" ? "Adoptado" : "Disponible"}","Sin interesados","N/A","N/A","N/A","N/A"\n`;
      } else {
        for (const swipeDoc of swipesSnap.docs) {
          const adopterId = swipeDoc.data().adopterId;
          
          const [adopterSnap, profileSnap] = await Promise.all([
            getDoc(doc(db, "users", adopterId)),
            getDoc(doc(db, "adopterProfiles", adopterId))
          ]);

          const uData = adopterSnap.exists() ? adopterSnap.data() : {};
          const pData = profileSnap.exists() ? profileSnap.data() : {};

          const name = uData.name || uData.nombre || pData.name || pData.nombre || "N/A";
          const email = uData.email || pData.email || "N/A";
          const city = uData.city || pData.city || "N/A";
          const phone = uData.phone || uData.telefono || uData.celular || pData.phone || pData.telefono || pData.celular || "N/A";

          csvContent += `"${pet.nombre}","${pet.especie}","${pet.status === "adopted" ? "Adoptado" : "Disponible"}","${name}","${email}","${phone}","${city}","${swipeDoc.data().matchScore || 90}"\n`;
        }
      }
    }

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.setAttribute("href", url);
    link.setAttribute("download", `Reporte_PatitasMatch_${new Date().toISOString().slice(0, 10)}.csv`);
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

function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
