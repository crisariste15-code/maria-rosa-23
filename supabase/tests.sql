-- =====================================================================
--  Pruebas de seguridad (RLS) del chat.  Supabase → SQL Editor → Run.
--  Ejecútalas DESPUÉS de schema.sql y migracion-telefono.sql. Se pueden repetir cuando quieras.
--
--  Cómo leer el resultado:
--    El script crea usuarios de prueba, los pone a hacer cosas prohibidas y
--    comprueba que la base de datos las rechace. AL FINAL lanza a propósito un
--    "error" cuyo texto es el INFORME, y eso deshace TODO (usuarios y mensajes de
--    prueba incluidos). Es decir: ver un error rojo con la lista de pruebas es lo
--    NORMAL. Busca que todas las líneas digan  OK ✅  y ninguna  FALLO ❌.
--  Si ves otro tipo de error (por ejemplo, de columnas de auth.users), pégalo en el chat.
-- =====================================================================
do $$
declare
  cris  constant uuid := '00000000-0000-0000-0000-0000000000a1';
  ana   constant uuid := '00000000-0000-0000-0000-0000000000b1';
  luis  constant uuid := '00000000-0000-0000-0000-0000000000c1';
  rep   text := '';
  n     int;
  ok    boolean;
  blocked boolean;
  ana_conv  uuid;
  luis_conv uuid;
  i     int;
