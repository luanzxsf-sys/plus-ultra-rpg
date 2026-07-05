-- ============================================================
-- PLUS ULTRA RPG — PATCH v3
-- Rode ESTE arquivo por cima do SQL.txt que você já aplicou.
-- É idempotente: pode rodar várias vezes sem quebrar nada.
-- ============================================================

-- ────────────────────────────────────────────────────────────
-- 1. PROFILES — colunas que podem estar faltando
-- ────────────────────────────────────────────────────────────
alter table public.profiles
  add column if not exists theme      text    default 'dark',
  add column if not exists is_online  boolean default false,
  add column if not exists last_seen  timestamptz default now(),
  add column if not exists avatar_url text;

-- ────────────────────────────────────────────────────────────
-- 2. CHARACTERS — colunas de quirk evolution + stamina
-- ────────────────────────────────────────────────────────────
alter table public.characters
  add column if not exists quirk_xp    int  default 0,
  add column if not exists quirk_level int  default 1,
  add column if not exists stamina     int  default 100,
  add column if not exists stamina_max int  default 100,
  add column if not exists specialty   text default '',
  add column if not exists attrs       jsonb default '{"forca":6,"agilidade":6,"controle":6,"resistencia":6,"inteligencia":6,"carisma":6,"stamina":6}';

-- ────────────────────────────────────────────────────────────
-- 3. LOCATIONS — colunas de newsletter
-- ────────────────────────────────────────────────────────────
alter table public.locations
  add column if not exists cover_url      text,
  add column if not exists background_url text,
  add column if not exists is_combat      boolean default false,
  add column if not exists pinned         boolean default false,
  add column if not exists icon           text    default '🗺️',
  add column if not exists category       text    default '',
  add column if not exists status         text    default 'Livre';

-- ────────────────────────────────────────────────────────────
-- 4. NPCS — nível, atributos, quirk type
-- ────────────────────────────────────────────────────────────
create table if not exists public.npcs (
  id           uuid        default uuid_generate_v4() primary key,
  name         text        not null,
  alias        text,
  avatar_url   text,
  avatar_color text        default 'gray',
  description  text,
  role         text        default 'npc',
  quirk_name   text,
  created_by   uuid        references auth.users(id),
  created_at   timestamptz default now()
);

alter table public.npcs
  add column if not exists level       int   default 1,
  add column if not exists attrs       jsonb default '{"forca":6,"agilidade":6,"controle":6,"resistencia":6,"inteligencia":6,"carisma":6,"stamina":6}',
  add column if not exists hp_max      int   default 100,
  add column if not exists quirk_max   int   default 100,
  add column if not exists stamina_max int   default 100,
  add column if not exists quirk_type  text  default '';

alter table public.npcs enable row level security;

drop policy if exists "NPCs visíveis para autenticados"  on public.npcs;
drop policy if exists "Autenticados gerenciam NPCs"       on public.npcs;

create policy "NPCs visíveis para autenticados"
  on public.npcs for select
  using (auth.role() = 'authenticated');

