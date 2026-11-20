-- =====================================================================
--  Pruebas de seguridad (RLS) del chat. Ejecútalas en Supabase → SQL Editor
--  DESPUÉS de correr schema.sql y ANTES de compartir el enlace.
--
--  Crean usuarios de prueba temporales y todo se deshace al final (ROLLBACK):
--  no deja datos en tu proyecto. Cada prueba imprime  OK  o  FALLO.
--  Si ves algún FALLO, NO publiques el chat y revisa schema.sql.
-- =====================================================================
begin;

create temp table _res (n int, prueba text, ok boolean, detalle text) on commit drop;
grant all on _res to public;

-- Usuarios simulados: ADMIN (Cris), ANA, LUIS
insert into auth.users (id, email, aud, role, instance_id)
values
  ('00000000-0000-0000-0000-0000000000a1', 'cris-test@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000b1', 'ana-test@example.com',  'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000'),
  ('00000000-0000-0000-0000-0000000000c1', 'luis-test@example.com', 'authenticated', 'authenticated', '00000000-0000-0000-0000-000000000000');

-- Si ya existe un administrador real, esta prueba lo respeta: solo se usa Cris-test si no hay otro.
do $$
begin
  if exists (select 1 from public.profiles where role = 'admin') then
    raise exception 'Ya existe un administrador real; esta prueba usa su propio admin. Ejecuta las pruebas antes de configurar al admin, o adapta los UUID.';
  end if;
end $$;

update public.profiles set role = 'admin', display_name = 'Cris', privacy_accepted_at = now()
 where id = '00000000-0000-0000-0000-0000000000a1';
update public.profiles set display_name = 'Ana',  privacy_accepted_at = now() where id = '00000000-0000-0000-0000-0000000000b1';
update public.profiles set display_name = 'Luis', privacy_accepted_at = now() where id = '00000000-0000-0000-0000-0000000000c1';

-- Ayudante: ejecuta código como un usuario concreto.
create or replace function pg_temp.as_user(uid uuid) returns void language plpgsql as $$
begin
  perform set_config('request.jwt.claims',
    json_build_object('sub', uid, 'role', 'authenticated', 'email', 'x@example.com')::text, true);
  set local role authenticated;
end $$;

create or replace function pg_temp.reset_user() returns void language plpgsql as $$
begin
  reset role;
end $$;

-- Ana y Luis abren su conversación y escriben
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
select public.start_conversation();
insert into public.messages (conversation_id, sender_id, content)
  select id, auth.uid(), 'Hola Cris, soy Ana' from public.conversations where visitor_id = auth.uid();
select pg_temp.reset_user();

select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
select public.start_conversation();
insert into public.messages (conversation_id, sender_id, content)
  select id, auth.uid(), 'Hola Cris, soy Luis' from public.conversations where visitor_id = auth.uid();
select pg_temp.reset_user();

-- 1. Ana solo ve SU conversación y SUS mensajes
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into _res select 1, 'Ana solo ve su conversación', count(*) = 1, count(*)::text from public.conversations;
insert into _res select 2, 'Ana solo ve sus mensajes (no los de Luis)', count(*) = 1 and bool_and(content like '%Ana%'), count(*)::text from public.messages;
insert into _res select 3, 'Ana no ve perfiles ajenos', count(*) = 1, count(*)::text from public.profiles;
select pg_temp.reset_user();

-- 4. Ana no puede escribir en la conversación de Luis
do $$
declare luis_conv uuid; blocked boolean := false;
begin
  select id into luis_conv from public.conversations where visitor_id = '00000000-0000-0000-0000-0000000000c1';
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  begin
    insert into public.messages (conversation_id, sender_id, content) values (luis_conv, auth.uid(), 'intruso');
  exception when others then blocked := true;
  end;
  perform pg_temp.reset_user();
  insert into _res values (4, 'Ana NO puede escribir en la conversación de Luis', blocked, null);
end $$;

