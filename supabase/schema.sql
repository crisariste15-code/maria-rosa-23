-- =====================================================================
--  María Rosa — 23 primaveras · Esquema de Supabase para el chat privado
--  Pégalo COMPLETO en Supabase → SQL Editor → Run.  Es seguro volver a ejecutarlo.
--
--  Modelo de seguridad:
--   · Los visitantes solo pueden ver SU conversación con Cris.
--   · Solo existe UN administrador (Cris). Su rol se asigna únicamente desde el
--     SQL Editor con  select public.bootstrap_admin('tu-correo');
--     Ningún formulario público puede crear administradores.
--   · El cliente no puede modificar roles, estados ni conversaciones ajenas:
--     todo cambio sensible pasa por funciones que verifican is_admin().
-- =====================================================================

create extension if not exists pgcrypto;

-- ---------------------------------------------------------------------
--  Tablas
-- ---------------------------------------------------------------------
create table if not exists public.profiles (
  id                   uuid primary key references auth.users(id) on delete cascade,
  display_name         text not null default 'Visitante'
                         check (char_length(display_name) between 1 and 40),
  role                 text not null default 'visitor' check (role in ('visitor', 'admin')),
  blocked              boolean not null default false,
  privacy_accepted_at  timestamptz,
  created_at           timestamptz not null default now()
);

-- A lo sumo UNA fila con role = 'admin' (Cris).
create unique index if not exists profiles_single_admin
  on public.profiles ((true)) where role = 'admin';

