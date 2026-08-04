-- Migration V3: Asegurar permisos RLS y valores no nulos en public.roods_daily_tasks
-- Copia y pega esto en el SQL Editor de tu proyecto Supabase y ejecútalo.

ALTER TABLE public.roods_daily_tasks ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "Permitir lectura y escritura a todos (Tareas Diarias)" ON public.roods_daily_tasks;

CREATE POLICY "Permitir lectura y escritura a todos (Tareas Diarias)" 
ON public.roods_daily_tasks 
FOR ALL 
USING (true) 
WITH CHECK (true);

-- Corregir valores nulos existentes en is_urgent y urgent_acknowledged
ALTER TABLE public.roods_daily_tasks ALTER COLUMN is_urgent SET DEFAULT false;
ALTER TABLE public.roods_daily_tasks ALTER COLUMN urgent_acknowledged SET DEFAULT false;

UPDATE public.roods_daily_tasks SET is_urgent = false WHERE is_urgent IS NULL;
UPDATE public.roods_daily_tasks SET urgent_acknowledged = false WHERE urgent_acknowledged IS NULL;
