/**
 * Trello-style task board: next actions linked to a customer, moved between
 * columns by drag-and-drop. Wired to /api/next-actions.
 */
import { Button } from "@/components/ui/button";
import { DragDropContext, Draggable, Droppable, type DropResult } from "@hello-pangea/dnd";
import { Building2, Calendar, Plus, User, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";

type ScreenTarget = "overview" | "inbounds" | "accounts" | "meetings" | "briefing" | "knowledge" | "actions" | "renewals";

type ActionItem = {
  id: string;
  company_name: string | null;
  company_linked: boolean;
  description: string;
  assignee: string | null;
  due_date: string | null;
  priority: "高" | "中" | "低";
  status: "open" | "done" | "dismissed";
};

type Company = { id: string; name: string; category: string };

const COLUMNS: { id: ActionItem["status"]; label: string }[] = [
  { id: "open", label: "未着手" },
  { id: "done", label: "完了" },
  { id: "dismissed", label: "アーカイブ" },
];

function isOverdue(item: ActionItem) {
  return item.status === "open" && !!item.due_date && item.due_date < new Date().toISOString().slice(0, 10);
}

function PriorityTag({ priority }: { priority: ActionItem["priority"] }) {
  const tone = priority === "高" ? "danger" : priority === "中" ? "ochre" : "neutral";
  return <span className={`enterprise-status ${tone}`}>{priority}</span>;
}

// Free-typed company field: any text is accepted as-is (including blank).
// Typing shows matching existing companies below; picking one links the task
// to that real company (shows up on its detail page). Typing something that
// doesn't match just stays as free text, unlinked.
function CompanyField({ text, linked, onChange }: { text: string; linked: boolean; onChange: (text: string, companyId: string | null) => void }) {
  const [results, setResults] = useState<Company[]>([]);

  useEffect(() => {
    if (linked || !text.trim()) { setResults([]); return; }
    const timeout = setTimeout(() => {
      fetch(`/api/companies?q=${encodeURIComponent(text)}&limit=6`, { credentials: "include" })
        .then((r) => r.json())
        .then((data) => setResults(data.companies ?? []))
        .catch(() => setResults([]));
    }, 200);
    return () => clearTimeout(timeout);
  }, [text, linked]);

  return <div>
    <input
      placeholder="取引先名（未登録の名前でも入力可・空欄可）"
      value={text}
      onChange={(e) => onChange(e.target.value, null)}
      style={{ width: "100%", border: "1px solid var(--rule)", borderRadius: 6, padding: 6, fontSize: 12 }}
    />
    {results.length > 0 && <div style={{ marginTop: 4, border: "1px solid var(--rule)", borderRadius: 6, maxHeight: 140, overflowY: "auto" }}>
      {results.map((c) => <button key={c.id} type="button" style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 8px", fontSize: 12 }} onClick={() => { setResults([]); onChange(c.name, c.id); }}>{c.name}<small style={{ marginLeft: 6, color: "var(--ink-muted)" }}>{c.category}</small></button>)}
    </div>}
    {linked && <small style={{ color: "#4a7a5e" }}>登録済みの取引先に紐づけました</small>}
  </div>;
}

export default function ActionRunway({ onNavigate }: { onNavigate: (screen: ScreenTarget) => void }) {
  const [columns, setColumns] = useState<Record<ActionItem["status"], ActionItem[]>>({ open: [], done: [], dismissed: [] });
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [newTask, setNewTask] = useState<{ companyText: string; companyId: string | null; description: string; due_date: string; assignee: string; priority: ActionItem["priority"] }>({ companyText: "", companyId: null, description: "", due_date: "", assignee: "", priority: "中" });

  const load = () => {
    Promise.all(COLUMNS.map((c) => fetch(`/api/next-actions?status=${c.id}`, { credentials: "include" }).then((r) => r.json())))
      .then((results) => {
        setColumns({
          open: results[0].actions ?? [],
          done: results[1].actions ?? [],
          dismissed: results[2].actions ?? [],
        });
        setLoading(false);
      })
      .catch(() => toast.error("タスクの取得に失敗しました"));
  };

  useEffect(load, []);

  const createTask = async () => {
    if (!newTask.description.trim()) return toast.error("タスク内容を入力してください");
    const result = await apiRequest("/api/next-actions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        company_id: newTask.companyId,
        company_name: newTask.companyId ? null : newTask.companyText,
        description: newTask.description,
        due_date: newTask.due_date || null,
        assignee: newTask.assignee || null,
        priority: newTask.priority,
      }),
    });
    if (!result) return;
    setNewTask({ companyText: "", companyId: null, description: "", due_date: "", assignee: "", priority: "中" });
    setShowForm(false);
    load();
    toast.success("タスクを追加しました");
  };

  const onDragEnd = async (result: DropResult) => {
    const { source, destination, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId && source.index === destination.index) return;

    const fromStatus = source.droppableId as ActionItem["status"];
    const toStatus = destination.droppableId as ActionItem["status"];
    const moved = columns[fromStatus].find((a) => a.id === draggableId);
    if (!moved) return;

    // Optimistic move so the drag feels instant; reconciled by reload() on failure.
    setColumns((prev) => {
      const nextFrom = prev[fromStatus].filter((a) => a.id !== draggableId);
      const nextTo = [...prev[toStatus]];
      nextTo.splice(destination.index, 0, { ...moved, status: toStatus });
      return { ...prev, [fromStatus]: nextFrom, [toStatus]: nextTo };
    });

    const ok = await apiRequest(`/api/next-actions/${draggableId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: toStatus }),
    });
    if (!ok) load();
  };

  return <section className="screen-page kanban-page">
    <header className="page-heading">
      <div><p className="eyebrow">TASK BOARD</p><h1>期限のあるタスクを、<br />ボードで動かす。</h1><p>取引先に紐づくタスクをドラッグで進め、終わったものは「完了」へ、不要になったものは「アーカイブ」へ動かします。</p></div>
      <Button className="ink-button" onClick={() => setShowForm((v) => !v)}><Plus size={16} />タスクを追加</Button>
    </header>
    {showForm && <section className="conversion-sheet" style={{ marginBottom: 16 }}>
      <div className="conversion-grid">
        <label>取引先<CompanyField text={newTask.companyText} linked={!!newTask.companyId} onChange={(text, companyId) => setNewTask({ ...newTask, companyText: text, companyId })} /></label>
        <label>タスク内容<input value={newTask.description} onChange={(e) => setNewTask({ ...newTask, description: e.target.value })} /></label>
        <label>期限<input type="date" value={newTask.due_date} onChange={(e) => setNewTask({ ...newTask, due_date: e.target.value })} /></label>
        <label>担当<input value={newTask.assignee} onChange={(e) => setNewTask({ ...newTask, assignee: e.target.value })} /></label>
        <label>優先度<select value={newTask.priority} onChange={(e) => setNewTask({ ...newTask, priority: e.target.value as ActionItem["priority"] })}><option value="高">高</option><option value="中">中</option><option value="低">低</option></select></label>
      </div>
      <div className="conversion-footer"><span /><Button className="ink-button" onClick={createTask}>追加する</Button></div>
    </section>}
    {loading ? <p className="queue-empty">読み込み中...</p> : <DragDropContext onDragEnd={onDragEnd}>
      <div className="kanban-board">
        {COLUMNS.map((col) => <div className="kanban-column" key={col.id}>
          <div className="kanban-column-head"><h3>{col.label}</h3><span>{columns[col.id].length}件</span></div>
          <Droppable droppableId={col.id}>
            {(provided) => <div className="kanban-column-body" ref={provided.innerRef} {...provided.droppableProps}>
              {columns[col.id].map((item, index) => <Draggable draggableId={item.id} index={index} key={item.id}>
                {(dragProvided) => <div
                  className={`kanban-card ${isOverdue(item) ? "overdue" : ""}`}
                  ref={dragProvided.innerRef}
                  {...dragProvided.draggableProps}
                  {...dragProvided.dragHandleProps}
                >
                  {item.company_name && <div className="kanban-card-company"><Building2 size={13} />{item.company_name}{!item.company_linked && <em>（未登録）</em>}</div>}
                  <p>{item.description}</p>
                  <div className="kanban-card-meta">
                    {item.due_date && <span><Calendar size={12} />{item.due_date}</span>}
                    {item.assignee && <span><User size={12} />{item.assignee}</span>}
                    <PriorityTag priority={item.priority} />
                  </div>
                </div>}
              </Draggable>)}
              {provided.placeholder}
              {columns[col.id].length === 0 && <p className="kanban-column-empty">タスクはありません</p>}
            </div>}
          </Droppable>
        </div>)}
      </div>
    </DragDropContext>}
    {!loading && columns.open.length === 0 && columns.done.length === 0 && columns.dismissed.length === 0 && <div className="action-complete-empty"><X size={24} /><b>タスクはまだありません。</b><p>議事録を確定すると次アクションが自動で追加されるほか、ここから直接タスクを作成できます。</p><Button className="ink-button" onClick={() => onNavigate("meetings")}>議事録を整理する</Button></div>}
  </section>;
}
