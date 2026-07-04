-- ============================================================
-- PLUS ULTRA RPG — Migração v2
-- Rode este arquivo DEPOIS do supabase-schema.sql original
-- (no SQL Editor do Supabase, em um projeto que já tem o schema v1)
-- ============================================================

-- ────────────────────────────────────────────
-- 1) PROFILES — tema visual do usuário
-- ────────────────────────────────────────────
alter table public.profiles
  add column if not exists theme text default 'dark'; -- 'dark' | 'blue' | 'light'

-- ────────────────────────────────────────────
-- 2) CHARACTERS — sistema de XP por quirk / bônus
-- ────────────────────────────────────────────
alter table public.characters
  add column if not exists quirk_xp     int default 0,   -- xp específico do quirk (evolução)
  add column if not exists quirk_level  int default 1;   -- nível do quirk (separado do level geral)

-- quirk_data (jsonb) passa a poder conter também:
-- { ..., "quirkTypeBonus": {"atributo":"agilidade","bonus":10}, "evolutions":[{"level":2,"unlock":"Nome da técnica"}] }
-- Isso é tratado inteiramente no front-end, não precisa de coluna nova.

-- ────────────────────────────────────────────
-- 3) LOCATIONS — capa, fundo com blur, vira "post" de newsletter
-- ────────────────────────────────────────────
alter table public.locations
  add column if not exists cover_url     text,   -- imagem de capa (banner)
  add column if not exists background_url text,  -- imagem de fundo do chat (com blur)
  add column if not exists is_combat     boolean default false, -- marca se é local de combate ativo
  add column if not exists pinned        boolean default false; -- destaque no topo da newsletter

-- ────────────────────────────────────────────
-- 4) NPCs — narradores podem "vestir" um NPC ao mandar mensagem
-- ────────────────────────────────────────────
create table if not exists public.npcs (
  id           uuid default uuid_generate_v4() primary key,
  name         text not null,
  alias        text,
  avatar_url   text,
  avatar_color text default 'gray',
  description  text,
  role         text default 'npc',   -- npc | villain | hero_npc
  quirk_name   text,
  created_by   uuid references auth.users(id),
  created_at   timestamptz default now()
);

alter table public.npcs enable row level security;

create policy "NPCs visíveis para autenticados"
  on public.npcs for select
  using (auth.role() = 'authenticated');

create policy "Autenticados gerenciam NPCs"
  on public.npcs for all
  using (auth.role() = 'authenticated');

-- ────────────────────────────────────────────
-- 5) MESSAGES — permitir falar como NPC + imagens
-- ────────────────────────────────────────────
alter table public.messages
  add column if not exists npc_id    uuid references public.npcs(id) on delete set null,
  add column if not exists image_url text;

-- ────────────────────────────────────────────
-- 6) FEED_POSTS — newsletter de NPCs/locais aceita imagem
-- ────────────────────────────────────────────
alter table public.feed_posts
  add column if not exists image_url text,
  add column if not exists npc_id    uuid references public.npcs(id) on delete set null;

-- ────────────────────────────────────────────
-- 7) QUESTS — vincular jogadores e local; dificuldade gera XP
-- ────────────────────────────────────────────
alter table public.quests
  add column if not exists location_id     uuid references public.locations(id) on delete set null,
  add column if not exists assigned_users  uuid[] default '{}',  -- array de user_id vinculados
  add column if not exists xp_reward       int default 100,
  add column if not exists completed       boolean default false,
  add column if not exists completed_at    timestamptz;

-- Missões deixam de ser só "do dono" — qualquer vinculado pode ver/marcar.
-- Ajusta política de select para incluir vinculados.
drop policy if exists "Missões visíveis para autenticados" on public.quests;
create policy "Missões visíveis para autenticados"
  on public.quests for select
  using (auth.role() = 'authenticated');

drop policy if exists "Usuário gerencia próprias missões" on public.quests;
create policy "Dono ou vinculado gerencia missão"
  on public.quests for all
  using (auth.uid() = user_id or auth.uid() = any(assigned_users));

-- ────────────────────────────────────────────
-- 8) FUNCTION: aplicar XP ao personagem quando missão é concluída
-- ────────────────────────────────────────────
create or replace function public.apply_quest_xp()
returns trigger as $$
declare
  uid uuid;
