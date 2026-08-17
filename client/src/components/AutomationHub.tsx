/**
 * Workspace overview: a real work queue built from draft meeting summaries, inbound inquiries
 * awaiting conversion, and next actions due or overdue. Wired to /api/meeting-summaries,
 * /api/inbound-inquiries, /api/next-actions, /api/companies.
 */
import { ArrowUpRight, ChevronRight, Clock3, Inbox, RefreshCw, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ScreenTarget = "overview" | "inbounds" | "accounts" | "meetings" | "briefing" | "knowledge" | "actions" | "renewals";

type QueueItem = {
  id: string;
  type: "議事録" | "問い合わせ" | "期限";
  company: string;
  title: string;
  detail: string;
  target: ScreenTarget;
  onOpen: () => void;
};

type ActiveCompany = { id: string; name: string; category: string; meeting_count: number; last_meeting_date: string | null };

function QueueStatus({ children, tone }: { children: string; tone: "blue" | "amber" | "red" }) {
  return <span className={`automation-status ${tone}`}>{children}</span>;
}

export default function AutomationHub({ onNavigate }: { onNavigate: (screen: ScreenTarget) => void }) {
  const [draftSummaries, setDraftSummaries] = useState<{ id: string; company_name: string; issue: string | null }[]>([]);
  const [pendingInquiries, setPendingInquiries] = useState<{ id: string; company_name: string; status: string }[]>([]);
  const [dueActions, setDueActions] = useState<{ id: string; company_name: string; description: string; due_date: string | null }[]>([]);
  const [activeCompanies, setActiveCompanies] = useState<ActiveCompany[]>([]);
  const [loading, setLoading] = useState(true);

  const load = () => {
    Promise.all([
      fetch("/api/meeting-summaries?status=draft", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/inbound-inquiries", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/next-actions?status=open", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/companies?sort=recent&limit=5", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([summaries, inquiries, actions, companies]) => {
        setDraftSummaries(summaries.summaries ?? []);
        setPendingInquiries((inquiries.inquiries ?? []).filter((i: { status: string }) => i.status !== "取引先化済み"));
        const today = new Date().toISOString().slice(0, 10);
        setDueActions((actions.actions ?? []).filter((a: { due_date: string | null }) => a.due_date && a.due_date <= today));
        setActiveCompanies(companies.companies ?? []);
        setLoading(false);
      })
      .catch(() => toast.error("状況の取得に失敗しました"));
  };

  useEffect(load, []);

  const openSummary = (id: string) => { sessionStorage.setItem("relay:openSummaryId", id); onNavigate("meetings"); };
  const openInquiry = (id: string) => { sessionStorage.setItem("relay:openInquiryId", id); onNavigate("inbounds"); };
  const jumpToCompany = (id: string) => { sessionStorage.setItem("relay:jumpToCompanyId", id); onNavigate("accounts"); };

  const queue: QueueItem[] = [
    ...draftSummaries.map((s): QueueItem => ({
      id: `summary-${s.id}`, type: "議事録", company: s.company_name,
      title: "議事録の確認待ちです", detail: s.issue ? `課題: ${s.issue}` : "抽出結果を確認し、商談へ反映してください",
      target: "meetings", onOpen: () => openSummary(s.id),
    })),
    ...pendingInquiries.map((i): QueueItem => ({
      id: `inquiry-${i.id}`, type: "問い合わせ", company: i.company_name,
      title: "取引先への変換待ちです", detail: `ステータス: ${i.status}`,
      target: "inbounds", onOpen: () => openInquiry(i.id),
    })),
    ...dueActions.map((a): QueueItem => ({
      id: `action-${a.id}`, type: "期限", company: a.company_name,
      title: a.description, detail: a.due_date ? `期限: ${a.due_date}` : "期限が設定されています",
      target: "actions", onOpen: () => onNavigate("actions"),
    })),
  ];

  const countFor = (type: QueueItem["type"]) => queue.filter((item) => item.type === type).length;
  const toneFor = (type: QueueItem["type"]): "blue" | "amber" | "red" => (type === "議事録" ? "blue" : type === "問い合わせ" ? "amber" : "red");

  return <section className="automation-hub">
    <header className="automation-page-head">
      <div>
        <p className="automation-kicker">WORKSPACE OVERVIEW</p>
        <h1>今、対応が必要な項目。</h1>
        <p>確認待ちの議事録・変換待ちの問い合わせ・期限が来た次アクションを、この画面にまとめています。各項目をクリックすると、その場で対応できます。</p>
      </div>
      <button className="automation-refresh" onClick={() => { load(); toast.success("状況を更新しました"); }}><RefreshCw size={15} />更新</button>
    </header>

    <div className="automation-summary" aria-label="対応が必要な項目の内訳">
      <button onClick={() => onNavigate("meetings")}><span className="summary-icon blue"><Sparkles size={16} /></span><div><b>{countFor("議事録")}</b><span>議事録の確認待ち</span></div><ChevronRight size={16} /></button>
      <button onClick={() => onNavigate("inbounds")}><span className="summary-icon amber"><Inbox size={16} /></span><div><b>{countFor("問い合わせ")}</b><span>取引先化の変換待ち</span></div><ChevronRight size={16} /></button>
      <button onClick={() => onNavigate("actions")}><span className="summary-icon red"><Clock3 size={16} /></span><div><b>{countFor("期限")}</b><span>期限が来た次アクション</span></div><ChevronRight size={16} /></button>
    </div>

    <div className="automation-layout">
      <main className="automation-queue">
        <div className="automation-section-head"><div><p className="automation-kicker">TO DO</p><h2>対応が必要な項目</h2></div><span>{queue.length}件</span></div>
        <div className="queue-list">
          {loading && <p className="queue-empty">読み込み中...</p>}
          {!loading && queue.map((item, index) => <article className="automation-row" key={item.id}>
            <span className="queue-index">{String(index + 1).padStart(2, "0")}</span>
            <QueueStatus tone={toneFor(item.type)}>{item.type}</QueueStatus>
            <div className="queue-copy"><b>{item.company}</b><h3>{item.title}</h3><p>{item.detail}</p></div>
            <div className="queue-time"><button onClick={item.onOpen}>対応する<ArrowUpRight size={14} /></button></div>
          </article>)}
          {!loading && queue.length === 0 && <p className="queue-empty">今、対応が必要な項目はありません。</p>}
        </div>
      </main>
      <aside className="automation-context">
        <section className="automation-card rule-card">
          <div className="automation-card-head"><span className="summary-icon green"><Sparkles size={15} /></span><div><p className="automation-kicker">HOW THIS WORKS</p><h2>この画面の見方</h2></div></div>
          <ol>
            <li><i>1</i><span>議事録を貼り付けると、ルールベースで下書きが自動生成されます</span></li>
            <li><i>2</i><span>その下書き・問い合わせ・期限が来た次アクションが、ここに一覧されます</span></li>
            <li><i>3</i><span>「対応する」から、その場で確認・処理を行います</span></li>
          </ol>
          <p className="automation-note">ここに出ている項目は、いずれも人の確認・承認を経るまでは確定データになりません。</p>
        </section>
      </aside>
    </div>

    <section className="automation-customers">
      <div className="automation-section-head"><div><p className="automation-kicker">RECENT ACTIVITY</p><h2>直近で商談があった取引先</h2></div><button onClick={() => onNavigate("accounts")}>顧客を開く <ArrowUpRight size={14} /></button></div>
      <div className="customer-pulse-grid">
        {activeCompanies.map((c) => <button key={c.id} onClick={() => jumpToCompany(c.id)}>
          <span className={`pulse-dot ${c.last_meeting_date ? "active" : "stable"}`} />
          <div><b>{c.name}</b><p>{c.last_meeting_date ? `最終商談: ${c.last_meeting_date}` : "商談記録はまだありません"}</p></div>
          <QueueStatus tone="blue">{c.category}</QueueStatus>
        </button>)}
        {!loading && activeCompanies.length === 0 && <p className="queue-empty">取引先がまだ登録されていません。</p>}
      </div>
    </section>
  </section>;
}
