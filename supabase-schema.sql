-- ============================================================
-- PLUS ULTRA RPG — Schema Supabase
-- Execute este arquivo no SQL Editor do seu projeto Supabase
-- ============================================================

-- Habilitar extensão UUID
create extension if not exists "uuid-ossp";

-- ────────────────────────────────────────────
-- TABELA: profiles (estende auth.users)
-- ────────────────────────────────────────────
create table public.profiles (
  id           uuid references auth.users(id) on delete cascade primary key,
  username     text unique not null,
  email        text,
  avatar_url   text,
  created_at   timestamptz default now(),
  last_seen    timestamptz default now(),
  is_online    boolean default false
);

alter table public.profiles enable row level security;

create policy "Perfis visíveis para todos autenticados"
  on public.profiles for select
  using (auth.role() = 'authenticated');

create policy "Usuário edita próprio perfil"
  on public.profiles for update
  using (auth.uid() = id);

create policy "Usuário insere próprio perfil"
  on public.profiles for insert
  with check (auth.uid() = id);

-- ────────────────────────────────────────────
-- TABELA: characters (ficha do personagem)
-- ────────────────────────────────────────────
create table public.characters (
  id              uuid default uuid_generate_v4() primary key,
  user_id         uuid references auth.users(id) on delete cascade not null,
  name            text not null,
  alias           text,
  age             text,
  height          text,
  affiliation     text,
  rank            text,
  specialty       text,
  avatar_url      text,
  avatar_color    text default 'purple',
  bio             text,
  hp              int default 100,
  hp_max          int default 100,
  quirk_charge    int default 100,
  quirk_max       int default 100,
  stamina         int default 100,
  stamina_max     int default 100,
  xp              int default 0,
  xp_max          int default 1000,
  attrs           jsonb default '{"forca":50,"agilidade":50,"controle":50,"resistencia":50,"inteligencia":50,"carisma":50}',
  quirk_data      jsonb default '{"name":"","type":"","subtype":"","level":1,"range":"","weakness":"","dominio":0,"carga":100,"description":"","awakening":"","skills":[]}',
  created_at      timestamptz default now(),
  updated_at      timestamptz default now(),
  unique(user_id)
);

alter table public.characters enable row level security;

create policy "Personagens visíveis para autenticados"
  on public.characters for select
  using (auth.role() = 'authenticated');

create policy "Usuário gerencia próprio personagem"
  on public.characters for all
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────
-- TABELA: items (inventário)
-- ────────────────────────────────────────────
create table public.items (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  name        text not null,
  icon        text default '📦',
  type        text,
  rarity      text default 'C',
  qty         int default 1,
  equipped    boolean default false,
  stats       text,
  description text,
  sort_order  int default 0,
  created_at  timestamptz default now()
);

alter table public.items enable row level security;

create policy "Itens visíveis para autenticados"
  on public.items for select
  using (auth.role() = 'authenticated');

create policy "Usuário gerencia próprios itens"
  on public.items for all
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────
-- TABELA: quests
-- ────────────────────────────────────────────
create table public.quests (
  id          uuid default uuid_generate_v4() primary key,
  user_id     uuid references auth.users(id) on delete cascade not null,
  title       text not null,
  difficulty  text default 'MÉDIO',
  description text,
  rewards     text,
  objectives  jsonb default '[]',
  is_active   boolean default true,
  sort_order  int default 0,
  created_at  timestamptz default now()
);

alter table public.quests enable row level security;

create policy "Missões visíveis para autenticados"
  on public.quests for select
  using (auth.role() = 'authenticated');

create policy "Usuário gerencia próprias missões"
  on public.quests for all
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────
-- TABELA: reputation
-- ────────────────────────────────────────────
create table public.reputation (
  id        uuid default uuid_generate_v4() primary key,
  user_id   uuid references auth.users(id) on delete cascade not null unique,
  civis     int default 0,
  viloes    int default 0,
  missoes   int default 0,
  baixas    int default 0,
  credits   int default 0
);

alter table public.reputation enable row level security;

create policy "Reputação visível para autenticados"
  on public.reputation for select
  using (auth.role() = 'authenticated');

create policy "Usuário gerencia própria reputação"
  on public.reputation for all
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────
-- TABELA: server_config (configuração global, só admins editam)
-- ────────────────────────────────────────────
create table public.server_config (
  id            uuid default uuid_generate_v4() primary key,
  server_name   text default 'Plus Ultra RPG',
  server_badge  text default 'U.A. High · Online',
  scene_name    text default 'Sem cena definida',
  scene_desc    text default 'Configure a cena.',
  scene_tags    text[] default '{}',
  updated_at    timestamptz default now()
);

alter table public.server_config enable row level security;

create policy "Config visível para autenticados"
  on public.server_config for select
  using (auth.role() = 'authenticated');

create policy "Qualquer autenticado pode atualizar config"
  on public.server_config for update
  using (auth.role() = 'authenticated');

create policy "Inserir config inicial"
  on public.server_config for insert
  with check (auth.role() = 'authenticated');

-- Inserir config padrão
insert into public.server_config (server_name) values ('Plus Ultra RPG');

-- ────────────────────────────────────────────
-- TABELA: locations (locais do servidor)
-- ────────────────────────────────────────────
create table public.locations (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  icon        text default '🗺️',
  category    text default 'Geral',
  status      text default 'Livre',
  description text,
  meta        text,
  created_by  uuid references auth.users(id),
  sort_order  int default 0,
  created_at  timestamptz default now()
);

alter table public.locations enable row level security;

create policy "Locais visíveis para autenticados"
  on public.locations for select
  using (auth.role() = 'authenticated');

