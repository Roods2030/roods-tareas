-- Migration V2: Mensajería Privada y Anuncios Globales
-- Copia y pega esto en el SQL Editor de Supabase y ejecútalo.

-- 1. Tabla de Anuncios Globales (Tipo Globo)
CREATE TABLE IF NOT EXISTS public.roods_announcements (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    message text NOT NULL,
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    created_by_name text NOT NULL,
    expires_at timestamp with time zone -- Opcional, para borrar automáticamente
);

-- Permisos
ALTER TABLE public.roods_announcements ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir lectura y escritura a todos (Anuncios)" ON public.roods_announcements FOR ALL USING (true);


-- 2. Tabla de Mensajes Privados (Soporte texto y foto)
CREATE TABLE IF NOT EXISTS public.roods_private_messages (
    id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
    sender_name text NOT NULL,
    recipient_id bigint NOT NULL,
    message text NOT NULL,
    photo_url text, -- Opcional: url de la foto o base64
    created_at timestamp with time zone DEFAULT now() NOT NULL,
    read boolean DEFAULT false NOT NULL
);

-- Permisos
ALTER TABLE public.roods_private_messages ENABLE ROW LEVEL SECURITY;
CREATE POLICY "Permitir lectura y escritura a todos (Mensajes Privados)" ON public.roods_private_messages FOR ALL USING (true);
