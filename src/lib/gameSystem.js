// ═══════════════════════════════════════════════
// PLUS ULTRA RPG — Game System Library
// Centralizes all RPG calculations
// ═══════════════════════════════════════════════

// ── GRADE SCALE F → SSS+ ──────────────────────
// Valores de atributo vão de 1 a infinito (sem cap duro)
// A escala cresce conforme o personagem evolui
const GRADE_THRESHOLDS = [
  { min: 200, label: 'SSS+', color: '#FF00FF' },
  { min: 160, label: 'SSS',  color: '#FF40FF' },
  { min: 130, label: 'SS+',  color: '#FF69B4' },
  { min: 100, label: 'SS',   color: '#FF79C6' },
  { min: 80,  label: 'S+',   color: '#FFD700' },
  { min: 65,  label: 'S',    color: '#FFC200' },
  { min: 52,  label: 'A+',   color: '#A78BFA' },
  { min: 42,  label: 'A',    color: '#9B59B6' },
  { min: 34,  label: 'B+',   color: '#64B5F6' },
  { min: 27,  label: 'B',    color: '#5865F2' },
  { min: 20,  label: 'C+',   color: '#57F287' },
  { min: 14,  label: 'C',    color: '#3BA55D' },
  { min: 9,   label: 'D+',   color: '#FFA500' },
  { min: 5,   label: 'D',    color: '#FF8C00' },
  { min: 2,   label: 'E',    color: '#96989D' },
  { min: 0,   label: 'F',    color: '#72767D' },
]

export function gradeLabel(v) {
  const t = GRADE_THRESHOLDS.find(g => v >= g.min)
  return t?.label || 'F'
}

export function gradeColor(v) {
  const t = GRADE_THRESHOLDS.find(g => v >= g.min)
  return t?.color || '#72767D'
}

// ── QUIRK EVOLUTION RANK NAMES ────────────────
export const QUIRK_RANK_NAMES = {
  1: 'Iniciante',
  2: 'Intermediário',
  3: 'Avançado',
  4: 'Mestre',
  5: 'Despertado',
}

export function quirkRankName(level) {
  return QUIRK_RANK_NAMES[Math.min(level, 5)] || 'Despertado'
}

// ── QUIRK TYPE BONUSES ────────────────────────
export const QUIRK_TYPE_BONUSES = {
  'Emitter':        { attr: 'forca',        bonus: 10, label: 'Força +10',        color: '#F87171', desc: 'Emissores têm potência de ataque superior.' },
  'Transformation': { attr: 'resistencia',  bonus: 10, label: 'Resistência +10',  color: '#FBBF24', desc: 'Transformação fortalece o corpo contra dano.' },
  'Accumulation':   { attr: 'resistencia',  bonus: 15, label: 'Resistência +15',  color: '#A78BFA', desc: 'Acumulação gera durabilidade extrema.' },
  'Mutant':         { attr: 'agilidade',    bonus: 10, label: 'Agilidade +10',    color: '#4ADE80', desc: 'Mutantes são naturalmente mais velozes.' },
  'Tool':           { attr: 'inteligencia', bonus: 10, label: 'Inteligência +10', color: '#60A5FA', desc: 'Ferramentas exigem precisão estratégica.' },
  'Composite':      { attr: 'controle',     bonus: 10, label: 'Controle +10',     color: '#22D3EE', desc: 'Quirks compostos demandam alto controle.' },
  'Outro':          { attr: null,           bonus: 0,  label: '—',               color: '#96989D', desc: 'Quirk de tipo único.' },
}

// ── ATTRIBUTE METADATA ────────────────────────
export const ATTR_META = {
  forca:        { label: 'Força',        color: '#F87171', desc: 'Dano físico e poder bruto. +1 dano por ponto.' },
  agilidade:    { label: 'Agilidade',    color: '#4ADE80', desc: 'Velocidade, esquiva e iniciativa. +1 iniciativa/2pts.' },
  controle:     { label: 'Controle',     color: '#60A5FA', desc: '+5 Quirk máx e alcance de técnicas por ponto.' },
  resistencia:  { label: 'Resistência',  color: '#FBBF24', desc: '+5 HP máx por ponto. Reduz dano recebido.' },
  inteligencia: { label: 'Inteligência', color: '#A78BFA', desc: '+bônus em pistas e estratégia.' },
  carisma:      { label: 'Carisma',      color: '#F472B6', desc: '+bônus em cura e convencimento.' },
  stamina:      { label: 'Stamina',      color: '#22D3EE', desc: '+3 Stamina máx por ponto.' },
}

export const ATTR_KEYS = Object.keys(ATTR_META)

