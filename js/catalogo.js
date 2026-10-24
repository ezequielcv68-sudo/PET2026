import {
  db, auth, collection, getDocs, onAuthStateChanged, doc, getDoc,
  track, esc, safeUrl, PENDING_KEY, GUEST_KEY,
} from './firebase-config.js';
import { abrirTarjeta } from './sharecard.js';
import { calcularMatch, ordenarPorMatch, especieCompatible, kmHasta } from './matching.js';
import {
  ESTADOS, centroEstado, estadoDeMascota, coordsMascota, textoDistancia, textoUbicacion,
  puntoAdoptante, guardarUbicacion, leerUbicacion, pedirGPS, estadoMasCercano, urlGoogleMaps, urlComoLlegar,
} from './geo.js';

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
    else if (allPets.length) { inyectarBotonParaTi(); refrescar(); }
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
    montarPanel();
    if (perfil && !directo) activarParaTi();
    else { inyectarBotonParaTi(); aplicarFiltro('all'); }
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
      <img class="pet-card-img" src="${esc(data.photo)}" alt="${esc(data.name)}" loading="lazy" decoding="async">
      <div class="pet-card-body">
        <h3 class="pet-card-title">${esc(data.name)}</h3>
        <div class="pet-card-sub">
          <span>${esGato(data) ? '🐱 Gato' : '🐕 Perro'}</span> •
          <span>📍 ${esc(textoUbicacion(pet) || data.city)}</span>
        </div>
        ${etiquetaCerca(pet)}
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

  const km = kmPreciso(pet);
  const sub = [esGato(data) ? 'Gato' : 'Perro', pet.raza, pet.edad, textoUbicacion(pet) || data.city, km != null ? textoDistancia(km) : ''].filter(Boolean).join(' • ');
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
    ${urlGoogleMaps(pet) ? `<a class="modal-tag geo-link" href="${esc(urlGoogleMaps(pet))}" target="_blank" rel="noopener">🗺️ Ver en Google Maps</a>
    <a class="modal-tag geo-link" href="${esc(urlComoLlegar(pet))}" target="_blank" rel="noopener">🧭 Cómo llegar</a>` : ''}
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
  fil.paraTi = filter === 'foryou' && !!perfil;
  fil.especie = (filter === 'dog' || filter === 'cat') ? filter : 'all';
  refrescar();
}

document.querySelectorAll('.filter-btn').forEach(btn => {
  btn.addEventListener('click', () => {
    filtroTocado = true;
    aplicarFiltro(btn.getAttribute('data-filter'));
  });
});


// ============================================================
// UBICACIÓN, FILTROS Y MAPA
// ============================================================
const fil = { especie: 'all', paraTi: false, estado: '', tamano: '', energia: '', edad: '', orden: 'auto', vista: 'lista' };

function refPerfil() { return perfil || {}; }
function kmDe(pet) { return kmHasta(refPerfil(), pet); }
// Distancia mostrable: solo si se conoce la ciudad o el GPS (con solo el estado sería inventar precisión)
function kmPreciso(pet) { const r = puntoAdoptante(refPerfil()); return r && !r.aprox ? kmDe(pet) : null; }

function etiquetaCerca(pet) {
  const ref = puntoAdoptante(refPerfil());
  if (!ref) return '';
  const km = kmDe(pet);
  const mismo = ref.estado && ref.estado === estadoDeMascota(pet);
  if (km != null && !ref.aprox && km <= 60) return `<div class="geo-chip near">🎯 ${textoDistancia(km)}</div>`;
  if (mismo) return `<div class="geo-chip same">📍 En tu estado</div>`;
  if (km != null && !ref.aprox) return `<div class="geo-chip far">${textoDistancia(km)}</div>`;
  return '';
}

function categoriaEdad(txt) {
  const t = String(txt || '').toLowerCase();
  if (/cachorr|bebe|bebé/.test(t)) return 'cachorro';
  if (/senior|sénior|viejit|anciano/.test(t)) return 'senior';
  const n = parseFloat((t.match(/(\d+([.,]\d+)?)/) || [])[1]?.replace(',', '.'));
  if (isNaN(n)) return '';
  const meses = /mes/.test(t) && !/a(ñ|n)o/.test(t);
  const anios = meses ? n / 12 : n;
  if (anios < 1) return 'cachorro';
  if (anios <= 3) return 'joven';
  if (anios < 8) return 'adulto';
  return 'senior';
}
function normTam(p) { return String(p.tamano || '').toLowerCase().replace('ñ', 'n'); }

