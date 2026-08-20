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
import { Suspense, lazy, useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

const Reports = lazy(() => import("@/components/Reports"));

type Screen = "overview" | "inbounds" | "accounts" | "meetings" | "briefing" | "knowledge" | "actions" | "renewals" | "reports";
type SearchCompany = { id: string; name: string; category: string };

function MiniAvatar({ children, tone = "navy" }: { children: string; tone?: "navy" | "ochre" | "moss" | "stone" }) {
  return <span className={`mini-avatar ${tone}`}>{children}</span>;
}

export default function Home() {
  const initialScreen = (() => {
    const requested = new URLSearchParams(window.location.search).get("screen") as Screen | null;
    const availableScreens: Screen[] = ["overview", "inbounds", "accounts", "meetings", "briefing", "knowledge", "actions", "renewals", "reports"];
    return requested && availableScreens.includes(requested) ? requested : "accounts";
  })();
  const [screen, setScreen] = useState<Screen>(initialScreen);
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const [navCounts, setNavCounts] = useState({ needsAttention: 0, openActions: 0 });
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState<SearchCompany[]>([]);
  const activeName = useMemo(() => ({ overview: "自動化", inbounds: "問い合わせ", accounts: "顧客", meetings: "議事録", briefing: "準備", knowledge: "ナレッジ", actions: "実行", renewals: "契約・更新", reports: "レポート" }[screen]), [screen]);

  useEffect(() => {
    Promise.all([
      fetch("/api/meeting-summaries?status=draft", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/inbound-inquiries", { credentials: "include" }).then((r) => r.json()),
      fetch("/api/next-actions?status=open", { credentials: "include" }).then((r) => r.json()),
    ])
      .then(([summaries, inquiries, actions]) => {
        const pendingInquiries = (inquiries.inquiries ?? []).filter((i: { status: string }) => i.status !== "取引先化済み").length;
        setNavCounts({
          needsAttention: (summaries.summaries?.length ?? 0) + pendingInquiries,
          openActions: actions.actions?.length ?? 0,
        });
      })
      .catch(() => {});
  }, [screen]);

  useEffect(() => {
    if (!searchOpen || !searchQuery.trim()) { setSearchResults([]); return; }
    const timeout = setTimeout(() => {
      fetch(`/api/companies?q=${encodeURIComponent(searchQuery)}&limit=8`, { credentials: "include" })
        .then((r) => r.json())
        .then((data) => setSearchResults(data.companies ?? []))
        .catch(() => setSearchResults([]));
    }, 200);
    return () => clearTimeout(timeout);
  }, [searchQuery, searchOpen]);

  const primaryNavItems: { id: Screen; label: string; icon: typeof LayoutDashboard }[] = [
    { id: "accounts", label: "顧客", icon: Building2 },
    { id: "meetings", label: "議事録", icon: FileText },
  ];
  const secondaryNavItems: { id: Screen; label: string; icon: typeof LayoutDashboard; count?: number }[] = [
    { id: "overview", label: "自動化", icon: LayoutDashboard, count: navCounts.needsAttention },
    { id: "actions", label: "実行", icon: ListTodo, count: navCounts.openActions },
    { id: "inbounds", label: "問い合わせ", icon: Inbox },
    { id: "renewals", label: "契約・更新", icon: Building2 },
    { id: "briefing", label: "準備", icon: Sparkles },
    { id: "knowledge", label: "ナレッジ", icon: BookOpen },
    { id: "reports", label: "レポート", icon: BarChart3 },
  ];

  const jumpToCompany = (id: string) => {
    sessionStorage.setItem("relay:jumpToCompanyId", id);
    setSearchOpen(false);
    setSearchQuery("");
    selectScreen("accounts");
  };
  const renderScreen = () => {
    if (screen === "inbounds") return <InboundTriage onNavigate={selectScreen} />;
    if (screen === "accounts") return <AccountsWorkspace onNavigate={selectScreen} />;
    if (screen === "meetings") return <MeetingWorkbench onNavigate={selectScreen} />;
    if (screen === "briefing") return <MeetingBriefing />;
    if (screen === "knowledge") return <KnowledgeBase />;
    if (screen === "renewals") return <Renewals />;
    if (screen === "actions") return <ActionRunway onNavigate={selectScreen} />;
    if (screen === "reports") return <Suspense fallback={<p className="queue-empty">読み込み中...</p>}><Reports /></Suspense>;
    return <AutomationHub onNavigate={selectScreen} />;
  };
  const selectScreen = (id: Screen) => { window.history.replaceState({}, "", `?screen=${id}`); setScreen(id); setSidebarOpen(false); };
  return <div className="crm-app">
    <aside className={`sidebar ${sidebarOpen ? "open" : ""}`}>
      <div className="brand"><img src="/manus-storage/relay-mark_a7cdb14a.png" alt="Relay CRM" /><span>Relay <em>CRM</em></span><button className="mobile-close" onClick={() => setSidebarOpen(false)} aria-label="ナビゲーションを閉じる"><X size={19} /></button></div>
      <nav>
        <p className="nav-label">WORKSPACE</p>
        {primaryNavItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => selectScreen(item.id)}><Icon size={18} /><span>{item.label}</span></button>; })}
        <details className="nav-more">
          <summary>その他</summary>
          {secondaryNavItems.map((item) => { const Icon = item.icon; return <button key={item.id} className={screen === item.id ? "active" : ""} onClick={() => selectScreen(item.id)}><Icon size={18} /><span>{item.label}</span>{!!item.count && <b>{item.count}</b>}</button>; })}
        </details>
      </nav>
      <div className="sidebar-bottom"><button onClick={() => toast.info("ヘルプセンターを開きました")}><CircleHelp size={17} />ヘルプ</button><button className="profile" onClick={() => toast.info("プロフィール設定を開きました")}><MiniAvatar tone="ochre">瑞</MiniAvatar><span><b>佐々木 瑞希</b><small>営業企画</small></span><MoreHorizontal size={18} /></button></div>
    </aside>
    {sidebarOpen && <button aria-label="ナビゲーションを閉じる" className="mobile-overlay" onClick={() => setSidebarOpen(false)} />}
    <main className="main-area"><header className="topbar"><button className="mobile-menu" onClick={() => setSidebarOpen(true)} aria-label="ナビゲーションを開く"><Menu size={21} /></button><div className="breadcrumb"><span>ワークスペース</span><ChevronRight size={14} /><b>{activeName}</b></div><div className="top-actions"><button className="command-search" onClick={() => setSearchOpen(true)}><Search size={17} /><span>検索</span><kbd>⌘ K</kbd></button><button className="notification" onClick={() => toast.info("新しい通知はありません")} aria-label="通知"><Bell size={19} /><i /></button><button className="add-button" onClick={() => { selectScreen("meetings"); toast.info("議事録を貼り付けて処理を開始できます") }}><Plus size={17} /><span>議事録を処理</span></button></div></header><div className="workspace">{renderScreen()}</div></main>
    {searchOpen && <button aria-label="検索を閉じる" className="mobile-overlay" style={{ zIndex: 60 }} onClick={() => setSearchOpen(false)} />}
    {searchOpen && <div className="conversion-sheet" style={{ position: "fixed", top: 72, left: "50%", transform: "translateX(-50%)", width: "min(90vw, 440px)", zIndex: 61, background: "#fff", boxShadow: "0 12px 32px rgba(0,0,0,0.18)" }}>
      <label className="worklist-search"><Search size={16} /><input autoFocus aria-label="取引先を検索" placeholder="取引先名で検索" value={searchQuery} onChange={(e) => setSearchQuery(e.target.value)} /></label>
      <div style={{ marginTop: 8, maxHeight: 280, overflowY: "auto" }}>
        {searchResults.map((c) => <button key={c.id} className="context-link" style={{ display: "block", width: "100%", textAlign: "left", padding: "8px 4px" }} onClick={() => jumpToCompany(c.id)}>{c.name}<small style={{ marginLeft: 6, color: "#8a908a" }}>{c.category}</small></button>)}
        {searchQuery.trim() && searchResults.length === 0 && <p className="queue-empty">該当する取引先がありません。</p>}
      </div>
    </div>}
  </div>;
}
