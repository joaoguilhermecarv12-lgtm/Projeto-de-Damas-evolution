-- Damas Evolution · Etapa 1 · Autenticação e perfis. Rode inteiro no SQL Editor do Supabase (é idempotente).

-- 1) Formato e unicidade do username (sem diferenciar maiúsculas/minúsculas)
alter table public.profiles drop constraint if exists username_format;
alter table public.profiles add constraint username_format check (username ~ '^[[:alnum:]_-]{3,16}$') not valid;
create unique index if not exists profiles_username_lower_key on public.profiles (lower(username));

-- 2) RLS: todos leem (ranking); cada usuário só cria/edita o próprio perfil
alter table public.profiles enable row level security;
drop policy if exists profiles_select_all on public.profiles;
drop policy if exists profiles_insert_own on public.profiles;
drop policy if exists profiles_update_own on public.profiles;
create policy profiles_select_all on public.profiles for select to anon, authenticated using (true);
create policy profiles_insert_own on public.profiles for insert to authenticated
  with check (auth.uid() = id and elo = 1000 and wins = 0 and losses = 0);
create policy profiles_update_own on public.profiles for update to authenticated
  using (auth.uid() = id) with check (auth.uid() = id);

-- 3) Privilégios por coluna: o cliente NUNCA altera elo/wins/losses (isso será feito por função no servidor)
revoke insert, update on public.profiles from anon, authenticated;
grant insert (id, username) on public.profiles to authenticated;
grant update (username) on public.profiles to authenticated;

-- 4) Cria o perfil automaticamente no cadastro (funciona mesmo com confirmação de e-mail ligada)
create or replace function public.handle_new_user() returns trigger
language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, username)
  values (new.id, coalesce(nullif(new.raw_user_meta_data->>'username', ''), 'user_' || substr(new.id::text, 1, 8)));
  return new;
end; $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function public.handle_new_user();

-- 5) Checagem de disponibilidade do nome (chamável antes do cadastro)
create or replace function public.username_available(u text) returns boolean
language sql stable security definer set search_path = public as $$
  select not exists (select 1 from public.profiles where lower(username) = lower(u));
$$;
grant execute on function public.username_available(text) to anon, authenticated;
