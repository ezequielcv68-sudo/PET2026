// ============================================================
// AVISO AL REFUGIO cuando alguien da "Me interesa".
// Llama al Apps Script (apps-script/avisos.gs). Si AVISOS_URL está vacío, no hace nada.
// Nunca bloquea ni rompe el flujo del usuario.
// ============================================================
import { auth } from "./firebase-config.js";

// Pega aquí la URL de la implementación web de Apps Script (termina en /exec).
export const AVISOS_URL = "https://script.google.com/macros/s/AKfycby3jCr_Ko75zulByJObfr2zEqAPRTbIwS2JGKswuAFTvMweYKpsFxgqu_nHG_TG4vyn/exec";

export async function avisarRefugio(swipeId) {
  try {
    if (!AVISOS_URL || !auth.currentUser) return;
    const idToken = await auth.currentUser.getIdToken();
    // text/plain + no-cors: evita el preflight de CORS; es "disparar y olvidar".
    await fetch(AVISOS_URL, {
      method: "POST",
      mode: "no-cors",
      keepalive: true,
      body: JSON.stringify({ idToken, swipeId }),
    });
  } catch (e) {
    console.warn("No se pudo avisar al refugio:", e);
  }
}
