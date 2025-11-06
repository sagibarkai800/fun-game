import { useEffect, useRef, useState } from 'react'

export default function App() {
  const [isSleeping, setIsSleeping] = useState(false)
  const [startAtMs, setStartAtMs] = useState(null)
  const [elapsedMs, setElapsedMs] = useState(0)
  const [sessions, setSessions] = useState(() => {
    try {
      const raw = localStorage.getItem('sleepSessions')
      return raw ? JSON.parse(raw) : []
    } catch {
      return []
    }
  })
  const todayIso = new Date().toISOString().slice(0, 10)
  const [selectedDate, setSelectedDate] = useState(todayIso)
  const [manualStart, setManualStart] = useState('') // HH:MM
  const [manualEnd, setManualEnd] = useState('') // HH:MM
  const [endsNextDay, setEndsNextDay] = useState(false)
  const [manualError, setManualError] = useState('')
  const timelineRef = useRef(null)
  const [drag, setDrag] = useState(null) // { id, mode, fromMin0, toMin0, pointerMin0, fromMin, toMin }
  const TIMELINE_HEIGHT = 960

  useEffect(() => {
    if (!isSleeping || !startAtMs) return
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startAtMs)
    }, 500)
    return () => clearInterval(id)
  }, [isSleeping, startAtMs])

  useEffect(() => {
    try {
      localStorage.setItem('sleepSessions', JSON.stringify(sessions))
    } catch {}
  }, [sessions])

  // Ensure sessions have stable ids (for editing)
  useEffect(() => {
    let changed = false
    const withIds = sessions.map((s) => {
      if (s.id) return s
      changed = true
      return { ...s, id: `${s.start}-${s.end}-${Math.random().toString(36).slice(2, 8)}` }
    })
    if (changed) setSessions(withIds)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleToggle() {
    if (isSleeping) {
      // Stop
      if (startAtMs) {
        const end = Date.now()
        const duration = end - startAtMs
        setElapsedMs(duration)
        // Add a session if positive length
        if (duration > 0) {
          const startDateIso = new Date(startAtMs).toISOString().slice(0, 10)
          const endDateIso = new Date(end).toISOString().slice(0, 10)
          setSessions((prev) => [
            ...prev,
            { id: `${startAtMs}-${end}-${Math.random().toString(36).slice(2, 8)}` , start: startAtMs, end, startDateIso, endDateIso }
          ])
        }
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

  function startOfDayMs(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number)
    return new Date(y, m - 1, d, 0, 0, 0, 0).getTime()
  }
  function endOfDayMs(isoDate) {
    const [y, m, d] = isoDate.split('-').map(Number)
    return new Date(y, m - 1, d, 23, 59, 59, 999).getTime()
  }

  const dayStart = startOfDayMs(selectedDate)
  const dayEnd = endOfDayMs(selectedDate)
  const minutesInDay = 24 * 60

  // Build blocks for selected day, clipping sessions that cross midnight
  const dayBlocks = sessions
    .map((s) => {
      const start = Math.max(s.start, dayStart)
      const end = Math.min(s.end, dayEnd)
      if (end <= start) return null
      const fromMin = Math.max(0, Math.floor((start - dayStart) / 60000))
      const toMin = Math.min(minutesInDay, Math.ceil((end - dayStart) / 60000))
      return { fromMin, toMin, start, end, id: s.id }
    })
    .filter(Boolean)
    .sort((a, b) => a.fromMin - b.fromMin)

  function minuteFromClientY(clientY) {
    const el = timelineRef.current
    if (!el) return 0
    const rect = el.getBoundingClientRect()
    const y = Math.min(Math.max(clientY - rect.top, 0), TIMELINE_HEIGHT)
    const ratio = y / TIMELINE_HEIGHT
    return Math.round(ratio * minutesInDay)
  }

  useEffect(() => {
    if (!drag) return
    function onMove(e) {
      const currentMin = minuteFromClientY(e.clientY)
      const delta = currentMin - drag.pointerMin0
      let newFrom = drag.fromMin0
      let newTo = drag.toMin0
      if (drag.mode === 'move') {
        newFrom = Math.max(0, Math.min(minutesInDay - (drag.toMin0 - drag.fromMin0), drag.fromMin0 + delta))
        newTo = newFrom + (drag.toMin0 - drag.fromMin0)
      } else if (drag.mode === 'resize-start') {
        newFrom = Math.max(0, Math.min(drag.toMin0 - 1, drag.fromMin0 + delta))
      } else if (drag.mode === 'resize-end') {
        newTo = Math.min(minutesInDay, Math.max(drag.fromMin0 + 1, drag.toMin0 + delta))
      }
      setDrag((d) => (d ? { ...d, fromMin: newFrom, toMin: newTo } : d))
    }
    function onUp() {
      setSessions((prev) => {
        const idx = prev.findIndex((s) => s.id === drag.id)
        if (idx === -1) return prev
        const next = prev.slice()
        const newStart = dayStart + (drag.fromMin * 60000)
        const newEnd = dayStart + (drag.toMin * 60000)
        next[idx] = {
          ...next[idx],
          start: newStart,
          end: newEnd,
          startDateIso: new Date(newStart).toISOString().slice(0, 10),
          endDateIso: new Date(newEnd).toISOString().slice(0, 10)
        }
        return next
      })
      setDrag(null)
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    window.addEventListener('mousemove', onMove)
    window.addEventListener('mouseup', onUp)
    return () => {
      window.removeEventListener('mousemove', onMove)
      window.removeEventListener('mouseup', onUp)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [drag])

  function parseTimeToMs(timeStr) {
    // expects HH:MM (24h)
    const m = /^([01]?\d|2[0-3]):([0-5]\d)$/.exec(timeStr || '')
    if (!m) return null
    const hh = parseInt(m[1], 10)
    const mm = parseInt(m[2], 10)
    return (hh * 60 + mm) * 60000
  }

  function handleAddManual() {
    setManualError('')
    const startOffsetMs = parseTimeToMs(manualStart)
    const endOffsetMs = parseTimeToMs(manualEnd)
    if (startOffsetMs == null || endOffsetMs == null) {
      setManualError('Please enter valid times as HH:MM')
      return
    }
    let start = dayStart + startOffsetMs
    let end = dayStart + endOffsetMs
    if (endsNextDay) {
      if (end <= start) end += 24 * 60 * 60000
    } else {
      if (end <= start) {
        setManualError('End must be after start (or enable Ends next day)')
        return
      }
    }
    // Add
    const startDateIso = new Date(start).toISOString().slice(0, 10)
    const endDateIso = new Date(end).toISOString().slice(0, 10)
    setSessions((prev) => [
      ...prev,
      { id: `${start}-${end}-${Math.random().toString(36).slice(2, 8)}`, start, end, startDateIso, endDateIso }
    ])
    // Reset inputs
    setManualStart('')
    setManualEnd('')
    setEndsNextDay(false)
  }

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
        flexDirection: 'column',
        alignItems: 'stretch',
        justifyContent: 'flex-start',
        color: '#0b3d62',
        textAlign: 'center',
        padding: '24px'
      }}>
        <div style={{ width: '100%', maxWidth: 920, margin: '0 auto' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 16 }}>
            <div style={{ textAlign: 'left' }}>
              <h1 style={{ margin: 0, fontSize: '1.75rem' }}>Baby Sleep Timer</h1>
              <div style={{ marginTop: 4, color: '#336b8f' }}>
                Press the button to start or stop sleep time
              </div>
            </div>
            <div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                style={{
                  padding: '10px 14px',
                  borderRadius: 10,
                  border: '1px solid rgba(0,0,0,0.1)',
                  fontSize: '0.95rem'
                }}
              />
            </div>
          </div>

          <div style={{
            marginTop: 20,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            gap: 16,
            flexWrap: 'wrap'
          }}>
            <div style={{
              flex: '1 1 360px',
              minWidth: 320,
              background: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: 14,
              padding: 16
            }}>
              <div style={{ fontSize: '3rem', fontWeight: 700, letterSpacing: '0.05em' }}>
                {formatDuration(displayMs)}
              </div>
              <div style={{ marginTop: 12, color: '#2a5875' }}>
                Status: {isSleeping ? 'Sleeping…' : 'Stopped'}
              </div>
              <div style={{ marginTop: 16 }}>
                <button
                  onClick={handleToggle}
                  style={{
                    appearance: 'none',
                    border: 'none',
                    padding: '14px 24px',
                    borderRadius: '999px',
                    fontSize: '1.05rem',
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

              <div style={{ marginTop: 20, textAlign: 'left' }}>
                <div style={{ fontWeight: 600, marginBottom: 8 }}>Add sleep manually</div>
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, color: '#2a5875' }}>Start</span>
                    <input
                      type="time"
                      value={manualStart}
                      onChange={(e) => setManualStart(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)' }}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <span style={{ fontSize: 13, color: '#2a5875' }}>End</span>
                    <input
                      type="time"
                      value={manualEnd}
                      onChange={(e) => setManualEnd(e.target.value)}
                      style={{ padding: '8px 10px', borderRadius: 8, border: '1px solid rgba(0,0,0,0.1)' }}
                    />
                  </label>
                  <label style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <input
                      type="checkbox"
                      checked={endsNextDay}
                      onChange={(e) => setEndsNextDay(e.target.checked)}
                    />
                    <span style={{ fontSize: 13, color: '#2a5875' }}>Ends next day</span>
                  </label>
                  <button
                    onClick={handleAddManual}
                    style={{
                      appearance: 'none',
                      border: 'none',
                      padding: '10px 16px',
                      borderRadius: 10,
                      fontSize: '0.95rem',
                      fontWeight: 600,
                      color: '#ffffff',
                      cursor: 'pointer',
                      background: '#1f8ad1',
                      boxShadow: '0 6px 16px rgba(0,0,0,0.12)'
                    }}
                  >
                    Add
                  </button>
                </div>
                {manualError ? (
                  <div style={{ marginTop: 8, color: '#b23b3b', fontSize: 13 }}>{manualError}</div>
                ) : null}
              </div>
            </div>

            <div style={{
              flex: '2 1 520px',
              minWidth: 420,
              background: 'rgba(255,255,255,0.6)',
              border: '1px solid rgba(0,0,0,0.06)',
              borderRadius: 14,
              padding: 16
            }}>
              <div style={{ textAlign: 'left', fontWeight: 600, marginBottom: 8 }}>Today’s Schedule</div>
              <div ref={timelineRef} style={{ position: 'relative', height: 960, overflow: 'hidden', borderRadius: 10, background: '#eef6ff', border: '1px solid rgba(0,0,0,0.06)', cursor: drag ? (drag.mode === 'move' ? 'grabbing' : 'ns-resize') : 'default' }}>
                {/* Hour grid */}
                {Array.from({ length: 25 }).map((_, i) => (
                  <div
                    key={i}
                    style={{
                      position: 'absolute',
                      top: `${(i / 24) * 100}%`,
                      left: 0,
                      right: 0,
                      borderTop: '1px dashed rgba(0,0,0,0.08)'
                    }}
                  />
                ))}
                {/* Hour labels */}
                {Array.from({ length: 24 }).map((_, i) => (
                  <div
                    key={`label-${i}`}
                    style={{
                      position: 'absolute',
                      top: `calc(${(i / 24) * 100}% - 8px)`,
                      left: 8,
                      fontSize: 12,
                      color: '#2a5875'
                    }}
                  >
                    {String(i).padStart(2, '0')}:00
                  </div>
                ))}
                {/* Sleep blocks */}
                {dayBlocks.map((b, idx) => {
                  const topPct = (b.fromMin / minutesInDay) * 100
                  const bottomPct = (b.toMin / minutesInDay) * 100
                  const heightPct = Math.max(1.5, bottomPct - topPct)
                  const label = `${new Date(b.start).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} - ${new Date(b.end).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}`
                  return (
                    <div
                      key={b.id || idx}
                      title={label}
                      style={{
                        position: 'absolute',
                        left: 72,
                        right: 12,
                        top: `calc(${topPct}% + 2px)`,
                        height: `calc(${heightPct}% - 4px)`,
                        background: 'linear-gradient(180deg, #9fd2ff, #74bfff)',
                        border: '1px solid rgba(0,0,0,0.08)',
                        borderRadius: 10,
                        boxShadow: '0 6px 18px rgba(0,0,0,0.08)',
                        display: 'flex',
                        alignItems: 'center',
                        padding: '6px 10px',
                        color: '#08324f',
                        fontSize: 12,
                        overflow: 'hidden',
                        cursor: 'grab'
                      }}
                      onMouseDown={(e) => {
                        e.preventDefault()
                        setDrag({ id: b.id, mode: 'move', fromMin0: b.fromMin, toMin0: b.toMin, pointerMin0: minuteFromClientY(e.clientY), fromMin: b.fromMin, toMin: b.toMin })
                      }}
                    >
                      {/* Resize handle - top */}
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault(); e.stopPropagation()
                          setDrag({ id: b.id, mode: 'resize-start', fromMin0: b.fromMin, toMin0: b.toMin, pointerMin0: minuteFromClientY(e.clientY), fromMin: b.fromMin, toMin: b.toMin })
                        }}
                        style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 8, cursor: 'ns-resize' }}
                      />
                      {/* Resize handle - bottom */}
                      <div
                        onMouseDown={(e) => {
                          e.preventDefault(); e.stopPropagation()
                          setDrag({ id: b.id, mode: 'resize-end', fromMin0: b.fromMin, toMin0: b.toMin, pointerMin0: minuteFromClientY(e.clientY), fromMin: b.fromMin, toMin: b.toMin })
                        }}
                        style={{ position: 'absolute', left: 0, right: 0, bottom: 0, height: 8, cursor: 'ns-resize' }}
                      />
                      <div style={{ fontWeight: 700, marginRight: 8 }}>Sleep</div>
                      <div style={{ opacity: 0.8 }}>
                        {label}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}


