-- Damas Evolution · 002 · segurança, partidas online e Elo no servidor. Rode inteiro no SQL Editor (idempotente;
-- pode ser rodado também por cima da versão anterior 002_matches_elo.sql).
-- Modelo: o cliente NUNCA escreve em matches/profiles. Toda escrita passa por funções SECURITY DEFINER.
-- Limitação conhecida: o servidor confere vez, ordem e formato dos lances, mas NÃO a legalidade das damas
-- (as regras vivem no JS). Por isso o resultado só altera o Elo quando os dois jogadores concordam
-- (ou quando um concede/abandona, ou o outro some por 60 s). Divergência => 'disputed', sem mudança de Elo.

-- Username: ASCII, 3-16 caracteres, único sem diferenciar maiúsculas (Petrux = petrux). Sem renomear pelo cliente.
alter table public.profiles drop constraint if exists username_format;
alter table public.profiles add constraint username_format check (username ~ '^[A-Za-z0-9_-]{3,16}$') not valid;
create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));
revoke update on public.profiles from anon, authenticated;

create table if not exists public.matches (
  id uuid primary key default gen_random_uuid(),
  white_player uuid not null references public.profiles(id),
  black_player uuid not null references public.profiles(id),
  board_state jsonb not null default '{"moves":[]}'::jsonb,
  turn text not null default 'white',
  status text not null default 'active',
  winner uuid references public.profiles(id),
  created_at timestamptz not null default now()
);
alter table public.matches
  add column if not exists white_ready boolean not null default false,
  add column if not exists black_ready boolean not null default false,
  add column if not exists white_seen timestamptz,
  add column if not exists black_seen timestamptz,
  add column if not exists last_move_at timestamptz not null default now(),
  add column if not exists white_report text,
  add column if not exists black_report text,
  add column if not exists ended_reason text,
  add column if not exists ended_at timestamptz,
  add column if not exists white_delta int,
  add column if not exists black_delta int;
alter table public.matches alter column board_state set default '{"moves":[]}'::jsonb;
update public.matches set board_state = '{"moves":[]}'::jsonb where board_state is null or not (board_state ? 'moves');

do $$ declare c record; begin
  for c in select conname from pg_constraint
           where conrelid = 'public.matches'::regclass and contype = 'c' and pg_get_constraintdef(oid) ilike '%status%'
  loop execute format('alter table public.matches drop constraint %I', c.conname); end loop;
end $$;
alter table public.matches add constraint matches_status_check check (status in ('active','finished','abandoned','disputed'));

create index if not exists matches_white_idx on public.matches (white_player, status);
create index if not exists matches_black_idx on public.matches (black_player, status);
create index if not exists profiles_elo_idx on public.profiles (elo desc);

-- RLS: só os dois jogadores leem a partida; ninguém escreve direto.
alter table public.matches enable row level security;
drop policy if exists matches_select_participants on public.matches;
create policy matches_select_participants on public.matches for select to authenticated
  using (auth.uid() in (white_player, black_player));
revoke insert, update, delete on public.matches from anon, authenticated;
grant select on public.matches to authenticated;

-- Cria a partida (cores sorteadas no servidor). Exige que ninguém esteja em outra partida ativa.
create or replace function public.create_match(p_opponent uuid) returns uuid
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); v_w uuid; v_b uuid; v_id uuid;
begin
  if v_me is null then raise exception 'not_authenticated'; end if;
  if p_opponent is null or p_opponent = v_me or not exists (select 1 from public.profiles where id = p_opponent) then
    raise exception 'invalid_opponent'; end if;
  if (select count(*) from public.matches where (white_player = v_me or black_player = v_me) and created_at > now() - interval '1 minute') >= 10 then
    raise exception 'rate_limited'; end if;
  update public.matches set status = 'abandoned', ended_reason = 'expired', ended_at = now()
   where status = 'active' and (white_player in (v_me, p_opponent) or black_player in (v_me, p_opponent))
     and greatest(last_move_at, coalesce(white_seen, created_at), coalesce(black_seen, created_at)) < now() - interval '10 minutes';
  if exists (select 1 from public.matches where status = 'active' and (white_player in (v_me, p_opponent) or black_player in (v_me, p_opponent))) then
    raise exception 'busy'; end if;
  if random() < 0.5 then v_w := v_me; v_b := p_opponent; else v_w := p_opponent; v_b := v_me; end if;
  insert into public.matches (white_player, black_player) values (v_w, v_b) returning id into v_id;
  return v_id;
