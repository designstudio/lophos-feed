-- pg_cron: chama o endpoint de ingestão a cada 30 minutos
-- Requer extensão pg_cron habilitada no Supabase (Dashboard > Database > Extensions)

-- Habilitar extensão (rodar uma vez)
create extension if not exists pg_cron;

-- Job de ingestão RSS a cada 30 minutos
select cron.schedule(
  'rss-ingest',
  '*/30 * * * *',
  $$
  select net.http_post(
    url := current_setting('app.rss_ingest_url'),
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer ' || current_setting('app.rss_ingest_secret')
    ),
    body := '{}'::jsonb
  );
  $$
);

-- Configurar as variáveis (substituir pelos valores reais)
-- alter database postgres set app.rss_ingest_url = 'https://SEU-DOMINIO.vercel.app/api/rss/ingest';
-- alter database postgres set app.rss_ingest_secret = 'SEU_SECRET_AQUI';

-- Ver jobs agendados
-- select * from cron.job;

-- Ver histórico de execuções
-- select * from cron.job_run_details order by start_time desc limit 10;
