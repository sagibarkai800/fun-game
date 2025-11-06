import { useEffect, useState } from 'react'

export default function App() {
  const [isSleeping, setIsSleeping] = useState(false)
  const [startAtMs, setStartAtMs] = useState(null)
  const [elapsedMs, setElapsedMs] = useState(0)

  useEffect(() => {
    if (!isSleeping || !startAtMs) return
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startAtMs)
    }, 500)
    return () => clearInterval(id)
  }, [isSleeping, startAtMs])

  function handleToggle() {
    if (isSleeping) {
      // Stop
      if (startAtMs) {
        setElapsedMs(Date.now() - startAtMs)
      }
      setIsSleeping(false)
      setStartAtMs(null)
    } else {
      // Start (reset timer)
      const now = Date.now()
      setStartAtMs(now)
      setElapsedMs(0)
      setIsSleeping(true)
    }
  }

  function formatDuration(ms) {
    const totalSeconds = Math.max(0, Math.floor(ms / 1000))
    const hours = Math.floor(totalSeconds / 3600)
    const minutes = Math.floor((totalSeconds % 3600) / 60)
    const seconds = totalSeconds % 60
    const pad = (n) => String(n).padStart(2, '0')
    return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`
  }

  const displayMs = isSleeping && startAtMs ? Date.now() - startAtMs : elapsedMs

  return (
    <div style={{
      minHeight: '100vh',
      display: 'flex',
      alignItems: 'center',
      justifyContent: 'center',
      fontFamily: 'system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif',
      backgroundColor: '#f7f9fc',
      padding: 0
    }}>
      <div style={{
        width: '1000px',
        height: '100vh',
        backgroundColor: '#cfe9ff',
        borderRadius: '16px',
        boxShadow: '0 6px 20px rgba(0,0,0,0.08)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        color: '#0b3d62',
        textAlign: 'center',
        padding: '24px'
      }}>
        <div style={{ width: '100%', maxWidth: 640 }}>
          <h1 style={{ margin: 0, fontSize: '2rem' }}>Baby Sleep Timer</h1>
          <p style={{ marginTop: 8, color: '#336b8f' }}>
            Press the button to start or stop sleep time
          </p>

          <div style={{
            marginTop: 32,
            fontSize: '4rem',
            letterSpacing: '0.05em',
            fontWeight: 700,
            color: '#0b3d62'
          }}>
            {formatDuration(displayMs)}
          </div>

          <div style={{ marginTop: 32 }}>
            <button
              onClick={handleToggle}
              style={{
                appearance: 'none',
                border: 'none',
                padding: '16px 28px',
                borderRadius: '999px',
                fontSize: '1.125rem',
                fontWeight: 600,
                color: '#ffffff',
                cursor: 'pointer',
                boxShadow: '0 10px 24px rgba(0,0,0,0.12)',
                background: isSleeping ? '#e75b5b' : '#2bb673',
                transition: 'transform 0.08s ease, box-shadow 0.2s ease'
              }}
              onMouseDown={(e) => (e.currentTarget.style.transform = 'scale(0.98)')}
              onMouseUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
            >
              {isSleeping ? 'Stop sleep' : 'Start sleep'}
            </button>
          </div>

          <div style={{ marginTop: 16, color: '#2a5875' }}>
            Status: {isSleeping ? 'Sleeping…' : 'Stopped'}
          </div>
        </div>
      </div>
    </div>
  )
}


