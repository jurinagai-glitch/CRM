/**
 * Quiet Operations Desk: a meeting note is processed through source record → editable draft → confirmation context.
 */
import { Button } from "@/components/ui/button";
import { ArrowUpRight, BookOpen, Check, ChevronRight, Clock3, FileText, ListChecks, Plus, Sparkles, WandSparkles } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

type ScreenTarget = "overview" | "inbounds" | "accounts" | "meetings" | "briefing" | "knowledge" | "actions" | "renewals";

const noteQueue = [
  { id: "nexus", company: "ネクサス製作所", subject: "現場DX 基盤導入", time: "たった今", state: "入力済み" },
  { id: "evergreen", company: "エバーグリーン物流", subject: "配車業務の標準化", time: "昨日", state: "確認済み" },
  { id: "cloud", company: "クラウドリンク", subject: "営業生産性の改善", time: "8/12", state: "確認済み" },
];

function DraftTag({ children, tone = "neutral" }: { children: string; tone?: "neutral" | "moss" | "ochre" | "navy" }) {
  return <span className={`enterprise-status ${tone}`}>{children}</span>;
}

export default function MeetingWorkbench({ onNavigate }: { onNavigate: (screen: ScreenTarget) => void }) {
  const [selected, setSelected] = useState("nexus");
  const [generated, setGenerated] = useState(false);
  const current = noteQueue.find((note) => note.id === selected) ?? noteQueue[0];
  const generateDraft = () => { setGenerated(true); toast.success("確認用の下書きを作成しました。保存前に内容を確認してください。"); };
  return <section className="screen-page enterprise-workspace meeting-workspace">
    <header className="enterprise-page-head"><div><p className="eyebrow">MEETING NOTE · CONFIRMATION WORKBENCH</p><h1>議事録を、<br />確定できる次の行動へ。</h1><p>原文は残し、自動整理の結果は下書きとして確認してから商談に反映します。</p></div><div className="enterprise-head-actions"><span className="draft-policy">入力は保存前まで非公開</span><Button className="ink-button" onClick={() => toast.info("新しい議事録の入力欄を開きました")}><Plus size={16} />新しい議事録</Button></div></header>
    <div className="workflow-ribbon" aria-label="議事録の確認フロー"><span className="active">01 原文を記録</span><ChevronRight size={14} /><span className={generated ? "active" : ""}>02 下書きを確認</span><ChevronRight size={14} /><span>03 商談へ確定</span><ChevronRight size={14} /><span>04 アクションを実行</span></div>
    <div className="enterprise-shell meeting-shell">
      <aside className="worklist-column meeting-queue"><div className="worklist-head"><div><span className="eyebrow">NOTE INBOX</span><h2>議事録 <b>3</b></h2></div><button onClick={() => toast.info("議事録の表示条件を開きました")}><ListChecks size={18} /></button></div><div className="queue-summary"><span><b>1</b> 確認待ち</span><span><b>2</b> 今週確定</span></div><div className="note-rows">{noteQueue.map((note, index) => <button className={`note-row ${selected === note.id ? "selected" : ""}`} key={note.id} onClick={() => { setSelected(note.id); setGenerated(note.id !== "nexus"); }}><span>{String(index + 1).padStart(2, "0")}</span><div><b>{note.company}</b><small>{note.subject}</small><em>{note.time}</em></div><DraftTag tone={note.state === "入力済み" ? "ochre" : "moss"}>{note.state}</DraftTag><ChevronRight size={15} /></button>)}</div><section className="queue-policy"><BookOpen size={16} /><div><b>確認してから確定</b><p>自動抽出した内容は、確認・編集するまで商談情報に反映されません。</p></div></section></aside>
      <main className="decision-column source-column"><div className="source-meta"><span><FileText size={15} />{current.company}</span><ChevronRight size={14} /><b>商談：{current.subject}</b><span className="source-time"><Clock3 size={14} />本日 10:24</span></div><div className="source-head"><div><span className="eyebrow">SOURCE RECORD</span><h2>議事録原文</h2></div><span>テキスト貼り付け · 1,284文字</span></div><textarea className="note-source" aria-label="議事録原文" defaultValue={"現場ではExcelと紙の帳票が混在している。工場長は月末までに現場を含めた検討会を行いたいとのこと。\n\n課題：現場入力の二重化、集計に2日かかる\n予算：まずは月額50万円前後で検討\n決裁：工場長が起案、役員会で最終決定\n時期：10月から一部ラインで試行したい\n\n次回までに、他社事例と段階導入の比較ができる資料を見たい。現場向けの定着支援がどこまで含まれるかも確認したい。"} /><div className="source-footer"><span><Clock3 size={14} />最終編集：たった今</span><Button className="ink-button" onClick={generateDraft}><WandSparkles size={16} />{generated ? "下書きを更新" : "下書きをつくる"}</Button></div></main>
      <aside className={`draft-column ${generated ? "ready" : ""}`}><div className="draft-header"><div><span className="eyebrow">DRAFT · REVIEW REQUIRED</span><h2>確認用の下書き</h2></div><DraftTag tone={generated ? "ochre" : "neutral"}>{generated ? "確認待ち" : "入力待ち"}</DraftTag></div>{generated ? <div className="draft-body"><section><div className="draft-section-head"><span>01</span><h3>商談サマリ</h3><DraftTag tone="navy">下書き</DraftTag></div><p>現場入力の二重化を解消し、段階導入と定着支援を含めた提案を検討中。10月の一部ライン試行を目標としています。</p></section><section><div className="draft-section-head"><span>02</span><h3>決定・確認事項</h3></div><ul><li><Check size={14} />役員会用に比較資料を準備する</li><li><Check size={14} />定着支援の範囲を提案に含める</li></ul></section><section><div className="draft-section-head"><span>03</span><h3>次アクション候補</h3><DraftTag tone="ochre">要確認</DraftTag></div><div className="draft-action"><b>他社事例と段階導入の比較資料を送付</b><small>担当：佐々木　期限：8/14</small><button onClick={() => toast.info("原文の根拠箇所を表示しました")}>原文の根拠を見る <ArrowUpRight size={14} /></button></div></section><section className="unknown-section"><div className="draft-section-head"><span>04</span><h3>未確認の重要事項</h3></div><p>役員会の参加者、決裁条件、試行成功の判断基準は原文から確定できません。</p></section><div className="draft-confirm"><Button className="ink-button" onClick={() => { toast.success("確認済みの情報を商談と次アクションへ反映しました"); onNavigate("actions"); }}><Check size={16} />確認して商談へ反映</Button><button onClick={() => toast.info("下書きの編集モードを開きました")}>編集する</button></div></div> : <div className="draft-empty"><Sparkles size={24} /><b>原文をもとに、<br />確認できる下書きを作ります。</b><p>サマリ、決定事項、次アクション、未確認事項を原文の根拠と一緒に提示します。</p><button onClick={generateDraft}>下書きの形式を見る <ArrowUpRight size={15} /></button></div>}</aside>
    </div>
  </section>;
}
