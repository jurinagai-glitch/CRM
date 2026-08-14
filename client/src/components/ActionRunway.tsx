/**
 * Quiet Operations Desk: the final MVP surface is a compact execution runway with clear time, owner, and completion evidence.
 * Wired to /api/next-actions.
 */
import { Button } from "@/components/ui/button";
import { Check, CheckCircle2, ChevronRight, CircleAlert, Clock3, EyeOff, ListChecks, RotateCcw } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ScreenTarget = "overview" | "inbounds" | "accounts" | "meetings" | "briefing" | "knowledge" | "actions" | "renewals";

type ActionItem = {
  id: string;
  company_name: string;
  description: string;
  assignee: string | null;
  due_date: string | null;
  priority: "高" | "中" | "低";
  status: "open" | "done" | "dismissed";
  dismiss_reason: string | null;
  dismissed_by: string | null;
  dismiss_snooze_until: string | null;
};

const CURRENT_ACTOR = "佐々木 瑞希";
const DEFAULT_SNOOZE_DAYS = 7;
const DEFAULT_DISMISS_REASON = "現在は対応不要のため見送り";

function Tag({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "moss" | "ochre" | "navy" | "danger" }) { return <span className={`enterprise-status ${tone}`}>{children}</span>; }

export default function ActionRunway({ onNavigate }: { onNavigate: (screen: ScreenTarget) => void }) {
  const [openActions, setOpenActions] = useState<ActionItem[]>([]);
  const [dismissedActions, setDismissedActions] = useState<ActionItem[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      fetch("/api/next-actions?status=open", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/next-actions?status=dismissed", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([openData, dismissedData]) => {
        setOpenActions(openData.actions ?? []);
        setDismissedActions(dismissedData.actions ?? []);
        setLoading(false);
      })
      .catch(() => toast.error("次アクションの取得に失敗しました"));
  };

  useEffect(load, []);

  const patch = async (id: string, body: Record<string, unknown>) => {
    await fetch(`/api/next-actions/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(body),
    });
    load();
  };

  const complete = (id: string) => { patch(id, { status: "done" }); toast.success("アクションを完了にしました。"); };
  const dismiss = (id: string) => {
    const snoozeUntil = new Date(Date.now() + DEFAULT_SNOOZE_DAYS * 24 * 60 * 60 * 1000).toISOString().slice(0, 10);
    patch(id, { status: "dismissed", dismiss_reason: DEFAULT_DISMISS_REASON, dismissed_by: CURRENT_ACTOR, dismiss_snooze_until: snoozeUntil });
    toast.info(`見送りにしました。${snoozeUntil}に再表示されます。`);
  };
  const updateReason = (id: string, reason: string) => { patch(id, { dismiss_reason: reason }); };
  const restore = (id: string) => { patch(id, { status: "open" }); toast.success("アクション一覧に戻しました。"); };

  return <section className="screen-page enterprise-workspace action-workspace">
    <header className="enterprise-page-head"><div><p className="eyebrow">NEXT ACTIONS · EXECUTION RUNWAY</p><h1>決めたことを、<br />期限の中で終える。</h1><p>商談を前へ進めるアクションだけを、期限・担当と一緒に実行します。</p></div></header>
    <div className="workflow-ribbon"><span>01 問い合わせ</span><ChevronRight size={14} /><span>02 商談</span><ChevronRight size={14} /><span>03 議事録を確定</span><ChevronRight size={14} /><span className="active">04 次アクションを実行</span></div>
    <div className="enterprise-shell action-shell">
      <aside className="worklist-column action-filter-column"><div className="worklist-head"><div><span className="eyebrow">EXECUTION VIEW</span><h2>実行の優先順位</h2></div><ListChecks size={17} /></div></aside>
      <main className="decision-column action-decision"><div className="action-board-head"><div><span className="eyebrow">TODAY'S EXECUTION</span><h2>次アクション</h2></div><span><Clock3 size={14} />{openActions.length}件 未完了</span></div><div className="action-table"><div className="action-table-head"><span>完了</span><span>取引先・アクション</span><span>担当</span><span>期限</span><span /></div>{loading && <p className="queue-empty">読み込み中...</p>}{openActions.map((item, index) => <article className="action-table-row" key={item.id}><button className="complete-box" onClick={() => complete(item.id)} aria-label={`${item.description}を完了`}><Check size={13} /></button><div className="action-summary"><span className="action-number">{String(index + 1).padStart(2, "0")}</span><div><b>{item.company_name}</b><p>{item.description}</p><Tag tone={item.priority === "高" ? "danger" : item.priority === "中" ? "ochre" : "neutral"}>{item.priority}</Tag></div></div><span className="action-owner">{item.assignee || "未割当"}</span><b>{item.due_date ?? "期限未設定"}</b><button className="row-dismiss" onClick={() => dismiss(item.id)} aria-label={`${item.description}を見送る`}><EyeOff size={13} /></button></article>)}</div>{!loading && openActions.length === 0 && <div className="action-complete-empty"><CheckCircle2 size={24} /><b>未完了の次アクションはありません。</b><p>議事録を確定すると、ここに次アクションが追加されます。</p><Button className="ink-button" onClick={() => onNavigate("meetings")}>議事録を整理する</Button></div>}{dismissedActions.length > 0 && <div className="action-dismissed"><span className="eyebrow">見送ったアクション</span>{dismissedActions.map((item) => <article className="action-dismissed-row" key={item.id}><div className="action-summary"><b>{item.company_name}</b><p>{item.description}</p></div><input className="dismiss-reason" value={item.dismiss_reason ?? ""} onChange={(e) => updateReason(item.id, e.target.value)} aria-label={`${item.description}の見送り理由`} /><span className="dismiss-meta">{item.dismissed_by}が見送り · {item.dismiss_snooze_until}に再表示</span><button className="row-dismiss" onClick={() => restore(item.id)} aria-label={`${item.description}を一覧に戻す`}><RotateCcw size={13} /></button></article>)}</div>}</main>
      <aside className="context-column"><section className="context-card execution-card"><div className="context-heading"><div><span className="eyebrow">EXECUTION CHECK</span><h3>実行前の確認</h3></div><CircleAlert size={16} /></div><div className="execution-check"><span><Check />期限が設定されている</span><span><Check />担当者が決まっている</span><span><Check />商談または議事録に根拠がある</span></div><p>根拠のないタスクを増やさず、商談の次の判断へ結びつく作業だけを残します。</p></section></aside>
    </div>
  </section>;
}
