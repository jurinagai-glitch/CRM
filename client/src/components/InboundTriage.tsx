/**
 * Quiet Operations Desk: inbound triage turns a raw inquiry into a traceable account conversion without re-entry.
 * Wired to /api/inbound-inquiries.
 */
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Building2, CheckCircle2, ChevronRight, Copy, EyeOff, Inbox, Plus, RotateCcw, Search, ShieldCheck, UserRound } from "lucide-react";
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
  inquiry_date: string | null;
  store_name: string | null;
  business_type: string | null;
  products: string[];
  category: string | null;
  action: string | null;
  referred_partner: string | null;
  original_status: string | null;
};

type Candidate = { id: string; name: string; category: string };

const INQUIRY_PRODUCTS = ["スポット", "スポット＋", "タブレット", "マンション", "ビューン@", "その他"];
const INQUIRY_CATEGORIES = ["店舗", "共同事業者", "その他"];
const INQUIRY_ACTIONS = ["直販", "紹介"];
const INQUIRY_BUSINESS_TYPES = ["ホテル", "病院・クリニック", "カーディーラー", "美容室", "福利厚生", "管理会社", "パチンコ", "その他"];

function Tag({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "moss" | "ochre" | "navy" }) { return <span className={`enterprise-status ${tone}`}>{children}</span>; }