-- 5. Ana no puede suplantar a Cris (sender_id ajeno)
do $$
declare ana_conv uuid; blocked boolean := false;
begin
  select id into ana_conv from public.conversations where visitor_id = '00000000-0000-0000-0000-0000000000b1';
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  begin
    insert into public.messages (conversation_id, sender_id, content) values (ana_conv, '00000000-0000-0000-0000-0000000000a1', 'soy Cris');
  exception when others then blocked := true;
  end;
  perform pg_temp.reset_user();
  insert into _res values (5, 'Ana NO puede suplantar a Cris', blocked, null);
end $$;

-- 6. Ana no puede volverse administradora
do $$
declare blocked boolean := false;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  begin
    update public.profiles set role = 'admin' where id = auth.uid();
  exception when others then blocked := true;
  end;
  perform pg_temp.reset_user();
  insert into _res values (6, 'Ana NO puede asignarse el rol admin', blocked, null);
end $$;

-- 7. Ana no puede usar funciones de administrador
do $$
declare blocked boolean := false; n int;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  select count(*) into n from public.admin_inbox();
  begin
    perform public.admin_set_blocked('00000000-0000-0000-0000-0000000000c1', true);
  exception when others then blocked := true;
  end;
  perform pg_temp.reset_user();
  insert into _res values (7, 'Ana NO ve la bandeja de Cris ni puede bloquear a otros', blocked and n = 0, 'filas bandeja=' || n);
end $$;

-- 8. Cris (admin) ve TODAS las conversaciones y mensajes, y puede responder
select pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
insert into _res select 8, 'Cris ve las 2 conversaciones', count(*) = 2, count(*)::text from public.admin_inbox();
insert into _res select 9, 'Cris ve los 2 mensajes', count(*) = 2, count(*)::text from public.messages;
insert into public.messages (conversation_id, sender_id, content)
  select id, auth.uid(), 'Hola Ana, soy Cris' from public.conversations where visitor_id = '00000000-0000-0000-0000-0000000000b1';
select pg_temp.reset_user();

-- 10. Ana recibe la respuesta; Luis no
select pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
insert into _res select 10, 'Ana recibe la respuesta de Cris', count(*) = 1, count(*)::text from public.messages where content like '%soy Cris%';
select pg_temp.reset_user();
select pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
insert into _res select 11, 'Luis NO ve la respuesta dirigida a Ana', count(*) = 0, count(*)::text from public.messages where content like '%soy Cris%';
select pg_temp.reset_user();

-- 12. Un usuario bloqueado no puede escribir
do $$
declare blocked boolean := false; luis_conv uuid;
begin
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000a1');
  perform public.admin_set_blocked('00000000-0000-0000-0000-0000000000c1', true);
  perform pg_temp.reset_user();
  select id into luis_conv from public.conversations where visitor_id = '00000000-0000-0000-0000-0000000000c1';
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000c1');
  begin
    insert into public.messages (conversation_id, sender_id, content) values (luis_conv, auth.uid(), 'sigo escribiendo');
  exception when others then blocked := true;
  end;
  perform pg_temp.reset_user();
  insert into _res values (12, 'Un usuario bloqueado NO puede escribir', blocked, null);
end $$;

-- 13. Límite anti-spam: máx. 8 mensajes por minuto
do $$
declare blocked boolean := false; ana_conv uuid; i int;
begin
  select id into ana_conv from public.conversations where visitor_id = '00000000-0000-0000-0000-0000000000b1';
  perform pg_temp.as_user('00000000-0000-0000-0000-0000000000b1');
  begin
    for i in 1..12 loop
      insert into public.messages (conversation_id, sender_id, content) values (ana_conv, auth.uid(), 'spam ' || i);
    end loop;
  exception when others then blocked := true;
  end;
  perform pg_temp.reset_user();
  insert into _res values (13, 'El límite anti-spam corta después de 8 mensajes/minuto', blocked, null);
end $$;

-- 14. Nadie sin sesión puede leer nada
set local role anon;
do $$
declare denied boolean := false;
begin
  begin
    perform count(*) from public.messages;
  exception when others then denied := true;
  end;
  insert into _res values (14, 'Sin sesión (anon) NO puede leer mensajes', denied, null);
end $$;
reset role;

select n as "#", prueba as "Prueba", case when ok then 'OK ✅' else 'FALLO ❌' end as "Resultado", detalle
from _res order by n;

rollback;  -- se deshace TODO: usuarios y mensajes de prueba incluidos
