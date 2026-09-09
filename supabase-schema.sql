-- Ejecuta este script completo en Supabase: Project > SQL Editor > New query > Run

create extension if not exists pgcrypto;

create table if not exists equipos (
  id uuid primary key default gen_random_uuid(),
  serial text not null,
  tipo text not null check (tipo in ('Wave', 'Reposición', 'Pivot')),
  lote text not null default '—',
  fecha_ingreso date not null,
  flags jsonb not null default '{"imagen":false,"dominio":false,"encriptado":false,"logueado":false,"audio":false,"listo":false,"enviado":false}'::jsonb,
  notas text not null default '',
  historial jsonb not null default '[]'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists equipos_serial_idx on equipos (serial);
create index if not exists equipos_lote_idx on equipos (lote);

-- Habilita Row Level Security (obligatorio en Supabase) y permite acceso
-- total a través de la llave "anon" pública, porque esta es una herramienta
-- interna sin sistema de usuarios. Si más adelante quieres restringir quién
-- puede leer/escribir, reemplaza esta política por una basada en Supabase Auth.
alter table equipos enable row level security;

create policy "Acceso total (uso interno sin autenticación)"
on equipos
for all
using (true)
with check (true);

-- Habilita actualizaciones en tiempo real para que todos los técnicos
-- vean los cambios de los demás sin recargar la página.
alter publication supabase_realtime add table equipos;
