import { useEffect, useRef, useState } from 'react'
import { MicStreamer, AudioPlayer } from './audio'
import { generatePlan } from './masterPrompt'
import PlanView from './PlanView'

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

const PLAN_STORAGE_KEY = 'task-chunking:last-session'

console.log('[gemini-live] config', {
  apiKeyConfigured: Boolean(API_KEY),
  apiKeyPreview: API_KEY ? `${API_KEY.slice(0, 6)}…${API_KEY.slice(-4)}` : null,
  model: MODEL,
})

const STATUS = {
  idle: { label: 'Idle', color: 'bg-gray-400' },
  connecting: { label: 'Connecting…', color: 'bg-yellow-400' },
  connected: { label: 'Connected', color: 'bg-green-500' },
  listening: { label: 'Listening', color: 'bg-red-500' },
  error: { label: 'Error', color: 'bg-red-700' },
}

function App() {
  const [status, setStatus] = useState('idle')
  const [messages, setMessages] = useState([]) // {role: 'user'|'model', text, streaming, timestamp}
  const [view, setView] = useState('conversation') // 'conversation' | 'processing' | 'plan'
  const [plan, setPlan] = useState(null)
  const [planLoading, setPlanLoading] = useState(false)
  const [planError, setPlanError] = useState(null)
  const wsRef = useRef(null)
  const micRef = useRef(null)
  const playerRef = useRef(null)
  const holdingRef = useRef(false)
  const userTurnRef = useRef('')
  const modelTurnRef = useRef('')
  const messagesRef = useRef([])

  useEffect(() => {
    messagesRef.current = messages
  }, [messages])

  useEffect(() => {
    return () => {
      wsRef.current?.close()
      micRef.current?.stop()
      playerRef.current?.close()
    }
  }, [])

  function appendOrCreate(role, text) {
    setMessages((prev) => {
      const last = prev[prev.length - 1]
      if (last && last.role === role && last.streaming) {
        const copy = [...prev]
        copy[copy.length - 1] = { ...last, text: last.text + text }
        return copy
      }
      return [...prev, { role, text, streaming: true, timestamp: Date.now() }]
    })
  }

  // The live API can stream the model's reply before the user's own transcript for the
  // same turn has finished arriving, so we buffer both and flush them in the right order
  // (user first, then model) once the turn is actually complete.
  function finalizeTurn() {
    const userText = userTurnRef.current.trim()
    const modelText = modelTurnRef.current.trim()

    setMessages((prev) => {
      const next = prev.map((m) => ({ ...m, streaming: false }))
      if (userText) next.push({ role: 'user', text: userText, streaming: false, timestamp: Date.now() })
      if (modelText) next.push({ role: 'model', text: modelText, streaming: false, timestamp: Date.now() })
      return next
    })

    const trigger = modelText.toLowerCase().includes(PLAN_TRIGGER_PHRASE)
    userTurnRef.current = ''
    modelTurnRef.current = ''
    if (trigger) handlePlanTrigger()
  }

  // Tier 1 -> Tier 2 handoff: the live conversation closes and the master prompt takes over.
  async function handlePlanTrigger() {
    stopListening()
    setPlanError(null)
    setView('processing')

    const userText = messagesRef.current
      .filter((m) => m.role === 'user' && m.text.trim())
      .map((m) => m.text.trim())
      .join('\n')

    if (!userText) {
      setPlanError('Nothing captured yet — talk for a bit first.')
      setView('conversation')
      return
    }

    try {
      const result = await generatePlan(userText)
      setPlan({ ...result, chunks: result.chunks.map((c) => ({ ...c, done: false })) })
      setView('plan')
    } catch (err) {
      console.error('[master-prompt] failed to generate plan', err instanceof Error ? err.message : err)
      setPlanError(err instanceof Error ? err.message : String(err))
      setView('conversation')
    }
  }

  // Tier 2: freeze the transcript and hand only the user's utterances to the master prompt.
  async function preparePlan() {
    const userText = messages
      .filter((m) => m.role === 'user' && m.text.trim())
      .map((m) => m.text.trim())
      .join('\n')

    if (!userText) {
      setPlanError('Nothing captured yet — talk for a bit first.')
      return
    }

    setPlanError(null)
    setPlanLoading(true)
    try {
      const result = await generatePlan(userText)
      setPlan({ ...result, chunks: result.chunks.map((c) => ({ ...c, done: false })) })
      setView('plan')
    } catch (err) {
      console.error('[master-prompt] failed to generate plan', err instanceof Error ? err.message : err)
      setPlanError(err instanceof Error ? err.message : String(err))
    } finally {
      setPlanLoading(false)
    }
  }

  function moveChunk(index, delta) {
    setPlan((prev) => {
      if (!prev) return prev
      const chunks = [...prev.chunks]
      const target = index + delta
      if (target < 0 || target >= chunks.length) return prev
      ;[chunks[index], chunks[target]] = [chunks[target], chunks[index]]
      return { ...prev, chunks }
    })
  }

  function removeChunk(id) {
    setPlan((prev) => (prev ? { ...prev, chunks: prev.chunks.filter((c) => c.id !== id) } : prev))
  }

  function toggleChunkDone(id) {
    setPlan((prev) =>
      prev ? { ...prev, chunks: prev.chunks.map((c) => (c.id === id ? { ...c, done: !c.done } : c)) } : prev
    )
  }

  function confirmPlan() {
    if (!plan) return
    try {
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), transcript: messages, plan }))
    } catch (err) {
      console.error('[master-prompt] failed to persist plan', err instanceof Error ? err.message : err)
    }
  }

  function dismissPlan() {
    setPlan(null)
    setView('conversation')
  }

  function connect() {
    return new Promise((resolve, reject) => {
      if (!API_KEY) {
        setStatus('error')
        appendOrCreate('model', '[Missing VITE_GEMINI_API_KEY — set it in .env and restart the dev server]')
        reject(new Error('missing api key'))
        return
      }
      setStatus('connecting')
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${API_KEY}`
      const ws = new WebSocket(url)
      wsRef.current = ws
      let settled = false

      ws.onopen = () => {
        const setupMsg = {
          setup: {
            model: MODEL,
            generationConfig: { responseModalities: ['AUDIO'] },
            systemInstruction: { parts: [{ text: LIVE_SYSTEM_INSTRUCTION }] },
            outputAudioTranscription: {},
            inputAudioTranscription: {},
          },
        }
        console.log('[gemini-live] -> setup request', setupMsg)
        ws.send(JSON.stringify(setupMsg))
      }

      ws.onmessage = async (event) => {
        const raw = typeof event.data === 'string' ? event.data : await event.data.text()
        const data = JSON.parse(raw)
        console.log('[gemini-live] <- response', data)

        if (data.error) {
          console.error('[gemini-live] API error response', data.error)
          appendOrCreate(
            'model',
            `[API error${data.error.code ? ` ${data.error.code}` : ''}: ${data.error.message || JSON.stringify(data.error)}]`
          )
          finalizeTurn()
          setStatus('error')
          if (!settled) {
            settled = true
            reject(new Error(data.error.message || 'api error'))
          }
          return
        }

        if (data.setupComplete) {
          setStatus('connected')
          if (!settled) {
            settled = true
            resolve(ws)
          }
          return
        }

        const sc = data.serverContent
        if (!sc) return

        if (sc.inputTranscription?.text) {
          userTurnRef.current += sc.inputTranscription.text
        }
        if (sc.outputTranscription?.text) {
          modelTurnRef.current += sc.outputTranscription.text
        }
        if (sc.modelTurn?.parts) {
          for (const part of sc.modelTurn.parts) {
            if (part.inlineData?.data) {
              playerRef.current?.playChunk(part.inlineData.data)
            }
          }
        }
        if (sc.turnComplete) {
          finalizeTurn()
        }
        if (sc.interrupted) {
          playerRef.current?.reset()
        }
      }

      ws.onerror = (event) => {
        console.error('[gemini-live] websocket error event', event)
        setStatus('error')
        if (!settled) {
          settled = true
          reject(new Error('websocket error'))
        }
      }
      ws.onclose = (event) => {
        console.error('[gemini-live] closed', {
          code: event.code,
          reason: event.reason || '(no reason sent by server)',
          wasClean: event.wasClean,
        })
        const wasActive = holdingRef.current
        holdingRef.current = false
        micRef.current?.stop()
        micRef.current = null
        if (wasActive) {
          appendOrCreate(
            'model',
            `[Connection closed${event.code ? ` (code ${event.code})` : ''}${event.reason ? `: ${event.reason}` : ''}]`
          )
          finalizeTurn()
          setStatus('error')
        } else if (status !== 'error') {
          setStatus('idle')
        }
        if (!settled) {
          settled = true
          reject(new Error(event.reason || 'connection closed before setup completed'))
        }
      }
    })
  }

  async function startListening() {
    if (holdingRef.current) return
    holdingRef.current = true

    try {
      if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
        await connect()
      }

      if (!holdingRef.current) return // stopped while connecting

      if (!playerRef.current) playerRef.current = new AudioPlayer()

      let chunkCount = 0
      const mic = new MicStreamer((base64Chunk) => {
        if (wsRef.current?.readyState === WebSocket.OPEN) {
          chunkCount += 1
          if (chunkCount === 1 || chunkCount % 20 === 0) {
            console.log(`[gemini-live] -> audio chunk #${chunkCount}`, `${base64Chunk.length} b64 chars`)
          }
          wsRef.current.send(
            JSON.stringify({
              realtimeInput: {
                audio: { mimeType: 'audio/pcm;rate=16000', data: base64Chunk },
              },
            })
          )
        }
      })
      micRef.current = mic
      await mic.start()
      if (!holdingRef.current) {
        mic.stop()
        return
      }
      setStatus('listening')
    } catch (err) {
      console.error('[gemini-live] failed to start listening', err instanceof Error ? err.message : err)
      appendOrCreate('model', `[Failed to start: ${err instanceof Error ? err.message : String(err)}]`)
      finalizeTurn()
      holdingRef.current = false
      setStatus('error')
    }
  }

  function stopListening() {
    holdingRef.current = false
    micRef.current?.stop()
    micRef.current = null
    wsRef.current?.close()
    wsRef.current = null
    playerRef.current?.reset()
    if (status !== 'error') setStatus('idle')
  }

  function toggleListening() {
    console.log('[gemini-live] button tapped, holding =', holdingRef.current)
    if (holdingRef.current) {
      stopListening()
    } else {
      startListening()
    }
  }

  const st = STATUS[status]

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 flex flex-col items-center px-4 py-10 gap-8">
      <div className="text-center">
        <h1 className="text-2xl font-semibold tracking-tight">Gemini 2.5 Flash Live Preview</h1>
        <p className="text-neutral-400 text-sm mt-1">Live streaming voice-to-text test</p>
      </div>

      {view === 'conversation' && (
        <div className="w-full max-w-xl flex flex-col items-center gap-8 animate-[fadein_.3s_ease]">
          <div className="flex items-center gap-2 text-sm text-neutral-400">
            <span className={`inline-block w-2.5 h-2.5 rounded-full ${st.color}`} />
            {st.label}
          </div>

          <button
            type="button"
            onClick={toggleListening}
            className={`w-32 h-32 rounded-full flex items-center justify-center text-sm font-medium select-none transition-transform active:scale-95
              ${status === 'listening' ? 'bg-red-600 shadow-[0_0_0_10px_rgba(220,38,38,0.2)]' : 'bg-violet-600 hover:bg-violet-500'}`}
          >
            {status === 'listening' ? 'Stop' : status === 'connecting' ? 'Connecting…' : 'Tap to talk'}
          </button>

          <button
            type="button"
            onClick={preparePlan}
            disabled={planLoading || messages.length === 0}
            className="text-xs px-4 py-2 rounded-full bg-neutral-800 hover:bg-neutral-700 disabled:opacity-40 text-neutral-200"
          >
            {planLoading ? 'Preparing plan…' : 'Prepare plan'}
          </button>

          <div className="w-full flex-1 flex flex-col gap-3 bg-neutral-900 rounded-xl p-4 min-h-[300px] max-h-[50vh] overflow-y-auto">
            {messages.length === 0 && (
              <p className="text-neutral-500 text-sm m-auto">Transcript will appear here…</p>
            )}
            {messages.map((m, i) => (
              <div
                key={i}
                className={`max-w-[85%] px-3 py-2 rounded-lg text-sm leading-relaxed ${
                  m.role === 'user'
                    ? 'self-end bg-violet-600/30 text-violet-100'
                    : 'self-start bg-neutral-800 text-neutral-200'
                }`}
              >
                <span className="block text-[10px] uppercase tracking-wide opacity-60 mb-0.5">
                  {m.role === 'user' ? 'You' : 'Gemini'}
                </span>
                {m.text}
              </div>
            ))}
          </div>

          {planError && <p className="text-red-400 text-xs max-w-md text-center">{planError}</p>}

          {!API_KEY && (
            <p className="text-red-400 text-xs max-w-md text-center">
              No API key found. Add VITE_GEMINI_API_KEY to the .env file at the project root, then restart `npm run dev`.
            </p>
          )}
        </div>
      )}

      {view === 'processing' && (
        <div className="flex flex-col items-center gap-4 py-16 animate-[fadein_.3s_ease]">
          <div className="w-12 h-12 rounded-full border-2 border-violet-500 border-t-transparent animate-spin" />
          <p className="text-neutral-300 text-sm">Preparing your plan…</p>
        </div>
      )}

      {view === 'plan' && (
        <PlanView
          plan={plan}
          onMove={moveChunk}
          onRemove={removeChunk}
          onToggleDone={toggleChunkDone}
          onConfirm={confirmPlan}
          onDismiss={dismissPlan}
        />
      )}
    </div>
  )
}

export default App
