# PetMatch — Ubicación, filtros y mapa

## Qué hay de nuevo
- **Refugios:** al publicar o editar un animal piden **estado** (lista de los 32) y **municipio**. Por defecto vienen los del refugio (⋯ → Redes sociales del refugio → también ahí se configura el estado y municipio del refugio). Solo se muestra municipio y estado, nunca la dirección.
- **Adoptantes:** en «Cuéntanos tu rutina» hay un campo **Estado** (se deduce solo de la ciudad si no lo eligen). En el catálogo hay una barra **📍 ¿Dónde estás?**: eligen su estado o tocan **🎯 Usar mi ubicación** (el celular pide permiso). Se guarda solo en su navegador.
- **Catálogo (compacto):** una sola línea con ¿Dónde estás? · 🎯 · ⚙️ Filtros · Lista/Mapa; los filtros se abren con el botón. Filtros por estado (con conteo), tamaño, energía y edad, además de perros/gatos. Orden: recomendado, más cerca, más compatibles, más recientes. Etiquetas «🎯 a 12 km» / «📍 En tu estado». Vista **🗺️ Mapa** con las fotos como pines (Leaflet + OpenStreetMap, gratis, sin llaves).
- **Google Maps:** en cada animal, botones «🗺️ Ver en Google Maps» y «🧭 Cómo llegar» (sin llave de API).
- **Match:** la cercanía suma al puntaje (nunca bloquea) y aparece «Vive cerca de ti» / «Está en tu estado».
- **Animales ya publicados** (sin estado guardado): el estado se deduce de su ciudad («Cuernavaca» → Morelos). Cuando el refugio los edite, quedan con estado y coordenadas.

## Archivos
Nuevos: `js/geo.js`, `css/geo.css`. Modificados: `js/catalogo.js`, `catalogo.html`, `js/matching.js`, `js/swipe.js`, `js/shelter.js`, `shelter.html`, `js/onboarding.js`, `onboarding.html`.
Para quitar la parte visual del catálogo: borra el `<link>` de `css/geo.css` en `catalogo.html`.

## Notas
- La distancia en km solo se muestra si se conoce la ciudad o el GPS; con solo el estado se muestra «En tu estado».
- Las coordenadas del municipio se obtienen de una tabla interna o de OpenStreetMap (Nominatim); si no hay red, se usa el centro del estado.
- No se necesita cambiar las reglas de Firestore.