end $$;

-- Cada jogador confirma presença (a partida só aceita lances quando os dois entraram).
create or replace function public.join_match(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); m public.matches%rowtype;
begin
  select * into m from public.matches where id = p_match for update;
  if not found or v_me is null or v_me not in (m.white_player, m.black_player) then raise exception 'forbidden'; end if;
  if m.status <> 'active' then return; end if;
  if v_me = m.white_player then update public.matches set white_ready = true, white_seen = now() where id = p_match;
  else update public.matches set black_ready = true, black_seen = now() where id = p_match; end if;
  update public.matches set last_move_at = now() where id = p_match and white_ready and black_ready and jsonb_array_length(board_state->'moves') = 0;
end $$;

-- Batimento: prova de presença verificável pelo servidor (usada para validar abandono).
create or replace function public.ping_match(p_match uuid) returns void
language plpgsql security definer set search_path = public as $$
begin
  update public.matches set
    white_seen = case when auth.uid() = white_player then now() else white_seen end,
    black_seen = case when auth.uid() = black_player then now() else black_seen end
  where id = p_match and status = 'active' and auth.uid() in (white_player, black_player);
end $$;

-- Registra um lance [from, path[], caps[]]: confere participante, vez, ordem (p_n) e formato.
create or replace function public.record_move(p_match uuid, p_move jsonb, p_n int) returns int
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); m public.matches%rowtype; v_color text; v_len int;
begin
  select * into m from public.matches where id = p_match for update;
  if not found or v_me is null or v_me not in (m.white_player, m.black_player) then raise exception 'forbidden'; end if;
  if m.status <> 'active' then raise exception 'not_active'; end if;
  if not (m.white_ready and m.black_ready) then raise exception 'not_ready'; end if;
  v_color := case when v_me = m.white_player then 'white' else 'black' end;
  if m.turn <> v_color then raise exception 'not_your_turn'; end if;
  v_len := coalesce(jsonb_array_length(m.board_state->'moves'), 0);
  if p_n <> v_len then raise exception 'out_of_sync'; end if;
  if v_len >= 600 then raise exception 'too_long'; end if;
  if not (jsonb_typeof(p_move) = 'array' and jsonb_array_length(p_move) = 3
          and jsonb_typeof(p_move->0) = 'number' and jsonb_typeof(p_move->1) = 'array' and jsonb_typeof(p_move->2) = 'array'
          and jsonb_array_length(p_move->1) between 1 and 16 and jsonb_array_length(p_move->2) <= 16
          and (p_move->>0)::numeric between 0 and 63) then raise exception 'bad_move'; end if;
  update public.matches set
    board_state = jsonb_set(board_state, '{moves}', coalesce(board_state->'moves', '[]'::jsonb) || jsonb_build_array(p_move)),
    turn = case when turn = 'white' then 'black' else 'white' end, last_move_at = now(),
    white_seen = case when v_color = 'white' then now() else white_seen end,
    black_seen = case when v_color = 'black' then now() else black_seen end
  where id = p_match;
  return v_len + 1;
end $$;

-- Interna: encerra e aplica o Elo (K=40 nas 10 primeiras partidas, depois 20). Não pontua partidas com
-- menos de 6 lances nem a 6ª+ partida entre o mesmo par em 24 h (anti-farm / conluio).
create or replace function public._finish_match(p_match uuid, p_winner text, p_reason text) returns jsonb
language plpgsql security definer set search_path = public as $$
declare m public.matches%rowtype; w public.profiles%rowtype; b public.profiles%rowtype;
  v_plies int; v_recent int; ew float8; sw float8; kw int; kb int; dw int := 0; db int := 0; v_win uuid;
