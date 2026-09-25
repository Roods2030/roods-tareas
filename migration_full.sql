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

-- 5. Tabla de Mensajes (Muro de Avisos del Turno)
CREATE TABLE IF NOT EXISTS public.roods_messages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    employee_id bigint REFERENCES public.roods_employees(id) ON DELETE SET NULL,
    employee_name text NOT NULL,
    message text NOT NULL,
    timestamp timestamp with time zone DEFAULT timezone('utc'::text, now()) NOT NULL
);
ALTER TABLE public.roods_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura y escritura a todos (Muro Avisos)" ON public.roods_messages;
CREATE POLICY "Permitir lectura y escritura a todos (Muro Avisos)" ON public.roods_messages FOR ALL USING (true) WITH CHECK (true);

-- 6. Tabla de Mensajes Privados Directos
CREATE TABLE IF NOT EXISTS public.roods_private_messages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_name text NOT NULL,
    recipient_id bigint NOT NULL,
    message text NOT NULL,
    photo_url text,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read boolean DEFAULT false NOT NULL
);
ALTER TABLE public.roods_private_messages ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura y escritura a todos (Mensajes Privados)" ON public.roods_private_messages;
CREATE POLICY "Permitir lectura y escritura a todos (Mensajes Privados)" ON public.roods_private_messages FOR ALL USING (true) WITH CHECK (true);

-- 7. Tabla de Anuncios Globales (Globo)
CREATE TABLE IF NOT EXISTS public.roods_announcements (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_name text NOT NULL,
    expires_at timestamp with time zone
);
ALTER TABLE public.roods_announcements ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "Permitir lectura y escritura a todos (Anuncios)" ON public.roods_announcements;
CREATE POLICY "Permitir lectura y escritura a todos (Anuncios)" ON public.roods_announcements FOR ALL USING (true) WITH CHECK (true);

-- 8. Habilitar Replicación en Tiempo Real (Realtime)
DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.roods_daily_tasks;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.roods_attendance;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.roods_messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.roods_private_messages;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;

DO $$
BEGIN
    ALTER PUBLICATION supabase_realtime ADD TABLE public.roods_announcements;
EXCEPTION WHEN OTHERS THEN NULL;
END $$;
