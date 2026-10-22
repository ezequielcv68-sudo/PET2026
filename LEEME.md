# PatitasMatch — Lote 1

Todos los archivos conservan la misma estructura de tu repo: copia cada uno en la misma ruta y reemplaza.

## Qué incluye

| Archivo | Cambio |
|---|---|
| `js/firebase-config.js` | Agrega recuperar contraseña, Google y Analytics (`track()`), más utilidades `esc`, `safeUrl`. **Se conservan todos los exports anteriores.** |
| `js/auth.js` + `auth.html` | Botón «Continuar con Google», «¿Olvidaste tu contraseña?», copia del perfil del test al registrarse, refugios nacen con `verified: false`. |
| `test.html` + `js/test.js` | **Nuevos.** Test de 8 preguntas sin registro, con resultados y razones del match. |
| `js/matching.js` | Solo se **agrega** `explicarMatch()` al final. Nada de lo existente cambia. |
| `js/catalogo.js` + `catalogo.html` | Corrige XSS, oculta adoptadas, ya no abre el modal solo, «Me interesa» recuerda la mascota, enlace directo `?m=ID` y botón Compartir. |
| `js/swipe.js` | Escapa todo el HTML, muestra por qué hace match, guarda el like pendiente, copia al swipe los datos del adoptante (solo en likes). |
| `js/shelter.js` | Interesados y CSV leen los datos del swipe (ya no perfiles ajenos), consultas con `shelterId`, marca `shelterVerified`, CSV a prueba de fórmulas de Excel. |
| `index.html` | Quita estrellas e iniciales falsas, cambia «IA» por «algoritmo», ajusta «verificados», CTA al test, metadatos para compartir, marca unificada. |
| `firestore.rules` | Reglas nuevas (ver orden de instalación). |

## Orden de instalación (importante)

1. **Sube primero todos los archivos** (GitHub → Vercel). Aún no toques las reglas.
2. En Firebase Console → **Authentication → Sign-in method** activa **Google**.
3. En **Authentication → Settings → Authorized domains** confirma que está `pet-2026.vercel.app`.
4. Prueba en tu sitio: registro, test sin registro, catálogo, swipe, panel de refugio.
5. **Después** pega `firestore.rules` en Firestore → Reglas y pruébalas en **Rules Playground** antes de publicar.

Si publicas las reglas antes que el código nuevo, el panel de refugio dejará de mostrar interesados.

## Marcar un refugio como verificado

Firebase Console → Firestore → `users` → documento del refugio → agrega el campo `verified` (boolean) = `true`.
La próxima vez que ese refugio publique o edite una mascota, se marcará con ✓. Las mascotas anteriores se actualizan al editarlas.

## Lo que debes saber

- **No pude ejecutar la app ni las reglas.** Revisé la sintaxis de todos los JS, que cada import exista y que los IDs del HTML coincidan, y probé el motor de match con datos de ejemplo. Las reglas de Firestore **no están probadas**: usa el Rules Playground.
- **`onboarding.js` llegó cortado**, así que no pude confirmar los nombres de campos que guarda. `matching.js` lee `especiePreferida` y `tamanoPreferido`; el test guarda esos mismos nombres. Si tu onboarding usa otros, ajusta el objeto `perfil` en `js/test.js`.
- Al registrarse con un test hecho, el perfil se copia y se manda a `onboarding.html`, donde faltarán teléfono, biografía y las preguntas que el test no hace (tipo de vivienda, acuerdo familiar, viajes).
- Un «Me interesa» hecho antes de registrarse se guarda al llegar a `swipe.html`. Si tu onboarding termina en otra página, el like se guarda en cuanto la persona entre a Descubrir.
- Los likes anteriores a este lote no traen el campo `adopter`, así que el refugio los verá como «Adoptante». Si ya hay datos reales, avísame y hacemos una migración.
- **El textos de «verificados» es propuesta mía.** Ajusta lo que prometas a lo que de verdad vayas a revisar.
- El correo `petmach@gmail.com` del pie no lo toqué: si es tu correo real, déjalo; si es un typo, corrígelo en `index.html`.
- Borra `js/history.js`: no lo usa ninguna página y fallaría si se cargara.

## Queda para el lote 2

Compresión y varias fotos por mascota, campos de sexo/vacunas/esterilización/cuota, WhatsApp en «Mis matches», deshacer swipe, aviso de privacidad, panel `admin.html`, PWA, `sitemap.xml` y páginas con Open Graph por mascota.
