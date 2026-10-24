// Reduce las fotos antes de subirlas: lado mayor 1280 px, JPEG ~82 %.
// Una foto de celular pesa 3–8 MB; así queda en ~150–400 KB y el catálogo
// carga rápido y no se traba en celulares modestos.
export async function comprimirImagen(file, maxLado = 1280, calidad = 0.82) {
  try {
    if (!file || !/^image\/(jpeg|png|webp)$/i.test(file.type) || file.size < 250 * 1024) return file;
    const bmp = await (window.createImageBitmap ? createImageBitmap(file, { imageOrientation: "from-image" }) : Promise.reject());
    const k = Math.min(1, maxLado / Math.max(bmp.width, bmp.height));
    const w = Math.round(bmp.width * k), h = Math.round(bmp.height * k);
    const c = document.createElement("canvas"); c.width = w; c.height = h;
    const ctx = c.getContext("2d");
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, w, h);
    ctx.drawImage(bmp, 0, 0, w, h);
    const blob = await new Promise((ok) => c.toBlob(ok, "image/jpeg", calidad));
    if (!blob || blob.size >= file.size) return file;
    const nombre = (file.name || "foto").replace(/\.[^.]+$/, "") + ".jpg";
    return new File([blob], nombre, { type: "image/jpeg" });
  } catch (e) { return file; }   // si algo falla, se sube la original
}
