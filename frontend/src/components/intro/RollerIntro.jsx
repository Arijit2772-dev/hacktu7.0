import { useEffect } from 'react'

const INTRO_DURATION_MS = 3200
const REDUCED_MOTION_DURATION_MS = 700

export default function RollerIntro({ onComplete }) {
  useEffect(() => {
    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches
    const timeoutMs = prefersReducedMotion ? REDUCED_MOTION_DURATION_MS : INTRO_DURATION_MS
    const timeoutId = window.setTimeout(() => onComplete?.(), timeoutMs)
    return () => window.clearTimeout(timeoutId)
  }, [onComplete])

  return (
    <div className="intro-screen fixed inset-0 z-[140] overflow-hidden">
      <div className="intro-paint-layer absolute inset-0" />
      <div className="relative h-full w-full flex items-center justify-center">
        <div className="intro-roller-wrap">
          <svg
            viewBox="0 0 260 280"
            role="img"
            aria-label="Paint roller intro"
            className="intro-roller h-56 w-56 md:h-64 md:w-64"
          >
            <g
              fill="none"
              stroke="#f0b44c"
              strokeWidth="8"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M71 104h118c11 0 20 9 20 20v21c0 11-9 20-20 20H90c-11 0-20-9-20-20v-21c0-11 9-20 20-20z" />
              <path d="M70 117H53c-8 0-14 6-14 14v16c0 8 6 14 14 14h37" />
              <path d="M90 165v22c0 19 15 34 34 34h18" />
              <path d="M142 221v35c0 9 7 16 16 16h9c9 0 16-7 16-16v-35c0-9-7-16-16-16h-9c-9 0-16 7-16 16z" />
              <path d="M82 101c18-15 31-12 42-27 6-8 9-18 13-22 3 8 11 18 22 25 16 10 27 28 38 41" />
              <path d="M114 74c7 5 15 8 22 7" />
              <path d="M153 88c7 4 15 6 24 5" />
              <path d="M174 75c4 4 6 9 6 14" />
            </g>
          </svg>
        </div>
      </div>
      <p className="intro-tagline absolute bottom-12 left-1/2 -translate-x-1/2 text-xs md:text-sm tracking-[0.24em] uppercase text-amber-100/80">
        PaintFlow.ai
      </p>
    </div>
  )
}