create policy "Autenticados gerenciam locais"
  on public.locations for all
  using (auth.role() = 'authenticated');

-- ────────────────────────────────────────────
-- TABELA: messages (chat por local)
-- ────────────────────────────────────────────
create table public.messages (
  id           uuid default uuid_generate_v4() primary key,
  location_id  uuid references public.locations(id) on delete cascade,
  user_id      uuid references auth.users(id) on delete cascade not null,
  author_name  text not null,
  author_alias text,
  author_color text default 'purple',
  content      text not null,
  mode         text default 'rp',
  created_at   timestamptz default now()
);

alter table public.messages enable row level security;

create policy "Mensagens visíveis para autenticados"
  on public.messages for select
  using (auth.role() = 'authenticated');

create policy "Autenticados enviam mensagens"
  on public.messages for insert
  with check (auth.uid() = user_id);

create policy "Autor deleta própria mensagem"
  on public.messages for delete
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────
-- TABELA: feed_posts
-- ────────────────────────────────────────────
create table public.feed_posts (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  author_name  text not null,
  author_alias text,
  author_color text default 'purple',
  content      text not null,
  likes        int default 0,
  created_at   timestamptz default now()
);

alter table public.feed_posts enable row level security;

create policy "Posts visíveis para autenticados"
  on public.feed_posts for select
  using (auth.role() = 'authenticated');

create policy "Autenticados criam posts"
  on public.feed_posts for insert
  with check (auth.uid() = user_id);

create policy "Autor gerencia próprio post"
  on public.feed_posts for all
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────
-- TABELA: news (notícias do servidor)
-- ────────────────────────────────────────────
create table public.news (
  id         uuid default uuid_generate_v4() primary key,
  type       text default 'UPDATE',
  title      text not null,
  time_label text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table public.news enable row level security;

create policy "News visíveis para autenticados"
  on public.news for select
  using (auth.role() = 'authenticated');

create policy "Autenticados gerenciam news"
  on public.news for all
  using (auth.role() = 'authenticated');

-- ────────────────────────────────────────────
-- TABELA: events (eventos ativos)
-- ────────────────────────────────────────────
create table public.events (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  description text,
  progress    int default 50,
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now()
);

alter table public.events enable row level security;

create policy "Eventos visíveis para autenticados"
  on public.events for select
  using (auth.role() = 'authenticated');

create policy "Autenticados gerenciam eventos"
  on public.events for all
  using (auth.role() = 'authenticated');

-- ────────────────────────────────────────────
-- TABELA: ranking
-- ────────────────────────────────────────────
create table public.ranking (
  id         uuid default uuid_generate_v4() primary key,
  user_id    uuid references auth.users(id),
  player_name text not null,
  char_name  text,
  quirk_name text,
  rank_badge text,
  color      text default 'blue',
  points     int default 0,
  created_at timestamptz default now()
);

alter table public.ranking enable row level security;

create policy "Ranking visível para autenticados"
  on public.ranking for select
  using (auth.role() = 'authenticated');

create policy "Autenticados gerenciam ranking"
  on public.ranking for all
  using (auth.role() = 'authenticated');

-- ────────────────────────────────────────────
-- TABELA: fighters (arena de batalha)
-- ────────────────────────────────────────────
create table public.fighters (
  id       uuid default uuid_generate_v4() primary key,
  name     text not null,
  role     text default 'hero',
  color    text default 'blue',
  quirk    text,
  hp       int default 100,
  hp_max   int default 100,
  qk       int default 100,
  status   text,
  moves    jsonb default '[]',
  session_id text,
  created_at timestamptz default now()
);

alter table public.fighters enable row level security;

create policy "Fighters visíveis para autenticados"
  on public.fighters for select
  using (auth.role() = 'authenticated');

create policy "Autenticados gerenciam fighters"
  on public.fighters for all
  using (auth.role() = 'authenticated');

-- ────────────────────────────────────────────
-- TABELA: battle_log
-- ────────────────────────────────────────────
create table public.battle_log (
  id         uuid default uuid_generate_v4() primary key,
  html       text not null,
  session_id text,
  created_by uuid references auth.users(id),
  created_at timestamptz default now()
);

alter table public.battle_log enable row level security;

create policy "Battle log visível para autenticados"
  on public.battle_log for select
  using (auth.role() = 'authenticated');

create policy "Autenticados inserem no battle log"
  on public.battle_log for insert
  with check (auth.uid() = created_by);

create policy "Autenticados deletam battle log"
  on public.battle_log for delete
  using (auth.role() = 'authenticated');

-- ────────────────────────────────────────────
-- STORAGE BUCKET para avatares
-- ────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('avatars', 'avatars', true);

create policy "Avatares públicos"
  on storage.objects for select
  using (bucket_id = 'avatars');

create policy "Usuário faz upload do próprio avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.uid() = owner);

create policy "Usuário atualiza próprio avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.uid() = owner);

-- ────────────────────────────────────────────
-- FUNCTION: auto-criar profile após signup
-- ────────────────────────────────────────────
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, email)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    new.email
  );

  insert into public.reputation (user_id)
  values (new.id);

  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ────────────────────────────────────────────
-- FUNCTION: atualizar updated_at automaticamente
-- ────────────────────────────────────────────
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger characters_updated_at
  before update on public.characters
  for each row execute procedure public.set_updated_at();

-- ────────────────────────────────────────────
-- REALTIME: habilitar para tabelas de chat e presença
-- ────────────────────────────────────────────
alter publication supabase_realtime add table public.messages;
alter publication supabase_realtime add table public.profiles;
alter publication supabase_realtime add table public.feed_posts;
alter publication supabase_realtime add table public.battle_log;
alter publication supabase_realtime add table public.fighters;
