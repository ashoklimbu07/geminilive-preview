import { STATUS } from './hooks/useGeminiLive'

function TalkButton({ status, onClick }) {
  return (
    <div className="relative w-32 h-32 flex items-center justify-center">
      {status === 'listening' && (
        <>
          <span className="absolute inset-0 rounded-full bg-orange-400/40 animate-ping" />
          <span className="absolute -inset-3 rounded-full bg-orange-400/20 animate-[ping_1.6s_ease-in-out_infinite]" />
          <span className="absolute -inset-6 rounded-full bg-orange-400/10 animate-[ping_2.2s_ease-in-out_infinite]" />
        </>
      )}
      <button
        type="button"
        onClick={onClick}
        className={`relative z-10 w-32 h-32 rounded-full flex items-center justify-center text-sm font-medium select-none transition-transform active:scale-95
          ${status === 'listening' ? 'bg-orange-500 shadow-[0_0_0_10px_rgba(249,115,22,0.2)]' : 'bg-rose-500 hover:bg-rose-400 shadow-[0_0_0_10px_rgba(244,63,94,0.15)]'} text-white`}
      >
        {status === 'listening' ? 'Stop' : status === 'connecting' ? 'Connecting…' : 'Tap to talk'}
      </button>
    </div>
  )
}

function TranscriptBox({ messages }) {
  return (
    <div className="w-full flex-1 flex flex-col gap-3 bg-white/80 border border-[#f0d0b8] rounded-xl p-4 min-h-[300px] max-h-[50vh] overflow-y-auto">
      {messages.length === 0 && (
        <p className="text-[#a68f86] text-sm m-auto text-center px-6">
          Brain-dump whatever's on your mind, and we'll turn it into a plan. After your conversation ,say plan my
          brian dump"
        </p>
      )}
      {messages.map((m, i) => (
        <div
          key={i}
          className={`max-w-[85%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
            m.role === 'user' ? 'self-end bg-rose-500/15 text-rose-700' : 'self-start bg-[#ffe4cf] text-[#5c4438]'
          }`}
        >
          <span className="block text-[10px] uppercase tracking-wide opacity-60 mb-0.5">
            {m.role === 'user' ? 'You' : 'Untangle'}
          </span>
          {m.text}
        </div>
      ))}
    </div>
  )
}

function SessionList({ sessions, activeSessionId, viewingSessionId, status, onSelect, onDelete }) {
  if (sessions.length === 0) return null
  return (
    <div className="w-full flex flex-col gap-2">
      <h2 className="text-xs font-semibold uppercase tracking-wide text-[#a68f86]">Sessions</h2>
      <div className="flex flex-col gap-1.5 max-h-48 overflow-y-auto">
        {sessions.map((s) => (
          <div
            key={s.id}
            className={`flex items-center justify-between gap-2 px-3 py-2 rounded-lg border text-xs transition-colors ${
              viewingSessionId === s.id
                ? 'bg-rose-500/10 border-rose-300 text-rose-700'
                : 'bg-white/70 border-[#f0d0b8] text-[#6b4f43] hover:bg-white'
            }`}
          >
            <button
              type="button"
              onClick={() => onSelect(s.id)}
              className="flex-1 text-left flex items-center gap-2 min-w-0"
            >
              {s.id === activeSessionId && status === 'listening' && (
                <span className="relative flex h-2 w-2 shrink-0">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-orange-400 opacity-75" />
                  <span className="relative inline-flex rounded-full h-2 w-2 bg-orange-500" />
                </span>
              )}
              <span className="truncate">
                {new Date(s.startedAt).toLocaleString()} · {s.messages.length} msg
                {s.messages.length === 1 ? '' : 's'}
              </span>
            </button>
            <button
              type="button"
              onClick={() => onDelete(s.id)}
              title="Delete session"
              className="shrink-0 text-[#c98a6e] hover:text-red-500 font-semibold px-1.5"
            >
              ✕
            </button>
          </div>
        ))}
      </div>
    </div>
  )
}

export default function ConversationView({
  status,
  onToggleListening,
  displayedMessages,
  isViewingPast,
  onBackToCurrent,
  planError,
  apiKeyConfigured,
  sessions,
  activeSessionId,
  viewingSessionId,
  onSelectSession,
  onDeleteSession,
}) {
  const st = STATUS[status]

  return (
    <div className="w-full max-w-xl flex flex-col items-center gap-8 animate-[fadein_.3s_ease]">
      <div className="flex items-center gap-2 text-sm text-[#8a6a5c]">
        <span className={`inline-block w-2.5 h-2.5 rounded-full ${st.color}`} />
        {st.label}
      </div>

      <TalkButton status={status} onClick={onToggleListening} />

      {isViewingPast && (
        <div className="w-full flex items-center justify-between text-xs text-[#8a6a5c] bg-[#fff3ea] border border-[#f0d0b8] rounded-lg px-3 py-2">
          <span>Viewing a past session's transcript (read-only)</span>
          <button type="button" onClick={onBackToCurrent} className="text-rose-600 font-medium hover:underline">
            Back to current
          </button>
        </div>
      )}

      <TranscriptBox messages={displayedMessages} />

      {planError && <p className="text-red-400 text-xs max-w-md text-center">{planError}</p>}

      {!apiKeyConfigured && (
        <p className="text-red-400 text-xs max-w-md text-center">
          No API key found. Add VITE_GEMINI_API_KEY to the .env file at the project root, then restart `npm run dev`.
        </p>
      )}

      <SessionList
        sessions={sessions}
        activeSessionId={activeSessionId}
        viewingSessionId={viewingSessionId}
        status={status}
        onSelect={onSelectSession}
        onDelete={onDeleteSession}
      />
    </div>
  )
}
