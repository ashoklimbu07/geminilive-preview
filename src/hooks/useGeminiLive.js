import { useEffect, useRef, useState } from 'react'
import { MicStreamer, AudioPlayer } from '../audio'

export const STATUS = {
  idle: { label: 'Idle', color: 'bg-[#c9a898]' },
  connecting: { label: 'Connecting…', color: 'bg-amber-400' },
  connected: { label: 'Connected', color: 'bg-rose-400' },
  listening: { label: 'Listening', color: 'bg-orange-500' },
  error: { label: 'Error', color: 'bg-red-500' },
}

// Wraps the Gemini Live websocket + mic/player plumbing: connect, stream audio in,
// buffer streamed transcripts per turn, and surface plain status/messages state.
export function useGeminiLive({ apiKey, model, systemInstruction, planTriggerPhrase, onPlanTrigger }) {
  const [status, setStatus] = useState('idle')
  const [messages, setMessages] = useState([]) // {role: 'user'|'model', text, streaming, timestamp}
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

    const trigger = planTriggerPhrase && modelText.toLowerCase().includes(planTriggerPhrase)
    userTurnRef.current = ''
    modelTurnRef.current = ''
    if (trigger) {
      stopListening()
      onPlanTrigger?.(messagesRef.current)
    }
  }

  function connect() {
    return new Promise((resolve, reject) => {
      if (!apiKey) {
        setStatus('error')
        appendOrCreate('model', '[Missing VITE_GEMINI_API_KEY — set it in .env and restart the dev server]')
        reject(new Error('missing api key'))
        return
      }
      setStatus('connecting')
      const url = `wss://generativelanguage.googleapis.com/ws/google.ai.generativelanguage.v1alpha.GenerativeService.BidiGenerateContent?key=${apiKey}`
      const ws = new WebSocket(url)
      wsRef.current = ws
      let settled = false

      ws.onopen = () => {
        const setupMsg = {
          setup: {
            model,
            generationConfig: { responseModalities: ['AUDIO'] },
            systemInstruction: { parts: [{ text: systemInstruction }] },
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
            console.log('[gemini-live] modelTurn part', part)
            if (part.inlineData?.data) {
              micRef.current?.setMuted(true)
              playerRef.current?.playChunk(part.inlineData.data)
            }
            if (part.text) {
              modelTurnRef.current += part.text
            }
          }
        }
        if (sc.turnComplete) {
          micRef.current?.setMuted(false)
          finalizeTurn()
        }
        if (sc.interrupted) {
          micRef.current?.setMuted(false)
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
        } else {
          setStatus((s) => (s !== 'error' ? 'idle' : s))
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
    setStatus((s) => (s !== 'error' ? 'idle' : s))
  }

  function resetTranscript() {
    setMessages([])
    userTurnRef.current = ''
    modelTurnRef.current = ''
  }

  function toggleListening(beforeStart) {
    console.log('[gemini-live] button tapped, holding =', holdingRef.current)
    if (holdingRef.current) {
      stopListening()
    } else {
      beforeStart?.()
      startListening()
    }
  }

  return { status, messages, holdingRef, toggleListening, stopListening, resetTranscript }
}
