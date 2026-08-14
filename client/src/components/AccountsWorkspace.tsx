/**
 * Quiet Operations Desk: account worklist, a current decision surface, and an evidence context stay visible together.
 * Wired to real company/meeting/deal/contact data via /api/companies.
 */
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Building2, CheckCircle2, ChevronRight, CircleAlert, CopyPlus, ExternalLink, FileText, MoreHorizontal, Plus, Search, Sparkles, Trash2, UserRound } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";

type ScreenTarget = "overview" | "inbounds" | "accounts" | "meetings" | "briefing" | "knowledge" | "actions" | "renewals";

type Company = {
  id: string;
  name: string;
  category: string;
  name_variants: string[];
  meeting_count: number;
};

type MeetingNote = {
  id: string;
  meeting_date: string | null;
  format: string | null;
  contact: string | null;
  content: string | null;
  proposal: string | null;
  summary_id: string | null;
  summary: string | null;
  issue: string | null;
  budget: string | null;
  decision_maker: string | null;
  timeline: string | null;
  summary_status: "draft" | "approved" | null;
};

type Deal = { id: string; name: string; stage: string; amount: number | null; status: string };
type Contact = { id: string; name: string; title: string | null };
type Proposal = { id: string; type: string; title: string; url: string; version: number };

function Status({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "navy" | "moss" | "ochre" | "danger" }) {
  return <span className={`enterprise-status ${tone}`}>{children}</span>;
}

function categoryTone(category: string): "neutral" | "navy" | "moss" | "ochre" | "danger" {
  if (category === "既存代理店（店舗）") return "navy";
  if (category === "既存代理店（マンション）") return "moss";
  if (category === "直接販売") return "ochre";
  return "neutral";
}

const DEAL_STAGES = ["初回接触", "提案", "交渉", "クロージング", "成約", "失注"];
const PROPOSAL_TYPES = ["提案書", "見積書", "契約書", "その他"];

