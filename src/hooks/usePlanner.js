import { useState } from 'react'
import { generatePlan } from '../masterPrompt'

const PLAN_STORAGE_KEY = 'task-chunking:last-session'
const TODAY_TASKS_KEY = 'untangle:today-tasks'

export function loadTodayTasks() {
  try {
    const raw = localStorage.getItem(TODAY_TASKS_KEY)
    return raw ? JSON.parse(raw) : []
  } catch {
    return []
  }
}

// Tier 2: turns a finished brain-dump transcript into a structured, checkable task plan.
export function usePlanner() {
  const [todayTasks, setTodayTasks] = useState(loadTodayTasks)
  const [plan, setPlan] = useState(null)
  const [planError, setPlanError] = useState(null)

  async function generatePlanFromMessages(turnMessages) {
    setPlanError(null)
    const userText = turnMessages
      .filter((m) => m.role === 'user' && m.text.trim())
      .map((m) => m.text.trim())
      .join('\n')

    if (!userText) {
      setPlanError('Nothing captured yet — talk for a bit first.')
      return false
    }

    try {
      const result = await generatePlan(userText)
      setPlan({ ...result, chunks: result.chunks.map((c) => ({ ...c, done: false })) })
      return true
    } catch (err) {
      console.error('[master-prompt] failed to generate plan', err instanceof Error ? err.message : err)
      setPlanError(err instanceof Error ? err.message : String(err))
      return false
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

  function confirmPlan(transcript) {
    if (!plan) return
    try {
      localStorage.setItem(PLAN_STORAGE_KEY, JSON.stringify({ savedAt: Date.now(), transcript, plan }))
      setTodayTasks((prev) => {
        const merged = [...prev, ...plan.chunks]
        localStorage.setItem(TODAY_TASKS_KEY, JSON.stringify(merged))
        return merged
      })
    } catch (err) {
      console.error('[master-prompt] failed to persist plan', err instanceof Error ? err.message : err)
    }
    setPlan(null)
  }

  function dismissPlan() {
    setPlan(null)
  }

  function toggleTodayTask(id) {
    setTodayTasks((prev) => {
      const next = prev.map((t) => (t.id === id ? { ...t, done: !t.done } : t))
      try {
        localStorage.setItem(TODAY_TASKS_KEY, JSON.stringify(next))
      } catch (err) {
        console.error('[today] failed to persist tasks', err instanceof Error ? err.message : err)
      }
      return next
    })
  }

  function deleteTodayTask(id) {
    setTodayTasks((prev) => {
      const next = prev.filter((t) => t.id !== id)
      try {
        localStorage.setItem(TODAY_TASKS_KEY, JSON.stringify(next))
      } catch (err) {
        console.error('[today] failed to persist tasks', err instanceof Error ? err.message : err)
      }
      return next
    })
  }

  return {
    todayTasks,
    plan,
    planError,
    generatePlanFromMessages,
    moveChunk,
    removeChunk,
    toggleChunkDone,
    confirmPlan,
    dismissPlan,
    toggleTodayTask,
    deleteTodayTask,
  }
}
