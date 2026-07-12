// Post-confirmation home base: today's tasks as a calm, tappable checklist.
function TaskRow({ task, onToggleDone }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onToggleDone(task.id)}
        className={`w-full flex items-start gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors border ${
          task.done
            ? 'bg-white/50 border-[#f0d0b8]'
            : 'bg-white/80 border-[#f0d0b8] hover:border-rose-400/50'
        }`}
      >
        <span
          className={`mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
            task.done ? 'bg-rose-400 border-rose-400 text-white' : 'border-[#e3b9a0] text-transparent'
          }`}
        >
          ✓
        </span>
        <span className="flex-1 min-w-0">
          <span className={`block text-sm ${task.done ? 'line-through text-[#a68f86]' : 'text-[#4a2f27]'}`}>
            {task.title}
          </span>
          <span className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-[#8a6a5c]">
            <span className="px-1.5 py-0.5 rounded-full bg-[#ffe4cf]">{task.estimate_minutes} min</span>
            {task.deadline && <span className="px-1.5 py-0.5 rounded-full bg-amber-400/15 text-amber-700">due {task.deadline}</span>}
            {task.is_quick_win && (
              <span className="px-1.5 py-0.5 rounded-full bg-rose-400/15 text-rose-600">quick win</span>
            )}
          </span>
        </span>
      </button>
    </li>
  )
}

export default function TodayView({ tasks, onToggleDone, onNewBrainDump }) {
  const total = tasks.length
  const done = tasks.filter((t) => t.done).length
  const pct = total ? Math.round((done / total) * 100) : 0
  const allDone = total > 0 && done === total

  return (
    <div className="w-full max-w-xl flex flex-col gap-5 animate-[fadein_.3s_ease]">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-lg font-semibold text-[#4a2f27]">Today</h2>
          <p className="text-xs text-[#8a6a5c] mt-0.5">
            {total === 0 ? 'No tasks yet' : `${done} of ${total} done`}
          </p>
        </div>
        <div className="w-12 h-12 rounded-full bg-white/80 border border-[#f0d0b8] flex items-center justify-center relative">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#f0d0b8" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="#fb7185"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 15.5}
              strokeDashoffset={2 * Math.PI * 15.5 * (1 - pct / 100)}
              className="transition-all duration-500"
            />
          </svg>
          <span className="absolute text-[10px] font-medium text-rose-500">{pct}%</span>
        </div>
      </div>

      {allDone && (
        <div className="rounded-2xl bg-rose-400/10 border border-rose-400/30 px-4 py-3 text-sm text-rose-700">
          Nice work — everything's cleared for today. 🎉
        </div>
      )}

      {total === 0 ? (
        <p className="text-[#a68f86] text-sm text-center py-10">
          Nothing on the list yet. Start a brain dump to fill your day.
        </p>
      ) : (
        <ul className="flex flex-col gap-2.5">
          {tasks.map((t) => (
            <TaskRow key={t.id} task={t} onToggleDone={onToggleDone} />
          ))}
        </ul>
      )}

      <button
        type="button"
        onClick={onNewBrainDump}
        className="self-center mt-2 text-xs px-4 py-2 rounded-full bg-white/80 border border-[#f0d0b8] hover:border-rose-400/50 text-[#7a6055]"
      >
        + New brain dump
      </button>
    </div>
  )
}
