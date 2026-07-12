// ═══════════════════════════════════════════════
// PLUS ULTRA RPG — Game System Library v4
// ═══════════════════════════════════════════════

// ── GRADE SCALE F → SSS+ ──────────────────────
const GRADE_THRESHOLDS = [
  { min:200, label:'SSS+', color:'#FF00FF' },
  { min:160, label:'SSS',  color:'#FF40FF' },
  { min:130, label:'SS+',  color:'#FF69B4' },
  { min:100, label:'SS',   color:'#FF79C6' },
  { min:80,  label:'S+',   color:'#FFD700' },
  { min:65,  label:'S',    color:'#FFC200' },
  { min:52,  label:'A+',   color:'#A78BFA' },
  { min:42,  label:'A',    color:'#9B59B6' },
  { min:34,  label:'B+',   color:'#64B5F6' },
  { min:27,  label:'B',    color:'#5865F2' },
  { min:20,  label:'C+',   color:'#57F287' },
  { min:14,  label:'C',    color:'#3BA55D' },
  { min:9,   label:'D+',   color:'#FFA500' },
  { min:5,   label:'D',    color:'#FF8C00' },
  { min:2,   label:'E',    color:'#96989D' },
  { min:0,   label:'F',    color:'#72767D' },
]

export function gradeLabel(v) {
  return (GRADE_THRESHOLDS.find(g => v >= g.min) || GRADE_THRESHOLDS.at(-1)).label
}
export function gradeColor(v) {
  return (GRADE_THRESHOLDS.find(g => v >= g.min) || GRADE_THRESHOLDS.at(-1)).color
}

// ── QUIRK RANK NAMES (PT-BR) ──────────────────
export const QUIRK_RANK_NAMES = {
  1:'Iniciante', 2:'Intermediário', 3:'Avançado', 4:'Mestre', 5:'Despertado',
}
export function quirkRankName(level) {
  return QUIRK_RANK_NAMES[Math.min(level,5)] || 'Despertado'
}

// ── QUIRK TYPES PT-BR ─────────────────────────
export const QUIRK_TYPES_PTBR = [
  'Emissor','Transformação','Acumulação','Mutante','Ferramenta','Composto','Outro'
]

export const QUIRK_TYPE_BONUSES = {
  'Emissor':      { attr:'forca',        bonus:10, label:'Força +10',        color:'#F87171', desc:'Emissores têm potência de ataque superior.' },
  'Transformação':{ attr:'resistencia',  bonus:10, label:'Resistência +10',  color:'#FBBF24', desc:'Transformação fortalece o corpo contra dano.' },
  'Acumulação':   { attr:'resistencia',  bonus:15, label:'Resistência +15',  color:'#A78BFA', desc:'Acumulação gera durabilidade extrema.' },
  'Mutante':      { attr:'agilidade',    bonus:10, label:'Agilidade +10',    color:'#4ADE80', desc:'Mutantes são naturalmente mais velozes.' },
  'Ferramenta':   { attr:'inteligencia', bonus:10, label:'Inteligência +10', color:'#60A5FA', desc:'Ferramentas exigem precisão estratégica.' },
  'Composto':     { attr:'controle',     bonus:10, label:'Controle +10',     color:'#22D3EE', desc:'Quirks compostos demandam alto controle.' },
  'Outro':        { attr:null,           bonus:0,  label:'—',               color:'#96989D', desc:'Quirk de tipo único.' },
}

// ── ATTRIBUTE METADATA ────────────────────────
export const ATTR_META = {
  forca:        { label:'Força',        color:'#F87171', desc:'Dano físico e poder bruto. +1 dano por ponto.' },
  agilidade:    { label:'Agilidade',    color:'#4ADE80', desc:'Velocidade, esquiva e iniciativa.' },
  controle:     { label:'Controle',     color:'#60A5FA', desc:'+5 Quirk Máx e alcance de técnicas por ponto.' },
  resistencia:  { label:'Resistência',  color:'#FBBF24', desc:'+5 HP Máx por ponto. Reduz dano recebido.' },
  inteligencia: { label:'Inteligência', color:'#A78BFA', desc:'+bônus em pistas, investigação e estratégia.' },
  carisma:      { label:'Carisma',      color:'#F472B6', desc:'+bônus em cura e convencimento.' },
  stamina:      { label:'Stamina',      color:'#22D3EE', desc:'+3 Stamina Máx por ponto.' },
}
export const ATTR_KEYS = Object.keys(ATTR_META)

