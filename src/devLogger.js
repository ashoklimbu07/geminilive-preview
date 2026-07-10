// Dev-only: mirrors console.log/console.error to the terminal running `npm run dev`.
if (import.meta.env.DEV) {
  const send = (level, args) => {
    fetch('/__client-log', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        level,
        args: args.map((a) => {
          if (a instanceof Error) return `${a.name}: ${a.message}`
          try {
            return JSON.parse(JSON.stringify(a))
          } catch {
            return String(a)
          }
        }),
      }),
    }).catch(() => {})
  }

  const originalLog = console.log.bind(console)
  const originalError = console.error.bind(console)

  console.log = (...args) => {
    originalLog(...args)
    send('log', args)
  }
  console.error = (...args) => {
    originalError(...args)
    send('error', args)
  }
}