export default function AccountsWorkspace({ onNavigate }: { onNavigate: (screen: ScreenTarget) => void }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [query, setQuery] = useState("");
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [detail, setDetail] = useState<{ company: Company; meetings: MeetingNote[]; deals: Deal[]; contacts: Contact[]; proposals: Proposal[] } | null>(null);
  const [loading, setLoading] = useState(true);
  const [newDealName, setNewDealName] = useState("");
  const [newDealStage, setNewDealStage] = useState(DEAL_STAGES[0]);
  const [newContactName, setNewContactName] = useState("");
  const [newContactTitle, setNewContactTitle] = useState("");
  const [newProposalTitle, setNewProposalTitle] = useState("");
  const [newProposalUrl, setNewProposalUrl] = useState("");
  const [newProposalType, setNewProposalType] = useState(PROPOSAL_TYPES[0]);

  useEffect(() => {
    const params = new URLSearchParams();
    if (query) params.set("q", query);
    fetch(`/api/companies?${params.toString()}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => {
        setCompanies(data.companies ?? []);
        setLoading(false);
        if (!selectedId && data.companies?.[0]) setSelectedId(data.companies[0].id);
      })
      .catch(() => toast.error("取引先一覧の取得に失敗しました"));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [query]);

  const reloadDetail = () => {
    if (!selectedId) return;
    fetch(`/api/companies/${selectedId}`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setDetail(data))
      .catch(() => toast.error("取引先の詳細取得に失敗しました"));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(reloadDetail, [selectedId]);

  const latestMeeting = useMemo(() => detail?.meetings?.[0] ?? null, [detail]);
  const latestApprovedSummary = useMemo(
    () => detail?.meetings?.find((m) => m.summary_status === "approved") ?? null,
    [detail]
  );

  const addDeal = async () => {
    if (!selectedId || !newDealName.trim()) return toast.error("商談名を入力してください");
    const result = await apiRequest(`/api/companies/${selectedId}/deals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newDealName, stage: newDealStage }),
    });
    if (!result) return;
    setNewDealName("");
    reloadDetail();
    toast.success("商談を登録しました");
  };

  const addContact = async () => {
    if (!selectedId || !newContactName.trim()) return toast.error("担当者名を入力してください");
    const result = await apiRequest(`/api/companies/${selectedId}/contacts`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newContactName, title: newContactTitle || null }),
    });
    if (!result) return;
    setNewContactName("");
    setNewContactTitle("");
    reloadDetail();
    toast.success("担当者を登録しました");
  };

  const removeContact = async (id: string) => {
    const result = await apiRequest(`/api/contacts/${id}`, { method: "DELETE" });
    if (!result) return;
    reloadDetail();
  };

  const addProposal = async () => {
    if (!selectedId || !newProposalTitle.trim()) return toast.error("資料名を入力してください");
    if (!/^https?:\/\//.test(newProposalUrl)) return toast.error("http(s)から始まる有効なURLを入力してください");
    const result = await apiRequest(`/api/companies/${selectedId}/proposals`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: newProposalTitle, url: newProposalUrl, type: newProposalType }),
    });
    if (!result) return;
    setNewProposalTitle("");
    setNewProposalUrl("");
    reloadDetail();
    toast.success("資料を登録しました");
  };

  const removeProposal = async (id: string) => {
    const result = await apiRequest(`/api/proposals/${id}`, { method: "DELETE" });
    if (!result) return;
    reloadDetail();
  };

  return <section className="screen-page enterprise-workspace account-workspace">
    <header className="enterprise-page-head"><div><p className="eyebrow">ACCOUNTS · CUSTOMER WORKSPACE</p><h1>取引先の判断を、<br />一つの文脈で進める。</h1><p>過去の商談記録を、取引先ごとの作業面に集約します。</p></div><div className="enterprise-head-actions"><Button className="ink-button" onClick={() => toast.success("取引先登録フォームを開きました")}><Plus size={16} />取引先を登録</Button></div></header>

    <div className="workflow-ribbon" aria-label="MVPの営業フロー"><span className="active">01 インバウンド</span><ChevronRight size={14} /><span className="active">02 取引先・商談</span><ChevronRight size={14} /><span>03 議事録を確定</span><ChevronRight size={14} /><span>04 次アクション</span></div>

    <div className="enterprise-shell account-shell">
      <aside className="worklist-column"><div className="worklist-head"><div><span className="eyebrow">WORKLIST</span><h2>取引先 <b>{companies.length}</b></h2></div><button onClick={() => toast.info("表示列の設定を開きました")} aria-label="取引先一覧の設定"><MoreHorizontal size={18} /></button></div><label className="worklist-search"><Search size={15} /><input aria-label="取引先を検索" placeholder="会社名で検索" value={query} onChange={(e) => setQuery(e.target.value)} /></label><div className="account-rows">{loading ? <p className="queue-empty">読み込み中...</p> : companies.map((item, index) => <button className={`account-row ${selectedId === item.id ? "selected" : ""}`} key={item.id} onClick={() => setSelectedId(item.id)}><span className="account-row-number">{String(index + 1).padStart(2, "0")}</span><span className="account-row-main"><b>{item.name}</b><small>商談 {item.meeting_count}件</small></span><span className="account-row-meta"><Status tone={categoryTone(item.category)}>{item.category}</Status></span><ChevronRight size={15} /></button>)}</div><button className="worklist-add" onClick={() => toast.success("取引先の作成を開始しました")}><CopyPlus size={15} />取引先を追加</button></aside>

      {detail ? <>
      <main className="decision-column"><div className="entity-banner"><div className="entity-mark"><Building2 size={18} /></div><div className="entity-title"><div className="entity-overline"><Status tone={categoryTone(detail.company.category)}>{detail.company.category}</Status><span>商談 {detail.company.meeting_count}件</span></div><h2>{detail.company.name}</h2>{detail.company.name_variants.length > 0 && <p>旧表記: {detail.company.name_variants.join(" / ")}</p>}</div><button className="entity-more" onClick={() => toast.info("取引先のメニューを開きました")} aria-label="取引先メニュー"><MoreHorizontal size={19} /></button></div>

        {latestMeeting ? <section className="current-decision"><div className="decision-label"><span className="eyebrow">LATEST MEETING</span><Status tone="navy">{latestMeeting.meeting_date ?? "日付不明"}</Status></div><h3>{latestMeeting.contact ? `${latestMeeting.contact}との商談` : "直近の商談記録"}</h3><p>{latestMeeting.content ? latestMeeting.content.slice(0, 140) : "本文の記録はありません。"}</p><div className="decision-actions"><Button className="ink-button" onClick={() => onNavigate("meetings")}><FileText size={16} />新しい議事録を貼り付ける</Button></div></section> : <section className="current-decision"><h3>まだ商談記録がありません</h3><p>議事録を貼り付けると、ここに最新の商談が表示されます。</p></section>}

        <section className="account-facts"><div><span>区分</span><b>{detail.company.category}</b><small>&nbsp;</small></div><div><span>商談件数</span><b>{detail.company.meeting_count}件</b><small>&nbsp;</small></div><div><span>最終商談</span><b>{latestMeeting?.meeting_date ?? "―"}</b><small>{latestMeeting?.format ?? ""}</small></div><div><span>登録済み旧表記</span><b>{detail.company.name_variants.length}件</b><small>&nbsp;</small></div></section>

        <section className="ledger-section"><div className="ledger-heading"><div><span className="eyebrow">DEALS</span><h3>商談</h3></div><span>{detail.deals.length}件</span></div><div className="activity-ledger">{detail.deals.length === 0 && <p className="queue-empty">商談はまだ登録されていません。</p>}{detail.deals.map((d) => <article key={d.id}><div><b>{d.name}</b><p>{d.amount ? `¥${Number(d.amount).toLocaleString()}` : "金額未設定"}</p></div><Status tone={d.stage === "成約" ? "moss" : d.stage === "失注" ? "danger" : "navy"}>{d.stage}</Status></article>)}<div style={{ display: "flex", gap: 6, padding: "10px 0" }}><input placeholder="商談名" value={newDealName} onChange={(e) => setNewDealName(e.target.value)} style={{ flex: 1, border: "1px solid #dedbd2", borderRadius: 6, padding: 6, fontSize: 12 }} /><select value={newDealStage} onChange={(e) => setNewDealStage(e.target.value)} style={{ border: "1px solid #dedbd2", borderRadius: 6, fontSize: 12 }}>{DEAL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}</select><button className="context-link" onClick={addDeal}>追加</button></div></div></section>

        <section className="ledger-section"><div className="ledger-heading"><div><span className="eyebrow">PROPOSALS</span><h3>提案書・資料（リンク）</h3></div><span>{detail.proposals.length}件</span></div><div className="activity-ledger">{detail.proposals.length === 0 && <p className="queue-empty">資料はまだ登録されていません。</p>}{detail.proposals.map((p) => <article key={p.id}><div><b>{p.title}</b><p><a href={p.url} target="_blank" rel="noopener noreferrer" style={{ display: "inline-flex", alignItems: "center", gap: 4, color: "#16324f" }}>リンクを開く <ExternalLink size={12} /></a></p></div><Status tone="neutral">{p.type}</Status><button onClick={() => removeProposal(p.id)} aria-label="削除" style={{ marginLeft: 8 }}><Trash2 size={13} /></button></article>)}<div style={{ display: "flex", gap: 6, padding: "10px 0" }}><input placeholder="資料名" value={newProposalTitle} onChange={(e) => setNewProposalTitle(e.target.value)} style={{ flex: 1, border: "1px solid #dedbd2", borderRadius: 6, padding: 6, fontSize: 12 }} /><input placeholder="URL（Googleドライブ等）" value={newProposalUrl} onChange={(e) => setNewProposalUrl(e.target.value)} style={{ flex: 2, border: "1px solid #dedbd2", borderRadius: 6, padding: 6, fontSize: 12 }} /><select value={newProposalType} onChange={(e) => setNewProposalType(e.target.value)} style={{ border: "1px solid #dedbd2", borderRadius: 6, fontSize: 12 }}>{PROPOSAL_TYPES.map((t) => <option key={t} value={t}>{t}</option>)}</select><button className="context-link" onClick={addProposal}>追加</button></div></div></section>

        <section className="ledger-section"><div className="ledger-heading"><div><span className="eyebrow">MEETING HISTORY</span><h3>過去の商談履歴</h3></div><span>{detail.meetings.length}件</span></div><div className="activity-ledger">{detail.meetings.length === 0 && <p className="queue-empty">商談記録がありません。</p>}{detail.meetings.slice(0, 10).map((m, i) => <article key={m.id}><span className="activity-index">{String(i + 1).padStart(2, "0")}</span><div><b>{m.contact ? `${m.contact}` : "商談"}{m.format ? `（${m.format}）` : ""}</b><p>{m.content ? m.content.slice(0, 160) : "内容の記録はありません。"}</p><small>{m.meeting_date ?? "日付不明"}</small></div><Status tone={m.summary_status === "approved" ? "moss" : "neutral"}>{m.summary_status === "approved" ? "確定済み" : "商談"}</Status></article>)}</div></section>
      </main>

      <aside className="context-column">
        <section className="context-card qualification-card"><div className="context-heading"><div><span className="eyebrow">DECISION EVIDENCE</span><h3>確認状況</h3></div><CircleAlert size={16} /></div>{latestApprovedSummary ? <div className="qualification-grid"><div><span>課題</span><b>{latestApprovedSummary.issue || "未確認"}</b></div><div><span>予算</span><b>{latestApprovedSummary.budget || "未確認"}</b></div><div><span>決裁</span><b>{latestApprovedSummary.decision_maker || "未確認"}</b></div><div><span>時期</span><b>{latestApprovedSummary.timeline || "未確認"}</b></div></div> : <p className="context-intro">課題・予算・決裁・時期のヒアリング項目は、まだこの取引先では確定していません。議事録を整理すると、ここに確認済み事実として蓄積されます。</p>}<button className="context-link" onClick={() => onNavigate("meetings")}>議事録を整理する <ArrowUpRight size={15} /></button></section>

        <section className="context-card"><div className="context-heading"><div><span className="eyebrow">CONTACTS</span><h3>担当者</h3></div><UserRound size={16} /></div>{detail.contacts.length === 0 && <p className="context-intro">担当者はまだ登録されていません。</p>}{detail.contacts.map((c) => <div className="integrity-line" key={c.id}><span>{c.name}{c.title ? `（${c.title}）` : ""}</span><button onClick={() => removeContact(c.id)} aria-label="削除"><Trash2 size={13} /></button></div>)}<div style={{ display: "flex", gap: 6, marginTop: 8 }}><input placeholder="氏名" value={newContactName} onChange={(e) => setNewContactName(e.target.value)} style={{ flex: 1, border: "1px solid #dedbd2", borderRadius: 6, padding: 6, fontSize: 12 }} /><input placeholder="役職" value={newContactTitle} onChange={(e) => setNewContactTitle(e.target.value)} style={{ width: 80, border: "1px solid #dedbd2", borderRadius: 6, padding: 6, fontSize: 12 }} /><button className="context-link" onClick={addContact}>追加</button></div></section>

        <section className="context-card data-integrity-card"><div className="context-heading"><div><span className="eyebrow">DATA INTEGRITY</span><h3>顧客情報の状態</h3></div><CheckCircle2 size={16} /></div><div className="integrity-line"><span>表記ゆれ統合済み</span><b>{detail.company.name_variants.length}件</b></div><div className="integrity-line"><span>区分</span><b>{detail.company.category}</b></div></section>

        <section className="context-card meeting-context"><div className="context-heading"><div><span className="eyebrow">NEXT STEP</span><h3>打ち合わせ準備</h3></div><Sparkles size={16} /></div><p>この取引先との次回打ち合わせ準備メモを生成できます。</p><button className="context-link" onClick={() => onNavigate("briefing")}>準備メモを開く <ArrowUpRight size={15} /></button></section>
      </aside>
      </> : <main className="decision-column"><p className="queue-empty">{loading ? "読み込み中..." : "取引先を選択してください。"}</p></main>}
    </div>
  </section>;
}