function pasaFiltros(p, saltar) {
  if (fil.especie === 'dog' && esGato(getPetData(p))) return false;
  if (fil.especie === 'cat' && !esGato(getPetData(p))) return false;
  if (saltar !== 'estado' && fil.estado && estadoDeMascota(p) !== fil.estado) return false;
  if (fil.tamano && normTam(p) !== fil.tamano) return false;
  if (fil.energia && p.energia !== fil.energia) return false;
  if (fil.edad && categoriaEdad(p.edad) !== fil.edad) return false;
  return true;
}

function refrescar() {
  let lista = allPets.filter(p => pasaFiltros(p));
  if (fil.paraTi && perfil) lista = ordenarPorMatch(perfil, lista);
  const ref = puntoAdoptante(refPerfil());
  const orden = fil.orden === 'auto' ? (fil.paraTi ? 'matchear' : (ref ? 'cerca' : 'ninguno')) : fil.orden;
  if (orden === 'cerca' && ref) {
    lista = [...lista].sort((a, b) => (kmDe(a) ?? 1e9) - (kmDe(b) ?? 1e9));
  } else if (orden === 'nuevos') {
    const t = (p) => (p.createdAt && p.createdAt.toMillis ? p.createdAt.toMillis() : 0);
    lista = [...lista].sort((a, b) => t(b) - t(a));
  } else if (orden === 'paraTi' && perfil) {
    lista = ordenarPorMatch(perfil, lista);
  }
  if (fil.vista === 'mapa') renderMapa(lista); else { ocultarMapa(); renderPets(lista); }
  actualizarPanel(lista);
}

function montarPanel() {
  if (document.getElementById('geoPanel')) return;
  const filtros = document.querySelector('.catalog-filters');
  if (!filtros) return;
  const opts = (arr) => arr.map(([v, t]) => `<option value="${v}">${t}</option>`).join('');
  const panel = document.createElement('div');
  panel.id = 'geoPanel';
  panel.innerHTML = `
    <div class="geo-top">
      <select id="gEstadoTu" class="geo-pill" aria-label="Tu estado"><option value="">📍 ¿Dónde estás?</option>${ESTADOS.map(e => `<option value="${e.n}">📍 ${e.n}</option>`).join('')}</select>
      <button type="button" id="gGPS" class="geo-icon" title="Usar mi ubicación" aria-label="Usar mi ubicación">🎯</button>
      <button type="button" id="gFiltrosBtn" class="geo-pill geo-toggle" aria-expanded="false">⚙️ Filtros<span id="gFiltrosN" class="geo-n" style="display:none"></span></button>
      <div class="geo-view">
        <button type="button" data-vista="lista" class="on">🧱 Lista</button>
        <button type="button" data-vista="mapa">🗺️ Mapa</button>
      </div>
    </div>
    <div id="geoFiltros" class="geo-filters" style="display:none">
      <select id="fEstado" aria-label="Estado"></select>
      <select id="fTamano" aria-label="Tamaño"><option value="">Cualquier tamaño</option>${opts([['pequeno','Pequeño'],['mediano','Mediano'],['grande','Grande']])}</select>
      <select id="fEnergia" aria-label="Energía"><option value="">Cualquier energía</option>${opts([['bajo','Tranquilo'],['medio','Activo'],['alto','Muy activo']])}</select>
      <select id="fEdad" aria-label="Edad"><option value="">Cualquier edad</option>${opts([['cachorro','Cachorro (menos de 1 año)'],['joven','Joven (1 a 3 años)'],['adulto','Adulto (4 a 7 años)'],['senior','Senior (8 años o más)']])}</select>
      <select id="fOrden" aria-label="Ordenar por">${opts([['auto','Orden recomendado'],['cerca','📍 Más cerca de mí'],['paraTi','✨ Más compatibles'],['nuevos','🆕 Más recientes']])}</select>
      <div class="geo-links"><button type="button" id="gLimpiar" class="geo-link-btn">Limpiar filtros</button><button type="button" id="gQuitar" class="geo-link-btn" style="display:none">Quitar mi ubicación</button></div>
    </div>
    <div id="resultCount" class="geo-count"></div>
    <span id="geoTxt" style="display:none"></span>
    <div id="petMapWrap" style="display:none"><div id="petMap"></div><p class="geo-note">Los pines muestran el municipio de cada animal, nunca una dirección exacta.</p></div>`;
  filtros.insertAdjacentElement('afterend', panel);

  const $ = (id) => document.getElementById(id);
  $('fTamano').onchange = (e) => { fil.tamano = e.target.value; refrescar(); };
  $('fEnergia').onchange = (e) => { fil.energia = e.target.value; refrescar(); };
  $('fEdad').onchange = (e) => { fil.edad = e.target.value; refrescar(); };
  $('fOrden').onchange = (e) => { fil.orden = e.target.value; refrescar(); };
  $('fEstado').onchange = (e) => { fil.estado = e.target.value; refrescar(); };
  panel.querySelectorAll('.geo-view button').forEach(b => b.onclick = () => {
    fil.vista = b.dataset.vista;
    panel.querySelectorAll('.geo-view button').forEach(x => x.classList.toggle('on', x === b));
    refrescar();
  });
  $('gEstadoTu').onchange = (e) => {
    const c = centroEstado(e.target.value);
    if (c) guardarUbicacion({ estado: c.n, lat: c.lat, lng: c.lng, gps: false, aprox: true });
    else guardarUbicacion(null);
    track('ubicacion_estado', { estado: e.target.value });
    reordenarPorUbicacion();
  };
  $('gGPS').onclick = async () => {
    const btn = $('gGPS'); btn.disabled = true; btn.textContent = 'Buscando…';
    try {
      const p = await pedirGPS();
      guardarUbicacion({ estado: estadoMasCercano(p), lat: +p.lat.toFixed(3), lng: +p.lng.toFixed(3), gps: true });
      track('ubicacion_gps');
      reordenarPorUbicacion();
    } catch (e) {
      $('geoTxt').textContent = 'No pudimos ubicarte. Elige tu estado en la lista.';
    } finally { btn.disabled = false; btn.textContent = '🎯 Usar mi ubicación'; }
  };
  $('gQuitar').onclick = () => { guardarUbicacion(null); $('gEstadoTu').value = ''; reordenarPorUbicacion(); };
  $('gFiltrosBtn').onclick = () => {
    const f = $('geoFiltros'); const abrir = f.style.display === 'none';
    f.style.display = abrir ? '' : 'none';
    $('gFiltrosBtn').setAttribute('aria-expanded', String(abrir));
  };
  $('gLimpiar').onclick = () => {
    Object.assign(fil, { estado: '', tamano: '', energia: '', edad: '', orden: 'auto' });
    ['fTamano', 'fEnergia', 'fEdad'].forEach(id => $(id).value = '');
    $('fOrden').value = 'auto';
    refrescar();
  };
  // Si ya había ubicación guardada, se refleja
  const u = leerUbicacion();
  if (u && u.estado) $('gEstadoTu').value = u.estado;
}

