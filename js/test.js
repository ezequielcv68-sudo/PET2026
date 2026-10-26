// ============================================================
// TEST SIN REGISTRO (modo invitado)
// Contesta 8 preguntas, calcula el match en el navegador con el
// mismo motor de matching.js y guarda el perfil en localStorage.
// Al registrarse, auth.js copia ese perfil a adopterProfiles.
// ============================================================
import {
  db, auth, collection, getDocs, onAuthStateChanged,
  track, esc, safeUrl, GUEST_KEY, PENDING_KEY,
} from "./firebase-config.js";
import { ordenarPorMatch, explicarMatch, calcularMatch, especieCompatible, kmHasta } from "./matching.js";
import { ESTADOS, inferirEstado, geocodificar, pedirGPS, estadoMasCercano, guardarUbicacion, puntoAdoptante, textoDistancia, textoUbicacion } from "./geo.js";

const FOTO_DEFAULT = {
  perro: "https://images.unsplash.com/photo-1543466835-00a7907e9de1?q=80&w=800&auto=format&fit=crop",
  gato: "https://images.unsplash.com/photo-1596854407944-bf87f6fdd49e?q=80&w=800&auto=format&fit=crop",
};

let usuarioActual = null;
onAuthStateChanged(auth, (u) => { usuarioActual = u; });

const vistaTest = document.getElementById("vistaTest");
const vistaResultados = document.getElementById("vistaResultados");
const resArea = document.getElementById("resArea");

// ---------- Preguntas (una por pantalla) ----------
// «when»: pregunta adaptativa (solo aparece si aplica). «opcional»: se puede saltar.
const PREGUNTAS = [
  { k: "especiePreferida", titulo: "¿Qué te gustaría adoptar?", por: "Hay perritos y gatitos esperando. Si no tienes preferencia, te mostramos de los dos.",
    op: [["perro", "🐕", "Un perro"], ["gato", "🐈", "Un gato"], ["cualquiera", "✨", "Cualquiera"]] },
  { k: "vivienda", titulo: "¿Dónde vivirá tu nuevo mejor amigo?", por: "Lo preguntamos porque un animal muy activo en un espacio chico suele ser infeliz, y queremos evitarlo.",
    op: [["depto", "🏢", "Departamento"], ["casa_sin_patio", "🏠", "Casa sin patio"], ["casa_patio_chico", "🏡", "Casa con patio chico"], ["casa_patio_grande", "🌳", "Casa con patio grande"]] },
  { k: "tipoVivienda", opcional: true, titulo: "¿Tu vivienda es propia o rentada?", por: "Muchos refugios lo piden para estar tranquilos de que el animal se quedará contigo.",
    op: [["propia", "🔑", "Propia"], ["renta_permitida", "📄", "Rentada, con permiso para animales"], ["renta_sin_permiso", "❓", "Rentada, aún sin permiso"]] },
  { k: "ninos", titulo: "¿Hay niños pequeños en casa?", por: "Algunos animales son muy tranquilos con niños y otros prefieren hogares más calmados.",
    op: [["si", "👶", "Sí"], ["no", "🙂", "No"]] },
  { k: "otrasMascotas", titulo: "¿Tienes otros animales en casa?", por: "Así buscamos a alguien que se lleve bien con ellos.",
    op: [["si", "🐾", "Sí"], ["no", "🚫", "No"]] },
  { k: "acuerdoFamiliar", opcional: true, titulo: "¿Todos en casa están de acuerdo con adoptar?", por: "Es la razón más común por la que una adopción no funciona. Mejor saberlo desde el inicio.",
    op: [["si", "👨‍👩‍👧", "Sí, totalmente"], ["en_proceso", "💬", "Aún lo estamos platicando"]] },
  { k: "horasSolo", titulo: "¿Cuántas horas al día estaría solo?", por: "Un animal que pasa muchas horas solo necesita ser más independiente.",
    op: [["menos2", "⚡", "Menos de 2 horas"], ["2a4", "🕑", "De 2 a 4 horas"], ["4a8", "🕗", "De 4 a 8 horas"], ["mas8", "🌙", "Más de 8 horas"]] },
  { k: "energia", titulo: "¿Cuánto tiempo y energía le puedes dar?", por: "No hay respuesta mala: cada animal tiene su ritmo y buscamos el que coincida con el tuyo.",
    op: [["bajo", "🛋️", "Tranquilo: paseos cortos"], ["medio", "🚶", "Activo: paseos diarios"], ["alto", "🏃", "Muy activo: correr o hacer deporte"]] },
  { k: "experiencia", titulo: "¿Qué experiencia tienes con animales?", por: "Si es tu primera vez, te mostramos animales más fáciles para empezar.",
    op: [["primera_vez", "🌱", "Es mi primera vez"], ["algo", "🌿", "Algo de experiencia"], ["mucha", "🌳", "Mucha experiencia"]] },
  { k: "tamanoPreferido", titulo: "¿Qué tamaño prefieres?", por: "Con tu vivienda y tu energía ya vamos afinando; esto es solo tu gusto.",
    when: (r) => r.especiePreferida !== "gato",
    op: [["pequeno", "🧸", "Pequeño"], ["mediano", "🐕", "Mediano"], ["grande", "🦮", "Grande"], ["cualquiera", "✨", "Cualquiera"]] },
  { k: "ubicacion", tipo: "ubicacion", opcional: true, titulo: "¿Dónde estás?", por: "Así te mostramos primero a los animales más cercanos y a qué distancia están." },
];

