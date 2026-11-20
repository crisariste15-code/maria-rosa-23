# 🌹 María Rosa — 23 primaveras

*Un pequeño universo creado con muchísimo cariño. De Cris, para María Rosa Ñañac Valencia.*

Experiencia web cinematográfica en 3D (React + Three.js) con chat privado real (Supabase),
publicable **gratis** en GitHub Pages.

## Recorrido

1. Pantalla inicial → partículas que forman una **rosa 3D** → **23 pétalos** (uno por primavera) → se abre y surge su nombre.
2. Jardín mágico al atardecer: rosas, mariposas, luciérnagas, faroles y frases.
3. Galería de fotos con marcos y visor ampliado.
4. Carta de Cris (sobre, sello, papel marfil, escritura progresiva, pétalos al terminar).
5. **23 flores = 23 deseos** (interactivas).
6. Cielo estrellado: estrella especial, estrellas fugaces y ramo de rosas.
7. Música instrumental delicada (opcional, nunca suena sola).
8. Botón flotante **💌 Tu servidor, Cris**: chat privado uno a uno, con panel exclusivo para Cris en `#/admin`.

## Estructura

```
src/
  sections/   introducción, galería, carta, deseos, final
  three/      rosa procedural, partículas, entorno
  world/      jardín 3D, prado de los deseos, noche, cámara guiada por scroll
  chat/       chat del visitante          admin/   panel privado de Cris
  data/       textos (frases, deseos, carta) y fotos
  lib/        música generada, Supabase, avisos
supabase/     schema.sql (tablas + RLS) y tests.sql (pruebas de seguridad)
docs/         guías de configuración, seguridad y notificaciones
```

## Ejecutar en tu computador

Requiere [Node.js 22 o superior](https://nodejs.org).

```powershell
npm install
npm run dev        # http://localhost:5173   (añade ?mundo para saltar la introducción)
```

## Cambiar fotos

Las fotos viven en `src/assets/fotos/`. **Agrega o reemplaza** archivos JPG/PNG/WEBP ahí
(se ordenan por nombre: `foto-01.jpg`, `foto-02.jpg`…). La galería se reacomoda sola según cuántas haya.
Para el mensajito de cada una edita `src/assets/fotos/captions.json`:

```json
{ "foto-01.jpg": "Tu mensaje corto y cariñoso" }
```

Recomendaciones: originales (no capturas de pantalla), ≈ 1200 px de lado largo, menos de 400 KB cada una.
Las fotos se muestran **sin recortar ni deformar** el rostro.
Si la carpeta queda vacía, la galería muestra espacios reservados.

## Cambiar textos

Todo el texto (frases, 23 deseos, carta, mensajes finales) está en `src/data/content.ts`.

## Música

Por defecto suena una melodía **instrumental original generada en el navegador** (sin derechos de autor).
Para usar una canción propia **con licencia adecuada para publicación**, copia el archivo a
`public/musica/fondo.mp3`: se usará automáticamente.

## Publicar gratis en GitHub Pages

1. **Sube el código** a un repositorio **público** (necesario para Pages gratis):

   ```powershell
   git init -b main
   git add .
   git commit -m "María Rosa — 23 primaveras"
   git remote add origin https://github.com/TU-USUARIO/maria-rosa-23.git
   git push -u origin main
   ```

2. En GitHub: **Settings → Pages → Build and deployment → Source: GitHub Actions**.
3. El flujo `.github/workflows/deploy.yml` compila y publica en cada `push` a `main` (pestaña **Actions**).
4. Tu enlace público será: `https://TU-USUARIO.github.io/maria-rosa-23/`
5. Para activar el chat, sigue **`docs/CONFIGURAR_CHAT.md`** (Supabase gratis) y agrega las variables de repositorio indicadas.

### Límites del plan gratuito

* GitHub Pages: sitio estático (≈ 1 GB, 100 GB de transferencia/mes) y repositorio público.
* Supabase gratis: puede pausarse tras ~1 semana sin actividad; el correo integrado es solo de pruebas, por eso se necesita SMTP propio o Google para los códigos. Detalles en `docs/CONFIGURAR_CHAT.md`.
* El chat **no** tiene cifrado de extremo a extremo (el aviso a los visitantes lo dice).
* Notificaciones: solo con la pestaña abierta; correo/WhatsApp están preparados en arquitectura pero no integrados (`docs/NOTIFICACIONES.md`).

## Seguridad y pruebas

Ver `docs/SEGURIDAD_Y_PRUEBAS.md` (medidas, limitaciones y lista de pruebas) y ejecutar `supabase/tests.sql`.

## Mantenimiento

* Dependencias: `npm outdated` / `npm update`; después `npm run typecheck && npm run build`.
* Si el chat deja de responder: revisa que el proyecto de Supabase no esté pausado.
* Contraseña del panel perdida: pantalla de acceso de `#/admin` → «Olvidé mi contraseña».
