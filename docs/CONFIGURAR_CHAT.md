# Configurar el chat privado «Tu servidor, Cris» (Supabase, plan gratuito)

El regalo funciona **sin** chat. Estos pasos activan el chat real. Toma unos 15–20 minutos.

> **Qué es cada cosa.** La página (GitHub Pages) es solo archivos estáticos. Los mensajes viven en
> **Supabase** (base de datos + login + tiempo real). El navegador habla directo con Supabase usando la
> clave pública *anon*; **lo que impide que alguien lea mensajes ajenos son las políticas RLS** de `supabase/schema.sql`.

---

## 1. Crear el proyecto en Supabase

1. Entra a <https://supabase.com> → **Start your project** → inicia sesión (puedes usar tu cuenta de GitHub).
2. **New project** → nombre `maria-rosa-23`, elige una **contraseña de base de datos** (guárdala en tu gestor de contraseñas; **no** hace falta en el código) y la región más cercana (por ejemplo *South America (São Paulo)*).
3. Espera a que termine de crearse (1–2 min).

## 2. Crear las tablas y las políticas de seguridad

1. En el menú izquierdo: **SQL Editor** → **New query**.
2. Abre el archivo `supabase/schema.sql`, copia **todo**, pégalo y pulsa **Run**. Debe terminar sin errores (es seguro volver a ejecutarlo).
3. *(Recomendado)* Ejecuta también `supabase/tests.sql` (SQL Editor → New query → Run), **antes** de crear al administrador. Terminará con un mensaje rojo que en realidad es el **informe**: es lo normal, porque así se deshace todo lo de prueba. Las 14 líneas deben decir **OK ✅**. Si alguna dice **FALLO ❌**, no compartas el chat todavía (ver `docs/SEGURIDAD_Y_PRUEBAS.md`).

## 3. Crear a Cris como único administrador

1. **Authentication → Users → Add user → Create new user**: tu correo, una contraseña larga y marca **Auto Confirm User**.
2. **SQL Editor** → ejecuta (con tu correo real):

   ```sql
   select public.bootstrap_admin('tu-correo@ejemplo.com');
   ```

   Esto es lo **único** que otorga el rol de administrador. Ningún formulario de la web puede hacerlo.
3. Tu panel está en `…/#/admin` (por ejemplo `https://TU-USUARIO.github.io/maria-rosa-23/#/admin`). Guárdalo en favoritos; no hay ningún enlace público hacia él.
4. En el panel → **⚙ Ajustes → Activar verificación en dos pasos** (recomendado).

## 4. Configurar el acceso de los visitantes

En **Authentication → URL Configuration**:

* **Site URL**: la dirección pública de tu página, p. ej. `https://TU-USUARIO.github.io/maria-rosa-23/`
* **Redirect URLs** (agrega ambas):
  * `https://TU-USUARIO.github.io/maria-rosa-23/**`
  * `http://localhost:5173/**` (solo para probar en tu PC)

### Opción A — Código por correo (ya implementado)

Los visitantes escriben su correo, reciben un **código de 6 dígitos** y lo ingresan.

1. **Authentication → Emails → Templates → Magic Link** (a veces llamado *Confirm signup* / *Magic link*). Reemplaza el cuerpo para que muestre el código:

   ```html
   <h2>Tu código para escribirle a Cris 🌹</h2>
   <p>Tu código de acceso es:</p>
   <h1 style="letter-spacing:6px">{{ .Token }}</h1>
   <p>Si no lo pediste, ignora este correo.</p>
   ```

   Haz lo mismo con la plantilla **Confirm signup** (los usuarios nuevos reciben esa).
2. ⚠️ **Limitación importante del plan gratuito:** el servicio de correo que trae Supabase por defecto es *solo para pruebas*: tiene un límite muy bajo y **solo envía a miembros de tu equipo**. Para que los códigos lleguen a cualquiera necesitas **SMTP propio** (gratis):
   * **Gmail** (el más simple): activa la verificación en dos pasos en tu cuenta Google → crea una *contraseña de aplicación* → en Supabase **Project Settings → Authentication → SMTP Settings** → *Enable custom SMTP*: host `smtp.gmail.com`, puerto `465`, usuario = tu Gmail, contraseña = la de aplicación, remitente = tu Gmail. (≈ 500 correos/día.)
   * **Brevo** (300 correos/día gratis) o **Resend** (requiere verificar un dominio propio) también sirven.
