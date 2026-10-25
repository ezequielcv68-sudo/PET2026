// ============================================================
// WhatsApp (gratis): enlaces wa.me con mensajes prellenados.
// No usa la API de pago: el mensaje sale del WhatsApp de la persona.
// ============================================================

/** Deja el número como lo pide wa.me: solo dígitos, con lada de país (México = 52). */
export function normalizarWhatsApp(texto) {
  let d = String(texto || "").replace(/\D/g, "");
  if (!d) return "";
  if (d.startsWith("00")) d = d.slice(2);
  if (d.length === 10) return "52" + d;                          // 777 123 4567
  if (d.length === 13 && d.startsWith("521")) return "52" + d.slice(3); // 52 1 777…
  if (d.length === 12 && d.startsWith("52")) return d;
  if (d.length >= 11 && d.length <= 15) return d;                // otros países
  return "";
}

export function urlWhatsApp(numero, texto) {
  const n = normalizarWhatsApp(numero);
  if (!n) return "";
  return `https://wa.me/${n}?text=${encodeURIComponent(texto || "")}`;
}

const VIV = { depto: "vivo en un departamento", casa_sin_patio: "vivo en una casa sin patio", casa_patio_chico: "vivo en una casa con patio chico", casa_patio_grande: "vivo en una casa con patio grande" };
const HORAS = { menos2: "menos de 2 horas", "2a4": "entre 2 y 4 horas", "4a8": "entre 4 y 8 horas", mas8: "más de 8 horas" };
const EXP = { primera_vez: "sería mi primera vez con un animal", algo: "tengo algo de experiencia con animales", mucha: "tengo mucha experiencia con animales" };

/** Mensaje del adoptante al refugio: ya lleva el contexto para que el refugio no tenga que preguntar lo básico. */
export function mensajeAlRefugio(pet, perfil, nombre, score) {
  const p = perfil || {};
  const nom = (nombre || "").trim().split(/\s+/)[0];
  const partes = [];
  if (VIV[p.vivienda]) partes.push(VIV[p.vivienda]);
  if (p.ninos === "si") partes.push("hay niños en casa"); else if (p.ninos === "no") partes.push("no hay niños en casa");
  if (p.otrasMascotas === "si") partes.push("tengo otras mascotas"); else if (p.otrasMascotas === "no") partes.push("no tengo otras mascotas");
  if (HORAS[p.horasSolo]) partes.push(`estaría solo ${HORAS[p.horasSolo]} al día`);
  if (EXP[p.experiencia]) partes.push(EXP[p.experiencia]);
  const sobreMi = partes.length ? ` Un poco sobre mí: ${partes.join(", ")}.` : "";
  const pct = score ? ` (PetMatch nos dio ${score}% de compatibilidad)` : "";
  return `Hola${pet && pet.shelterName ? ", " + pet.shelterName : ""}. Soy ${nom || "una persona interesada"} y vi a ${pet.nombre || "un animal"} en PetMatch${pct}. Me gustaría conocer a ${pet.nombre || "este animal"} y saber cómo es el proceso de adopción.${sobreMi} ¿Podemos platicar? 🐾`;
}

/** Mensaje del refugio al adoptante. */
export function mensajeAlAdoptante(nombre, refugio, mascota, score) {
  const nom = (nombre || "").trim().split(/\s+/)[0];
  return `¡Hola${nom ? " " + nom : ""}! Te escribimos de ${refugio || "el refugio"}. Vimos tu interés en adoptar a ${mascota || "uno de nuestros animales"} en PetMatch${score ? ` (${score}% de compatibilidad)` : ""}. Nos da gusto, ¿te late que platiquemos para conocernos y ver cómo es la visita? 🐾`;
}
