-- --- SCRIPT DE CONFIGURACIÓN DE BASE DE DATOS (SUPABASE) ---
-- Copia y pega este script en el editor SQL de tu proyecto de Supabase

-- Habilitar extensión UUID si es necesario
create extension if not exists "uuid-ossp";

-- 1. Tabla de Empleados
create table if not exists public.roods_employees (
    id bigint primary key,
    name text not null,
    pin text not null unique,
    is_admin boolean default false,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 2. Tabla de Roles Semanales
create table if not exists public.roods_weekly_roles (
    week_start date not null,
    role_key text not null,
    employee_id bigint references public.roods_employees(id) on delete cascade,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null,
    primary key (week_start, role_key)
);

-- 3. Tabla de Registro de Asistencia
create table if not exists public.roods_attendance (
    id bigint primary key,
    employee_id bigint references public.roods_employees(id) on delete cascade,
    employee_name text not null,
    date text not null,
    time text not null,
    type text not null, -- 'entrada' o 'salida'
    timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 4. Tabla de Solicitudes de Intercambios (Swaps)
create table if not exists public.roods_swaps (
    id bigint primary key,
    request_date text not null,
    from_employee_id bigint references public.roods_employees(id) on delete cascade,
    from_employee_name text not null,
    to_employee_id bigint references public.roods_employees(id) on delete cascade,
    to_employee_name text not null,
    role_name text not null,
    shift text not null,
    status text default 'pendiente' not null, -- 'pendiente', 'aprobado', 'rechazado'
    timestamp timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 5. Tabla de Tareas Diarias Instanciadas
create table if not exists public.roods_daily_tasks (
    id text primary key,
    date text not null,
    shift text not null,
    task_name text not null,
    role_name text not null,
    completed boolean default false not null,
    completed_by_employee_id bigint references public.roods_employees(id) on delete set null,
    completed_by_name text,
    completed_at text,
    "Imprescindible" text default 'No' not null,
    "Subtareas" text,
    subtasks_state jsonb default '[]'::jsonb,
    is_urgent boolean default false not null,
    assigned_employee_id bigint references public.roods_employees(id) on delete set null,
    assigned_role text, -- 'Todos' o rol específico
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- 6. Tabla de Plantillas de Tareas
create table if not exists public.roods_task_templates (
    id bigint primary key generated always as identity,
    "Tarea" text not null,
    "Rol" text not null,
    "Turno" text not null,
    "Dias" text not null,
    "Imprescindible" text default 'No' not null,
    "Subtareas" text,
    created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- --- HABILITAR REPLICACIÓN EN TIEMPO REAL (REALTIME) ---
-- Esto permite que la Consola de RH reciba actualizaciones instantáneas y los empleados reciban alertas urgentes
alter publication supabase_realtime add table public.roods_daily_tasks;
alter publication supabase_realtime add table public.roods_attendance;
alter publication supabase_realtime add table public.roods_swaps;
alter publication supabase_realtime add table public.roods_employees;
