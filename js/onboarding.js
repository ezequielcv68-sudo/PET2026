import {
  auth, db, onAuthStateChanged, signOut,
  doc, setDoc, getDoc, updateDoc, serverTimestamp,
} from "./firebase-config.js";

let uid = null;
let coords = null;

onAuthStateChanged(auth, async (user) => {
  if (!user) { window.location.href = "auth.html?tab=login"; return; }
  uid = user.uid;

  // 1. Cargar teléfono y ciudad desde la colección users
  const userDoc = await getDoc(doc(db, "users", uid));
  if (userDoc.exists()) {
    const uData = userDoc.data();
    if (uData.city) document.getElementById("obCity").value = uData.city;
    if (uData.phone && document.getElementById("obPhone")) {
      document.getElementById("obPhone").value = uData.phone;
    }
  }

  // 2. Cargar perfil de rutina previo en adopterProfiles
  try {
    const profileDoc = await getDoc(doc(db, "adopterProfiles", uid));
    if (profileDoc.exists()) {
      const data = profileDoc.data();

      if (data.city) document.getElementById("obCity").value = data.city;
      if (data.phone && document.getElementById("obPhone")) {
        document.getElementById("obPhone").value = data.phone;
      }

      // ➕ Precargar biografía / presentación si existe
      if (data.biografia && document.getElementById("obBio")) {
        document.getElementById("obBio").value = data.biografia;
      }

      if (data.lat && data.lng) {
        coords = { lat: data.lat, lng: data.lng };
        const msg = document.getElementById("ubicacionMsg");
        if (msg) msg.textContent = "✓ Ubicación guardada previamente.";
      }

      const savedFields = [
        { group: "vivienda", val: data.vivienda },
        { group: "tipo_vivienda", val: data.tipoVivienda },
        { group: "acuerdo_familiar", val: data.acuerdoFamiliar },
        { group: "plan_viajes", val: data.planViajes },
        { group: "ninos", val: data.ninos },
        { group: "otras_mascotas", val: data.otrasMascotas },
        { group: "horas_solo", val: data.horasSolo },
        { group: "energia", val: data.energia },
        { group: "experiencia", val
