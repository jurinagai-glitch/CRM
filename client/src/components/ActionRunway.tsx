/**
 * Quiet Operations Desk: the final MVP surface is a compact execution runway with clear time, owner, and completion evidence.
 */
import { Button } from "@/components/ui/button";
import { ArrowUpRight, CalendarDays, Check, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, Clock3, EyeOff, ListChecks, Plus, Sparkles, UsersRound } from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type ScreenTarget = "overview" | "inbounds" | "accounts" | "meetings" | "briefing" | "knowledge" | "actions" | "renewals";
const initialActions = [
  { id: "a1", company: "ネクサス製作所", action: "デモ環境の利用条件を送付", due: "今日 15:00", owner: "自分", priority: "高", source: "議事録 #24" },
  { id: "a2", company: "エバーグリーン物流", action: "要件整理シートを確認", due: "明日", owner: "自分", priority: "高", source: "商談 #18" },
  { id: "a3", company: "クラウドリンク", action: "役員会の日程を確認", due: "8/16", owner: "佐々木", priority: "中", source: "議事録 #21" },
  { id: "a4", company: "西東京リハビリテーション", action: "導入スケジュールを更新", due: "8/18", owner: "自分", priority: "中", source: "商談 #13" },
  { id: "a5", company: "アトリエ東雲", action: "現場責任者への確認メールを送る", due: "8/20", owner: "藤原", priority: "低", source: "初回ヒアリング" },
];
function Tag({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "moss" | "ochre" | "navy" | "danger" }) { return <span className={`enterprise-status ${tone}`}>{children}</span>; }

export default function ActionRunway({ onNavigate }: { onNavigate: (screen: ScreenTarget) => void }) {
  const [completed, setCompleted] = useState<string[]>([]);
  const [dismissed, setDismissed] = useState<string[]>([]);
  const openActions = useMemo(() => initialActions.filter((item) => !completed.includes(item.id) && !dismissed.includes(item.id)), [completed, dismissed]);
  const complete = (id: string) => { setCompleted((items) => [...items, id]); toast.success("アクションを完了にしました。活動履歴へ記録されます。"); };
  const dismiss = (id: string) => { setDismissed((items) => [...items, id]); toast.info("見送りにしました。今は動かさないアクションとして記録します。"); };
  return <section className="screen-page enterprise-workspace action-workspace">
    <header className="enterprise-page-head"><div><p className="eyebrow">NEXT ACTIONS · EXECUTION RUNWAY</p><h1>決めたことを、<br />期限の中で終える。</h1><p>商談を前へ進めるアクションだけを、期限・担当・根拠と一緒に実行します。</p></div><div className="enterprise-head-actions"><button className="quiet-action" onClick={() => toast.info("自分が担当のアクションで絞り込みました")}>自分の担当 <ChevronDown size={14} /></button><Button className="ink-button" onClick={() => toast.info("次アクション作成フォームを開きました")}><Plus size={16} />アクションを追加</Button></div></header>
    <div className="workflow-ribbon"><span>01 問い合わせ</span><ChevronRight size={14} /><span>02 商談</span><ChevronRight size={14} /><span>03 議事録を確定</span><ChevronRight size={14} /><span className="active">04 次アクションを実行</span></div>
    <div className="enterprise-shell action-shell">
      <aside className="worklist-column action-filter-column"><div className="worklist-head"><div><span className="eyebrow">EXECUTION VIEW</span><h2>実行の優先順位</h2></div><ListChecks size={17} /></div><div className="action-filter-list"><button className="selected"><span>今日やる</span><b>1</b></button><button><span>今週</span><b>5</b></button><button><span>期限超過</span><b>0</b></button><button><span>確認待ち</span><b>2</b></button></div><section className="focus-note"><Sparkles size={16} /><div><span className="eyebrow">FOCUS</span><b>今日、止めない商談</b><p>ネクサス製作所の利用条件を送付すると、次の検討会へ進めます。</p><button onClick={() => onNavigate("accounts")}>取引先を見る <ArrowUpRight size={14} /></button></div></section></aside>
      <main className="decision-column action-decision"><div className="action-board-head"><div><span className="eyebrow">TODAY'S EXECUTION</span><h2>今日と今週の次アクション</h2></div><span><Clock3 size={14} />{openActions.length}件 未完了</span></div><div className="action-table"><div className="action-table-head"><span>完了</span><span>取引先・アクション</span><span>根拠</span><span>担当</span><span>期限</span><span /></div>{openActions.map((item, index) => <article className="action-table-row" key={item.id}><button className="complete-box" onClick={() => complete(item.id)} aria-label={`${item.action}を完了`}><Check size={13} /></button><div className="action-summary"><span className="action-number">{String(index + 1).padStart(2, "0")}</span><div><b>{item.company}</b><p>{item.action}</p><Tag tone={item.priority === "高" ? "danger" : item.priority === "中" ? "ochre" : "neutral"}>{item.priority}</Tag></div></div><button className="action-source" onClick={() => onNavigate("meetings")}>{item.source}<ArrowUpRight size={13} /></button><span className="action-owner">{item.owner}</span><b className={item.due.includes("今日") ? "due-today" : ""}>{item.due}</b><button className="row-dismiss" onClick={() => dismiss(item.id)} aria-label={`${item.action}を見送る`}><EyeOff size={13} /></button></article>)}</div>{openActions.length === 0 && <div className="action-complete-empty"><CheckCircle2 size={24} /><b>今日のアクションは完了です。</b><p>次は、今週の提案と更新予定を確認しましょう。</p><Button className="ink-button" onClick={() => onNavigate("renewals")}>契約・更新を見る</Button></div>}</main>
      <aside className="context-column"><section className="context-card execution-card"><div className="context-heading"><div><span className="eyebrow">EXECUTION CHECK</span><h3>実行前の確認</h3></div><CircleAlert size={16} /></div><div className="execution-check"><span><Check />期限が設定されている</span><span><Check />担当者が決まっている</span><span><Check />商談または議事録に根拠がある</span></div><p>根拠のないタスクを増やさず、商談の次の判断へ結びつく作業だけを残します。</p></section><section className="context-card team-card"><div className="context-heading"><div><span className="eyebrow">TEAM LOAD</span><h3>今週の担当状況</h3></div><UsersRound size={16} /></div><div className="load-row"><span>佐々木</span><div><i style={{ width: "70%" }} /></div><b>5</b></div><div className="load-row"><span>藤原</span><div><i style={{ width: "42%" }} /></div><b>3</b></div><div className="load-row"><span>高橋</span><div><i style={{ width: "28%" }} /></div><b>2</b></div><button className="context-link" onClick={() => toast.info("担当者別のアクションを開きました")}>担当ごとに見る <ArrowUpRight size={15} /></button></section><section className="context-card renew-shortcut"><div className="context-heading"><div><span className="eyebrow">RENEWAL SIGNAL</span><h3>次の更新</h3></div><CalendarDays size={16} /></div><b>ネクサス製作所 · 8/22</b><p>更新に必要な比較資料が、今日のアクションに含まれています。</p><button className="context-link" onClick={() => onNavigate("renewals")}>更新の状況を見る <ArrowUpRight size={15} /></button></section></aside>
    </div>
  </section>;
}
