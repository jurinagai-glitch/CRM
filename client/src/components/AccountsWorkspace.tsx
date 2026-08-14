/**
 * Quiet Operations Desk: account worklist, a current decision surface, and an evidence context stay visible together.
 */
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Building2, CalendarDays, CheckCircle2, ChevronDown, ChevronRight, CircleAlert, CopyPlus, FileText, Landmark, Mail, MoreHorizontal, Plus, Search, Sparkles, UsersRound } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ScreenTarget = "overview" | "inbounds" | "accounts" | "meetings" | "briefing" | "knowledge" | "actions" | "renewals";

const accounts = [
  { id: "nexus", name: "ネクサス製作所", sector: "製造業 · 従業員 240名", deal: "現場DX 基盤導入", stage: "提案", amount: "¥480,000", next: "役員会向け比較資料を送付", due: "本日 15:00", owner: "佐々木", risk: "要確認" },
  { id: "evergreen", name: "エバーグリーン物流", sector: "運輸業 · 従業員 86名", deal: "配車業務の標準化", stage: "交渉", amount: "¥350,000", next: "要件整理シートを確認", due: "明日", owner: "佐々木", risk: "安定" },
  { id: "cloud", name: "クラウドリンク", sector: "IT · 従業員 112名", deal: "営業生産性の改善", stage: "提案", amount: "¥680,000", next: "役員会の日程を確認", due: "8/16", owner: "佐々木", risk: "確認中" },
  { id: "atelier", name: "アトリエ東雲", sector: "サービス業 · 従業員 34名", deal: "顧客管理の再設計", stage: "初回", amount: "¥220,000", next: "ヒアリング日程を調整", due: "8/20", owner: "藤原", risk: "安定" },
];

function Status({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "navy" | "moss" | "ochre" | "danger" }) {
  return <span className={`enterprise-status ${tone}`}>{children}</span>;
}

