// ============================================================
// TARJETA COMPARTIBLE (formato historia 1080x1920)
// Genera una imagen con la foto, datos y un QR que lleva al perfil
// de la mascota (catalogo.html?m=ID). Todo ocurre en el navegador.
//
// Uso:  import { abrirTarjeta } from "./sharecard.js";
//       abrirTarjeta(pet)   // pet = { id, nombre, especie, raza, edad, tamano, energia, city, photoURL, shelterName, shelterVerified, createdAt }
// ============================================================
import { track, esc } from "./firebase-config.js";

const W = 1080, H = 1920;
const C = {
  bg: "#FBF8F0", bg2: "#F5EFDD", ink: "#1C1A16", soft: "#6E6759",
  coral: "#E8836B", mint: "#4F9D8D", mintBg: "#DEEFE7",
};
const FONT = `"Baloo 2", "Segoe UI", system-ui, -apple-system, Roboto, Helvetica, Arial, sans-serif`;

const TAM = { pequeno: "Pequeño", mediano: "Mediano", grande: "Grande" };
const ENE = { bajo: "Tranquilo", medio: "Activo", alto: "Muy activo" };

// ---------- utilidades de dibujo ----------
function rrect(ctx, x, y, w, h, r) {
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r);
  ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r);
  ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}

function recortar(ctx, texto, maxW) {
  if (ctx.measureText(texto).width <= maxW) return texto;
  let t = texto;
  while (t.length > 1 && ctx.measureText(t + "…").width > maxW) t = t.slice(0, -1);
  return t + "…";
}

function lineas(ctx, texto, maxW, maxLineas) {
  const palabras = String(texto || "").split(/\s+/).filter(Boolean);
  const out = [];
  let linea = "";
  for (const p of palabras) {
    const prueba = linea ? linea + " " + p : p;
    if (ctx.measureText(prueba).width <= maxW) { linea = prueba; continue; }
    if (linea) out.push(linea);
    linea = p;
    if (out.length === maxLineas) break;
  }
  if (linea && out.length < maxLineas) out.push(linea);
  if (out.length === maxLineas && palabras.join(" ").length > out.join(" ").length) {
    out[maxLineas - 1] = recortar(ctx, out[maxLineas - 1] + "…", maxW);
  }
  return out;
}

function cargarImagen(url) {
  return new Promise((resolve) => {
    if (!url) return resolve(null);
    const img = new Image();
    img.crossOrigin = "anonymous";
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null); // sin CORS no se puede exportar el canvas: se usa el diseño sin foto
    img.src = url;
  });
}

function cargarScript(src) {
  return new Promise((resolve, reject) => {
    const s = document.createElement("script");
    s.src = src;
    s.onload = resolve;
    s.onerror = reject;
    document.head.appendChild(s);
  });
}

async function obtenerQR(url) {
  try {
    if (!window.qrcode) {
      await cargarScript("https://cdn.jsdelivr.net/npm/qrcode-generator@1.4.4/qrcode.js");
    }
    const qr = window.qrcode(0, "M");
    qr.addData(url);
    qr.make();
    return qr;
  } catch (e) {
    return null;
  }
}

function dibujarQR(ctx, qr, x, y, size) {
  const n = qr.getModuleCount();
  const m = size / n;
  ctx.fillStyle = C.ink;
  for (let r = 0; r < n; r++) {
    for (let c = 0; c < n; c++) {
      if (qr.isDark(r, c)) ctx.fillRect(Math.floor(x + c * m), Math.floor(y + r * m), Math.ceil(m), Math.ceil(m));
    }
  }
}

// ---------- tarjeta ----------
export function urlMascota(pet) {
  return `${window.location.origin}/catalogo.html?m=${encodeURIComponent(pet.id)}`;
}

function diasEsperando(pet) {
  try {
    const t = pet.createdAt && (pet.createdAt.toDate ? pet.createdAt.toDate() : new Date(pet.createdAt));
    if (!t || isNaN(t)) return null;
    const d = Math.floor((Date.now() - t.getTime()) / 86400000);
    return d >= 7 ? d : null; // solo se muestra si ya lleva una semana o más
  } catch (e) { return null; }
}

