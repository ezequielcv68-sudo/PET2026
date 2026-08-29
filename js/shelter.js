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

    // 🗑️ Botón para eliminar mascota
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
    actions.appendChild(btnBorrar);
    row.appendChild(actions);
    petsArea.appendChild(row);
  }
}

// ---------- Modal agregar mascota ----------
const modalOverlay = document.getElementById("modalOverlay");
document.getElementById("btnAdd").onclick = () => { resetForm(); modalOverlay.style.display = "flex"; };
document.getElementById("btnCancelar").onclick = () => { modalOverlay.style.display = "none"; };

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
  btn.textContent = "Publicando...";
  try {
    let photoURL = "";
    if (selectedFile) {
      const fileRef = ref(storage, `pets/${uid}/${Date.now()}_${selectedFile.name}`);
      await uploadBytes(fileRef, selectedFile);
      photoURL = await getDownloadURL(fileRef);
    }

    await addDoc(collection(db, "pets"), {
      shelterId: uid,
      shelterName,
      nombre, especie, raza, edad, tamano, energia,
      nivelDificultad,
      buenoConNinos: buenoConNinos === "true",
      buenoConOtrasMascotas: buenoConOtrasMascotas === "true",
      descripcion, city,
      photoURL,
      status: "available",
      createdAt: serverTimestamp(),
    });

    modalOverlay.style.display = "none";
    await cargarMascotas();
  } catch (err) {
    console.error(err);
    document.getElementById("petMsg").innerHTML = `<div class="error-msg">Error al publicar. Intenta de nuevo.</div>`;
  } finally {
    btn.disabled = false;
    btn.textContent = "Publicar mascota";
  }
});

// ---------- Interesados ----------
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
    const adopterSnap = await getDoc(doc(db, "users", adopterId));
    const adopter = adopterSnap.exists() ? adopterSnap.data() : {};
    const row = document.createElement("div");
    row.style.padding = "10px 0";
    row.style.borderBottom = "1px solid var(--line)";
    row.innerHTML = `
      <strong>${escapeHtml(adopter.name || "Adoptante")}</strong> · ${d.data().matchScore}% match<br>
      <span style="font-size:0.85rem; color:var(--ink-soft);">${escapeHtml(adopter.city || "")} · <a href="mailto:${adopter.email || ""}" style="color:var(--mint); font-weight:600;">${escapeHtml(adopter.email || "")}</a></span>
    `;
    area.appendChild(row);
  }
}

function escapeHtml(s) { return String(s ?? "").replace(/[&<>"']/g, m => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[m])); }
