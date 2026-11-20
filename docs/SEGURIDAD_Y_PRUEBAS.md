# Seguridad y pruebas

## Qué protege qué

| Riesgo | Medida |
|---|---|
| Un visitante lee mensajes de otro | RLS en `messages`/`conversations`: solo `visitor_id = auth.uid()` o administrador |
| Un visitante escribe en la conversación de otro, o suplanta a Cris | Política de `INSERT` + trigger `messages_guard`: `sender_id` debe ser `auth.uid()` y la conversación debe ser suya |
| Alguien se vuelve administrador | El rol solo se asigna con `bootstrap_admin()` desde el SQL Editor. Hay un índice único: **solo puede existir 1 admin**. Los visitantes no pueden hacer `UPDATE` de `role` (permiso por columna revocado) |
| Fuerza bruta/spam | Trigger: máx. 8 mensajes/min y 300/día por visitante; Supabase limita además los intentos de login |
| Login del administrador robado | Contraseña + **verificación en dos pasos (TOTP)** opcional; con 2FA activo, `is_admin()` exige sesión `aal2` |
| XSS | Los mensajes se muestran como **texto** (React escapa todo); no se usa `dangerouslySetInnerHTML` |
| Datos ajenos por la API | Permisos mínimos por columna/tabla; el resto va por funciones `security definer` que revisan `is_admin()` |
| Secretos en el repositorio | Solo se usa la clave `anon` (pública por diseño). `.env` está en `.gitignore`. Nunca se usa `service_role` |
| Canal «escribiendo…» | Canales *privados* de Realtime con política: solo el dueño de la conversación y Cris |
| Bloqueo | `profiles.blocked` impide crear conversación y enviar mensajes |

## Limitaciones honestas

* **No hay cifrado de extremo a extremo.** El tráfico va por HTTPS/TLS y los datos están protegidos por RLS, pero el administrador y el proveedor pueden acceder a los mensajes.
* GitHub Pages no permite cabeceras HTTP propias, así que no se puede añadir una *Content-Security-Policy* estricta. La mitigación es no insertar HTML de usuarios jamás.
* El repositorio debe ser **público** para usar GitHub Pages gratis (salvo que tengas GitHub Pro o plan educativo). Las fotos de la galería quedan, por tanto, accesibles a quien conozca su ruta. La página tiene `noindex`, pero no es secreta: no incluyas imágenes que no quieras que alguien pueda llegar a ver.

## Prueba automática de las políticas

1. Supabase → **SQL Editor** → pega `supabase/tests.sql` → **Run**.
2. Debes ver **OK ✅** en las 14 filas. Todo se deshace al final (`ROLLBACK`).
3. Antes de ejecutarla, no debe existir aún un administrador real (la prueba crea el suyo). Si ya configuraste el tuyo, ejecútala en un proyecto de pruebas o adapta los UUID.

## Lista de pruebas manuales (funcionales)

**Regalo (público, sin iniciar sesión)**

- [ ] La pantalla inicial muestra «Para María Rosa» con los botones *Comenzar con música / en silencio*.
- [ ] La rosa se forma con partículas, aparecen los 23 pétalos con contador, se abre y surge el nombre.
- [ ] El botón «Descubre este pequeño mundo…» atraviesa los pétalos y entra al jardín.
- [ ] Las 5 frases aparecen a medida que se baja.
- [ ] La galería muestra las fotos; tocar una la amplía con fondo desenfocado; ← → y deslizar cambian de foto; Esc cierra.
- [ ] El sobre se abre, la carta se escribe sola con el texto exacto, se puede «Mostrar completa», cerrar y volver a abrir; caen pétalos al terminar.
- [ ] Las 23 flores se abren una a una con su deseo; al abrir las 23 aparece «23 años, 23 deseos…».
- [ ] Bajo las estrellas, tocar la estrella muestra el mensaje, emerge el ramo y aparece el mensaje final con la firma.
- [ ] El botón de música activa/silencia; **nunca** suena solo.
- [ ] En celular (Android/iPhone) todo se ve y fluye; con «reducir movimiento» activado la experiencia sigue completa pero más tranquila.

**Chat (requiere Supabase)**

- [ ] Sin sesión, el botón «💌 Tu servidor, Cris» abre el panel de acceso (no obliga a iniciar sesión para ver el regalo).
- [ ] Visitante A: pide código por correo (o Google), entra, acepta privacidad, escribe. Aparece en `#/admin` al instante.
- [ ] Visitante B (otro navegador/incógnito) escribe. A no ve nada de B y viceversa.
- [ ] Cris responde desde `#/admin`; la respuesta aparece en el chat de A (no en el de B), con «✓✓ Leído» al abrirlo.
- [ ] Cerrar sesión y volver a entrar recupera la conversación.
- [ ] Cris: buscar, aceptar solicitud, silenciar, cerrar/reabrir, bloquear (el bloqueado no puede escribir), eliminar.
- [ ] 2FA: activar en Ajustes, cerrar sesión, entrar de nuevo: pide el código.
- [ ] Recuperar contraseña desde la pantalla de acceso del panel.
- [ ] Sin entrar como Cris, `#/admin` no muestra datos (solo el formulario de acceso o «sin acceso»).
- [ ] La cuenta de María Rosa (correo registrado en `special_contacts`) ve su bienvenida especial.
- [ ] Enviar 9 mensajes en un minuto: el 9.º se rechaza con aviso amable.

## Pruebas técnicas del proyecto

```powershell
npm run typecheck   # tipos de TypeScript
npm run build       # compilación de producción (dist/)
npm run preview     # sirve dist/ para revisarlo tal como se publicará
```

Atajo de desarrollo: abre `http://localhost:5173/?mundo` para saltar la introducción y entrar directo al jardín.
