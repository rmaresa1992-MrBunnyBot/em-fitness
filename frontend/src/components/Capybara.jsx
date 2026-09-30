import { useId } from 'react'
// EM Fitness fase 6: the capybara, drawn in one SVG by layers so every item from the shop
// (lib/pet-items.js) is just another group on top: place → house → cape → body → clothes →
// neck → face (by mood) → glasses → headwear. Flat shapes, one outline weight, no gradients
// except the sky, so it sits with the rest of the app's look.

const FUR = '#a8744f', FUR_DARK = '#8a5a3b', FUR_LIGHT = '#c7976f', INK = '#2b1d14'

/* ---------------- places ---------------- */
function Place({ id }) {
  switch (id) {
    case 'park': return <g>
      <rect width="240" height="240" fill="#dff0e3" />
      <rect y="178" width="240" height="62" fill="#9fd08f" />
      <circle cx="40" cy="96" r="28" fill="#7cbf73" /><rect x="36" y="118" width="8" height="62" fill="#8a5a3b" />
      <circle cx="206" cy="112" r="20" fill="#86c77b" /><rect x="203" y="128" width="6" height="52" fill="#8a5a3b" />
    </g>
    case 'beach': return <g>
      <rect width="240" height="240" fill="#dcefff" />
      <circle cx="196" cy="46" r="18" fill="#ffd166" />
      <rect y="150" width="240" height="34" fill="#7cc6e8" />
      <rect y="178" width="240" height="62" fill="#f3dfae" />
    </g>
    case 'gym': return <g>
      <rect width="240" height="240" fill="#ecebe7" />
      <rect y="182" width="240" height="58" fill="#c9c6bd" />
      <rect x="18" y="70" width="6" height="112" fill="#6b6b6b" /><rect x="216" y="70" width="6" height="112" fill="#6b6b6b" />
      <rect x="18" y="98" width="204" height="5" fill="#6b6b6b" />
      <rect x="30" y="86" width="12" height="28" rx="3" fill="#2b2b2b" /><rect x="198" y="86" width="12" height="28" rx="3" fill="#2b2b2b" />
    </g>
    case 'space': return <g>
      <rect width="240" height="240" fill="#1d2440" />
      {[[30, 30], [80, 50], [190, 30], [215, 80], [20, 110], [150, 20], [60, 140], [200, 150]].map(([x, y], i) => <circle key={i} cx={x} cy={y} r={i % 3 ? 1.6 : 2.4} fill="#fff" opacity=".85" />)}
      <circle cx="196" cy="60" r="16" fill="#f2a65a" /><ellipse cx="196" cy="60" rx="26" ry="6" fill="none" stroke="#ffd9a8" strokeWidth="3" />
      <ellipse cx="120" cy="210" rx="120" ry="34" fill="#8f96b3" />
    </g>
    default: return <g>
      <circle cx="120" cy="124" r="104" fill="color-mix(in srgb, var(--acc-fill, #f26b1d) 12%, var(--surface, #fff))" />
      <ellipse cx="120" cy="204" rx="78" ry="10" fill="rgba(0,0,0,.08)" />
    </g>
  }
}

/* ---------------- houses (behind, to the left) ---------------- */
function House({ id }) {
  switch (id) {
    case 'hut': return <g transform="translate(6 96)">
      <rect x="8" y="40" width="56" height="48" fill="#c28a58" stroke={INK} strokeWidth="2" />
      <path d="M2 44 L36 12 L70 44 Z" fill="#8a5a3b" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <rect x="28" y="60" width="16" height="28" rx="2" fill="#6d4429" />
    </g>
    case 'cabin': return <g transform="translate(0 84)">
      <rect x="8" y="46" width="70" height="54" fill="#b67a4a" stroke={INK} strokeWidth="2" />
      {[56, 66, 76, 86].map(y => <line key={y} x1="8" x2="78" y1={y} y2={y} stroke="#8a5a3b" strokeWidth="2" />)}
      <path d="M0 50 L43 14 L86 50 Z" fill="#5f6b4e" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <rect x="58" y="16" width="10" height="20" fill="#7a7a7a" stroke={INK} strokeWidth="2" />
      <rect x="20" y="62" width="16" height="14" fill="#ffe7a8" stroke={INK} strokeWidth="1.5" />
    </g>
    case 'castle': return <g transform="translate(0 70)">
      <rect x="6" y="40" width="84" height="74" fill="#c9c6bd" stroke={INK} strokeWidth="2" />
      {[6, 26, 46, 66].map(x => <rect key={x} x={x} y="30" width="12" height="12" fill="#c9c6bd" stroke={INK} strokeWidth="2" />)}
      <rect x="34" y="78" width="28" height="36" rx="14" fill="#6d4429" stroke={INK} strokeWidth="2" />
      <line x1="48" y1="30" x2="48" y2="6" stroke={INK} strokeWidth="2" /><path d="M48 6 L66 12 L48 18 Z" fill="#f26b1d" />
    </g>
    default: return null
  }
}

