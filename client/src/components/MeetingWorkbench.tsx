/**
 * Quiet Operations Desk: a meeting note is processed through source record → editable draft → confirmation context.
 * Wired to /api/meeting-notes (rule-based extraction) and /api/meeting-summaries/:id/approve.
 */
import { Button } from "@/components/ui/button";
import { BookOpen, Check, ChevronRight, Plus, Search, Sparkles, WandSparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ScreenTarget = "overview" | "inbounds" | "accounts" | "meetings" | "briefing" | "knowledge" | "actions" | "renewals";

type Company = { id: string; name: string; category: string };

const COMPANY_CATEGORIES = ["新規開拓", "既存代理店（店舗）", "既存代理店（マンション）", "直接販売"];
const DEAL_STAGES = ["初回接触", "提案", "交渉", "クロージング", "成約", "失注"];

function CompanyPicker({ selected, onSelect }: { selected: Company | null; onSelect: (c: Company) => void }) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Company[]>([]);
  const [creating, setCreating] = useState(false);
  const [newCategory, setNewCategory] = useState(COMPANY_CATEGORIES[0]);

  useEffect(() => {
    if (selected) return;
    fetch(`/api/companies?q=${encodeURIComponent(query)}&limit=8`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setResults(data.companies ?? []))
      .catch(() => toast.error("取引先の検索に失敗しました"));
  }, [query, selected]);

  const createAndSelect = async () => {
    if (!query.trim()) return;
    const res = await fetch("/api/companies", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name: query, category: newCategory }),
    });
    const data = await res.json();
    if (res.status === 409) {
      toast.error("同じ名前の取引先が既にあります。一覧から選択してください");
      return;
    }
    if (!res.ok) return toast.error(data.error || "取引先の作成に失敗しました");
    toast.success("取引先を登録しました");
    onSelect(data.company);
  };

  if (selected) {
    return <div className="company-picker-selected" style={{ padding: "8px 16px" }}>
      <span style={{ fontSize: 12, color: "var(--ink-muted)" }}>取引先</span>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 4 }}>
        <b>{selected.name}</b>
        <button className="context-link" onClick={() => onSelect(null as unknown as Company)}>変更</button>
      </div>
    </div>;
  }

  return <div className="company-picker" style={{ padding: "8px 16px" }}>
    <label className="worklist-search" style={{ marginBottom: 6 }}><Search size={15} /><input aria-label="取引先を検索" placeholder="会社名で検索" value={query} onChange={(e) => setQuery(e.target.value)} /></label>
    <div className="company-picker-results">
      {results.map((c) => <button key={c.id} className="context-link" style={{ display: "block", width: "100%", textAlign: "left", padding: "6px 4px" }} onClick={() => onSelect(c)}>{c.name}<small style={{ marginLeft: 6, color: "var(--ink-muted)" }}>{c.category}</small></button>)}
    </div>
    {query.trim() && results.length === 0 && <div style={{ marginTop: 8 }}>
      <p style={{ fontSize: 11, color: "var(--ink-muted)", marginBottom: 6 }}>該当する取引先が見つかりません。</p>
      {!creating ? <button className="context-link" onClick={() => setCreating(true)}><Plus size={13} />「{query}」を新規取引先として作成</button> : <div style={{ display: "flex", gap: 6, alignItems: "center" }}>
        <select value={newCategory} onChange={(e) => setNewCategory(e.target.value)} style={{ border: "1px solid var(--rule)", borderRadius: 6, fontSize: 12 }}>{COMPANY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select>
        <button className="context-link" onClick={createAndSelect}>作成する</button>
      </div>}
    </div>}
  </div>;
}

type Draft = {
  summaryId: string;
  meetingNoteId: string;
  summary: string;
  decisions: string[];
  issue: string;
  budget: string;
  decision_maker: string;
  timeline: string;
  unresolved: string | null;
  actions: { description: string; assignee: string; due_date: string; priority: "高" | "中" | "低" }[];
  dealStage: string;
};

function DraftTag({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "moss" | "ochre" | "navy" }) {
  return <span className={`enterprise-status ${tone}`}>{children}</span>;
}

async function fetchOpenDealStage(companyId: string): Promise<string> {
  try {
    const res = await fetch(`/api/companies/${companyId}`, { credentials: "include" });
    const data = await res.json();
    const openDeal = (data.deals ?? []).find((d: { status: string }) => d.status === "進行中");
    return openDeal?.stage ?? DEAL_STAGES[0];
  } catch {
    return DEAL_STAGES[0];
  }
}

