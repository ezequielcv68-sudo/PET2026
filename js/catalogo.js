import {
  db, auth, collection, getDocs, onAuthStateChanged, doc, getDoc,
  track, esc, safeUrl, PENDING_KEY, GUEST_KEY,
} from './firebase-config.js';
import { abrirTarjeta } from './sharecard.js';
import { calcularMatch, ordenarPorMatch, especieCompatible } from './matching.js';

const catalogArea = document.getElementById('catalogArea');
const petModal = document.getElementById('petModal');
const closeModal = document.getElementById('closeModal');
const prevPetBtn = document.getElementById('prevPetBtn');
const nextPetBtn = document.getElementById('nextPetBtn');

const FOTO_DEFAULT = 'https://images.unsplash.com/photo-1543466835-00a7907e9de1';

let allPets = [];
let currentPetsList = []; // Mantiene el listado activo (con o sin filtros)
let currentIndex = 0;
let currentUser = null;

// Perfil del test (sin registro) o de la cuenta: sirve para mostrar «% para ti»
function leerPerfilLocal() {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY) || 'null'); } catch (e) { return null; }
}
let perfil = leerPerfilLocal();
let filtroTocado = false;

onAuthStateChanged(auth, (u) => {
  currentUser = u;
  if (u) cargarPerfilCuenta(u);
});

async function cargarPerfilCuenta(u) {
  try {
    const s = await getDoc(doc(db, 'adopterProfiles', u.uid));
    if (!s.exists()) return;
    perfil = s.data();
    if (allPets.length && !filtroTocado && !new URLSearchParams(window.location.search).get('m')) activarParaTi();
    else if (allPets.length) inyectarBotonParaTi();
  } catch (e) { /* sin perfil: el catálogo funciona igual */ }
}

function inyectarBotonParaTi() {
  if (!perfil || document.querySelector('[data-filter="foryou"]')) return;
  const cont = document.querySelector('.catalog-filters');
  if (!cont) return;
  const b = document.createElement('button');
  b.className = 'filter-btn';
  b.setAttribute('data-filter', 'foryou');
  b.textContent = '✨ Para ti';
  b.addEventListener('click', () => { filtroTocado = true; aplicarFiltro('foryou'); });
  cont.insertBefore(b, cont.firstChild);
}

function activarParaTi() {
  inyectarBotonParaTi();
  aplicarFiltro('foryou');
}


// Detector inteligente de imagen y datos
function getPetData(pet) {
  const name = pet.nombre || pet.name || pet.titulo || 'Sin nombre';
  const species = (pet.especie || pet.species || pet.tipo || '').toLowerCase();
  const city = pet.ciudad || pet.city || pet.ubicacion || 'Cuernavaca';
  const description = pet.descripcion || pet.description || pet.desc || 'Este mejor amigo busca un hogar responsable y amoroso.';
  const size = pet.tamano || pet.tamaño || pet.size || 'Mediano';
  const energy = pet.energia || pet.energy || 'Media';

  // 1. Probar nombres de variables comunes
  let photo = pet.photoURL || pet.fotoUrl || pet.photoUrl || pet.imageUrl || pet.image || pet.foto || pet.photo || pet.imagen || pet.img || pet.url || pet.picture || pet.foto_url || pet.photo_url || pet.imgUrl;

  // 2. Si no la encuentra por nombre, escanea automáticamente cualquier propiedad que sea una URL de imagen
  if (!photo) {
    for (const key in pet) {
      const value = pet[key];
      if (typeof value === 'string' && (value.startsWith('http') || value.startsWith('data:image'))) {
        photo = value;
        break;
      }
    }
  }

  // 3. Solo se acepta http(s) o data:image; si no, imagen genérica
  photo = safeUrl(photo, FOTO_DEFAULT);

  return { name, photo, species, city, description, size, energy };
}

function etiquetaTamano(t) { return { pequeno: 'Pequeño', mediano: 'Mediano', grande: 'Grande' }[t] || t; }
function etiquetaEnergia(e) { return { bajo: 'Tranquilo', medio: 'Activo', alto: 'Muy activo' }[e] || e; }
function esGato(data) { return data.species.includes('gato') || data.species.includes('cat'); }

async function loadCatalog() {
  try {
    const querySnapshot = await getDocs(collection(db, "pets"));
    allPets = [];

    querySnapshot.forEach((d) => {
      const petData = { id: d.id, ...d.data() };
      // Las mascotas ya adoptadas no se muestran como disponibles
      if (petData.status !== 'adopted') allPets.push(petData);
    });

    if (allPets.length === 0) {
      catalogArea.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">Aún no hay animales disponibles. ¡Vuelve pronto!</p>';
      return;
    }

    // Enlace directo a un animal: catalogo.html?m=ID
    const directo = new URLSearchParams(window.location.search).get('m');
    if (perfil && !directo) activarParaTi();
    else { inyectarBotonParaTi(); renderPets(allPets); }
    if (directo) {
      const idx = currentPetsList.findIndex(p => p.id === directo);
      if (idx >= 0) showPetAtIndex(idx);
    }
  } catch (error) {
    console.error("Error al cargar el catálogo:", error);
    catalogArea.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">No pudimos cargar el catálogo. Intenta de nuevo en un momento.</p>';
  }
}

