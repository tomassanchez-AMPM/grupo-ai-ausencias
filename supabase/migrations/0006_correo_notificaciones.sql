-- Envío de correo por notificación: cada INSERT en notificaciones dispara
-- la Edge Function enviar-notificacion (un correo por ejecución — fan-out).
-- Aplicada en Supabase como correo_notificaciones.

create extension if not exists pg_net with schema extensions;

alter table notificaciones add column correo_enviado boolean not null default false;

create or replace function disparar_correo_notificacion() returns trigger
language plpgsql security definer set search_path = public, extensions as $$
begin
  perform net.http_post(
    url := 'https://ozpbyncnsdxzocqczxzu.supabase.co/functions/v1/enviar-notificacion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'  -- clave publishable, ver .env.example
    ),
    body := jsonb_build_object('id', new.id),
    -- Timeout alto: el default de 5 s corta los envíos SMTP.
    timeout_milliseconds := 150000
  );
  return new;
end $$;

create trigger tg_correo_notificacion
  after insert on notificaciones
  for each row execute function disparar_correo_notificacion();
