# 🐾 PatitasMatch

App tipo "Tinder para mascotas de refugio". Los refugios suben perritos y
gatitos con foto y datos; las personas contestan una encuesta de estilo de
vida y la app les sugiere, en orden de compatibilidad, a quién conocer —
deslizando a la derecha para dar like.

Hecha en HTML/CSS/JS puro (sin build step) + Firebase como backend gratuito.
Se puede subir directo a GitHub Pages o Vercel.

## 1. Estructura del proyecto

```
patitas-match/
├── index.html          → Landing pública
├── catalogo.html        → Catálogo público de mascotas (sin login)
├── auth.html             → Registro / inicio de sesión (adoptante o refugio)
├── onboarding.html       → Encuesta de estilo de vida (adoptante)
├── swipe.html             → Deck de swipe (adoptante)
├── matches.html           → Mascotas con match (adoptante)
├── shelter.html           → Panel del refugio (alta de mascotas, interesados)
├── css/styles.css
└── js/
    ├── firebase-config.js  → Config e inicialización de Firebase
    ├── auth.js
    ├── onboarding.js
    ├── matching.js          → Motor de match (scoring ponderado)
    ├── swipe.js
    ├── matches.js
    └── shelter.js
```

## 2. Configurar Firebase (gratis)

1. Ve a [console.firebase.google.com](https://console.firebase.google.com) → **Crear proyecto**.
2. Dentro del proyecto, agrega una **Web app** (ícono `</>`), ponle un nombre y copia el objeto `firebaseConfig` que te muestra.
3. Pega esos valores en `js/firebase-config.js`, reemplazando los `"TU_..."`.
4. En el menú lateral activa:
   - **Authentication** → pestaña *Sign-in method* → habilita **Correo electrónico/contraseña**.
   - **Firestore Database** → *Crear base de datos* → modo producción.
   - **Storage** → *Comenzar* (para guardar las fotos de las mascotas).

### Reglas de Firestore
Ve a Firestore → pestaña **Reglas** y pega esto:

```js
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    match /users/{userId} {
      allow read: if request.auth != null;
      allow write: if request.auth != null && request.auth.uid == userId;
    }

    match /adopterProfiles/{userId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }

    match /pets/{petId} {
      allow read: if true; // catálogo público
      allow create: if request.auth != null && request.resource.data.shelterId == request.auth.uid;
      allow update, delete: if request.auth != null && resource.data.shelterId == request.auth.uid;
    }

    match /swipes/{swipeId} {
      allow read: if request.auth != null;
      allow create: if request.auth != null && request.resource.data.adopterId == request.auth.uid;
      allow update: if false;
      allow delete: if false;
    }
  }
}
```

### Reglas de Storage
Ve a Storage → **Reglas**:

```js
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /pets/{shelterId}/{fileName} {
      allow read: if true;
      allow write: if request.auth != null && request.auth.uid == shelterId
                   && request.resource.size < 5 * 1024 * 1024
                   && request.resource.contentType.matches('image/.*');
    }
  }
}
```

> Si al usar la app ves un error de Firestore que dice *"The query requires an index"*,
> abre el enlace que trae el error en la consola del navegador — Firebase te deja
> crear el índice con un clic.

## 3. Probar en local

No necesitas build ni `npm install`. Solo sirve la carpeta con cualquier servidor
estático (Firebase usa módulos ES, así que no puedes abrir el `.html` con doble clic,
necesita un servidor):

```bash
npx serve .
# o
python3 -m http.server 5500
```

Abre `http://localhost:5500` (o el puerto que te indique).

## 4. Subir a GitHub

```bash
cd patitas-match
git init
git add .
git commit -m "PatitasMatch: primera versión"
git branch -M main
git remote add origin https://github.com/TU_USUARIO/patitas-match.git
git push -u origin main
```

## 5. Desplegar a Vercel

1. Entra a [vercel.com](https://vercel.com) → **Add New Project** → importa tu repo de GitHub.
2. Como es HTML estático, Vercel lo detecta solo — no necesitas configurar *build command* ni *output directory* (déjalos vacíos / "Other").
3. Dale **Deploy**. En un par de minutos tendrás tu URL `.vercel.app` oficial.
4. En Firebase Console → Authentication → *Settings* → *Authorized domains*, agrega tu dominio de Vercel (y luego tu dominio propio si lo conectas).

## 6. Cómo funciona el match

`js/matching.js` calcula un puntaje 0–100 cruzando, con pesos distintos:
tamaño de la mascota, nivel de energía, tipo de vivienda del adoptante,
si hay niños u otras mascotas en casa, experiencia previa, horas que
quedaría sola, y distancia (si hay ubicación de ambos). Todo corre en el
navegador, es gratis e instantáneo — no necesita servidor.

### Siguiente nivel con IA generativa (opcional)
Para sumar una capa de IA real (por ejemplo, que un modelo de lenguaje
escriba una explicación personalizada de "por qué este match" o afine el
orden con más matices), necesitarías una función de backend que llame a un
LLM con tu API key — nunca se debe exponer una API key de IA en el código
del navegador. Opciones sencillas:
- **Vercel Serverless Function** (`/api/explicar-match.js`) que reciba el
  perfil + la mascota y llame a la API de Claude o de tu proveedor preferido.
- **Firebase Cloud Functions**, que se integran de forma natural con el resto
  del proyecto.

El motor actual ya deja todo lo necesario (perfil del adoptante + datos de
la mascota) listo para pasárselo a un LLM en el futuro sin rehacer nada.

## 7. Roles y flujo

- **Adoptante**: se registra → contesta la encuesta (`onboarding.html`) →
  desliza en `swipe.html` (ordenado por % de match) → sus likes aparecen
  en `matches.html`, con el contacto del refugio.
- **Refugio**: se registra con el rol "Soy un refugio" → en `shelter.html`
  sube mascotas (foto + datos) → puede ver quién dio like a cada una y
  marcar como adoptada cuando encuentre hogar.
