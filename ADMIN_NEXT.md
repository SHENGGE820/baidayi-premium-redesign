# 百達醫自刻後台（開發中）

`admin-next/` 是用來取代 Sveltia CMS 的下一代後台，目前是本機開發預覽，尚未連接正式登入與發布 API。

## 本機預覽

1. 執行 `npm run build:admin-data`，把現有 `content/` 轉成後台可讀的 `admin-next/data.json`。
2. 從專案根目錄啟動靜態伺服器。
3. 開啟 `/admin-next/`。

## 目前邊界

- 顯示的文章、網站頁面、功能配方、劑型包材、媒體與公司資訊皆來自現有 `content/`。
- 新文章使用 `body_blocks` 結構化區塊；可編輯標題、段落、圖片、影片、引言與清單，並以安全白名單渲染。
- 既有 12 篇 WordPress 文章仍保留 `body_html` 作相容輸入；後台只讀預覽，不再開放直接修改 HTML。自動遷移完成內容／媒體等值檢查前不會刪除原始欄位。
- 「儲存草稿」只保存於目前瀏覽器，不會修改 GitHub，也不會發布正式網站。
- 正式發布按鈕在 API 完成前保持停用。
- GitHub Pages 部署流程明確排除 `admin-next/`，避免未受保護的開發版被公開。

## 下一階段

1. 以 GitHub App 或受保護的 serverless API 取代瀏覽器內的 repository token。
2. 建立草稿分支、預覽建置與明確的發布動作。
3. 將頁面內容改為穩定的結構化 schema，不再從 HTML 的 `data-cms` 標籤反向產生表單。
4. 依 `body_blocks` schema 遷移舊文章，逐篇比對文字、標題／清單層級、圖片、影片與替代文字後，再移除 `body_html` 回退。
5. 完成角色權限、版本差異、還原、媒體上傳與圖片焦點／裁切。
