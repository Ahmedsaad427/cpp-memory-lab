import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { Play, Pause, SkipBack, SkipForward, RotateCcw, Maximize2, Minimize2, Eye, Pencil } from 'lucide-react'
import { run, hex, leaked, locate, type State } from './engine'
import { scenarios } from './scenarios'

const Cell = ({ addr, label, value, show, cls, id }: { addr: number; label: string; value: string; show: boolean; cls: string; id: string }) => (
  <motion.div layout initial={{ opacity: 0, scale: 0.8 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: 0.5 }}
    data-addr={addr} data-id={id} className={`rounded-md border px-3 py-2 min-w-[84px] text-center font-mono ${cls}`}>
    <div className="text-xs text-slate-400">{label}</div><div className="text-lg">{value}</div>{show && <div className="text-[10px] text-slate-500">{hex(addr)}</div>}
  </motion.div>)

export default function App() {
  const [sid, setSid] = useState(scenarios[0].id)
  const sc = scenarios.find(s => s.id === sid)!
  const [code, setCode] = useState(sc.code); const [cap, setCap] = useState(sc.cap ?? 1024)
  const [idx, setIdx] = useState(-1); const [play, setPlay] = useState(false); const [speed, setSpeed] = useState(1200)
  const [edit, setEdit] = useState(false); const [pres, setPres] = useState(false)
  const [addrs, setAddrs] = useState(true); const [expl, setExpl] = useState(true)
  const steps = useMemo(() => run(code, cap), [code, cap])
  const empty: State = { vars: [], heap: [], cap, nextStack: 0, nextHeap: 0, nextId: 1, scopes: [], out: [] }
  const cur = idx >= 0 ? steps[Math.min(idx, steps.length - 1)] : undefined
  const st = cur?.state ?? empty
  const last = steps.length - 1
  useEffect(() => { if (!play) return; if (idx >= last) { setPlay(false); return } const t = setTimeout(() => setIdx(i => i + 1), speed); return () => clearTimeout(t) }, [play, idx, speed, last])
  const pick = (id: string) => { const s = scenarios.find(x => x.id === id)!; setSid(id); setCode(s.code); setCap(s.cap ?? 1024); setIdx(-1); setPlay(false) }
  const next = () => setIdx(i => Math.min(i + 1, last)); const prev = () => setIdx(i => Math.max(i - 1, -1))
  const leaks = leaked(st)
  // arrows
  const box = useRef<HTMLDivElement>(null); const [arrows, setArrows] = useState<{ x1: number; y1: number; x2: number; y2: number; bad: boolean }[]>([])
  useLayoutEffect(() => {
    const t = setTimeout(() => {
      const b = box.current; if (!b) return; const r0 = b.getBoundingClientRect(); const out: typeof arrows = []
      for (const v of st.vars) if (v.kind === 'ptr' && v.ptr !== null) {
        const from = b.querySelector(`[data-id="var-${v.name}"]`); const to = b.querySelector(`[data-addr="${v.ptr}"]`)
        if (from && to) { const a = from.getBoundingClientRect(), c = to.getBoundingClientRect(); out.push({ x1: a.right - r0.left, y1: a.top + a.height / 2 - r0.top, x2: c.left - r0.left, y2: c.top + c.height / 2 - r0.top, bad: locate(st, v.ptr) === 'dangling' }) }
      }
      setArrows(out)
    }, 350); return () => clearTimeout(t)
  }, [st, addrs, pres])
  const isDangling = (p: number | null) => p !== null && locate(st, p) === 'dangling'

  return (
    <div className="min-h-screen p-3">
      {!pres && <header className="flex flex-wrap items-center gap-2 mb-3">
        <h1 className="text-xl font-bold text-cyan-300 mr-4">C++ Memory Lab</h1>
        {scenarios.map(s => <button key={s.id} onClick={() => pick(s.id)} className={`px-2 py-1 rounded text-sm border ${s.id === sid ? 'bg-cyan-600 border-cyan-400' : 'border-slate-700 hover:bg-slate-800'}`}>{s.title}</button>)}
      </header>}
      <div className="flex flex-wrap gap-2 items-center mb-3 bg-slate-900 border border-slate-700 rounded p-2">
        <button onClick={prev} className="btn" title="Previous"><SkipBack size={18} /></button>
        <button onClick={() => { if (idx >= last) setIdx(-1); setPlay(p => !p) }} className="btn" title="Play/Pause">{play ? <Pause size={18} /> : <Play size={18} />}</button>
        <button onClick={next} className="btn" title="Next"><SkipForward size={18} /></button>
        <button onClick={() => { setIdx(-1); setPlay(false) }} className="btn" title="Reset"><RotateCcw size={18} /></button>
        <label className="text-sm flex items-center gap-1">Speed<input type="range" min={300} max={2500} step={100} value={2800 - speed} onChange={e => setSpeed(2800 - +e.target.value)} /></label>
        <label className="text-sm flex items-center gap-1">Heap cap (bytes)<input type="number" min={4} max={4096} value={cap} onChange={e => { setCap(+e.target.value || 4); setIdx(-1) }} className="w-20 bg-slate-800 rounded px-1" /></label>
        <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={addrs} onChange={e => setAddrs(e.target.checked)} />Addresses</label>
        <label className="text-sm flex items-center gap-1"><input type="checkbox" checked={expl} onChange={e => setExpl(e.target.checked)} />Explanations</label>
        <button onClick={() => setEdit(e => !e)} className="btn">{edit ? <Eye size={18} /> : <Pencil size={18} />}</button>
        <button onClick={() => setPres(p => !p)} className="btn">{pres ? <Minimize2 size={18} /> : <Maximize2 size={18} />}</button>
        <span className="text-xs text-slate-400 ml-auto">Step {Math.max(idx + 1, 0)}/{steps.length} · Addresses are simulated, not real</span>
      </div>
      <div className={`grid gap-3 ${pres ? 'grid-cols-1 xl:grid-cols-[360px_1fr]' : 'grid-cols-1 lg:grid-cols-[340px_1fr]'}`}>
        <section className="bg-slate-900 border border-slate-700 rounded p-3">
          <div className="text-sm text-slate-400 mb-2">main.cpp — {sc.goal}</div>
          {edit ? <textarea value={code} onChange={e => { setCode(e.target.value); setIdx(-1) }} spellCheck={false} className="w-full h-64 bg-slate-950 font-mono text-sm p-2 rounded" /> :
            <pre className="font-mono text-sm">{code.split('\n').map((l, i) => <div key={i} className={`px-2 rounded ${cur && cur.line === i ? (cur.error ? 'bg-red-900/60' : 'bg-cyan-900/70') : ''}`}><span className="text-slate-600 mr-2">{i + 1}</span>{l}</div>)}</pre>}
          <div className="mt-3 text-xs text-slate-300 font-mono bg-slate-950 rounded p-2 min-h-[60px]">
            <div className="text-slate-500">Console</div>
            {steps.slice(0, idx + 1).map((s, i) => s.error ? <div key={i} className="text-red-400">✖ {s.error}</div> : null)}
            {leaks.length > 0 && <div className="text-amber-400">⚠ Memory leak: {leaks.length} allocation(s) unreachable</div>}
          </div>
        </section>
        <section ref={box} className="relative grid md:grid-cols-2 gap-3">
          <svg className="absolute inset-0 w-full h-full pointer-events-none z-10"><defs><marker id="ah" markerWidth="8" markerHeight="8" refX="6" refY="3" orient="auto"><path d="M0,0 L6,3 L0,6 z" fill="#22d3ee" /></marker></defs>
            {arrows.map((a, i) => <motion.path key={i} initial={{ pathLength: 0 }} animate={{ pathLength: 1 }} d={`M${a.x1},${a.y1} C${a.x1 + 60},${a.y1} ${a.x2 - 60},${a.y2} ${a.x2},${a.y2}`} fill="none" stroke={a.bad ? '#ef4444' : '#22d3ee'} strokeWidth={2} strokeDasharray={a.bad ? '6 4' : undefined} markerEnd="url(#ah)" />)}</svg>
          <div className="bg-slate-900 border border-blue-700 rounded p-3"><h2 className="font-semibold text-blue-300 mb-2">Stack</h2>
            <div className="flex flex-wrap gap-2"><AnimatePresence>{st.vars.map(v => v.kind === 'arr' ?
              <div key={v.name} className="border border-slate-700 rounded p-1"><div className="text-xs text-slate-400">{v.name}[{v.vals.length}]</div><div className="flex flex-wrap gap-1">{v.vals.map((x, i) => <Cell key={i} id={`var-${v.name}-${i}`} addr={v.addr + i * 4} label={`[${i}]`} value={x === null ? '?' : String(x)} show={addrs} cls="border-blue-500 bg-blue-950" />)}</div></div> :
              v.kind === 'int' ? <Cell key={v.name} id={`var-${v.name}`} addr={v.addr} label={v.name} value={String(v.vals[0])} show={addrs} cls="border-blue-500 bg-blue-950" /> :
              <Cell key={v.name} id={`var-${v.name}`} addr={v.addr + 100000} label={`${v.name} (int*)`} value={hex(v.ptr)} show={addrs} cls={v.ptr === null ? 'border-slate-500 border-dashed bg-slate-900' : isDangling(v.ptr) ? 'border-red-500 bg-red-950' : 'border-purple-500 bg-purple-950'} />)}</AnimatePresence></div>
            {st.vars.some(v => v.kind === 'ptr' && isDangling(v.ptr)) && <div className="mt-2 text-red-400 text-sm">⛔ Dangling pointer (points to released memory)</div>}</div>
          <div className="bg-slate-900 border border-green-700 rounded p-3"><h2 className="font-semibold text-green-300 mb-2">Heap <span className="text-xs text-slate-400">({st.heap.filter(a => !a.freed).reduce((t, a) => t + a.vals.length * 4, 0)}/{st.cap} bytes)</span></h2>
            <div className="flex flex-wrap gap-2"><AnimatePresence>{st.heap.map(a => <div key={a.id} className={`border rounded p-1 ${a.freed ? 'opacity-40 border-slate-600' : leaks.includes(a) ? 'border-amber-500' : 'border-green-500'}`}>
              <div className="text-xs text-slate-400">#{a.id} {a.isArray ? 'array' : 'int'} {a.freed ? '— RELEASED' : leaks.includes(a) ? '— ⚠ LEAKED' : ''}</div>
              <div className="flex flex-wrap gap-1">{a.vals.map((x, i) => <Cell key={i} id={`h${a.id}-${i}`} addr={a.addr + i * 4} label={a.isArray ? `[${i}]` : 'value'} value={x === null ? '?' : String(x)} show={addrs} cls={a.freed ? 'border-slate-600 line-through' : 'border-green-500 bg-green-950'} />)}</div></div>)}</AnimatePresence></div></div>
          {cur?.error && <div className="md:col-span-2 bg-red-950 border border-red-600 rounded p-3 text-red-200">✖ {cur.error}</div>}
          {expl && cur && !cur.error && <div className="md:col-span-2 bg-slate-900 border border-slate-700 rounded p-3">
            <div className="text-sm text-slate-400">What changed? <span className="font-mono text-cyan-300">{cur.changed}</span></div>
            <p className="ar text-lg mt-1">{cur.ar}</p></div>}
          <div className="md:col-span-2 text-xs text-slate-400 flex gap-4 flex-wrap">
            <span className="text-blue-300">■ Stack value</span><span className="text-purple-300">■ Pointer</span><span className="text-green-300">■ Heap</span><span className="text-amber-400">■ Leak</span><span className="text-red-400">■ Dangling / error</span><span>┄ empty = nullptr</span></div>
        </section>
      </div>
      <style>{`.btn{padding:6px 10px;border:1px solid #334155;border-radius:6px}.btn:hover{background:#1e293b}`}</style>
    </div>)
}
