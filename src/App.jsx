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
  const TIMELINE_HEIGHT = 480
  const [currentTime, setCurrentTime] = useState(new Date())

  useEffect(() => {
    if (!isSleeping || !startAtMs) return
    const id = setInterval(() => {
      setElapsedMs(Date.now() - startAtMs)
    }, 500)
    return () => clearInterval(id)
  }, [isSleeping, startAtMs])

  useEffect(() => {
    const id = setInterval(() => {
      setCurrentTime(new Date())
    }, 1000)
    return () => clearInterval(id)
  }, [])

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
    const fullHeight = 960 // Full 24-hour timeline height
    const y = Math.min(Math.max(clientY - rect.top, 0), fullHeight)
    const ratio = y / fullHeight
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

  function handleDeleteSession(sessionId) {
    setSessions((prev) => prev.filter((s) => s.id !== sessionId))
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#f7f9fc] p-0 font-sans">
      <div className="w-[1000px] h-screen bg-[#cfe9ff] rounded-2xl shadow-lg flex flex-col items-stretch justify-start text-[#0b3d62] text-center p-6">
        <div className="w-full max-w-[920px] mx-auto">
          <div className="flex items-center justify-between gap-4">
            <div className="text-left">
              <h1 className="m-0 text-[1.75rem]">Baby Sleep Timer</h1>
              <div className="mt-1 text-[#336b8f]">
                Press the button to start or stop sleep time
              </div>
            </div>
            <div className="flex items-center gap-3">
              <div className="bg-white/60 border border-black/10 rounded-[10px] px-3.5 py-2.5 text-lg font-semibold text-[#0b3d62] min-w-[100px] text-center">
                {currentTime.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}
              </div>
              <input
                type="date"
                value={selectedDate}
                onChange={(e) => setSelectedDate(e.target.value)}
                className="px-3.5 py-2.5 rounded-[10px] border border-black/10 text-[0.95rem]"
              />
            </div>
          </div>

          <div className="mt-5 flex items-center justify-between gap-4 flex-wrap">
            <div className="flex-1 min-w-[320px] bg-white/60 border border-black/6 rounded-[14px] p-4">
              <div className="text-5xl font-bold tracking-wider">
                {formatDuration(displayMs)}
              </div>
              <div className="mt-3 text-[#2a5875]">
                Status: {isSleeping ? 'Sleeping…' : 'Stopped'}
              </div>
              <div className="mt-4">
                <button
                  onClick={handleToggle}
                  className={`appearance-none border-none px-6 py-3.5 rounded-full text-[1.05rem] font-semibold text-white cursor-pointer shadow-lg transition-all duration-75 hover:scale-[0.98] active:scale-[0.98] ${
                    isSleeping ? 'bg-[#e75b5b]' : 'bg-[#2bb673]'
                  }`}
                >
                  {isSleeping ? 'Stop sleep' : 'Start sleep'}
                </button>
              </div>

              <div className="mt-5 text-left">
                <div className="font-semibold mb-2">Add sleep manually</div>
                <div className="flex items-center gap-2 flex-wrap">
                  <label className="flex items-center gap-1.5">
                    <span className="text-[13px] text-[#2a5875]">Start</span>
                    <input
                      type="time"
                      value={manualStart}
                      onChange={(e) => setManualStart(e.target.value)}
                      className="px-2.5 py-2 rounded-lg border border-black/10"
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    <span className="text-[13px] text-[#2a5875]">End</span>
                    <input
                      type="time"
                      value={manualEnd}
                      onChange={(e) => setManualEnd(e.target.value)}
                      className="px-2.5 py-2 rounded-lg border border-black/10"
                    />
                  </label>
                  <label className="flex items-center gap-1.5">
                    <input
                      type="checkbox"
                      checked={endsNextDay}
                      onChange={(e) => setEndsNextDay(e.target.checked)}
                    />
                    <span className="text-[13px] text-[#2a5875]">Ends next day</span>
                  </label>
                  <button
                    onClick={handleAddManual}
                    className="appearance-none border-none px-4 py-2.5 rounded-[10px] text-[0.95rem] font-semibold text-white cursor-pointer bg-[#1f8ad1] shadow-lg"
                  >
                    Add
                  </button>
                </div>
                {manualError ? (
                  <div className="mt-2 text-[#b23b3b] text-[13px]">{manualError}</div>
                ) : null}
              </div>
            </div>

            <div className="flex-[2] min-w-[420px] bg-white/60 border border-black/6 rounded-[14px] p-4">
              <div className="text-left font-semibold mb-2">Today's Schedule</div>
              <div 
                className="overflow-y-auto overflow-x-hidden rounded-[10px] bg-[#eef6ff] border border-black/6"
                style={{ height: TIMELINE_HEIGHT }}
              >
                <div 
                  ref={timelineRef} 
                  className="relative"
                  style={{ 
                    height: 960,
                    cursor: drag ? (drag.mode === 'move' ? 'grabbing' : 'ns-resize') : 'default'
                  }}
                >
                  {/* Hour grid */}
                  {Array.from({ length: 25 }).map((_, i) => (
                    <div
                      key={i}
                      className="absolute left-0 right-0 border-t border-dashed border-black/8"
                      style={{ top: `${(i / 24) * 100}%` }}
                    />
                  ))}
                  {/* Hour labels */}
                  {Array.from({ length: 24 }).map((_, i) => (
                    <div
                      key={`label-${i}`}
                      className="absolute left-2 text-xs text-[#2a5875]"
                      style={{ top: `calc(${(i / 24) * 100}% - 8px)` }}
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
                        className="absolute left-[72px] right-3 bg-gradient-to-b from-[#9fd2ff] to-[#74bfff] border border-black/8 rounded-[10px] shadow-lg flex items-center px-2.5 py-1.5 text-[#08324f] text-xs overflow-hidden cursor-grab"
                        style={{
                          top: `calc(${topPct}% + 2px)`,
                          height: `calc(${heightPct}% - 4px)`
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
                          className="absolute left-0 right-0 top-0 h-2 cursor-ns-resize"
                        />
                        {/* Resize handle - bottom */}
                        <div
                          onMouseDown={(e) => {
                            e.preventDefault(); e.stopPropagation()
                            setDrag({ id: b.id, mode: 'resize-end', fromMin0: b.fromMin, toMin0: b.toMin, pointerMin0: minuteFromClientY(e.clientY), fromMin: b.fromMin, toMin: b.toMin })
                          }}
                          className="absolute left-0 right-0 bottom-0 h-2 cursor-ns-resize"
                        />
                        <div className="font-bold mr-2">Sleep</div>
                        <div className="opacity-80">
                          {label}
                        </div>
                        <button
                          onClick={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                            handleDeleteSession(b.id)
                          }}
                          onMouseDown={(e) => {
                            e.preventDefault()
                            e.stopPropagation()
                          }}
                          className="absolute top-1 right-1 appearance-none border-none bg-white/70 rounded-full w-5 h-5 flex items-center justify-center cursor-pointer text-sm text-[#b23b3b] font-bold p-0 leading-none transition-colors duration-200 z-10 hover:bg-white/90"
                          title="Delete sleep session"
                        >
                          ×
                        </button>
                      </div>
                    )
                  })}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}
