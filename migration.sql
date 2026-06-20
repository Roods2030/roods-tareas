-- --- MIGRACIÓN DE BASE DE DATOS (SUPABASE) ---
-- Ejecuta este script en el editor SQL de tu proyecto para actualizar tus tablas actuales

-- 1. Modificar tabla de empleados para fotos y nickname
alter table public.roods_employees add column if not exists photo text;
alter table public.roods_employees add column if not exists nickname text;

-- 2. Modificar tabla de asistencia para vincular con rol y turno
alter table public.roods_attendance add column if not exists role_name text;
alter table public.roods_attendance add column if not exists shift text;

-- 3. Crear tabla de mensajes para el Muro de Avisos
create table if not exists public.roods_messages (
    id bigint primary key generated always as identity,
    employee_id bigint references public.roods_employees(id) on delete set null,
    employee_name text not null,
    message text not null,
    timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Activar replicación en tiempo real para la tabla de mensajes
alter publication supabase_realtime add table public.roods_messages;