begin
  if new.completed = true and (old.completed is distinct from true) then
    -- dono
    update public.characters
      set xp = xp + new.xp_reward
      where user_id = new.user_id;
    -- vinculados
    if new.assigned_users is not null then
      foreach uid in array new.assigned_users loop
        update public.characters
          set xp = xp + new.xp_reward
          where user_id = uid;
      end loop;
    end if;
    new.completed_at = now();
  end if;
  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists quest_completed_xp on public.quests;
create trigger quest_completed_xp
  before update on public.quests
  for each row execute procedure public.apply_quest_xp();

-- ────────────────────────────────────────────
-- 9) FUNCTION: subir de nível automaticamente quando XP passa do máximo
-- ────────────────────────────────────────────
create or replace function public.handle_character_levelup()
returns trigger as $$
begin
  while new.xp >= new.xp_max loop
    new.xp := new.xp - new.xp_max;
    new.xp_max := round(new.xp_max * 1.25);
    -- também evolui o quirk_level a cada 2 level-ups de personagem
    new.quirk_xp := new.quirk_xp + 1;
    if new.quirk_xp >= 3 then
      new.quirk_xp := 0;
      new.quirk_level := new.quirk_level + 1;
    end if;
  end loop;
  return new;
end;
$$ language plpgsql;

drop trigger if exists character_levelup on public.characters;
create trigger character_levelup
  before update of xp on public.characters
  for each row execute procedure public.handle_character_levelup();

-- ────────────────────────────────────────────
-- 10) REMOVER sistema de Arena (luta agora acontece dentro dos locais)
-- ────────────────────────────────────────────
drop table if exists public.battle_log cascade;
drop table if exists public.fighters cascade;

-- ────────────────────────────────────────────
-- 11) STORAGE BUCKETS adicionais — capas, fundos, npcs, posts
-- ────────────────────────────────────────────
insert into storage.buckets (id, name, public)
values ('locations', 'locations', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('npcs', 'npcs', true)
on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
values ('posts', 'posts', true)
on conflict (id) do nothing;

create policy "Locations bucket públicas leitura"
  on storage.objects for select
  using (bucket_id = 'locations');

create policy "Autenticados sobem imagem de local"
  on storage.objects for insert
  with check (bucket_id = 'locations' and auth.role() = 'authenticated');

create policy "Autenticados atualizam imagem de local"
  on storage.objects for update
  using (bucket_id = 'locations' and auth.role() = 'authenticated');

create policy "NPCs bucket públicas leitura"
  on storage.objects for select
  using (bucket_id = 'npcs');

create policy "Autenticados sobem imagem de NPC"
  on storage.objects for insert
  with check (bucket_id = 'npcs' and auth.role() = 'authenticated');

create policy "Autenticados atualizam imagem de NPC"
  on storage.objects for update
  using (bucket_id = 'npcs' and auth.role() = 'authenticated');

create policy "Posts bucket públicas leitura"
  on storage.objects for select
  using (bucket_id = 'posts');

create policy "Autenticados sobem imagem de post"
  on storage.objects for insert
  with check (bucket_id = 'posts' and auth.role() = 'authenticated');

-- ────────────────────────────────────────────
-- 12) REALTIME para npcs e quests (já existentes ganham updates ao vivo)
-- ────────────────────────────────────────────
alter publication supabase_realtime add table public.npcs;
alter publication supabase_realtime add table public.quests;
alter publication supabase_realtime add table public.locations;

-- ============================================================
-- FIM DA MIGRAÇÃO
-- ============================================================

-- ─────────────────────────────────────────────────
-- COMBAT SYSTEM (dentro dos locais)
-- ─────────────────────────────────────────────────

-- Sessão de combate vinculada a um local
create table if not exists public.combat_sessions (
  id           uuid default uuid_generate_v4() primary key,
  location_id  uuid references public.locations(id) on delete cascade not null,
  quest_id     uuid references public.quests(id) on delete set null,
  is_active    boolean default true,
  turn_order   jsonb default '[]',   -- [{id, name, type, initiative}]
  current_turn int default 0,
  round        int default 1,
  created_by   uuid references auth.users(id),
  created_at   timestamptz default now()
);

