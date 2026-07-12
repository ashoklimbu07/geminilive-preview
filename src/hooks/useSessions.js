import { useEffect, useState } from 'react'

const SESSIONS_STORAGE_KEY = 'untangle:sessions'

function loadSessions() {
  try {
    const raw = localStorage.getItem(SESSIONS_STORAGE_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

function persistSessions(sessions) {
  try {
    localStorage.setItem(SESSIONS_STORAGE_KEY, JSON.stringify(sessions))
  } catch (err) {
    console.error('[sessions] failed to persist sessions', err instanceof Error ? err.message : err)
  }
}

function makeSessionId() {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `s_${Date.now()}_${Math.random().toString(36).slice(2)}`
}

// Tracks the list of talk sessions (each with its own transcript), persisted to localStorage,
// and keeps the currently-recording session's transcript in sync as `messages` streams in.
export function useSessions(messages) {
  const [sessions, setSessions] = useState(loadSessions)
  const [activeSessionId, setActiveSessionId] = useState(null)
  const [viewingSessionId, setViewingSessionId] = useState(null)

  useEffect(() => {
    if (!activeSessionId) return
    setSessions((prev) => {
      const next = prev.map((s) => (s.id === activeSessionId ? { ...s, messages } : s))
      persistSessions(next)
      return next
    })
  }, [messages, activeSessionId])

  function startNewSession() {
    const session = { id: makeSessionId(), startedAt: Date.now(), messages: [] }
    setSessions((prev) => {
      const next = [session, ...prev]
      persistSessions(next)
      return next
    })
    setActiveSessionId(session.id)
    setViewingSessionId(session.id)
  }

  function selectSession(id) {
    setViewingSessionId(id)
  }

  function deleteSession(id, { onDeleteActive } = {}) {
    if (id === activeSessionId) onDeleteActive?.()
    setSessions((prev) => {
      const next = prev.filter((s) => s.id !== id)
      persistSessions(next)
      return next
    })
    if (activeSessionId === id) setActiveSessionId(null)
    if (viewingSessionId === id) setViewingSessionId(null)
  }

  return {
    sessions,
    activeSessionId,
    viewingSessionId,
    setViewingSessionId,
    startNewSession,
    selectSession,
    deleteSession,
  }
}