/* ---------------- clothes on the body ---------------- */
function Body({ id }) {
  switch (id) {
    case 'tee': return <g>
      <path d="M62 150 Q120 128 178 150 L182 190 Q120 206 58 190 Z" fill="#f26b1d" stroke={INK} strokeWidth="2" />
      <text x="120" y="180" textAnchor="middle" fontSize="16" fontWeight="700" fill="#fff" fontFamily="Outfit Variable, sans-serif">EM</text>
    </g>
    case 'hoodie': return <g>
      <path d="M58 146 Q120 124 182 146 L186 194 Q120 210 54 194 Z" fill="#6f7680" stroke={INK} strokeWidth="2" />
      <path d="M96 176 H144 V194 Q120 200 96 194 Z" fill="#5c626b" stroke={INK} strokeWidth="1.5" />
    </g>
    default: return null
  }
}

/* ---------------- neck ---------------- */
function Neck({ id }) {
  switch (id) {
    case 'bow': return <g transform="translate(120 146)">
      <path d="M0 0 L-18 -10 L-18 10 Z M0 0 L18 -10 L18 10 Z" fill="#c4281c" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
      <circle r="5" fill="#a11f15" stroke={INK} strokeWidth="2" />
    </g>
    case 'scarf': return <g>
      <path d="M70 138 Q120 158 170 138 L172 152 Q120 172 68 152 Z" fill="#2f8f5b" stroke={INK} strokeWidth="2" />
      <path d="M146 152 L156 188 L140 188 L134 156 Z" fill="#2f8f5b" stroke={INK} strokeWidth="2" strokeLinejoin="round" />
    </g>
    case 'medal': return <g>
      <path d="M104 138 L120 168 L136 138" fill="none" stroke="#1d5fbf" strokeWidth="6" />
      <circle cx="120" cy="174" r="11" fill="#f5c542" stroke={INK} strokeWidth="2" />
      <path d="M120 168 l2 4 4 .5 -3 3 .8 4 -3.8 -2 -3.8 2 .8 -4 -3 -3 4 -.5 z" fill="#fff5cf" />
    </g>
    default: return null
  }
}

