# 待辦：各頁主視覺背景圖（交給 GPT 生成）

更新：2026-10-12。使用者決定每個內頁都要重新生成一張主視覺背景圖，由 GPT 生成後替換。這份是交接說明。

## 為什麼要換

目前內頁主視覺多半是工廠影片截圖（factory-*.jpg），解析度只有 1280／1600、偏冷灰、有點糊，跟首頁與各卡片採用的那組暖色情境圖風格不一致。首頁主視覺維持工廠影片，**不用換**。

## 風格（要跟現有那組情境圖一致）

參考原圖：`C:/Users/USER/.codex/.chatgpt-projects/g-p-6a72e24439588191a50aa0bc9bdf6dac/output/premium-redesign-v1/`（dosage-*.png、function-*.png），站上已用的高解析版：`assets/brand/home-capsules.jpg`、`home-powder.jpg`、`home-grapefruit.jpg`、`home-tablets.jpg`、`home-jelly-tea.jpg`。

- 米色、暖白、淺石材／亞麻質感的桌面，柔和自然側光，淡淡的植物陰影。
- 保健食品相關的靜物：膠囊、錠劑、粉末、玻璃器皿、原料、包材。依頁面主題選。
- 低彩度，金色系點綴；不要鮮豔或霓虹色，也不要藍綠冷調。
- **左半邊要留暗或留空**：主視覺文字疊在左側，會再壓深色漸層。主體放在畫面中間偏右。
- 不要文字、logo、浮水印、人臉特寫；不要把生成圖畫成「百達醫工廠實拍」或真實客戶產品。
- 不要任何療效暗示的畫面（例如醫療器材、病患），保健食品宣稱受《食品標示宣稱之認定基準》規範。

## 規格

- 橫式 16:9，至少 **2400×1350**（滿版主視覺在寬螢幕不能糊）。
- 輸出 JPG，品質約 82，單張 300KB 內為佳（可用 ffmpeg：`ffmpeg -i in.png -vf scale=2400:-2 -q:v 3 out.jpg`）。
- 檔名：`assets/brand/hero-<頁面代號>.jpg`（代號見下表）。

## 頁面清單與替換方式

改完要跑 `node scripts/build-site.js`，再跑 `node scripts/check-links.js`（失效 0 筆才算完成）。

**A. 後台管理的頁面**：主視覺是 `data-cms-img="主視覺｜背景圖"`。**改 `content/pages/<id>.md` 裡「主視覺 → 背景圖」的路徑，不要直接改 HTML**，否則下次建置會被內容檔蓋回去。建置會順便更新該頁的 og:image。

| 代號 | 頁面 | 內容檔 | 目前圖 | 主題建議 |
|---|---|---|---|---|
| process | 合作流程 `全面性服務/一站式服務/` | content/pages/process.md | factory-packaging.jpg | 打樣與包材並列的工作桌 |
| catalogue | 劑型與包材 `全面性服務/劑型與包材/` | content/pages/catalogue.md | factory-capsules.jpg | 各種劑型與包材排列 |
| functions | 功能配方 `全面性服務/功能配方/` | content/pages/functions.md | factory-powder.jpg | 植物原料、粉末、萃取 |
| capsules | 動／植物膠囊 `全面性服務/一站式服務/多元劑型-膠囊/` | content/pages/capsules.md | factory-filling.jpg | 兩種膠囊對照 |
| quality | 研發、品質與認證 `研發科技/` | content/pages/quality.md | factory-coating.jpg | 實驗室玻璃器皿、量測 |
| about | 關於百達醫 `認識百達醫/關於百達醫/` | content/pages/about.md | factory-cleanroom.jpg | 沉穩的品牌靜物 |
| esg | 綠色永續 `認識百達醫/綠色永續/` | content/pages/esg.md | RENEWABLE-ENERGY.jpg | 植物、自然光、永續素材 |

**B. 直接寫在 HTML 的頁面**（沒有接後台）：改該頁 `<div class="…-hero-media">` 裡 `<img src>`；若有 `og:image` 也一起改。

| 代號 | 頁面 | 目前圖 | 主題建議 |
|---|---|---|---|
| capability | 能做什麼 `全面性服務/index.html`（`.cap-hero-media`） | factory-packaging.jpg | 原料、劑型、包材一起出現 |
| ingredients | 原料成分 `全面性服務/原料成分/index.html` | factory-powder.jpg | 多種原料分格陳列 |

**C. 由建置產生的樣式頁**（12 頁：錠劑、膠囊、各種瓶袋）：主視覺在 `content/catalogue/<名稱>.md` 的 `hero` 欄位，改那裡再建置。可以每頁一張，或依類別共用（膠囊類、錠劑、瓶器、鋁袋）。

**不用換**：首頁（工廠影片）、最新消息列表與文章頁、代工諮詢、機能食品保健（這幾頁沒有背景圖）、功能配方各方向頁（主視覺是卡片圖 function-*.jpg，不是滿版背景）。

## 完成檢查

- 每頁主視覺左側文字清楚可讀（白字在深色漸層上）。
- 手機寬度（390px）主體沒有被裁掉。
- `node scripts/check-links.js` 失效 0 筆；首頁提案頁（home-v*.html）不受影響。
