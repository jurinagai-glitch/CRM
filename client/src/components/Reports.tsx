/**
 * Quiet Operations Desk: aggregate view of pipeline, meeting cadence, and inbound funnel.
 * Wired to /api/reports/summary.
 */
import { CircleAlert, ListTodo } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type Summary = {
  deals_by_stage: { stage: string; count: number; amount_sum: string }[];
  meetings_by_month: { month: string; count: number }[];
  companies_by_category: { category: string; count: number }[];
  inbound_by_status: { status: string; count: number }[];
  actions: { open_count: number; overdue_count: number };
};

function Card({ title, eyebrow, children }: { title: string; eyebrow: string; children: React.ReactNode }) {
  return <section className="context-card" style={{ minWidth: 0 }}>
    <div className="context-heading"><div><span className="eyebrow">{eyebrow}</span><h3>{title}</h3></div></div>
    {children}
  </section>;
}

export default function Reports() {
  const [summary, setSummary] = useState<Summary | null>(null);

  useEffect(() => {
    fetch("/api/reports/summary", { credentials: "include" })
      .then((r) => r.json())
      .then((data) => setSummary(data))
      .catch(() => toast.error("レポートの取得に失敗しました"));
  }, []);

  if (!summary) return <section className="screen-page"><p className="queue-empty">読み込み中...</p></section>;

  return <section className="screen-page">
    <header className="enterprise-page-head"><div><p className="eyebrow">REPORTS · PIPELINE OVERVIEW</p><h1>数字で、<br />今の状況を確認する。</h1><p>商談・議事録・問い合わせの実データから、現在地を可視化します。</p></div></header>
    <div className="enterprise-shell" style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(320px, 1fr))", gap: 16 }}>
      <Card eyebrow="DEALS" title="ステージ別の進行中商談">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={summary.deals_by_stage}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="stage" fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip formatter={(value: number, name: string) => [value, name === "count" ? "件数" : name]} />
            <Bar dataKey="count" fill="#8a7358" name="件数" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card eyebrow="MEETINGS" title="月別の商談・議事録件数">
        <ResponsiveContainer width="100%" height={220}>
          <BarChart data={summary.meetings_by_month}>
            <CartesianGrid strokeDasharray="3 3" />
            <XAxis dataKey="month" fontSize={12} />
            <YAxis allowDecimals={false} fontSize={12} />
            <Tooltip />
            <Bar dataKey="count" fill="#4b5f52" name="件数" />
          </BarChart>
        </ResponsiveContainer>
      </Card>

      <Card eyebrow="ACCOUNTS" title="区分別の取引先数">
        <div className="action-table" style={{ marginTop: 8 }}>
          {summary.companies_by_category.map((row) => <div className="match-line" key={row.category}><span>{row.category}</span><b>{row.count}社</b></div>)}
        </div>
      </Card>

      <Card eyebrow="INBOUND" title="問い合わせのステータス内訳">
        <div className="action-table" style={{ marginTop: 8 }}>
          {summary.inbound_by_status.map((row) => <div className="match-line" key={row.status}><span>{row.status}</span><b>{row.count}件</b></div>)}
        </div>
      </Card>

      <Card eyebrow="EXECUTION" title="次アクションの状況">
        <div className="execution-check" style={{ marginTop: 8 }}>
          <span><ListTodo size={16} />未完了：{summary.actions.open_count}件</span>
          <span><CircleAlert size={16} />期限超過：{summary.actions.overdue_count}件</span>
        </div>
      </Card>
    </div>
  </section>;
}