create policy "Autenticados gerenciam NPCs"
  on public.npcs for all
  using (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- 5. MESSAGES — npc_id, image_url, suporte a global (location_id nullable)
-- ────────────────────────────────────────────────────────────
alter table public.messages
  add column if not exists npc_id    uuid references public.npcs(id) on delete set null,
  add column if not exists image_url text;

-- Garante que location_id pode ser null (chat global)
alter table public.messages
  alter column location_id drop not null;

-- ────────────────────────────────────────────────────────────
-- 6. FEED_POSTS — image_url e npc_id
-- ────────────────────────────────────────────────────────────
alter table public.feed_posts
  add column if not exists image_url text,
  add column if not exists npc_id    uuid references public.npcs(id) on delete set null;

-- ────────────────────────────────────────────────────────────
-- 7. QUESTS — campos novos
-- ────────────────────────────────────────────────────────────
alter table public.quests
  add column if not exists location_id    uuid  references public.locations(id) on delete set null,
  add column if not exists assigned_users uuid[] default '{}',
  add column if not exists assigned_npcs  uuid[] default '{}',
  add column if not exists xp_reward      int    default 100,
  add column if not exists mission_type   text   default 'combat',
  add column if not exists completed      boolean default false,
  add column if not exists completed_at   timestamptz;

-- Política para ver missões onde é dono OU vinculado
drop policy if exists "Missões visíveis para autenticados"     on public.quests;
drop policy if exists "Usuário gerencia próprias missões"      on public.quests;
drop policy if exists "Dono ou vinculado gerencia missão"      on public.quests;

create policy "Missões visíveis para autenticados"
  on public.quests for select
  using (auth.role() = 'authenticated');

create policy "Dono ou vinculado gerencia missão"
  on public.quests for all
  using (
    auth.uid() = user_id
    or auth.uid() = any(coalesce(assigned_users, '{}'))
  );

-- ────────────────────────────────────────────────────────────
-- 8. RANKING — coluna user_id para upsert por personagem
-- ────────────────────────────────────────────────────────────
alter table public.ranking
  add column if not exists user_id uuid references auth.users(id);

-- ────────────────────────────────────────────────────────────
-- 9. COMBAT SESSIONS
-- ────────────────────────────────────────────────────────────
create table if not exists public.combat_sessions (
  id           uuid        default uuid_generate_v4() primary key,
  location_id  uuid        references public.locations(id) on delete cascade not null,
  quest_id     uuid        references public.quests(id) on delete set null,
  is_active    boolean     default true,
  turn_order   jsonb       default '[]',
  current_turn int         default 0,
  round        int         default 1,
  created_by   uuid        references auth.users(id),
  created_at   timestamptz default now()
);

alter table public.combat_sessions enable row level security;

drop policy if exists "Combat sessions visíveis para autenticados"  on public.combat_sessions;
drop policy if exists "Autenticados gerenciam combat sessions"       on public.combat_sessions;

create policy "Combat sessions visíveis para autenticados"
  on public.combat_sessions for select
  using (auth.role() = 'authenticated');

create policy "Autenticados gerenciam combat sessions"
  on public.combat_sessions for all
  using (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- 10. COMBATANTS
-- ────────────────────────────────────────────────────────────
create table if not exists public.combatants (
  id             uuid        default uuid_generate_v4() primary key,
  session_id     uuid        references public.combat_sessions(id) on delete cascade not null,
  user_id        uuid        references auth.users(id) on delete cascade,
  npc_id         uuid        references public.npcs(id) on delete cascade,
  character_name text        not null,
  avatar_url     text,
  avatar_color   text        default 'blue',
  hp             int         default 100,
  hp_max         int         default 100,
  quirk_charge   int         default 100,
  quirk_max      int         default 100,
  stamina        int         default 100,
  stamina_max    int         default 100,
  status_effects jsonb       default '[]',
  is_alive       boolean     default true,
  attrs          jsonb       default '{}',
  quirk_data     jsonb       default '{}',
  initiative     int         default 0,
  type           text        default 'player',
  created_at     timestamptz default now()
);

alter table public.combatants enable row level security;

drop policy if exists "Combatants visíveis para autenticados" on public.combatants;
drop policy if exists "Autenticados gerenciam combatants"     on public.combatants;

create policy "Combatants visíveis para autenticados"
  on public.combatants for select
  using (auth.role() = 'authenticated');

create policy "Autenticados gerenciam combatants"
  on public.combatants for all
  using (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- 11. COMBAT ACTIONS — com suporte a pending actions
-- ────────────────────────────────────────────────────────────
create table if not exists public.combat_actions (
  id           uuid        default uuid_generate_v4() primary key,
  session_id   uuid        references public.combat_sessions(id) on delete cascade not null,
  actor_id     uuid,
  actor_name   text        not null,
  target_id    uuid,
  target_name  text,
  action_type  text        not null,
  skill_name   text,
  roll_result  int,
  value        int         default 0,
  description  text,
  -- Pending action fields (sistema de resposta)
  is_pending   boolean     default false,
  pending_for  uuid[],               -- user_ids que precisam responder
  difficulty   text        default 'medium',
  attr_check   text,                 -- atributo exigido (ex: 'agilidade' para desvio)
  resolved     boolean     default false,
  created_at   timestamptz default now()
);

alter table public.combat_actions enable row level security;

drop policy if exists "Combat actions visíveis para autenticados"  on public.combat_actions;
drop policy if exists "Autenticados inserem combat actions"         on public.combat_actions;
drop policy if exists "Autenticados deletam combat actions"         on public.combat_actions;
drop policy if exists "Autenticados atualizam combat actions"       on public.combat_actions;

create policy "Combat actions visíveis para autenticados"
  on public.combat_actions for select
  using (auth.role() = 'authenticated');

create policy "Autenticados inserem combat actions"
  on public.combat_actions for insert
  with check (auth.role() = 'authenticated');

create policy "Autenticados atualizam combat actions"
  on public.combat_actions for update
  using (auth.role() = 'authenticated');

create policy "Autenticados deletam combat actions"
  on public.combat_actions for delete
  using (auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- 12. TRAITS + CHARACTER_TRAITS
-- ────────────────────────────────────────────────────────────
create table if not exists public.traits (
  id          uuid        default uuid_generate_v4() primary key,
  name        text        not null,
  description text,
  icon        text        default '⭐',
  rank        text        default 'C',
  type        text        default 'passive',
  effect      jsonb       default '{}',
  is_preset   boolean     default true,
  created_by  uuid        references auth.users(id),
  created_at  timestamptz default now()
);

alter table public.traits enable row level security;

drop policy if exists "Traits visíveis para autenticados" on public.traits;
drop policy if exists "Autenticados gerenciam traits"     on public.traits;

create policy "Traits visíveis para autenticados"
  on public.traits for select
  using (auth.role() = 'authenticated');

create policy "Autenticados gerenciam traits"
  on public.traits for all
  using (auth.role() = 'authenticated');

create table if not exists public.character_traits (
  id           uuid        default uuid_generate_v4() primary key,
  user_id      uuid        references auth.users(id) on delete cascade not null,
  trait_id     uuid        references public.traits(id) on delete cascade not null,
  acquired_at  timestamptz default now(),
  unique(user_id, trait_id)
);

alter table public.character_traits enable row level security;

drop policy if exists "Character traits visíveis para autenticados" on public.character_traits;
drop policy if exists "Usuário gerencia próprios traits"            on public.character_traits;

create policy "Character traits visíveis para autenticados"
  on public.character_traits for select
  using (auth.role() = 'authenticated');

create policy "Usuário gerencia próprios traits"
  on public.character_traits for all
  using (auth.uid() = user_id);

-- ────────────────────────────────────────────────────────────
-- 13. TRAITS seed — 16 pré-definidos (idempotente)
-- ────────────────────────────────────────────────────────────
insert into public.traits (name, description, icon, rank, type, effect, is_preset) values
  ('Força Bruta',        'Ataque físico +15 de dano base',               '💪', 'C',   'combat',      '{"dmg_bonus":15}',                        true),
  ('Corpo de Aço',       'Reduz dano físico recebido em 10%',             '🛡️','C',   'passive',     '{"dmg_reduce":10}',                       true),
  ('Velocidade Extrema', 'Iniciativa +3 e esquiva +10%',                  '⚡', 'B',   'passive',     '{"initiative":3,"dodge":10}',             true),
  ('Mente Analítica',    'Percebe fraquezas no 1º turno. +5 Inteligência','🔍', 'B',   'passive',     '{"attr":"inteligencia","bonus":5,"reveal_weakness":true}', true),
  ('Aura Heroica',       'Aliados próximos +5 em todos os atributos',     '✨', 'A',   'passive',     '{"ally_bonus":5}',                        true),
  ('Resistência Mental', 'Imune a medo. +50% resistência a ataques mentais','🧠','A', 'passive',     '{"immune_fear":true,"mental_res":50}',    true),
  ('Instinto de Luta',   '+20% dano quando HP < 30%',                     '🔥', 'B',   'combat',      '{"low_hp_bonus":20,"threshold":30}',      true),
  ('Especialista Quirk', 'Custo de Quirk -15% em todas as técnicas',      '✦',  'A',   'quirk_boost', '{"quirk_cost_reduce":15}',                true),
  ('Regeneração',        'Recupera 5 HP por turno passivamente',          '🌿', 'S',   'passive',     '{"hp_regen":5}',                          true),
  ('Olhos de Águia',     '+5 Agilidade e +25% precisão à distância',      '👁️','C',   'combat',      '{"attr":"agilidade","bonus":5,"ranged_acc":25}', true),
  ('Presença Heroica',   'Bônus de Carisma +5. Civis +30% moral',         '🦸', 'B',   'passive',     '{"attr":"carisma","bonus":5,"civilian_moral":30}', true),
  ('Golpe Crítico',      '15% de chance de causar dano dobrado',          '💥', 'B',   'combat',      '{"crit_chance":15}',                      true),
  ('Armadura Natural',   '+5 Resistência por conta do corpo do personagem','🦴','C',   'passive',     '{"attr":"resistencia","bonus":5}',         true),
  ('Faro de Herói',      'Detecta inimigos ocultos automaticamente',      '👃', 'B',   'passive',     '{"detect_hidden":true}',                  true),
  ('Berserker',          'ATK +30% mas DEF -20% quando enraivecido',      '😤', 'A',   'combat',      '{"atk_bonus":30,"def_reduce":20}',        true),
  ('Suporte Tático',     'Ao curar aliado, +10% ATK por 1 turno',         '💊', 'B',   'active',      '{"heal_atk_bonus":10}',                   true)
on conflict do nothing;

-- ────────────────────────────────────────────────────────────
-- 14. STORAGE BUCKETS
-- ────────────────────────────────────────────────────────────
insert into storage.buckets (id, name, public)
  values ('avatars',   'avatars',   true) on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('locations', 'locations', true) on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('npcs',      'npcs',      true) on conflict (id) do nothing;

insert into storage.buckets (id, name, public)
  values ('posts',     'posts',     true) on conflict (id) do nothing;

-- Storage policies (drop + create para garantir)
drop policy if exists "Avatars públicos leitura"              on storage.objects;
drop policy if exists "Autenticados sobem avatar"             on storage.objects;
drop policy if exists "Autenticados atualizam avatar"         on storage.objects;
drop policy if exists "Locations bucket públicas leitura"     on storage.objects;
drop policy if exists "Autenticados sobem imagem de local"    on storage.objects;
drop policy if exists "Autenticados atualizam imagem de local" on storage.objects;
drop policy if exists "NPCs bucket públicas leitura"          on storage.objects;
drop policy if exists "Autenticados sobem imagem de NPC"      on storage.objects;
drop policy if exists "Posts bucket públicas leitura"         on storage.objects;
drop policy if exists "Autenticados sobem imagem de post"     on storage.objects;

create policy "Avatars públicos leitura"
  on storage.objects for select using (bucket_id = 'avatars');

create policy "Autenticados sobem avatar"
  on storage.objects for insert
  with check (bucket_id = 'avatars' and auth.role() = 'authenticated');

create policy "Autenticados atualizam avatar"
  on storage.objects for update
  using (bucket_id = 'avatars' and auth.role() = 'authenticated');

create policy "Locations bucket públicas leitura"
  on storage.objects for select using (bucket_id = 'locations');

create policy "Autenticados sobem imagem de local"
  on storage.objects for insert
  with check (bucket_id = 'locations' and auth.role() = 'authenticated');

create policy "Autenticados atualizam imagem de local"
  on storage.objects for update
  using (bucket_id = 'locations' and auth.role() = 'authenticated');

create policy "NPCs bucket públicas leitura"
  on storage.objects for select using (bucket_id = 'npcs');

create policy "Autenticados sobem imagem de NPC"
  on storage.objects for insert
  with check (bucket_id = 'npcs' and auth.role() = 'authenticated');

create policy "Posts bucket públicas leitura"
  on storage.objects for select using (bucket_id = 'posts');

create policy "Autenticados sobem imagem de post"
  on storage.objects for insert
  with check (bucket_id = 'posts' and auth.role() = 'authenticated');

-- ────────────────────────────────────────────────────────────
-- 15. FUNCTIONS & TRIGGERS — substitui versões antigas
-- ────────────────────────────────────────────────────────────

-- Handle new user: cria profile + personagem vazio + reputação
create or replace function public.handle_new_user()
returns trigger as $$
begin
  insert into public.profiles (id, username, is_online)
  values (
    new.id,
    coalesce(new.raw_user_meta_data->>'username', split_part(new.email, '@', 1)),
    false
  )
  on conflict (id) do nothing;

  insert into public.characters (
    user_id, name, alias, affiliation, rank, specialty, bio,
    avatar_color, avatar_url, attrs,
    hp, hp_max, quirk_charge, quirk_max, stamina, stamina_max,
    xp, xp_max, quirk_level, quirk_xp,
    quirk_data
  )
  values (
    new.id, '', '', '', '', '', '',
    'purple', null,
    '{"forca":6,"agilidade":6,"controle":6,"resistencia":6,"inteligencia":6,"carisma":6,"stamina":6}',
    100, 100, 100, 100, 100, 100,
    0, 1000, 1, 0,
    '{"name":"","type":"","subtype":"","level":1,"range":"","weakness":"","dominio":0,"carga":100,"description":"","awakening":"","skills":[]}'
  )
  on conflict (user_id) do nothing;

  insert into public.reputation (user_id, civis, viloes, missoes, baixas)
  values (new.id, 0, 0, 0, 0)
  on conflict (user_id) do nothing;

  return new;
end;
$$ language plpgsql security definer;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- updated_at automático
create or replace function public.set_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

-- XP ao concluir missão (distribui para todos vinculados)
create or replace function public.apply_quest_xp()
returns trigger as $$
declare
  uid uuid;
begin
  if new.completed = true and (old.completed is distinct from true) then
    -- Owner
    update public.characters
      set xp = xp + new.xp_reward
      where user_id = new.user_id;
    -- Assigned users
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

-- Level up automático ao ganhar XP
create or replace function public.handle_character_levelup()
returns trigger as $$
begin
  while new.xp >= new.xp_max loop
    new.xp     := new.xp - new.xp_max;
    new.xp_max := round(new.xp_max * 1.25);
    -- A cada 2 level-ups, o Quirk sobe 1 nível
    new.quirk_xp := coalesce(new.quirk_xp, 0) + 1;
    if new.quirk_xp >= 2 then
      new.quirk_xp   := 0;
      new.quirk_level := coalesce(new.quirk_level, 1) + 1;
    end if;
  end loop;
  return new;
end;
$$ language plpgsql;

drop trigger if exists character_levelup on public.characters;
create trigger character_levelup
  before update of xp on public.characters
  for each row execute procedure public.handle_character_levelup();

-- ────────────────────────────────────────────────────────────
-- 16. SERVER CONFIG — garante linha inicial se não existir
-- ────────────────────────────────────────────────────────────
insert into public.server_config (server_name, scene_name, scene_desc, scene_tags)
values ('Plus Ultra RPG', 'Aguardando cena', 'Nenhuma cena ativa.', '{}')
on conflict do nothing;

-- ────────────────────────────────────────────────────────────
-- FIM DO PATCH v3 — tudo pronto!
-- ────────────────────────────────────────────────────────────

-- ── PATCH v3 ADDENDUM: traits revisados F→S sem repetição ──
truncate public.traits restart identity cascade;

insert into public.traits (name, description, icon, rank, type, effect, is_preset) values
-- F rank: bônus mínimos
('Punhos Rígidos',    'Pequena melhora no poder físico bruto.',           '👊','F','combat',  '{"attr":"forca","bonus":2}',                     true),
('Pés Ligeiros',      'Levemente mais veloz que o normal.',               '🏃','F','passive', '{"attr":"agilidade","bonus":2}',                 true),
('Pele Grossa',       'Resistência física levemente aumentada.',          '🦴','F','passive', '{"attr":"resistencia","bonus":2}',               true),
('Mente Focada',      'Concentração acima da média.',                     '💭','F','passive', '{"attr":"inteligencia","bonus":2}',              true),
-- E rank
('Voz de Comando',    'Carisma aprimorado em situações de liderança.',    '📢','E','passive', '{"attr":"carisma","bonus":4}',                   true),
('Nervos de Aço',     'Stamina levemente superior.',                      '⚙️','E','passive', '{"attr":"stamina","bonus":4}',                  true),
('Olhar Afiado',      'Percepção aguçada. +4 Inteligência.',              '👁️','E','passive', '{"attr":"inteligencia","bonus":4}',             true),
-- D rank
('Músculos Treinados','Treinamento físico intenso. +5 Força.',            '💪','D','combat',  '{"attr":"forca","bonus":5}',                     true),
('Esquiva Ágil',      'Reflexos aprimorados. +5 Agilidade.',             '💨','D','passive', '{"attr":"agilidade","bonus":5}',                 true),
('Corpo Endurecido',  'Resistência elevada. +5 Resistência.',            '🛡️','D','passive', '{"attr":"resistencia","bonus":5}',              true),
('Controle Apurado',  'Domínio do Quirk melhorado. +5 Controle.',        '🎯','D','passive', '{"attr":"controle","bonus":5}',                  true),
-- C rank
('Fúria de Combate',  '+8 Força. Dano extra quando HP < 40%.',           '🔥','C','combat',  '{"attr":"forca","bonus":8,"low_hp_bonus":20,"threshold":40}', true),
('Velocidade Extrema','+8 Agilidade. Esquiva +10%.',                     '⚡','C','passive', '{"attr":"agilidade","bonus":8,"dodge":10}',      true),
('Muralha Viva',      '+8 Resistência. Reduz 10% dano físico.',          '🏰','C','passive', '{"attr":"resistencia","bonus":8,"dmg_reduce":10}',true),
('Estrategista',      '+8 Inteligência. Revela fraquezas no 1º turno.', '🧠','C','passive', '{"attr":"inteligencia","bonus":8,"reveal_weakness":true}', true),
('Quirk Potente',     '+8 Controle. Custo Quirk -10%.',                 '✦', 'C','quirk_boost','{"attr":"controle","bonus":8,"quirk_cost_reduce":10}', true),
-- B rank
('Campeão de Stamina','+12 Stamina. Regen +3 HP/turno.',                '🌿','B','passive', '{"attr":"stamina","bonus":12,"hp_regen":3}',      true),
('Mestre do Combate', '+10 Força e +5 Agilidade.',                      '⚔️','B','combat',  '{"attr":"forca","bonus":10,"attr2":"agilidade","bonus2":5}', true),
('Pele de Aço',       '+12 Resistência. Reduz 15% dano.',               '🦾','B','passive', '{"attr":"resistencia","bonus":12,"dmg_reduce":15}',true),
('Líder Nato',        '+12 Carisma. Cura concedida +30%.',              '🦸','B','passive', '{"attr":"carisma","bonus":12,"heal_atk_bonus":30}',true),
('Mente Genial',      '+12 Inteligência. Investiga duas pistas por ação.','💡','B','passive', '{"attr":"inteligencia","bonus":12}',             true),
-- A rank
('Herói Nato',        '+15 em todos os atributos vitais.',              '🌟','A','passive', '{"attr":"forca","bonus":8,"attr2":"resistencia","bonus2":8}', true),
('Golpe Definitivo',  '+15 Força. 20% de chance de crítico (×2).',     '💥','A','combat',  '{"attr":"forca","bonus":15,"crit_chance":20}',    true),
('Regeneração',       '+10 Resistência. Recupera 8 HP por turno.',      '💊','A','passive', '{"attr":"resistencia","bonus":10,"hp_regen":8}',  true),
-- S rank: bônus excepcionais
('Lenda Viva',        '+20 Força. Ataques ignoram 20% da defesa.',      '👑','S','combat',  '{"attr":"forca","bonus":20,"dmg_bonus":20}',      true),
('Corpo Divino',      '+20 Resistência. Imune a efeitos de status.',    '⭐','S','passive', '{"attr":"resistencia","bonus":20,"dmg_reduce":25}',true),
('Quirk Supremo',     '+20 Controle. Custo Quirk -25%.',               '✨','S','quirk_boost','{"attr":"controle","bonus":20,"quirk_cost_reduce":25}', true)
on conflict do nothing;

-- ── PATCH v3.1: remove quirk auto-level from levelup trigger ──
-- Quirk XP agora é ganho pelo uso de técnicas (no frontend)
-- O trigger só deve subir XP do personagem, não mexer no quirk_level
CREATE OR REPLACE FUNCTION public.handle_character_levelup()
RETURNS trigger AS $$
BEGIN
  WHILE new.xp >= new.xp_max LOOP
    new.xp     := new.xp - new.xp_max;
    new.xp_max := ROUND(new.xp_max * 1.25);
    -- Bonus de atributos por nível: +5 pontos por nível (aplicado via frontend)
    -- NÃO mexe mais em quirk_xp nem quirk_level aqui
  END LOOP;
  RETURN new;
END;
$$ LANGUAGE plpgsql;

-- Garante que quirk_xp existe na tabela characters
ALTER TABLE public.characters
  ADD COLUMN IF NOT EXISTS quirk_xp int DEFAULT 0;

-- ── Sistema de XP de Quirk por uso de técnicas ──
-- Thresholds: Iniciante=0, Intermediário=100, Avançado=300, Mestre=700, Despertado=1500
-- O frontend calcula e atualiza quirk_xp e quirk_level diretamente via addQuirkXp()
