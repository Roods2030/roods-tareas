-- Migration V3: Asegurar permisos RLS en tabla public.roods_daily_tasks
-- Copia y pega esto en el SQL Editor de tu proyecto Supabase y ejecútalo.

ALTER TABLE public.roods_daily_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura y escritura a todos (Tareas Diarias)" ON public.roods_daily_tasks;

CREATE POLICY "Permitir lectura y escritura a todos (Tareas Diarias)" 
ON public.roods_daily_tasks 
FOR ALL 
USING (true) 
WITH CHECK (true);
