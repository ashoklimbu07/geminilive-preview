// Tier 2: one-shot call to Gemini 2.5 Flash that turns a raw transcript into a structured plan.
import promptSpec from '../task-chunking-master-prompt.json'

const API_KEY = import.meta.env.VITE_GEMINI_API_KEY
const MASTER_MODEL = import.meta.env.VITE_GEMINI_MASTER_MODEL || 'models/gemini-2.5-flash'

const UNSUPPORTED_SCHEMA_KEYS = new Set([
  '$schema',
  'title',
  'description',
  'additionalProperties',
  'format',
  'maxLength',
  'minLength',
  'minimum',
  'maximum',
  'pattern',
])

// Converts a draft-07 JSON Schema into the restricted OpenAPI-subset schema
// Gemini's responseSchema accepts (no additionalProperties, no union `type` arrays).
// `isPropertiesMap` marks a `properties` object, whose keys are field names (e.g. "title",
// "description") and must never be treated as schema meta keywords to strip.
function stripSchemaMeta(node, isPropertiesMap = false) {
  if (Array.isArray(node)) return node.map((item) => stripSchemaMeta(item))
  if (node && typeof node === 'object') {
    const out = {}
    if (isPropertiesMap) {
      for (const [key, value] of Object.entries(node)) {
        out[key] = stripSchemaMeta(value)
      }
      return out
    }
    let type = node.type
    let nullable = false
    if (Array.isArray(type)) {
      nullable = type.includes('null')
      type = type.find((t) => t !== 'null')
    }
    for (const [key, value] of Object.entries(node)) {
      if (UNSUPPORTED_SCHEMA_KEYS.has(key) || key === 'type') continue
      out[key] = stripSchemaMeta(value, key === 'properties')
    }
    if (type !== undefined) out.type = type
    if (nullable) out.nullable = true
    return out
  }
  return node
}

const responseSchema = stripSchemaMeta(promptSpec.output_schema)

function buildSystemInstruction() {
  const lines = [
    promptSpec.role,
    '',
    'Core principles:',
    ...promptSpec.core_principles.map((p) => `- ${p}`),
    '',
    'Tone:',
    ...promptSpec.tone_guidelines.map((t) => `- ${t}`),
    '',
    'Guardrails:',
    ...promptSpec.guardrails.map((g) => `- ${g}`),
    '',
    'Response rules:',
    ...promptSpec.response_rules.map((r) => `- ${r}`),
  ]
  return lines.join('\n')
}

const SYSTEM_INSTRUCTION = buildSystemInstruction()

const REQUIRED_FIELDS = ['mode', 'summary', 'chunks', 'alternative_solutions', 'encouragement', 'clarifying_question', 'has_more', 'support_note']

function validatePlan(plan) {
  if (!plan || typeof plan !== 'object') return false
  return REQUIRED_FIELDS.every((f) => f in plan)
}

async function callGemini(userInput) {
  const url = `https://generativelanguage.googleapis.com/v1beta/${MASTER_MODEL}:generateContent?key=${API_KEY}`
  const body = {
    systemInstruction: { parts: [{ text: SYSTEM_INSTRUCTION }] },
    contents: [{ role: 'user', parts: [{ text: userInput }] }],
    generationConfig: {
      responseMimeType: 'application/json',
      responseSchema,
    },
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`master prompt request failed (${res.status}): ${text}`)
  }
  const data = await res.json()
  const text = data.candidates?.[0]?.content?.parts?.map((p) => p.text).join('') || ''
  return JSON.parse(text)
}

// Sends the raw transcript to the master prompt and returns a validated plan.
// Retries once on a validation failure per the prompt spec's usage_note.
export async function generatePlan(userInput) {
  if (!API_KEY) throw new Error('missing VITE_GEMINI_API_KEY')
  let plan = await callGemini(userInput)
  if (!validatePlan(plan)) {
    plan = await callGemini(userInput)
    if (!validatePlan(plan)) throw new Error('master prompt returned an invalid plan twice')
  }
  return plan
}