const OBLIGATORIAS = ["especiePreferida", "vivienda", "ninos", "otrasMascotas", "horasSolo", "energia", "experiencia", "tamanoPreferido"];
const resp = {};            // respuestas
let ubic = null;            // { estado, municipio, lat, lng, gps, aprox }
let paso = 0;

const stBody = document.getElementById("stBody");
const stCount = document.getElementById("stCount");
const stFill = document.getElementById("stFill");
const stBack = document.getElementById("stBack");

function pasosActivos() { return PREGUNTAS.filter((q) => !q.when || q.when(resp)); }

function valor(k) { return resp[k] || null; }

// ---------- Recuperar respuestas guardadas ----------
function leerGuardado() {
  try { return JSON.parse(localStorage.getItem(GUEST_KEY) || "null"); }
  catch (e) { return null; }
}
(function precargar() {
  const g = leerGuardado();
  if (!g) return;
  PREGUNTAS.forEach((q) => { if (q.tipo !== "ubicacion" && g[q.k]) resp[q.k] = g[q.k]; });
  if (g.estado) ubic = { estado: g.estado, municipio: g.city || "", lat: g.lat, lng: g.lng, gps: !!g.gps, aprox: !!g.aprox };
})();

function pintarPaso() {
  const lista = pasosActivos();
  if (paso >= lista.length) paso = lista.length - 1;
  const q = lista[paso];
  stCount.textContent = `Pregunta ${paso + 1} de ${lista.length}`;
  stFill.style.width = Math.round((paso / lista.length) * 100) + "%";
  stBack.hidden = paso === 0;
  document.getElementById("testMsg").innerHTML = "";

  const cab = `<h3 id="stTitulo">${esc(q.titulo)}</h3><p class="st-why">${esc(q.por)}</p>`;
  if (q.tipo === "ubicacion") {
    stBody.innerHTML = `<div class="st-q st-loc" role="group" aria-labelledby="stTitulo">${cab}
      <button type="button" class="st-opt st-gps" id="stGps"><span class="ic">📍</span>Usar mi ubicación actual</button>
      <label for="stEstado" class="st-note" style="display:block;margin:6px 2px 4px">O elige tu estado y municipio</label>
      <select id="stEstado"><option value="">Elige tu estado…</option>${ESTADOS.map((e) => `<option value="${esc(e.n)}">${esc(e.n)}</option>`).join("")}</select>
      <input type="text" id="stMun" placeholder="Municipio (ej. Cuernavaca)" autocomplete="address-level2">
      <p class="st-note">Solo se usa para ordenar por cercanía. Nunca se muestra a otras personas.</p>
      <button type="button" class="btn-primary" id="stVer">Ver mis matches →</button>
      <button type="button" class="st-link" id="stSaltarUbic">Saltar este paso</button></div>`;
    if (ubic) { document.getElementById("stEstado").value = ubic.estado || ""; document.getElementById("stMun").value = ubic.municipio || ""; }
    document.getElementById("stGps").onclick = usarGPS;
    document.getElementById("stVer").onclick = () => terminar(true);
    document.getElementById("stSaltarUbic").onclick = () => { ubic = null; terminar(false); };
  } else {
    stBody.innerHTML = `<div class="st-q" role="group" aria-labelledby="stTitulo">${cab}<div class="st-opts">${
      q.op.map(([v, ic, txt]) => `<button type="button" class="st-opt${resp[q.k] === v ? " sel" : ""}" data-v="${esc(v)}" aria-pressed="${resp[q.k] === v}"><span class="ic" aria-hidden="true">${ic}</span>${esc(txt)}</button>`).join("")
    }</div>${q.opcional ? '<button type="button" class="st-link" id="stSaltar">Saltar esta pregunta</button>' : ""}</div>`;
    stBody.querySelectorAll(".st-opt").forEach((b) => b.addEventListener("click", () => {
      resp[q.k] = b.dataset.v;
      if (q.k === "especiePreferida" && b.dataset.v === "gato") resp.tamanoPreferido = "cualquiera";
      stBody.querySelectorAll(".st-opt").forEach((x) => { x.classList.toggle("sel", x === b); x.setAttribute("aria-pressed", String(x === b)); });
      try { navigator.vibrate && navigator.vibrate(8); } catch (e) {}
      actualizarVivo();
      setTimeout(() => { paso++; pintarPaso(); }, 190);
    }));
    document.getElementById("stSaltar")?.addEventListener("click", () => { delete resp[q.k]; paso++; pintarPaso(); });
  }
  const f = stBody.querySelector(".st-opt.sel, .st-opt, #stEstado");
  if (f && paso > 0) f.focus({ preventScroll: true });
  actualizarVivo();
}
stBack.addEventListener("click", () => { if (paso > 0) { paso--; pintarPaso(); } });

