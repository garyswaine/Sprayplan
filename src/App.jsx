import { useState, useMemo, useEffect, useCallback } from "react";

// ─── SUPABASE CONFIG ──────────────────────────────────────────────────────────
const SUPABASE_URL = "https://yivxsolijwsytroddywg.supabase.co";
const SUPABASE_KEY = "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Inlpdnhzb2xpandzeXRyb2RkeXdnIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODI2ODQ2MDYsImV4cCI6MjA5ODI2MDYwNn0.SKENcZHn2OrgvLqN_i6hmsLx6lfQlv5lOqPwl7zQQwA";
const H = { "Content-Type": "application/json", "apikey": SUPABASE_KEY, "Authorization": `Bearer ${SUPABASE_KEY}`, "Prefer": "return=representation" };
const api = (table) => `${SUPABASE_URL}/rest/v1/${table}`;

async function sbGet(table, params = "") {
  const r = await fetch(`${api(table)}?${params}`, { headers: H });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbInsert(table, body) {
  const r = await fetch(api(table), { method: "POST", headers: H, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbUpdate(table, id, body) {
  const r = await fetch(`${api(table)}?id=eq.${id}`, { method: "PATCH", headers: H, body: JSON.stringify(body) });
  if (!r.ok) throw new Error(await r.text());
  return r.json();
}
async function sbDelete(table, id) {
  const r = await fetch(`${api(table)}?id=eq.${id}`, { method: "DELETE", headers: H });
  if (!r.ok) throw new Error(await r.text());
}

// ─── HELPERS ─────────────────────────────────────────────────────────────────
const CHEM_TYPES = ["Fungicide", "Herbicide", "Insecticide", "Bio Control", "Feed", "Growth Regulator"];
const APP_METHODS = ["Big Sprayer", "Knapsack", "Blower", "IBC"];

function getWeekNumber(date) {
  const d = new Date(Date.UTC(date.getFullYear(), date.getMonth(), date.getDate()));
  const dayNum = d.getUTCDay() || 7;
  d.setUTCDate(d.getUTCDate() + 4 - dayNum);
  const yearStart = new Date(Date.UTC(d.getUTCFullYear(), 0, 1));
  return Math.ceil(((d - yearStart) / 86400000 + 1) / 7);
}
function formatDate(s) {
  if (!s) return "—";
  return new Date(s).toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}
function addWeeks(dateStr, weeks) {
  const d = new Date(dateStr);
  d.setDate(d.getDate() + weeks * 7);
  return d.toISOString().split("T")[0];
}

// Map DB row → app object
function rowToTask(r) {
  return {
    id: r.id,
    location: r.location,
    instruction: r.instruction || "",
    comments: r.comments || "",
    operative: r.operative,
    date: r.date,
    completed: r.completed,
    completedDate: r.completed_date || null,
    spotSpray: r.spot_spray,
    frequencyWeeks: r.frequency_weeks,
    nextDate: r.next_date || null,
    chemicals: r.chemicals || [],
  };
}
function taskToRow(t) {
  return {
    location: t.location,
    instruction: t.instruction,
    comments: t.comments,
    operative: t.operative,
    date: t.date,
    completed: t.completed,
    completed_date: t.completedDate || null,
    spot_spray: t.spotSpray,
    frequency_weeks: t.frequencyWeeks,
    next_date: t.nextDate || null,
    chemicals: t.chemicals,
  };
}
function rowToChem(r) {
  return { id: r.id, name: r.name, type: r.type, rate: r.rate || "", methods: r.methods || [], resprayWeeks: r.respray_weeks, autoRespray: r.auto_respray };
}
function chemToRow(c) {
  return { name: c.name, type: c.type, rate: c.rate, methods: c.methods, respray_weeks: c.resprayWeeks, auto_respray: c.autoRespray };
}
function rowToOp(r) { return { id: r.id, name: r.name }; }

const today = new Date().toISOString().split("T")[0];
const weekNum = getWeekNumber(new Date());

// ─── STYLES ──────────────────────────────────────────────────────────────────
const css = `
  @import url('https://fonts.googleapis.com/css2?family=DM+Serif+Display:ital@0;1&family=Inter:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500&display=swap');
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  body { font-family: 'Inter', sans-serif; background: #F5F2EC; color: #1A1A1A; }
  :root {
    --forest:#1C3A2B;--sage:#4A7C59;--mist:#A8C5A0;--cream:#F5F2EC;--straw:#E8DFC8;
    --clay:#8B6F47;--red:#C0392B;--gold:#D4A017;--ink:#1A1A1A;--mid:#5A5A4A;--border:#D1C9B8;
  }
  .app{display:flex;min-height:100vh;}
  .sidebar{width:220px;min-width:220px;background:var(--forest);color:#c8d9c2;display:flex;flex-direction:column;}
  .sidebar-logo{padding:24px 20px 16px;border-bottom:1px solid rgba(255,255,255,0.08);}
  .sidebar-logo h1{font-family:'DM Serif Display',serif;font-size:18px;color:#fff;line-height:1.2;}
  .sidebar-logo span{font-size:11px;color:var(--mist);letter-spacing:.06em;text-transform:uppercase;}
  .sidebar-week{padding:12px 20px;font-family:'IBM Plex Mono',monospace;font-size:11px;color:var(--mist);border-bottom:1px solid rgba(255,255,255,0.06);}
  .nav-item{display:flex;align-items:center;gap:10px;padding:10px 20px;cursor:pointer;font-size:13px;font-weight:500;border:none;background:none;color:#c8d9c2;width:100%;text-align:left;transition:background .15s;}
  .nav-item:hover{background:rgba(255,255,255,0.06);color:#fff;}
  .nav-item.active{background:var(--sage);color:#fff;}
  .nav-section{padding:16px 20px 6px;font-size:10px;letter-spacing:.1em;text-transform:uppercase;color:rgba(200,217,194,0.4);}
  .main{flex:1;display:flex;flex-direction:column;overflow:hidden;}
  .topbar{background:#fff;border-bottom:1px solid var(--border);padding:0 28px;height:56px;display:flex;align-items:center;justify-content:space-between;flex-shrink:0;}
  .topbar-title{font-family:'DM Serif Display',serif;font-size:22px;color:var(--forest);}
  .topbar-date{font-size:12px;color:var(--mid);font-family:'IBM Plex Mono',monospace;}
  .content{flex:1;overflow-y:auto;padding:28px;}
  .card{background:#fff;border:1px solid var(--border);border-radius:8px;}
  .card-header{padding:16px 20px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
  .card-header h2{font-family:'DM Serif Display',serif;font-size:17px;color:var(--forest);}
  .card-body{padding:20px;}
  .btn{border:none;border-radius:5px;cursor:pointer;font-size:13px;font-weight:500;font-family:'Inter',sans-serif;transition:opacity .15s;padding:8px 16px;}
  .btn:hover{opacity:.85;}
  .btn-primary{background:var(--sage);color:#fff;}
  .btn-danger{background:var(--red);color:#fff;}
  .btn-ghost{background:transparent;border:1px solid var(--border);color:var(--mid);}
  .btn-sm{padding:5px 10px;font-size:12px;}
  .btn-icon{padding:6px 8px;font-size:14px;}
  .form-group{margin-bottom:14px;}
  .form-label{display:block;font-size:12px;font-weight:600;color:var(--mid);margin-bottom:5px;text-transform:uppercase;letter-spacing:.04em;}
  .form-control{width:100%;border:1px solid var(--border);border-radius:5px;padding:8px 10px;font-size:13px;font-family:'Inter',sans-serif;background:var(--cream);color:var(--ink);outline:none;transition:border-color .15s;}
  .form-control:focus{border-color:var(--sage);background:#fff;}
  .form-row{display:grid;grid-template-columns:1fr 1fr;gap:14px;}
  .form-row-3{display:grid;grid-template-columns:1fr 1fr 1fr;gap:14px;}
  .table-wrap{overflow-x:auto;}
  table{width:100%;border-collapse:collapse;font-size:13px;}
  th{background:var(--straw);color:var(--forest);font-size:11px;font-weight:600;text-transform:uppercase;letter-spacing:.05em;padding:10px 12px;text-align:left;border-bottom:2px solid var(--border);}
  td{padding:10px 12px;border-bottom:1px solid var(--border);vertical-align:middle;}
  tr:last-child td{border-bottom:none;}
  tr.completed-row td{opacity:.55;}
  tr.completed-row{background:#f0f7f0;}
  .badge{display:inline-block;padding:2px 8px;border-radius:20px;font-size:11px;font-weight:600;}
  .badge-fungicide{background:#dbe8f5;color:#1a4f7a;}
  .badge-herbicide{background:#fde8c8;color:#7a3b00;}
  .badge-insecticide{background:#f5dbe8;color:#7a1a4f;}
  .badge-bio{background:#d8f0d8;color:#1a5a1a;}
  .badge-feed{background:#f5f0db;color:#5a4a00;}
  .badge-growth{background:#e8dbf5;color:#3b1a7a;}
  .badge-spot{background:#ffecd2;color:#c06000;border:1px solid #f0b060;}
  .badge-recurring{background:#d2e8ff;color:#004080;border:1px solid #80b8ff;}
  .badge-complete{background:#d8f0d8;color:#1a5a1a;}
  .badge-pending{background:#fff3cd;color:#856404;}
  .badge-mix{background:#ede8f5;color:#3a1a6a;border:1px solid #c8b0f0;}
  .task-overdue td{border-left:3px solid var(--red);}
  .task-today td{border-left:3px solid var(--gold);}
  .task-future td{border-left:3px solid transparent;}
  .stats-row{display:grid;grid-template-columns:repeat(4,1fr);gap:16px;margin-bottom:24px;}
  .stat-card{background:#fff;border:1px solid var(--border);border-radius:8px;padding:16px 20px;}
  .stat-val{font-family:'DM Serif Display',serif;font-size:32px;color:var(--forest);line-height:1;}
  .stat-label{font-size:11px;color:var(--mid);margin-top:4px;text-transform:uppercase;letter-spacing:.06em;}
  .stat-card.alert{border-color:var(--red);}
  .stat-card.alert .stat-val{color:var(--red);}
  .week-block{margin-bottom:20px;}
  .week-label{font-family:'IBM Plex Mono',monospace;font-size:12px;color:var(--clay);background:var(--straw);border:1px solid var(--border);border-radius:4px;padding:4px 10px;display:inline-block;margin-bottom:8px;}
  .modal-overlay{position:fixed;inset:0;background:rgba(0,0,0,0.4);display:flex;align-items:center;justify-content:center;z-index:100;}
  .modal{background:#fff;border-radius:10px;width:640px;max-width:96vw;max-height:90vh;overflow-y:auto;box-shadow:0 20px 60px rgba(0,0,0,0.2);}
  .modal-header{padding:20px 24px;border-bottom:1px solid var(--border);display:flex;align-items:center;justify-content:space-between;}
  .modal-header h2{font-family:'DM Serif Display',serif;font-size:20px;color:var(--forest);}
  .modal-body{padding:24px;}
  .modal-footer{padding:16px 24px;border-top:1px solid var(--border);display:flex;gap:10px;justify-content:flex-end;}
  .empty{text-align:center;color:var(--mid);padding:40px 20px;font-size:14px;}
  .checkbox-done{width:16px;height:16px;accent-color:var(--sage);cursor:pointer;}
  .tag-row{display:flex;gap:6px;flex-wrap:wrap;}
  .info-box{background:var(--straw);border:1px solid var(--border);border-radius:6px;padding:12px 14px;font-size:12px;color:var(--mid);margin-bottom:16px;}
  .chem-row{background:var(--cream);border:1px solid var(--border);border-radius:6px;padding:12px 14px;margin-bottom:10px;}
  .chem-row-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:10px;}
  .chem-row-label{font-size:12px;font-weight:600;color:var(--forest);text-transform:uppercase;letter-spacing:.05em;}
  .chem-list-cell{display:flex;flex-direction:column;gap:4px;}
  .chem-pill{display:flex;align-items:center;gap:6px;font-size:12px;}
  .chem-pill-name{font-weight:600;color:var(--ink);}
  .chem-pill-meta{color:var(--mid);font-family:'IBM Plex Mono',monospace;font-size:11px;}
  .loading{display:flex;align-items:center;justify-content:center;height:100vh;flex-direction:column;gap:16px;background:var(--cream);}
  .spinner{width:36px;height:36px;border:3px solid var(--border);border-top-color:var(--sage);border-radius:50%;animation:spin .8s linear infinite;}
  @keyframes spin{to{transform:rotate(360deg)}}
  .sync-dot{width:8px;height:8px;border-radius:50%;background:var(--sage);display:inline-block;margin-right:6px;}
  .sync-dot.error{background:var(--red);}
  .error-banner{background:#fde;border:1px solid var(--red);border-radius:6px;padding:10px 14px;font-size:12px;color:var(--red);margin-bottom:16px;}
`;

// ─── SMALL UI PIECES ─────────────────────────────────────────────────────────
function Spinner() { return <div className="spinner" />; }

function Modal({ title, onClose, children, footer }) {
  return (
    <div className="modal-overlay" onClick={onClose}>
      <div className="modal" onClick={e => e.stopPropagation()}>
        <div className="modal-header">
          <h2>{title}</h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>✕ Close</button>
        </div>
        <div className="modal-body">{children}</div>
        {footer && <div className="modal-footer">{footer}</div>}
      </div>
    </div>
  );
}

function ChemCell({ chemicals }) {
  if (!chemicals || chemicals.length === 0) return <span style={{ color: "var(--mid)" }}>—</span>;
  if (chemicals.length === 1) {
    const c = chemicals[0];
    return (
      <div className="chem-list-cell">
        <div className="chem-pill"><span className="chem-pill-name">{c.name}</span></div>
        <div className="chem-pill-meta">{c.method} · {c.rate}</div>
      </div>
    );
  }
  return (
    <div className="chem-list-cell">
      <div style={{ marginBottom: 4 }}><span className="badge badge-mix">🧪 Tank mix · {chemicals.length} chemicals</span></div>
      {chemicals.map((c, i) => (
        <div key={i} className="chem-pill" style={{ paddingLeft: 4, borderLeft: "2px solid var(--border)", marginBottom: 2 }}>
          <span className="chem-pill-name">{c.name}</span>
          <span className="chem-pill-meta">· {c.method} · {c.rate}</span>
        </div>
      ))}
    </div>
  );
}

// ─── CHEMICAL PICKER ─────────────────────────────────────────────────────────
function ChemicalPicker({ chemData, value, onChange }) {
  function addChem() {
    const first = chemData[0];
    onChange([...value, { name: first?.name || "", method: first?.methods?.[0] || APP_METHODS[0], rate: first?.rate || "" }]);
  }
  function removeChem(i) { onChange(value.filter((_, idx) => idx !== i)); }
  function updateChemField(i, field, val) { onChange(value.map((c, idx) => idx === i ? { ...c, [field]: val } : c)); }
  function handleChemName(i, name) {
    const found = chemData.find(c => c.name === name);
    onChange(value.map((c, idx) => idx === i ? { name, method: found?.methods?.[0] || APP_METHODS[0], rate: found?.rate || "" } : c));
  }
  return (
    <div>
      <label className="form-label" style={{ marginBottom: 8, display: "block" }}>Chemicals to Apply *</label>
      {value.length === 0 && <div className="info-box">No chemicals added. Click the button below to begin.</div>}
      {value.map((c, i) => {
        const found = chemData.find(x => x.name === c.name);
        const availMethods = found?.methods || APP_METHODS;
        return (
          <div className="chem-row" key={i}>
            <div className="chem-row-header">
              <span className="chem-row-label">#{i + 1} Chemical</span>
              <button type="button" className="btn btn-danger btn-sm" onClick={() => removeChem(i)}>✕ Remove</button>
            </div>
            <div className="form-row-3">
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Name</label>
                <select className="form-control" value={c.name} onChange={e => handleChemName(i, e.target.value)}>
                  {chemData.map(ch => <option key={ch.id}>{ch.name}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Method</label>
                <select className="form-control" value={c.method} onChange={e => updateChemField(i, "method", e.target.value)}>
                  {availMethods.map(m => <option key={m}>{m}</option>)}
                </select>
              </div>
              <div className="form-group" style={{ marginBottom: 0 }}>
                <label className="form-label">Rate Override</label>
                <input className="form-control" value={c.rate} onChange={e => updateChemField(i, "rate", e.target.value)} placeholder={found?.rate || "e.g. 1L/ha"} />
              </div>
            </div>
          </div>
        );
      })}
      <button type="button" className="btn btn-primary" onClick={addChem}
        style={{ width: "100%", marginTop: 4, marginBottom: value.length > 1 ? 8 : 0, border: "2px dashed rgba(255,255,255,0.4)", fontSize: 13 }}>
        + Add Another Chemical to This Task
      </button>
      {value.length > 1 && (
        <div className="info-box" style={{ marginTop: 4 }}>
          🧪 <strong>Tank mix · {value.length} chemicals:</strong> Verify compatibility before mixing.
        </div>
      )}
    </div>
  );
}

// ─── TASK FORM ────────────────────────────────────────────────────────────────
function TaskForm({ chemicals, operatives, initial, onSave, onCancel, saving }) {
  const blank = {
    chemicals: chemicals.length > 0 ? [{ name: chemicals[0].name, method: chemicals[0].methods[0], rate: chemicals[0].rate }] : [],
    location: "", instruction: "", comments: "",
    operative: operatives[0]?.name || "",
    date: today, spotSpray: false, frequencyWeeks: 0,
    completed: false, completedDate: null,
  };
  const [form, setForm] = useState(initial ? { ...blank, ...initial, chemicals: initial.chemicals ? initial.chemicals.map(c => ({ ...c })) : blank.chemicals } : blank);
  const set = (k, v) => setForm(f => ({ ...f, [k]: v }));

  function handleSave() {
    if (!form.chemicals || form.chemicals.length === 0) return alert("Add at least one chemical.");
    if (!form.location || !form.operative || !form.date) return alert("Please fill in location, operative and date.");
    const nextDate = form.frequencyWeeks > 0 ? addWeeks(form.date, form.frequencyWeeks) : null;
    onSave({ ...form, nextDate });
  }

  return (
    <>
      <ChemicalPicker chemData={chemicals} value={form.chemicals} onChange={v => set("chemicals", v)} />
      <div style={{ height: 14 }} />
      <div className="form-group">
        <label className="form-label">Location / Where to Spray *</label>
        <input className="form-control" value={form.location} onChange={e => set("location", e.target.value)} placeholder="e.g. Field A – North Block" />
      </div>
      <div className="form-group">
        <label className="form-label">Instructions</label>
        <textarea className="form-control" rows={3} value={form.instruction} onChange={e => set("instruction", e.target.value)} placeholder="Application notes…" />
      </div>
      <div className="form-group">
        <label className="form-label">Comments</label>
        <textarea className="form-control" rows={2} value={form.comments} onChange={e => set("comments", e.target.value)} placeholder="Any additional notes…" />
      </div>
      <div className="form-row-3">
        <div className="form-group">
          <label className="form-label">Operative *</label>
          <select className="form-control" value={form.operative} onChange={e => set("operative", e.target.value)}>
            {operatives.map(o => <option key={o.id}>{o.name}</option>)}
          </select>
        </div>
        <div className="form-group">
          <label className="form-label">Date *</label>
          <input type="date" className="form-control" value={form.date} onChange={e => set("date", e.target.value)} />
        </div>
        <div className="form-group">
          <label className="form-label">Frequency (weeks)</label>
          <input type="number" className="form-control" min={0} max={52} value={form.frequencyWeeks} onChange={e => set("frequencyWeeks", parseInt(e.target.value) || 0)} placeholder="0 = once" />
        </div>
      </div>
      <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <input type="checkbox" id="spot" checked={form.spotSpray} onChange={e => set("spotSpray", e.target.checked)} />
        <label htmlFor="spot" style={{ fontSize: 13, color: "var(--mid)", cursor: "pointer" }}>⚠ Spot Spray (targeted application)</label>
      </div>
      <div style={{ display: "flex", gap: 10, justifyContent: "flex-end", marginTop: 8 }}>
        <button type="button" className="btn btn-ghost" onClick={onCancel} disabled={saving}>Cancel</button>
        <button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>
          {saving ? "Saving…" : initial ? "Save Changes" : "Add to Schedule"}
        </button>
      </div>
    </>
  );
}

// ─── TO-DO VIEW ───────────────────────────────────────────────────────────────
function TodoView({ tasks, chemicals, operatives, onAdd, onUpdate, onDelete, isManager, error }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);

  const sorted = useMemo(() => {
    const inc = tasks.filter(t => !t.completed).sort((a, b) => new Date(a.date) - new Date(b.date));
    const comp = tasks.filter(t => t.completed).sort((a, b) => new Date(b.completedDate) - new Date(a.completedDate));
    return [...inc, ...comp];
  }, [tasks]);

  async function handleSave(form) {
    setSaving(true);
    try {
      if (editing) await onUpdate({ ...form, id: editing.id });
      else await onAdd(form);
      setShowForm(false); setEditing(null);
    } finally { setSaving(false); }
  }

  function rowClass(t) {
    if (t.completed) return "completed-row";
    if (t.date < today) return "task-overdue";
    if (t.date === today) return "task-today";
    return "task-future";
  }

  return (
    <div>
      <div className="stats-row">
        <div className="stat-card"><div className="stat-val">{tasks.filter(t => !t.completed).length}</div><div className="stat-label">Pending</div></div>
        <div className="stat-card alert"><div className="stat-val">{tasks.filter(t => !t.completed && t.date < today).length}</div><div className="stat-label">Overdue</div></div>
        <div className="stat-card"><div className="stat-val">{tasks.filter(t => !t.completed && t.date === today).length}</div><div className="stat-label">Due Today</div></div>
        <div className="stat-card"><div className="stat-val">{tasks.filter(t => t.completed).length}</div><div className="stat-label">Completed</div></div>
      </div>
      {error && <div className="error-banner">⚠ {error}</div>}
      <div className="card">
        <div className="card-header">
          <h2>Spray To-Do List</h2>
          {isManager && <button type="button" className="btn btn-primary btn-sm" onClick={() => setShowForm(true)}>+ Add Task</button>}
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th style={{ width: 36 }}>Done</th>
                <th>Chemicals</th>
                <th>Location</th>
                <th>Operative</th>
                <th>Date</th>
                <th>Flags</th>
                <th>Instructions</th>
                {isManager && <th>Actions</th>}
              </tr>
            </thead>
            <tbody>
              {sorted.length === 0 && <tr><td colSpan={isManager ? 8 : 7} className="empty">No tasks yet.</td></tr>}
              {sorted.map(task => (
                <tr key={task.id} className={rowClass(task)}>
                  <td>
                    <input type="checkbox" className="checkbox-done" checked={task.completed}
                      onChange={() => onUpdate({ ...task, completed: !task.completed, completedDate: !task.completed ? today : null })} />
                  </td>
                  <td style={{ minWidth: 200 }}>
                    <ChemCell chemicals={task.chemicals} />
                    {task.completed && <div style={{ marginTop: 4 }}><span className="badge badge-complete">✓ Done {formatDate(task.completedDate)}</span></div>}
                  </td>
                  <td style={{ maxWidth: 150 }}>{task.location}</td>
                  <td>{task.operative}</td>
                  <td style={{ fontFamily: "IBM Plex Mono", fontSize: 12, whiteSpace: "nowrap" }}>
                    {formatDate(task.date)}
                    {!task.completed && task.date < today && <div style={{ color: "var(--red)", fontSize: 11, fontWeight: 600 }}>OVERDUE</div>}
                    {!task.completed && task.date === today && <div style={{ color: "var(--gold)", fontSize: 11, fontWeight: 600 }}>TODAY</div>}
                  </td>
                  <td>
                    <div className="tag-row">
                      {task.spotSpray && <span className="badge badge-spot">Spot</span>}
                      {task.frequencyWeeks > 0 && <span className="badge badge-recurring">Every {task.frequencyWeeks}w</span>}
                    </div>
                  </td>
                  <td style={{ maxWidth: 180, fontSize: 12, color: "var(--mid)" }}>
                    {task.instruction || "—"}
                    {task.comments && <div style={{ marginTop: 3, color: "var(--clay)" }}>💬 {task.comments}</div>}
                  </td>
                  {isManager && (
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button type="button" className="btn btn-ghost btn-icon" onClick={() => setEditing(task)}>✏️</button>
                        <button type="button" className="btn btn-danger btn-icon" onClick={() => { if (confirm("Delete this task?")) onDelete(task.id); }}>🗑</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {(showForm || editing) && (
        <Modal title={editing ? "Edit Task" : "Add New Spray Task"} onClose={() => { setShowForm(false); setEditing(null); }}>
          <TaskForm chemicals={chemicals} operatives={operatives} initial={editing} onSave={handleSave}
            onCancel={() => { setShowForm(false); setEditing(null); }} saving={saving} />
        </Modal>
      )}
    </div>
  );
}

// ─── SCHEDULE VIEW ────────────────────────────────────────────────────────────
function ScheduleView({ tasks }) {
  const byWeek = useMemo(() => {
    const map = {};
    tasks.forEach(t => {
      const wn = getWeekNumber(new Date(t.date));
      const key = `${new Date(t.date).getFullYear()}-W${String(wn).padStart(2, "0")}`;
      if (!map[key]) map[key] = [];
      map[key].push(t);
    });
    return Object.entries(map).sort(([a], [b]) => a.localeCompare(b));
  }, [tasks]);

  return (
    <div>
      <div className="info-box" style={{ marginBottom: 20 }}>
        📅 Current week: <strong>Week {weekNum}</strong> — {new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}
      </div>
      {byWeek.length === 0 && <div className="empty card" style={{ padding: 40 }}>No tasks scheduled.</div>}
      {byWeek.map(([weekKey, weekTasks]) => {
        const [yr, wLabel] = weekKey.split("-");
        const wn = parseInt(wLabel.replace("W", ""));
        const isCurrent = wn === weekNum;
        return (
          <div className="week-block" key={weekKey}>
            <div className="week-label" style={isCurrent ? { background: "var(--sage)", color: "#fff" } : {}}>
              {isCurrent ? "▶ " : ""}{yr} · Week {wn}
            </div>
            <div className="card">
              <div className="table-wrap">
                <table>
                  <thead><tr><th>Date</th><th>Chemicals</th><th>Location</th><th>Operative</th><th>Status</th></tr></thead>
                  <tbody>
                    {weekTasks.sort((a, b) => new Date(a.date) - new Date(b.date)).map(t => (
                      <tr key={t.id} className={t.completed ? "completed-row" : ""}>
                        <td style={{ fontFamily: "IBM Plex Mono", fontSize: 12, whiteSpace: "nowrap" }}>{formatDate(t.date)}</td>
                        <td style={{ minWidth: 180 }}><ChemCell chemicals={t.chemicals} /></td>
                        <td>{t.location}</td>
                        <td>{t.operative}</td>
                        <td>
                          {t.completed ? <span className="badge badge-complete">✓ Sprayed</span>
                            : t.date < today ? <span className="badge" style={{ background: "#fde", color: "var(--red)" }}>Overdue</span>
                            : <span className="badge badge-pending">Pending</span>}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── CHEMICALS VIEW ───────────────────────────────────────────────────────────
function ChemicalsView({ chemicals, onAdd, onUpdate, onDelete, isManager }) {
  const [showForm, setShowForm] = useState(false);
  const [editing, setEditing] = useState(null);
  const [saving, setSaving] = useState(false);
  const blankChem = { name: "", type: "Fungicide", rate: "", methods: ["Knapsack"], resprayWeeks: 0, autoRespray: false };
  const [form, setForm] = useState(blankChem);

  function openAdd() { setForm(blankChem); setEditing(null); setShowForm(true); }
  function openEdit(c) { setForm({ ...c, methods: [...c.methods] }); setEditing(c); setShowForm(true); }
  function toggleMethod(m) { setForm(f => ({ ...f, methods: f.methods.includes(m) ? f.methods.filter(x => x !== m) : [...f.methods, m] })); }

  async function handleSave() {
    if (!form.name || !form.type || form.methods.length === 0) return alert("Fill in name, type, and at least one method.");
    setSaving(true);
    try {
      if (editing) await onUpdate({ ...form, id: editing.id });
      else await onAdd(form);
      setShowForm(false);
    } finally { setSaving(false); }
  }

  const typeMap = { "Fungicide": "badge-fungicide", "Herbicide": "badge-herbicide", "Insecticide": "badge-insecticide", "Bio Control": "badge-bio", "Feed": "badge-feed", "Growth Regulator": "badge-growth" };

  return (
    <div>
      <div className="card">
        <div className="card-header">
          <h2>Chemical Dataset</h2>
          {isManager && <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>+ Add Chemical</button>}
        </div>
        <div className="table-wrap">
          <table>
            <thead><tr><th>Name</th><th>Type</th><th>Rate</th><th>Methods</th><th>Respray</th><th>Auto</th>{isManager && <th>Actions</th>}</tr></thead>
            <tbody>
              {chemicals.map(c => (
                <tr key={c.id}>
                  <td><strong>{c.name}</strong></td>
                  <td><span className={`badge ${typeMap[c.type] || ""}`}>{c.type}</span></td>
                  <td style={{ fontFamily: "IBM Plex Mono", fontSize: 12 }}>{c.rate || "—"}</td>
                  <td><div className="tag-row">{c.methods.map(m => <span key={m} className="badge badge-pending">{m}</span>)}</div></td>
                  <td style={{ fontFamily: "IBM Plex Mono" }}>{c.resprayWeeks > 0 ? `${c.resprayWeeks}w` : "—"}</td>
                  <td>{c.autoRespray ? <span className="badge badge-complete">✓</span> : <span className="badge" style={{ background: "#eee", color: "#888" }}>—</span>}</td>
                  {isManager && (
                    <td>
                      <div style={{ display: "flex", gap: 4 }}>
                        <button type="button" className="btn btn-ghost btn-icon" onClick={() => openEdit(c)}>✏️</button>
                        <button type="button" className="btn btn-danger btn-icon" onClick={() => { if (confirm("Remove chemical?")) onDelete(c.id); }}>🗑</button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
      {showForm && (
        <Modal title={editing ? "Edit Chemical" : "Add Chemical"} onClose={() => setShowForm(false)}
          footer={<><button type="button" className="btn btn-ghost" onClick={() => setShowForm(false)} disabled={saving}>Cancel</button><button type="button" className="btn btn-primary" onClick={handleSave} disabled={saving}>{saving ? "Saving…" : editing ? "Save" : "Add Chemical"}</button></>}>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Name *</label><input className="form-control" value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Amistar" /></div>
            <div className="form-group"><label className="form-label">Type *</label><select className="form-control" value={form.type} onChange={e => setForm(f => ({ ...f, type: e.target.value }))}>{CHEM_TYPES.map(t => <option key={t}>{t}</option>)}</select></div>
          </div>
          <div className="form-row">
            <div className="form-group"><label className="form-label">Application Rate</label><input className="form-control" value={form.rate} onChange={e => setForm(f => ({ ...f, rate: e.target.value }))} placeholder="e.g. 1L/ha" /></div>
            <div className="form-group"><label className="form-label">Respray Interval (weeks)</label><input type="number" min={0} className="form-control" value={form.resprayWeeks} onChange={e => setForm(f => ({ ...f, resprayWeeks: parseInt(e.target.value) || 0 }))} /></div>
          </div>
          <div className="form-group">
            <label className="form-label">Application Methods *</label>
            <div style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 4 }}>
              {APP_METHODS.map(m => <label key={m} style={{ display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13 }}><input type="checkbox" checked={form.methods.includes(m)} onChange={() => toggleMethod(m)} /> {m}</label>)}
            </div>
          </div>
          <div className="form-group" style={{ display: "flex", alignItems: "center", gap: 10 }}>
            <input type="checkbox" id="autoRes" checked={form.autoRespray} onChange={e => setForm(f => ({ ...f, autoRespray: e.target.checked }))} />
            <label htmlFor="autoRes" style={{ fontSize: 13, color: "var(--mid)", cursor: "pointer" }}>Auto-schedule respray on task completion</label>
          </div>
        </Modal>
      )}
    </div>
  );
}

// ─── OPERATIVES VIEW ──────────────────────────────────────────────────────────
function OperativesView({ operatives, onAdd, onDelete, isManager }) {
  const [newName, setNewName] = useState("");
  const [saving, setSaving] = useState(false);
  async function add() {
    if (!newName.trim()) return;
    setSaving(true);
    try { await onAdd(newName.trim()); setNewName(""); } finally { setSaving(false); }
  }
  return (
    <div className="card" style={{ maxWidth: 480 }}>
      <div className="card-header"><h2>Spray Operatives</h2></div>
      <div className="card-body">
        {isManager && (
          <div style={{ display: "flex", gap: 10, marginBottom: 16 }}>
            <input className="form-control" placeholder="Operative name…" value={newName} onChange={e => setNewName(e.target.value)} onKeyDown={e => e.key === "Enter" && add()} />
            <button type="button" className="btn btn-primary" onClick={add} disabled={saving}>{saving ? "…" : "Add"}</button>
          </div>
        )}
        {operatives.length === 0 && <div className="empty">No operatives added yet.</div>}
        {operatives.map(o => (
          <div key={o.id} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", padding: "10px 0", borderBottom: "1px solid var(--border)" }}>
            <span style={{ fontWeight: 500 }}>👤 {o.name}</span>
            {isManager && <button type="button" className="btn btn-danger btn-sm" onClick={() => { if (confirm(`Remove ${o.name}?`)) onDelete(o.id); }}>Remove</button>}
          </div>
        ))}
      </div>
    </div>
  );
}

// ─── MAIN APP ─────────────────────────────────────────────────────────────────
export default function App() {
  const [view, setView] = useState("todo");
  const [isManager, setIsManager] = useState(true);
  const [tasks, setTasks] = useState([]);
  const [chemicals, setChemicals] = useState([]);
  const [operatives, setOperatives] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [syncStatus, setSyncStatus] = useState("ok"); // "ok" | "error"

  // ── Load all data on mount ──────────────────────────────────
  useEffect(() => {
    async function load() {
      try {
        const [t, c, o] = await Promise.all([
          sbGet("tasks", "order=date.asc"),
          sbGet("chemicals", "order=name.asc"),
          sbGet("operatives", "order=name.asc"),
        ]);
        setTasks(t.map(rowToTask));
        setChemicals(c.map(rowToChem));
        setOperatives(o.map(rowToOp));
        setSyncStatus("ok");
      } catch (e) {
        setError("Could not connect to database. Check your Supabase project is active.");
        setSyncStatus("error");
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  // ── Tasks ────────────────────────────────────────────────────
  const addTask = useCallback(async (form) => {
    const rows = await sbInsert("tasks", taskToRow(form));
    const newTask = rowToTask(rows[0]);
    setTasks(ts => [...ts, newTask]);
    // Auto-generate recurring child if completing on add somehow (edge case skip)
  }, []);

  const updateTask = useCallback(async (task) => {
    const wasIncomplete = tasks.find(t => t.id === task.id)?.completed === false;
    await sbUpdate("tasks", task.id, taskToRow(task));
    setTasks(ts => ts.map(t => t.id === task.id ? task : t));
    // Auto-generate next recurrence when marking complete
    if (wasIncomplete && task.completed && task.frequencyWeeks > 0) {
      const nextDate = addWeeks(task.date, task.frequencyWeeks);
      const childForm = { ...task, completed: false, completedDate: null, date: nextDate, nextDate: task.frequencyWeeks > 0 ? addWeeks(nextDate, task.frequencyWeeks) : null };
      const rows = await sbInsert("tasks", taskToRow(childForm));
      setTasks(ts => [...ts, rowToTask(rows[0])]);
    }
  }, [tasks]);

  const deleteTask = useCallback(async (id) => {
    await sbDelete("tasks", id);
    setTasks(ts => ts.filter(t => t.id !== id));
  }, []);

  // ── Chemicals ────────────────────────────────────────────────
  const addChem = useCallback(async (form) => {
    const rows = await sbInsert("chemicals", chemToRow(form));
    setChemicals(cs => [...cs, rowToChem(rows[0])]);
  }, []);

  const updateChem = useCallback(async (chem) => {
    await sbUpdate("chemicals", chem.id, chemToRow(chem));
    setChemicals(cs => cs.map(c => c.id === chem.id ? chem : c));
  }, []);

  const deleteChem = useCallback(async (id) => {
    await sbDelete("chemicals", id);
    setChemicals(cs => cs.filter(c => c.id !== id));
  }, []);

  // ── Operatives ───────────────────────────────────────────────
  const addOp = useCallback(async (name) => {
    const rows = await sbInsert("operatives", { name });
    setOperatives(os => [...os, rowToOp(rows[0])]);
  }, []);

  const deleteOp = useCallback(async (id) => {
    await sbDelete("operatives", id);
    setOperatives(os => os.filter(o => o.id !== id));
  }, []);

  const overdue = tasks.filter(t => !t.completed && t.date < today).length;

  const navItems = [
    { id: "todo", icon: "✅", label: "To-Do List" },
    { id: "schedule", icon: "📅", label: "Schedule" },
    { id: "chemicals", icon: "🧪", label: "Chemicals" },
    { id: "operatives", icon: "👤", label: "Operatives" },
  ];

  if (loading) return (
    <>
      <style>{css}</style>
      <div className="loading">
        <Spinner />
        <div style={{ fontFamily: "IBM Plex Mono", fontSize: 13, color: "var(--mid)" }}>Connecting to database…</div>
      </div>
    </>
  );

  return (
    <>
      <style>{css}</style>
      <div className="app">
        <aside className="sidebar">
          <div className="sidebar-logo">
            <h1>SprayPlan</h1>
            <span>Chemical Scheduler</span>
          </div>
          <div className="sidebar-week">
            <span className={`sync-dot${syncStatus === "error" ? " error" : ""}`} title={syncStatus === "ok" ? "Connected to Supabase" : "Connection error"} />
            Week {weekNum} · {new Date().toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" })}
          </div>
          <div className="nav-section">Workspace</div>
          {navItems.map(n => (
            <button key={n.id} className={`nav-item${view === n.id ? " active" : ""}`} onClick={() => setView(n.id)}>
              <span>{n.icon}</span> {n.label}
              {n.id === "todo" && overdue > 0 && <span style={{ marginLeft: "auto", background: "var(--red)", color: "#fff", borderRadius: 20, fontSize: 10, padding: "1px 6px", fontWeight: 700 }}>{overdue}</span>}
            </button>
          ))}
          <div style={{ marginTop: "auto", padding: "20px", borderTop: "1px solid rgba(255,255,255,0.08)" }}>
            <div style={{ fontSize: 11, color: "var(--mist)", marginBottom: 8, textTransform: "uppercase", letterSpacing: "0.06em" }}>Access Level</div>
            <button type="button" className="btn btn-sm" style={{ background: isManager ? "var(--gold)" : "rgba(255,255,255,0.1)", color: "#fff", width: "100%" }} onClick={() => setIsManager(m => !m)}>
              {isManager ? "🔑 Manager" : "👷 Operative"}
            </button>
          </div>
        </aside>

        <div className="main">
          <div className="topbar">
            <div className="topbar-title">{navItems.find(n => n.id === view)?.icon} {navItems.find(n => n.id === view)?.label}</div>
            <div className="topbar-date">{new Date().toLocaleDateString("en-GB", { weekday: "long", day: "2-digit", month: "long", year: "numeric" })}</div>
          </div>
          <div className="content">
            {!isManager && view !== "todo" && view !== "schedule" && (
              <div className="info-box" style={{ marginBottom: 20 }}>🔒 Read-only. Switch to Manager mode to make changes.</div>
            )}
            {view === "todo" && <TodoView tasks={tasks} chemicals={chemicals} operatives={operatives} onAdd={addTask} onUpdate={updateTask} onDelete={deleteTask} isManager={isManager} error={error} />}
            {view === "schedule" && <ScheduleView tasks={tasks} />}
            {view === "chemicals" && <ChemicalsView chemicals={chemicals} onAdd={addChem} onUpdate={updateChem} onDelete={deleteChem} isManager={isManager} />}
            {view === "operatives" && <OperativesView operatives={operatives} onAdd={addOp} onDelete={deleteOp} isManager={isManager} />}
          </div>
        </div>
      </div>
    </>
  );
}
