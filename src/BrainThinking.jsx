import { useEffect, useState } from 'react'

const STEPS = [
  'Listening back through everything you said',
  'Pulling out the real, doable tasks',
  'Untangling the mess into small steps',
  'Sorting what matters first',
  'Wrapping it up with care',
]

const STEP_MS = 1100

// A little "brain at work" moment between the brain-dump and the plan: a pulsing
// brain glyph plus a step timeline so the wait reads as productive, not empty.
export default function BrainThinking() {
  const [stepIndex, setStepIndex] = useState(0)

  useEffect(() => {
    const id = setInterval(() => {
      setStepIndex((i) => Math.min(i + 1, STEPS.length - 1))
    }, STEP_MS)
    return () => clearInterval(id)
  }, [])

  return (
    <div className="flex flex-col items-center gap-8 py-14 animate-[fadein_.3s_ease] w-full max-w-sm">
      <div className="relative w-24 h-24 flex items-center justify-center">
        <span className="absolute inset-0 rounded-full bg-rose-400/20 animate-ping" />
        <span className="absolute inset-2 rounded-full bg-rose-400/10 animate-pulse" />
        <svg viewBox="0 0 64 64" className="w-14 h-14 relative text-rose-500 drop-shadow-[0_0_10px_rgba(251,113,133,0.5)]">
          <path
            d="M32 8c-8 0-14 5-14 12 0 3 1 5 3 7-3 2-5 5-5 9 0 7 6 12 13 12h6c7 0 13-5 13-12 0-4-2-7-5-9 2-2 3-4 3-7 0-7-6-12-14-12z"
            fill="none"
            stroke="currentColor"
            strokeWidth="2.5"
            strokeLinejoin="round"
            className="animate-pulse"
          />
          <path d="M26 20c2 2 2 5 0 7M38 20c-2 2-2 5 0 7M28 34c1 3 3 4 4 4s3-1 4-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" opacity="0.85" />
        </svg>
      </div>

      <ol className="w-full flex flex-col gap-3">
        {STEPS.map((label, i) => {
          const state = i < stepIndex ? 'done' : i === stepIndex ? 'active' : 'pending'
          return (
            <li key={label} className="flex items-center gap-3">
              <span
                className={`shrink-0 w-5 h-5 rounded-full flex items-center justify-center text-[10px] transition-colors duration-300 ${
                  state === 'done'
                    ? 'bg-rose-400 text-white'
                    : state === 'active'
                      ? 'bg-rose-400/20 text-rose-600 ring-2 ring-rose-400 animate-pulse'
                      : 'bg-[#ffe4cf] text-[#c9a898]'
                }`}
              >
                {state === 'done' ? '✓' : i + 1}
              </span>
              <span
                className={`text-sm transition-colors duration-300 ${
                  state === 'pending' ? 'text-[#c9a898]' : state === 'active' ? 'text-[#4a2f27]' : 'text-[#8a6a5c]'
                }`}
              >
                {label}
              </span>
              {state === 'active' && (
                <span className="ml-auto flex gap-0.5">
                  <span className="w-1 h-1 rounded-full bg-rose-500 animate-bounce [animation-delay:-0.2s]" />
                  <span className="w-1 h-1 rounded-full bg-rose-500 animate-bounce [animation-delay:-0.1s]" />
                  <span className="w-1 h-1 rounded-full bg-rose-500 animate-bounce" />
                </span>
              )}
            </li>
          )
        })}
      </ol>
    </div>
  )
}