async function usarGPS() {
  const btn = document.getElementById("stGps");
  btn.disabled = true; btn.lastChild.textContent = "Buscando tu ubicación…";
  try {
    const p = await pedirGPS();
    const est = estadoMasCercano(p) || "";
    ubic = { estado: est, municipio: "", lat: +p.lat.toFixed(3), lng: +p.lng.toFixed(3), gps: true, aprox: false };
    document.getElementById("stEstado").value = est;
    btn.lastChild.textContent = "Listo, usaremos tu ubicación ✓";
  } catch (e) {
    btn.disabled = false; btn.lastChild.textContent = "Usar mi ubicación actual";
    document.getElementById("testMsg").innerHTML = `<div class="error-msg">No pudimos obtener tu ubicación. Elige tu estado en la lista.</div>`;
  }
}

// ---------- Conteo en vivo: cuántos animales siguen siendo compatibles ----------
let animales = null;
getDocs(collection(db, "pets"))
  .then((s) => { animales = s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.status !== "adopted" && p.status !== "hidden"); actualizarVivo(); })
  .catch(() => {});

const EXP_DE_DIFICULTAD = { facil: "primera_vez", moderado: "algo", dificil: "mucha" };

function actualizarVivo() {
  const el = document.getElementById("qLive");
  if (!el || !animales) return;
  const parcial = {
    especiePreferida: valor("especiePreferida"), vivienda: valor("vivienda"), ninos: valor("ninos"),
    otrasMascotas: valor("otrasMascotas"), horasSolo: valor("horasSolo"), energia: valor("energia"),
    experiencia: valor("experiencia"), tamanoPreferido: valor("tamanoPreferido"),
  };
  const respondidas = OBLIGATORIAS.filter((k) => parcial[k]).length;
  if (!animales.length || respondidas < 1) { el.classList.remove("show"); return; }
  const compatibles = animales.filter((pet) => {
    const p = {
      ...parcial,
      vivienda: parcial.vivienda || "casa_patio_grande",
      ninos: parcial.ninos || "no",
      otrasMascotas: parcial.otrasMascotas || "no",
      horasSolo: parcial.horasSolo || "menos2",
      experiencia: parcial.experiencia || EXP_DE_DIFICULTAD[pet.nivelDificultad] || "algo",
    };
    return especieCompatible(p, pet) && calcularMatch(p, pet).score >= 75;
  }).length;
  const n = animales.length;
  el.textContent = respondidas >= OBLIGATORIAS.length - (resp.especiePreferida === "gato" ? 0 : 0) && OBLIGATORIAS.every((k) => parcial[k])
    ? `🐾 ${compatibles} de ${n} ${n === 1 ? "animal encaja" : "animales encajan"} muy bien contigo`
    : `🐾 Hasta ahora: ${compatibles} de ${n} ${n === 1 ? "animal podría ser tu match" : "animales podrían ser tu match"}`;
  el.classList.add("show");
}

