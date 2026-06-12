# Musicala Ensambles

Primera base funcional para administrar bandas/ensambles de Musicala.

## Qué incluye
- Dashboard general.
- CRUD de bandas.
- CRUD de estudiantes asignados a bandas.
- CRUD de canciones/repertorio.
- CRUD de ensayos con objetivos y resultados.
- Modo local con localStorage.
- Estructura lista para Firestore.

## Cómo probar
Por ser una app con JavaScript tipo módulo, ábrela con servidor local:

```bash
python -m http.server 8000
```

Luego entra a:

```text
http://localhost:8000
```

También puedes subirla a GitHub Pages, Netlify, Vercel o Firebase Hosting.

## Activar Firebase
Edita `firebase-config.js`:

```js
export const firebaseSettings = {
  useFirebase: true,
  config: {
    apiKey: "...",
    authDomain: "...",
    projectId: "...",
    storageBucket: "...",
    messagingSenderId: "...",
    appId: "..."
  }
};
```

## Colecciones Firestore sugeridas
- `bands`
- `students`
- `songs`
- `rehearsals`

## Siguiente capa sugerida
- Login por Google.
- Roles: admin, docente, estudiante/familia.
- Asistencia por ensayo.
- Tareas por canción e instrumento.
- Archivos por canción: letra, acordes, partitura, backing track.
- Vista pública para estudiantes por QR.