// ── DERIVED STATS ─────────────────────────────
// Retorna atributos efetivos com TODOS os bônus aplicados e de onde vieram
export function calcEffectiveAttrs(attrs, quirk_type, traits = [], specialty = '') {
  const base = { ...attrs }
  const bonuses = []   // [{source, attr, value}]

  // Bônus de especialidade
  const spec = SPECIALTIES.find(s => s.key === specialty)
  if (spec) {
    Object.entries(spec.bonuses).forEach(([k, v]) => {
      base[k] = (base[k] || 0) + v
      bonuses.push({ source: spec.label, sourceType:'specialty', attr: k, value: v, color:'#5865F2' })
    })
  }

  // Bônus de tipo de Quirk
  const qb = QUIRK_TYPE_BONUSES[quirk_type]
  if (qb && qb.attr) {
    base[qb.attr] = (base[qb.attr] || 0) + qb.bonus
    bonuses.push({ source: quirk_type, sourceType:'quirk', attr: qb.attr, value: qb.bonus, color: qb.color })
  }

  // Bônus de traits
  traits.forEach(ct => {
    const eff = ct.traits?.effect || {}
    if (eff.attr && eff.bonus) {
      base[eff.attr] = (base[eff.attr] || 0) + eff.bonus
      bonuses.push({ source: ct.traits?.name || 'Trait', sourceType:'trait', attr: eff.attr, value: eff.bonus, color:'#FFB300' })
    }
  })

  return { effective: base, bonuses }
}

export function calcDerived(attrs, quirk_type, traits = [], specialty = '') {
  const { effective } = calcEffectiveAttrs(attrs, quirk_type, traits, specialty)
  return {
    hpMax:      100 + (effective.resistencia || 0) * 5,
    quirkMax:   100 + (effective.controle    || 0) * 5,
    staminaMax: 100 + (effective.stamina     || 0) * 3,
    initiative: Math.floor((effective.agilidade || 0) / 2),
    dmgBonus:   effective.forca || 0,
    healBonus:  effective.carisma || 0,
    rangeBonus: (effective.controle || 0) * 0.5,
    effective,
  }
}

// ── QUIRK RANGE (automático) ──────────────────
// Alcance base = 3m + bônus do atributo que o TIPO da quirk favorece
// (ex: Emissor favorece Força, então mais Força = mais alcance) + bônus
// do Controle, que sempre soma independente do tipo.
export function calcQuirkRange(attrs, quirk_type) {
  const qb = QUIRK_TYPE_BONUSES[quirk_type]
  const typeAttrValue = qb?.attr ? (attrs?.[qb.attr] || 0) : 0
  const controle = attrs?.controle || 0
  const range = 3 + Math.floor(typeAttrValue / 3) + Math.floor(controle / 2)
  return Math.max(1, range)
}

// ── SPECIALTIES ───────────────────────────────
export const SPECIALTIES = [
  { key:'vanguard',   label:'Vanguarda',   icon:'⚔️',  bonuses:{forca:3,resistencia:3,agilidade:1},       passive:'HP < 40%: dano +20%' },
  { key:'rescue',     label:'Resgate',     icon:'🛡️', bonuses:{carisma:4,resistencia:2,stamina:1},       passive:'Cura concedida a aliados +30%' },
  { key:'support',    label:'Suporte',     icon:'💊',  bonuses:{carisma:5,inteligencia:2},                passive:'Ao curar, alvo recebe +10% ATK por 1 turno' },
  { key:'tactician',  label:'Estrategista',icon:'🧠',  bonuses:{inteligencia:5,controle:2},               passive:'+2 iniciativa e revela fraquezas no 1º turno' },
  { key:'scout',      label:'Explorador',  icon:'👁️', bonuses:{agilidade:5,inteligencia:2},              passive:'Esquiva +15%' },
  { key:'tank',       label:'Tanque',      icon:'🏰',  bonuses:{resistencia:6,stamina:1},                 passive:'Reduz 10% dano físico recebido passivamente' },
  { key:'striker',    label:'Atacante',    icon:'💥',  bonuses:{forca:5,agilidade:2},                     passive:'15% de chance de crítico (dano ×2)' },
  { key:'controller', label:'Controlador', icon:'🕸️', bonuses:{controle:5,inteligencia:2},               passive:'Técnicas de controle custam 15% menos Quirk' },
]
export function getSpecialty(key) { return SPECIALTIES.find(s => s.key === key) }