// ---------- Terminar ----------
async function terminar(conUbicacion) {
  const msg = document.getElementById("testMsg");
  const faltan = OBLIGATORIAS.filter((k) => !resp[k]);
  if (faltan.length) {
    const lista = pasosActivos();
    paso = Math.max(0, lista.findIndex((q) => q.k === faltan[0]));
    pintarPaso();
    document.getElementById("testMsg").innerHTML = `<div class="error-msg">Te falta contestar esta pregunta para ver tus matches.</div>`;
    return;
  }
  msg.innerHTML = "";
  const btn = document.getElementById("stVer") || document.getElementById("stSaltarUbic");
  if (btn) { btn.disabled = true; }

  const perfil = { ...resp };
  delete perfil.ubicacion;
  if (conUbicacion) {
    const estadoSel = document.getElementById("stEstado")?.value || "";
    const mun = (document.getElementById("stMun")?.value || "").trim();
    if (ubic && ubic.gps && (!estadoSel || estadoSel === ubic.estado) && !mun) {
      /* GPS ya obtenido */
    } else if (estadoSel || mun) {
      const estado = estadoSel || inferirEstado(mun) || "";
      const g = await geocodificar(mun, estado);
      ubic = { estado, municipio: mun, lat: g ? g.lat : null, lng: g ? g.lng : null, gps: false, aprox: !g || g.fuente === "estado" };
    } else { ubic = null; }
  }
  if (ubic && ubic.estado) {
    perfil.estado = ubic.estado;
    if (ubic.municipio) perfil.city = ubic.municipio;
    if (ubic.lat != null) { perfil.lat = ubic.lat; perfil.lng = ubic.lng; }
    perfil.gps = !!ubic.gps; perfil.aprox = !!ubic.aprox;
    guardarUbicacion({ estado: ubic.estado, lat: ubic.lat, lng: ubic.lng, gps: !!ubic.gps, aprox: !!ubic.aprox });
  }
  try { localStorage.setItem(GUEST_KEY, JSON.stringify(perfil)); } catch (e) {}

  stBody.innerHTML = `<div class="st-q"><h3>Buscando a tus mejores amigos…</h3><p class="st-why">Comparando tus respuestas con los animales de los refugios.</p></div>`;
  try {
    const snap = await getDocs(collection(db, "pets"));
    const mascotas = snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((p) => p.status !== "adopted" && p.status !== "hidden");
    const ordenadas = ordenarPorMatch(perfil, mascotas);
    track("test_completado", { resultados: ordenadas.length, especie: perfil.especiePreferida, con_ubicacion: !!(ubic && ubic.estado) });
    perfilActual = perfil;
    pintarResultados(perfil, ordenadas);
  } catch (err) {
    console.error(err);
    paso = pasosActivos().length - 1; pintarPaso();
    document.getElementById("testMsg").innerHTML = `<div class="error-msg">No pudimos cargar a los animales. Intenta de nuevo.</div>`;
  }
}
let perfilActual = null;
pintarPaso();

