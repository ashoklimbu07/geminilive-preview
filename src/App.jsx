import { useState } from 'react'
import { useGeminiLive } from './hooks/useGeminiLive'
import { useSessions } from './hooks/useSessions'
import { usePlanner, loadTodayTasks } from './hooks/usePlanner'
import ConversationView from './ConversationView'
import PlanView from './PlanView'
import BrainThinking from './BrainThinking'
import TodayView from './TodayView'
import NavBar from './NavBar'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'models/gemini-2.5-flash-live-preview'

// Tier 1: keeps the user talking, and hands off to Tier 2 the moment a task lands cleanly.
const PLAN_TRIGGER_PHRASE = 'preparing your plan'
const LIVE_SYSTEM_INSTRUCTION = `You are a passive listener for a user brain-dumping tasks out loud.
Do NOT give advice, do NOT problem-solve, do NOT suggest plans or next steps yourself.

Default response: a short, warm acknowledgment that varies naturally — "got it", "okay", "noted", "mm-hmm" —
so it doesn't feel scripted. Keep it to 1-3 words.

If the user just stated something that sounds like a clear, complete, actionable task (a real, specific thing
to do, not vague rambling), respond with EXACTLY this sentence and nothing else: "Got you, preparing your
plan now." Use that exact sentence only when the task is genuinely clear — do not use it for vague or
incomplete input.

If something is genuinely ambiguous (missing time or deadline), ask a single short clarifying question
instead. Never ask more than one question in a row. Never stack multiple sentences otherwise.`

console.log('[gemini-live] config', {
  apiKeyConfigured: Boolean(API_KEY),
  apiKeyPreview: API_KEY ? `${API_KEY.slice(0, 6)}…${API_KEY.slice(-4)}` : null,
  model: MODEL,
})

function App() {
  const [view, setView] = useState(() => (loadTodayTasks().length > 0 ? 'today' : 'conversation')) // 'conversation' | 'processing' | 'plan' | 'today'
  const planner = usePlanner()

  const live = useGeminiLive({
    apiKey: API_KEY,
    model: MODEL,
    systemInstruction: LIVE_SYSTEM_INSTRUCTION,
    planTriggerPhrase: PLAN_TRIGGER_PHRASE,
    onPlanTrigger: handlePlanTrigger,
  })

  const { sessions, activeSessionId, viewingSessionId, setViewingSessionId, startNewSession, selectSession, deleteSession } =
    useSessions(live.messages)

  // Tier 1 -> Tier 2 handoff: the live conversation closes and the master prompt takes over.
  async function handlePlanTrigger(turnMessages) {
    setView('processing')
    const ok = await planner.generatePlanFromMessages(turnMessages)
    setView(ok ? 'plan' : 'conversation')
  }

  function toggleListening() {
    live.toggleListening(() => {
      startNewSession()
      live.resetTranscript()
    })
  }

  function handleDeleteSession(id) {
    deleteSession(id, { onDeleteActive: () => live.holdingRef.current && live.stopListening() })
  }

  function confirmPlan() {
    planner.confirmPlan(live.messages)
    live.resetTranscript()
    setView('today')
  }

  function dismissPlan() {
    planner.dismissPlan()
    setView('conversation')
  }

  function startNewBrainDump() {
    live.resetTranscript()
    setView('conversation')
  }

  const displayedMessages =
    viewingSessionId && viewingSessionId !== activeSessionId
      ? sessions.find((s) => s.id === viewingSessionId)?.messages || []
      : live.messages
  const isViewingPast = Boolean(viewingSessionId) && viewingSessionId !== activeSessionId

  return (
    <div className="min-h-screen bg-[radial-gradient(ellipse_120%_60%_at_50%_-10%,#ffd9b8_0%,#fff3ea_55%)] text-[#4a2f27] flex flex-col items-center px-4 pt-8 pb-28 md:pb-10 gap-6">
      <div className="w-full max-w-xl flex flex-col md:flex-row md:items-center md:justify-between gap-4">
        <div className="text-center md:text-left">
          <h1 className="text-2xl font-semibold tracking-tight bg-gradient-to-r from-rose-500 via-orange-400 to-pink-500 bg-clip-text text-transparent">
            Untangle
          </h1>
          <p className="text-[#8a6a5c] text-sm mt-1">Say it out loud. We'll untangle it into a plan.</p>
        </div>
        <div className="hidden md:block">
          <NavBar view={view} onNavigate={setView} todayCount={planner.todayTasks.filter((t) => !t.done).length} />
        </div>
      </div>

      {view === 'conversation' && (
        <ConversationView
          status={live.status}
          onToggleListening={toggleListening}
          displayedMessages={displayedMessages}
          isViewingPast={isViewingPast}
          onBackToCurrent={() => setViewingSessionId(activeSessionId)}
          planError={planner.planError}
          apiKeyConfigured={Boolean(API_KEY)}
          sessions={sessions}
          activeSessionId={activeSessionId}
          viewingSessionId={viewingSessionId}
          onSelectSession={selectSession}
          onDeleteSession={handleDeleteSession}
        />
      )}

      {view === 'processing' && <BrainThinking />}

      {view === 'plan' && (
        <PlanView
          plan={planner.plan}
          onMove={planner.moveChunk}
          onRemove={planner.removeChunk}
          onToggleDone={planner.toggleChunkDone}
          onConfirm={confirmPlan}
          onDismiss={dismissPlan}
        />
      )}

      {view === 'today' && (
        <TodayView
          tasks={planner.todayTasks}
          onToggleDone={planner.toggleTodayTask}
          onDeleteTask={planner.deleteTodayTask}
          onNewBrainDump={startNewBrainDump}
        />
      )}

      <div className="md:hidden">
        <NavBar view={view} onNavigate={setView} todayCount={planner.todayTasks.filter((t) => !t.done).length} />
      </div>
    </div>
  )
}

export default App
