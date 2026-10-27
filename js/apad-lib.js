// PetMatch — utilidades compartidas del apadrinamiento
import { esc, safeUrl } from "./firebase-config.js";

export const fmt = (n) => "$" + Number(n || 0).toLocaleString("es-MX");
export const tsd = (t) => (t && t.toDate ? t.toDate() : t ? new Date(t) : null);
export const fecha = (t) => { const d = tsd(t); return d && !isNaN(d) ? d.toLocaleDateString("es-MX", { day: "numeric", month: "short", year: "numeric" }) : "—"; };
export const FREC = { mensual: "cada mes", unica: "una sola vez", especie: "en especie" };
const DIAS_CORRIENTE = 35;

/** Estado de un apadrinamiento: solo cuenta cuando refugio y padrino lo confirmaron. */
export const activo = (s) => s.estado === "activo" && !s.pausado && !s.cancelado;

/** Sello «Refugio al corriente»: subió recibo o novedad en los últimos 35 días. */
export function alCorriente(posts) {
  const lim = Date.now() - DIAS_CORRIENTE * 864e5;
  return (posts || []).some((p) => { const d = tsd(p.createdAt); return d && d.getTime() >= lim; });
}

export function barra(cubierto, meta) {
  if (!meta) return "";
  const p = Math.max(0, Math.min(100, Math.round((cubierto || 0) * 100 / meta)));
  return `<div class="ap-bar-t"><span>${fmt(cubierto)} de ${fmt(meta)} al mes</span><span>${p}%</span></div>
    <div class="ap-bar" role="progressbar" aria-valuenow="${p}" aria-valuemin="0" aria-valuemax="100"><i style="width:${p}%"></i></div>`;
}

export function lineaDeVida(posts) {
  const l = (posts || []).slice().sort((a, b) => (tsd(b.createdAt) || 0) - (tsd(a.createdAt) || 0));
  if (!l.length) return `<p class="ap-mut">Aún no hay recibos ni novedades publicados.</p>`;
  return l.slice(0, 12).map((p) => `
    <div class="ap-post">
      ${p.fotoURL ? `<img src="${esc(safeUrl(p.fotoURL))}" alt="Foto de ${esc(p.tipo === "recibo" ? "recibo" : "novedad")}" loading="lazy">` : `<div class="ap-post-ic" aria-hidden="true">${p.tipo === "recibo" ? "🧾" : "📣"}</div>`}
      <div><b>${p.tipo === "recibo" ? "Recibo" : "Novedad"}${p.concepto ? " · " + esc(p.concepto) : ""}${p.monto ? " · " + fmt(p.monto) : ""}</b>
      ${p.texto ? `<div>${esc(p.texto)}</div>` : ""}<div class="ap-mut">${fecha(p.createdAt)}</div></div>
    </div>`).join("");
}

export function mensajeApadrinar(nombre, pet, monto, frec) {
  const n = (nombre || "").trim().split(/\s+/)[0] || "una persona";
  const cuanto = frec === "especie" ? "con una aportación en especie (croquetas, medicinas…)" : `con ${fmt(monto)} ${FREC[frec] || ""}`;
  return `Hola${pet.shelterName ? ", " + pet.shelterName : ""}. Soy ${n} y quiero apadrinar a ${pet.nombre} ${cuanto} (lo vi en PetMatch). ¿Me compartes los datos para hacer mi aportación? Cuando la haga la confirmo en la app. 🐾`;
}