begin
  select * into m from public.matches where id = p_match;
  perform 1 from public.profiles where id in (m.white_player, m.black_player) order by id for update;
  select * into w from public.profiles where id = m.white_player;
  select * into b from public.profiles where id = m.black_player;
  v_plies := coalesce(jsonb_array_length(m.board_state->'moves'), 0);
  select count(*) into v_recent from public.matches
   where id <> m.id and status = 'finished' and ended_at > now() - interval '24 hours'
     and ((white_player = m.white_player and black_player = m.black_player) or (white_player = m.black_player and black_player = m.white_player))
     and (coalesce(white_delta, 0) <> 0 or coalesce(black_delta, 0) <> 0);
  if v_plies >= 6 and v_recent < 5 then
    sw := case p_winner when 'white' then 1 when 'black' then 0 else 0.5 end;
    ew := 1 / (1 + power(10::float8, (b.elo - w.elo) / 400.0));
    kw := case when w.wins + w.losses < 10 then 40 else 20 end;
    kb := case when b.wins + b.losses < 10 then 40 else 20 end;
    dw := round(kw * (sw - ew));
    db := round(kb * ((1 - sw) - (1 - ew)));
    update public.profiles set elo = greatest(100, elo + dw),
      wins = wins + (p_winner = 'white')::int, losses = losses + (p_winner = 'black')::int where id = w.id;
    update public.profiles set elo = greatest(100, elo + db),
      wins = wins + (p_winner = 'black')::int, losses = losses + (p_winner = 'white')::int where id = b.id;
  end if;
  v_win := case p_winner when 'white' then m.white_player when 'black' then m.black_player else null end;
  update public.matches set status = 'finished', winner = v_win, ended_reason = p_reason, ended_at = now(),
    white_delta = dw, black_delta = db where id = p_match;
  return jsonb_build_object('status', 'finished', 'winner', v_win, 'white_delta', dw, 'black_delta', db);
end $$;

-- Resultado: 'resign' (quem chama perde), 'abandon' (adversário sem sinal por 60 s) ou 'normal' (relato de cada lado).
create or replace function public.finish_match(p_match uuid, p_claim text, p_reason text default 'normal') returns jsonb
language plpgsql security definer set search_path = public as $$
declare v_me uuid := auth.uid(); m public.matches%rowtype; v_color text; v_opp text; v_seen timestamptz; v_winner text;
begin
  select * into m from public.matches where id = p_match for update;
  if not found or v_me is null or v_me not in (m.white_player, m.black_player) then raise exception 'forbidden'; end if;
  if m.status <> 'active' then return jsonb_build_object('status', m.status); end if;
  if p_claim not in ('white', 'black', 'draw') or p_reason not in ('normal', 'resign', 'abandon') then raise exception 'bad_args'; end if;
  v_color := case when v_me = m.white_player then 'white' else 'black' end;
  v_opp := case when v_color = 'white' then 'black' else 'white' end;
  if p_reason = 'resign' then
    v_winner := v_opp;
  elsif p_reason = 'abandon' then
    v_seen := case when v_color = 'white' then m.black_seen else m.white_seen end;
    if coalesce(v_seen, m.created_at) > now() - interval '60 seconds' then raise exception 'opponent_active'; end if;
    if not (m.white_ready and m.black_ready) then
      update public.matches set status = 'abandoned', ended_reason = 'no_show', ended_at = now() where id = p_match;
      return jsonb_build_object('status', 'abandoned');
    end if;
    v_winner := v_color;
  else
    if v_color = 'white' then update public.matches set white_report = p_claim where id = p_match; m.white_report := p_claim;
    else update public.matches set black_report = p_claim where id = p_match; m.black_report := p_claim; end if;
    if p_claim = v_opp then v_winner := v_opp;                                   -- concessão
    elsif m.white_report is not null and m.black_report is not null then
      if m.white_report = m.black_report then v_winner := m.white_report;
      else
        update public.matches set status = 'disputed', ended_reason = 'disputed', ended_at = now(), white_delta = 0, black_delta = 0 where id = p_match;
        return jsonb_build_object('status', 'disputed');
      end if;
    else return jsonb_build_object('status', 'active', 'pending', true);
    end if;
  end if;
  return public._finish_match(p_match, v_winner, p_reason);
end $$;

revoke all on function public.create_match(uuid), public.join_match(uuid), public.ping_match(uuid),
  public.record_move(uuid, jsonb, int), public.finish_match(uuid, text, text), public._finish_match(uuid, text, text) from public, anon, authenticated;
grant execute on function public.create_match(uuid), public.join_match(uuid), public.ping_match(uuid),
  public.record_move(uuid, jsonb, int), public.finish_match(uuid, text, text) to authenticated;

-- Compatibilidade: nome antigo da função (clientes antigos). Toda a lógica vive em finish_match.
create or replace function public.report_result(p_match uuid, p_claim text, p_reason text default 'normal') returns jsonb
language sql security definer set search_path = public as $$ select public.finish_match(p_match, p_claim, p_reason); $$;
revoke all on function public.report_result(uuid, text, text) from public, anon, authenticated;
grant execute on function public.report_result(uuid, text, text) to authenticated;