export default function AccountsWorkspace({ onNavigate }: { onNavigate: (screen: ScreenTarget) => void }) {
  const [selected, setSelected] = useState("nexus");
  const [activeTab, setActiveTab] = useState("概要");
  const account = accounts.find((item) => item.id === selected) ?? accounts[0];

  return <section className="screen-page enterprise-workspace account-workspace">
    <header className="enterprise-page-head"><div><p className="eyebrow">ACCOUNTS · CUSTOMER WORKSPACE</p><h1>取引先の判断を、<br />一つの文脈で進める。</h1><p>営業・提案・契約更新に必要な事実を、取引先ごとの作業面に集約します。</p></div><div className="enterprise-head-actions"><button className="quiet-action" onClick={() => toast.info("保存済みビューを切り替えました")}>自分の担当 <ChevronDown size={14} /></button><Button className="ink-button" onClick={() => toast.success("取引先登録フォームを開きました")}><Plus size={16} />取引先を登録</Button></div></header>

    <div className="workflow-ribbon" aria-label="MVPの営業フロー"><span className="active">01 インバウンド</span><ChevronRight size={14} /><span className="active">02 取引先・商談</span><ChevronRight size={14} /><span>03 議事録を確定</span><ChevronRight size={14} /><span>04 次アクション</span></div>

    <div className="enterprise-shell account-shell">
      <aside className="worklist-column"><div className="worklist-head"><div><span className="eyebrow">WORKLIST</span><h2>取引先 <b>38</b></h2></div><button onClick={() => toast.info("表示列の設定を開きました")} aria-label="取引先一覧の設定"><MoreHorizontal size={18} /></button></div><label className="worklist-search"><Search size={15} /><input aria-label="取引先を検索" placeholder="会社名・担当者を検索" /></label><div className="worklist-filters"><button className="selected">進行中 <b>12</b></button><button>要確認 <b>3</b></button></div><div className="account-rows">{accounts.map((item, index) => <button className={`account-row ${selected === item.id ? "selected" : ""}`} key={item.id} onClick={() => setSelected(item.id)}><span className="account-row-number">{String(index + 1).padStart(2, "0")}</span><span className="account-row-main"><b>{item.name}</b><small>{item.deal}</small></span><span className="account-row-meta"><Status tone={item.risk === "要確認" ? "ochre" : item.risk === "安定" ? "moss" : "navy"}>{item.risk}</Status><small>{item.due}</small></span><ChevronRight size={15} /></button>)}</div><button className="worklist-add" onClick={() => toast.success("取引先の作成を開始しました")}><CopyPlus size={15} />取引先を追加</button></aside>

      <main className="decision-column"><div className="entity-banner"><div className="entity-mark"><Building2 size={18} /></div><div className="entity-title"><div className="entity-overline"><Status tone="ochre">{account.stage}</Status><span>進行中の商談</span></div><h2>{account.name}</h2><p>{account.sector} <i /> 主担当：{account.owner}</p></div><button className="entity-more" onClick={() => toast.info("取引先のメニューを開きました")} aria-label="取引先メニュー"><MoreHorizontal size={19} /></button></div>
        <nav className="entity-tabs" aria-label="取引先のコンテキストタブ">{["概要", "商談 2", "活動 6", "資料 3", "契約 1"].map((tab) => <button className={activeTab === tab ? "active" : ""} key={tab} onClick={() => setActiveTab(tab)}>{tab}</button>)}</nav>
        <section className="current-decision"><div className="decision-label"><span className="eyebrow">CURRENT DECISION</span><Status tone="danger">期限 今日 15:00</Status></div><h3>{account.next}</h3><p>提案の比較軸を確認し、役員会で判断できる材料としてまとめます。次の操作を行う前に、議事録の未確定項目を確認してください。</p><div className="decision-actions"><Button className="ink-button" onClick={() => onNavigate("meetings")}><FileText size={16} />議事録を整理する</Button><button className="text-action" onClick={() => toast.info("次アクションの担当と期限を編集できます")}>アクションを編集 <ArrowUpRight size={15} /></button></div></section>
        <section className="account-facts"><div><span>商談</span><b>{account.deal}</b><small>{account.stage} · {account.amount}</small></div><div><span>次回接点</span><b>8/15 14:00</b><small>オンライン · 30分</small></div><div><span>更新見込み</span><b>8/22</b><small>初年度契約を想定</small></div><div><span>最終活動</span><b>本日 10:24</b><small>議事録を下書き保存</small></div></section>
        <section className="ledger-section"><div className="ledger-heading"><div><span className="eyebrow">ACCOUNT LEDGER</span><h3>判断につながる活動</h3></div><button className="text-action" onClick={() => toast.info("すべての活動履歴を開きました")}>すべて見る <ArrowUpRight size={15} /></button></div><div className="activity-ledger"><article><span className="activity-index">01</span><div><b>議事録を下書き保存</b><p>導入後の定着支援と、月末の検討会が重要論点として記録されています。</p><small>本日 10:24 · 佐々木</small></div><Status tone="navy">確認待ち</Status></article><article><span className="activity-index">02</span><div><b>提案書 v2 を送付</b><p>利用部門ごとの段階導入プランと、役員会向けの比較表を共有しました。</p><small>8/08 · 佐々木</small></div><Status tone="neutral">資料</Status></article><article><span className="activity-index">03</span><div><b>初回ヒアリング</b><p>工場長と情報システム部で、現場入力の二重化を確認しました。</p><small>7/29 · 高橋</small></div><Status tone="neutral">商談</Status></article></div></section>
      </main>

      <aside className="context-column"><section className="context-card qualification-card"><div className="context-heading"><div><span className="eyebrow">DECISION EVIDENCE</span><h3>確認状況</h3></div><CircleAlert size={16} /></div><p className="context-intro">商談を進める前に、確定した事実と未確認の判断材料を分けます。</p><div className="qualification-grid"><div><span>課題</span><b>入力の二重化</b><Status tone="moss">確認済み</Status></div><div><span>予算</span><b>月額50万円前後</b><Status tone="moss">確認済み</Status></div><div><span>決裁</span><b>工場長起案・役員会</b><Status tone="ochre">根拠を確認</Status></div><div><span>時期</span><b>10月から試行</b><Status tone="navy">仮説</Status></div></div><button className="context-link" onClick={() => onNavigate("meetings")}>根拠のある議事録を開く <ArrowUpRight size={15} /></button></section><section className="context-card data-integrity-card"><div className="context-heading"><div><span className="eyebrow">DATA INTEGRITY</span><h3>顧客情報の状態</h3></div><CheckCircle2 size={16} /></div><div className="integrity-line"><span>重複候補</span><b>なし</b></div><div className="integrity-line"><span>担当者</span><b>3名</b></div><div className="integrity-line"><span>最終更新</span><b>本日</b></div><button className="context-link" onClick={() => toast.info("データ品質の詳細を開きました")}>品質を確認する <ArrowUpRight size={15} /></button></section><section className="context-card meeting-context"><div className="context-heading"><div><span className="eyebrow">NEXT MEETING</span><h3>次の打ち合わせ</h3></div><CalendarDays size={16} /></div><b>8/15（木）14:00</b><p>役員会向け比較資料の最終確認</p><button className="context-link" onClick={() => onNavigate("briefing")}>準備メモを開く <Sparkles size={15} /></button></section></aside>
    </div>
  </section>;
}