3. En **Authentication → Rate Limits** puedes subir el límite de correos por hora una vez que tengas SMTP propio.

### Opción B — «Entrar con Google» (un toque, sin correos)

1. En <https://console.cloud.google.com> crea un proyecto → **APIs & Services → OAuth consent screen** (externo) → **Credentials → Create OAuth client ID → Web application**.
2. *Authorized redirect URI*: la que muestra Supabase en **Authentication → Providers → Google** (termina en `/auth/v1/callback`).
3. Copia *Client ID* y *Client secret* a ese mismo panel de Supabase, activa el proveedor y guarda.
4. Para mostrar el botón en la página, define la variable `VITE_AUTH_GOOGLE=true` (ver paso 6).

Puedes usar solo la A, solo la B, o ambas.

## 5. Bienvenida especial para María Rosa (opcional)

Cuando ella entre con **su** correo verificado (o su cuenta de Google), el chat le mostrará:

> Hola, María Rosa. 🌹 Este pequeño universo fue creado especialmente para ti…

Registra su correo (en minúsculas) en el SQL Editor:

```sql
insert into public.special_contacts (email, display_name)
values ('correo-de-maria-rosa@ejemplo.com', 'María Rosa');
```

Nadie puede reclamar esa bienvenida escribiendo su nombre: se compara contra el correo **verificado**. Su conversación con Cris es independiente de las demás.

## 6. Conectar la página con Supabase

En Supabase: **Project Settings → API**. Copia dos valores públicos:

* **Project URL** (`https://xxxx.supabase.co`)
* **anon public key**

> 🚫 **Nunca** uses ni pegues la `service_role` key. Esa sí es secreta y daría acceso total.

**Para probar en tu PC:** copia `.env.example` a `.env` y completa los dos valores; luego `npm run dev`.

**Para el sitio publicado (GitHub Pages):** en tu repositorio de GitHub →
**Settings → Secrets and variables → Actions → pestaña *Variables* → New repository variable**:

| Nombre | Valor |
|---|---|
| `VITE_SUPABASE_URL` | tu Project URL |
| `VITE_SUPABASE_ANON_KEY` | tu anon public key |
| `VITE_AUTH_GOOGLE` | `true` solo si configuraste la Opción B |
| `VITE_AUTH_EMAIL` | `true` (o `false` si solo usarás Google) |

Luego **Actions → Publicar en GitHub Pages → Run workflow** para reconstruir con esos valores.

## 7. Verificación final antes de compartir el enlace

Sigue la lista de `docs/SEGURIDAD_Y_PRUEBAS.md` (10 minutos). Lo mínimo:

1. Entra con dos cuentas de visitante distintas y comprueba que cada una ve **solo** su conversación.
2. Entra a `#/admin` con tu cuenta y comprueba que ves ambas y puedes responder.
3. Comprueba que la respuesta aparece en el chat del visitante correcto, en tiempo real.

---

## Límites del plan gratuito (dilos antes de publicar)

* **Pausa por inactividad:** Supabase puede *pausar* proyectos gratuitos tras ~1 semana sin actividad. Si pasa, entra a supabase.com y pulsa **Restore project**. Con visitas y mensajes normales no ocurre.
* **Correo:** ver el aviso de SMTP arriba.
* **Cuotas** (aprox., revisa su página de precios): 500 MB de base de datos, 50 000 usuarios activos al mes, ~200 conexiones simultáneas en tiempo real. Para un regalo entre amigos sobra.
* **Notificaciones:** funcionan con la pestaña abierta (aviso del navegador + sonido + contador). Correo/WhatsApp **no** están integrados todavía (ver `docs/NOTIFICACIONES.md`).
* **Privacidad real:** los mensajes viajan cifrados (HTTPS) y quedan protegidos por RLS, **pero no hay cifrado de extremo a extremo**: tú (administrador) y Supabase (el proveedor) técnicamente pueden leerlos. La página lo dice así a los visitantes.
