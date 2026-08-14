/**
 * Quiet Operations Desk v2: renewal signals, duplicate-review evidence, and related-deal context.
 */
import { Button } from "@/components/ui/button";
import { ArrowUpRight, Building2, ChevronDown, ChevronRight, Inbox, Plus, Sparkles } from "lucide-react";
import { toast } from "sonner";

type Tone = "navy" | "moss" | "ochre";

function Pill({ children, tone = "neutral" }: { children: string; tone?: "neutral" | Tone }) {
  return <span className={`status-pill ${tone}`}>{children}</span>;
}

function Avatar({ children, tone }: { children: string; tone: "moss" | "stone" }) {
  return <span className={`mini-avatar ${tone}`}>{children}</span>;
}

export default function Renewals() {
  const renewals: { company: string; plan: string; date: string; revenue: string; health: string; tone: Tone; detail: string }[] = [
    { company: "ネクサス製作所", plan: "現場DX 基盤導入", date: "8/22", revenue: "¥480k", health: "要確認", tone: "ochre", detail: "役員会前。利用部門の合意を確認" },
    { company: "エバーグリーン物流", plan: "配車業務の標準化", date: "9/05", revenue: "¥350k", health: "安定", tone: "moss", detail: "前月の利用レビューを完了" },
    { company: "クラウドリンク", plan: "営業生産性の改善", date: "9/12", revenue: "¥680k", health: "確認中", tone: "navy", detail: "更新条件の確認待ち" },
    { company: "アトリエ東雲", plan: "顧客管理の再設計", date: "9/20", revenue: "¥220k", health: "安定", tone: "moss", detail: "担当者へ更新案内を送付済み" },
  ];

  return <section className="screen-page renewals-page">
    <div className="page-heading"><div><p className="eyebrow">RENEWAL & DATA QUALITY</p><h1>継続を、<br />見落とさない。</h1><p>契約更新の節目と、顧客情報の確認待ちを同じ判断面で扱います。</p></div><Button className="ink-button" onClick={() => toast.success("更新アクションを追加しました")}><Plus size={16} />更新アクションを追加</Button></div>
    <div className="renewal-figures" aria-label="更新状況の要約"><div><span>90日以内の更新</span><b>4 <small>社</small></b><i>最短 8/22</i></div><div><span>継続見込み月額</span><b>¥1.73M</b><i>契約中の対象分</i></div><div><span>確認が必要な情報</span><b>3 <small>件</small></b><i>重複候補・更新条件</i></div></div>
    <div className="renewal-layout">
      <section className="paper-panel renewal-ledger"><div className="renewal-ledger-head"><div><p className="eyebrow">UPCOMING RENEWALS</p><h2>更新時期が近い取引先</h2></div><button className="text-action" onClick={() => toast.info("期限順で並べ替えました")}>期限順 <ChevronDown size={14} /></button></div><div className="renewal-list">{renewals.map((renewal, index) => <button className="renewal-row" key={renewal.company} onClick={() => toast.info(`${renewal.company} の更新詳細を開きました`)}><span className={`renewal-seq ${renewal.tone}`}>{String(index + 1).padStart(2, "0")}</span><span className="renewal-name"><b>{renewal.company}</b><small>{renewal.plan}</small><em>{renewal.detail}</em></span><span className="renewal-revenue"><small>月額</small><b>{renewal.revenue}</b></span><span className="renewal-date"><small>更新予定</small><b>{renewal.date}</b></span><Pill tone={renewal.tone}>{renewal.health}</Pill><ChevronRight size={16} /></button>)}</div></section>
      <aside className="quality-notes"><section className="quality-card duplicate-card"><div className="quality-head"><span><Building2 size={16} />データ品質</span><Pill tone="ochre">確認 1</Pill></div><p className="quality-caption">統合は自動実行せず、根拠を見てから判断します。</p><div className="duplicate-pair"><div><Avatar tone="moss">E</Avatar><span><b>エバーグリーン物流</b><small>evergreen-logi.jp</small></span></div><div><Avatar tone="stone">E</Avatar><span><b>EG物流株式会社</b><small>evergreen-logi.jp</small></span></div></div><div className="match-reasons"><span>同一ドメイン</span><span>会社名が近似</span></div><button className="quality-link" onClick={() => toast.info("統合候補を確認しました。確定前に履歴と担当者を確認します。")}>統合候補を確認する <ArrowUpRight size={15} /></button></section><section className="quality-card source-card"><div className="quality-head"><span><Inbox size={16} />受信データの扱い</span><Pill>手動登録</Pill></div><p>メール連携では、取込元・外部ID・除外理由を残し、元メールはCRMから削除しない設計です。</p><button className="quality-link" onClick={() => toast.info("メール同期の設計メモを開きました")}>同期設計を見る <ArrowUpRight size={15} /></button></section></aside>
    </div>
    <section className="similar-ledger"><div className="similar-ledger-head"><div><p className="eyebrow">RELATED PAST DEALS</p><h2>更新提案の前に、似た経緯を参照する</h2></div><span>参考候補は確定判断ではありません</span></div><div className="similar-grid"><article><div className="similar-badge"><Sparkles size={15} />類似の成功商談</div><h3>北辰エンジニアリング</h3><p>現場ごとの入力負荷を起点に、段階導入と月次レビューを提案して継続につながりました。</p><div className="similar-reasons"><span>製造業</span><span>二重入力</span><span>工場長が起案</span></div><button onClick={() => toast.info("北辰エンジニアリングの商談履歴を開きました")}>根拠を確認する <ArrowUpRight size={15} /></button></article><article className="method-note"><p className="eyebrow">RECOMMENDATION RULE</p><h3>似ている理由を、先に見せる。</h3><p>候補は業種・課題・決裁構造などの一致理由と一緒に出します。根拠が薄い候補は表示せず、営業担当者が判断を保留できます。</p><small>将来の意味検索でも、出典と一致理由を保持する前提です。</small></article></div></section>
  </section>;
}