// ── DERIVED STATS ─────────────────────────────
export function calcDerived(attrs, quirk_type, traits = []) {
  const a = attrs || {}
  const qBonus = QUIRK_TYPE_BONUSES[quirk_type]
  
  // Aplica bônus do tipo de Quirk
  const effective = { ...a }
  if (qBonus && qBonus.attr) {
    effective[qBonus.attr] = (effective[qBonus.attr] || 0) + qBonus.bonus
  }

  // Aplica bônus de traits
  traits.forEach(ct => {
    const effect = ct.traits?.effect || {}
    if (effect.attr && effect.bonus) {
      effective[effect.attr] = (effective[effect.attr] || 0) + effect.bonus
    }
  })

  return {
    hpMax:      100 + (effective.resistencia || 0) * 5,
    quirkMax:   100 + (effective.controle    || 0) * 5,
    staminaMax: 100 + (effective.stamina     || 0) * 3,
    initiative: Math.floor((effective.agilidade || 0) / 2),
    dmgBonus:   effective.forca || 0,
    healBonus:  effective.carisma || 0,
    // Alcance base = 5m + controle * 0.5m
    rangeBonus: (effective.controle || 0) * 0.5,
    effective,  // atributos com todos os bônus aplicados
  }
}

// ── ATTACK CALCULATION ────────────────────────
export function calcAttackDmg(attrs, quirk_type, quirk_level, technique, traits = []) {
  const derived = calcDerived(attrs, quirk_type, traits)
  const base    = derived.dmgBonus
  // D6 + força + bônus de nível do Quirk
  const levelBonus = (quirk_level - 1) * 3
  // Se tem técnica, usa o nível dela
  const techLevel = technique?.level || 1
  const techBonus = (techLevel - 1) * 5
  return { base, levelBonus, techBonus, total: base + levelBonus + techBonus }
}

export function calcHeal(attrs, quirk_type, traits = []) {
  const derived = calcDerived(attrs, quirk_type, traits)
  return Math.max(5, derived.healBonus + 5)
}

export function calcInitiative(attrs, quirk_type, traits = []) {
  const derived = calcDerived(attrs, quirk_type, traits)
  return derived.initiative
}

// ── TECHNIQUE LEVEL SCALING ───────────────────
// Técnicas têm nível e só ficam disponíveis quando quirk_level >= skill.level
// Dano e custo escalam com o nível da técnica
export function techIsAvailable(tech, quirk_level) {
  return quirk_level >= (tech.level || 1)
}

export function calcTechDmg(tech, attrs, quirk_type, quirk_level, traits = []) {
  const base = calcAttackDmg(attrs, quirk_type, quirk_level, tech, traits)
  const techMult = 1 + (tech.level - 1) * 0.3  // +30% por nível da técnica
  return Math.round((base.total) * techMult)
}

export function calcTechQuirkCost(tech, quirk_max) {
  // Custo base = 8% do quirk max por nível da técnica
  return Math.max(5, Math.round(quirk_max * 0.08 * (tech.level || 1)))
}

// ── TRAIT EFFECTS ON ACTIONS ─────────────────
export function getTraitActionBonus(traits, actionType) {
  let bonus = 0
  traits.forEach(ct => {
    const effect = ct.traits?.effect || {}
    if (actionType === 'attack'  && effect.dmg_bonus)        bonus += effect.dmg_bonus
    if (actionType === 'defend'  && effect.dmg_reduce)       bonus += effect.dmg_reduce
    if (actionType === 'heal'    && effect.heal_atk_bonus)   bonus += effect.heal_atk_bonus
    if (actionType === 'dodge'   && effect.dodge)            bonus += effect.dodge
    if (actionType === 'intel'   && effect.reveal_weakness)  bonus += 5
    if (actionType === 'attack'  && effect.crit_chance)      bonus += effect.crit_chance / 100
  })
  return bonus
}

export function hasRegenTrait(traits) {
  return traits.some(ct => ct.traits?.effect?.hp_regen)
}

export function getRegenAmount(traits) {
  let regen = 0
  traits.forEach(ct => { if (ct.traits?.effect?.hp_regen) regen += ct.traits.effect.hp_regen })
  return regen
}

