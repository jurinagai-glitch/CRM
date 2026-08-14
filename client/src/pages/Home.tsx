/**
 * Quiet Operations Desk: a practical, editorial CRM workbench where the next sales action is always obvious.
 */
/** Quiet Operations Desk: application shell and routing preserve a shared worklist → decision → context structure. */
import Renewals from "@/components/Renewals";
import AccountsWorkspace from "@/components/AccountsWorkspace";
import MeetingWorkbench from "@/components/MeetingWorkbench";
import InboundTriage from "@/components/InboundTriage";
import ActionRunway from "@/components/ActionRunway";
import AutomationHub from "@/components/AutomationHub";
import MeetingBriefing from "@/components/MeetingBriefing";
import KnowledgeBase from "@/components/KnowledgeBase";
import Reports from "@/components/Reports";
import {
  Bell,
  BarChart3,
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
  Sparkles,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { toast } from "sonner";

type Screen = "overview" | "inbounds" | "accounts" | "meetings" | "briefing" | "knowledge" | "actions" | "renewals" | "reports";

const navItems: { id: Screen; label: string; icon: typeof LayoutDashboard; count?: number }[] = [
  { id: "overview", label: "自動化", icon: LayoutDashboard, count: 4 },
  { id: "accounts", label: "顧客", icon: Building2 },
  { id: "actions", label: "実行", icon: ListTodo, count: 5 },
];

function MiniAvatar({ children, tone = "navy" }: { children: string; tone?: "navy" | "ochre" | "moss" | "stone" }) {
  return <span className={`mini-avatar ${tone}`}>{children}</span>;
}

export default function Home() {
  const initialScreen = (() => {
    const requested = new URLSearchParams(window.location.search).get("screen") as Screen | null;
    const availableScreens: Screen[] = ["overview", "inbounds", "accounts", "meetings", "briefing", "knowledge", "actions", "renewals", "reports"];
    return requested && availableScreens.includes(requested) ? requested : "overview";
  })();
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const activeName = useMemo(() => ({ overview: "自動化", inbounds: "問い合わせ", accounts: "顧客", meetings: "議事録", briefing: "準備", knowledge: "ナレッジ", actions: "実行", renewals: "契約・更新", reports: "レポート" }[screen]), [screen]);
  const renderScreen = () => {
    if (screen === "inbounds") return <InboundTriage onNavigate={selectScreen} />;
    if (screen === "accounts") return <AccountsWorkspace onNavigate={selectScreen} />;
    if (screen === "meetings") return <MeetingWorkbench onNavigate={selectScreen} />;
    if (screen === "briefing") return <MeetingBriefing />;
    if (screen === "knowledge") return <KnowledgeBase />;
    if (screen === "renewals") return <Renewals />;
    if (screen === "actions") return <ActionRunway onNavigate={selectScreen} />;
    if (screen === "reports") return <Reports />;
    return <AutomationHub onNavigate={selectScreen} />;
  };
  const selectScreen = (id: Screen) => { window.history.replaceState({}, "", `?screen=${id}`); setScreen(id); setSidebarOpen(false); };
  return <div className="crm-app">
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="brand"><img src="/manus-storage/relay-mark_a7cdb14a.png" alt="Relay CRM" /><span>Relay <em>CRM</em></span><button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="ナビゲーションを閉じる"><X size={19} /></button></div>
      <nav><p className="nav-label">WORKSPACE</p>{navItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => selectScreen(item.id)}><Icon size={18} /><span>{item.label}</span>{item.count && <b>{item.count}</b>}</button>})}<div className="nav-divider" /><p className="nav-label">SHORTCUTS</p><button onClick={() => selectScreen("inbounds")}><Inbox size={18} /><span>問い合わせ</span><i>1</i></button><button onClick={() => selectScreen("meetings")}><FileText size={18} /><span>議事録</span><i>2</i></button><button className={screen === "renewals" ? "active" : ""} onClick={() => selectScreen("renewals")}><Building2 size={18} /><span>契約・更新</span></button><button className={screen === "briefing" ? "active" : ""} onClick={() => selectScreen("briefing")}><Sparkles size={18} /><span>準備</span></button><button className={screen === "knowledge" ? "active" : ""} onClick={() => selectScreen("knowledge")}><BookOpen size={18} /><span>ナレッジ</span></button><button className={screen === "reports" ? "active" : ""} onClick={() => selectScreen("reports")}><BarChart3 size={18} /><span>レポート</span></button></nav>
      <div className="sidebar-bottom"><button onClick={() => toast.info("ヘルプセンターを開きました")}><CircleHelp size={17} />ヘルプ</button><button className="profile" onClick={() => toast.info("プロフィール設定を開きました")}><MiniAvatar tone="ochre">瑞</MiniAvatar><span><b>佐々木 瑞希</b><small>営業企画</small></span><MoreHorizontal size={18} /></button></div>
    </aside>
    {sidebarOpen && <button aria-label="ナビゲーションを閉じる" className="mobile-overlay" onClick={() => setSidebarOpen(false)} />}
    <main className="main-area"><header className="topbar"><button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="ナビゲーションを開く"><Menu size={21} /></button><div className="breadcrumb"><span>ワークスペース</span><ChevronRight size={14} /><b>{activeName}</b></div><div className="top-actions"><button className="command-search" onClick={() => toast.info("検索パレットを開きました") }><Search size={17} /><span>検索</span><kbd>⌘ K</kbd></button><button className="notification" onClick={() => toast.info("新しい通知はありません")} aria-label="通知"><Bell size={19} /><i /></button><button className="add-button" onClick={() => { selectScreen("meetings"); toast.info("議事録を貼り付けて処理を開始できます") }}><Plus size={17} /><span>議事録を処理</span></button></div></header><div className="workspace">{renderScreen()}</div></main>
  </div>;
}