function reordenarPorUbicacion() {
  fil.orden = 'auto';
  const o = document.getElementById('fOrden'); if (o) o.value = 'auto';
  refrescar();
}

function actualizarPanel(lista) {
  const $ = (id) => document.getElementById(id);
  if (!$('geoPanel')) return;
  const ref = puntoAdoptante(refPerfil());
  const txt = $('geoTxt');
  if (ref && ref.estado) {
    txt.textContent = ref.gps ? `Estás cerca de ${ref.estado}. Te mostramos primero lo más cercano.` : `Tu estado: ${ref.estado}. Te mostramos primero los de tu zona.`;
  } else if (ref) {
    txt.textContent = 'Ordenado por cercanía a tu ciudad.';
  } else {
    txt.textContent = 'Dinos dónde estás y ordenamos por cercanía';
  }
  const tieneU = !!leerUbicacion();
  $('gQuitar').style.display = tieneU ? '' : 'none';
  const nAct = [fil.estado, fil.tamano, fil.energia, fil.edad, fil.orden !== 'auto' ? fil.orden : ''].filter(Boolean).length;
  const bd = $('gFiltrosN'); bd.textContent = nAct; bd.style.display = nAct ? '' : 'none';
  if (ref && ref.estado && $('gEstadoTu').value !== ref.estado && !leerUbicacion()) $('gEstadoTu').value = ref.estado;

  // Estados con animales (con conteo según los demás filtros)
  const conteo = {};
  allPets.filter(p => pasaFiltros(p, 'estado')).forEach(p => { const e = estadoDeMascota(p) || 'Sin estado'; conteo[e] = (conteo[e] || 0) + 1; });
  const total = Object.values(conteo).reduce((a, b) => a + b, 0);
  const sel = $('fEstado');
  const nombres = Object.keys(conteo).sort((a, b) => a.localeCompare(b, 'es'));
  if (fil.estado && !conteo[fil.estado]) nombres.push(fil.estado);
  sel.innerHTML = `<option value="">Todos los estados (${total})</option>` +
    nombres.filter(n => n !== 'Sin estado').map(n => `<option value="${n}">${n} (${conteo[n] || 0})</option>`).join('');
  sel.value = fil.estado;

  const enTuEstado = ref && ref.estado ? lista.filter(p => estadoDeMascota(p) === ref.estado).length : null;
  $('resultCount').textContent = `${lista.length} ${lista.length === 1 ? 'animal' : 'animales'}` + (enTuEstado != null ? ` · ${enTuEstado} en tu estado` : '');
}

