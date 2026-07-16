-- Barrido de reintento: si un correo falló (ej. 421 por conexiones SMTP
-- simultáneas con el otro proyecto que comparte el buzón), se reintenta
-- cada 10 minutos, máximo 3 por barrido. Aplicada como reintento_correos.

create extension if not exists pg_cron;

select cron.schedule(
  'reintentar-correos-notificaciones',
  '*/10 * * * *',
  $$
  select net.http_post(
    url := 'https://ozpbyncnsdxzocqczxzu.supabase.co/functions/v1/enviar-notificacion',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer <ANON_KEY>'
    ),
    body := jsonb_build_object('id', pendiente.id),
    timeout_milliseconds := 150000
  )
  from (
    select id from notificaciones
    where correo_enviado = false
      and timestamp > now() - interval '7 days'
    order by timestamp
    limit 3
  ) as pendiente
  $$
);