// Compartir el resultado (el mejor match) por WhatsApp, redes o donde la persona prefiera
let mejorResultado = null;
const btnCompartirRes = document.getElementById("btnCompartirRes");
if (btnCompartirRes) {
  btnCompartirRes.addEventListener("click", async () => {
    if (!mejorResultado) return;
    const texto = `Mi mejor amigo ideal en PetMatch es ${mejorResultado.nombre || "alguien especial"} (${mejorResultado.matchScore}% de compatibilidad) 🐾 Descubre el tuyo:`;
    const url = `${window.location.origin}/test.html`;
    track("compartir_resultado", { pet_id: mejorResultado.id });
    try {
      if (navigator.share) { await navigator.share({ title: "PetMatch", text: texto, url }); return; }
    } catch (e) { if (e && e.name === "AbortError") return; }
    window.open(`https://wa.me/?text=${encodeURIComponent(texto + " " + url)}`, "_blank", "noopener");
  });
}

document.getElementById("btnRehacer").addEventListener("click", () => {
  vistaResultados.classList.add("hidden");
  vistaTest.classList.remove("hidden");
  paso = 0; pintarPaso();
  window.scrollTo({ top: 0, behavior: "smooth" });
});

// ---------- Resultados ----------
function pintarResultados(perfil, lista) {
  vistaTest.classList.add("hidden");
  vistaResultados.classList.remove("hidden");
  window.scrollTo({ top: 0, behavior: "smooth" });

  const titulo = document.getElementById("resTitulo");
  const sub = document.getElementById("resSub");
  resArea.innerHTML = "";

  mejorResultado = lista[0] || null;
  if (btnCompartirRes) btnCompartirRes.style.display = lista.length ? "" : "none";

  if (!lista.length) {
    titulo.textContent = "Aún no hay animales que encajen";
    sub.textContent = "Todavía estamos sumando refugios. Crea tu cuenta y te avisamos cuando lleguen animales para ti.";
    return;
  }

  titulo.textContent = "Estos mejores amigos van contigo";
  sub.textContent = `Encontramos ${lista.length} ${lista.length === 1 ? "mejor amigo" : "mejores amigos"}. Te mostramos las que mejor encajan.`;

  lista.slice(0, 12).forEach(pet => {
    const { razones, avisos } = explicarMatch(perfil, pet);
    const foto = safeUrl(pet.photoURL, FOTO_DEFAULT[pet.especie === "gato" ? "gato" : "perro"]);
    const tamanoTxt = { pequeno: "Pequeño", mediano: "Mediano", grande: "Grande" }[pet.tamano] || "";
    const ref = puntoAdoptante(perfil);
    const km = kmHasta(perfil, pet);
    const kmTxt = ref && !ref.aprox && km != null && km <= 400 ? textoDistancia(km) : "";
    const subTxt = [pet.especie === "gato" ? "Gato" : "Perro", pet.raza, pet.edad, tamanoTxt, textoUbicacion(pet) || pet.city, kmTxt]
      .filter(Boolean).join(" · ");

    const card = document.createElement("div");
    card.className = "res-card";
    card.innerHTML = `
      <div class="res-photo" style="background-image:url('${esc(foto)}')">
        <span class="res-pct">${esc(pet.matchScore)}% match</span>
      </div>
      <div class="res-body">
        <h3>${esc(pet.nombre || "Sin nombre")}</h3>
        <div class="res-sub">${esc(subTxt)}</div>
        ${razones.length ? `<ul class="res-why">${razones.map(r => `<li>${esc(r)}</li>`).join("")}</ul>` : ""}
        ${avisos.length ? `<ul class="res-warn">${avisos.map(a => `<li>${esc(a)}</li>`).join("")}</ul>` : ""}
        <div class="res-actions">
          <a class="btn-sm outline" href="catalogo.html?m=${encodeURIComponent(pet.id)}">Ver más</a>
          <button class="btn-sm" type="button" data-id="${esc(pet.id)}">Me interesa</button>
        </div>
      </div>
    `;
    card.querySelector("button[data-id]").addEventListener("click", () => {
      try { sessionStorage.setItem(PENDING_KEY, pet.id); } catch (e) {}
      track("test_me_interesa", { pet_id: pet.id });
      window.location.href = usuarioActual ? "swipe.html" : "auth.html";
    });
    resArea.appendChild(card);
  });
}
