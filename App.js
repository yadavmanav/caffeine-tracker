import { useState, useEffect, useCallback } from 'react'
import { supabase } from './supabase'

/* ─── helpers ─── */
function fmtDate(iso) {
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}
function fmtTime(iso) {
  return new Date(iso).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })
}
function monthKey(iso) {
  const d = new Date(iso)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}
function monthLabel(key) {
  const [y, m] = key.split('-')
  return new Date(y, m - 1).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
}
const DAILY_LIMIT = 400

/* ─── App ─── */
export default function App() {
  const [view, setView] = useState('log')
  const [drinks, setDrinks] = useState([])
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [toast, setToast] = useState(null)
  const [modal, setModal] = useState(null) // { type: 'logDrink' | 'addDrink' | 'editDrink' | 'editLog' | 'confirm', data }
  const [selectedMonth, setSelectedMonth] = useState(monthKey(new Date().toISOString()))

  /* ─── fetch ─── */
  const fetchDrinks = useCallback(async () => {
    const { data } = await supabase.from('drinks').select('*').order('created_at')
    if (data) setDrinks(data)
  }, [])

  const fetchLogs = useCallback(async () => {
    const { data } = await supabase.from('logs').select('*').order('logged_at', { ascending: false }).limit(200)
    if (data) setLogs(data)
  }, [])

  useEffect(() => {
    Promise.all([fetchDrinks(), fetchLogs()]).finally(() => setLoading(false))
  }, [fetchDrinks, fetchLogs])

  /* ─── toast ─── */
  function showToast(msg, type = 'ok') {
    setToast({ msg, type })
    setTimeout(() => setToast(null), 2500)
  }

  /* ─── log drink ─── */
  async function logDrink(drinkId, qty) {
    const drink = drinks.find(d => d.id === drinkId)
    if (!drink) return
    const entry = {
      drink_id: drink.id,
      drink_name: drink.name,
      caffeine: drink.caffeine * qty,
      price: drink.price * qty,
      qty,
      color: drink.color,
      logged_at: new Date().toISOString(),
    }
    const { data, error } = await supabase.from('logs').insert(entry).select().single()
    if (!error && data) {
      setLogs(prev => [data, ...prev])
      showToast(`Logged ${drink.name} — ${drink.caffeine * qty}mg ⚡`)
    }
    setModal(null)
  }

  /* ─── edit log ─── */
  async function updateLog(id, updates) {
    const { error } = await supabase.from('logs').update(updates).eq('id', id)
    if (!error) {
      setLogs(prev => prev.map(l => l.id === id ? { ...l, ...updates } : l))
      showToast('Entry updated')
    }
    setModal(null)
  }

  /* ─── delete log ─── */
  async function deleteLog(id) {
    const { error } = await supabase.from('logs').delete().eq('id', id)
    if (!error) {
      setLogs(prev => prev.filter(l => l.id !== id))
      showToast('Entry removed', 'err')
    }
    setModal(null)
  }

  /* ─── add drink ─── */
  async function addDrink(drink) {
    const { data, error } = await supabase.from('drinks').insert(drink).select().single()
    if (!error && data) {
      setDrinks(prev => [...prev, data])
      showToast('Drink added')
    }
    setModal(null)
  }

  /* ─── edit drink ─── */
  async function updateDrink(id, updates) {
    const { error } = await supabase.from('drinks').update(updates).eq('id', id)
    if (!error) {
      setDrinks(prev => prev.map(d => d.id === id ? { ...d, ...updates } : d))
      showToast('Drink updated')
    }
    setModal(null)
  }

  /* ─── delete drink ─── */
  async function deleteDrink(id) {
    const { error } = await supabase.from('drinks').delete().eq('id', id)
    if (!error) {
      setDrinks(prev => prev.filter(d => d.id !== id))
      showToast('Drink removed', 'err')
    }
    setModal(null)
  }

  /* ─── derived ─── */
  const todayStr = new Date().toISOString().slice(0, 10)
  const todayLogs = logs.filter(l => (l.logged_at || '').slice(0, 10) === todayStr)
  const todayCaffeine = todayLogs.reduce((s, l) => s + l.caffeine, 0)
  const todayPct = Math.min((todayCaffeine / DAILY_LIMIT) * 100, 100)

  const monthLogs = logs.filter(l => monthKey(l.logged_at) === selectedMonth)
  const totalCaffeine = monthLogs.reduce((s, l) => s + l.caffeine, 0)
  const totalSpent = monthLogs.reduce((s, l) => s + l.price, 0)

  const drinkBreakdown = monthLogs.reduce((acc, l) => {
    const k = l.drink_name
    if (!acc[k]) acc[k] = { count: 0, caffeine: 0, spent: 0, color: l.color }
    acc[k].count += l.qty || 1
    acc[k].caffeine += l.caffeine
    acc[k].spent += l.price
    return acc
  }, {})

  const months = [...new Set(logs.map(l => monthKey(l.logged_at)))].sort().reverse()
  if (!months.includes(monthKey(new Date().toISOString()))) months.unshift(monthKey(new Date().toISOString()))

  const barColor = todayCaffeine > DAILY_LIMIT ? '#FF3B3B' : todayCaffeine > 300 ? '#FFB800' : '#39FF14'

  if (loading) return (
    <div style={S.root}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100vh', flexDirection: 'column', gap: 16 }}>
        <div style={{ fontSize: 40 }}>⚡</div>
        <div style={{ color: '#39FF14', fontFamily: 'Space Mono', fontSize: 13, letterSpacing: 3 }}>LOADING...</div>
      </div>
    </div>
  )

  return (
    <div style={S.root}>
      <style>{CSS}</style>

      {/* Toast */}
      {toast && (
        <div style={{ ...S.toast, background: toast.type === 'err' ? '#FF3B3B' : '#39FF14' }}>
          {toast.msg}
        </div>
      )}

      {/* Header */}
      <header style={S.header}>
        <div style={S.headerL}>
          <span style={S.bolt}>⚡</span>
          <div>
            <div style={S.title}>CAFFEINE OS</div>
            <div style={S.sub}>AERIS VENTURES</div>
          </div>
        </div>
        <div style={S.todayPill}>
          <div style={S.todayLabel}>TODAY</div>
          <div style={{ ...S.todayVal, color: barColor }}>{todayCaffeine}mg</div>
        </div>
      </header>

      {/* Progress bar */}
      <div style={S.progWrap}>
        <div style={S.progTrack}>
          <div style={{ ...S.progFill, width: `${todayPct}%`, background: barColor }} />
        </div>
        <div style={S.progMeta}>
          <span>Daily limit {DAILY_LIMIT}mg</span>
          <span>{Math.round(todayPct)}%</span>
        </div>
      </div>

      {/* Nav */}
      <nav style={S.nav}>
        {[['log', '📋 Log'], ['drinks', '🥤 Drinks'], ['stats', '📊 Stats']].map(([k, lbl]) => (
          <button key={k} style={{ ...S.navBtn, ...(view === k ? S.navActive : {}) }} onClick={() => setView(k)}>{lbl}</button>
        ))}
      </nav>

      {/* ── LOG ── */}
      {view === 'log' && (
        <div style={S.page}>
          <div style={S.rowBetween}>
            <span style={S.secTitle}>Quick Log</span>
            <button style={S.greenBtn} onClick={() => setModal({ type: 'logDrink' })}>+ Log Drink</button>
          </div>

          <div style={S.quickGrid}>
            {drinks.map(d => (
              <button key={d.id} className="qcard" style={{ ...S.qcard, borderColor: d.color + '44' }} onClick={() => logDrink(d.id, 1)}>
                <div style={{ ...S.qdot, background: d.color }} />
                <div style={S.qname}>{d.name}</div>
                <div style={{ color: d.color, fontWeight: 700, fontSize: 12 }}>{d.caffeine}mg</div>
                <div style={S.qprice}>₹{d.price}</div>
              </button>
            ))}
          </div>

          <div style={S.secTitle2}>Recent Entries</div>
          {logs.length === 0 && <div style={S.empty}>No entries yet. Tap a drink above to log!</div>}
          {logs.slice(0, 50).map(log => (
            <div key={log.id} style={S.logRow}>
              <div style={{ ...S.logDot, background: log.color || '#39FF14' }} />
              <div style={S.logInfo}>
                <div style={S.logName}>{log.drink_name}</div>
                <div style={S.logMeta}>{fmtDate(log.logged_at)} · {fmtTime(log.logged_at)}</div>
              </div>
              <div style={S.logRight}>
                <span style={{ color: '#39FF14', fontWeight: 700, fontSize: 13 }}>{log.caffeine}mg</span>
                <span style={S.logPrice}>₹{log.price}</span>
              </div>
              <div style={S.actions}>
                <button style={S.iBtn} onClick={() => setModal({ type: 'editLog', data: log })}>✏️</button>
                <button style={S.iBtn} onClick={() => setModal({ type: 'confirm', data: { label: 'this log entry', onConfirm: () => deleteLog(log.id) } })}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── DRINKS ── */}
      {view === 'drinks' && (
        <div style={S.page}>
          <div style={S.rowBetween}>
            <span style={S.secTitle}>My Drinks</span>
            <button style={S.greenBtn} onClick={() => setModal({ type: 'addDrink' })}>+ Add Drink</button>
          </div>
          {drinks.map(d => (
            <div key={d.id} style={S.drinkRow}>
              <div style={{ ...S.drinkBar, background: d.color }} />
              <div style={S.drinkInfo}>
                <div style={S.logName}>{d.name}</div>
                <div style={S.logMeta}>
                  <span style={{ color: d.color, fontWeight: 700 }}>{d.caffeine}mg</span>
                  <span style={{ opacity: 0.4, margin: '0 6px' }}>·</span>
                  <span style={{ opacity: 0.6 }}>₹{d.price}</span>
                </div>
              </div>
              <div style={S.actions}>
                <button style={S.iBtn} onClick={() => logDrink(d.id, 1)}>➕</button>
                <button style={S.iBtn} onClick={() => setModal({ type: 'editDrink', data: d })}>✏️</button>
                <button style={S.iBtn} onClick={() => setModal({ type: 'confirm', data: { label: `"${d.name}"`, onConfirm: () => deleteDrink(d.id) } })}>🗑️</button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── STATS ── */}
      {view === 'stats' && (
        <div style={S.page}>
          <div style={S.rowBetween}>
            <span style={S.secTitle}>Monthly Stats</span>
            <select style={S.select} value={selectedMonth} onChange={e => setSelectedMonth(e.target.value)}>
              {months.map(m => <option key={m} value={m}>{monthLabel(m)}</option>)}
            </select>
          </div>

          <div style={S.statGrid}>
            {[
              { icon: '⚡', val: `${totalCaffeine.toLocaleString()}mg`, lbl: 'Total Caffeine' },
              { icon: '💸', val: `₹${totalSpent}`, lbl: 'Total Spent' },
              { icon: '🥤', val: monthLogs.length, lbl: 'Drinks Logged' },
              { icon: '📅', val: monthLogs.length > 0 ? `${Math.round(totalCaffeine / new Set(monthLogs.map(l => l.logged_at.slice(0, 10))).size)}mg` : '0mg', lbl: 'Daily Avg' },
            ].map(({ icon, val, lbl }) => (
              <div key={lbl} style={S.statCard}>
                <div style={{ fontSize: 22, marginBottom: 6 }}>{icon}</div>
                <div style={S.statVal}>{val}</div>
                <div style={S.statLbl}>{lbl}</div>
              </div>
            ))}
          </div>

          <div style={S.secTitle2}>Breakdown by Drink</div>
          {Object.keys(drinkBreakdown).length === 0 && <div style={S.empty}>No logs this month.</div>}
          {Object.entries(drinkBreakdown).sort((a, b) => b[1].caffeine - a[1].caffeine).map(([name, info]) => (
            <div key={name} style={{ ...S.bkRow, borderLeft: `3px solid ${info.color}`, background: info.color + '18' }}>
              <div style={S.rowBetween}>
                <span style={S.logName}>{name}</span>
                <span style={{ color: info.color, fontWeight: 700, fontSize: 13 }}>{info.caffeine}mg</span>
              </div>
              <div style={{ display: 'flex', gap: 14, marginTop: 4 }}>
                <span style={S.logMeta}>×{info.count} drinks</span>
                <span style={S.logMeta}>₹{info.spent} spent</span>
              </div>
              <div style={S.miniTrack}>
                <div style={{ ...S.miniFill, width: `${Math.min((info.caffeine / (totalCaffeine || 1)) * 100, 100)}%`, background: info.color }} />
              </div>
            </div>
          ))}
        </div>
      )}

      {/* ── MODALS ── */}
      {modal && (
        <div style={S.overlay} onClick={e => e.target === e.currentTarget && setModal(null)}>
          <div style={S.sheet}>
            <div style={S.sheetHead}>
              <span style={S.sheetTitle}>
                {modal.type === 'logDrink' && 'Log a Drink'}
                {modal.type === 'addDrink' && 'Add New Drink'}
                {modal.type === 'editDrink' && 'Edit Drink'}
                {modal.type === 'editLog' && 'Edit Entry'}
                {modal.type === 'confirm' && 'Confirm Delete'}
              </span>
              <button style={S.closeBtn} onClick={() => setModal(null)}>✕</button>
            </div>

            {modal.type === 'logDrink' && <LogModal drinks={drinks} onLog={logDrink} />}
            {modal.type === 'addDrink' && <DrinkForm onSave={addDrink} onClose={() => setModal(null)} />}
            {modal.type === 'editDrink' && <DrinkForm initial={modal.data} onSave={u => updateDrink(modal.data.id, u)} onClose={() => setModal(null)} />}
            {modal.type === 'editLog' && <EditLog log={modal.data} onSave={u => updateLog(modal.data.id, u)} onClose={() => setModal(null)} />}
            {modal.type === 'confirm' && (
              <div>
                <p style={{ color: '#aaa', marginBottom: 20 }}>Delete {modal.data.label}? This cannot be undone.</p>
                <div style={{ display: 'flex', gap: 10 }}>
                  <button style={S.redBtn} onClick={modal.data.onConfirm}>Delete</button>
                  <button style={S.grayBtn} onClick={() => setModal(null)}>Cancel</button>
                </div>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  )
}

/* ─── Sub-components ─── */
function LogModal({ drinks, onLog }) {
  const [sel, setSel] = useState(drinks[0]?.id || '')
  const [qty, setQty] = useState(1)
  const drink = drinks.find(d => d.id === sel)
  return (
    <div>
      <label style={S.label}>Choose Drink</label>
      <select style={S.input} value={sel} onChange={e => setSel(e.target.value)}>
        {drinks.map(d => <option key={d.id} value={d.id}>{d.name} — {d.caffeine}mg — ₹{d.price}</option>)}
      </select>
      <label style={S.label}>Quantity</label>
      <div style={{ display: 'flex', gap: 10, alignItems: 'center', marginBottom: 16 }}>
        <button style={S.qtyBtn} onClick={() => setQty(q => Math.max(1, q - 1))}>−</button>
        <span style={{ fontSize: 22, fontWeight: 700, minWidth: 32, textAlign: 'center' }}>{qty}</span>
        <button style={S.qtyBtn} onClick={() => setQty(q => q + 1)}>+</button>
      </div>
      {drink && (
        <div style={S.preview}>
          <span style={{ color: drink.color, fontWeight: 700 }}>{drink.caffeine * qty}mg</span>
          <span style={{ opacity: 0.4 }}>·</span>
          <span style={{ opacity: 0.7 }}>₹{drink.price * qty}</span>
        </div>
      )}
      <button style={S.bigGreen} onClick={() => onLog(sel, qty)}>Log It ⚡</button>
    </div>
  )
}

function DrinkForm({ initial = {}, onSave, onClose }) {
  const [name, setName] = useState(initial.name || '')
  const [caffeine, setCaffeine] = useState(initial.caffeine || '')
  const [price, setPrice] = useState(initial.price || '')
  const [color, setColor] = useState(initial.color || '#39FF14')
  const COLORS = ['#39FF14', '#00CFFF', '#FFB800', '#FF6B35', '#C8A97A', '#C8102E', '#BF5FFF', '#FF69B4', '#A8D8A8', '#FF3B00']
  return (
    <div>
      <label style={S.label}>Drink Name</label>
      <input style={S.input} placeholder="e.g. Monster Zero" value={name} onChange={e => setName(e.target.value)} />
      <label style={S.label}>Caffeine (mg)</label>
      <input style={S.input} type="number" placeholder="e.g. 150" value={caffeine} onChange={e => setCaffeine(e.target.value)} />
      <label style={S.label}>Price (₹)</label>
      <input style={S.input} type="number" placeholder="e.g. 125" value={price} onChange={e => setPrice(e.target.value)} />
      <label style={S.label}>Color</label>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 20 }}>
        {COLORS.map(c => (
          <div key={c} onClick={() => setColor(c)} style={{
            width: 28, height: 28, borderRadius: '50%', background: c, cursor: 'pointer',
            border: color === c ? '3px solid #fff' : '2px solid transparent', transition: 'border 0.15s'
          }} />
        ))}
      </div>
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={S.bigGreen} onClick={() => { if (name && caffeine && price) onSave({ name, caffeine: +caffeine, price: +price, color }) }}>Save</button>
        <button style={S.grayBtn} onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

function EditLog({ log, onSave, onClose }) {
  const [caffeine, setCaffeine] = useState(log.caffeine)
  const [price, setPrice] = useState(log.price)
  return (
    <div>
      <label style={S.label}>Caffeine (mg)</label>
      <input style={S.input} type="number" value={caffeine} onChange={e => setCaffeine(+e.target.value)} />
      <label style={S.label}>Price (₹)</label>
      <input style={S.input} type="number" value={price} onChange={e => setPrice(+e.target.value)} />
      <div style={{ display: 'flex', gap: 10 }}>
        <button style={S.bigGreen} onClick={() => onSave({ caffeine: +caffeine, price: +price })}>Save</button>
        <button style={S.grayBtn} onClick={onClose}>Cancel</button>
      </div>
    </div>
  )
}

/* ─── Styles ─── */
const S = {
  root: { minHeight: '100vh', background: '#0A0A0A', color: '#fff', fontFamily: "'Space Mono', monospace", maxWidth: 480, margin: '0 auto', paddingBottom: 48 },
  header: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '20px 20px 12px', borderBottom: '1px solid #161616' },
  headerL: { display: 'flex', alignItems: 'center', gap: 12 },
  bolt: { fontSize: 28 },
  title: { fontFamily: "'Syne', sans-serif", fontSize: 18, fontWeight: 800, letterSpacing: 3, color: '#39FF14' },
  sub: { fontSize: 9, opacity: 0.35, letterSpacing: 3, marginTop: 1 },
  todayPill: { textAlign: 'right' },
  todayLabel: { fontSize: 9, opacity: 0.45, letterSpacing: 2 },
  todayVal: { fontSize: 22, fontWeight: 700, lineHeight: 1.2 },
  progWrap: { padding: '10px 20px 0' },
  progTrack: { height: 3, background: '#1a1a1a', borderRadius: 2, overflow: 'hidden' },
  progFill: { height: '100%', borderRadius: 2, transition: 'width 0.6s ease, background 0.4s' },
  progMeta: { display: 'flex', justifyContent: 'space-between', fontSize: 9, opacity: 0.35, marginTop: 4, letterSpacing: 1 },
  nav: { display: 'flex', margin: '14px 20px 0', background: '#111', borderRadius: 10, padding: 4, gap: 3 },
  navBtn: { flex: 1, padding: '8px 0', border: 'none', background: 'transparent', color: '#555', cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', borderRadius: 7, fontWeight: 700, letterSpacing: 0.5, transition: 'all 0.2s' },
  navActive: { background: '#1c1c1c', color: '#fff' },
  page: { padding: '18px 20px 0' },
  rowBetween: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 14 },
  secTitle: { fontFamily: "'Syne', sans-serif", fontSize: 13, fontWeight: 800, letterSpacing: 2, color: '#39FF14' },
  secTitle2: { fontFamily: "'Syne', sans-serif", fontSize: 11, fontWeight: 700, letterSpacing: 2, color: '#333', margin: '18px 0 10px' },
  greenBtn: { padding: '6px 14px', background: '#39FF14', color: '#000', border: 'none', borderRadius: 6, cursor: 'pointer', fontSize: 11, fontFamily: 'inherit', fontWeight: 700 },
  quickGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 4 },
  qcard: { background: '#0f0f0f', border: '1px solid #1a1a1a', borderRadius: 10, padding: '12px 13px', cursor: 'pointer', textAlign: 'left', fontFamily: 'inherit', transition: 'all 0.15s' },
  qdot: { width: 7, height: 7, borderRadius: '50%', marginBottom: 8 },
  qname: { fontSize: 11, fontWeight: 700, marginBottom: 2, color: '#ddd', lineHeight: 1.3 },
  qprice: { fontSize: 10, opacity: 0.4, marginTop: 3 },
  logRow: { display: 'flex', alignItems: 'center', gap: 10, padding: '10px 0', borderBottom: '1px solid #0f0f0f' },
  logDot: { width: 9, height: 9, borderRadius: '50%', flexShrink: 0 },
  logInfo: { flex: 1, minWidth: 0 },
  logName: { fontSize: 13, fontWeight: 700, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' },
  logMeta: { fontSize: 10, opacity: 0.38, marginTop: 2 },
  logRight: { display: 'flex', flexDirection: 'column', alignItems: 'flex-end', gap: 2, flexShrink: 0 },
  logPrice: { fontSize: 10, opacity: 0.4 },
  actions: { display: 'flex', gap: 2, flexShrink: 0 },
  iBtn: { background: 'none', border: 'none', cursor: 'pointer', fontSize: 13, padding: '3px 5px' },
  drinkRow: { display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #0f0f0f' },
  drinkBar: { width: 3, height: 38, borderRadius: 2, flexShrink: 0 },
  drinkInfo: { flex: 1 },
  statGrid: { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 9, marginBottom: 4 },
  statCard: { background: '#0f0f0f', border: '1px solid #161616', borderRadius: 12, padding: '14px 16px' },
  statVal: { fontSize: 24, fontWeight: 700, color: '#39FF14', lineHeight: 1, fontFamily: "'Syne', sans-serif" },
  statLbl: { fontSize: 9, opacity: 0.4, marginTop: 5, letterSpacing: 1.5 },
  bkRow: { padding: '10px 14px', borderRadius: 8, marginBottom: 8 },
  miniTrack: { height: 2, background: '#1a1a1a', borderRadius: 1, marginTop: 8, overflow: 'hidden' },
  miniFill: { height: '100%', borderRadius: 1, transition: 'width 0.5s ease' },
  select: { background: '#111', border: '1px solid #222', color: '#fff', padding: '6px 10px', borderRadius: 6, fontSize: 11, fontFamily: 'inherit' },
  overlay: { position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.85)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', zIndex: 100 },
  sheet: { background: '#111', borderRadius: '18px 18px 0 0', width: '100%', maxWidth: 480, padding: '20px 20px 36px', maxHeight: '85vh', overflowY: 'auto' },
  sheetHead: { display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 20 },
  sheetTitle: { fontFamily: "'Syne', sans-serif", fontSize: 14, fontWeight: 800, letterSpacing: 2, color: '#39FF14' },
  closeBtn: { background: 'none', border: 'none', color: '#555', fontSize: 18, cursor: 'pointer' },
  label: { display: 'block', fontSize: 10, opacity: 0.45, letterSpacing: 1.5, marginBottom: 6, textTransform: 'uppercase' },
  input: { width: '100%', background: '#0A0A0A', border: '1px solid #1e1e1e', color: '#fff', padding: '10px 12px', borderRadius: 8, fontSize: 14, fontFamily: 'inherit', marginBottom: 14, boxSizing: 'border-box' },
  preview: { background: '#0A0A0A', border: '1px solid #1a1a1a', borderRadius: 8, padding: '10px 14px', display: 'flex', gap: 12, alignItems: 'center', marginBottom: 16 },
  bigGreen: { flex: 1, padding: '13px', background: '#39FF14', color: '#000', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 14, fontFamily: 'inherit', fontWeight: 700 },
  grayBtn: { flex: 1, padding: '13px', background: '#1a1a1a', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit' },
  redBtn: { flex: 1, padding: '13px', background: '#FF3B3B', color: '#fff', border: 'none', borderRadius: 10, cursor: 'pointer', fontSize: 13, fontFamily: 'inherit', fontWeight: 700 },
  qtyBtn: { width: 38, height: 38, background: '#1a1a1a', border: 'none', color: '#fff', borderRadius: 8, cursor: 'pointer', fontSize: 20, fontFamily: 'inherit' },
  empty: { opacity: 0.3, fontSize: 12, textAlign: 'center', padding: '24px 0' },
  toast: { position: 'fixed', top: 18, left: '50%', transform: 'translateX(-50%)', padding: '10px 20px', borderRadius: 8, fontWeight: 700, fontSize: 12, zIndex: 200, fontFamily: 'inherit', whiteSpace: 'nowrap', color: '#000', letterSpacing: 0.5 },
}

const CSS = `
  * { box-sizing: border-box; }
  body { margin: 0; }
  .qcard:hover { transform: translateY(-2px); border-color: rgba(57,255,20,0.2) !important; }
  select option { background: #111; }
  input[type=number]::-webkit-inner-spin-button { opacity: 0.3; }
  ::-webkit-scrollbar { width: 3px; }
  ::-webkit-scrollbar-thumb { background: #222; border-radius: 2px; }
`
