/**
 * Quiet Operations Desk: a meeting note is processed through source record → editable draft → confirmation context.
 * Wired to /api/meeting-notes (rule-based extraction) and /api/meeting-summaries/:id/approve.
 */
import { Button } from "@/components/ui/button";
import { BookOpen, Check, ChevronRight, Sparkles, WandSparkles, X } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

type ScreenTarget = "overview" | "inbounds" | "accounts" | "meetings" | "briefing" | "knowledge" | "actions" | "renewals";

type Company = { id: string; name: string; category: string };

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
};

function DraftTag({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "moss" | "ochre" | "navy" }) {
  return <span className={`enterprise-status ${tone}`}>{children}</span>;
}

export default function MeetingWorkbench({ onNavigate }: { onNavigate: (screen: ScreenTarget) => void }) {
  const [companies, setCompanies] = useState<Company[]>([]);
  const [companyId, setCompanyId] = useState("");
  const [content, setContent] = useState("");
  const [draft, setDraft] = useState<Draft | null>(null);
  const [working, setWorking] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/companies", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setCompanies(data.companies ?? []))
      .catch(() => toast.error("取引先一覧の取得に失敗しました"));
  }, []);

  const generateDraft = async () => {
    if (!companyId) return toast.error("取引先を選択してください");
    if (!content.trim()) return toast.error("議事録の原文を貼り付けてください");
    setWorking(true);
    try {
      const res = await fetch("/api/meeting-notes", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        credentials: "include",
        body: JSON.stringify({ company_id: companyId, content }),
      });
      if (!res.ok) throw new Error();
      const data = await res.json();
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
        }),
      });
      if (!res.ok) throw new Error();
      setSaved(true);
      toast.success("確認済みの情報を商談と次アクションへ反映しました");
      onNavigate("actions");
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
      <aside className="worklist-column meeting-queue"><div className="worklist-head"><div><span className="eyebrow">NEW NOTE</span><h2>議事録を貼り付け</h2></div></div><label className="note-source-label" style={{ display: "block", padding: "12px 16px 4px", fontSize: 11, color: "#7b8580" }}>取引先<select value={companyId} onChange={(e) => setCompanyId(e.target.value)} style={{ display: "block", width: "calc(100% - 32px)", margin: "4px 16px 0", padding: "8px", border: "1px solid #dedbd2", borderRadius: 6 }}><option value="">選択してください</option>{companies.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select></label><section className="queue-policy"><BookOpen size={16} /><div><b>確認してから確定</b><p>ルールベースで抽出した内容は、確認・編集するまで商談情報に反映されません。</p></div></section></aside>
      <main className="decision-column source-column"><div className="source-head"><div><span className="eyebrow">SOURCE RECORD</span><h2>議事録原文</h2></div><span>{content.length}文字</span></div><textarea className="note-source" aria-label="議事録原文" placeholder={"議事録を貼り付けてください。\n\n課題：...\n予算：...\n決裁：...\n時期：...\n\n➡ 次にやること"} value={content} onChange={(e) => setContent(e.target.value)} /><div className="source-footer"><Button className="ink-button" onClick={generateDraft} disabled={working}><WandSparkles size={16} />{working ? "処理中..." : draft ? "下書きを更新" : "下書きをつくる"}</Button></div></main>
      <aside className={`draft-column ${draft ? "ready" : ""}`}><div className="draft-header"><div><span className="eyebrow">DRAFT · REVIEW REQUIRED</span><h2>確認用の下書き</h2></div><DraftTag tone={draft ? (saved ? "moss" : "ochre") : "neutral"}>{draft ? (saved ? "確定済み" : "確認待ち") : "入力待ち"}</DraftTag></div>{draft ? <div className="draft-body"><section><div className="draft-section-head"><span>01</span><h3>商談サマリ</h3><DraftTag tone="navy">下書き</DraftTag></div><textarea value={draft.summary} onChange={(e) => setDraft({ ...draft, summary: e.target.value })} style={{ width: "100%", minHeight: 48, border: "1px solid #dedbd2", borderRadius: 6, padding: 8, fontSize: 12 }} /></section><section><div className="draft-section-head"><span>02</span><h3>ヒアリング項目</h3></div><div className="hear-grid">
        <div><span>課題</span><input value={draft.issue} onChange={(e) => setDraft({ ...draft, issue: e.target.value })} style={{ width: "100%", border: 0, background: "transparent", fontSize: 12 }} /></div>
        <div><span>予算</span><input value={draft.budget} onChange={(e) => setDraft({ ...draft, budget: e.target.value })} style={{ width: "100%", border: 0, background: "transparent", fontSize: 12 }} /></div>
        <div><span>決裁</span><input value={draft.decision_maker} onChange={(e) => setDraft({ ...draft, decision_maker: e.target.value })} style={{ width: "100%", border: 0, background: "transparent", fontSize: 12 }} /></div>
        <div><span>時期</span><input value={draft.timeline} onChange={(e) => setDraft({ ...draft, timeline: e.target.value })} style={{ width: "100%", border: 0, background: "transparent", fontSize: 12 }} /></div>
      </div></section><section><div className="draft-section-head"><span>03</span><h3>次アクション候補</h3><DraftTag tone="ochre">要確認</DraftTag></div>{draft.actions.length === 0 && <p style={{ fontSize: 11, color: "#8a908a" }}>「➡」で始まる行が見つかりませんでした。手動で追加してください。</p>}{draft.actions.map((a, i) => <div className="draft-action" key={i}><b>{a.description}</b><small style={{ display: "flex", gap: 6, marginTop: 4 }}><input placeholder="担当" value={a.assignee} onChange={(e) => updateAction(i, { assignee: e.target.value })} style={{ width: 70, border: "1px solid #dedbd2", borderRadius: 4, fontSize: 10, padding: 2 }} /><input type="date" value={a.due_date} onChange={(e) => updateAction(i, { due_date: e.target.value })} style={{ border: "1px solid #dedbd2", borderRadius: 4, fontSize: 10, padding: 2 }} /><select value={a.priority} onChange={(e) => updateAction(i, { priority: e.target.value as Draft["actions"][number]["priority"] })} style={{ border: "1px solid #dedbd2", borderRadius: 4, fontSize: 10 }}><option value="高">高</option><option value="中">中</option><option value="低">低</option></select><button onClick={() => removeAction(i)} aria-label="削除"><X size={12} /></button></small></div>)}</section>{draft.unresolved && <section className="unknown-section"><div className="draft-section-head"><span>04</span><h3>未確認の重要事項</h3></div><p>{draft.unresolved}</p></section>}<div className="draft-confirm"><Button className="ink-button" onClick={approve} disabled={working || saved}><Check size={16} />{saved ? "確定済み" : "確認して商談へ反映"}</Button></div></div> : <div className="draft-empty"><Sparkles size={24} /><b>原文をもとに、<br />確認できる下書きを作ります。</b><p>サマリ、ヒアリング項目、次アクション候補を提示します。</p></div>}</aside>
    </div>
  </section>;
}
