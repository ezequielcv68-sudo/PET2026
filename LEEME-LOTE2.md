# PetMatch — Lote 2 (tarjeta compartible + avisos al refugio)

## Archivos (misma ruta que en tu repo; reemplaza o agrega)
| Archivo | Qué hace |
|---|---|
| `js/sharecard.js` (nuevo) | Crea la tarjeta 1080×1920 (foto, nombre, datos, QR al perfil) y la comparte o descarga. |
| `js/avisos.js` (nuevo) | Manda el aviso al Apps Script cuando hay un like. Si `AVISOS_URL` está vacío, no hace nada. |
| `apps-script/avisos.gs` (nuevo, no se sube a GitHub) | Código que pegas en Google Apps Script. |
| `js/catalogo.js` + `catalogo.html` | Botón «🖼️ Tarjeta» en la ficha de cada mascota. |
| `js/shelter.js` | Botón «🖼️ Tarjeta» por mascota, aviso «🔔 N interesados nuevos» y contador por mascota. |
| `js/swipe.js` | Después de guardar un like, dispara el aviso al refugio. |

## Instalar la tarjeta
Solo sube los archivos a GitHub. Funciona sin más pasos.

## Instalar los avisos por correo (10 min)
1. Entra a https://script.google.com con la cuenta de Gmail desde la que saldrán los correos → **Nuevo proyecto**.
2. Borra lo que trae y pega todo `apps-script/avisos.gs`. Guarda.
3. Arriba, en la lista de funciones elige **autorizar** → **Ejecutar** → acepta los permisos (correo y conexión externa).
4. **Implementar → Nueva implementación → Tipo: Aplicación web**
   - Ejecutar como: **Yo**
   - Quién tiene acceso: **Cualquier persona**
   - Copia la URL que termina en `/exec`.
5. En GitHub abre `js/avisos.js` y pega esa URL en `export const AVISOS_URL = "";` → commit.
6. Prueba: con una cuenta de adoptante dale «Me interesa» a una mascota de un refugio con correo real. Debe llegar el aviso en menos de un minuto.

Si cambias el código del script, hay que hacer **Implementar → Administrar implementaciones → editar → Nueva versión**; la URL se conserva.

## Cómo está protegido
- El script lee el like y el correo del refugio en Firestore **con la sesión del adoptante**, así que mandan tus reglas de seguridad.
- El destinatario sale de la base de datos, nunca de lo que mande la página: nadie puede usarlo para spam a otras direcciones.
- Cada like avisa una sola vez.

## Límites a tener en cuenta
- Gmail gratuito permite unos **100 correos por día** desde Apps Script (Workspace, 1,500). Con tu tráfico actual sobra. Si crece, cambia a un servicio de correo.
- Los correos pueden caer en spam la primera vez: pide a los refugios que marquen «No es spam».
- No pude probar Apps Script ni Firestore reales desde aquí. Sí probé la tarjeta en un navegador y revisé la sintaxis de todos los JS.
- Si la foto de una mascota no permite exportarse (CORS), la tarjeta sale con un fondo ilustrado en vez de la foto. Las fotos de Firebase Storage y Unsplash normalmente funcionan.
- La tarjeta pone «Lleva N días esperando» solo cuando la mascota lleva 7 días o más publicada (usa `createdAt`); nunca inventa el dato.
