import { useEffect, useRef, useState } from 'react'
import { MicStreamer, AudioPlayer } from './audio'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const MODEL = import.meta.env.VITE_GEMINI_MODEL || 'models/gemini-2.5-flash-live-preview'

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
  const [messages, setMessages] = useState([]) // {role: 'user'|'model', text}
  const wsRef = useRef(null)
  const micRef = useRef(null)
  const playerRef = useRef(null)
  const holdingRef = useRef(false)
  const userTurnRef = useRef('')
  const modelTurnRef = useRef('')

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
      return [...prev, { role, text, streaming: true }]
    })
  }

  function finalizeTurn() {
    setMessages((prev) => prev.map((m) => ({ ...m, streaming: false })))
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
          appendOrCreate('user', sc.inputTranscription.text)
        }
        if (sc.outputTranscription?.text) {
          appendOrCreate('model', sc.outputTranscription.text)
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

      <div className="w-full max-w-xl flex-1 flex flex-col gap-3 bg-neutral-900 rounded-xl p-4 min-h-[300px] max-h-[50vh] overflow-y-auto">
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

      {!API_KEY && (
        <p className="text-red-400 text-xs max-w-md text-center">
          No API key found. Add VITE_GEMINI_API_KEY to the .env file at the project root, then restart `npm run dev`.
        </p>
      )}
    </div>
  )
}

export default App
