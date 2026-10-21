-- ReadySet Investment — septiembre 2026
-- 1) Tendencias de mercado (iguales para todos) en lugar de recomendaciones personalizadas
-- 2) Los clientes pueden corregir / eliminar operaciones que registraron
-- 3) Aceptación de términos y condiciones

-------------------------------------------------------------------------------
-- 1. Tendencias de mercado
-------------------------------------------------------------------------------
create table if not exists public.market_trends (
  symbol        text primary key,
  name          text,
  exchange      text,
  currency      text default 'USD',
  price         numeric,
  change        numeric,
  change_pct    numeric,
  volume        bigint,
  market_cap    numeric,
  fifty_two_week_low  numeric,
  fifty_two_week_high numeric,
  rank          int not null,
  fetched_at    timestamptz not null default now()
);
alter table public.market_trends enable row level security;
drop policy if exists market_trends_select_authenticated on public.market_trends;
create policy market_trends_select_authenticated on public.market_trends
  for select to authenticated using (true);
-- Sin políticas de escritura: solo la Edge Function (service role) la actualiza.

-- Recomendaciones personalizadas: se discontinúan. Se conserva la tabla con el
-- histórico, pero ya no se pueden crear ni se envían emails.
drop trigger if exists on_recommendation_created_notify on public.recommendations;
revoke execute on function public.create_recommendations(uuid[], uuid, text, text, numeric, numeric) from public, anon, authenticated;

-------------------------------------------------------------------------------
-- 2. Operaciones editables
-------------------------------------------------------------------------------
alter table public.transactions
  add column if not exists source     text not null default 'historico',
  add column if not exists locked     boolean not null default false,
  add column if not exists created_at timestamptz not null default now(),
  add column if not exists edited_at  timestamptz;

-- Punto de partida de cada posición (lo que había antes de las operaciones que
-- el cliente puede editar). Se inicializa con las tenencias actuales.
create table if not exists public.position_baselines (
  user_id           uuid not null references public.profiles(id) on delete cascade,
  instrument_id     uuid not null references public.instruments(id),
  quantity          numeric not null default 0,
  avg_cost          numeric not null default 0,
  first_acquired_at timestamptz,
  set_at            timestamptz not null default now(),
  primary key (user_id, instrument_id)
);
alter table public.position_baselines enable row level security;
drop policy if exists position_baselines_select_own_or_admin on public.position_baselines;
create policy position_baselines_select_own_or_admin on public.position_baselines
  for select using (user_id = (select auth.uid()) or public.is_admin());

insert into public.position_baselines (user_id, instrument_id, quantity, avg_cost, first_acquired_at)
  select user_id, instrument_id, quantity, avg_cost, first_acquired_at from public.holdings
  on conflict do nothing;

