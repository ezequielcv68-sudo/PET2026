# PetMatch — Lote 3 (botones, preguntas y funciones nuevas)

Colores, tipografías y estilo general NO cambian. Todo lo nuevo vive en archivos aparte:
`css/ux.css` y `js/ux.js`. Si algo no te gusta, quita el `<link>` de ux.css (o el `<script>` de ux.js)
en las páginas y todo vuelve a como estaba.

## Qué cambia
- **Botones**: se elevan al pasar el cursor, se hunden al tocarlos, brillo suave en los principales, foco visible con teclado.
- **Barra superior fija** (con efecto cristal) y **botones según la sesión**: si ya iniciaste sesión, en vez de «Iniciar sesión / Comenzar» ves «Mi panel» (refugio) o «Descubrir» (adoptante) y «Salir» con icono.
- **Preguntas** (test y «Cuéntanos tu rutina»): iconos en cada opción, números, palomita al contestar, barra de progreso, avance automático a la siguiente pregunta, y marca «opcional» en las que no son obligatorias.
- **Conteo en vivo en el test**: mientras contestas dice «Hasta ahora: N de M animales podrían ser tu match» y se va afinando.
- **Portada con datos reales**: contadores (animales esperando hogar, refugios, adoptados) y el carrusel del inicio usa los animales publicados con foto. Si aún no hay ninguno, se queda el ejemplo de antes.
- **Catálogo «✨ Para ti»**: si la persona ya hizo el test o tiene perfil, cada animal muestra «% para ti» y puede ordenarlos por compatibilidad. Con un enlace directo (`?m=ID`) siempre se muestran todos.
- **Compartir mi resultado** al terminar el test.
- **Huellitas y vibración** al dar «Me interesa»; flechas ← → para descartar o dar «me interesa» en Descubrir.
- **Esqueletos de carga** en el catálogo en vez del texto «Cargando».
- **App instalable (PWA)**: en el celular o en Chrome aparece «📲 Instala PetMatch». Usa `manifest.webmanifest`, `sw.js` y los iconos nuevos de `img/`.
- Respeta «reducir movimiento» del sistema.
- **Fotos completas, sin recortes** (compu y celular): en Descubrir, resultados del test, Mis matches, panel del refugio y la tarjeta para historias, el animal se ve entero. La caja de la foto toma la proporción real de la imagen (sin recortes y sin franjas); solo en fotos muy alargadas queda un borde mínimo difuminado. **La portada no se toca: sigue como la tenías.**
- Los sellos «ME GUSTA / PASO» de Descubrir ahora solo aparecen al arrastrar la tarjeta.

## Cómo subirlo
Es el sitio completo, así que sube **todo** el contenido del zip a GitHub (arrastra todas las carpetas y archivos juntos; reemplaza lo que ya existe).
Este zip ya incluye tu URL de avisos en `js/avisos.js` y los cambios de textos («animales de compañía», «mejores amigos»).
No incluye la carpeta `apps-script` (esa vive en Google, no en GitHub).

## Lo que no pude probar
- Probé en un navegador de pruebas con datos de ejemplo en lugar de tu Firebase real. Revisa tú en vivo: portada, test, catálogo, onboarding, panel de refugio y Descubrir.
- La instalación como app depende del navegador (Chrome en Android y escritorio sí; en iPhone se hace desde Compartir → «Agregar a inicio»).
- Los contadores de la portada leen la colección `pets` (ya es pública). No leen datos de personas.
