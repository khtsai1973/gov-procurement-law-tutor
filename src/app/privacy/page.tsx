import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "隱私權政策｜政府採購法互動教學",
  description:
    "說明本站蒐集之個人資料、使用目的、保存期限、刪除方式、角色權限、第三方 AI 與資安措施。",
};

/** 公開靜態頁：不連 DB，利於快取與搜尋引擎索引 */
export const revalidate = 86400;

const CONTACT_EMAIL = "khtsai1973@gmail.com";
const UPDATED_AT = "2026-08-10";

export default function PrivacyPage() {
  return (
    <section className="mx-auto max-w-3xl space-y-6">
      <div className="rounded-xl border border-[var(--border)] bg-[var(--card)] p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-xs text-[var(--muted)]">法律資訊</p>
            <h1 className="mt-1 text-xl font-semibold">隱私權政策</h1>
            <p className="mt-2 text-sm leading-relaxed text-[var(--muted)]">
              本站「政府採購法互動教學」使用 Google 帳號登入，並保存提問、模擬考試與弱點分析等學習紀錄。以下依個人資料保護法精神，說明資料如何蒐集、使用與保護。
            </p>
            <p className="mt-2 text-xs text-[var(--muted)]">最近更新日期：{UPDATED_AT}</p>
          </div>
          <Link href="/" className="text-sm no-underline hover:underline">
            ← 回到首頁
          </Link>
        </div>

        <div className="mt-8 space-y-8 text-sm leading-relaxed">
          <PolicySection title="1. 蒐集的資料">
            <ul className="list-disc space-y-1.5 pl-5 text-[var(--fg)]">
              <li>
                <span className="font-medium">帳號識別資料：</span>
                經 Google 登入取得之姓名、電子郵件、大頭照 URL（若 Google
                提供），以及本站指派之使用者代號與角色（一般使用者／老師／管理者）。
              </li>
              <li>
                <span className="font-medium">註冊申請資料：</span>
                申請加入時填寫之信箱、欲申請角色、備註，以及審核狀態與審核備註。
              </li>
              <li>
                <span className="font-medium">學習與互動紀錄：</span>
                提問內容、系統回答、參考來源摘要、滿意度回饋；模擬考試作答、正誤、補充說明、錯題診斷與弱點／知識標籤分析結果；可選暱稱。
              </li>
              <li>
                <span className="font-medium">教學內容（老師）：</span>
                老師製作之單元教材、審核狀態與修正紀錄（屬職務／教學資料，可能含作者識別）。
              </li>
              <li>
                <span className="font-medium">技術紀錄：</span>
                為維運與資安所需之連線時間、錯誤日誌（儘量去識別或遮罩個資）。
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="2. 使用目的">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>提供法規／函釋問答、題庫練習、模擬考試與學習診斷服務。</li>
              <li>維護登入身分、角色權限與註冊審核流程。</li>
              <li>改善回答品質（含滿意度統計）與系統效能、資安防護。</li>
              <li>
                老師／管理者於權限範圍內檢視學習成效（老師儀表板以匿名彙總為原則，避免輸出可直接識別之個資）。
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="3. 保存期限">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                帳號與學習紀錄：於您持續使用本站期間保存；停用或刪除帳號後，於合理作業期間內停止利用並刪除或去識別化，法令另有規定者依其規定。
              </li>
              <li>註冊申請：審核完成後仍可能保留審核軌跡，供爭議處理與稽核。</li>
              <li>系統備份：可能於備援週期內短暫留存，期滿後覆蓋或銷毀。</li>
            </ul>
          </PolicySection>

          <PolicySection title="4. 刪除方式">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                您可至「我的提問紀錄」檢視本人提問；若需刪除帳號、考試紀錄或特定提問，請以下方聯絡窗口提出，並以註冊／登入之同一
                Google 信箱說明需求。
              </li>
              <li>
                管理者於確認身分後，將於合理期間內處理刪除或去識別化；與法令保存義務衝突之資料得改為停止利用。
              </li>
              <li>
                老師可刪除本人建立之教材；題庫管理權限內之題目刪除依角色設定辦理。
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="5. 教師及管理者權限">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                <span className="font-medium">一般使用者：</span>
                使用問答、題庫、模擬考試；僅能存取本人學習相關資料。
              </li>
              <li>
                <span className="font-medium">老師：</span>
                製作／審核單元教材、檢視題庫（依功能開放）、檢視全體或指定範圍之學習統計；統計頁面以匿名彙總為設計原則。
              </li>
              <li>
                <span className="font-medium">管理者：</span>
                審核註冊申請、調整使用者角色、維護知識庫與系統設定，並得處理個資當事人請求。
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="6. 第三方 AI 服務">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>
                本站可能將您的提問與檢索自知識庫之法規／函釋片段，傳送至第三方大型語言模型服務（例如
                OpenAI）以產生回答、錯題診斷或教材草稿。
              </li>
              <li>
                傳送內容以完成本站教學功能為限；請勿在提問中輸入與學習無關之敏感個資（如身分證字號、金融帳號、健康資料等）。
              </li>
              <li>
                第三方服務之處理受其服務條款與隱私權政策拘束；本站並得視設定改為僅回傳知識庫摘錄而不呼叫外部模型。
              </li>
              <li>
                身分驗證使用 Google 登入；託管與資料庫可能使用 Vercel、Neon
                等雲端服務。
              </li>
            </ul>
          </PolicySection>

          <PolicySection title="7. 資安保護措施">
            <ul className="list-disc space-y-1.5 pl-5">
              <li>傳輸採 HTTPS；正式環境透過雲端平台與資料庫存取控制管理。</li>
              <li>依角色授權存取功能；敏感操作有來源檢查與頻率限制。</li>
              <li>日誌與教師統計介面儘量遮罩或避免顯示完整可識別個資。</li>
              <li>知識庫回答範圍限於已匯入之法規／函釋，降低不當外洩業務機密之風險。</li>
            </ul>
          </PolicySection>

          <PolicySection title="8. 聯絡窗口">
            <p>
              關於個人資料查詢、閱覽、製給複製本、補充更正、停止蒐集處理利用或刪除等請求，請以註冊／登入使用之
              Google 信箱來信：
            </p>
            <p className="mt-2">
              <a
                href={`mailto:${CONTACT_EMAIL}?subject=${encodeURIComponent("隱私權／個資請求｜政府採購法互動教學")}`}
                className="font-medium text-[var(--accent)] no-underline hover:underline"
              >
                {CONTACT_EMAIL}
              </a>
            </p>
            <p className="mt-2 text-[var(--muted)]">
              來信請註明：請求類型、登入信箱、以及可協助確認身分之說明。我們將於合理期間內回覆處理情形。
            </p>
          </PolicySection>

          <div className="rounded-md border border-[var(--border)] bg-slate-50/80 px-3 py-3 text-xs text-[var(--muted)]">
            本政策得因法規或服務調整而更新；重大變更時，將於本頁更新「最近更新日期」。繼續使用本站即表示您已瞭解更新後之內容。若您不同意，請停止使用並依上方窗口請求刪除資料。
          </div>
        </div>
      </div>
    </section>
  );
}

function PolicySection({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="text-base font-semibold text-[var(--fg)]">{title}</h2>
      <div className="mt-2 text-[var(--fg)]/90">{children}</div>
    </section>
  );
}
