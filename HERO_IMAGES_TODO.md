# 待辦：各頁主視覺背景圖（交給 GPT 生成）

更新：2026-10-12。使用者決定每個內頁都要重新生成一張主視覺背景圖，由 GPT 生成後替換。這份是交接說明。

## 最新方向優先於下方早期規劃

- 2026-10-16 試看回饋：大滾筒（能做什麼）可保留；合作流程、品質、關於三張使用者認為不清楚、AI感重，重新列為待調整，不算核可成品。四張原生皆 1672×941，1920px 螢幕已有放大；同時存在重繪材質過平滑的問題，不能把插值放大或銳化說成原生高解析度修復。其餘三張先保留試看狀態，重新生成前要逐張確認真實設備結構與材質。
- 品質 v2 小樣已用內建 imagegen 重試，仍是 1672×941；材質較清楚但不是解析度修復，未替換正式站。候選、完整提示詞在 `../outputs/news-polish-20261016/hero-quality-v2-candidate.png`、`quality-v2-prompt.txt`。下一輪勿把這張誤當成已核可／已上線。

- 2026-10-16 最新：使用者要求以首頁影片逐鏡分配內頁，再參考實際鏡頭重新生成；分鏡見 `../outputs/hero-corporate-20261016/VIDEO_SCENE_PLAN.md`，原圖／生成對照見同資料夾 `REVIEW.md`。四張已依「先丟上去看看」要求套入能做什麼／合作流程／品質／關於四頁，並以 `48d4269`、`8c59a26` 發布供試看；不是最終設計定案。原生 1672×941，網頁 JPEG 未放大，完整提示詞在 `video-hero-prompts.json`，發布與驗證見 `RELEASE.md`。
- 2026-10-16 的琥珀膠囊＋金蓋瓶＋紙盒桌面打樣兩稿已被使用者否定，不能代表「能做什麼」的一站式服務；也不繼續按先前專案板／抽象企業材質構圖生成。

- 使用者否定憑空生成的整批情境圖「方向不對、好假」。不要按下方道具／量測建議繼續批量生成，不推送舊候選。
- 已盤點 `C:/Users/USER/OneDrive/桌面/官網/所有素材`：224 張不重複可解碼圖片。使用者確認沒有工作照，改以產品原圖作影像參考。
- 「劑型與包材」十顆斑點錠劑排裝＋透明銀蓋空瓶 A／B 小樣已被使用者否定：選材與搭配呈藥品規格目錄感。`hero-catalogue-productref-a.jpg`、`hero-catalogue-productref-b.jpg` 標成 rejected，從可選候選排除，僅保留歷史；正式頁未換圖。
- 使用者核可下一步先看原始產品照片的選材與構圖提案，再生成少量小樣。不要把「可以用產品參考」理解成任何規格照都適合企業主視覺；單一膠囊／包材只對應相關專頁，不代表一站式服務。
- 最新選材提案在 `../outputs/material-audit-20261012/選材提案.md`：琥珀／乳白膠囊與鋁袋封邊兩個窄主題。未生成、未核可設計、未套進正式頁。
- 比較入口：`scripts/hero-preview.html?page=catalogue`；圖片與主視覺版面可獨立切換。舊批量候選已排除，檔案保留。
- 盤點與提示詞：`../outputs/material-audit-20261012/素材盤點.md`、`PRODUCT-REFERENCE.md`。生成產品參考仍可能改變細節；不稱為原圖直接合成，不用來證明精確規格。
- 原生 1672×941，網頁尺寸匯出 2400×1350；小樣尚未推送／部署。目前新圖候選可用 0／42，正式新圖未完成。

## 2026-10-12 試作狀態

- 「能做什麼」已改用新生成協作情境 `assets/brand/hero-capability-collaboration.jpg`：兩人共同確認同一產品開發方案，計畫／打樣／空白包材僅作輔助線索。使用者核可方向；已套入本機，未推送。舊粉末試版 `hero-capability.jpg` 已撤下，僅保留原檔。
- 第一稿的原料／膠囊／瓶袋／外盒大集合已被否定；第二稿改為單一主體、材質、光影與留白，勿繼續用道具清單當主視覺。
- 第二稿生成原圖為 1672×941，JPEG 以等比例匯出 2400×1350；不可誤記為原生高解析度生成，後續正式品質仍需確認。
- 協作版同樣原生 1672×941，尺寸匯出 2400×1350 JPEG（208,648 bytes），不是原生高解析度。原圖、最終提示詞與編碼資訊見 `../outputs/hero-capability-20261012/COLLABORATION.md`。
- 協作版已檢查 1920／1440／768／390／360px 的載入、裁切與頁籤切換；46 項測試通過，87 頁連結／資源失效 0。手機規則僅作用於有 `data-generated-hero="capability"` 的正式頁主視覺。
- 已抽樣盤點使用者提供的 `C:/Users/USER/OneDrive/桌面/影片` 八支影片，含四支 4K HEVC 製程原片；先作製程／品質素材候選，不自動替換背景。
- 生成提示詞、原圖、檢查與影片縮圖紀錄：`../outputs/hero-capability-20261012/`。首頁、其他內頁及提案頁未更動。

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
| capability | 能做什麼 `全面性服務/index.html`（`.cap-hero-media`） | hero-capability-collaboration.jpg（本機已換） | 共同確認單一產品開發方案；保留協作動作，不做道具清單 |
| ingredients | 原料成分 `全面性服務/原料成分/index.html` | factory-powder.jpg | 多種原料分格陳列 |

**C. 由建置產生的樣式頁**（12 頁：錠劑、膠囊、各種瓶袋）：主視覺在 `content/catalogue/<名稱>.md` 的 `hero` 欄位，改那裡再建置。可以每頁一張，或依類別共用（膠囊類、錠劑、瓶器、鋁袋）。

**不用換**：首頁（工廠影片）、最新消息列表與文章頁、代工諮詢、機能食品保健（這幾頁沒有背景圖）、功能配方各方向頁（主視覺是卡片圖 function-*.jpg，不是滿版背景）。

## 完成檢查

- 每頁主視覺左側文字清楚可讀（白字在深色漸層上）。
- 手機寬度（390px）主體沒有被裁掉。
- `node scripts/check-links.js` 失效 0 筆；首頁提案頁（home-v*.html）不受影響。