begin
  -- Todo esto se deshace al final. Se retira temporalmente al administrador real
  -- para poder crear el de prueba (el índice solo admite uno).
  update public.profiles set role = 'visitor' where role = 'admin';

  -- Números de prueba autorizados (requiere haber ejecutado migracion-telefono.sql)
  insert into public.allowed_phones (phone, display_name) values
    ('51000000001', 'Cris'), ('51000000002', 'Ana'), ('51000000003', 'Luis');

  -- Usuarios simulados: Cris (admin), Ana y Luis (visitantes)
  insert into auth.users (id, email, aud, role, instance_id) values
    (cris, '51000000001@tel.mr23.chat', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (ana,  '51000000002@tel.mr23.chat', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
    (luis, '51000000003@tel.mr23.chat', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  update public.profiles set role = 'admin', display_name = 'Cris', privacy_accepted_at = now() where id = cris;
  update public.profiles set display_name = 'Ana',  privacy_accepted_at = now() where id = ana;
  update public.profiles set display_name = 'Luis', privacy_accepted_at = now() where id = luis;

  -- Ana y Luis abren su conversación y escriben
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated', 'email', 'ana-test@example.com')::text, true);
  set local role authenticated;
  perform public.start_conversation();
  insert into public.messages (conversation_id, sender_id, content)
    select id, auth.uid(), 'Hola Cris, soy Ana' from public.conversations where visitor_id = auth.uid();
  reset role;

  perform set_config('request.jwt.claims', json_build_object('sub', luis, 'role', 'authenticated', 'email', 'luis-test@example.com')::text, true);
  set local role authenticated;
  perform public.start_conversation();
  insert into public.messages (conversation_id, sender_id, content)
    select id, auth.uid(), 'Hola Cris, soy Luis' from public.conversations where visitor_id = auth.uid();
  reset role;

  select id into ana_conv  from public.conversations where visitor_id = ana;
  select id into luis_conv from public.conversations where visitor_id = luis;

  -- 1-3. Ana solo ve lo suyo
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated', 'email', 'ana-test@example.com')::text, true);
  set local role authenticated;
  select count(*) into n from public.conversations;
  rep := rep || ' 1. Ana solo ve SU conversación: ' || case when n = 1 then 'OK ✅' else 'FALLO ❌ (ve ' || n || ')' end || E'\n';
  select count(*) into n from public.messages where content like '%Ana%';
  declare total int; begin
    select count(*) into total from public.messages;
    rep := rep || ' 2. Ana solo ve SUS mensajes (no los de Luis): ' || case when total = 1 and n = 1 then 'OK ✅' else 'FALLO ❌ (ve ' || total || ')' end || E'\n';
  end;
  select count(*) into n from public.profiles;
  rep := rep || ' 3. Ana no ve perfiles ajenos: ' || case when n = 1 then 'OK ✅' else 'FALLO ❌ (ve ' || n || ')' end || E'\n';

  -- 4. Ana no puede escribir en la conversación de Luis
  blocked := false;
  begin
    insert into public.messages (conversation_id, sender_id, content) values (luis_conv, auth.uid(), 'intruso');
  exception when others then blocked := true;
  end;
  rep := rep || ' 4. Ana NO puede escribir en la conversación de Luis: ' || case when blocked then 'OK ✅' else 'FALLO ❌' end || E'\n';

  -- 5. Ana no puede suplantar a Cris
  blocked := false;
  begin
    insert into public.messages (conversation_id, sender_id, content) values (ana_conv, cris, 'soy Cris');
  exception when others then blocked := true;
  end;
  rep := rep || ' 5. Ana NO puede suplantar a Cris: ' || case when blocked then 'OK ✅' else 'FALLO ❌' end || E'\n';

  -- 6. Ana no puede volverse administradora
  blocked := false;
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
  exception when others then blocked := true;
  end;
  rep := rep || ' 6. Ana NO puede asignarse el rol admin: ' || case when blocked then 'OK ✅' else 'FALLO ❌' end || E'\n';

  -- 7. Ana no puede usar funciones de administrador
  blocked := false;
  select count(*) into n from public.admin_inbox();
  begin
    perform public.admin_set_blocked(luis, true);
  exception when others then blocked := true;
  end;
  rep := rep || ' 7. Ana NO ve la bandeja de Cris ni puede bloquear a otros: ' || case when blocked and n = 0 then 'OK ✅' else 'FALLO ❌' end || E'\n';
  reset role;

  -- 8-9. Cris ve todo y puede responder
  perform set_config('request.jwt.claims', json_build_object('sub', cris, 'role', 'authenticated', 'email', 'cris-test@example.com')::text, true);
  set local role authenticated;
  select count(*) into n from public.admin_inbox();
  rep := rep || ' 8. Cris ve las 2 conversaciones: ' || case when n = 2 then 'OK ✅' else 'FALLO ❌ (ve ' || n || ')' end || E'\n';
  select count(*) into n from public.messages;
  rep := rep || ' 9. Cris ve los 2 mensajes: ' || case when n = 2 then 'OK ✅' else 'FALLO ❌ (ve ' || n || ')' end || E'\n';
  insert into public.messages (conversation_id, sender_id, content) values (ana_conv, auth.uid(), 'Hola Ana, soy Cris');
  reset role;

  -- 10. Ana recibe la respuesta
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated', 'email', 'ana-test@example.com')::text, true);
  set local role authenticated;
  select count(*) into n from public.messages where content like '%soy Cris%';
  rep := rep || '10. Ana recibe la respuesta de Cris: ' || case when n = 1 then 'OK ✅' else 'FALLO ❌' end || E'\n';
  reset role;

  -- 11. Luis NO ve la respuesta dirigida a Ana
  perform set_config('request.jwt.claims', json_build_object('sub', luis, 'role', 'authenticated', 'email', 'luis-test@example.com')::text, true);
  set local role authenticated;
  select count(*) into n from public.messages where content like '%soy Cris%';
  rep := rep || '11. Luis NO ve la respuesta dirigida a Ana: ' || case when n = 0 then 'OK ✅' else 'FALLO ❌' end || E'\n';
  reset role;

  -- 12. Un usuario bloqueado no puede escribir
  perform set_config('request.jwt.claims', json_build_object('sub', cris, 'role', 'authenticated', 'email', 'cris-test@example.com')::text, true);
  set local role authenticated;
  perform public.admin_set_blocked(luis, true);
  reset role;
  perform set_config('request.jwt.claims', json_build_object('sub', luis, 'role', 'authenticated', 'email', 'luis-test@example.com')::text, true);
  set local role authenticated;
  blocked := false;
  begin
    insert into public.messages (conversation_id, sender_id, content) values (luis_conv, auth.uid(), 'sigo escribiendo');
  exception when others then blocked := true;
  end;
  rep := rep || '12. Un usuario bloqueado NO puede escribir: ' || case when blocked then 'OK ✅' else 'FALLO ❌' end || E'\n';
  reset role;

  -- 13. Límite anti-spam: máx. 8 mensajes por minuto
  perform set_config('request.jwt.claims', json_build_object('sub', ana, 'role', 'authenticated', 'email', 'ana-test@example.com')::text, true);
  set local role authenticated;
  blocked := false;
  begin
    for i in 1..12 loop
      insert into public.messages (conversation_id, sender_id, content) values (ana_conv, auth.uid(), 'spam ' || i);
    end loop;
  exception when others then blocked := true;
  end;
  rep := rep || '13. El anti-spam corta tras 8 mensajes/minuto: ' || case when blocked then 'OK ✅' else 'FALLO ❌' end || E'\n';
  reset role;

  -- 14. Sin sesión (anon) no se puede leer nada
  set local role anon;
  blocked := false;
  begin
    perform count(*) from public.messages;
  exception when others then blocked := true;
  end;
  rep := rep || '14. Sin sesión (anon) NO puede leer mensajes: ' || case when blocked then 'OK ✅' else 'FALLO ❌' end || E'\n';
  reset role;

  -- 15. Registro cerrado: un correo o número no autorizado NO puede crear cuenta
  blocked := false;
  begin
    insert into auth.users (id, email, aud, role, instance_id)
    values ('00000000-0000-0000-0000-0000000000d1', 'intruso@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  exception when others then blocked := true;
  end;
  rep := rep || '15. Un correo no autorizado NO puede registrarse: ' || case when blocked then 'OK ✅' else 'FALLO ❌' end || E'\n';
  blocked := false;
  begin
    insert into auth.users (id, email, aud, role, instance_id)
    values ('00000000-0000-0000-0000-0000000000d2', '51999999999@tel.mr23.chat', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');
  exception when others then blocked := true;
  end;
  rep := rep || '16. Un número no autorizado NO puede registrarse: ' || case when blocked then 'OK ✅' else 'FALLO ❌' end || E'\n';

  -- Lanzar el informe como error deshace TODO lo creado arriba.
  raise exception E'\n===== INFORME DE SEGURIDAD (todo se deshizo, no quedó nada) =====\n%', rep;
end $$;
