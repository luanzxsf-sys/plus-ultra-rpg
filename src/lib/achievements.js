// ── CONQUISTAS / MEDALHAS ──────────────────────────────────
// Calculadas ao vivo a partir da ficha do personagem — sem tabela nova,
// sem sincronização. Sempre refletem o estado atual.

export const ACHIEVEMENTS = [
  { id:'first_steps',   icon:'🎓', label:'Primeiros Passos',   desc:'Criou sua ficha de herói',              check:c => !!c.char?.name },
  { id:'quirk_set',     icon:'✨', label:'Manifestação',       desc:'Definiu sua Quirk',                     check:c => !!c.char?.quirk_data?.name },
  { id:'lvl5',          icon:'⭐', label:'Herói Novato',       desc:'Alcançou o nível 5',                    check:c => (c.level||0) >= 5 },
  { id:'lvl10',         icon:'🌟', label:'Herói Experiente',   desc:'Alcançou o nível 10',                   check:c => (c.level||0) >= 10 },
  { id:'lvl20',         icon:'💫', label:'Herói Lendário',     desc:'Alcançou o nível 20',                   check:c => (c.level||0) >= 20 },
  { id:'lvl30',         icon:'👑', label:'Símbolo da Paz',     desc:'Alcançou o nível 30',                   check:c => (c.level||0) >= 30 },
  { id:'quirk_lvl3',    icon:'🔥', label:'Domínio Crescente',  desc:'Quirk atingiu nível de evolução 3',     check:c => (c.char?.quirk_level||0) >= 3 },
  { id:'quirk_awaken',  icon:'💥', label:'Despertar',          desc:'Quirk atingiu o nível máximo',          check:c => (c.char?.quirk_level||0) >= 5 },
  { id:'first_skill',   icon:'🥋', label:'Primeira Técnica',   desc:'Cadastrou sua primeira técnica',        check:c => (c.char?.quirk_data?.skills?.length||0) >= 1 },
  { id:'skill_master',  icon:'🎯', label:'Arsenal Completo',   desc:'Cadastrou 5 ou mais técnicas',          check:c => (c.char?.quirk_data?.skills?.length||0) >= 5 },
  { id:'balanced',      icon:'⚖️', label:'Equilíbrio Total',   desc:'Todos os atributos em 15 ou mais',      check:c => c.char?.attrs && Object.values(c.char.attrs).every(v => (v||0) >= 15) },
  { id:'specialist',    icon:'🧭', label:'Especialista',       desc:'Escolheu uma especialidade',            check:c => !!c.char?.specialty },
  { id:'affiliated',    icon:'🏢', label:'Vínculo Profissional', desc:'Definiu uma afiliação',               check:c => !!c.char?.affiliation },
]

export function computeUnlocked(char, level) {
  const ctx = { char, level }
  return ACHIEVEMENTS.filter(a => { try { return a.check(ctx) } catch { return false } })
}

export function computeProgress(char, level) {
  const unlocked = computeUnlocked(char, level)
  return { unlocked, total: ACHIEVEMENTS.length, pct: Math.round((unlocked.length/ACHIEVEMENTS.length)*100) }
}