// ── LEVEL SYSTEM ──────────────────────────────
export function xpForLevel(level) {
  return Math.floor(1000 * Math.pow(1.25, level - 1))
}
export function calcLevel(xp) {
  let level = 1, acc = 0
  while (true) {
    const needed = xpForLevel(level)
    if (acc + needed > xp) break
    acc += needed; level++
    if (level > 999) break
  }
  return level
}

// ── COMBAT XP ────────────────────────────────
export function calcCombatXp(winnerLevel, loserLevel) {
  const diff = loserLevel - winnerLevel
  const base = 50
  if (diff >= 10) return base * 5
  if (diff >= 5)  return base * 3
  if (diff >= 2)  return base * 1.5
  if (diff >= 0)  return base
  if (diff >= -5) return Math.floor(base * 0.5)
  return Math.floor(base * 0.1)
}

// ── MISSION XP ───────────────────────────────
export function calcMissionXp(difficulty, npcLevels = []) {
  const BASE = { TREINO:50,'FÁCIL':100,'MÉDIO':250,'DIFÍCIL':500,'ÉPICO':1000 }
  let base = BASE[difficulty] || 100
  if (npcLevels.length > 0) {
    const avg = npcLevels.reduce((a,b)=>a+b,0) / npcLevels.length
    base = Math.floor(base * Math.max(1, 1 + (avg - 1) * 0.15))
  }
  return base
}

// ── MISSION TYPES ─────────────────────────────
export const MISSION_TYPES = [
  { key:'combat',       icon:'⚔️',  label:'Combate',      desc:'Enfrentar e derrotar inimigos.',       xpMult:1.2 },
  { key:'investigation',icon:'🔍',  label:'Investigação', desc:'Coletar pistas e resolver mistérios.', xpMult:1.0 },
  { key:'rescue',       icon:'🚨',  label:'Resgate',      desc:'Salvar civis ou aliados.',             xpMult:1.1 },
  { key:'infiltration', icon:'🕵️', label:'Infiltração',  desc:'Entrar sem ser detectado.',            xpMult:1.15 },
  { key:'social',       icon:'💬',  label:'Social',       desc:'Negociação e diplomacia.',             xpMult:0.9 },
  { key:'escort',       icon:'🛡️', label:'Escolta',      desc:'Proteger durante trajeto.',            xpMult:1.0 },
  { key:'patrol',       icon:'👁️', label:'Patrulha',     desc:'Varrer área e garantir segurança.',   xpMult:0.8 },
  { key:'training',     icon:'💪',  label:'Treino',       desc:'Missão de aprendizado.',               xpMult:0.5 },
]
export function getMissionType(key) { return MISSION_TYPES.find(m=>m.key===key) || MISSION_TYPES[0] }

// ── TECHNIQUE SYSTEM ──────────────────────────
export function techIsAvailable(tech, quirk_level) { return quirk_level >= (tech.level || 1) }

export function maxTechTypes(quirk_level) {
  if (quirk_level >= 4) return 3
  if (quirk_level >= 2) return 2
  return 1
}

export function calcTechDmg(tech, attrs, quirk_type, quirk_level, traits = []) {
  const derived  = calcDerived(attrs, quirk_type, traits)
  const base     = derived.dmgBonus
  const lvlBonus = (quirk_level - 1) * 3
  const techMult = 1 + ((tech.level || 1) - 1) * 0.3
  return Math.round((base + lvlBonus) * techMult)
}

