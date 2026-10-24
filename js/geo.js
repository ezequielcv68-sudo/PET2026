// ============================================================
// UBICACIÓN — PetMatch
// Sin llaves de API ni costo: estados de México con su centro,
// ciudades frecuentes, distancia en km, geocodificación opcional
// (OpenStreetMap/Nominatim) y enlaces a Google Maps.
// Este archivo no depende de Firebase.
// ============================================================

export const ESTADOS = [
  { n: "Aguascalientes", lat: 21.88, lng: -102.29 },
  { n: "Baja California", lat: 30.84, lng: -115.28 },
  { n: "Baja California Sur", lat: 25.84, lng: -111.83 },
  { n: "Campeche", lat: 19.35, lng: -90.52 },
  { n: "Chiapas", lat: 16.75, lng: -93.12 },
  { n: "Chihuahua", lat: 28.63, lng: -106.07 },
  { n: "Ciudad de México", lat: 19.43, lng: -99.13 },
  { n: "Coahuila", lat: 27.06, lng: -101.71 },
  { n: "Colima", lat: 19.24, lng: -103.72 },
  { n: "Durango", lat: 24.02, lng: -104.66 },
  { n: "Estado de México", lat: 19.29, lng: -99.65 },
  { n: "Guanajuato", lat: 21.02, lng: -101.26 },
  { n: "Guerrero", lat: 17.44, lng: -99.55 },
  { n: "Hidalgo", lat: 20.09, lng: -98.76 },
  { n: "Jalisco", lat: 20.66, lng: -103.35 },
  { n: "Michoacán", lat: 19.57, lng: -101.71 },
  { n: "Morelos", lat: 18.68, lng: -99.10 },
  { n: "Nayarit", lat: 21.75, lng: -104.85 },
  { n: "Nuevo León", lat: 25.59, lng: -99.99 },
  { n: "Oaxaca", lat: 17.07, lng: -96.72 },
  { n: "Puebla", lat: 19.04, lng: -98.21 },
  { n: "Querétaro", lat: 20.59, lng: -100.39 },
  { n: "Quintana Roo", lat: 19.18, lng: -88.48 },
  { n: "San Luis Potosí", lat: 22.15, lng: -100.98 },
  { n: "Sinaloa", lat: 25.00, lng: -107.50 },
  { n: "Sonora", lat: 29.30, lng: -110.33 },
  { n: "Tabasco", lat: 17.84, lng: -92.62 },
  { n: "Tamaulipas", lat: 24.27, lng: -98.84 },
  { n: "Tlaxcala", lat: 19.32, lng: -98.24 },
  { n: "Veracruz", lat: 19.17, lng: -96.13 },
  { n: "Yucatán", lat: 20.70, lng: -89.09 },
  { n: "Zacatecas", lat: 22.77, lng: -102.58 },
];

