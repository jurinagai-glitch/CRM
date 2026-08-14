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
