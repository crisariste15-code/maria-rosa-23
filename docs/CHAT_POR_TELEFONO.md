# Chat privado por número de teléfono (versión vigente)

El chat es **solo entre dos personas**, identificadas por su número de teléfono. No hay correos, ni Google, ni registros abiertos.
Esta guía reemplaza a los pasos de correo/Google de `CONFIGURAR_CHAT.md` (que sirven solo para crear el proyecto de Supabase y el esquema).

## Cómo funciona

* Cada número es una cuenta de Supabase con un «correo interno» que **nunca recibe mensajes**: `<número con código de país>@tel.mr23.chat`
  (por ejemplo `51987654321@tel.mr23.chat`). No se envía ningún correo.
* Se entra con **número + clave personal**. La clave la define Cris al crear la cuenta.
* Un disparador en la base de datos (`restrict_signups`) **rechaza cualquier registro** cuyo número no esté en la tabla `allowed_phones`.
  Además, el registro público está apagado en Supabase (*Allow new users to sign up*).
* María Rosa puede entrar con un **enlace directo** que Cris le manda por WhatsApp:
  `https://TU-USUARIO.github.io/maria-rosa-23/?tel=51XXXXXXXXX&clave=LA_CLAVE`
  La página inicia la sesión sola y borra la clave de la barra de direcciones. El panel de Cris arma este enlace en ⚙ Ajustes → *Enlace de acceso directo*.
* El panel `#/admin` también usa número + clave.

## Puesta en marcha (una sola vez)

1. Supabase → SQL Editor: ejecuta `supabase/schema.sql` y luego `supabase/migracion-telefono.sql`.
2. Autoriza los dos números (con código de país, solo dígitos). **No guardes estos números en el repositorio**: ejecútalo solo en el SQL Editor.

   ```sql
   insert into public.allowed_phones (phone, display_name, is_maria_rosa) values
     ('51XXXXXXXXX', 'Cris', false),
     ('51YYYYYYYYY', 'María Rosa', true);
   ```

3. Authentication → Users → *Add user → Create new user*, para cada número:
   correo `51XXXXXXXXX@tel.mr23.chat`, una clave de **10 caracteres o más** (Supabase exige mínimo 6), y **Auto Confirm User** marcado.
4. Convierte tu número en administrador:

   ```sql
   select public.bootstrap_admin_phone('51XXXXXXXXX');
   ```

5. Authentication → Sign In / Providers → apaga **Allow new users to sign up** y guarda.
6. Ejecuta `supabase/tests.sql`: debe mostrar **OK ✅** en las 16 líneas.

## Mantenimiento

* **Cambiar una clave:** Authentication → Users → el usuario → *Send password recovery* no sirve (no hay correo); usa *Reset password* / edita el usuario y escribe una clave nueva. Después genera un enlace nuevo en el panel.
* **Agregar otro número** (solo si lo decides): inserta la fila en `allowed_phones` y crea su cuenta como en el paso 3.
* **Seguridad extra:** en el panel, ⚙ Ajustes → verificación en dos pasos.
* El enlace con `clave=` equivale a una contraseña: envíalo solo a su dueña, por un chat privado.