export async function crearTarjeta(pet) {
  const canvas = document.createElement("canvas");
  canvas.width = W; canvas.height = H;
  const ctx = canvas.getContext("2d");

  const url = urlMascota(pet);
  const [img, qr] = await Promise.all([cargarImagen(pet.photoURL), obtenerQR(url)]);
  try { await document.fonts.load(`700 60px "Baloo 2"`); } catch (e) {}

  // Fondo
  const fondo = ctx.createLinearGradient(0, 0, 0, H);
  fondo.addColorStop(0, C.bg);
  fondo.addColorStop(1, C.bg2);
  ctx.fillStyle = fondo;
  ctx.fillRect(0, 0, W, H);

  // Marca arriba
  ctx.fillStyle = C.ink;
  ctx.font = `700 54px ${FONT}`;
  ctx.textBaseline = "alphabetic";
  ctx.fillText("🐾 PetMatch", 70, 120);

  // Etiqueta "Busca hogar"
  const etiqueta = "BUSCA HOGAR";
  ctx.font = `700 34px ${FONT}`;
  const tw = ctx.measureText(etiqueta).width + 56;
  ctx.fillStyle = C.coral;
  rrect(ctx, W - 70 - tw, 70, tw, 68, 34);
  ctx.fill();
  ctx.fillStyle = "#fff";
  ctx.fillText(etiqueta, W - 70 - tw + 28, 116);

  // Foto
  const fx = 70, fy = 170, fw = W - 140, fh = 1000;
  ctx.save();
  rrect(ctx, fx, fy, fw, fh, 56);
  ctx.clip();
  if (img) {
    // Fondo: la misma foto ampliada y difuminada (sin barras vacías)
    const relleno = Math.max(fw / img.width, fh / img.height) * 1.2;
    const rw = img.width * relleno, rh = img.height * relleno;
    const hayFiltro = "filter" in ctx;
    ctx.save();
    if (hayFiltro) ctx.filter = "blur(34px)";
    ctx.drawImage(img, fx + (fw - rw) / 2, fy + (fh - rh) / 2, rw, rh);
    ctx.restore();
    if (!hayFiltro) { ctx.fillStyle = "rgba(245,239,221,0.72)"; ctx.fillRect(fx, fy, fw, fh); }
    // Foto completa, sin recortar
    const ajuste = Math.min(fw / img.width, fh / img.height);
    const dw = img.width * ajuste, dh = img.height * ajuste;
    ctx.drawImage(img, fx + (fw - dw) / 2, fy + (fh - dh) / 2, dw, dh);
  } else {
    const g = ctx.createLinearGradient(fx, fy, fx + fw, fy + fh);
    g.addColorStop(0, C.mintBg); g.addColorStop(1, "#F6D9CF");
    ctx.fillStyle = g;
    ctx.fillRect(fx, fy, fw, fh);
    ctx.font = `300px ${FONT}`;
    ctx.textAlign = "center";
    ctx.fillText(pet.especie === "gato" ? "🐈" : "🐕", W / 2, fy + fh / 2 + 100);
    ctx.textAlign = "left";
  }
  ctx.restore();

  // Días esperando (solo si es real)
  const dias = diasEsperando(pet);
  if (dias) {
    const txt = `Lleva ${dias} días esperando hogar`;
    ctx.font = `700 34px ${FONT}`;
    const bw = ctx.measureText(txt).width + 60;
    ctx.fillStyle = "rgba(28,26,22,0.82)";
    rrect(ctx, fx + 30, fy + fh - 30 - 70, bw, 70, 35);
    ctx.fill();
    ctx.fillStyle = "#fff";
    ctx.fillText(txt, fx + 60, fy + fh - 30 - 22);
  }

  // Nombre
  ctx.fillStyle = C.ink;
  ctx.font = `700 120px ${FONT}`;
  ctx.fillText(recortar(ctx, pet.nombre || "Sin nombre", W - 140), 70, 1330);

  // Datos
  ctx.fillStyle = C.soft;
  ctx.font = `500 42px ${FONT}`;
  const sub = [pet.especie === "gato" ? "Gato" : "Perro", pet.raza, pet.edad].filter(Boolean).join(" · ");
  ctx.fillText(recortar(ctx, sub, W - 140), 70, 1394);

  // Chips
  const chips = [TAM[pet.tamano] && `Tamaño ${TAM[pet.tamano].toLowerCase()}`, ENE[pet.energia], pet.city].filter(Boolean);
  let cx = 70;
  ctx.font = `600 34px ${FONT}`;
  for (const t of chips) {
    const w = ctx.measureText(t).width + 50;
    if (cx + w > W - 70) break;
    ctx.fillStyle = C.mintBg;
    rrect(ctx, cx, 1430, w, 64, 32);
    ctx.fill();
    ctx.fillStyle = "#2E6B5D";
    ctx.fillText(t, cx + 25, 1473);
    cx += w + 14;
  }

  // Bloque inferior con QR
  const by = 1540, bh = 320;
  ctx.fillStyle = "#fff";
  rrect(ctx, 70, by, W - 140, bh, 44);
  ctx.fill();

  const qs = 240, qx = 70 + 40, qy = by + (bh - qs) / 2;
  if (qr) {
    dibujarQR(ctx, qr, qx, qy, qs);
  } else {
    ctx.fillStyle = C.bg2;
    rrect(ctx, qx, qy, qs, qs, 20);
    ctx.fill();
  }

  const tx = qx + qs + 44;
  const tmax = W - 70 - 40 - tx;
  ctx.fillStyle = C.ink;
  ctx.font = `700 52px ${FONT}`;
  ctx.fillText(qr ? "Escanéalo y conócelo" : "Conócelo en PetMatch", tx, by + 100);

  ctx.fillStyle = C.soft;
  ctx.font = `500 32px ${FONT}`;
  const refugio = (pet.shelterName ? pet.shelterName : "Refugio") + (pet.shelterVerified ? " ✓" : "");
  const l1 = lineas(ctx, refugio, tmax, 2);
  l1.forEach((l, i) => ctx.fillText(l, tx, by + 156 + i * 40));

  ctx.fillStyle = C.coral;
  ctx.font = `700 32px ${FONT}`;
  const host = window.location.host;
  ctx.fillText(recortar(ctx, host, tmax), tx, by + bh - 52);

  return new Promise((resolve, reject) => {
    try {
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob vacío"))), "image/png");
    } catch (e) { reject(e); }
  });
}