// Ciudades y municipios frecuentes: [nombre, estado, lat, lng]
const CIUDADES = [
  // Morelos
  ["Cuernavaca", "Morelos", 18.9186, -99.2342], ["Temixco", "Morelos", 18.8550, -99.2340],
  ["Jiutepec", "Morelos", 18.8830, -99.1770], ["Cuautla", "Morelos", 18.8120, -98.9540],
  ["Yautepec", "Morelos", 18.8860, -99.0670], ["Xochitepec", "Morelos", 18.7830, -99.2350],
  ["Emiliano Zapata", "Morelos", 18.8330, -99.1830], ["Zacatepec", "Morelos", 18.6500, -99.1830],
  ["Jojutla", "Morelos", 18.6130, -99.1810], ["Tepoztlán", "Morelos", 18.9850, -99.0960],
  ["Tlaltizapán", "Morelos", 18.6870, -99.1260], ["Ayala", "Morelos", 18.7690, -98.9830],
  ["Huitzilac", "Morelos", 19.0000, -99.2670], ["Puente de Ixtla", "Morelos", 18.6200, -99.3200],
  // Puebla
  ["Atlixco", "Puebla", 18.9080, -98.4330], ["Puebla", "Puebla", 19.0414, -98.2063],
  ["Cholula", "Puebla", 19.0630, -98.3060], ["Tehuacán", "Puebla", 18.4630, -97.3930],
  ["Izúcar de Matamoros", "Puebla", 18.6000, -98.4630], ["Teziutlán", "Puebla", 19.8190, -97.3570],
  ["San Martín Texmelucan", "Puebla", 19.2830, -98.4380], ["Huaquechula", "Puebla", 18.7670, -98.5830],
  // CDMX y Edomex
  ["Ciudad de México", "Ciudad de México", 19.4326, -99.1332], ["CDMX", "Ciudad de México", 19.4326, -99.1332],
  ["Toluca", "Estado de México", 19.2826, -99.6557], ["Naucalpan", "Estado de México", 19.4785, -99.2396],
  ["Ecatepec", "Estado de México", 19.6010, -99.0600], ["Nezahualcóyotl", "Estado de México", 19.4000, -99.0140],
  ["Tlalnepantla", "Estado de México", 19.5400, -99.1950], ["Texcoco", "Estado de México", 19.5160, -98.8820],
  // Capitales y ciudades grandes
  ["Guadalajara", "Jalisco", 20.6597, -103.3496], ["Zapopan", "Jalisco", 20.7214, -103.3918],
  ["Monterrey", "Nuevo León", 25.6866, -100.3161], ["San Pedro Garza García", "Nuevo León", 25.6573, -100.4020],
  ["Tijuana", "Baja California", 32.5149, -117.0382], ["Mexicali", "Baja California", 32.6245, -115.4523],
  ["Mérida", "Yucatán", 20.9674, -89.5926], ["Cancún", "Quintana Roo", 21.1619, -86.8515],
  ["Querétaro", "Querétaro", 20.5888, -100.3899], ["León", "Guanajuato", 21.1250, -101.6860],
  ["Guanajuato", "Guanajuato", 21.0190, -101.2574], ["Celaya", "Guanajuato", 20.5230, -100.8157],
  ["Pachuca", "Hidalgo", 20.1011, -98.7591], ["Tlaxcala", "Tlaxcala", 19.3182, -98.2375],
  ["Veracruz", "Veracruz", 19.1738, -96.1342], ["Xalapa", "Veracruz", 19.5438, -96.9102],
  ["Oaxaca", "Oaxaca", 17.0732, -96.7266], ["Chilpancingo", "Guerrero", 17.5506, -99.5058],
  ["Acapulco", "Guerrero", 16.8531, -99.8237], ["Taxco", "Guerrero", 18.5560, -99.6050],
  ["Morelia", "Michoacán", 19.7060, -101.1950], ["Colima", "Colima", 19.2433, -103.7250],
  ["Aguascalientes", "Aguascalientes", 21.8853, -102.2916], ["San Luis Potosí", "San Luis Potosí", 22.1565, -100.9855],
  ["Zacatecas", "Zacatecas", 22.7709, -102.5833], ["Durango", "Durango", 24.0277, -104.6532],
  ["Saltillo", "Coahuila", 25.4232, -101.0053], ["Torreón", "Coahuila", 25.5428, -103.4068],
  ["Chihuahua", "Chihuahua", 28.6353, -106.0889], ["Ciudad Juárez", "Chihuahua", 31.6904, -106.4245],
  ["Hermosillo", "Sonora", 29.0729, -110.9559], ["Culiacán", "Sinaloa", 24.8091, -107.3940],
  ["Mazatlán", "Sinaloa", 23.2494, -106.4111], ["Tepic", "Nayarit", 21.5040, -104.8946],
  ["Villahermosa", "Tabasco", 17.9892, -92.9475], ["Tuxtla Gutiérrez", "Chiapas", 16.7528, -93.1152],
  ["Campeche", "Campeche", 19.8454, -90.5237], ["La Paz", "Baja California Sur", 24.1426, -110.3128],
  ["Ciudad Victoria", "Tamaulipas", 23.7369, -99.1411],
];

const quitar = (s) => String(s || "").normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase().trim();
const ALIAS_ESTADO = { "edomex": "Estado de México", "estado de mexico": "Estado de México", "mexico": "Estado de México", "cdmx": "Ciudad de México", "df": "Ciudad de México", "distrito federal": "Ciudad de México", "nl": "Nuevo León", "bc": "Baja California", "bcs": "Baja California Sur", "qroo": "Quintana Roo", "slp": "San Luis Potosí" };