alter table public.combat_sessions enable row level security;
create policy "Combat sessions visíveis para autenticados"
  on public.combat_sessions for select using (auth.role() = 'authenticated');
create policy "Autenticados gerenciam combat sessions"
  on public.combat_sessions for all using (auth.role() = 'authenticated');

-- Combatentes da sessão (jogadores E NPCs)
create table if not exists public.combatants (
  id              uuid default uuid_generate_v4() primary key,
  session_id      uuid references public.combat_sessions(id) on delete cascade not null,
  -- se for jogador
  user_id         uuid references auth.users(id) on delete cascade,
  character_name  text not null,
  avatar_url      text,
  avatar_color    text default 'blue',
  -- se for NPC
  npc_id          uuid references public.npcs(id) on delete cascade,
  -- stats de combate (snapshot da ficha no início, atualizado durante)
  hp              int default 100,
  hp_max          int default 100,
  quirk_charge    int default 100,
  quirk_max       int default 100,
  stamina         int default 100,
  stamina_max     int default 100,
  status_effects  jsonb default '[]',  -- [{name, duration, icon}]
  is_alive        boolean default true,
  attrs           jsonb default '{}',
  quirk_data      jsonb default '{}',
  initiative      int default 0,
  type            text default 'player',  -- player | npc | villain
  created_at      timestamptz default now()
);

alter table public.combatants enable row level security;
create policy "Combatants visíveis para autenticados"
  on public.combatants for select using (auth.role() = 'authenticated');
create policy "Autenticados gerenciam combatants"
  on public.combatants for all using (auth.role() = 'authenticated');

-- Log de ações de combate (separado do chat geral)
create table if not exists public.combat_actions (
  id           uuid default uuid_generate_v4() primary key,
  session_id   uuid references public.combat_sessions(id) on delete cascade not null,
  actor_id     uuid,           -- combatant id de quem agiu
  actor_name   text not null,
  target_id    uuid,           -- combatant id do alvo
  target_name  text,
  action_type  text not null,  -- attack | skill | heal | item | defend | flee | system
  skill_name   text,
  roll_result  int,
  value        int default 0,  -- dano ou cura (positivo = cura, negativo = dano)
  description  text,
  created_at   timestamptz default now()
);

alter table public.combat_actions enable row level security;
create policy "Combat actions visíveis para autenticados"
  on public.combat_actions for select using (auth.role() = 'authenticated');
create policy "Autenticados inserem combat actions"
  on public.combat_actions for insert with check (auth.role() = 'authenticated');
create policy "Autenticados deletam combat actions"
  on public.combat_actions for delete using (auth.role() = 'authenticated');

-- Realtime para combate ao vivo
alter publication supabase_realtime add table public.combat_sessions;
alter publication supabase_realtime add table public.combatants;
alter publication supabase_realtime add table public.combat_actions;

-- ─────────────────────────────────────────────────
-- TRAITS (características pré-definidas e customizadas)
-- ─────────────────────────────────────────────────

create table if not exists public.traits (
  id          uuid default uuid_generate_v4() primary key,
  name        text not null,
  description text,
  icon        text default '⭐',
  rank        text default 'C',        -- E D C B A S
  type        text default 'passive',  -- passive | active | quirk_boost | combat
  effect      jsonb default '{}',      -- {attr: 'forca', bonus: 5} etc
  is_preset   boolean default true,    -- true = veio do servidor, false = criado por usuário
  created_by  uuid references auth.users(id),
  created_at  timestamptz default now()
);

alter table public.traits enable row level security;
create policy "Traits visíveis para autenticados"
  on public.traits for select using (auth.role() = 'authenticated');
create policy "Autenticados gerenciam traits"
  on public.traits for all using (auth.role() = 'authenticated');

-- Traits vinculados ao personagem
create table if not exists public.character_traits (
  id           uuid default uuid_generate_v4() primary key,
  user_id      uuid references auth.users(id) on delete cascade not null,
  trait_id     uuid references public.traits(id) on delete cascade not null,
  rank_upgrade text,   -- pode ser upgradado (B→A etc)
  acquired_at  timestamptz default now(),
  unique(user_id, trait_id)
);