export default function InboundTriage({ onNavigate }: { onNavigate: (screen: ScreenTarget) => void }) {
  const [inquiries, setInquiries] = useState<Inquiry[]>([]);
  const [dismissedInquiries, setDismissedInquiries] = useState<Inquiry[]>([]);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [showNewForm, setShowNewForm] = useState(false);
  const [newInquiry, setNewInquiry] = useState({
    inquiry_date: new Date().toISOString().slice(0, 10),
    company_name: "",
    store_name: "",
    business_type: "",
    products: [] as string[],
    category: "",
    action: "",
    referred_partner: "",
    contact_name: "",
    source: "",
    content: "",
  });
  // Suggest partners the team has actually referred to before, so the free-text
  // field doesn't drift into new spellings of the same company.
  const [partnerSuggestions, setPartnerSuggestions] = useState<string[]>([]);
  // The imported archive (2,600+ rows) is searched, not browsed, so it lives
  // behind its own view rather than in the triage queue.
  const [historyOpen, setHistoryOpen] = useState(false);
  const [historyQuery, setHistoryQuery] = useState("");
  const [history, setHistory] = useState<Inquiry[]>([]);
  const [historyTotal, setHistoryTotal] = useState(0);

  useEffect(() => {
    if (!historyOpen) return;
    const timeout = setTimeout(() => {
      const params = new URLSearchParams({ historical: "true", limit: "50" });
      if (historyQuery.trim()) params.set("q", historyQuery.trim());
      fetch(`/api/inbound-inquiries?${params}`, { credentials: "include" })
        .then((r) => r.json())
        .then((d) => { setHistory(d.inquiries ?? []); setHistoryTotal(d.total ?? 0); })
        .catch(() => toast.error("過去の問い合わせの取得に失敗しました"));
    }, 200);
    return () => clearTimeout(timeout);
  }, [historyOpen, historyQuery]);

  useEffect(() => {
    fetch("/api/inbound-inquiries/partners", { credentials: "include" })
      .then((r) => r.json())
      .then((d) => setPartnerSuggestions(d.partners ?? []))
      .catch(() => {});
  }, []);

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
    setNewInquiry({ inquiry_date: new Date().toISOString().slice(0, 10), company_name: "", store_name: "", business_type: "", products: [] as string[], category: "", action: "", referred_partner: "", contact_name: "", source: "", content: "" });
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
    <header className="enterprise-page-head"><div><p className="eyebrow">INBOUND · TRIAGE DESK</p><h1>最初の反応を、<br />顧客の文脈へつなぐ。</h1><p>問い合わせ原文を残し、重複確認を経て、取引先へ一度で引き継ぎます。</p></div><div className="enterprise-head-actions"><button className="quiet-action" onClick={() => setHistoryOpen((v) => !v)}><Search size={14} />過去の問い合わせを検索</button><Button className="ink-button" onClick={() => setShowNewForm((v) => !v)}><Plus size={16} />問い合わせを登録</Button></div></header>
    {historyOpen && <section className="conversion-sheet" style={{ marginBottom: 16 }}>
      <div className="conversion-head"><div><span className="eyebrow">INQUIRY ARCHIVE</span><h3>過去の問い合わせ（{historyTotal}件）</h3></div></div>
      <label className="worklist-search" style={{ margin: "8px 0" }}><Search size={15} /><input placeholder="社名・店名・業態・紹介先で検索" value={historyQuery} onChange={(e) => setHistoryQuery(e.target.value)} /></label>
      <div className="activity-ledger">
        {history.map((h) => <article key={h.id}>
          <span className="activity-index" />
          <div>
            <b>{h.company_name || h.store_name || "名称不明"}{h.company_name && h.store_name ? `　${h.store_name}` : ""}</b>
            <p>{[h.inquiry_date ? new Date(h.inquiry_date).toLocaleDateString("ja-JP") : "日付不明", h.business_type, h.products?.join("、"), h.category, h.referred_partner ? `紹介先: ${h.referred_partner}` : null].filter(Boolean).join(" ・ ")}</p>
            {h.original_status && <small>当時の状況: {h.original_status}</small>}
          </div>
          <Tag tone={h.status === "取引先化済み" ? "moss" : h.status === "対象外" ? "neutral" : "navy"}>{h.status}</Tag>
        </article>)}
        {history.length === 0 && <p className="queue-empty">{historyQuery ? "該当する問い合わせがありません。" : "読み込み中..."}</p>}
        {historyTotal > history.length && <p className="queue-empty">上位{history.length}件を表示（全{historyTotal}件）。検索で絞り込めます。</p>}
      </div>
    </section>}
    <div className="workflow-ribbon"><span className="active">01 問い合わせを確認</span><ChevronRight size={14} /><span>02 重複候補を確認</span><ChevronRight size={14} /><span>03 取引先へ変換</span><ChevronRight size={14} /><span>04 初回アクション</span></div>
    {showNewForm && <section className="conversion-sheet" style={{ marginBottom: 16 }}>
      <div className="conversion-grid">
        <label>問い合わせ日<input type="date" value={newInquiry.inquiry_date} onChange={(e) => setNewInquiry({ ...newInquiry, inquiry_date: e.target.value })} /></label>
        <label>社名<input value={newInquiry.company_name} onChange={(e) => setNewInquiry({ ...newInquiry, company_name: e.target.value })} /></label>
        <label>店名<input value={newInquiry.store_name} onChange={(e) => setNewInquiry({ ...newInquiry, store_name: e.target.value })} placeholder="店舗名（あれば）" /></label>
        <label>業態<select value={newInquiry.business_type} onChange={(e) => setNewInquiry({ ...newInquiry, business_type: e.target.value })}><option value="">未選択</option>{INQUIRY_BUSINESS_TYPES.map((b) => <option key={b} value={b}>{b}</option>)}</select></label>
        <label style={{ gridColumn: "1 / -1" }}>問い合わせ商材（複数選択可）
          <div className="checkbox-row">
            {INQUIRY_PRODUCTS.map((p) => <label key={p} className="checkbox-chip">
              <input type="checkbox" checked={newInquiry.products.includes(p)} onChange={(e) => setNewInquiry({
                ...newInquiry,
                products: e.target.checked ? [...newInquiry.products, p] : newInquiry.products.filter((x) => x !== p),
              })} />
              {p}
            </label>)}
          </div>
        </label>
        <label>区分<select value={newInquiry.category} onChange={(e) => setNewInquiry({ ...newInquiry, category: e.target.value })}><option value="">未選択</option>{INQUIRY_CATEGORIES.map((c) => <option key={c} value={c}>{c}</option>)}</select></label>
        <label>アクション<select value={newInquiry.action} onChange={(e) => setNewInquiry({ ...newInquiry, action: e.target.value, referred_partner: e.target.value === "紹介" ? newInquiry.referred_partner : "" })}><option value="">未選択</option>{INQUIRY_ACTIONS.map((a) => <option key={a} value={a}>{a}</option>)}</select></label>
        {newInquiry.action === "紹介" && <label>紹介先の共同事業者
          <input list="partner-suggestions" value={newInquiry.referred_partner} onChange={(e) => setNewInquiry({ ...newInquiry, referred_partner: e.target.value })} placeholder="共同事業者名" />
          <datalist id="partner-suggestions">{partnerSuggestions.map((p) => <option key={p} value={p} />)}</datalist>
        </label>}
        <label>担当者<input value={newInquiry.contact_name} onChange={(e) => setNewInquiry({ ...newInquiry, contact_name: e.target.value })} /></label>
        <label>経路<input value={newInquiry.source} onChange={(e) => setNewInquiry({ ...newInquiry, source: e.target.value })} placeholder="Webフォーム/紹介/広告など" /></label>
        <label style={{ gridColumn: "1 / -1" }}>内容<textarea value={newInquiry.content} onChange={(e) => setNewInquiry({ ...newInquiry, content: e.target.value })} rows={3} /></label>
      </div>
      <div className="conversion-footer"><span /><Button className="ink-button" onClick={createInquiry}>登録する</Button></div>
    </section>}
    <div className="enterprise-shell inbound-shell">
      <aside className="worklist-column"><div className="worklist-head"><div><span className="eyebrow">INBOUND INBOX</span><h2>問い合わせ <b>{inquiries.length}</b></h2></div><Inbox size={17} /></div><div className="inbound-rows">{inquiries.map((item, index) => <button className={`inbound-row ${selectedId === item.id ? "selected" : ""}`} key={item.id} onClick={() => setSelectedId(item.id)}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{item.company_name}</b><small>{item.content?.slice(0, 30) ?? ""}</small><em>{item.source ?? "経路不明"}</em></div><Tag tone={item.status === "未対応" ? "ochre" : "navy"}>{item.status}</Tag><ChevronRight size={15} /></button>)}{inquiries.length === 0 && <p className="queue-empty">問い合わせはありません。</p>}</div>{dismissedInquiries.length > 0 && <div className="action-dismissed"><span className="eyebrow">対象外にした問い合わせ</span>{dismissedInquiries.map((item) => <article className="action-dismissed-row" key={item.id}><div className="action-summary"><b>{item.company_name}</b><p>{item.exclusion_reason}</p></div><button className="row-dismiss" onClick={() => restore(item.id)} aria-label={`${item.company_name}を一覧に戻す`}><RotateCcw size={13} /></button></article>)}</div>}</aside>
      {inquiry ? <>
      <main className="decision-column inbound-decision"><div className="source-meta"><span>{inquiry.source ?? "経路不明"}</span><ChevronRight size={14} /><b>{new Date(inquiry.created_at).toLocaleString("ja-JP")} に受信</b></div><div className="triage-heading"><div><span className="eyebrow">INQUIRY RECORD</span><h2>{inquiry.company_name}{inquiry.store_name ? `　${inquiry.store_name}` : ""}</h2><p>{inquiry.contact_name ?? "担当者不明"}</p></div><Tag tone="ochre">{inquiry.status}</Tag></div>
      <section className="inquiry-record"><h3>問い合わせ情報</h3><div className="meeting-hearing">
        <span><em>問い合わせ日</em>{inquiry.inquiry_date ? new Date(inquiry.inquiry_date).toLocaleDateString("ja-JP") : "未記入"}</span>
        <span><em>業態</em>{inquiry.business_type || "未記入"}</span>
        <span><em>商材</em>{inquiry.products?.length ? inquiry.products.join("、") : "未記入"}</span>
        <span><em>区分</em>{inquiry.category || "未記入"}</span>
        <span><em>アクション</em>{inquiry.action || "未記入"}</span>
        {inquiry.action === "紹介" && <span><em>紹介先</em>{inquiry.referred_partner || "未記入"}</span>}
      </div></section>
      <section className="inquiry-record"><h3>問い合わせ内容</h3><p>{inquiry.content || "本文の記録はありません。"}</p></section><section className="conversion-sheet"><div className="conversion-head"><div><span className="eyebrow">CONVERSION</span><h3>取引先に引き継ぐ</h3></div></div><div className="conversion-footer"><span><Copy size={14} />問い合わせ原文を引き継ぎます。</span><button className="quiet-action" onClick={dismiss}><EyeOff size={14} />対象外にする</button><Button className="ink-button" onClick={() => convert()}><Building2 size={16} />新規取引先として作成</Button></div></section></main>
      <aside className="context-column"><section className="context-card match-card"><div className="context-heading"><div><span className="eyebrow">MATCH CHECK</span><h3>重複を確認</h3></div><ShieldCheck size={16} /></div><p className="context-intro">自動統合はしません。近い候補があれば、既存取引先として引き継ぐか選べます。</p>{candidates.length === 0 ? <div className="match-line"><span>類似候補</span><b>0件</b><Tag tone="moss">新規</Tag></div> : candidates.map((c) => <div className="match-line" key={c.id}><span>{c.category}</span><b>{c.name}</b><button className="context-link" onClick={() => convert(c.id)} style={{ padding: 0 }}>この取引先に引き継ぐ <ArrowUpRight size={13} /></button></div>)}</section><section className="context-card assignment-card"><div className="context-heading"><div><span className="eyebrow">OWNERSHIP</span><h3>初回対応</h3></div><UserRound size={16} /></div><p>担当者の割り当ては今後の機能です。</p></section></aside>
      </> : <main className="decision-column inbound-decision"><div className="action-complete-empty"><CheckCircle2 size={24} /><b>確認する問い合わせはありません。</b><p>対象外にした問い合わせは履歴から確認できます。</p></div></main>}
    </div>
  </section>;
}
