# Panel de administración — puesta en marcha (5 pasos)

Entrada: https://www.hazpetmatch.com/admin.html (no aparece enlazada en la app; solo tú la conoces).

1. **Sube** a GitHub los archivos nuevos/cambiados: admin.html, css/admin.css, js/admin.js, js/shelter.js, js/swipe.js, js/catalogo.js, js/test.js (+ firestore.rules y storage.rules como respaldo). No borres img/logo.png ni js/matches.js.
2. **Obtén tu UID**: inicia sesión con tu cuenta en la app, abre /admin.html. Dirá "Sin acceso" y mostrará tu UID (también está en Firebase Console → Authentication → Users).
3. **Crea tu documento de administrador** (a mano; la app no puede crearlo): Firebase Console → Firestore → "Iniciar colección" → ID `admins` → ID de documento = tu UID → agrega un campo cualquiera (ej. `activo: true`).
4. **Publica las reglas**: Firestore → Reglas: pega el contenido de `firestore.rules` → Publicar. Storage → Reglas: pega `storage.rules` → Publicar. Después prueba: registro, test, "Me interesa", panel de refugio y catálogo siguen funcionando.
   - Si ya tenías reglas propias, compáralas antes de reemplazar (el archivo cierra por defecto cualquier colección no listada).
5. Abre /admin.html y entra.

## Qué puedes hacer
Resumen (KPIs y pendientes) · Refugios (verificar, suspender, editar, subir animales, eliminar datos) · Animales (editar, foto, adoptado/oculto, eliminar, ver interesados) · Adoptantes (ver perfil, suspender, eliminar datos) · Bitácora de acciones.

## Límites
- **Eliminar datos NO borra la cuenta de acceso** (Authentication). Bórrala a mano en Firebase Console → Authentication. Hacerlo desde el panel requiere Cloud Functions (plan Blaze).
- Un usuario suspendido es expulsado al entrar y las reglas bloquean sus escrituras.
- Visitas/tráfico: Google Analytics.
- Recomendado: aviso de privacidad (tratas datos personales de adoptantes).