/* ---------------- face by mood ---------------- */
function Face({ mood }) {
  const eyeL = 94, eyeR = 146, eyeY = 84
  let eyes, mouth, extra = null
  switch (mood) {
    case 'happy':
      eyes = <g fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round"><path d={`M${eyeL - 7} ${eyeY + 2} Q${eyeL} ${eyeY - 7} ${eyeL + 7} ${eyeY + 2}`} /><path d={`M${eyeR - 7} ${eyeY + 2} Q${eyeR} ${eyeY - 7} ${eyeR + 7} ${eyeY + 2}`} /></g>
      mouth = <path d="M110 132 Q120 140 130 132" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      extra = <g fill="#f08a7a" opacity=".55"><ellipse cx="80" cy="102" rx="8" ry="5" /><ellipse cx="160" cy="102" rx="8" ry="5" /></g>
      break
    case 'hungry':
      eyes = <g fill={INK}><circle cx={eyeL} cy={eyeY} r="5" /><circle cx={eyeR} cy={eyeY} r="5" /></g>
      mouth = <path d="M111 135 Q120 130 129 135" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      extra = <g stroke={INK} strokeWidth="2.5" strokeLinecap="round"><path d={`M${eyeL - 9} ${eyeY - 12} L${eyeL + 6} ${eyeY - 9}`} /><path d={`M${eyeR + 9} ${eyeY - 12} L${eyeR - 6} ${eyeY - 9}`} /></g>
      break
    case 'tired':
      eyes = <g stroke={INK} strokeWidth="3.5" strokeLinecap="round"><path d={`M${eyeL - 7} ${eyeY} H${eyeL + 7}`} /><path d={`M${eyeR - 7} ${eyeY} H${eyeR + 7}`} /></g>
      mouth = <ellipse cx="120" cy="134" rx="5" ry="3.5" fill={INK} />
      extra = <path d="M166 70 q6 -8 0 -16" fill="none" stroke="#7cc6e8" strokeWidth="3" strokeLinecap="round" />
      break
    case 'sleeping':
      eyes = <g fill="none" stroke={INK} strokeWidth="3.5" strokeLinecap="round"><path d={`M${eyeL - 7} ${eyeY - 2} Q${eyeL} ${eyeY + 6} ${eyeL + 7} ${eyeY - 2}`} /><path d={`M${eyeR - 7} ${eyeY - 2} Q${eyeR} ${eyeY + 6} ${eyeR + 7} ${eyeY - 2}`} /></g>
      mouth = <path d="M114 133 H126" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      extra = <text x="170" y="62" fontSize="20" fontWeight="700" fill="var(--label-2, #777)" fontFamily="Outfit Variable, sans-serif" className="capy-z">z</text>
      break
    case 'fainted':
      eyes = <g stroke={INK} strokeWidth="3.5" strokeLinecap="round">
        <path d={`M${eyeL - 6} ${eyeY - 6} L${eyeL + 6} ${eyeY + 6} M${eyeL + 6} ${eyeY - 6} L${eyeL - 6} ${eyeY + 6}`} />
        <path d={`M${eyeR - 6} ${eyeY - 6} L${eyeR + 6} ${eyeY + 6} M${eyeR + 6} ${eyeY - 6} L${eyeR - 6} ${eyeY + 6}`} /></g>
      mouth = <path d="M111 136 Q120 128 129 136" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
      extra = <g fill="#f5c542" className="capy-stars">{[[92, 46], [120, 38], [148, 46]].map(([x, y], i) => <path key={i} transform={`translate(${x} ${y})`} d="M0 -6 l1.8 4 4.2 .6 -3 3 .8 4.2 -3.8 -2 -3.8 2 .8 -4.2 -3 -3 4.2 -.6 z" />)}</g>
      break
    default:
      eyes = <g fill={INK}><circle cx={eyeL} cy={eyeY} r="5" /><circle cx={eyeR} cy={eyeY} r="5" /><circle cx={eyeL + 1.6} cy={eyeY - 1.6} r="1.4" fill="#fff" /><circle cx={eyeR + 1.6} cy={eyeY - 1.6} r="1.4" fill="#fff" /></g>
      mouth = <path d="M112 132 Q120 137 128 132" fill="none" stroke={INK} strokeWidth="3" strokeLinecap="round" />
  }
  return <g>{extra}{eyes}{mouth}</g>
}

/* ---------------- glasses ---------------- */
function Eyes({ id }) {
  switch (id) {
    case 'round': return <g fill="rgba(255,255,255,.18)" stroke="#2b2b2b" strokeWidth="3">
      <circle cx="94" cy="84" r="12" /><circle cx="146" cy="84" r="12" /><path d="M106 83 Q120 78 134 83" fill="none" />
    </g>
    case 'shades': return <g stroke="#111" strokeWidth="3">
      <rect x="77" y="74" width="34" height="20" rx="8" fill="#1c1c1e" /><rect x="129" y="74" width="34" height="20" rx="8" fill="#1c1c1e" />
      <path d="M111 82 H129" fill="none" /><path d="M83 79 l8 6" stroke="rgba(255,255,255,.35)" strokeWidth="2.5" />
    </g>
    default: return null
  }
}