export function centroEstado(estado) {
  return ESTADOS.find((e) => e.n === estado) || null;
}

/** Normaliza un texto a un nombre de estado válido (o ""). */
export function normalizarEstado(texto) {
  const t = quitar(texto);
  if (!t) return "";
  const dir = ESTADOS.find((e) => quitar(e.n) === t);
  if (dir) return dir.n;
  return ALIAS_ESTADO[t] || "";
}

/** Busca una ciudad conocida dentro de un texto libre. */
function buscarCiudad(texto) {
  const t = " " + quitar(texto).replace(/[^a-z0-9ñ ]+/g, " ") + " ";
  let mejor = null;
  for (const c of CIUDADES) {
    const n = " " + quitar(c[0]) + " ";
    if (t.includes(n) && (!mejor || c[0].length > mejor[0].length)) mejor = c;
  }
  return mejor;
}

/** Deduce el estado desde el texto de ciudad que ya existía («Cuernavaca, Morelos»). */
export function inferirEstado(texto) {
  const t = quitar(texto).replace(/[^a-z0-9ñ ]+/g, " ");
  if (!t.trim()) return "";
  // Primero, un estado escrito tal cual (el más largo gana: «Baja California Sur» antes que «Baja California»)
  const porLargo = [...ESTADOS].sort((a, b) => b.n.length - a.n.length);
  for (const e of porLargo) if ((" " + t + " ").includes(" " + quitar(e.n) + " ")) return e.n;
  const c = buscarCiudad(texto);
  if (c) return c[1];
  for (const k of Object.keys(ALIAS_ESTADO)) if ((" " + t + " ").includes(" " + k + " ")) return ALIAS_ESTADO[k];
  return "";
}

/** Estado de una mascota: el guardado o el deducido de su ciudad. */
export function estadoDeMascota(pet) {
  return normalizarEstado(pet && pet.estado) || inferirEstado(pet && (pet.city || pet.ciudad || pet.ubicacion)) || "";
}

/** Coordenadas de una mascota: exactas, de su ciudad conocida o del centro de su estado. */
export function coordsMascota(pet) {
  if (!pet) return null;
  if (isFinite(pet.lat) && isFinite(pet.lng) && pet.lat && pet.lng) return { lat: +pet.lat, lng: +pet.lng, exacta: true };
  const c = buscarCiudad(pet.city || pet.ciudad || pet.municipio || "");
  if (c) return { lat: c[2], lng: c[3], exacta: false };
  const e = centroEstado(estadoDeMascota(pet));
  return e ? { lat: e.lat, lng: e.lng, exacta: false, aprox: true } : null;
}

export function distanciaKm(a, b) {
  if (!a || !b) return null;
  const R = 6371, rad = Math.PI / 180;
  const dLat = (b.lat - a.lat) * rad, dLng = (b.lng - a.lng) * rad;
  const x = Math.sin(dLat / 2) ** 2 + Math.cos(a.lat * rad) * Math.cos(b.lat * rad) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(x), Math.sqrt(1 - x));
}

export function textoDistancia(km) {
  if (km == null) return "";
  if (km < 1) return "a menos de 1 km";
  if (km < 10) return `a ${km.toFixed(1).replace(".0", "")} km`;
  return `a ${Math.round(km)} km`;
}

/** «Cuernavaca, Morelos» sin repetir si ya viene el estado dentro del texto. */
export function textoUbicacion(pet) {
  const mun = (pet && (pet.municipio || pet.city || pet.ciudad || "")) + "";
  const est = estadoDeMascota(pet);
  if (!mun && !est) return "";
  if (!est || quitar(mun).includes(quitar(est))) return mun || est;
  return mun ? `${mun}, ${est}` : est;
}

// ---------- Ubicación de quien navega (se guarda solo en su navegador) ----------
const CLAVE = "pm_ubicacion";
export function leerUbicacion() {
  try { return JSON.parse(localStorage.getItem(CLAVE) || "null"); } catch (e) { return null; }
}
export function guardarUbicacion(u) {
  try { if (u) localStorage.setItem(CLAVE, JSON.stringify(u)); else localStorage.removeItem(CLAVE); } catch (e) {}
}

