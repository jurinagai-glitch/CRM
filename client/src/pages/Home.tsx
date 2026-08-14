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
  ChevronRight,
  CircleHelp,
  FileText,
  Inbox,
  LayoutDashboard,
  ListTodo,
  Menu,
  MoreHorizontal,
  Plus,
  Search,
  Send,
  Sparkles,
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

function Briefing() {
  const [company, setCompany] = useState("ネクサス製作所");
  return <section className="screen-page briefing-page"><div className="page-heading"><div><p className="eyebrow">MEETING BRIEFING</p><h1>打ち合わせ前の、<br />迷いをなくす。</h1><p>過去の議事録、提案、チームの学びから、準備の骨子を組み立てます。</p></div><Button className="ink-button" onClick={() => toast.success("ブリーフィングを新しく生成しました")}><Sparkles size={16} />更新する</Button></div><div className="briefing-layout"><section className="brief-document"><div className="brief-doc-top"><div><span className="eyebrow">PRE-MEETING NOTE</span><h2>{company} との打ち合わせ準備</h2></div><span>8/13 作成</span></div><div className="brief-context"><MiniAvatar tone="ochre">N</MiniAvatar><span><b>現場DX 基盤導入</b><small>提案ステージ　・　受注予定 8/22</small></span><StatusPill tone="ochre">確度 65%</StatusPill></div><div className="brief-sections"><section><h3>今回、確認すること</h3><ol><li>月末の現場を含む検討会に、誰が参加するか</li><li>一部ライン試行の対象範囲と成功条件</li><li>役員会に向けて必要な比較資料</li></ol></section><section><h3>前回からの変化</h3><p>工場長が課題の優先度を明確化。入力負荷だけでなく、導入後の定着支援が主要な検討軸になっています。</p></section><section><h3>使えるチームの学び</h3><div className="knowledge-reference"><BookOpen size={17} /><span><b>現場への導入提案では、月次レビューの設計を先に見せる</b><small>ナレッジ：製造業 / 定着支援</small></span><ArrowUpRight size={16} /></div></section></div><div className="brief-footer"><span><Sparkles size={15} />参照：議事録 3件・提案書 2件・ナレッジ 4件</span><button onClick={() => toast.info("共有リンクをコピーしました")}>共有する <Send size={15} /></button></div></section><aside className="brief-aside"><img src="/manus-storage/relay-briefing-collage_f67c4c69.jpg" alt="打ち合わせ準備のための紙のコラージュ" /><div><span className="eyebrow">SELECT ACCOUNT</span><h3>準備する取引先</h3>{["ネクサス製作所", "エバーグリーン物流", "クラウドリンク"].map((item) => <button className={company === item ? "selected" : ""} onClick={() => setCompany(item)} key={item}>{item}<ChevronRight size={15} /></button>)}</div></aside></div></section>;
}

function Knowledge() {
  return <section className="screen-page knowledge-page"><div className="page-heading"><div><p className="eyebrow">TEAM KNOWLEDGE</p><h1>次の商談で使える、<br />チームの学び。</h1><p>個人の経験を、文脈付きで誰でも使えるナレッジに変えます。</p></div><Button className="ink-button" onClick={() => toast.success("ナレッジ登録フォームを開きました")}><Plus size={16} />ナレッジを登録</Button></div><div className="knowledge-top"><div className="knowledge-search"><Search size={18} /><input aria-label="ナレッジを検索" placeholder="業種、商談場面、課題で検索" /><kbd>⌘ K</kbd></div><div className="topic-strip"><button className="active">すべて</button><button>初回商談</button><button>課題探索</button><button>価格・競合</button><button>提案設計</button></div></div><div className="knowledge-layout"><div className="knowledge-list">{knowledgeItems.map((item) => <button className="knowledge-card" key={item.title} onClick={() => toast.info("ナレッジの詳細を開きました")}><div><span className="paper-dot" /> <small>{item.source}</small></div><h3>{item.title}</h3><p>商談の背景と具体的な使いどころを残し、次の担当者がそのまま活用できるように整理しています。</p><div>{item.tags.map((tag) => <StatusPill key={tag}>{tag}</StatusPill>)}</div></button>)}</div><aside className="knowledge-aside"><img src="/manus-storage/relay-knowledge-stack_7b1a6485.jpg" alt="ナレッジの蓄積を表すフォルダとカード" /><div><span className="eyebrow">ONBOARDING</span><h3>まず読む、<br />営業の基本線。</h3><p>新しいメンバー向けに、商談フェーズごとの必読ナレッジをまとめています。</p><button onClick={() => toast.info("オンボーディングガイドを開きました")}>ガイドを開く <ArrowUpRight size={15} /></button></div></aside></div></section>;
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
      <nav><p className="nav-label">WORKSPACE</p>{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => selectScreen(item.id)}><Icon size={18} /><span>{item.label}</span>{item.count && <b>{item.count}</b>}</button>})}<div className="nav-divider" /><p className="nav-label">SHORTCUTS</p><button onClick={() => selectScreen("inbounds")}><Inbox size={18} /><span>問い合わせ</span><i>1</i></button><button onClick={() => selectScreen("meetings")}><FileText size={18} /><span>議事録</span><i>2</i></button><button className={screen === "renewals" ? "active" : ""} onClick={() => selectScreen("renewals")}><Building2 size={18} /><span>契約・更新</span></button><button className={screen === "briefing" ? "active" : ""} onClick={() => selectScreen("briefing")}><Sparkles size={18} /><span>準備</span></button><button className={screen === "knowledge" ? "active" : ""} onClick={() => selectScreen("knowledge")}><BookOpen size={18} /><span>ナレッジ</span></button></nav>
      <div className="sidebar-bottom"><button onClick={() => toast.info("ヘルプセンターを開きました")}><CircleHelp size={17} />ヘルプ</button><button className="profile" onClick={() => toast.info("プロフィール設定を開きました")}><MiniAvatar tone="ochre">瑞</MiniAvatar><span><b>佐々木 瑞希</b><small>営業企画</small></span><MoreHorizontal size={18} /></button></div>
    </aside>
    {sidebarOpen && <button aria-label="ナビゲーションを閉じる" className="mobile-overlay" onClick={() => setSidebarOpen(false)} />}
    <main className="main-area"><header className="topbar"><button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="ナビゲーションを開く"><Menu size={21} /></button><div className="breadcrumb"><span>ワークスペース</span><ChevronRight size={14} /><b>{activeName}</b></div><div className="top-actions"><button className="command-search" onClick={() => toast.info("検索パレットを開きました") }><Search size={17} /><span>検索</span><kbd>⌘ K</kbd></button><button className="notification" onClick={() => toast.info("新しい通知はありません")} aria-label="通知"><Bell size={19} /><i /></button><button className="add-button" onClick={() => { selectScreen("meetings"); toast.info("議事録を貼り付けて処理を開始できます") }}><Plus size={17} /><span>議事録を処理</span></button></div></header><div className="workspace">{renderScreen()}</div></main>
  </div>;
}
