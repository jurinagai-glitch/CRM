/**
 * Quiet Operations Desk: a practical, editorial CRM workbench where the next sales action is always obvious.
 */
/** Quiet Operations Desk: application shell and routing preserve a shared worklist → decision → context structure. */
import { Button } from "@/components/ui/button";
import Renewals from "@/components/Renewals";
import AccountsWorkspace from "@/components/AccountsWorkspace";
import MeetingWorkbench from "@/components/MeetingWorkbench";
import InboundTriage from "@/components/InboundTriage";
import ActionRunway from "@/components/ActionRunway";
import AutomationHub from "@/components/AutomationHub";
import {
  ArrowUpRight,
  Bell,
  BookOpen,
  Building2,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  Clock3,
  Command,
  FileText,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Settings2,
  Sparkles,
  Target,
  UsersRound,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Screen = "overview" | "inbounds" | "accounts" | "meetings" | "briefing" | "knowledge" | "actions" | "renewals";

const navItems: { id: Screen; label: string; icon: typeof LayoutDashboard; count?: number }[] = [
  { id: "overview", label: "自動化", icon: LayoutDashboard, count: 4 },
  { id: "accounts", label: "顧客", icon: Building2 },
  { id: "actions", label: "実行", icon: ListTodo, count: 5 },
];

const actionItems = [
  { company: "ネクサス製作所", action: "デモ環境の利用条件を送付", due: "今日 15:00", owner: "自分", tone: "urgent" },
  { company: "エバーグリーン物流", action: "要件整理シートを確認", due: "明日", owner: "自分", tone: "normal" },
  { company: "クラウドリンク", action: "役員会の日程を確認", due: "8/16", owner: "佐藤", tone: "muted" },
  { company: "西東京リハビリテーション", action: "導入スケジュールを更新", due: "8/18", owner: "自分", tone: "muted" },
];

const deals = [
  { name: "ネクサス製作所", deal: "現場DX 基盤導入", amount: "¥480k", owner: "高", due: "8/22", stage: "提案", color: "ochre" },
  { name: "エバーグリーン物流", deal: "配車業務の標準化", amount: "¥350k", owner: "瑞", due: "9/05", stage: "交渉", color: "moss" },
  { name: "クラウドリンク", deal: "営業生産性の改善", amount: "¥680k", owner: "佐", due: "9/12", stage: "提案", color: "navy" },
  { name: "アトリエ東雲", deal: "顧客管理の再設計", amount: "¥220k", owner: "瑞", due: "9/20", stage: "初回", color: "stone" },
];

const knowledgeItems = [
  { title: "物流業界：配車チームへの初回ヒアリング", tags: ["物流", "初回商談", "課題探索"], source: "エバーグリーン物流・7/28" },
  { title: "価格への懸念を、運用コストの話へ切り替える", tags: ["価格", "切り返し", "提案"], source: "ネクサス製作所・7/16" },
  { title: "決裁者が不在の商談で確認する5つのこと", tags: ["決裁", "商談設計"], source: "チーム共通" },
];

function MiniAvatar({ children, tone = "navy" }: { children: string; tone?: "navy" | "ochre" | "moss" | "stone" }) {
  return <span className={`mini-avatar ${tone}`}>{children}</span>;
}

function StatusPill({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "navy" | "moss" | "ochre" | "danger" }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function SectionHeader({ eyebrow, title, action }: { eyebrow?: string; title: string; action?: React.ReactNode }) {
  return (
    <div className="section-header">
      <div>
        {eyebrow && <p className="eyebrow">{eyebrow}</p>}
        <h2>{title}</h2>
      </div>
      {action}
    </div>
  );
}

function Overview({ setScreen }: { setScreen: (screen: Screen) => void }) {
  return (
    <>
      <section className="signal-banner">
        <img src="/manus-storage/relay-dashboard-signal_032f06a5.jpg" alt="紙とインクの抽象的な背景" />
        <div className="signal-copy">
          <p className="eyebrow">8月13日 水曜日</p>
          <h1>今日の判断を、<br />次の一手へ。</h1>
          <p>期限が近い商談と、確認が必要なAI下書きから整理しています。</p>
          <Button className="ink-button" onClick={() => setScreen("meetings")}><Plus size={16} />議事録を整理する</Button>
        </div>
        <div className="signal-stats" aria-label="本日の優先指標">
          <div><span>対応期限</span><strong>4</strong><small>件・今日まで</small></div>
          <div><span>確認待ち</span><strong>2</strong><small>AI下書き</small></div>
        </div>
      </section>

      <section className="metrics-strip" aria-label="営業状況の要約">
        <button onClick={() => setScreen("inbounds")}><span>未対応インバウンド</span><strong>7</strong><em>＋2件 <ArrowUpRight size={13} /></em></button>
        <button onClick={() => setScreen("actions")}><span>今週の次アクション</span><strong>12</strong><em className="steady">期限内 8件</em></button>
        <button onClick={() => setScreen("accounts")}><span>進行中の見込み</span><strong>¥4.2M</strong><em className="steady">9商談</em></button>
        <button onClick={() => setScreen("meetings")}><span>今月の成約見込み</span><strong>¥1.16M</strong><em className="moss-text">3商談</em></button>
      </section>

      <div className="dashboard-columns">
        <section className="paper-panel action-panel">
          <SectionHeader eyebrow="TODAY'S FOCUS" title="今日、止めない商談" action={<button className="text-action" onClick={() => setScreen("actions")}>すべて見る <ChevronRight size={15} /></button>} />
          <div className="action-list">
            {actionItems.map((item, index) => (
              <button className="action-row" key={item.company} onClick={() => toast.success("アクション詳細を開きました", { description: `${item.company} — ${item.action}` })}>
                <span className={`action-index ${item.tone}`}>{String(index + 1).padStart(2, "0")}</span>
                <span className="action-body"><b>{item.company}</b><span>{item.action}</span></span>
                <span className="action-due"><b className={item.tone}>{item.due}</b><small>{item.owner}</small></span>
                <ChevronRight className="row-chevron" size={17} />
              </button>
            ))}
          </div>
        </section>

        <aside className="draft-panel">
          <div className="draft-topline"><span><Sparkles size={15} />AIが整理した下書き</span><button onClick={() => setScreen("meetings")}>2件</button></div>
          <div className="draft-card">
            <div className="draft-card-head"><MiniAvatar tone="ochre">N</MiniAvatar><div><b>ネクサス製作所</b><span>8/12 議事録より</span></div></div>
            <p>「現場ごとの入力負荷」と「導入後の定着」が主要な検討ポイントとして整理されました。</p>
            <div className="draft-chips"><StatusPill tone="ochre">課題</StatusPill><StatusPill tone="navy">次アクション 2件</StatusPill></div>
            <button className="draft-link" onClick={() => setScreen("meetings")}>内容を確認する <ArrowUpRight size={15} /></button>
          </div>
          <p className="draft-caption">AIの抽出内容は、保存前に必ず確認できます。</p>
        </aside>
      </div>

      <section className="pipeline-section">
        <SectionHeader eyebrow="PIPELINE" title="進行中の商談" action={<button className="text-action" onClick={() => setScreen("accounts")}>商談一覧 <ChevronRight size={15} /></button>} />
        <div className="pipeline-grid">
          <div className="pipeline-label"><span>初回接触</span><b>2</b><i /></div>
          <div className="pipeline-label active"><span>提案</span><b>4</b><i /></div>
          <div className="pipeline-label"><span>交渉</span><b>2</b><i /></div>
          <div className="pipeline-label"><span>クロージング</span><b>1</b><i /></div>
        </div>
        <div className="deal-list">
          {deals.map((deal) => <button key={deal.name} className="deal-row" onClick={() => setScreen("accounts")}>
            <span className={`deal-marker ${deal.color}`} />
            <span className="deal-company"><b>{deal.name}</b><small>{deal.deal}</small></span>
            <span className="deal-amount">{deal.amount}</span>
            <StatusPill tone={deal.color === "moss" ? "moss" : deal.color === "ochre" ? "ochre" : "navy"}>{deal.stage}</StatusPill>
            <MiniAvatar tone={deal.color === "ochre" ? "ochre" : "navy"}>{deal.owner}</MiniAvatar>
            <span className="deal-date">{deal.due}</span>
          </button>)}
        </div>
      </section>
    </>
  );
}

function Inbounds() {
  const rows = [
    ["アイピーシーアドバンス", "HP", "人事部門で使う管理ツールを探している", "未対応", "10:24"],
    ["株式会社ベルクレスト", "紹介", "商談管理の運用について相談したい", "対応中", "昨日"],
    ["マルニ食品", "広告", "見積もり依頼・導入時期は10月頃", "未対応", "昨日"],
    ["東雲建設", "HP", "建設現場の情報共有を効率化したい", "取引先化済み", "8/11"],
  ];
  return <section className="screen-page">
    <div className="page-heading"><div><p className="eyebrow">INBOUND INQUIRIES</p><h1>新しい問い合わせ</h1><p>最初の反応から、取引先化までの流れを一か所で管理します。</p></div><Button className="ink-button" onClick={() => toast.success("問い合わせ登録フォームを開きました")}><Plus size={16} />問い合わせを登録</Button></div>
    <div className="inbound-feature">
      <img src="/manus-storage/relay-inbound-field_ba0b8739.jpg" alt="新しい問い合わせを表す紙のビジュアル" />
      <div><span className="eyebrow">FLOW</span><h2>問い合わせ情報を<br />二度入力しない。</h2><p>対応完了後に「取引先化」すると、会社名・内容・流入経路を引き継いで商談を始められます。</p><button className="inline-link" onClick={() => toast.info("このプロトタイプでは画面遷移を模擬しています")}>取引先化の流れを見る <ArrowUpRight size={15} /></button></div>
    </div>
    <section className="paper-panel table-panel">
      <div className="table-tools"><div className="table-tabs"><button className="active">すべて <b>7</b></button><button>未対応 <b>4</b></button><button>対応中 <b>2</b></button></div><button className="filter-button"><Settings2 size={15} />絞り込み</button></div>
      <div className="data-table"><div className="data-row data-head"><span>問い合わせ元</span><span>流入</span><span>内容</span><span>対応状況</span><span>受信</span><span /></div>{rows.map(([company, source, content, status, time]) => <button className="data-row" key={company} onClick={() => toast.success(`${company} の詳細を開きました`)}><span><b>{company}</b></span><span><StatusPill tone="neutral">{source}</StatusPill></span><span className="muted-copy">{content}</span><span><StatusPill tone={status === "未対応" ? "danger" : status === "対応中" ? "ochre" : "moss"}>{status}</StatusPill></span><span className="table-time">{time}</span><span><MoreHorizontal size={18} /></span></button>)}</div>
    </section>
  </section>;
}

function Accounts() {
  return <section className="screen-page">
    <div className="page-heading"><div><p className="eyebrow">ACCOUNTS & DEALS</p><h1>取引先と商談</h1><p>会社の文脈、決裁の状況、やり取りの履歴を切り離さずに見ます。</p></div><Button className="ink-button" onClick={() => toast.success("取引先登録フォームを開きました")}><Plus size={16} />取引先を登録</Button></div>
    <div className="account-layout">
      <section className="paper-panel account-list"><div className="list-head"><b>取引先一覧</b><span>全 38社</span></div>{deals.concat([{ name: "エメラルド印刷", deal: "営業フローの改善", amount: "¥290k", owner: "藤", due: "9/24", stage: "初回", color: "stone" }]).map((d, i) => <button key={d.name} className={`account-line ${i === 0 ? "selected" : ""}`} onClick={() => toast.info(`${d.name} を選択しました`)}><MiniAvatar tone={d.color === "ochre" ? "ochre" : d.color === "moss" ? "moss" : "navy"}>{d.name.slice(0, 1)}</MiniAvatar><span><b>{d.name}</b><small>{d.deal}</small></span><ChevronRight size={16} /></button>)}</section>
      <section className="account-detail"><div className="detail-head"><div><div className="detail-kicker"><StatusPill tone="ochre">提案</StatusPill><span>進行中</span></div><h2>ネクサス製作所</h2><p>製造業　・　従業員 240名　・　東京都大田区</p></div><button className="icon-button" onClick={() => toast.info("取引先の編集画面を開きました")}><MoreHorizontal size={19} /></button></div><div className="detail-figures"><div><span>見込み月額</span><b>¥480,000</b></div><div><span>確度</span><b>65%</b></div><div><span>受注予定</span><b>8/22</b></div></div><div className="timeline"><p className="eyebrow">ACCOUNT TIMELINE</p><div className="timeline-entry"><i className="event-dot navy" /><div><b>議事録を整理しました</b><span>現場ごとの入力負荷と定着支援が論点です。</span><small>8/12　瑞希</small></div></div><div className="timeline-entry"><i className="event-dot ochre" /><div><b>提案書 v2 を送付</b><span>利用部門ごとの段階導入プランを提示しました。</span><small>8/08　瑞希</small></div></div><div className="timeline-entry"><i className="event-dot stone" /><div><b>初回ヒアリング</b><span>工場長・情報システム部と打ち合わせ。</span><small>7/29　高橋</small></div></div></div></section>
    </div>
  </section>;
}

function Meetings() {
  const [organized, setOrganized] = useState(false);
  const [saved, setSaved] = useState(false);
  return <section className="screen-page meeting-page">
    <div className="page-heading"><div><p className="eyebrow">MEETING NOTE WORKBENCH</p><h1>議事録を、次の行動へ。</h1><p>外部の議事録を貼り付けて、確認できる下書きに整理します。</p></div><StatusPill tone="navy">入力は保存前まで非公開</StatusPill></div>
    <div className="meeting-workbench"><section className="note-input"><div className="note-meta"><button><Building2 size={15} />ネクサス製作所 <ChevronDown size={14} /></button><span>商談：現場DX 基盤導入</span></div><label htmlFor="note">議事録原文</label><textarea id="note" defaultValue={"現場ではExcelと紙の帳票が混在している。工場長は月末までに現場を含めた検討会を行いたいとのこと。\n\n課題：現場入力の二重化、集計に2日かかる\n予算：まずは月額50万円前後で検討\n決裁：工場長が起案、役員会で最終決定\n時期：10月から一部ラインで試行したい"} /><div className="input-footer"><span><Clock3 size={14} />最終編集：たった今</span><Button className="ink-button" onClick={() => { setOrganized(true); toast.success("確認用の下書きを作成しました") }}><Sparkles size={16} />まとめる</Button></div></section>
      <aside className={`summary-draft ${organized ? "is-ready" : ""}`}><div className="summary-header"><div><Sparkles size={16} /><span>確認用の下書き</span></div><StatusPill tone={organized ? "ochre" : "neutral"}>{organized ? "未保存" : "入力待ち"}</StatusPill></div>{organized ? <div className="summary-content"><section><h3>商談サマリ</h3><p>現場ごとの二重入力と集計工数が課題。10月の一部ライン試行に向け、月額50万円前後の段階導入案を検討中です。</p></section><section><h3>決定事項</h3><ul><li><Check size={14} />月末までに現場を含む検討会を実施</li><li><Check size={14} />段階導入プランを次回提示</li></ul></section><section className="hear-grid"><div><span>課題</span><b>二重入力・集計工数</b></div><div><span>予算</span><b>月額50万円前後</b></div><div><span>決裁</span><b>工場長起案・役員会</b></div><div><span>時期</span><b>10月に一部試行</b></div></section><button className="save-draft" onClick={() => { setSaved(true); toast.success("議事録と次アクションを保存しました") }}><Check size={16} />{saved ? "保存済み" : "内容を確認して保存"}</button></div> : <div className="draft-empty"><Sparkles size={23} /><b>貼り付けた議事録を整理します</b><p>サマリ、決定事項、次アクションと、ヒアリング項目を編集可能な下書きとして作成します。</p></div>}</aside>
    </div>
  </section>;
}

function Briefing() {
  const [company, setCompany] = useState("ネクサス製作所");
  return <section className="screen-page briefing-page"><div className="page-heading"><div><p className="eyebrow">MEETING BRIEFING</p><h1>打ち合わせ前の、<br />迷いをなくす。</h1><p>過去の議事録、提案、チームの学びから、準備の骨子を組み立てます。</p></div><Button className="ink-button" onClick={() => toast.success("ブリーフィングを新しく生成しました")}><Sparkles size={16} />更新する</Button></div><div className="briefing-layout"><section className="brief-document"><div className="brief-doc-top"><div><span className="eyebrow">PRE-MEETING NOTE</span><h2>{company} との打ち合わせ準備</h2></div><span>8/13 作成</span></div><div className="brief-context"><MiniAvatar tone="ochre">N</MiniAvatar><span><b>現場DX 基盤導入</b><small>提案ステージ　・　受注予定 8/22</small></span><StatusPill tone="ochre">確度 65%</StatusPill></div><div className="brief-sections"><section><h3>今回、確認すること</h3><ol><li>月末の現場を含む検討会に、誰が参加するか</li><li>一部ライン試行の対象範囲と成功条件</li><li>役員会に向けて必要な比較資料</li></ol></section><section><h3>前回からの変化</h3><p>工場長が課題の優先度を明確化。入力負荷だけでなく、導入後の定着支援が主要な検討軸になっています。</p></section><section><h3>使えるチームの学び</h3><div className="knowledge-reference"><BookOpen size={17} /><span><b>現場への導入提案では、月次レビューの設計を先に見せる</b><small>ナレッジ：製造業 / 定着支援</small></span><ArrowUpRight size={16} /></div></section></div><div className="brief-footer"><span><Sparkles size={15} />参照：議事録 3件・提案書 2件・ナレッジ 4件</span><button onClick={() => toast.info("共有リンクをコピーしました")}>共有する <Send size={15} /></button></div></section><aside className="brief-aside"><img src="/manus-storage/relay-briefing-collage_f67c4c69.jpg" alt="打ち合わせ準備のための紙のコラージュ" /><div><span className="eyebrow">SELECT ACCOUNT</span><h3>準備する取引先</h3>{["ネクサス製作所", "エバーグリーン物流", "クラウドリンク"].map((item) => <button className={company === item ? "selected" : ""} onClick={() => setCompany(item)} key={item}>{item}<ChevronRight size={15} /></button>)}</div></aside></div></section>;
}

function Knowledge() {
  return <section className="screen-page knowledge-page"><div className="page-heading"><div><p className="eyebrow">TEAM KNOWLEDGE</p><h1>次の商談で使える、<br />チームの学び。</h1><p>個人の経験を、文脈付きで誰でも使えるナレッジに変えます。</p></div><Button className="ink-button" onClick={() => toast.success("ナレッジ登録フォームを開きました")}><Plus size={16} />ナレッジを登録</Button></div><div className="knowledge-top"><div className="knowledge-search"><Search size={18} /><input aria-label="ナレッジを検索" placeholder="業種、商談場面、課題で検索" /><kbd>⌘ K</kbd></div><div className="topic-strip"><button className="active">すべて</button><button>初回商談</button><button>課題探索</button><button>価格・競合</button><button>提案設計</button></div></div><div className="knowledge-layout"><div className="knowledge-list">{knowledgeItems.map((item) => <button className="knowledge-card" key={item.title} onClick={() => toast.info("ナレッジの詳細を開きました")}><div><span className="paper-dot" /> <small>{item.source}</small></div><h3>{item.title}</h3><p>商談の背景と具体的な使いどころを残し、次の担当者がそのまま活用できるように整理しています。</p><div>{item.tags.map((tag) => <StatusPill key={tag}>{tag}</StatusPill>)}</div></button>)}</div><aside className="knowledge-aside"><img src="/manus-storage/relay-knowledge-stack_7b1a6485.jpg" alt="ナレッジの蓄積を表すフォルダとカード" /><div><span className="eyebrow">ONBOARDING</span><h3>まず読む、<br />営業の基本線。</h3><p>新しいメンバー向けに、商談フェーズごとの必読ナレッジをまとめています。</p><button onClick={() => toast.info("オンボーディングガイドを開きました")}>ガイドを開く <ArrowUpRight size={15} /></button></div></aside></div></section>;
}

function Actions() {
  const items = actionItems.concat([
    { company: "アトリエ東雲", action: "現場責任者への確認メールを送る", due: "8/20", owner: "藤原", tone: "muted" },
    { company: "エメラルド印刷", action: "初回ヒアリングの日程を調整", due: "8/21", owner: "自分", tone: "muted" },
  ]);
  return (
    <section className="screen-page">
      <div className="page-heading"><div><p className="eyebrow">ALL NEXT ACTIONS</p><h1>次アクション</h1><p>期限と担当で横断し、今日動かすべきことから片付けます。</p></div><Button className="ink-button" onClick={() => toast.success("次アクション追加フォームを開きました")}><Plus size={16} />アクションを追加</Button></div>
      <section className="paper-panel action-panel full"><div className="action-list">
        {items.map((item, index) => (
          <button className="action-row" key={`${item.company}-${index}`} onClick={() => toast.success("アクションを完了しました")}>
            <span className="check-circle" />
            <span className={`action-index ${item.tone}`}>{String(index + 1).padStart(2, "0")}</span>
            <span className="action-body"><b>{item.company}</b><span>{item.action}</span></span>
            <span className="action-due"><b className={item.tone}>{item.due}</b><small>{item.owner}</small></span>
            <ChevronRight className="row-chevron" size={17} />
          </button>
        ))}
      </div></section>
    </section>
  );
}

export default function Home() {
  const initialScreen = (() => {
    const requested = new URLSearchParams(window.location.search).get("screen") as Screen | null;
    const availableScreens: Screen[] = ["overview", "inbounds", "accounts", "meetings", "briefing", "knowledge", "actions", "renewals"];
    return requested && availableScreens.includes(requested) ? requested : "overview";
  })();
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeName = useMemo(() => ({ overview: "自動化", inbounds: "問い合わせ", accounts: "顧客", meetings: "議事録", briefing: "準備", knowledge: "ナレッジ", actions: "実行", renewals: "契約・更新" }[screen]), [screen]);
  const renderScreen = () => {
    if (screen === "inbounds") return <InboundTriage onNavigate={selectScreen} />;
    if (screen === "accounts") return <AccountsWorkspace onNavigate={selectScreen} />;
    if (screen === "meetings") return <MeetingWorkbench onNavigate={selectScreen} />;
    if (screen === "briefing") return <Briefing />;
    if (screen === "knowledge") return <Knowledge />;
    if (screen === "renewals") return <Renewals />;
    if (screen === "actions") return <ActionRunway onNavigate={selectScreen} />;
    return <AutomationHub onNavigate={selectScreen} />;
  };
  const selectScreen = (id: Screen) => { window.history.replaceState({}, "", `?screen=${id}`); setScreen(id); setSidebarOpen(false); };
  return <div className="crm-app">
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="brand"><img src="/manus-storage/relay-mark_a7cdb14a.png" alt="Relay CRM" /><span>Relay <em>CRM</em></span><button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="ナビゲーションを閉じる"><X size={19} /></button></div>
      <nav><p className="nav-label">WORKSPACE</p>{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => selectScreen(item.id)}><Icon size={18} /><span>{item.label}</span>{item.count && <b>{item.count}</b>}</button>})}<div className="nav-divider" /><p className="nav-label">SHORTCUTS</p><button onClick={() => selectScreen("inbounds")}><Inbox size={18} /><span>問い合わせ</span><i>1</i></button><button onClick={() => selectScreen("meetings")}><FileText size={18} /><span>議事録</span><i>2</i></button></nav>
      <div className="sidebar-bottom"><button onClick={() => toast.info("ヘルプセンターを開きました")}><CircleHelp size={17} />ヘルプ</button><button className="profile" onClick={() => toast.info("プロフィール設定を開きました")}><MiniAvatar tone="ochre">瑞</MiniAvatar><span><b>佐々木 瑞希</b><small>営業企画</small></span><MoreHorizontal size={18} /></button></div>
    </aside>
    {sidebarOpen && <button aria-label="ナビゲーションを閉じる" className="mobile-overlay" onClick={() => setSidebarOpen(false)} />}
    <main className="main-area"><header className="topbar"><button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="ナビゲーションを開く"><Menu size={21} /></button><div className="breadcrumb"><span>ワークスペース</span><ChevronRight size={14} /><b>{activeName}</b></div><div className="top-actions"><button className="command-search" onClick={() => toast.info("検索パレットを開きました") }><Search size={17} /><span>検索</span><kbd>⌘ K</kbd></button><button className="notification" onClick={() => toast.info("新しい通知はありません")} aria-label="通知"><Bell size={19} /><i /></button><button className="add-button" onClick={() => { selectScreen("meetings"); toast.info("議事録を貼り付けて処理を開始できます") }}><Plus size={17} /><span>議事録を処理</span></button></div></header><div className="workspace">{renderScreen()}</div></main>
  </div>;
}