// ── SPECIALTIES ───────────────────────────────
export const SPECIALTIES = [
  {
    key:   'vanguard',
    label: 'Vanguarda',
    icon:  '⚔️',
    desc:  'Herói de linha de frente. Recebe os inimigos de peito.',
    bonuses: { forca: 3, resistencia: 3, agilidade: 1 },
    passive: 'Quando HP < 40%: dano +20%'
  },
  {
    key:   'rescue',
    label: 'Resgate',
    icon:  '🛡️',
    desc:  'Especialista em salvar civis e suportar aliados.',
    bonuses: { carisma: 4, resistencia: 2, stamina: 1 },
    passive: 'Cura concedida a aliados +30%'
  },
  {
    key:   'support',
    label: 'Suporte',
    icon:  '💊',
    desc:  'Curandeiro e amplificador de equipe.',
    bonuses: { carisma: 5, inteligencia: 2 },
    passive: 'Ao curar, alvo recebe +10% ATK por 1 turno'
  },
  {
    key:   'tactician',
    label: 'Estrategista',
    icon:  '🧠',
    desc:  'Planeja e direciona o time com precisão.',
    bonuses: { inteligencia: 5, controle: 2 },
    passive: '+2 de iniciativa e revela fraquezas no 1º turno'
  },
  {
    key:   'scout',
    label: 'Explorador',
    icon:  '👁️',
    desc:  'Rápido, furtivo e excelente em reconhecimento.',
    bonuses: { agilidade: 5, inteligencia: 2 },
    passive: 'Bônus de esquiva +15%'
  },
  {
    key:   'tank',
    label: 'Tanque',
    icon:  '🏰',
    desc:  'Absorve dano e protege aliados.',
    bonuses: { resistencia: 6, stamina: 1 },
    passive: 'Reduz 10% do dano físico recebido passivamente'
  },
  {
    key:   'striker',
    label: 'Atacante',
    icon:  '💥',
    desc:  'Maximiza dano de uma única fonte.',
    bonuses: { forca: 5, agilidade: 2 },
    passive: '15% de chance de golpe crítico (dano x2)'
  },
  {
    key:   'controller',
    label: 'Controlador',
    icon:  '🕸️',
    desc:  'Controla o campo de batalha e restringe inimigos.',
    bonuses: { controle: 5, inteligencia: 2 },
    passive: 'Técnicas de captura/controle custam 15% menos Quirk'
  },
]

export function getSpecialty(key) {
  return SPECIALTIES.find(s => s.key === key)
}

export function calcAttrsWithSpecialty(attrs, specialtyKey) {
  const spec = getSpecialty(specialtyKey)
  if (!spec) return attrs
  const result = { ...attrs }
  Object.entries(spec.bonuses).forEach(([k, v]) => {
    result[k] = (result[k] || 0) + v
  })
  return result
}

// ── COMBAT ACTION TYPES ────────────────────────
export const ACTION_TYPES = [
  { key: 'attack',   label: '⚔️ Atacar',      color: '#F87171', class: 'msg-attack',   attr: 'forca',        desc: 'Ataque físico direto. Usa Força.' },
  { key: 'skill',    label: '✨ Técnica',      color: '#A78BFA', class: 'msg-skill',    attr: 'controle',     desc: 'Usa uma técnica do Quirk.' },
  { key: 'defend',   label: '🛡️ Defender',    color: '#60A5FA', class: 'msg-defend',   attr: 'resistencia',  desc: 'Postura defensiva. Reduz dano recebido.' },
  { key: 'dodge',    label: '💨 Desviar',      color: '#22D3EE', class: 'msg-dodge',    attr: 'agilidade',    desc: 'Tenta esquivar de um ataque pendente.' },
  { key: 'heal',     label: '💚 Curar',        color: '#57F287', class: 'msg-heal',     attr: 'carisma',      desc: 'Cura a si mesmo ou um aliado.' },
  { key: 'intel',    label: '🧠 Investigar',   color: '#FBBF24', class: 'msg-intel',    attr: 'inteligencia', desc: 'Analisa a situação. Pode revelar fraquezas.' },
  { key: 'charisma', label: '💬 Convencer',    color: '#F472B6', class: 'msg-charisma', attr: 'carisma',      desc: 'Tenta persuadir ou intimidar.' },
]

export function getActionType(key) {
  return ACTION_TYPES.find(a => a.key === key)
}

// ── NPC LEVEL SCALING ─────────────────────────
const POINTS_PER_LEVEL = 8  // pontos de atributo ganhos por nível
const BASE_POINTS = 42      // mesmo que os players (7 attrs * 6)

export function calcNpcPointsForLevel(level) {
  return BASE_POINTS + (level - 1) * POINTS_PER_LEVEL
}

export function calcNpcHpForLevel(attrs, level) {
  return 100 + (attrs?.resistencia || 0) * 5 + (level - 1) * 15
}

// ── LEVEL SYSTEM ────────────────────────────────────────────
// XP necessário para cada nível
export function xpForLevel(level) {
  return Math.floor(1000 * Math.pow(1.25, level - 1))
}

// Calcula o nível atual baseado no XP total acumulado
export function calcLevel(xp) {
  let level = 1
  let accumulated = 0
  while (true) {
    const needed = xpForLevel(level)
    if (accumulated + needed > xp) break
    accumulated += needed
    level++
    if (level > 999) break
  }
  return level
}