alter table public.character_traits enable row level security;
create policy "Character traits visíveis para autenticados"
  on public.character_traits for select using (auth.role() = 'authenticated');
create policy "Usuário gerencia próprios traits"
  on public.character_traits for all using (auth.uid() = user_id);

-- Seed de traits pré-definidos
insert into public.traits (name, description, icon, rank, type, effect, is_preset) values
  ('Força Bruta',       'Ataque físico +15% de dano',                  '💪', 'C', 'passive',     '{"attr":"forca","dmg_bonus":15}',         true),
  ('Corpo de Aço',      'Reduz dano físico recebido em 10%',            '🛡️', 'C', 'passive',     '{"dmg_reduce":10}',                       true),
  ('Velocidade Extrema','Iniciativa +3 e esquiva +10%',                 '⚡', 'B', 'passive',     '{"initiative":3,"dodge":10}',             true),
  ('Mente Analítica',   'Percebe fraquezas do inimigo no 1º turno',     '🔍', 'B', 'passive',     '{"reveal_weakness":true}',                true),
  ('Aura Heroica',      'Aliados próximos +5% em todos atributos',      '✨', 'A', 'passive',     '{"ally_bonus":5}',                        true),
  ('Resistência Mental','Imune a medo e pânico. +50% vs ataques mentais','🧠', 'A', 'passive',     '{"immune_fear":true,"mental_res":50}',    true),
  ('Instinto de Luta',  '+20% de dano quando HP < 30%',                 '🔥', 'B', 'combat',      '{"low_hp_bonus":20,"threshold":30}',      true),
  ('Especialista Quirk','Custo de Quirk -15% em todas as técnicas',     '✦',  'A', 'quirk_boost', '{"quirk_cost_reduce":15}',                true),
  ('Regeneração',       'Recupera 5 HP por turno passivamente',         '🌿', 'S', 'passive',     '{"hp_regen":5}',                          true),
  ('Olhos de Águia',    '+25% de precisão em ataques à distância',      '👁️', 'C', 'combat',      '{"ranged_acc":25}',                       true),
  ('Presença Heroica',  'Civis ao redor +30% moral. Bônus de Carisma',  '🦸', 'B', 'passive',     '{"civilian_moral":30}',                   true),
  ('Golpe Crítico',     '15% de chance de causar dano dobrado',         '💥', 'B', 'combat',      '{"crit_chance":15}',                      true),
  ('Armadura Natural',  'DEF base +10 por conta do corpo do personagem','🦴', 'C', 'passive',     '{"def_bonus":10}',                        true),
  ('Faro de Herói',     'Detecta inimigos ocultos automaticamente',     '👃', 'B', 'passive',     '{"detect_hidden":true}',                  true),
  ('Berserker',         'ATK +30% mas DEF -20% quando enraivecido',     '😤', 'A', 'combat',      '{"atk_bonus":30,"def_reduce":20}',        true),
  ('Suporte Tático',    'Ao curar aliado, concede +10% ATK por 1 turno','💊', 'B', 'active',      '{"heal_atk_bonus":10}',                   true)
on conflict do nothing;

-- ── QUESTS: adiciona campos de tipo de missão e NPCs vinculados ──
alter table public.quests
  add column if not exists mission_type   text    default 'combat',
  add column if not exists assigned_npcs  uuid[]  default '{}';

-- ── NPCs: adiciona campos de nível e atributos ──
alter table public.npcs
  add column if not exists level       int   default 1,

-- ── QUESTS: adiciona campos de tipo de missão e NPCs vinculados ──
alter table public.quests
  add column if not exists mission_type   text   default 'combat',
  add column if not exists assigned_npcs  uuid[] default '{}';

-- ── NPCs: adiciona campos de nível e atributos ──
alter table public.npcs
  add column if not exists level       int   default 1,
  add column if not exists attrs       jsonb default '{"forca":6,"agilidade":6,"controle":6,"resistencia":6,"inteligencia":6,"carisma":6,"stamina":6}',
  add column if not exists hp_max      int   default 100,
  add column if not exists quirk_max   int   default 100,
  add column if not exists stamina_max int   default 100,
  add column if not exists quirk_type  text  default '';

-- ── PROFILES: tema visual ──
alter table public.profiles
  add column if not exists theme text default 'dark';
