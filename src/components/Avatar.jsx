const BG = {
  red:    'linear-gradient(135deg,#dc2626,#991b1b)',
  blue:   'linear-gradient(135deg,#2563eb,#1d4ed8)',
  green:  'linear-gradient(135deg,#16a34a,#15803d)',
  purple: 'linear-gradient(135deg,#7c3aed,#5b21b6)',
  gold:   'linear-gradient(135deg,#d97706,#b45309)',
  pink:   'linear-gradient(135deg,#db2777,#be185d)',
  teal:   'linear-gradient(135deg,#0891b2,#0e7490)',
  gray:   'linear-gradient(135deg,#374151,#1f2937)',
}

export const TEXT_COLOR = {
  red: '#f87171', blue: '#60a5fa', green: '#4ade80',
  purple: '#a78bfa', gold: '#fbbf24', pink: '#f472b6',
  teal: '#22d3ee', gray: '#9ca3af',
}

export function avatarBg(color) {
  return BG[color] || BG.purple
}

export function initials(name) {
  if (!name) return '?'
  const p = name.trim().split(' ')
  return (p[0][0] + (p[1] ? p[1][0] : '')).toUpperCase()
}

export default function Avatar({ name, color, url, size = 28, ring, style = {} }) {
  const bg = avatarBg(color)
  const fontSize = Math.round(size * 0.5)
  const ringStyle = ring === 'online'
    ? { boxShadow: '0 0 0 2px #16a34a' }
    : ring === 'away'
    ? { boxShadow: '0 0 0 2px #d97706' }
    : {}

  return (
    <div style={{
      width: size, height: size,
      borderRadius: '50%',
      background: url ? 'transparent' : bg,
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      fontFamily: 'Bangers, cursive',
      fontSize, color: '#fff',
      flexShrink: 0, overflow: 'hidden',
      ...ringStyle, ...style
    }}>
      {url
        ? <img src={url} alt={name} style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        : initials(name)
      }
    </div>
  )
}
