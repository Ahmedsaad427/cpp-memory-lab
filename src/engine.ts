// Small deterministic educational C++ memory model. No eval. Addresses are SIMULATED.
export type Var = { name: string; kind: 'int' | 'ptr' | 'arr'; addr: number; vals: (number | null)[]; ptr: number | null }
export type Alloc = { id: number; addr: number; vals: (number | null)[]; isArray: boolean; freed: boolean }
export type State = { vars: Var[]; heap: Alloc[]; cap: number; nextStack: number; nextHeap: number; nextId: number; scopes: number[]; out: string[] }
export type Step = { line: number; state: State; ar: string; changed: string; error?: string }
export const hex = (n: number | null) => (n === null ? 'nullptr' : '0x' + n.toString(16).toUpperCase())
const fresh = (cap: number): State => ({ vars: [], heap: [], cap, nextStack: 0x7000, nextHeap: 0x1000, nextId: 1, scopes: [], out: [] })
const used = (s: State) => s.heap.filter(a => !a.freed).reduce((t, a) => t + a.vals.length * 4, 0)

export function locate(s: State, addr: number | null): { set: (v: number) => void; kind: string } | 'dangling' | null {
  if (addr === null) return null
  for (const v of s.vars) if (v.kind !== 'ptr') for (let i = 0; i < v.vals.length; i++) if (v.addr + i * 4 === addr)
    return { kind: 'stack', set: (n: number) => { v.vals[i] = n } }
  for (const a of s.heap) for (let i = 0; i < a.vals.length; i++) if (a.addr + i * 4 === addr)
    return a.freed ? 'dangling' : { kind: 'heap', set: (n: number) => { a.vals[i] = n } }
  return null
}
export function leaked(s: State) {
  return s.heap.filter(a => !a.freed && !s.vars.some(v => v.kind === 'ptr' && v.ptr !== null && v.ptr >= a.addr && v.ptr < a.addr + a.vals.length * 4))
}
const num = (s: State, t: string): number => {
  t = t.trim(); if (/^-?\d+$/.test(t)) return parseInt(t, 10)
  const v = s.vars.find(x => x.name === t && x.kind === 'int'); if (v && v.vals[0] !== null) return v.vals[0]
  throw new Error(`Unsupported or unknown value: "${t}"`)
}
const ptrVar = (s: State, n: string) => { const v = s.vars.find(x => x.name === n); if (!v || v.kind !== 'ptr') throw new Error(`"${n}" is not a declared pointer`); return v }
function declare(s: State, kind: Var['kind'], name: string, vals: (number | null)[], ptr: number | null = null) {
  if (s.vars.some(v => v.name === name)) throw new Error(`"${name}" is already declared`)
  const v: Var = { name, kind, addr: s.nextStack, vals, ptr }; s.nextStack += Math.max(vals.length, 1) * 4 + (kind === 'ptr' ? 4 : 0); s.vars.push(v); return v
}
function alloc(s: State, count: number, isArray: boolean, init: number | null, nothrow: boolean): number | null {
  if (count < 1 || count > 64) throw new Error('Size must be between 1 and 64 in this simulator')
  if (used(s) + count * 4 > s.cap) {
    if (nothrow) return null
    throw new Error(`std::bad_alloc — requested ${count * 4} bytes but only ${s.cap - used(s)} bytes are free (simulated limit ${s.cap}).`)
  }
  const a: Alloc = { id: s.nextId++, addr: s.nextHeap, vals: Array(count).fill(null).map((_, i) => (i === 0 || isArray ? init : null)), isArray, freed: false }
  if (!isArray) a.vals = [init]; else a.vals = Array(count).fill(null)
  s.nextHeap += count * 4 + 8; s.heap.push(a); return a.addr
}
function rhsPtr(s: State, r: string): { v: number | null; note: string } {
  r = r.trim(); let m
  if (r === 'nullptr' || r === 'NULL') return { v: null, note: 'nullptr' }
  if ((m = r.match(/^&(\w+)$/))) { const t = s.vars.find(x => x.name === m![1] && x.kind !== 'ptr'); if (!t) throw new Error(`Cannot take address of "${m[1]}"`); return { v: t.addr, note: `address of ${t.name}` } }
  if ((m = r.match(/^(?:new\s*(\(std::nothrow\))?\s*)int\s*\[(\w+)\]$/))) return { v: alloc(s, num(s, m[2]), true, null, !!m[1]), note: 'new int[]' }
  if ((m = r.match(/^new\s*(\(std::nothrow\))?\s*int\s*\((-?\w+)\)$/))) return { v: alloc(s, 1, false, num(s, m[2]), !!m[1]), note: 'new int(v)' }
  if ((m = r.match(/^new\s*(\(std::nothrow\))?\s*int$/))) return { v: alloc(s, 1, false, null, !!m[1]), note: 'new int' }
  if ((m = r.match(/^\w+$/))) return { v: ptrVar(s, r).ptr, note: `copy of ${r}` }
  throw new Error(`Unsupported expression: "${r}"`)
}
export function run(code: string, cap: number): Step[] {
  const steps: Step[] = []; let s = fresh(cap)
  const lines = code.split('\n')
  for (let i = 0; i < lines.length; i++) {
    let L = lines[i].trim().replace(/\/\/.*$/, '').trim().replace(/int\s*\*\s*/g, 'int* ')
    if (!L) continue
    const before = leaked(s).length
    let ar = '', changed = '', m
    try {
      if (/\{$/.test(L)) { s.scopes.push(s.vars.length); ar = 'دخلنا Scope جديد. أي متغيرات local هتتعمل جوّاه هتتمسح أوتوماتيك لما يخلص.'; changed = 'New scope'; }
      else if (L === '}') { const n = s.scopes.pop(); if (n === undefined) throw new Error('Unmatched }'); const gone = s.vars.splice(n).map(v => v.name); ar = 'الـ Scope خلص: المتغيرات اللي على الـ Stack اتشالت أوتوماتيك. لكن أي حاجة اتحجزت بـ new ما بتتشالش لوحدها!'; changed = 'Removed from Stack: ' + (gone.join(', ') || 'none') }
      else if ((m = L.match(/^int (\w+)\s*=\s*(-?\w+);$/))) { declare(s, 'int', m[1], [num(s, m[2])]); ar = `اتعمل متغير ${m[1]} على الـ Stack وقيمته ${num(s, m[2])}. الحجم ثابت ومعروف وقت الـ compile.`; changed = `Stack: ${m[1]}` }
      else if ((m = L.match(/^int (\w+)\[(\d+)\]\s*(?:=\s*\{(.*)\})?;$/))) {
        const n = +m[2]; if (n < 1 || n > 64) throw new Error('Array size must be 1..64')
        const init = m[3] !== undefined && m[3].trim() ? m[3].split(',').map(t => num(s, t)) : []
        if (init.length > n) throw new Error('Too many initializers')
        declare(s, 'arr', m[1], Array.from({ length: n }, (_, k) => (k < init.length ? init[k] : m![3] !== undefined ? 0 : null))); ar = `Array ثابتة الحجم (${n} عناصر) على الـ Stack. الحجم لازم يكون معروف قبل التشغيل ومينفعش يتغير.`; changed = `Stack: ${m[1]}[${n}]` }
      else if ((m = L.match(/^int\* (\w+)\s*(?:=\s*(.+))?;$/))) {
        const r = m[2] ? rhsPtr(s, m[2]) : { v: null, note: 'uninitialized' }
        const v = declare(s, 'ptr', m[1], [], r.v)
        if (!m[2]) { v.ptr = null; ar = `إحنا كده عملنا Pointer variable اسمه ${m[1]} بس. ده مش معناه إننا حجزنا Integer في الـ Heap؛ الحجز بيحصل لما ننفذ new. (في الحقيقة قيمته عشوائية، هنا بنعرضه nullptr للتبسيط.)` }
        else if (/new/.test(m[2])) ar = r.v === null ? 'الـ new(std::nothrow) فشل فرجّع nullptr بدل ما يرمي exception.' : `الـ new حجز مكان في الـ Heap وبعتلنا عنوانه (${hex(r.v)}). الـ Pointer ${m[1]} نفسه على الـ Stack، والـ object اللي بيشاور عليه في الـ Heap — شيئين منفصلين.`
        else ar = `الـ Pointer ${m[1]} بيخزّن ${r.note}. الـ Pointer مجرد عنوان.`
        changed = `Stack: ${m[1]} = ${hex(r.v)}` }
      else if ((m = L.match(/^delete\[\]\s*(\w+);$/))) {
        const p = ptrVar(s, m[1]); if (p.ptr === null) { ar = 'delete[] على nullptr آمن ومبيعملش حاجة.'; changed = 'nothing' } else {
          const a = s.heap.find(x => x.addr === p.ptr); if (!a) throw new Error('delete[] on an address that is not the start of a heap allocation — undefined behavior (blocked).')
          if (a.freed) throw new Error('Double delete — undefined behavior in real C++. The simulator stopped here.')
          if (!a.isArray) throw new Error('delete[] used on memory allocated with plain new — undefined behavior (blocked).')
          a.freed = true; ar = `delete[] حرّر الـ Array كلها (${a.vals.length} عناصر). الـ Pointer ${m[1]} لسه موجود على الـ Stack وبيشاور على عنوان قديم = Dangling pointer. لازم نستخدم delete[] مع new[].`; changed = `Heap: array #${a.id} released` } }
      else if ((m = L.match(/^delete\s+(\w+);$/))) {
        const p = ptrVar(s, m[1]); if (p.ptr === null) { ar = 'delete على nullptr آمن ومبيعملش حاجة.'; changed = 'nothing' } else {
          const a = s.heap.find(x => x.addr === p.ptr); if (!a) throw new Error('delete on a pointer that does not point to a heap allocation — undefined behavior (blocked).')
          if (a.freed) throw new Error('Double delete — undefined behavior in real C++. The simulator stopped here. Fix: set p = nullptr after delete.')
          if (a.isArray) throw new Error('delete used on memory allocated with new[] — use delete[] (blocked).')
          a.freed = true; ar = `delete حرّر الـ object في الـ Heap، مش الـ Pointer نفسه. ${m[1]} لسه محتفظ بالعنوان القديم = Dangling pointer. اعمل ${m[1]} = nullptr.`; changed = `Heap: #${a.id} released; ${m[1]} is dangling` } }
      else if ((m = L.match(/^\*(\w+)\s*=\s*(-?\w+);$/))) {
        const p = ptrVar(s, m[1]), t = locate(s, p.ptr)
        if (p.ptr === null) throw new Error('Dereferencing nullptr — undefined behavior (blocked).')
        if (t === 'dangling' || t === null) throw new Error('Dereferencing a dangling pointer — undefined behavior (blocked).')
        const val = num(s, m[2]); t.set(val); ar = `*${m[1]} = ${val} غيّر القيمة اللي في المكان المشاور عليه. الـ Pointer نفسه ما اتغيرش.`; changed = `Value at ${hex(p.ptr)} = ${val}` }
      else if ((m = L.match(/^(\w+)\[(\d+)\]\s*=\s*(-?\w+);$/))) {
        const v = s.vars.find(x => x.name === m![1]); const idx = +m[2], val = num(s, m[3]); if (!v) throw new Error(`"${m[1]}" not declared`)
        if (v.kind === 'arr') { if (idx >= v.vals.length) throw new Error('Index out of bounds — undefined behavior (blocked).'); v.vals[idx] = val; changed = `${m[1]}[${idx}] = ${val}` }
        else if (v.kind === 'ptr') { const a = s.heap.find(x => v.ptr !== null && x.addr === v.ptr); if (!a) throw new Error('Pointer does not point to a heap array'); if (a.freed) throw new Error('Using a freed array — undefined behavior (blocked).'); if (idx >= a.vals.length) throw new Error('Index out of bounds — undefined behavior (blocked).'); a.vals[idx] = val; changed = `Heap #${a.id}[${idx}] = ${val}` }
        else throw new Error('Not an array or pointer')
        ar = `اتغيّر العنصر رقم ${idx} بس. باقي العناصر زي ما هي.` }
      else if ((m = L.match(/^(\w+)\s*=\s*(.+);$/))) {
        const v = s.vars.find(x => x.name === m![1]); if (!v) throw new Error(`"${m[1]}" not declared`)
        if (v.kind === 'int') { v.vals[0] = num(s, m[2]); ar = `قيمة ${v.name} اتغيرت لـ ${v.vals[0]}.`; changed = `${v.name} = ${v.vals[0]}` }
        else if (v.kind === 'ptr') { const r = rhsPtr(s, m[2]); v.ptr = r.v
          ar = r.v === null ? `${v.name} = nullptr بيمسح العنوان من الـ Pointer. ده مش بيرجّع اللي اتحرر.` : /new/.test(m[2]) ? `الـ Pointer ${v.name} بقى بيشاور على allocation جديد. اللي كان بيشاور عليه قبل كده لسه موجود لو ما اتعملوش delete.` : `${v.name} = غيّر الـ target بس (الـ Pointer بيشاور على مكان تاني)، القيم نفسها ما اتغيرتش.`; changed = `${v.name} → ${hex(v.ptr)}` }
        else throw new Error('Cannot assign to an array') }
      else throw new Error('Unsupported syntax. Supported: int x = 5; int a[3] = {1,2,3}; int* p = &x | new int(5) | new int | new int[n] | nullptr; *p = 5; a[i] = 5; p = &y; p = q; p = nullptr; delete p; delete[] p; { }')
      if (leaked(s).length > before) ar += ' ⚠ تحذير: الـ allocation القديم بقى unreachable = Memory leak!'
      steps.push({ line: i, state: structuredClone(s), ar, changed })
    } catch (e) {
      steps.push({ line: i, state: structuredClone(s), ar: '', changed: '', error: (e as Error).message }); break
    }
  }
  return steps
}