export function calcTechQuirkCost(tech, quirk_max) {
  return Math.max(5, Math.round(quirk_max * 0.08 * (tech.level || 1)))
}

// ── STATUS EFFECTS ────────────────────────────
export const STATUS_EFFECTS = [
  { key:'bleeding',  label:'Sangrando',     icon:'🩸', color:'#E5484D', durationMin:5 },
  { key:'stunned',   label:'Atordoado',     icon:'💫', color:'#F2B705', durationMin:2 },
  { key:'burning',   label:'Queimando',     icon:'🔥', color:'#FF7A00', durationMin:4 },
  { key:'poisoned',  label:'Envenenado',    icon:'☠️', color:'#2FBF71', durationMin:6 },
  { key:'frozen',    label:'Congelado',     icon:'🧊', color:'#5FE0EA', durationMin:3 },
  { key:'strengthened', label:'Fortalecido', icon:'💪', color:'#8B5CF6', durationMin:5 },
  { key:'weakened',  label:'Enfraquecido',  icon:'📉', color:'#8A93A6', durationMin:5 },
  { key:'shielded',  label:'Protegido',     icon:'🛡️', color:'#3B6FF0', durationMin:3 },
]
export function getStatusEffect(key) { return STATUS_EFFECTS.find(s => s.key === key) }
export function isEffectActive(effect) {
  if (!effect?.appliedAt || !effect?.durationMin) return true
  return Date.now() - effect.appliedAt < effect.durationMin * 60000
}

// ── ACTION TYPES ──────────────────────────────
export const ACTION_TYPES = [
  { key:'attack',   label:'⚔️ Atacar',     color:'#F87171', class:'msg-attack',  attr:'forca',        desc:'Ataque físico direto. Usa Força.' },
  { key:'skill',    label:'✨ Técnica',     color:'#A78BFA', class:'msg-skill',   attr:'controle',     desc:'Usa uma técnica do Quirk.' },
  { key:'defend',   label:'🛡️ Defender',  color:'#60A5FA', class:'msg-defend',  attr:'resistencia',  desc:'Postura defensiva. Reduz dano recebido.' },
  { key:'dodge',    label:'💨 Desviar',    color:'#22D3EE', class:'msg-dodge',   attr:'agilidade',    desc:'Tenta esquivar de um ataque pendente.' },
  { key:'heal',     label:'💚 Curar',      color:'#57F287', class:'msg-heal',    attr:'carisma',      desc:'Cura a si mesmo ou um aliado.' },
  { key:'intel',    label:'🧠 Investigar', color:'#FBBF24', class:'msg-intel',   attr:'inteligencia', desc:'Analisa a situação. Pode revelar fraquezas.' },
  { key:'charisma', label:'💬 Convencer',  color:'#F472B6', class:'msg-charisma',attr:'carisma',      desc:'Tenta persuadir ou intimidar.' },
]
export function getActionType(key) { return ACTION_TYPES.find(a=>a.key===key) }

// ── ROLL SYSTEM ───────────────────────────────
export const ROLL_DIFFICULTIES = [
  { key:'trivial',   label:'Trivial',  dc:5  },
  { key:'easy',      label:'Fácil',    dc:8  },
  { key:'medium',    label:'Médio',    dc:12 },
  { key:'hard',      label:'Difícil',  dc:16 },
  { key:'extreme',   label:'Extremo',  dc:20 },
  { key:'legendary', label:'Lendário', dc:25 },
]
export function adaptRollDC(baseDC, missionDifficulty) {
  const m = { TREINO:-3,'FÁCIL':-2,'MÉDIO':0,'DIFÍCIL':3,'ÉPICO':6 }
  return baseDC + (m[missionDifficulty] || 0)
}
export function resolveAttributeRoll(attrValue, rollResult, dc, traitBonus=0) {
  const total  = rollResult + Math.floor(attrValue/3) + traitBonus
  const margin = total - dc
  if (margin >= 5)  return { success:true,  degree:'great',   label:'Sucesso Excepcional!', color:'#57F287' }
  if (margin >= 0)  return { success:true,  degree:'normal',  label:'Sucesso!',             color:'#3BA55D' }
  if (margin >= -3) return { success:false, degree:'partial', label:'Sucesso Parcial',      color:'#FFB300' }
  return               { success:false, degree:'fail',    label:'Falha!',               color:'#ED4245' }
}