// ---------- vista previa + compartir ----------
export async function abrirTarjeta(pet) {
  track("tarjeta_abrir", { pet_id: pet.id });

  const overlay = document.createElement("div");
  overlay.style.cssText = "position:fixed;inset:0;background:rgba(28,26,22,.72);z-index:500;display:flex;align-items:center;justify-content:center;padding:16px;overflow:auto;";
  overlay.innerHTML = `
    <div style="background:#FBF8F0;border-radius:22px;padding:18px;max-width:380px;width:100%;text-align:center;">
      <div id="scEstado" style="padding:60px 10px;color:#6E6759;font-size:.95rem;">Creando tu tarjeta…</div>
      <img id="scImg" alt="Tarjeta de ${esc(pet.nombre || "mascota")}" style="display:none;width:100%;border-radius:14px;box-shadow:0 10px 24px rgba(0,0,0,.18);">
      <div id="scAcciones" style="display:none;gap:10px;margin-top:14px;">
        <button id="scCompartir" type="button" style="flex:1;background:#E8836B;color:#fff;border:none;border-radius:999px;padding:13px;font-weight:700;cursor:pointer;">Compartir</button>
        <button id="scDescargar" type="button" style="flex:1;background:transparent;color:#1C1A16;border:1.5px solid rgba(28,26,22,.18);border-radius:999px;padding:13px;font-weight:700;cursor:pointer;">Descargar</button>
      </div>
      <button id="scCerrar" type="button" style="margin-top:12px;background:none;border:none;color:#6E6759;cursor:pointer;font-size:.9rem;">Cerrar</button>
    </div>`;
  document.body.appendChild(overlay);

  let objUrl = null;
  const cerrar = () => { if (objUrl) URL.revokeObjectURL(objUrl); overlay.remove(); };
  overlay.querySelector("#scCerrar").onclick = cerrar;
  overlay.addEventListener("click", (e) => { if (e.target === overlay) cerrar(); });

  try {
    const blob = await crearTarjeta(pet);
    objUrl = URL.createObjectURL(blob);
    const nombreArchivo = `PetMatch_${(pet.nombre || "mascota").replace(/[^\w]+/g, "_")}.png`;
    const file = new File([blob], nombreArchivo, { type: "image/png" });

    overlay.querySelector("#scEstado").style.display = "none";
    const im = overlay.querySelector("#scImg");
    im.src = objUrl; im.style.display = "block";
    const acc = overlay.querySelector("#scAcciones");
    acc.style.display = "flex";

    overlay.querySelector("#scDescargar").onclick = () => {
      const a = document.createElement("a");
      a.href = objUrl; a.download = nombreArchivo;
      document.body.appendChild(a); a.click(); a.remove();
      track("tarjeta_descargar", { pet_id: pet.id });
    };

    overlay.querySelector("#scCompartir").onclick = async () => {
      const texto = `Conoce a ${pet.nombre || "este animal"}, busca hogar 🐾 ${urlMascota(pet)}`;
      try {
        if (navigator.canShare && navigator.canShare({ files: [file] })) {
          await navigator.share({ files: [file], text: texto });
          track("tarjeta_compartir", { pet_id: pet.id });
          return;
        }
        if (navigator.share) {
          await navigator.share({ text: texto, url: urlMascota(pet) });
          track("tarjeta_compartir", { pet_id: pet.id });
          return;
        }
      } catch (e) {
        if (e && e.name === "AbortError") return;
      }
      window.open(`https://wa.me/?text=${encodeURIComponent(texto)}`, "_blank", "noopener");
    };
  } catch (err) {
    console.error("No se pudo crear la tarjeta:", err);
    overlay.querySelector("#scEstado").textContent =
      "No pudimos crear la tarjeta con esta foto. Intenta de nuevo o comparte el enlace del animal.";
  }
}
