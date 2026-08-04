-- --- SCRIPT COMPLETO DE MIGRACIÓN Y REPARACIÓN SUPABASE ---
-- Copia este código, ve a tu proyecto en Supabase -> SQL Editor -> New Query y ejecútalo.

-- 1. Modificar tabla de empleados para fotos y nickname
ALTER TABLE public.roods_employees ADD COLUMN IF NOT EXISTS photo text;
ALTER TABLE public.roods_employees ADD COLUMN IF NOT EXISTS nickname text;

-- 2. Modificar tabla de asistencia para vincular con rol y turno
ALTER TABLE public.roods_attendance ADD COLUMN IF NOT EXISTS role_name text;
ALTER TABLE public.roods_attendance ADD COLUMN IF NOT EXISTS shift text;

-- 3. Asegurar estructura de la tabla roods_daily_tasks
ALTER TABLE public.roods_daily_tasks ADD COLUMN IF NOT EXISTS is_urgent boolean DEFAULT false NOT NULL;
ALTER TABLE public.roods_daily_tasks ADD COLUMN IF NOT EXISTS urgent_acknowledged boolean DEFAULT false NOT NULL;
ALTER TABLE public.roods_daily_tasks ADD COLUMN IF NOT EXISTS assigned_employee_id bigint;
ALTER TABLE public.roods_daily_tasks ADD COLUMN IF NOT EXISTS assigned_role text;

-- Corregir columnas booleanas para que nunca contengan NULL
ALTER TABLE public.roods_daily_tasks ALTER COLUMN is_urgent SET DEFAULT false;
ALTER TABLE public.roods_daily_tasks ALTER COLUMN urgent_acknowledged SET DEFAULT false;
UPDATE public.roods_daily_tasks SET is_urgent = false WHERE is_urgent IS NULL;
UPDATE public.roods_daily_tasks SET urgent_acknowledged = false WHERE urgent_acknowledged IS NULL;

-- 4. Habilitar permisos de lectura y escritura (RLS) en todas las tablas
ALTER TABLE public.roods_daily_tasks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura y escritura a todos (Tareas Diarias)" ON public.roods_daily_tasks;
CREATE POLICY "Permitir lectura y escritura a todos (Tareas Diarias)" ON public.roods_daily_tasks FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.roods_employees ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura y escritura a todos (Empleados)" ON public.roods_employees;
CREATE POLICY "Permitir lectura y escritura a todos (Empleados)" ON public.roods_employees FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.roods_attendance ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura y escritura a todos (Asistencia)" ON public.roods_attendance;
CREATE POLICY "Permitir lectura y escritura a todos (Asistencia)" ON public.roods_attendance FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.roods_swaps ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura y escritura a todos (Swaps)" ON public.roods_swaps;
CREATE POLICY "Permitir lectura y escritura a todos (Swaps)" ON public.roods_swaps FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.roods_weekly_roles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura y escritura a todos (Roles Semanales)" ON public.roods_weekly_roles;
CREATE POLICY "Permitir lectura y escritura a todos (Roles Semanales)" ON public.roods_weekly_roles FOR ALL USING (true) WITH CHECK (true);

ALTER TABLE public.roods_task_templates ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura y escritura a todos (Plantillas)" ON public.roods_task_templates;
CREATE POLICY "Permitir lectura y escritura a todos (Plantillas)" ON public.roods_task_templates FOR ALL USING (true) WITH CHECK (true);