/** Punto de referencia del adoptante: GPS > ciudad escrita > centro del estado. */
export function puntoAdoptante(perfil) {
  const u = leerUbicacion();
  if (u && isFinite(u.lat) && isFinite(u.lng)) return { lat: u.lat, lng: u.lng, estado: u.estado || "", gps: !!u.gps, aprox: !!u.aprox };
  if (perfil && isFinite(perfil.lat) && isFinite(perfil.lng) && perfil.lat && perfil.lng) return { lat: +perfil.lat, lng: +perfil.lng, estado: normalizarEstado(perfil.estado) || inferirEstado(perfil.city), gps: false };
  const est = (u && u.estado) || normalizarEstado(perfil && perfil.estado) || inferirEstado(perfil && perfil.city);
  const c = (perfil && buscarCiudad(perfil.city || "")) || null;
  if (c) return { lat: c[2], lng: c[3], estado: est || c[1], gps: false };
  const e = centroEstado(est);
  return e ? { lat: e.lat, lng: e.lng, estado: est, gps: false, aprox: true } : null;
}

/** Pide al navegador la ubicación del celular (solo si la persona acepta). */
export function pedirGPS() {
  return new Promise((resolve, reject) => {
    if (!navigator.geolocation) return reject(new Error("sin_gps"));
    navigator.geolocation.getCurrentPosition(
      (p) => resolve({ lat: p.coords.latitude, lng: p.coords.longitude }),
      (e) => reject(e),
      { enableHighAccuracy: false, timeout: 9000, maximumAge: 600000 }
    );
  });
}

/** Estado más cercano a unas coordenadas (para etiquetar el GPS). */
export function estadoMasCercano(p) {
  let mejor = null, d0 = Infinity;
  for (const e of ESTADOS) { const d = distanciaKm(p, e); if (d < d0) { d0 = d; mejor = e.n; } }
  return mejor;
}

/**
 * Coordenadas de «municipio, estado»: tabla local → OpenStreetMap → centro del estado.
 * Nunca falla: si no hay red, devuelve lo mejor que se sepa.
 */
export async function geocodificar(municipio, estado) {
  const mun = (municipio || "").trim();
  const c = buscarCiudad(mun);
  if (c && (!estado || c[1] === estado)) return { lat: c[2], lng: c[3], fuente: "tabla" };
  if (mun) {
    try {
      const q = encodeURIComponent(`${mun}, ${estado || ""}, México`);
      const ctl = new AbortController();
      const t = setTimeout(() => ctl.abort(), 4500);
      const r = await fetch(`https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=mx&q=${q}`, { signal: ctl.signal, headers: { "Accept-Language": "es" } });
      clearTimeout(t);
      const j = await r.json();
      if (j && j[0]) return { lat: +(+j[0].lat).toFixed(4), lng: +(+j[0].lon).toFixed(4), fuente: "osm" };
    } catch (e) { /* sin red o límite: se usa el centro del estado */ }
  }
  const e = centroEstado(estado) || centroEstado(inferirEstado(mun));
  return e ? { lat: e.lat, lng: e.lng, fuente: "estado" } : null;
}

// ---------- Google Maps (sin llave, abre la app o la web) ----------
export function urlGoogleMaps(pet) {
  const c = coordsMascota(pet);
  const texto = textoUbicacion(pet);
  const q = (pet && isFinite(pet.lat) && pet.lat && isFinite(pet.lng) && pet.lng)
    ? `${pet.lat},${pet.lng}`
    : (texto ? `${texto}, México` : (c ? `${c.lat},${c.lng}` : ""));
  return q ? `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}` : "";
}
export function urlComoLlegar(pet) {
  const q = urlGoogleMaps(pet);
  if (!q) return "";
  const c = coordsMascota(pet);
  const dest = (pet.lat && pet.lng) ? `${pet.lat},${pet.lng}` : (textoUbicacion(pet) + ", México");
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(dest)}`;
}
