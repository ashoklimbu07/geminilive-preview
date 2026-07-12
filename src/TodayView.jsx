// Post-confirmation home base: today's tasks as a calm, tappable checklist.
function TaskRow({ task, onToggleDone }) {
  return (
    <li>
      <button
        type="button"
        onClick={() => onToggleDone(task.id)}
        className={`w-full flex items-start gap-3 rounded-2xl px-4 py-3.5 text-left transition-colors border ${
          task.done
            ? 'bg-neutral-900/60 border-neutral-800'
            : 'bg-neutral-900 border-neutral-800 hover:border-teal-500/40'
        }`}
      >
        <span
          className={`mt-0.5 shrink-0 w-6 h-6 rounded-full border-2 flex items-center justify-center transition-colors ${
            task.done ? 'bg-teal-400 border-teal-400 text-neutral-900' : 'border-neutral-600 text-transparent'
          }`}
        >
          ✓
        </span>
        <span className="flex-1 min-w-0">
          <span className={`block text-sm ${task.done ? 'line-through text-neutral-500' : 'text-neutral-100'}`}>
            {task.title}
          </span>
          <span className="mt-1 flex items-center gap-2 flex-wrap text-[11px] text-neutral-400">
            <span className="px-1.5 py-0.5 rounded-full bg-neutral-800">{task.estimate_minutes} min</span>
            {task.deadline && <span className="px-1.5 py-0.5 rounded-full bg-amber-400/10 text-amber-300">due {task.deadline}</span>}
            {task.is_quick_win && (
              <span className="px-1.5 py-0.5 rounded-full bg-teal-400/10 text-teal-300">quick win</span>
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
          <h2 className="text-lg font-semibold text-neutral-100">Today</h2>
          <p className="text-xs text-neutral-400 mt-0.5">
            {total === 0 ? 'No tasks yet' : `${done} of ${total} done`}
          </p>
        </div>
        <div className="w-12 h-12 rounded-full bg-neutral-900 border border-neutral-800 flex items-center justify-center relative">
          <svg viewBox="0 0 36 36" className="w-full h-full -rotate-90">
            <circle cx="18" cy="18" r="15.5" fill="none" stroke="#262626" strokeWidth="3" />
            <circle
              cx="18"
              cy="18"
              r="15.5"
              fill="none"
              stroke="#5eead4"
              strokeWidth="3"
              strokeLinecap="round"
              strokeDasharray={2 * Math.PI * 15.5}
              strokeDashoffset={2 * Math.PI * 15.5 * (1 - pct / 100)}
              className="transition-all duration-500"
            />
          </svg>
          <span className="absolute text-[10px] font-medium text-teal-300">{pct}%</span>
        </div>
      </div>

      {allDone && (
        <div className="rounded-2xl bg-teal-400/10 border border-teal-400/30 px-4 py-3 text-sm text-teal-200">
          Nice work — everything's cleared for today. 🎉
        </div>
      )}

      {total === 0 ? (
        <p className="text-neutral-500 text-sm text-center py-10">
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
        className="self-center mt-2 text-xs px-4 py-2 rounded-full bg-neutral-900 border border-neutral-800 hover:border-teal-500/40 text-neutral-300"
      >
        + New brain dump
      </button>
    </div>
  )
}