export default function MeetingWorkbench({ onNavigate }: { onNavigate: (screen: ScreenTarget) => void }) {
  const [selectedCompany, setSelectedCompany] = useState<Company | null>(null);
  const [content, setContent] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [working, setWorking] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    const openId = sessionStorage.getItem("relay:openSummaryId");
    if (!openId) return;
    sessionStorage.removeItem("relay:openSummaryId");
    fetch(`/api/meeting-summaries/${openId}`, { credentials: "include" })
      .then((r) => r.json())
      .then(async (data) => {
        if (!data.summary) return;
        setSelectedCompany(data.company);
        setContent(data.meeting_note?.content ?? data.meeting_note?.raw_text ?? "");
        const dealStage = data.company?.id ? await fetchOpenDealStage(data.company.id) : DEAL_STAGES[0];
        setDraft({
          summaryId: data.summary.id,
          meetingNoteId: data.meeting_note.id,
          summary: data.summary.summary ?? "",
          decisions: data.summary.decisions ?? [],
          issue: data.summary.issue ?? "",
          budget: data.summary.budget ?? "",
          decision_maker: data.summary.decision_maker ?? "",
          timeline: data.summary.timeline ?? "",
          unresolved: data.summary.unresolved,
          actions: (data.suggested_actions ?? []).map((a: { description: string }) => ({
            description: a.description,
            assignee: "",
            due_date: "",
            priority: "中" as const,
          })),
          dealStage,
        });
      })
      .catch(() => toast.error("下書きの取得に失敗しました"));
  }, []);

  const generateDraft = async () => {
    if (!selectedCompany) return toast.error("取引先を選択してください");
    if (!content.trim()) return toast.error("議事録の原文を貼り付けてください");
    setWorking(true);
    try {
      const res = await fetch("/api/meeting-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ company_id: selectedCompany.id, content }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      const dealStage = await fetchOpenDealStage(selectedCompany.id);
      setDraft({
        summaryId: data.summary.id,
        meetingNoteId: data.meeting_note.id,
        summary: data.summary.summary ?? "",
        decisions: data.summary.decisions ?? [],
        issue: data.summary.issue ?? "",
        budget: data.summary.budget ?? "",
        decision_maker: data.summary.decision_maker ?? "",
        timeline: data.summary.timeline ?? "",
        unresolved: data.summary.unresolved,
        actions: (data.suggested_actions ?? []).map((a: { description: string }) => ({
          description: a.description,
          assignee: "",
          due_date: "",
          priority: "中" as const,
        })),
        dealStage,
      });
      setSaved(false);
      toast.success("確認用の下書きを作成しました。保存前に内容を確認してください。");
    } catch {
      toast.error("下書きの作成に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  const updateAction = (index: number, patch: Partial<Draft["actions"][number]>) => {
    if (!draft) return;
    const actions = draft.actions.map((a, i) => (i === index ? { ...a, ...patch } : a));
    setDraft({ ...draft, actions });
  };

  const removeAction = (index: number) => {
    if (!draft) return;
    setDraft({ ...draft, actions: draft.actions.filter((_, i) => i !== index) });
  };

  const approve = async () => {
    if (!draft) return;
    setWorking(true);
    try {
      const res = await fetch(`/api/meeting-summaries/${draft.summaryId}/approve`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({
          summary: draft.summary,
          decisions: draft.decisions,
          issue: draft.issue,
          budget: draft.budget,
          decision_maker: draft.decision_maker,
          timeline: draft.timeline,
          actions: draft.actions.filter((a) => a.description.trim()),
          deal_stage: draft.dealStage,
        }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
      setSaved(true);
      const dealNote = data.deal ? `商談ステージ「${data.deal.stage}」・` : "";
      toast.success(`${dealNote}次アクション${data.actions?.length ?? 0}件を、この取引先へ反映しました`);
    } catch {
      toast.error("保存に失敗しました");
    } finally {
      setWorking(false);
    }
  };

  return <section className="screen-page enterprise-workspace meeting-workspace">
    <header className="enterprise-page-head"><div><p className="eyebrow">MEETING NOTE · CONFIRMATION WORKBENCH</p><h1>議事録を、<br />確定できる次の行動へ。</h1><p>原文は残し、ルールベースで整理した結果は下書きとして確認してから商談に反映します。</p></div><div className="enterprise-head-actions"><span className="draft-policy">入力は保存前まで非公開</span></div></header>
    <div className="workflow-ribbon" aria-label="議事録の確認フロー"><span className="active">01 原文を記録</span><ChevronRight size={14} /><span className={draft ? "active" : ""}>02 下書きを確認</span><ChevronRight size={14} /><span className={saved ? "active" : ""}>03 商談へ確定</span><ChevronRight size={14} /><span>04 アクションを実行</span></div>
    <div className="enterprise-shell meeting-shell">
      <aside className="worklist-column meeting-queue"><div className="worklist-head"><div><span className="eyebrow">NEW NOTE</span><h2>議事録を貼り付け</h2></div></div><CompanyPicker selected={selectedCompany} onSelect={setSelectedCompany} /><section className="queue-policy"><BookOpen size={16} /><div><b>確認してから確定</b><p>ルールベースで抽出した内容は、確認・編集するまで商談情報に反映されません。</p></div></section></aside>
      <main className="decision-column source-column"><div className="source-head"><div><span className="eyebrow">SOURCE RECORD</span><h2>議事録原文</h2></div><span>{content.length}文字</span></div><textarea className="note-source" aria-label="議事録原文" placeholder={"議事録を貼り付けてください。\n\n課題：...\n予算：...\n決裁：...\n時期：...\n\n➡ 次にやること"} value={content} onChange={(e) => setContent(e.target.value)} /><div className="source-footer"><Button className="ink-button" onClick={generateDraft} disabled={working}><WandSparkles size={16} />{working ? "処理中..." : draft ? "下書きを更新" : "下書きをつくる"}</Button></div></main>
      <aside className={`draft-column ${draft ? "ready" : ""}`}><div className="draft-header"><div><span className="eyebrow">DRAFT · REVIEW REQUIRED</span><h2>確認用の下書き</h2></div><DraftTag tone={draft ? (saved ? "moss" : "ochre") : "neutral"}>{draft ? (saved ? "確定済み" : "確認待ち") : "入力待ち"}</DraftTag></div>{draft ? <div className="draft-body"><section><div className="draft-section-head"><span>01</span><h3>商談サマリ</h3><DraftTag tone="navy">下書き</DraftTag></div><textarea value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} style={{ width: "100%", minHeight: 48, border: "1px solid var(--rule)", borderRadius: 6, padding: 8, fontSize: 12 }} /></section><section><div className="draft-section-head"><span>02</span><h3>ヒアリング項目</h3></div><div className="hear-grid">
        <div><span>課題</span><input value={draft.issue} onChange={(e) => setDraft({ ...draft, issue: e.target.value })} style={{ width: "100%", border: 0, background: "transparent", fontSize: 12 }} /></div>
        <div><span>予算</span><input value={draft.budget} onChange={(e) => setDraft({ ...draft, budget: e.target.value })} style={{ width: "100%", border: 0, background: "transparent", fontSize: 12 }} /></div>
        <div><span>決裁</span><input value={draft.decision_maker} onChange={(e) => setDraft({ ...draft, decision_maker: e.target.value })} style={{ width: "100%", border: 0, background: "transparent", fontSize: 12 }} /></div>
        <div><span>時期</span><input value={draft.timeline} onChange={(e) => setDraft({ ...draft, timeline: e.target.value })} style={{ width: "100%", border: 0, background: "transparent", fontSize: 12 }} /></div>
        <div><span>商談ステージ</span><select value={draft.dealStage} onChange={(e) => setDraft({ ...draft, dealStage: e.target.value })} style={{ width: "100%", border: 0, background: "transparent", fontSize: 12 }}>{DEAL_STAGES.map((s) => <option key={s} value={s}>{s}</option>)}</select></div>
      </div></section><section><div className="draft-section-head"><span>03</span><h3>次アクション候補</h3><DraftTag tone="ochre">要確認</DraftTag></div>{draft.actions.length === 0 && <p style={{ fontSize: 11, color: "var(--ink-muted)" }}>「➡」で始まる行が見つかりませんでした。手動で追加してください。</p>}{draft.actions.map((a, i) => <div className="draft-action" key={i}><b>{a.description}</b><small style={{ display: "flex", gap: 6, marginTop: 4 }}><input placeholder="担当" value={a.assignee} onChange={(e) => updateAction(i, { assignee: e.target.value })} style={{ width: 70, border: "1px solid var(--rule)", borderRadius: 4, fontSize: 10, padding: 2 }} /><input type="date" value={a.due_date} onChange={(e) => updateAction(i, { due_date: e.target.value })} style={{ border: "1px solid var(--rule)", borderRadius: 4, fontSize: 10, padding: 2 }} /><select value={a.priority} onChange={(e) => updateAction(i, { priority: e.target.value as Draft["actions"][number]["priority"] })} style={{ border: "1px solid var(--rule)", borderRadius: 4, fontSize: 10 }}><option value="高">高</option><option value="中">中</option><option value="低">低</option></select><button onClick={() => removeAction(i)} aria-label="削除"><X size={12} /></button></small></div>)}</section>{draft.unresolved && <section className="unknown-section"><div className="draft-section-head"><span>04</span><h3>未確認の重要事項</h3></div><p>{draft.unresolved}</p></section>}<div className="draft-confirm"><Button className="ink-button" onClick={approve} disabled={working || saved}><Check size={16} />{saved ? "確定済み" : "確認して商談へ反映"}</Button></div></div> : <div className="draft-empty"><Sparkles size={24} /><b>原文をもとに、<br />確認できる下書きを作ります。</b><p>サマリ、ヒアリング項目、次アクション候補を提示します。</p></div>}</aside>
    </div>
  </section>;
}
