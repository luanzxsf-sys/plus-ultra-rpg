-- ═══════════════════════════════════════════════════════════
-- PATCH v4 — Avatar da ficha/NPC nas mensagens do chat
-- ═══════════════════════════════════════════════════════════
-- Rode isso no SQL Editor do Supabase.

alter table public.messages
  add column if not exists author_avatar_url text;