// ---------- Mapa (Leaflet + OpenStreetMap: gratis y sin llaves) ----------
let mapa = null, capaPines = null, leafletListo = null;
function cargarLeaflet() {
  if (window.L) return Promise.resolve();
  if (leafletListo) return leafletListo;
  leafletListo = new Promise((ok, mal) => {
    const css = document.createElement('link');
    css.rel = 'stylesheet'; css.href = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.css';
    document.head.appendChild(css);
    const js = document.createElement('script');
    js.src = 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.9.4/leaflet.min.js';
    js.onload = ok; js.onerror = () => mal(new Error('leaflet'));
    document.head.appendChild(js);
  });
  return leafletListo;
}
function ocultarMapa() { const w = document.getElementById('petMapWrap'); if (w) w.style.display = 'none'; catalogArea.style.display = ''; }

async function renderMapa(lista) {
  currentPetsList = lista;
  const wrap = document.getElementById('petMapWrap');
  wrap.style.display = ''; catalogArea.style.display = 'none';
  try { await cargarLeaflet(); } catch (e) {
    wrap.innerHTML = '<p class="geo-note">No pudimos cargar el mapa. Revisa tu conexión o usa la vista de lista.</p>'; return;
  }
  const L = window.L;
  if (!mapa) {
    mapa = L.map('petMap', { scrollWheelZoom: false }).setView([23.6, -102.5], 5);
    L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 18, attribution: '© OpenStreetMap' }).addTo(mapa);
  }
  if (capaPines) capaPines.remove();
  capaPines = L.layerGroup().addTo(mapa);
  const usados = {};
  const puntos = [];
  lista.forEach((pet, idx) => {
    const c = coordsMascota(pet); if (!c) return;
    const k = c.lat.toFixed(2) + ',' + c.lng.toFixed(2);
    const n = usados[k] = (usados[k] || 0) + 1;
    // Si varios están en el mismo municipio, se abren en abanico para verlos todos
    const ang = n * 2.4, r = n > 1 ? 0.012 * Math.sqrt(n) : 0;
    const lat = c.lat + Math.sin(ang) * r, lng = c.lng + Math.cos(ang) * r;
    const d = getPetData(pet);
    const icon = L.divIcon({ className: 'pm-pin', html: `<img src="${esc(d.photo)}" alt="">`, iconSize: [46, 46], iconAnchor: [23, 46], popupAnchor: [0, -44] });
    const km = kmPreciso(pet);
    const html = `<div class="pm-pop"><b>${esc(d.name)}</b><br><span>${esGato(d) ? '🐱' : '🐕'} ${esc(textoUbicacion(pet) || d.city)}${km != null ? ' · ' + esc(textoDistancia(km)) : ''}</span><br>
      <button type="button" class="pm-ver" data-i="${idx}">Ver ficha</button>
      <a href="${esc(urlGoogleMaps(pet))}" target="_blank" rel="noopener">Google Maps</a></div>`;
    L.marker([lat, lng], { icon }).addTo(capaPines).bindPopup(html);
    puntos.push([lat, lng]);
  });
  const ref = puntoAdoptante(refPerfil());
  if (ref) { L.circleMarker([ref.lat, ref.lng], { radius: 8, color: '#fff', weight: 3, fillColor: '#2f7bf5', fillOpacity: 1 }).addTo(capaPines).bindTooltip('Tú'); if (!ref.aprox) puntos.push([ref.lat, ref.lng]); }
  setTimeout(() => {
    mapa.invalidateSize();
    if (puntos.length > 1) mapa.fitBounds(puntos, { padding: [40, 40], maxZoom: 11 });
    else if (puntos.length === 1) mapa.setView(puntos[0], 10);
  }, 60);
}
document.addEventListener('click', (e) => {
  const b = e.target.closest && e.target.closest('.pm-ver');
  if (b) showPetAtIndex(+b.dataset.i);
});

loadCatalog();