create table if not exists public.conversations (
  id          uuid primary key default gen_random_uuid(),
  visitor_id  uuid not null unique references public.profiles(id) on delete cascade,
  admin_id    uuid not null references public.profiles(id),
  status      text not null default 'pending' check (status in ('pending', 'active', 'closed')),
  muted       boolean not null default false,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists conversations_updated_idx on public.conversations (updated_at desc);

create table if not exists public.messages (
  id               uuid primary key default gen_random_uuid(),
  conversation_id  uuid not null references public.conversations(id) on delete cascade,
  sender_id        uuid not null references public.profiles(id),
  content          text not null check (char_length(content) between 1 and 2000),
  created_at       timestamptz not null default now(),
  read_at          timestamptz
);
create index if not exists messages_conv_idx   on public.messages (conversation_id, created_at);
create index if not exists messages_unread_idx on public.messages (conversation_id) where read_at is null;
create index if not exists messages_sender_idx on public.messages (sender_id, created_at desc);

create table if not exists public.media_assets (
  id          uuid primary key default gen_random_uuid(),
  file_path   text not null,
  type        text not null default 'image',
  created_at  timestamptz not null default now()
);

-- Correos de personas especiales (p. ej. María Rosa) para mostrarles su bienvenida.
-- Nadie puede leer esta tabla desde el navegador; solo la función whoami() la consulta.
create table if not exists public.special_contacts (
  email         text primary key,
  display_name  text not null
);

-- ---------------------------------------------------------------------
--  Funciones auxiliares
-- ---------------------------------------------------------------------

-- ¿El usuario actual es Cris? Si tiene verificación en dos pasos activada,
-- además exige que la sesión esté verificada (aal2).
create or replace function public.is_admin()
returns boolean
language sql stable security definer
set search_path = public, auth
as $$
  select exists (
    select 1
    from public.profiles p
    where p.id = auth.uid()
      and p.role = 'admin'
      and (
        coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
        or not exists (
          select 1 from auth.mfa_factors f
          where f.user_id = p.id and f.status = 'verified'
        )
      )
  );
$$;

-- Al registrarse un usuario se crea su perfil como VISITANTE. Nunca como admin.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  nm text;
begin
  nm := left(btrim(coalesce(
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          split_part(coalesce(new.email, ''), '@', 1), '')), 40);
  insert into public.profiles (id, display_name)
  values (new.id, case when nm = '' then 'Visitante' else nm end)
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Antes de insertar un mensaje: valida remitente y limita el spam.
create or replace function public.messages_guard()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  recent int;
  today  int;
begin
  new.content := btrim(new.content);
  if new.content = '' then
    raise exception 'El mensaje está vacío.';
  end if;
  if new.sender_id is distinct from auth.uid() then
    raise exception 'Remitente no válido.';
  end if;
  if not public.is_admin() then
    select count(*) into recent from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '1 minute';
    if recent >= 8 then
      raise exception 'Estás escribiendo muy rápido. Espera un momento. 🌹';
    end if;
    select count(*) into today from public.messages
      where sender_id = new.sender_id and created_at > now() - interval '1 day';
    if today >= 300 then
      raise exception 'Alcanzaste el límite diario de mensajes.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists messages_guard_trg on public.messages;
create trigger messages_guard_trg
  before insert on public.messages
  for each row execute function public.messages_guard();

-- Después de insertar: actualiza la conversación (y la activa si Cris responde).
create or replace function public.messages_after_insert()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  update public.conversations
     set updated_at = now(),
         status = case when new.sender_id = admin_id and status = 'pending' then 'active' else status end
   where id = new.conversation_id;
  return new;
end;
$$;

drop trigger if exists messages_after_insert_trg on public.messages;
create trigger messages_after_insert_trg
  after insert on public.messages
  for each row execute function public.messages_after_insert();

-- ---------------------------------------------------------------------
--  Permisos de tabla (mínimo necesario) + Row Level Security
-- ---------------------------------------------------------------------
alter table public.profiles         enable row level security;
alter table public.conversations    enable row level security;
alter table public.messages         enable row level security;
alter table public.media_assets     enable row level security;
alter table public.special_contacts enable row level security;

revoke all on public.profiles, public.conversations, public.messages,
              public.media_assets, public.special_contacts from anon, authenticated;

grant select on public.profiles      to authenticated;
grant select on public.conversations to authenticated;
grant select on public.messages      to authenticated;
grant insert (conversation_id, sender_id, content) on public.messages to authenticated;
grant select on public.media_assets  to anon, authenticated;
grant insert, update, delete on public.media_assets to authenticated;   -- limitado por RLS a is_admin()

-- profiles
drop policy if exists profiles_select on public.profiles;
create policy profiles_select on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

-- conversations (solo lectura directa; los cambios pasan por funciones)
drop policy if exists conversations_select on public.conversations;
create policy conversations_select on public.conversations
  for select to authenticated
  using (visitor_id = auth.uid() or public.is_admin());

-- messages
drop policy if exists messages_select on public.messages;
create policy messages_select on public.messages
  for select to authenticated
  using (
    public.is_admin()
    or exists (select 1 from public.conversations c
               where c.id = messages.conversation_id and c.visitor_id = auth.uid())
  );

drop policy if exists messages_insert on public.messages;
create policy messages_insert on public.messages
  for insert to authenticated
  with check (
    sender_id = auth.uid()
    and (
      public.is_admin()
      or exists (
        select 1
        from public.conversations c
        join public.profiles p on p.id = c.visitor_id
        where c.id = messages.conversation_id
          and c.visitor_id = auth.uid()
          and p.blocked = false
          and p.privacy_accepted_at is not null
          and c.status <> 'closed'
      )
    )
  );

-- media_assets: lectura pública, escritura solo Cris
drop policy if exists media_select on public.media_assets;
create policy media_select on public.media_assets for select to anon, authenticated using (true);
drop policy if exists media_write on public.media_assets;
create policy media_write on public.media_assets for all to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- special_contacts: sin políticas → inaccesible desde el navegador.

-- ---------------------------------------------------------------------
--  Funciones que usa la aplicación (RPC)
-- ---------------------------------------------------------------------

-- Quién soy y qué puedo hacer.
create or replace function public.whoami()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'role', p.role,
    'display_name', p.display_name,
    'blocked', p.blocked,
    'privacy_accepted', p.privacy_accepted_at is not null,
    'is_admin', public.is_admin(),
    'is_maria_rosa', exists (
      select 1 from public.special_contacts s
      where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', ''))
    )
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

-- El visitante acepta el aviso de privacidad y elige su nombre.
create or replace function public.accept_privacy(p_name text)
returns void
language plpgsql security definer
set search_path = public
as $$
declare
  nm text := left(btrim(coalesce(p_name, '')), 40);
begin
  if auth.uid() is null then raise exception 'No autenticado.'; end if;
  if nm = '' then raise exception 'Escribe tu nombre o seudónimo.'; end if;
  update public.profiles
     set display_name = nm,
         privacy_accepted_at = coalesce(privacy_accepted_at, now())
   where id = auth.uid();
end;
$$;

-- Abre (o recupera) la conversación privada del visitante con Cris.
create or replace function public.start_conversation()
returns public.conversations
language plpgsql security definer
set search_path = public
as $$
declare
  uid  uuid := auth.uid();
  adm  uuid;
  prof public.profiles;
  conv public.conversations;
begin
  if uid is null then raise exception 'No autenticado.'; end if;
  select * into prof from public.profiles where id = uid;
  if not found then raise exception 'Perfil no encontrado.'; end if;
  if prof.blocked then raise exception 'Tu acceso al chat fue desactivado.'; end if;
  if prof.privacy_accepted_at is null then raise exception 'Primero acepta el aviso de privacidad.'; end if;
  if prof.role = 'admin' then raise exception 'El administrador usa el panel privado.'; end if;
  select * into conv from public.conversations where visitor_id = uid;
  if found then return conv; end if;
  select id into adm from public.profiles where role = 'admin' limit 1;
  if adm is null then raise exception 'El chat aún no está listo (falta configurar al administrador).'; end if;
  insert into public.conversations (visitor_id, admin_id) values (uid, adm) returning * into conv;
  return conv;
end;
$$;

-- Marca como leídos los mensajes de la otra persona.
create or replace function public.mark_read(p_conversation uuid)
returns void
language plpgsql security definer
set search_path = public
as $$
begin
  if public.is_admin() then
    update public.messages set read_at = now()
     where conversation_id = p_conversation and read_at is null and sender_id <> auth.uid();
  else
    update public.messages m set read_at = now()
      from public.conversations c
     where m.conversation_id = c.id and c.id = p_conversation and c.visitor_id = auth.uid()
       and m.read_at is null and m.sender_id <> auth.uid();
  end if;
end;
$$;

-- Bandeja de entrada de Cris (vacía para cualquier otra persona).
create or replace function public.admin_inbox()
returns table (
  conv_id uuid, visitor uuid, name text, status text, muted boolean, blocked boolean,
  created timestamptz, updated timestamptz,
  last_content text, last_sender uuid, last_at timestamptz, unread bigint
)
language sql stable security definer
set search_path = public
as $$
  select c.id, c.visitor_id, p.display_name, c.status, c.muted, p.blocked,
         c.created_at, c.updated_at,
         lm.content, lm.sender_id, lm.created_at,
         (select count(*) from public.messages m
           where m.conversation_id = c.id and m.read_at is null and m.sender_id = c.visitor_id)
  from public.conversations c
  join public.profiles p on p.id = c.visitor_id
  left join lateral (
    select m.content, m.sender_id, m.created_at
    from public.messages m where m.conversation_id = c.id
    order by m.created_at desc limit 1
  ) lm on true
  where public.is_admin()
  order by coalesce(lm.created_at, c.updated_at) desc;
$$;

create or replace function public.admin_set_status(p_conv uuid, p_status text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if p_status not in ('pending', 'active', 'closed') then raise exception 'Estado no válido.'; end if;
  update public.conversations set status = p_status, updated_at = now() where id = p_conv;
end; $$;

create or replace function public.admin_set_muted(p_conv uuid, p_muted boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  update public.conversations set muted = p_muted where id = p_conv;
end; $$;

create or replace function public.admin_set_blocked(p_user uuid, p_blocked boolean)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  if p_user = auth.uid() then raise exception 'No puedes bloquearte a ti mismo.'; end if;
  update public.profiles set blocked = p_blocked where id = p_user and role <> 'admin';
end; $$;

create or replace function public.admin_delete_conversation(p_conv uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  if not public.is_admin() then raise exception 'No autorizado.' using errcode = '42501'; end if;
  delete from public.conversations where id = p_conv;
end; $$;

-- Inicialización segura del administrador (solo desde el SQL Editor; NO desde la web).
create or replace function public.bootstrap_admin(p_email text)
returns text
language plpgsql security definer
set search_path = public, auth
as $$
declare
  uid uuid;
begin
  select id into uid from auth.users where lower(email) = lower(p_email);
  if uid is null then
    raise exception 'Primero crea ese usuario en Authentication → Users → Add user.';
  end if;
  insert into public.profiles (id, display_name, role, privacy_accepted_at)
  values (uid, 'Cris', 'admin', now())
  on conflict (id) do update set role = 'admin', display_name = 'Cris';
  return 'Administrador configurado: ' || p_email;
end;
$$;

-- Permisos de ejecución: nadie por defecto, y solo lo necesario a usuarios con sesión.
revoke all on function public.is_admin(), public.whoami(), public.accept_privacy(text),
  public.start_conversation(), public.mark_read(uuid), public.admin_inbox(),
  public.admin_set_status(uuid, text), public.admin_set_muted(uuid, boolean),
  public.admin_set_blocked(uuid, boolean), public.admin_delete_conversation(uuid),
  public.bootstrap_admin(text), public.handle_new_user(), public.messages_guard(),
  public.messages_after_insert()
  from public, anon, authenticated;

grant execute on function public.is_admin(), public.whoami(), public.accept_privacy(text),
  public.start_conversation(), public.mark_read(uuid), public.admin_inbox(),
  public.admin_set_status(uuid, text), public.admin_set_muted(uuid, boolean),
  public.admin_set_blocked(uuid, boolean), public.admin_delete_conversation(uuid)
  to authenticated;

-- ---------------------------------------------------------------------
--  Tiempo real (los mensajes llegan al instante respetando las políticas RLS)
-- ---------------------------------------------------------------------
do $$
begin
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'messages') then
    alter publication supabase_realtime add table public.messages;
  end if;
  if not exists (select 1 from pg_publication_tables
                 where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'conversations') then
    alter publication supabase_realtime add table public.conversations;
  end if;
end $$;

-- Indicador "está escribiendo…" mediante canales privados de Realtime.
-- Solo pueden entrar el dueño de la conversación y Cris.
do $$
begin
  drop policy if exists mr23_typing_select on realtime.messages;
  create policy mr23_typing_select on realtime.messages
    for select to authenticated
    using (
      realtime.messages.extension = 'broadcast'
      and (
        public.is_admin()
        or exists (select 1 from public.conversations c
                   where 'typing:' || c.id::text = (select realtime.topic())
                     and c.visitor_id = auth.uid())
      )
    );
  drop policy if exists mr23_typing_insert on realtime.messages;
  create policy mr23_typing_insert on realtime.messages
    for insert to authenticated
    with check (
      realtime.messages.extension = 'broadcast'
      and (
        public.is_admin()
        or exists (select 1 from public.conversations c
                   where 'typing:' || c.id::text = (select realtime.topic())
                     and c.visitor_id = auth.uid())
      )
    );
exception when others then
  raise notice 'No se pudieron crear las políticas de Realtime (%). El chat funciona igual, solo sin el indicador "escribiendo…".', sqlerrm;
end $$;

-- =====================================================================
--  LISTO. Siguientes pasos (ver docs/CONFIGURAR_CHAT.md):
--   1) Authentication → Users → Add user: tu correo + contraseña (Auto Confirm).
--   2) Ejecuta:   select public.bootstrap_admin('tu-correo@ejemplo.com');
--   3) (Opcional) correo de María Rosa para su bienvenida especial:
--        insert into public.special_contacts values ('correo-de-maria-rosa@ejemplo.com', 'María Rosa');
-- =====================================================================
