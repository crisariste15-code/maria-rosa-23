-- =====================================================================
--  Migración: el chat pasa a ser SOLO entre dos números de teléfono
--  (Cris y María Rosa). Sin correos, sin Google, sin registros abiertos.
--
--  Ejecútala en Supabase → SQL Editor, DESPUÉS de schema.sql. Es seguro repetirla.
--
--  Cómo funciona:
--   · Cada número es una cuenta de Supabase cuyo "correo interno" es
--       <número>@tel.mr23.chat      (nunca recibe correos; no se envía ninguno).
--   · Un disparador en auth.users RECHAZA cualquier registro cuyo número no esté en
--     allowed_phones. Así nadie más puede crear cuenta, ni por Google ni por API.
--   · Las cuentas las crea Cris en Authentication → Users → Add user (con su clave),
--     y le manda a María Rosa su enlace de acceso por WhatsApp.
-- =====================================================================

alter table public.profiles add column if not exists phone text;

-- Números autorizados (nadie puede leer ni escribir esta tabla desde el navegador).
create table if not exists public.allowed_phones (
  phone          text primary key check (phone ~ '^[0-9]{8,15}$'),
  display_name   text not null check (char_length(display_name) between 1 and 40),
  is_maria_rosa  boolean not null default false
);
alter table public.allowed_phones enable row level security;
revoke all on public.allowed_phones from anon, authenticated;

-- Solo los números autorizados pueden tener cuenta.
create or replace function public.restrict_signups()
returns trigger
language plpgsql security definer
set search_path = public
as $$
begin
  if not exists (
    select 1 from public.allowed_phones a
    where a.phone || '@tel.mr23.chat' = lower(coalesce(new.email, ''))
  ) then
    raise exception 'Este chat es privado: solo hay dos números autorizados.' using errcode = 'P0001';
  end if;
  return new;
end;
$$;
revoke all on function public.restrict_signups() from public, anon, authenticated;

drop trigger if exists restrict_signups_trg on auth.users;
create trigger restrict_signups_trg
  before insert on auth.users
  for each row execute function public.restrict_signups();

-- El perfil toma el nombre y el teléfono del número autorizado.
create or replace function public.handle_new_user()
returns trigger
language plpgsql security definer
set search_path = public
as $$
declare
  a public.allowed_phones;
  nm text;
begin
  select * into a from public.allowed_phones
   where phone || '@tel.mr23.chat' = lower(coalesce(new.email, ''));
  nm := left(btrim(coalesce(a.display_name,
          new.raw_user_meta_data ->> 'full_name',
          new.raw_user_meta_data ->> 'name',
          split_part(coalesce(new.email, ''), '@', 1), '')), 40);
  insert into public.profiles (id, display_name, phone)
  values (new.id, case when nm = '' then 'Visitante' else nm end, a.phone)
  on conflict (id) do nothing;
  return new;
end;
$$;

-- Quién soy: ahora la bienvenida especial de María Rosa sale de allowed_phones.
create or replace function public.whoami()
returns jsonb
language sql stable security definer
set search_path = public
as $$
  select jsonb_build_object(
    'id', p.id,
    'role', p.role,
    'display_name', p.display_name,
    'phone', p.phone,
    'blocked', p.blocked,
    'privacy_accepted', p.privacy_accepted_at is not null,
    'is_admin', public.is_admin(),
    'is_maria_rosa',
      exists (select 1 from public.allowed_phones a
              where a.is_maria_rosa
                and a.phone || '@tel.mr23.chat' = lower(coalesce(auth.jwt() ->> 'email', '')))
      or exists (select 1 from public.special_contacts s
              where lower(s.email) = lower(coalesce(auth.jwt() ->> 'email', '')))
  )
  from public.profiles p
  where p.id = auth.uid();
$$;

-- La bandeja de Cris ahora incluye el teléfono de cada conversación.
drop function if exists public.admin_inbox();
create or replace function public.admin_inbox()
returns table (
  conv_id uuid, visitor uuid, name text, phone text, status text, muted boolean, blocked boolean,
  created timestamptz, updated timestamptz,
  last_content text, last_sender uuid, last_at timestamptz, unread bigint
)
language sql stable security definer
set search_path = public
as $$
  select c.id, c.visitor_id, p.display_name, p.phone, c.status, c.muted, p.blocked,
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
revoke all on function public.admin_inbox() from public, anon;
grant execute on function public.admin_inbox() to authenticated;

-- Pasa el rol de administrador a la cuenta de un número (y se lo quita a la anterior).
-- Solo se puede ejecutar desde el SQL Editor.
create or replace function public.bootstrap_admin_phone(p_phone text)
returns text
language plpgsql security definer
set search_path = public, auth
as $$
declare
  uid uuid;
  nm  text;
begin
  select id into uid from auth.users where lower(email) = p_phone || '@tel.mr23.chat';
  if uid is null then
    raise exception 'Primero crea esa cuenta en Authentication → Users → Add user (correo: %@tel.mr23.chat).', p_phone;
  end if;
  select display_name into nm from public.allowed_phones where phone = p_phone;
  update public.profiles set role = 'visitor' where role = 'admin' and id <> uid;
  insert into public.profiles (id, display_name, phone, role, privacy_accepted_at)
  values (uid, coalesce(nm, 'Cris'), p_phone, 'admin', now())
  on conflict (id) do update set role = 'admin', phone = excluded.phone, display_name = excluded.display_name;
  return 'Administrador: ' || p_phone;
end;
$$;
revoke all on function public.bootstrap_admin_phone(text) from public, anon, authenticated;

-- =====================================================================
--  DESPUÉS de esta migración:
--   1) Autoriza los dos números (con código de país, solo dígitos):
--        insert into public.allowed_phones (phone, display_name, is_maria_rosa) values
--          ('51XXXXXXXXX', 'Cris', false),
--          ('51YYYYYYYYY', 'María Rosa', true);
--   2) Authentication → Users → Add user, para CADA número:
--        correo = 51XXXXXXXXX@tel.mr23.chat · una clave larga · marca "Auto Confirm User"
--   3) Authentication → Sign In / Providers → apaga "Allow new users to sign up".
--   4) Para que tu número sea el administrador:
--        select public.bootstrap_admin_phone('51XXXXXXXXX');
-- =====================================================================
