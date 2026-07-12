// Supports multiple Gemini API keys as a fallback chain: if the first key is invalid,
// rate-limited, or quota-exhausted, the next configured key is tried automatically.
// Set VITE_GEMINI_API_KEY, VITE_GEMINI_API_KEY_2, VITE_GEMINI_API_KEY_3 in .env.
export const GEMINI_API_KEYS = [
  import.meta.env.VITE_GEMINI_API_KEY,
  import.meta.env.VITE_GEMINI_API_KEY_2,
  import.meta.env.VITE_GEMINI_API_KEY_3,
].filter(Boolean)
