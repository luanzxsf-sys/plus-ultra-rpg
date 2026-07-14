-- ═══════════════════════════════════════════════════════════
-- PATCH v6 — Sistema de Trajes
-- ═══════════════════════════════════════════════════════════
-- Rode isso no SQL Editor do Supabase.

alter table public.characters
  add column if not exists equipped_outfit text;
-- guarda a KEY do traje equipado (ex: 'combat', 'stealth') ou null se nenhum
