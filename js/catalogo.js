import { db, collection, getDocs } from './firebase-config.js';

const catalogArea = document.getElementById('catalogArea');
const petModal = document.getElementById('petModal');
const closeModal = document.getElementById('closeModal');

let allPets = [];

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
    const card = document.createElement('div');
    card.className = 'pet-card';
    card.innerHTML = `
      <img class="pet-card-img" src="${pet.photoUrl || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1'}" alt="${pet.name}">
      <div class="pet-card-body">
        <h3 class="pet-card-title">${pet.name || 'Sin nombre'}</h3>
        <div class="pet-card-sub">
          <span>${pet.species === 'cat' ? '🐱 Gato' : '🐕 Perro'}</span> • 
          <span>${pet.city || 'México'}</span>
        </div>
      </div>
    `;

    card.addEventListener('click', () => openPetModal(pet));
    catalogArea.appendChild(card);
  });
}

function openPetModal(pet) {
  document.getElementById('modalImg').src = pet.photoUrl || 'https://images.unsplash.com/photo-1543466835-00a7907e9de1';
  document.getElementById('modalName').textContent = pet.name || 'Mascota';
  document.getElementById('modalSub').textContent = `${pet.species === 'cat' ? 'Gato' : 'Perro'} • ${pet.city || 'Ubicación no especificada'}`;
  document.getElementById('modalDesc').textContent = pet.description || 'Esta mascota busca un hogar responsable y amoroso.';

  const tagsContainer = document.getElementById('modalTags');
  tagsContainer.innerHTML = `
    <span class="modal-tag">Tamaño: ${pet.size || 'Mediano'}</span>
    <span class="modal-tag">Energía: ${pet.energy || 'Media'}</span>
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
      const filtered = allPets.filter(p => (filter === 'dog' ? p.species !== 'cat' : p.species === 'cat'));
      renderPets(filtered);
    }
  });
});

loadCatalog();