// ── NPC LEVEL SCALING ─────────────────────────
export const POINTS_PER_LEVEL = 8
export const BASE_POINTS      = 42
export function calcNpcPointsForLevel(level) { return BASE_POINTS + (Math.max(1,level)-1)*POINTS_PER_LEVEL }

// ── TRAIT BONUSES ─────────────────────────────
export function getTraitActionBonus(traits, actionType) {
  let bonus = 0
  traits.forEach(ct => {
    const e = ct.traits?.effect || {}
    if (actionType==='attack'  && e.dmg_bonus)      bonus += e.dmg_bonus
    if (actionType==='defend'  && e.dmg_reduce)     bonus += e.dmg_reduce
    if (actionType==='heal'    && e.heal_atk_bonus) bonus += e.heal_atk_bonus
    if (actionType==='dodge'   && e.dodge)          bonus += e.dodge
    if (actionType==='intel'   && e.reveal_weakness) bonus += 5
    if (actionType==='attack'  && e.crit_chance)    bonus += e.crit_chance / 100
  })
  return bonus
}
export function hasRegenTrait(traits) { return traits.some(ct=>ct.traits?.effect?.hp_regen) }
export function getRegenAmount(traits) {
  return traits.reduce((s,ct)=>s+(ct.traits?.effect?.hp_regen||0),0)
}

// ── COMPAT: calcAttrsWithSpecialty (uses calcEffectiveAttrs internally) ──
export function calcAttrsWithSpecialty(attrs, specialtyKey) {
  const spec = SPECIALTIES.find(s => s.key === specialtyKey)
  if (!spec) return attrs
  const result = { ...attrs }
  Object.entries(spec.bonuses).forEach(([k, v]) => { result[k] = (result[k]||0)+v })
  return result
}

// ── NPC compat ──
export function calcNpcHpForLevel(attrs, level) {
  return 100 + (attrs?.resistencia||0)*5 + (level-1)*15
}

// ── Trait bonus compat ──
export function getTraitAttrBonus(traits, attrKey) {
  return traits.reduce((sum, ct) => {
    const e = ct.traits?.effect||{}
    return sum + (e.attr===attrKey ? (e.bonus||0) : 0)
  }, 0)
}

// ── QUIRK XP SYSTEM ───────────────────────────────────────────
// XP de Quirk é ganho pelo USO de técnicas em combate
// Técnicas de nível maior dão mais XP apesar do gasto maior
export const QUIRK_LEVEL_THRESHOLDS = [
  0,    // Nv1: Iniciante (começa aqui)
  100,  // Nv2: Intermediário
  300,  // Nv3: Avançado
  700,  // Nv4: Mestre
  1500, // Nv5: Despertado
]

export function calcQuirkLevel(quirkXp) {
  let level = 1
  for (let i = QUIRK_LEVEL_THRESHOLDS.length - 1; i >= 0; i--) {
    if (quirkXp >= QUIRK_LEVEL_THRESHOLDS[i]) { level = i + 1; break }
  }
  return Math.min(level, 5)
}

export function quirkXpForNextLevel(currentLevel) {
  return QUIRK_LEVEL_THRESHOLDS[currentLevel] ?? null  // null = maxed
}

// XP ganho ao usar uma técnica
// Técnicas de nível maior dão mais XP proporcionalmente
export function calcTechQuirkXp(techLevel) {
  const BASE_XP = [0, 5, 12, 25, 50]  // índice = nível da técnica - 1
  return BASE_XP[Math.min((techLevel || 1) - 1, BASE_XP.length - 1)]
}
