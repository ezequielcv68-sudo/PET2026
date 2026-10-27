# Apadrinamiento — qué se agregó y cómo ponerlo en marcha

## Cómo funciona
1. El refugio edita un animal y activa **"Recibir apadrinamientos"** (meta mensual y qué cubre).
2. Cualquiera ve el animal en `apadrinar.html` (o desde su ficha / catálogo). El padrino **escribe el monto a mano**, elige cada mes / una vez / en especie.
3. Se abre WhatsApp al refugio con el mensaje listo. El refugio le da sus datos de depósito (la app NO guarda CLABEs).
4. **Doble confirmación**: el padrino marca "Ya hice mi aportación" (Mis ahijados) y el refugio marca "Sí, lo recibí" (Apadrinamientos). Solo entonces el apadrinamiento pasa a *Activo* y suma a la meta del animal.
5. El refugio publica **recibos y novedades** (línea de vida pública). Si sube algo cada 35 días, el animal muestra el sello **"Refugio al corriente"**.
6. Si el animal es adoptado, el refugio pulsa "avisar a sus padrinos" y cada padrino elige: apadrinar a otro del mismo refugio o detener su ayuda.

## Archivos nuevos
apadrinar.html · ahijados.html · padrinos.html · css/apadrinar.css · js/apadrinar.js · js/ahijados.js · js/padrinos.js · js/apad-lib.js

## Archivos modificados
index.html (sección + menú) · swipe.html y matches.html (pestaña Apadrinar) · catalogo.html + js/catalogo.js (botón) · test.html + js/test.js (invitación según el resultado) · shelter.html + js/shelter.js (campos y menú) · js/swipe.js (enlace en la ficha) · css/ux.css · js/admin.js (KPIs de padrinos)

## Pasos obligatorios
1. Sube todo a GitHub (carpetas css/ y js/ en su lugar).
2. **Reglas de Firestore** (obligatorio, si no, apadrinar da error de permisos): Firestore → Reglas → pega `firestore.rules` → Publicar. Son tus reglas actuales + `admins`, `adminLog` y las colecciones nuevas `sponsorships`, `sponsorPayments`, `sponsorPosts`.
3. Prueba: activa apadrinamiento en un animal tuyo, apadrínalo con otra cuenta, confirma ambos lados.

## Lo que esto NO hace (a propósito)
- No mueve dinero: el depósito va directo al refugio. PetMatch no cobra, no retiene ni reembolsa. Díselo así a los refugios y a los padrinos.
- No manda avisos automáticos: el padrino y el refugio se ven por WhatsApp y por sus paneles.
- Las promesas mostradas (comprobantes, sello, doble confirmación) las cumple cada refugio; PetMatch las hace visibles y puede pausar a quien no las cumpla (puedes ocultar animales o suspender refugios desde admin.html).

## Después (fase siguiente)
Pago en línea (Mercado Pago), recordatorio mensual al padrino, reporte CSV de apadrinamientos, y borrar cuentas de Authentication con una Cloud Function (ya tienes plan Blaze).
