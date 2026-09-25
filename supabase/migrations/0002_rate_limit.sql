-- Rate limits for the login form, copied from Gymie
-- (drizzle/0000_strong_the_phantom.sql and drizzle/0001_functions.sql).
-- Paste into the Supabase SQL editor after 0001.

create table public.auth_throttle (
  bucket text primary key,
  hits integer not null default 1,
  window_start timestamptz not null default now()
);

-- RLS on with no policies, so only the function below can touch the counters.
alter table public.auth_throttle enable row level security;
revoke all on public.auth_throttle from anon, authenticated;

-- consume_rate_limit(bucket, max hits, window seconds) -> allowed?
--
-- SECURITY DEFINER so it can write auth_throttle. Only service_role may run
-- it: the Next.js server calls it with the secret key. If anon could call it,
-- anyone holding the public key could fill a victim's email bucket and lock
-- them out for the window.
create or replace function public.consume_rate_limit(
  p_bucket text,
  p_max int,
  p_window_seconds int
)
returns boolean
language plpgsql
security definer
set search_path = public
as $$
declare
  v_allowed boolean;
begin
  -- Opportunistic sweep, so dead buckets never pile up.
  delete from auth_throttle where window_start < now() - interval '7 days';

  insert into auth_throttle as t (bucket, hits, window_start)
  values (p_bucket, 1, now())
  on conflict (bucket) do update
    set hits = case
          when t.window_start < now() - make_interval(secs => p_window_seconds) then 1
          else t.hits + 1
        end,
        window_start = case
          when t.window_start < now() - make_interval(secs => p_window_seconds) then now()
          else t.window_start
        end
  returning hits <= p_max into v_allowed;

  return v_allowed;
end;
$$;

revoke all on function public.consume_rate_limit(text, int, int) from public;
revoke all on function public.consume_rate_limit(text, int, int) from anon, authenticated;
grant execute on function public.consume_rate_limit(text, int, int) to service_role;