-- Snapshot del valor de cartera de hoy
create or replace function public._refresh_today_snapshot(p_user uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_total numeric(18,2);
begin
  select coalesce(sum(h.quantity * i.current_price), 0) into v_total
    from public.holdings h join public.instruments i on i.id = h.instrument_id
    where h.user_id = p_user;
  insert into public.portfolio_value_history (user_id, as_of_date, total_value)
    values (p_user, current_date, v_total)
    on conflict (user_id, as_of_date) do update set total_value = excluded.total_value;
end $$;

create or replace function public._ensure_baseline(p_user uuid, p_instrument uuid)
returns void language plpgsql security definer set search_path = public as $$
begin
  insert into public.position_baselines (user_id, instrument_id, quantity, avg_cost, first_acquired_at)
    select p_user, p_instrument, coalesce(h.quantity, 0), coalesce(h.avg_cost, 0), h.first_acquired_at
    from (select 1) x
    left join public.holdings h on h.user_id = p_user and h.instrument_id = p_instrument
  on conflict do nothing;
end $$;

-- Recalcula una posición desde su punto de partida, re-aplicando en orden
-- cronológico todas las operaciones editables del cliente (costo promedio).
create or replace function public._recompute_position(p_user uuid, p_instrument uuid)
returns void language plpgsql security definer set search_path = public as $$
declare
  b   public.position_baselines;
  tx  public.transactions;
  q   numeric := 0;
  a   numeric := 0;
  fa  timestamptz;
  sym text;
begin
  select symbol into sym from public.instruments where id = p_instrument;
  select * into b from public.position_baselines where user_id = p_user and instrument_id = p_instrument;
  if found then q := b.quantity; a := b.avg_cost; fa := b.first_acquired_at; end if;

  for tx in
    select * from public.transactions
     where user_id = p_user and instrument_id = p_instrument
       and source = 'cliente' and not locked
     order by executed_at, created_at, id
  loop
    if tx.operation_type = 'comprar' then
      if q <= 0 then
        q := tx.quantity; a := tx.price; fa := tx.executed_at;
      else
        a := (q * a + tx.quantity * tx.price) / (q + tx.quantity);
        q := q + tx.quantity;
        fa := least(coalesce(fa, tx.executed_at), tx.executed_at);
      end if;
      update public.transactions set cost_basis = null, realized_gain = null, acquired_at = null
        where id = tx.id and (cost_basis is not null or realized_gain is not null);
    elsif tx.operation_type = 'vender' then
      if tx.quantity > q + 0.0000001 then
        raise exception 'La venta de % % del % supera la tenencia registrada a esa fecha (% unidades). Revisá las fechas y cantidades.',
          trim(to_char(tx.quantity, 'FM999999990.######')), sym, to_char(tx.executed_at, 'DD/MM/YYYY'),
          trim(to_char(q, 'FM999999990.######'));
      end if;
      update public.transactions
         set cost_basis    = round(tx.quantity * a, 4),
             realized_gain = round(tx.amount - tx.quantity * a, 2),
             acquired_at   = fa
       where id = tx.id;
      q := q - tx.quantity;
      if q <= 0.0000001 then q := 0; a := 0; fa := null; end if;
    end if;
  end loop;

  if q > 0 then
    insert into public.holdings (user_id, instrument_id, quantity, avg_cost, first_acquired_at, updated_at)
      values (p_user, p_instrument, q, round(a, 4), fa, now())
    on conflict (user_id, instrument_id) do update
      set quantity = excluded.quantity, avg_cost = excluded.avg_cost,
          first_acquired_at = excluded.first_acquired_at, updated_at = now();
  else
    delete from public.holdings where user_id = p_user and instrument_id = p_instrument;
  end if;
end $$;

-- Registrar (misma firma que antes, así la versión publicada sigue andando)
create or replace function public.record_my_trade(
  p_instrument_id uuid, p_operation_type text, p_quantity numeric, p_price numeric,
  p_executed_at timestamptz default now(), p_notes text default null)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_tx public.transactions;
begin
  if v_user is null then raise exception 'No autenticado'; end if;
  if p_operation_type not in ('comprar','vender') then
    raise exception 'Tipo de operación inválido: % (usá comprar o vender)', p_operation_type; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'La cantidad tiene que ser mayor a 0'; end if;
  if p_price is null or p_price <= 0 then raise exception 'El precio tiene que ser mayor a 0'; end if;
  if p_executed_at is null or p_executed_at > now() + interval '1 day' then
    raise exception 'La fecha de la operación no puede ser futura'; end if;
  if not exists (select 1 from public.instruments where id = p_instrument_id) then
    raise exception 'El instrumento indicado no existe'; end if;

  perform public._ensure_baseline(v_user, p_instrument_id);

  insert into public.transactions (user_id, instrument_id, operation_type, quantity, price, amount,
                                   executed_by, executed_at, source)
    values (v_user, p_instrument_id, p_operation_type, p_quantity, p_price, round(p_quantity * p_price, 2),
            v_user, p_executed_at, 'cliente')
    returning id into v_tx.id;

  perform public._recompute_position(v_user, p_instrument_id);
  perform public._refresh_today_snapshot(v_user);
  select * into v_tx from public.transactions where id = v_tx.id;
  return v_tx;
end $$;

create or replace function public.update_my_trade(
  p_tx_id uuid, p_instrument_id uuid, p_operation_type text, p_quantity numeric,
  p_price numeric, p_executed_at timestamptz)
returns public.transactions language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_old public.transactions; v_tx public.transactions;
begin
  if v_user is null then raise exception 'No autenticado'; end if;
  select * into v_old from public.transactions where id = p_tx_id for update;
  if not found or v_old.user_id <> v_user then raise exception 'Operación no encontrada'; end if;
  if v_old.source <> 'cliente' or v_old.locked then
    raise exception 'Esta operación es histórica o quedó consolidada por una carga de cartera, y no se puede editar'; end if;
  if p_operation_type not in ('comprar','vender') then raise exception 'Tipo de operación inválido'; end if;
  if p_quantity is null or p_quantity <= 0 then raise exception 'La cantidad tiene que ser mayor a 0'; end if;
  if p_price is null or p_price <= 0 then raise exception 'El precio tiene que ser mayor a 0'; end if;
  if p_executed_at is null or p_executed_at > now() + interval '1 day' then
    raise exception 'La fecha de la operación no puede ser futura'; end if;
  if not exists (select 1 from public.instruments where id = p_instrument_id) then
    raise exception 'El instrumento indicado no existe'; end if;

  perform public._ensure_baseline(v_user, p_instrument_id);

  update public.transactions
     set instrument_id = p_instrument_id, operation_type = p_operation_type,
         quantity = p_quantity, price = p_price, amount = round(p_quantity * p_price, 2),
         executed_at = p_executed_at, edited_at = now(),
         cost_basis = null, realized_gain = null, acquired_at = null
   where id = p_tx_id;

  perform public._recompute_position(v_user, p_instrument_id);
  if v_old.instrument_id is distinct from p_instrument_id then
    perform public._recompute_position(v_user, v_old.instrument_id);
  end if;
  perform public._refresh_today_snapshot(v_user);
  select * into v_tx from public.transactions where id = p_tx_id;
  return v_tx;
end $$;

create or replace function public.delete_my_trade(p_tx_id uuid)
returns void language plpgsql security definer set search_path = public as $$
declare v_user uuid := auth.uid(); v_old public.transactions;
begin
  if v_user is null then raise exception 'No autenticado'; end if;
  select * into v_old from public.transactions where id = p_tx_id for update;
  if not found or v_old.user_id <> v_user then raise exception 'Operación no encontrada'; end if;
  if v_old.source <> 'cliente' or v_old.locked then
    raise exception 'Esta operación es histórica o quedó consolidada por una carga de cartera, y no se puede eliminar'; end if;
  delete from public.transactions where id = p_tx_id;
  perform public._recompute_position(v_user, v_old.instrument_id);
  perform public._refresh_today_snapshot(v_user);
end $$;

-- Importador: la carga de cartera pasa a ser el nuevo punto de partida
create or replace function public.admin_bulk_load_portfolio(p_client_email text, p_holdings jsonb)
returns setof public.holdings language plpgsql security definer set search_path = public as $$
declare
  v_user_id uuid; v_elem jsonb; v_symbol text; v_instrument_id uuid;
  v_quantity numeric; v_avg_cost numeric; v_first_acquired timestamptz; v_auto_reinvest boolean;
begin
  if not public.is_admin() then raise exception 'Solo un administrador puede cargar carteras de clientes'; end if;
  if p_client_email is null or trim(p_client_email) = '' then raise exception 'Falta el email del cliente'; end if;

  select id into v_user_id from public.profiles where lower(email) = lower(trim(p_client_email));
  if not found then
    raise exception 'No existe ningún usuario registrado con el email %. El cliente tiene que crear su cuenta (o la tenés que crear vos desde Authentication > Users en Supabase) antes de poder cargarle la cartera.', p_client_email;
  end if;
  if p_holdings is null or jsonb_typeof(p_holdings) <> 'array' or jsonb_array_length(p_holdings) = 0 then
    raise exception 'No se recibió ninguna fila de tenencias para cargar';
  end if;

  for v_elem in select * from jsonb_array_elements(p_holdings) loop
    v_symbol := upper(trim(coalesce(v_elem->>'symbol', '')));
    if v_symbol = '' then raise exception 'Hay una fila sin símbolo de instrumento'; end if;
    select id into v_instrument_id from public.instruments where symbol = v_symbol;
    if not found then
      raise exception 'El símbolo "%" no existe en el catálogo de instrumentos. Revisá que esté bien escrito o pedí que se agregue primero.', v_symbol;
    end if;
    v_quantity := (v_elem->>'quantity')::numeric;
    v_avg_cost := (v_elem->>'avg_cost')::numeric;
    if v_quantity is null or v_quantity <= 0 then
      raise exception 'La fila de "%" tiene una cantidad inválida (tiene que ser mayor a 0)', v_symbol; end if;
    if v_avg_cost is null or v_avg_cost < 0 then
      raise exception 'La fila de "%" tiene un costo promedio inválido (tiene que ser 0 o mayor)', v_symbol; end if;
    v_first_acquired := coalesce((v_elem->>'first_acquired_at')::timestamptz, now());
    v_auto_reinvest := coalesce((v_elem->>'auto_reinvest')::boolean, false);

    insert into public.holdings (user_id, instrument_id, quantity, avg_cost, first_acquired_at, auto_reinvest)
      values (v_user_id, v_instrument_id, v_quantity, v_avg_cost, v_first_acquired, v_auto_reinvest)
    on conflict (user_id, instrument_id) do update
      set quantity = excluded.quantity, avg_cost = excluded.avg_cost,
          first_acquired_at = excluded.first_acquired_at, auto_reinvest = excluded.auto_reinvest,
          updated_at = now();

    insert into public.position_baselines (user_id, instrument_id, quantity, avg_cost, first_acquired_at, set_at)
      values (v_user_id, v_instrument_id, v_quantity, v_avg_cost, v_first_acquired, now())
    on conflict (user_id, instrument_id) do update
      set quantity = excluded.quantity, avg_cost = excluded.avg_cost,
          first_acquired_at = excluded.first_acquired_at, set_at = now();

    update public.transactions set locked = true
     where user_id = v_user_id and instrument_id = v_instrument_id and source = 'cliente' and not locked;
  end loop;

  perform public._refresh_today_snapshot(v_user_id);
  return query select * from public.holdings where user_id = v_user_id;
end $$;

-------------------------------------------------------------------------------
-- 3. Términos y condiciones
-------------------------------------------------------------------------------
alter table public.profiles
  add column if not exists terms_version     text,
  add column if not exists terms_accepted_at timestamptz;

create or replace function public.accept_terms(p_version text)
returns void language plpgsql security definer set search_path = public as $$
begin
  if auth.uid() is null then raise exception 'No autenticado'; end if;
  if p_version is null or length(p_version) > 20 then raise exception 'Versión inválida'; end if;
  update public.profiles set terms_version = p_version, terms_accepted_at = now() where id = auth.uid();
end $$;

-------------------------------------------------------------------------------
-- Permisos
-------------------------------------------------------------------------------
revoke execute on function public._refresh_today_snapshot(uuid)       from public, anon, authenticated;
revoke execute on function public._ensure_baseline(uuid, uuid)        from public, anon, authenticated;
revoke execute on function public._recompute_position(uuid, uuid)     from public, anon, authenticated;

revoke execute on function public.record_my_trade(uuid, text, numeric, numeric, timestamptz, text) from public, anon;
revoke execute on function public.update_my_trade(uuid, uuid, text, numeric, numeric, timestamptz) from public, anon;
revoke execute on function public.delete_my_trade(uuid)                from public, anon;
revoke execute on function public.admin_bulk_load_portfolio(text, jsonb) from public, anon;
revoke execute on function public.accept_terms(text)                   from public, anon;

grant execute on function public.record_my_trade(uuid, text, numeric, numeric, timestamptz, text) to authenticated;
grant execute on function public.update_my_trade(uuid, uuid, text, numeric, numeric, timestamptz) to authenticated;
grant execute on function public.delete_my_trade(uuid)                to authenticated;
grant execute on function public.admin_bulk_load_portfolio(text, jsonb) to authenticated;
grant execute on function public.accept_terms(text)                   to authenticated;

-- Limpieza: funciones del modelo viejo que ya no usa ninguna pantalla
revoke execute on function public.notify_recommendation_webhook() from public, anon, authenticated;
revoke execute on function public.cancel_operation_request(uuid) from public, anon, authenticated;
revoke execute on function public.review_operation_request(uuid, text, text) from public, anon, authenticated;
revoke execute on function public.set_holding_auto_reinvest(uuid, boolean) from public, anon, authenticated;

-- 25/09/2026: carteras de práctica (aplicado como migración "practice_portfolios"
-- en Supabase; ver RESUMEN_PROYECTO.md). Resumen: tablas practice_portfolios,
-- practice_positions, practice_quotes, practice_history con RLS de solo lectura
-- propia; funciones create_practice_portfolio / delete_practice_portfolio /
-- refresh_practice_history; cron 'practice-history-daily' 30 21 * * 1-5.
