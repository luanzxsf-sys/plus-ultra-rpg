-- ═══════════════════════════════════════════════════════════
-- PATCH v5 — Departamento no Ranking de Jogadores
-- ═══════════════════════════════════════════════════════════
-- Rode isso no SQL Editor do Supabase.

alter table public.ranking
  add column if not exists department text default 'heroes';
-- valores esperados: 'heroes' (Heróis) ou 'investigative' (Departamento Investigativo)
