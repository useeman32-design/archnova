import type { FinishOption } from '@/types'

export interface HouseIllustrationProps {
  roof?: string
  exterior?: FinishOption
  showPool?: boolean
  showGarage?: boolean
  showGarden?: boolean
  variant?: number
  className?: string
}

const WALL: Record<FinishOption, string> = {
  render: '#f5f7fa',
  paint: '#e9eef6',
  brick: '#d9c9b8',
  stone: '#c9cdd3',
  wood: '#d8b58c',
  glass: '#dfe9f5',
}

/**
 * Parametric architectural illustration rendered entirely with SVG.
 * Replaces the reference mockup's raster artwork with something scalable and
 * themeable; the same component can later be swapped for a real Three.js view.
 */
export function HouseIllustration({
  roof = 'flat',
  exterior = 'render',
  showPool = false,
  showGarage = false,
  showGarden = true,
  variant = 0,
  className = '',
}: HouseIllustrationProps) {
  const wall = WALL[exterior] ?? WALL.render
  const roofFill = '#2c3a4d'
  const roofEdge = '#1d2a3b'
  const glass = '#bcd6f2'
  const sunX = 330 - (variant % 3) * 22

  const bodyX = 96
  const bodyY = 132
  const bodyW = 196
  const bodyH = 86

  const roofPath =
    roof === 'flat'
      ? null
      : roof === 'pitched-gable' || roof === 'hip'
        ? roof === 'hip'
          ? 'M78 140 L200 88 L322 140 L296 148 L200 112 L104 148 Z'
          : 'M78 138 L200 84 L322 138 L322 148 L78 148 Z'
        : 'M104 146 L288 120 L288 148 L104 148 Z'

  return (
    <svg viewBox="0 0 400 300" className={className} role="img" aria-label="Architectural house illustration">
      <defs>
        <linearGradient id={`sky-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor="#e8f1ff" />
          <stop offset="60%" stopColor="#dbe8fb" />
          <stop offset="100%" stopColor="#f2f6fb" />
        </linearGradient>
        <linearGradient id={`wall-${variant}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={wall} />
          <stop offset="100%" stopColor="#e3e8ef" />
        </linearGradient>
        <linearGradient id={`pool-${variant}`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" stopColor="#bfe0f7" />
          <stop offset="100%" stopColor="#8fc6e8" />
        </linearGradient>
      </defs>

      <rect width="400" height="300" fill={`url(#sky-${variant})`} />
      <circle cx={sunX} cy="58" r="30" fill="#ffe0a3" opacity="0.35" />
      <circle cx={sunX} cy="58" r="20" fill="#ffd98a" />
      <circle cx="84" cy="62" r="16" fill="#ffffff" opacity="0.75" />
      <circle cx="108" cy="52" r="12" fill="#ffffff" opacity="0.65" />

      {/* distant ridgeline */}
      <path d="M0 214 Q110 176 210 200 T400 196 L400 300 L0 300 Z" fill="#cfe0d0" opacity="0.85" />
      <path d="M0 232 Q130 206 250 226 T400 224 L400 300 L0 300 Z" fill="#dbe8d8" />

      {/* garden */}
      {showGarden ? (
        <>
          <rect x="40" y="226" width="104" height="42" rx="8" fill="#e2ead6" />
          <path d="M52 244 h12 v-10 h12 v12 h14 v-16 h14 v18 h12 v-14 h10 v14 h14 v-12 h12 v12 h10" fill="none" stroke="#a9c48f" strokeWidth="3" strokeLinecap="round" />
          <circle cx="122" cy="238" r="13" fill="#bcd6a4" />
          <rect x="296" y="232" width="72" height="36" rx="8" fill="#e2ead6" />
          <circle cx="316" cy="246" r="12" fill="#bcd6a4" />
          <circle cx="346" cy="240" r="10" fill="#c7ddb0" />
        </>
      ) : null}

      {/* garage */}
      {showGarage ? (
        <g>
          <rect x="300" y="152" width="66" height="62" rx="4" fill={`url(#wall-${variant})`} stroke="#d3dbe4" />
          <path d="M300 152 L333 122 L366 152" fill="none" stroke={roofEdge} strokeWidth="4" strokeLinejoin="round" />
          <rect x="306" y="162" width="54" height="42" rx="3" fill="#c7d3e2" />
          <path d="M333 162 V204 M306 183 H360" stroke="#dbe4ee" strokeWidth="2" />
        </g>
      ) : null}

      {/* pool */}
      {showPool ? (
        <g>
          <ellipse cx="120" cy="266" rx="52" ry="18" fill={`url(#pool-${variant})`} stroke="#9dc9e6" strokeWidth="2" />
          <ellipse cx="120" cy="264" rx="44" ry="13" fill="none" stroke="#ffffff" strokeWidth="2" opacity="0.7" />
          <path d="M104 262 q8 -5 16 0 t16 0 t16 0" fill="none" stroke="#ffffff" strokeWidth="1.6" opacity="0.8" />
        </g>
      ) : null}

      {/* main body */}
      <rect x={bodyX} y={bodyY} width={bodyW} height={bodyH} rx="4" fill={`url(#wall-${variant})`} stroke="#d5dde6" />
      {roofPath ? (
        <path d={roofPath} fill={roofFill} stroke={roofEdge} strokeWidth="2" strokeLinejoin="round" />
      ) : (
        <rect x={bodyX - 10} y={bodyY - 14} width={bodyW + 20} height="16" rx="3" fill={roofFill} stroke={roofEdge} />
      )}

      {/* glazing */}
      <g stroke="#d8e2ec" strokeWidth="2">
        <rect x={bodyX + 16} y={bodyY + 18} width="34" height="30" rx="2" fill={glass} />
        <rect x={bodyX + 60} y={bodyY + 18} width="26" height="30" rx="2" fill={glass} />
        <rect x={bodyX + 106} y={bodyY + 18} width="34" height="30" rx="2" fill={glass} />
        <rect x={bodyX + 148} y={bodyY + 18} width="30" height="30" rx="2" fill={glass} />
        <path d={`M${bodyX + 33} ${bodyY + 18} V${bodyY + 48} M${bodyX + 73} ${bodyY + 18} V${bodyY + 48}`} stroke="#f0f5fb" />
        <path d={`M${bodyX + 123} ${bodyY + 18} V${bodyY + 48} M${bodyX + 163} ${bodyY + 18} V${bodyY + 48}`} stroke="#f0f5fb" />
      </g>

      {/* entrance door */}
      <rect x={bodyX + 78} y={bodyY + 56} width="40" height="30" rx="2" fill="#7d8b9c" />
      <rect x={bodyX + 80} y={bodyY + 58} width="36" height="26" rx="2" fill="#96a4b6" />
      <circle cx={bodyX + 113} cy={bodyY + 74} r="1.6" fill="#f6f8fb" />

      {/* carport / car */}
      {!showGarage ? (
        <g>
          <rect x="150" y="214" width="74" height="26" rx="4" fill="#d6dde6" opacity="0.9" />
          <rect x="158" y="212" width="48" height="18" rx="5" fill="#5f7186" />
          <rect x="164" y="214" width="36" height="10" rx="3" fill="#93a6bb" />
          <circle cx="167" cy="230" r="4" fill="#2f3b48" />
          <circle cx="195" cy="230" r="4" fill="#2f3b48" />
        </g>
      ) : null}

      {/* tree */}
      <g>
        <rect x="48" y="196" width="6" height="32" rx="3" fill="#8a7358" />
        <circle cx="51" cy="190" r="17" fill="#b8d2a6" />
        <circle cx="40" cy="198" r="12" fill="#c4d9b2" />
        <circle cx="63" cy="197" r="12" fill="#c4d9b2" />
      </g>

      {/* ground shadow */}
      <ellipse cx="200" cy="222" rx="130" ry="9" fill="#0b1220" opacity="0.07" />
    </svg>
  )
}