// XP ganho ao vencer um combate, proporcional à diferença de nível
export function calcCombatXp(winnerLevel, loserLevel) {
  const diff = loserLevel - winnerLevel
  const base = 50
  if (diff >= 10) return base * 5      // venceu alguém muito mais forte
  if (diff >= 5)  return base * 3
  if (diff >= 2)  return base * 1.5
  if (diff >= 0)  return base           // nível similar
  if (diff >= -5) return Math.floor(base * 0.5)  // mais forte que o derrotado
  return Math.floor(base * 0.1)        // derrotou alguém muito mais fraco
}

// XP da missão baseado na dificuldade E no nível médio dos NPCs vinculados
export function calcMissionXp(difficulty, npcLevels = []) {
  const BASE = { TREINO:50, 'FÁCIL':100, 'MÉDIO':250, 'DIFÍCIL':500, 'ÉPICO':1000 }
  let base = BASE[difficulty] || 100
  if (npcLevels.length > 0) {
    const avgNpcLevel = npcLevels.reduce((a,b) => a+b, 0) / npcLevels.length
    const multiplier  = Math.max(1, 1 + (avgNpcLevel - 1) * 0.15)
    base = Math.floor(base * multiplier)
  }
  return base
}

// ── MISSION TYPES ───────────────────────────────────────────
export const MISSION_TYPES = [
  { key:'combat',        icon:'⚔️',  label:'Combate',       desc:'Enfrentar e derrotar inimigos.',        xpMult:1.2 },
  { key:'investigation', icon:'🔍',  label:'Investigação',  desc:'Coletar pistas e resolver mistérios.',  xpMult:1.0 },
  { key:'rescue',        icon:'🚨',  label:'Resgate',       desc:'Salvar civis ou aliados em perigo.',    xpMult:1.1 },
  { key:'infiltration',  icon:'🕵️', label:'Infiltração',   desc:'Entrar sem ser detectado.',             xpMult:1.15 },
  { key:'social',        icon:'💬',  label:'Social',        desc:'Negociação, persuasão e diplomacia.',   xpMult:0.9 },
  { key:'escort',        icon:'🛡️', label:'Escolta',       desc:'Proteger alguém ou algo durante trajeto.',xpMult:1.0 },
  { key:'patrol',        icon:'👁️', label:'Patrulha',      desc:'Varrer área e garantir segurança.',     xpMult:0.8 },
  { key:'training',      icon:'💪',  label:'Treino',        desc:'Missão de aprendizado e prática.',      xpMult:0.5 },
]

export function getMissionType(key) {
  return MISSION_TYPES.find(m => m.key === key) || MISSION_TYPES[0]
}

// ── ATTRIBUTE ROLL SYSTEM ────────────────────────────────────
// Dificuldades de roll
export const ROLL_DIFFICULTIES = [
  { key:'trivial',   label:'Trivial',   dc:5,  desc:'Qualquer um consegue.' },
  { key:'easy',      label:'Fácil',     dc:8,  desc:'Requer competência mínima.' },
  { key:'medium',    label:'Médio',     dc:12, desc:'Desafiador para a maioria.' },
  { key:'hard',      label:'Difícil',   dc:16, desc:'Requer grande habilidade.' },
  { key:'extreme',   label:'Extremo',   dc:20, desc:'Quase impossível.' },
  { key:'legendary', label:'Lendário',  dc:25, desc:'Feito apenas por lendas.' },
]

// DC se adapta ao nível de dificuldade da missão
export function adaptRollDC(baseDC, missionDifficulty) {
  const mults = { TREINO:-3, 'FÁCIL':-2, 'MÉDIO':0, 'DIFÍCIL':3, 'ÉPICO':6 }
  return baseDC + (mults[missionDifficulty] || 0)
}

export function getRollDifficulty(key) {
  return ROLL_DIFFICULTIES.find(r => r.key === key) || ROLL_DIFFICULTIES[2]
}

// Resolve um roll de atributo
export function resolveAttributeRoll(attrValue, rollResult, dc, traitBonus = 0) {
  const total = rollResult + Math.floor(attrValue / 3) + traitBonus
  const margin = total - dc
  if (margin >= 5)  return { success: true,  degree: 'great',   label: 'Sucesso Excepcional!', color: '#57F287' }
  if (margin >= 0)  return { success: true,  degree: 'normal',  label: 'Sucesso!',             color: '#3BA55D' }
  if (margin >= -3) return { success: false, degree: 'partial', label: 'Sucesso Parcial',       color: '#FFB300' }
  return             { success: false, degree: 'fail',    label: 'Falha!',               color: '#ED4245' }
}