/* ---------------- headwear ---------------- */
function Head({ id }) {
  switch (id) {
    case 'cap': return <g>
      <path d="M80 66 Q120 28 160 66 Z" fill="#f26b1d" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <path d="M150 64 Q176 62 184 70 Q166 74 148 70 Z" fill="#c94a0c" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="120" cy="40" r="4" fill="#c94a0c" stroke={INK} strokeWidth="2" />
    </g>
    case 'beanie': return <g>
      <path d="M78 70 Q80 30 120 28 Q160 30 162 70 Z" fill="#4a6fa5" stroke={INK} strokeWidth="2.5" />
      <rect x="74" y="62" width="92" height="14" rx="7" fill="#3a5a8a" stroke={INK} strokeWidth="2.5" />
      <circle cx="120" cy="24" r="8" fill="#f5f5f3" stroke={INK} strokeWidth="2.5" />
    </g>
    case 'flowers': return <g>
      {[[84, 64, '#f28ab2'], [102, 54, '#ffd166'], [120, 50, '#f26b1d'], [138, 54, '#8fd3a6'], [156, 64, '#b38cf2']].map(([x, y, c], i) =>
        <g key={i} transform={`translate(${x} ${y})`}>{[0, 72, 144, 216, 288].map(a => <circle key={a} cx={6 * Math.cos(a * Math.PI / 180)} cy={6 * Math.sin(a * Math.PI / 180)} r="5" fill={c} />)}<circle r="3.5" fill="#fff5cf" /></g>)}
    </g>
    case 'crown': return <g>
      <path d="M88 66 L92 36 L106 52 L120 30 L134 52 L148 36 L152 66 Z" fill="#f5c542" stroke={INK} strokeWidth="2.5" strokeLinejoin="round" />
      <circle cx="120" cy="56" r="4" fill="#c4281c" /><circle cx="102" cy="60" r="3" fill="#1d5fbf" /><circle cx="138" cy="60" r="3" fill="#1d5fbf" />
    </g>
    default: return null
  }
}

/** The capybara. `wear` is { slot: itemId }, `mood` from lib/pet.js petStatus. */
export default function Capybara({ mood = 'ok', wear = {}, size = 220, title }) {
  const sad = mood === 'fainted' || mood === 'tired'
  const clip = 'capy' + useId().replace(/[^a-zA-Z0-9]/g, '')   // unique per drawing on the page
  return <svg viewBox="0 0 240 240" width={size} height={size} role="img" aria-label={title} className={'capy capy-' + mood} style={{ display: 'block' }}>
    <defs><clipPath id={clip}><rect width="240" height="240" rx="28" /></clipPath></defs>
    <g clipPath={'url(#' + clip + ')'}>
      <Place id={wear.bg} />
      <House id={wear.house} />
      {/* the slump for a tired capybara sits on an outer group: a CSS transform (the breathing)
          replaces an SVG transform attribute on the same element */}
      <g transform={sad ? 'translate(0 8)' : undefined}><g className="capy-body">
        {wear.body === 'cape' && <path d="M66 140 Q120 118 174 140 L196 210 Q120 226 44 210 Z" fill="#c4281c" stroke={INK} strokeWidth="2" />}
        {/* body, feet and belly */}
        <ellipse cx="120" cy="170" rx="68" ry="42" fill={FUR} stroke={INK} strokeWidth="2.5" />
        <ellipse cx="120" cy="182" rx="40" ry="22" fill={FUR_LIGHT} />
        <ellipse cx="86" cy="208" rx="14" ry="8" fill={FUR_DARK} stroke={INK} strokeWidth="2" />
        <ellipse cx="154" cy="208" rx="14" ry="8" fill={FUR_DARK} stroke={INK} strokeWidth="2" />
        <Body id={wear.body} />
        {/* head, capybara-shaped: a boxy skull, tiny ears set high, eyes up top and a big blunt
            snout filling the lower half, nostrils as two short slants on top of it */}
        <ellipse cx="76" cy="60" rx="7" ry="6" fill={FUR_DARK} stroke={INK} strokeWidth="2.5" />
        <ellipse cx="164" cy="60" rx="7" ry="6" fill={FUR_DARK} stroke={INK} strokeWidth="2.5" />
        <rect x="66" y="56" width="108" height="98" rx="30" fill={FUR} stroke={INK} strokeWidth="2.5" />
        <rect x="78" y="98" width="84" height="54" rx="24" fill={FUR_DARK} opacity=".5" />
        <path d="M108 108 l5 6 M132 108 l-5 6" stroke={INK} strokeWidth="3.5" strokeLinecap="round" />
        <Neck id={wear.neck} />
        <Face mood={mood} />
        <Eyes id={wear.eyes} />
        <Head id={wear.head} />
      </g></g>
    </g>
  </svg>
}
