# Notificaciones: qué existe y qué falta

## Ya implementado (funciona con la pestaña abierta)

* Contador de mensajes sin leer en la bandeja y en el título de la pestaña: `(3) Panel privado de Cris 🌹`.
* Aviso del navegador (Notification API) cuando llega un mensaje, si Cris concedió el permiso (⚙ Ajustes → Activar).
* Sonido suave opcional.
* En el chat del visitante: insignia en el botón flotante y aviso del navegador cuando Cris responde.

## NO implementado todavía

* **Correo** y **WhatsApp** cuando la pestaña está cerrada. Requieren un servicio externo autorizado y claves privadas; no se simulan.

## Cómo prepararlo después (arquitectura)

La base de datos ya emite cada mensaje nuevo, así que se puede enganchar sin cambiar la web:

1. **Database Webhook** (Supabase → Database → Webhooks): evento `INSERT` en `public.messages` → llama a una **Edge Function**.
2. La Edge Function (secretos guardados con `supabase secrets set`, nunca en el repositorio):
   * si `sender_id` ≠ admin → avisa a Cris;
   * si `sender_id` = admin → avisa al visitante (solo si dejó correo).
3. Canales posibles:
   * **Correo:** Resend o Brevo (API key como secreto de la función).
   * **WhatsApp:** WhatsApp Business Cloud API de Meta (requiere cuenta de empresa, número verificado y plantillas aprobadas) o un proveedor como Twilio. Respeta las políticas de consentimiento de cada proveedor.
   * **Push con la pestaña cerrada:** Web Push + Service Worker (clave VAPID como secreto).
4. Para no avisar de conversaciones silenciadas, la función consulta `conversations.muted`.
