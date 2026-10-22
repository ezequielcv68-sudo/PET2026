/**
 * PetMatch — Aviso por correo al refugio cuando alguien da "Me interesa".
 *
 * CÓMO FUNCIONA (seguro):
 *  1. La página manda aquí el token de sesión del adoptante + el id del swipe.
 *  2. Este script lee el swipe y el usuario del refugio en Firestore USANDO ESE TOKEN,
 *     así que las reglas de seguridad de Firestore deciden qué se puede leer.
 *  3. El destinatario sale del documento del refugio, NUNCA de lo que mande la página.
 *     Nadie puede usar esto para mandar correos a direcciones arbitrarias.
 *  4. Cada swipe avisa una sola vez.
 *
 * INSTALACIÓN: ver LEEME-LOTE2.md
 */
var PROJECT_ID = 'pet-2026-e1001';
var PANEL_URL  = 'https://pet-2026.vercel.app/shelter.html';
var NOMBRE_REMITENTE = 'PetMatch';

function doPost(e) {
  try {
    var body = JSON.parse(e.postData.contents);
    var idToken = String(body.idToken || '');
    var swipeId = String(body.swipeId || '');
    if (!idToken || !/^[A-Za-z0-9_-]{10,200}$/.test(swipeId)) return salida('bad');

    var props = PropertiesService.getScriptProperties();
    var lock = LockService.getScriptLock();
    lock.waitLock(10000);
    try {
      if (props.getProperty('n_' + swipeId)) return salida('dup');
      props.setProperty('n_' + swipeId, String(Date.now())); // se marca primero para no duplicar
    } finally {
      lock.releaseLock();
    }

    var swipe = leerDoc('swipes/' + swipeId, idToken);
    if (!swipe) { props.deleteProperty('n_' + swipeId); return salida('no-swipe'); }
    var f = swipe.fields || {};
    if (!f.liked || f.liked.booleanValue !== true) return salida('no-like');
    var shelterId = f.shelterId && f.shelterId.stringValue;
    if (!shelterId) return salida('no-shelter');

    var refugio = leerDoc('users/' + shelterId, idToken);
    var rf = (refugio && refugio.fields) || {};
    var correo = rf.email && rf.email.stringValue;
    if (!correo || !/^[^@\s]+@[^@\s]+\.[^@\s]+$/.test(correo)) return salida('no-email');

    var mascota = (f.petName && f.petName.stringValue) || 'tu mascota';
    var score = f.matchScore ? Number(f.matchScore.integerValue || f.matchScore.doubleValue || 0) : 0;
    var a = (f.adopter && f.adopter.mapValue && f.adopter.mapValue.fields) || {};
    var nombre = (a.name && a.name.stringValue) || 'Una persona';
    var ciudad = (a.city && a.city.stringValue) || '';
    var tel = ((a.phone && a.phone.stringValue) || '').replace(/\D/g, '');
    var refugioNombre = (rf.shelterName && rf.shelterName.stringValue) || 'refugio';

    var wa = tel
      ? 'https://wa.me/' + tel + '?text=' + encodeURIComponent('¡Hola ' + nombre + '! Te escribimos de ' + refugioNombre + ' por tu interés en adoptar a ' + mascota + ' en PetMatch 🐾')
      : '';

    var html =
      '<div style="font-family:Arial,sans-serif;max-width:480px;margin:auto;color:#1C1A16">' +
      '<h2 style="margin:0 0 8px">🐾 Alguien quiere adoptar a ' + h(mascota) + '</h2>' +
      '<p style="margin:0 0 14px;color:#6E6759"><strong>' + h(nombre) + '</strong>' + (ciudad ? ' (' + h(ciudad) + ')' : '') +
      ' dio "Me interesa"' + (score ? ' con <strong>' + score + '% de compatibilidad</strong>' : '') + '.</p>' +
      '<p style="margin:0 0 18px">Responder rápido hace la diferencia: la gente decide en las primeras horas.</p>' +
      '<a href="' + PANEL_URL + '" style="display:inline-block;background:#E8836B;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">Ver su perfil completo</a> ' +
      (wa ? '<a href="' + wa + '" style="display:inline-block;background:#25D366;color:#fff;text-decoration:none;padding:12px 20px;border-radius:999px;font-weight:bold">Escribir por WhatsApp</a>' : '') +
      '<p style="margin-top:22px;font-size:12px;color:#96907F">Recibes este aviso porque tu refugio está en PetMatch.</p></div>';

    MailApp.sendEmail({
      to: correo,
      subject: '🐾 Nuevo interesado en ' + mascota + (score ? ' (' + score + '% match)' : ''),
      htmlBody: html,
      name: NOMBRE_REMITENTE
    });
    return salida('ok');
  } catch (err) {
    console.error(err);
    return salida('error');
  }
}

function doGet() { return salida('PetMatch avisos activo'); }

function leerDoc(ruta, idToken) {
  var url = 'https://firestore.googleapis.com/v1/projects/' + PROJECT_ID + '/databases/(default)/documents/' + ruta;
  var r = UrlFetchApp.fetch(url, {
    method: 'get',
    headers: { Authorization: 'Bearer ' + idToken },
    muteHttpExceptions: true
  });
  return r.getResponseCode() === 200 ? JSON.parse(r.getContentText()) : null;
}

function h(s) {
  return String(s).replace(/[&<>"']/g, function (m) {
    return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[m];
  });
}

function salida(t) { return ContentService.createTextOutput(t); }

/** Ejecútala UNA vez a mano para autorizar permisos (correo y conexión externa). */
function autorizar() {
  MailApp.getRemainingDailyQuota();
  UrlFetchApp.fetch('https://www.google.com');
}
