/**
 * Quiet Operations Desk: inbound triage turns a raw inquiry into a traceable account conversion without re-entry.
 */
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Building2, CheckCircle2, ChevronDown, ChevronRight, Copy, EyeOff, Inbox, Mail, Plus, RotateCcw, Search, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

const CURRENT_ACTOR = "佐々木 瑞希";
const DEFAULT_SNOOZE_DAYS = 7;
const DEFAULT_DISMISS_REASON = "対象外（要件が合わない）";

type DismissRecord = { reason: string; actor: string; snoozeUntil: string };

function formatDate(d: Date) {
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

type ScreenTarget = "overview" | "inbounds" | "accounts" | "meetings" | "briefing" | "knowledge" | "actions" | "renewals";
const inquiries = [
  { id: "ab", company: "アイピーシーアドバンス", contact: "大西 航", source: "Webフォーム", subject: "人事部門で使う管理ツールを検討中", received: "12分前", status: "未対応", email: "onishi@ipc-advance.jp", domain: "ipc-advance.jp" },
  { id: "val", company: "株式会社ベルクレスト", contact: "吉野 亜美", source: "紹介", subject: "商談管理の運用について相談したい", received: "1時間前", status: "未対応", email: "yoshino@bellcrest.co.jp", domain: "bellcrest.co.jp" },
  { id: "maru", company: "マルニ食品", contact: "田村 智也", source: "広告", subject: "見積もり依頼と導入スケジュールの確認", received: "昨日", status: "対応中", email: "tamura@maruni-foods.jp", domain: "maruni-foods.jp" },
  { id: "toshi", company: "東雲建設", contact: "原田 真紀", source: "Webフォーム", subject: "建設現場の情報共有を改善したい", received: "8/12", status: "対応中", email: "harada@shinonome.co.jp", domain: "shinonome.co.jp" },
];
function Tag({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "moss" | "ochre" | "navy" }) { return <span className={`enterprise-status ${tone}`}>{children}</span>; }

export default function InboundTriage({ onNavigate }: { onNavigate: (screen: ScreenTarget) => void }) {
  const [selected, setSelected] = useState("ab");
  const [dismissed, setDismissed] = useState<Record<string, DismissRecord>>({});
  const visibleInquiries = inquiries.filter((item) => !dismissed[item.id]);
  const dismissedInquiries = inquiries.filter((item) => dismissed[item.id]);
  const inquiry = visibleInquiries.find((item) => item.id === selected) ?? visibleInquiries[0];
  const convert = () => { toast.success("取引先と初回商談を作成しました。問い合わせ原文も引き継がれています。"); onNavigate("accounts"); };
  const dismiss = () => {
    if (!inquiry) return;
    const remaining = visibleInquiries.filter((item) => item.id !== inquiry.id);
    const now = new Date();
    const snoozeUntil = new Date(now.getTime() + DEFAULT_SNOOZE_DAYS * 24 * 60 * 60 * 1000);
    setDismissed((prev) => ({ ...prev, [inquiry.id]: { reason: DEFAULT_DISMISS_REASON, actor: CURRENT_ACTOR, snoozeUntil: formatDate(snoozeUntil) } }));
    setSelected(remaining[0]?.id ?? "");
    toast.info(`対象外にしました。${formatDate(snoozeUntil)}に再表示されます。`);
  };
  const updateReason = (id: string, reason: string) => { setDismissed((prev) => ({ ...prev, [id]: { ...prev[id], reason } })); };
  const restore = (id: string) => { setDismissed((prev) => { const next = { ...prev }; delete next[id]; return next; }); setSelected(id); toast.success("問い合わせ一覧に戻しました。"); };
  return <section className="screen-page enterprise-workspace inbound-workspace">
    <header className="enterprise-page-head"><div><p className="eyebrow">INBOUND · TRIAGE DESK</p><h1>最初の反応を、<br />顧客の文脈へつなぐ。</h1><p>問い合わせ原文を残し、重複確認と担当決めを経て、取引先・商談へ一度で引き継ぎます。</p></div><div className="enterprise-head-actions"><button className="quiet-action" onClick={() => toast.info("受信経路のフィルタを開きました")}>すべての経路 <ChevronDown size={14} /></button><Button className="ink-button" onClick={() => toast.info("問い合わせの手動登録を開きました")}><Plus size={16} />問い合わせを登録</Button></div></header>
    <div className="workflow-ribbon"><span className="active">01 問い合わせを確認</span><ChevronRight size={14} /><span>02 重複候補を確認</span><ChevronRight size={14} /><span>03 取引先・商談へ変換</span><ChevronRight size={14} /><span>04 初回アクション</span></div>
    <div className="enterprise-shell inbound-shell">
      <aside className="worklist-column"><div className="worklist-head"><div><span className="eyebrow">INBOUND INBOX</span><h2>問い合わせ <b>7</b></h2></div><button onClick={() => toast.info("インバウンドの表示設定を開きました")}><Inbox size={17} /></button></div><label className="worklist-search"><Search size={15} /><input aria-label="問い合わせを検索" placeholder="会社名・内容で検索" /></label><div className="worklist-filters"><button className="selected">未対応 <b>4</b></button><button>対応中 <b>2</b></button><button>取引先化 <b>1</b></button></div><div className="inbound-rows">{visibleInquiries.map((item, index) => <button className={`inbound-row ${selected === item.id ? "selected" : ""}`} key={item.id} onClick={() => setSelected(item.id)}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{item.company}</b><small>{item.subject}</small><em>{item.source} · {item.received}</em></div><Tag tone={item.status === "未対応" ? "ochre" : "navy"}>{item.status}</Tag><ChevronRight size={15} /></button>)}</div>{dismissedInquiries.length > 0 && <div className="action-dismissed"><span className="eyebrow">対象外にした問い合わせ</span>{dismissedInquiries.map((item) => { const record = dismissed[item.id]; return <article className="action-dismissed-row" key={item.id}><div className="action-summary"><b>{item.company}</b><p>{item.subject}</p></div><input className="dismiss-reason" value={record.reason} onChange={(e) => updateReason(item.id, e.target.value)} aria-label={`${item.company}の対象外理由`} /><span className="dismiss-meta">{record.actor} · {record.snoozeUntil}に再表示</span><button className="row-dismiss" onClick={() => restore(item.id)} aria-label={`${item.company}を一覧に戻す`}><RotateCcw size={13} /></button></article>; })}</div>}</aside>
      {inquiry ? <>
      <main className="decision-column inbound-decision"><div className="source-meta"><span><Mail size={15} />{inquiry.source}</span><ChevronRight size={14} /><b>{inquiry.received} に受信</b><span className="source-time">問い合わせID · IN-20260813-04</span></div><div className="triage-heading"><div><span className="eyebrow">INQUIRY RECORD</span><h2>{inquiry.company}</h2><p>{inquiry.contact} · {inquiry.email}</p></div><Tag tone="ochre">{inquiry.status}</Tag></div><section className="inquiry-record"><h3>問い合わせ内容</h3><p>人事部門で使う管理ツールを検討しています。現在はスプレッドシートで管理しており、部署間での進捗共有と担当者の引き継ぎに課題があります。30名程度のチームで使い始める場合の機能と費用を知りたいです。</p><div className="inquiry-meta"><span><b>想定部署</b>人事企画</span><span><b>想定人数</b>30名程度</span><span><b>相談内容</b>機能・費用</span></div></section><section className="conversion-sheet"><div className="conversion-head"><div><span className="eyebrow">CONVERSION DRAFT</span><h3>取引先・初回商談に引き継ぐ内容</h3></div><Tag tone="navy">自動入力</Tag></div><div className="conversion-grid"><label>取引先名<input defaultValue={inquiry.company} /></label><label>主担当<input defaultValue={inquiry.contact} /></label><label>初回商談名<input defaultValue={`${inquiry.company} · 初回ヒアリング`} /></label><label>次アクション<input defaultValue="初回ヒアリング候補日を送付" /></label></div><div className="conversion-footer"><span><Copy size={14} />問い合わせ原文・受信経路・担当者を引き継ぎます。</span><button className="quiet-action" onClick={dismiss}><EyeOff size={14} />対象外にする</button><Button className="ink-button" onClick={convert}><Building2 size={16} />取引先と商談を作成</Button></div></section></main>
      <aside className="context-column"><section className="context-card match-card"><div className="context-heading"><div><span className="eyebrow">MATCH CHECK</span><h3>重複を確認</h3></div><ShieldCheck size={16} /></div><p className="context-intro">自動統合はしません。登録前に、決定的な一致と近い候補を分けて確認します。</p><div className="match-line"><span>メールドメイン</span><b>{inquiry.domain}</b><Tag tone="moss">新規</Tag></div><div className="match-line"><span>会社名</span><b>完全一致なし</b><Tag tone="moss">新規</Tag></div><div className="match-line"><span>類似候補</span><b>0件</b><Tag>確認不要</Tag></div><button className="context-link" onClick={() => toast.info("重複候補の詳細を表示しました")}>照合の根拠を見る <ArrowUpRight size={15} /></button></section><section className="context-card assignment-card"><div className="context-heading"><div><span className="eyebrow">OWNERSHIP</span><h3>初回対応の担当</h3></div><UserRound size={16} /></div><b>佐々木 瑞希</b><p>人事・業務改善の相談を担当。直近の対応期限は本日 17:00です。</p><button className="context-link" onClick={() => toast.info("担当を変更できます")}>担当を変更する <ArrowUpRight size={15} /></button></section><section className="context-card response-card"><div className="context-heading"><div><span className="eyebrow">FIRST RESPONSE</span><h3>次に送る内容</h3></div><Sparkles size={16} /></div><p>候補日時、近い導入事例、費用確認に必要な3項目を案内します。</p><button className="context-link" onClick={() => toast.info("初回返信の下書きを開きました")}>返信の下書きを開く <ArrowUpRight size={15} /></button></section></aside>
      </> : <main className="decision-column inbound-decision"><div className="action-complete-empty"><CheckCircle2 size={24} /><b>確認する問い合わせはありません。</b><p>対象外にした問い合わせは履歴から確認できます。</p></div></main>}
    </div>
  </section>;
}
