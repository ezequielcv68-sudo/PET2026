import { db, collection, getDocs } from './firebase-config.js';

const catalogArea = document.getElementById('catalogArea');
const petModal = document.getElementById('petModal');
const closeModal = document.getElementById('closeModal');

let allPets = [];

// Función auxiliar para obtener propiedades sin importar si están en español o inglés
function getPetData(pet) {
  const name = pet.nombre || pet.name || 'Sin nombre';
  const photo = pet.fotoUrl || pet.photoUrl || pet.imageUrl || pet.foto || pet.photo || pet.imagen || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1';
  const species = (pet.especie || pet.species || pet.tipo || '').toLowerCase();
  const city = pet.ciudad || pet.city || pet.ubicacion || 'Cuernavaca';
  const description = pet.descripcion || pet.description || 'Esta mascota busca un hogar responsable y amoroso.';
  const size = pet.tamano || pet.tamaño || pet.size || 'Mediano';
  const energy = pet.energia || pet.energy || 'Media';

  return { name, photo, species, city, description, size, energy };
}

async function loadCatalog() {
  try {
    const querySnapshot = await getDocs(collection(db, "pets"));
    allPets = [];
    
    querySnapshot.forEach((doc) => {
      allPets.push({ id: doc.id, ...doc.data() });
    });

    if (allPets.length === 0) {
      catalogArea.innerHTML = '<p style="text-align:center; grid-column: 1/-1;">Aún no hay mascotas registradas.</p>';
      return;
    }

    renderPets(allPets);
  } catch (error) {
    console.error("Error al cargar el catálogo:", error);
    catalogArea.innerHTML = `<p style="text-align:center; grid-column: 1/-1;">Error al cargar las mascotas: ${error.message}</p>`;
  }
}

function renderPets(petsToRender) {
  catalogArea.innerHTML = '';

  petsToRender.forEach(pet => {
    const data = getPetData(pet);
    const isCat = data.species.includes('gato') || data.species.includes('cat');

    const card = document.createElement('div');
    card.className = 'pet-card';
    card.innerHTML = `
      <img class="pet-card-img" src="${data.photo}" alt="${data.name}">
      <div class="pet-card-body">
        <h3 class="pet-card-title">${data.name}</h3>
        <div class="pet-card-sub">
          <span>${isCat ? '🐱 Gato' : '🐕 Perro'}</span> • 
          <span>${data.city}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openPetModal(pet));
    catalogArea.appendChild(card);
  });
}

function openPetModal(pet) {
  const data = getPetData(pet);
  const isCat = data.species.includes('gato') || data.species.includes('cat');

  document.getElementById('modalImg').src = data.photo;
  document.getElementById('modalName').textContent = data.name;
  document.getElementById('modalSub').textContent = `${isCat ? 'Gato' : 'Perro'} • ${data.city}`;
  document.getElementById('modalDesc').textContent = data.description;

  const tagsContainer = document.getElementById('modalTags');
  tagsContainer.innerHTML = `
    <span class="modal-tag">Tamaño: ${data.size}</span>
    <span class="modal-tag">Energía: ${data.energy}</span>
  `;

  document.getElementById('btnMatchAction').onclick = () => {
    window.location.href = 'auth.html';
  };

  petModal.classList.add('active');
}

if (closeModal) {
  closeModal.addEventListener('click', () => petModal.classList.remove('active'));
}

if (petModal) {
  petModal.addEventListener('click', (e) => {
    if (e.target === petModal) petModal.classList.remove('active');
  });
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', (e) => {
    document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
    e.target.classList.add('active');

    const filter = e.target.getAttribute('data-filter');
    if (filter === 'all') {
      renderPets(allPets);
    } else {
      const filtered = allPets.filter(p => {
        const data = getPetData(p);
        const isCat = data.species.includes('gato') || data.species.includes('cat');
        return filter === 'dog' ? !isCat : isCat;
      });
      renderPets(filtered);
    }
  });
});

loadCatalog();
