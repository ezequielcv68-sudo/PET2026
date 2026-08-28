// ============================================================
// MOTOR DE MATCH — PatitasMatch
// ------------------------------------------------------------
// Calcula un puntaje de compatibilidad (0–100) entre el perfil
// de estilo de vida del adoptante y cada mascota del refugio,
// cruzando espacio disponible, energía, experiencia, niños,
// otras mascotas y distancia geográfica.
//
// Esto corre 100% en el navegador (gratis, instantáneo, sin
// necesitar servidor). Es el mismo tipo de lógica de "scoring"
// que usan apps de matchmaking reales antes de mandar los
// resultados a un modelo de lenguaje. Ver README.md → sección
// "Siguiente nivel con IA generativa" para sumar explicaciones
// de match escritas por un LLM (requiere backend/API key).
// ============================================================

const PESOS = {
  tamano: 20,
  energia: 20,
  vivienda: 15,
  ninos: 10,
  otrasMascotas: 10,
  experiencia: 10,
  horasSolo: 5,
  distancia: 10,
};

const ORDEN_TAMANO = ["pequeno", "mediano", "grande"];
const ORDEN_ENERGIA = ["bajo", "medio", "alto"];

function puntosPorCercania(ordenLista, valorA, valorB) {
  if (!valorA || !valorB || valorA === "cualquiera" || valorB === "cualquiera") return 1;
  const iA = ordenLista.indexOf(valorA);
  const iB = ordenLista.indexOf(valorB);
  if (iA === -1 || iB === -1) return 0.6;
  const dist = Math.abs(iA - iB);
  if (dist === 0) return 1;
  if (dist === 1) return 0.55;
  return 0.15;
}

// Compatibilidad vivienda × (tamaño + energía de la mascota)
function puntosVivienda(vivienda, tamanoPet, energiaPet) {
  const tabla = {
    depto: { pequeno: 1, mediano: 0.6, grande: 0.2 },
    casa_sin_patio: { pequeno: 1, mediano: 0.75, grande: 0.4 },
    casa_patio_chico: { pequeno: 1, mediano: 0.9, grande: 0.65 },
    casa_patio_grande: { pequeno: 1, mediano: 1, grande: 1 },
  };
  let base = tabla[vivienda]?.[tamanoPet] ?? 0.6;
  // Espacios chicos + mascota muy energética castiga un poco más
  if ((vivienda === "depto" || vivienda === "casa_sin_patio") && energiaPet === "alto") {
    base = Math.max(0, base - 0.2);
  }
  return base;
}

function haversineKm(lat1, lng1, lat2, lng2) {
  const R = 6371;
  const dLat = (lat2 - lat1) * Math.PI / 180;
  const dLng = (lng2 - lng1) * Math.PI / 180;
  const a = Math.sin(dLat / 2) ** 2 +
    Math.cos(lat1 * Math.PI / 180) * Math.cos(lat2 * Math.PI / 180) *
    Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function puntosDistancia(perfil, pet) {
  if (!perfil.lat || !perfil.lng || !pet.lat || !pet.lng) return 0.7; // sin datos, neutral
  const km = haversineKm(perfil.lat, perfil.lng, pet.lat, pet.lng);
  if (km <= 5) return 1;
  if (km <= 15) return 0.85;
  if (km <= 30) return 0.65;
  if (km <= 60) return 0.4;
  return 0.2;
}

/**
 * Filtra si la especie es incompatible de raíz (no se le muestra al usuario).
 */
export function especieCompatible(perfil, pet) {
  if (!perfil.especiePreferida || perfil.especiePreferida === "cualquiera") return true;
  return perfil.especiePreferida === pet.especie;
}

/**
 * Devuelve { score: 0-100, breakdown: {...} }
 */
export function calcularMatch(perfil, pet) {
  const bTamano = puntosPorCercania(ORDEN_TAMANO, perfil.tamanoPreferido, pet.tamano);
  const bEnergia = puntosPorCercania(ORDEN_ENERGIA, perfil.energia, pet.energia);
  const bVivienda = puntosVivienda(perfil.vivienda, pet.tamano, pet.energia);
  const bNinos = (perfil.ninos === "si" && pet.buenoConNinos === false) ? 0.1 : 1;
  const bOtrasMascotas = (perfil.otrasMascotas === "si" && pet.buenoConOtrasMascotas === false) ? 0.15 : 1;

  const dificultadPeso = { primera_vez: 0, algo: 1, mucha: 2 };
  const dificultadPet = { facil: 0, moderado: 1, dificil: 2 };
  const dExp = Math.abs((dificultadPeso[perfil.experiencia] ?? 1) - (dificultadPet[pet.nivelDificultad] ?? 0));
  const bExperiencia = dExp === 0 ? 1 : dExp === 1 ? 0.6 : 0.25;

  const bHoras = (perfil.horasSolo === "mas8" && pet.energia === "alto") ? 0.4 : 1;
  const bDistancia = puntosDistancia(perfil, pet);

  const breakdown = {
    tamano: bTamano, energia: bEnergia, vivienda: bVivienda,
    ninos: bNinos, otrasMascotas: bOtrasMascotas, experiencia: bExperiencia,
    horasSolo: bHoras, distancia: bDistancia,
  };

  let total = 0;
  for (const key in PESOS) {
    total += (breakdown[key] ?? 0.5) * PESOS[key];
  }

  return { score: Math.round(Math.max(5, Math.min(100, total))), breakdown };
}

/**
 * Ordena una lista de mascotas por compatibilidad descendente.
 * Devuelve cada mascota con .matchScore agregado.
 */
export function ordenarPorMatch(perfil, mascotas) {
  return mascotas
    .filter(pet => especieCompatible(perfil, pet))
    .map(pet => ({ ...pet, matchScore: calcularMatch(perfil, pet).score }))
    .sort((a, b) => b.matchScore - a.matchScore);
}