function renderPets(petsToRender) {
  currentPetsList = petsToRender; // Actualiza el arreglo que se navegará
  catalogArea.innerHTML = '';

  if (!petsToRender.length) {
    catalogArea.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">No hay animales con ese filtro.</p>';
    return;
  }

  petsToRender.forEach((pet, index) => {
    const data = getPetData(pet);

    const card = document.createElement('div');
    card.className = 'pet-card';
    card.innerHTML = `
      <img class="pet-card-img" src="${esc(data.photo)}" alt="${esc(data.name)}" loading="lazy">
      <div class="pet-card-body">
        <h3 class="pet-card-title">${esc(data.name)}</h3>
        <div class="pet-card-sub">
          <span>${esGato(data) ? '🐱 Gato' : '🐕 Perro'}</span> •
          <span>${esc(data.city)}</span>
        </div>
      </div>
    `;

    if (perfil && especieCompatible(perfil, pet)) {
      const sc = pet.matchScore ?? calcularMatch(perfil, pet).score;
      card.style.position = 'relative';
      card.insertAdjacentHTML('beforeend', `<span class="foryou-badge">${sc}% para ti</span>`);
    }

    // Al dar clic en una tarjeta, abre esa mascota en el modal según su posición
    card.addEventListener('click', () => showPetAtIndex(index));
    catalogArea.appendChild(card);
  });
}

// Muestra la mascota actual por su índice en la lista activa
function showPetAtIndex(index) {
  if (!currentPetsList.length) return;

  // Manejo circular del índice (si pasa de la última vuelve a la primera)
  currentIndex = (index + currentPetsList.length) % currentPetsList.length;
  const pet = currentPetsList[currentIndex];
  const data = getPetData(pet);

  const sub = [esGato(data) ? 'Gato' : 'Perro', pet.raza, pet.edad, data.city].filter(Boolean).join(' • ');
  const verificado = pet.shelterVerified === true ? ' · ✓ Refugio verificado' : '';
  const paraTi = (perfil && especieCompatible(perfil, pet))
    ? ` · ${pet.matchScore ?? calcularMatch(perfil, pet).score}% para ti` : '';

  document.getElementById('modalImg').src = data.photo;
  document.getElementById('modalName').textContent = data.name;
  document.getElementById('modalSub').textContent = sub + verificado + paraTi;
  document.getElementById('modalDesc').textContent = data.description;

  const tagsContainer = document.getElementById('modalTags');
  tagsContainer.innerHTML = `
    <span class="modal-tag">Tamaño: ${esc(etiquetaTamano(data.size))}</span>
    <span class="modal-tag">Energía: ${esc(etiquetaEnergia(data.energy))}</span>
  `;

  // "Me interesa": se recuerda la mascota y se manda a registrarse (o directo a Descubrir si ya hay sesión).
  // swipe.js guarda el like cuando la persona ya tiene perfil.
  document.getElementById('btnMatchAction').onclick = () => {
    try { sessionStorage.setItem(PENDING_KEY, pet.id); } catch (e) {}
    track('catalogo_me_interesa', { pet_id: pet.id });
    window.location.href = currentUser ? 'swipe.html' : 'auth.html';
  };

  const btnShare = document.getElementById('btnShare');
  if (btnShare) {
    btnShare.onclick = () => compartirMascota(pet, data);
  }

  const btnCard = document.getElementById('btnCard');
  if (btnCard) {
    btnCard.onclick = () => abrirTarjeta({ ...pet, photoURL: data.photo, nombre: data.name, city: data.city });
  }

  petModal.classList.add('active');
}

async function compartirMascota(pet, data) {
  const url = `${window.location.origin}${window.location.pathname}?m=${encodeURIComponent(pet.id)}`;
  const texto = `Conoce a ${data.name}, busca hogar en PetMatch 🐾`;
  track('compartir_mascota', { pet_id: pet.id });
  try {
    if (navigator.share) {
      await navigator.share({ title: `${data.name} — PetMatch`, text: texto, url });
      return;
    }
  } catch (e) {
    if (e && e.name === 'AbortError') return; // la persona canceló
  }
  window.open(`https://wa.me/?text=${encodeURIComponent(texto + ' ' + url)}`, '_blank', 'noopener');
}

// Listeners para botones de navegación
if (prevPetBtn) {
  prevPetBtn.addEventListener('click', () => showPetAtIndex(currentIndex - 1));
}

if (nextPetBtn) {
  nextPetBtn.addEventListener('click', () => showPetAtIndex(currentIndex + 1));
}

if (closeModal) {
  closeModal.addEventListener('click', () => petModal.classList.remove('active'));
}

if (petModal) {
  petModal.addEventListener('click', (e) => {
    if (e.target === petModal) petModal.classList.remove('active');
  });
}

// Eventos de teclado (flechas ← y → para cambiar de perrito)
document.addEventListener('keydown', (e) => {
  if (petModal && petModal.classList.contains('active')) {
    if (e.key === 'ArrowRight') showPetAtIndex(currentIndex + 1);
    if (e.key === 'ArrowLeft') showPetAtIndex(currentIndex - 1);
    if (e.key === 'Escape') petModal.classList.remove('active');
  }
});

// Filtros
function aplicarFiltro(filter) {
  document.querySelectorAll('.filter-btn').forEach(b => b.classList.toggle('active', b.getAttribute('data-filter') === filter));
  if (filter === 'all') {
    renderPets(allPets);
  } else if (filter === 'foryou' && perfil) {
    renderPets(ordenarPorMatch(perfil, allPets));
  } else {
    renderPets(allPets.filter(p => {
      const cat = esGato(getPetData(p));
      return filter === 'dog' ? !cat : cat;
    }));
  }
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    filtroTocado = true;
    aplicarFiltro(btn.getAttribute('data-filter'));
  });
});

loadCatalog();
