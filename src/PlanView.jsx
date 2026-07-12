// Tier 2 output: a structured plan rendered as a checklist/timeline, visually distinct from chat.
function ChunkRow({ chunk, index, total, onMove, onRemove, onToggleDone }) {
  return (
    <li className="flex items-start gap-2 bg-neutral-800/70 rounded-lg px-3 py-2">
      <input
        type="checkbox"
        checked={Boolean(chunk.done)}
        onChange={() => onToggleDone(chunk.id)}
        className="mt-1 accent-violet-500"
      />
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-2 flex-wrap">
          <span className={`text-sm ${chunk.done ? 'line-through text-neutral-500' : 'text-neutral-100'}`}>
            {chunk.title}
          </span>
          {chunk.is_quick_win && (
            <span className="text-[10px] uppercase tracking-wide bg-emerald-600/30 text-emerald-300 px-1.5 py-0.5 rounded">
              quick win
            </span>
          )}
        </div>
        <div className="text-[11px] text-neutral-400 mt-0.5 flex gap-3 flex-wrap">
          <span>{chunk.estimate_minutes} min</span>
          {chunk.deadline && <span>due {chunk.deadline}</span>}
          <span className="uppercase tracking-wide">{chunk.platform_hint}</span>
        </div>
      </div>
      <div className="flex flex-col gap-1 shrink-0">
        <button
          type="button"
          disabled={index === 0}
          onClick={() => onMove(index, -1)}
          className="text-neutral-400 hover:text-neutral-100 disabled:opacity-20 text-xs px-1"
        >
          ▲
        </button>
        <button
          type="button"
          disabled={index === total - 1}
          onClick={() => onMove(index, 1)}
          className="text-neutral-400 hover:text-neutral-100 disabled:opacity-20 text-xs px-1"
        >
          ▼
        </button>
      </div>
      <button
        type="button"
        onClick={() => onRemove(chunk.id)}
        className="text-neutral-500 hover:text-red-400 text-xs px-1 shrink-0"
      >
        ✕
      </button>
    </li>
  )
}

export default function PlanView({ plan, onMove, onRemove, onToggleDone, onConfirm, onDismiss }) {
  if (!plan) return null

  if (plan.mode === 'needs_human_support') {
    return (
      <div className="w-full max-w-xl bg-amber-950/40 border border-amber-800/60 rounded-xl p-4 text-sm text-amber-100 animate-[fadein_.3s_ease]">
        <p className="font-medium mb-1">{plan.summary}</p>
        <p>{plan.support_note}</p>
        <button type="button" onClick={onDismiss} className="mt-3 text-xs text-amber-300 hover:text-amber-100">
          Close
        </button>
      </div>
    )
  }

  if (plan.mode === 'outside_scope') {
    return (
      <div className="w-full max-w-xl bg-neutral-800 rounded-xl p-4 text-sm text-neutral-200 animate-[fadein_.3s_ease]">
        <p>{plan.summary}</p>
        <button type="button" onClick={onDismiss} className="mt-3 text-xs text-neutral-400 hover:text-neutral-100">
          Close
        </button>
      </div>
    )
  }

  return (
    <div className="w-full max-w-xl bg-neutral-900 border border-violet-800/40 rounded-xl p-4 flex flex-col gap-3 animate-[fadein_.35s_ease]">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold text-violet-300 uppercase tracking-wide">Your plan</h2>
        <button type="button" onClick={onDismiss} className="text-neutral-500 hover:text-neutral-100 text-xs">
          ✕
        </button>
      </div>

      <p className="text-sm text-neutral-200">{plan.summary}</p>

      {plan.clarifying_question && (
        <p className="text-xs text-yellow-300 bg-yellow-900/20 rounded px-2 py-1.5">{plan.clarifying_question}</p>
      )}

      {plan.chunks.length > 0 && (
        <ul className="flex flex-col gap-2">
          {plan.chunks.map((c, i) => (
            <ChunkRow
              key={c.id}
              chunk={c}
              index={i}
              total={plan.chunks.length}
              onMove={onMove}
              onRemove={onRemove}
              onToggleDone={onToggleDone}
            />
          ))}
        </ul>
      )}

      {plan.alternative_solutions?.length > 0 && (
        <div className="flex flex-col gap-2">
          <h3 className="text-xs uppercase tracking-wide text-neutral-400">Other ways forward</h3>
          {plan.alternative_solutions.map((a, i) => (
            <div key={i} className="bg-neutral-800/70 rounded-lg px-3 py-2 text-sm text-neutral-200">
              <span className="text-[10px] uppercase tracking-wide text-violet-400 block mb-0.5">
                {a.type.replace(/_/g, ' ')}
              </span>
              {a.description}
            </div>
          ))}
        </div>
      )}

      {plan.has_more && (
        <p className="text-[11px] text-neutral-500">There's more to this plan — confirm this phase to see the next one.</p>
      )}

      {plan.encouragement && <p className="text-sm text-neutral-400 italic">{plan.encouragement}</p>}

      <div className="flex justify-end gap-2 pt-1">
        <button
          type="button"
          onClick={onDismiss}
          className="text-xs px-3 py-1.5 rounded-md text-neutral-400 hover:text-neutral-100"
        >
          Discard
        </button>
        <button
          type="button"
          onClick={onConfirm}
          className="text-xs px-3 py-1.5 rounded-md bg-violet-600 hover:bg-violet-500 text-white"
        >
          Confirm plan
        </button>
      </div>
    </div>
  )
}
