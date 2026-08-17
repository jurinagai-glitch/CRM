/**
 * Quiet Operations Desk: inbound triage turns a raw inquiry into a traceable account conversion without re-entry.
 * Wired to /api/inbound-inquiries.
 */
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Building2, CheckCircle2, ChevronRight, Copy, EyeOff, Inbox, Plus, RotateCcw, ShieldCheck, UserRound } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { apiRequest } from "@/lib/api";

type ScreenTarget = "overview" | "inbounds" | "accounts" | "meetings" | "briefing" | "knowledge" | "actions" | "renewals";

type Inquiry = {
  id: string;
  source: string | null;
  company_name: string;
  contact_name: string | null;
  content: string | null;
  status: "未対応" | "対応中" | "取引先化済み" | "対象外";
  exclusion_reason: string | null;
  created_at: string;
};

type Candidate = { id: string; name: string; category: string };

function Tag({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "moss" | "ochre" | "navy" }) { return <span className={`enterprise-status ${tone}`}>{children}</span>; }

export default function InboundTriage({ onNavigate }: { onNavigate: (screen: ScreenTarget) => void }) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [dismissedInquiries, setDismissedInquiries] = useState<Inquiry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newInquiry, setNewInquiry] = useState({ company_name: "", contact_name: "", source: "", content: "" });

  const load = () => {
    Promise.all([
      fetch("/api/inbound-inquiries", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/inbound-inquiries?status=対象外", { credentials: "include" }).then((r) => r.json()),
    ]).then(([openData, excludedData]) => {
      setInquiries(openData.inquiries ?? []);
      setDismissedInquiries(excludedData.inquiries ?? []);
      const jumpId = sessionStorage.getItem("relay:openInquiryId");
      if (jumpId) {
        sessionStorage.removeItem("relay:openInquiryId");
        setSelectedId(jumpId);
      } else if (!selectedId && openData.inquiries?.[0]) {
        setSelectedId(openData.inquiries[0].id);
      }
    }).catch(() => toast.error("問い合わせ一覧の取得に失敗しました"));
  };

  // eslint-disable-next-line react-hooks/exhaustive-deps
  useEffect(load, []);

  const inquiry = inquiries.find((i) => i.id === selectedId) ?? null;

  useEffect(() => {
    if (!inquiry) { setCandidates([]); return; }
    fetch(`/api/inbound-inquiries/${inquiry.id}/duplicate-check`, { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setCandidates(data.candidates ?? []))
      .catch(() => setCandidates([]));
  }, [inquiry?.id]);

  const createInquiry = async () => {
    if (!newInquiry.company_name.trim()) return toast.error("会社名を入力してください");
    const result = await apiRequest("/api/inbound-inquiries", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(newInquiry),
    });
    if (!result) return;
    setNewInquiry({ company_name: "", contact_name: "", source: "", content: "" });
    setShowNewForm(false);
    load();
    toast.success("問い合わせを登録しました");
  };

  const dismiss = async () => {
    if (!inquiry) return;
    const result = await apiRequest(`/api/inbound-inquiries/${inquiry.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "対象外", exclusion_reason: "対象外（要件が合わない）" }),
    });
    if (!result) return;
    setSelectedId(null);
    load();
    toast.info("対象外にしました。");
  };

  const restore = async (id: string) => {
    const result = await apiRequest(`/api/inbound-inquiries/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ status: "未対応" }),
    });
    if (!result) return;
    load();
    toast.success("問い合わせ一覧に戻しました。");
  };

  const convert = async (existingCompanyId?: string) => {
    if (!inquiry) return;
    const result = await apiRequest(`/api/inbound-inquiries/${inquiry.id}/convert`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ existing_company_id: existingCompanyId }),
    });
    if (!result) return;
    toast.success("取引先を作成しました。問い合わせ原文も引き継がれています。");
    setSelectedId(null);
    load();
    onNavigate("accounts");
  };

  return <section className="screen-page enterprise-workspace inbound-workspace">
    <header className="enterprise-page-head"><div><p className="eyebrow">INBOUND · TRIAGE DESK</p><h1>最初の反応を、<br />顧客の文脈へつなぐ。</h1><p>問い合わせ原文を残し、重複確認を経て、取引先へ一度で引き継ぎます。</p></div><div className="enterprise-head-actions"><Button className="ink-button" onClick={() => setShowNewForm((v) => !v)}><Plus size={16} />問い合わせを登録</Button></div></header>
    <div className="workflow-ribbon"><span className="active">01 問い合わせを確認</span><ChevronRight size={14} /><span>02 重複候補を確認</span><ChevronRight size={14} /><span>03 取引先へ変換</span><ChevronRight size={14} /><span>04 初回アクション</span></div>
    {showNewForm && <section className="conversion-sheet" style={{ marginBottom: 16 }}><div className="conversion-grid"><label>会社名<input value={newInquiry.company_name} onChange={(e) => setNewInquiry({ ...newInquiry, company_name: e.target.value })} /></label><label>担当者<input value={newInquiry.contact_name} onChange={(e) => setNewInquiry({ ...newInquiry, contact_name: e.target.value })} /></label><label>経路<input value={newInquiry.source} onChange={(e) => setNewInquiry({ ...newInquiry, source: e.target.value })} placeholder="Webフォーム/紹介/広告など" /></label><label>内容<input value={newInquiry.content} onChange={(e) => setNewInquiry({ ...newInquiry, content: e.target.value })} /></label></div><div className="conversion-footer"><span /><Button className="ink-button" onClick={createInquiry}>登録する</Button></div></section>}
    <div className="enterprise-shell inbound-shell">
      <aside className="worklist-column"><div className="worklist-head"><div><span className="eyebrow">INBOUND INBOX</span><h2>問い合わせ <b>{inquiries.length}</b></h2></div><Inbox size={17} /></div><div className="inbound-rows">{inquiries.map((item, index) => <button className={`inbound-row ${selectedId === item.id ? "selected" : ""}`} key={item.id} onClick={() => setSelectedId(item.id)}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{item.company_name}</b><small>{item.content?.slice(0, 30) ?? ""}</small><em>{item.source ?? "経路不明"}</em></div><Tag tone={item.status === "未対応" ? "ochre" : "navy"}>{item.status}</Tag><ChevronRight size={15} /></button>)}{inquiries.length === 0 && <p className="queue-empty">問い合わせはありません。</p>}</div>{dismissedInquiries.length > 0 && <div className="action-dismissed"><span className="eyebrow">対象外にした問い合わせ</span>{dismissedInquiries.map((item) => <article className="action-dismissed-row" key={item.id}><div className="action-summary"><b>{item.company_name}</b><p>{item.exclusion_reason}</p></div><button className="row-dismiss" onClick={() => restore(item.id)} aria-label={`${item.company_name}を一覧に戻す`}><RotateCcw size={13} /></button></article>)}</div>}</aside>
      {inquiry ? <>
      <main className="decision-column inbound-decision"><div className="source-meta"><span>{inquiry.source ?? "経路不明"}</span><ChevronRight size={14} /><b>{new Date(inquiry.created_at).toLocaleString("ja-JP")} に受信</b></div><div className="triage-heading"><div><span className="eyebrow">INQUIRY RECORD</span><h2>{inquiry.company_name}</h2><p>{inquiry.contact_name ?? "担当者不明"}</p></div><Tag tone="ochre">{inquiry.status}</Tag></div><section className="inquiry-record"><h3>問い合わせ内容</h3><p>{inquiry.content || "本文の記録はありません。"}</p></section><section className="conversion-sheet"><div className="conversion-head"><div><span className="eyebrow">CONVERSION</span><h3>取引先に引き継ぐ</h3></div></div><div className="conversion-footer"><span><Copy size={14} />問い合わせ原文を引き継ぎます。</span><button className="quiet-action" onClick={dismiss}><EyeOff size={14} />対象外にする</button><Button className="ink-button" onClick={() => convert()}><Building2 size={16} />新規取引先として作成</Button></div></section></main>
      <aside className="context-column"><section className="context-card match-card"><div className="context-heading"><div><span className="eyebrow">MATCH CHECK</span><h3>重複を確認</h3></div><ShieldCheck size={16} /></div><p className="context-intro">自動統合はしません。近い候補があれば、既存取引先として引き継ぐか選べます。</p>{candidates.length === 0 ? <div className="match-line"><span>類似候補</span><b>0件</b><Tag tone="moss">新規</Tag></div> : candidates.map((c) => <div className="match-line" key={c.id}><span>{c.category}</span><b>{c.name}</b><button className="context-link" onClick={() => convert(c.id)} style={{ padding: 0 }}>この取引先に引き継ぐ <ArrowUpRight size={13} /></button></div>)}</section><section className="context-card assignment-card"><div className="context-heading"><div><span className="eyebrow">OWNERSHIP</span><h3>初回対応</h3></div><UserRound size={16} /></div><p>担当者の割り当ては今後の機能です。</p></section></aside>
      </> : <main className="decision-column inbound-decision"><div className="action-complete-empty"><CheckCircle2 size={24} /><b>確認する問い合わせはありません。</b><p>対象外にした問い合わせは履歴から確認できます。</p></div></main>}
    </div>
  </section>;
}
