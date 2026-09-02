/* Generates one ingredient page per 功能配方 category.
 *
 * The ingredient data below is PLACEHOLDER content for layout review. The
 * ingredient names are real and commonly used in the category, so the pages
 * look realistic, but the descriptions deliberately state only what a material
 * IS — its source and form — and make no efficacy or health claim. Nothing
 * here has been checked against 認定基準準則 and none of it should ship as
 * customer-facing copy until the client supplies the real text.
 *
 * Re-run after editing:  node scripts/build-ingredient-pages.js
 */
const fs = require('fs');
const path = require('path');

const V = '20260901-14';

const categories = [
  { slug: 'beauty', en: 'SKIN MAINTENANCE', zh: '養顏美容',
    lead: '客群對成分名稱熟悉度高，差異化多半落在來源、規格與每日服用的體驗。',
    items: [
      // The one ingredient the client had already published, with their own
      // photo. Everything after it is placeholder.
      ['ICE CRYSTAL TOMATO', '冰晶番茄', '百達醫官網既有品項，果實原料。', '果實原料',
        '../../../wp-content/uploads/2026/08/冰晶番茄-695x1030.png'],
      ['COLLAGEN PEPTIDE', '膠原蛋白胜肽', '水解型小分子胜肽，常見來源為魚鱗或魚皮。', '粉末｜水解'],
      ['GLUTATHIONE', '穀胱甘肽', '由酵母發酵取得的三肽成分。', '粉末｜發酵'],
      ['VITAMIN C', '維生素 C', '抗壞血酸，可選用一般型或緩釋型。', '粉末｜結晶'],
      ['CERAMIDE', '神經醯胺', '常見自米糠或小麥萃取的醣脂質。', '粉末｜植物萃取'],
      ['HYALURONIC ACID', '玻尿酸', '發酵法製得的多醣體，有不同分子量規格。', '粉末｜發酵'],
      ['RESVERATROL', '白藜蘆醇', '多取自虎杖或葡萄皮的多酚類。', '粉末｜植物萃取'],
    ] },
  { slug: 'secret-garden', en: 'SECRET GARDEN', zh: '秘密花園',
    lead: '以私密照護為訴求的配方方向，選料著重菌株規格與酸鹼耐受性。',
    items: [
      ['CRANBERRY', '蔓越莓萃取', '含原花青素（PACs）的果實萃取，規格以 PACs 含量標示。', '粉末｜果實萃取'],
      ['LACTOBACILLUS', '鼠李糖乳桿菌', '常用於私密保健的菌株，以 CFU 標示活菌數。', '粉末｜益生菌'],
      ['ROSELLE', '洛神花萃取', '取自洛神花萼片的植物萃取。', '粉末｜植物萃取'],
      ['EVENING PRIMROSE', '月見草油', '富含 GLA 的植物油脂，多以軟膠囊呈現。', '油脂｜冷壓'],
    ] },
  { slug: 'metabolism', en: 'BOOST METABOLISM', zh: '促進新陳代謝',
    lead: '常與運動、體重管理型產品搭配，需留意刺激性成分的劑量規劃。',
    items: [
      ['GREEN TEA', '綠茶兒茶素', '以 EGCG 含量標示規格的茶葉萃取。', '粉末｜植物萃取'],
      ['L-CARNITINE', 'L-肉鹼', '常見為酒石酸鹽型式，水溶性佳。', '粉末｜胺基酸衍生'],
      ['GARCINIA', '藤黃果萃取', '以 HCA 含量標示的果實萃取。', '粉末｜果實萃取'],
      ['CHROMIUM', '鉻酵母', '以酵母為載體的微量礦物質。', '粉末｜酵母'],
      ['CAPSAICIN', '辣椒萃取', '取自辣椒果實，需注意風味與刺激性。', '粉末｜植物萃取'],
    ] },
  { slug: 'protein', en: 'PROTEIN SUPPLEMENT', zh: '蛋白補給',
    lead: '風味與沖泡性是體驗關鍵，蛋白來源也直接影響素食可用性。',
    items: [
      ['WHEY PROTEIN', '乳清蛋白', '乳製品來源，有濃縮與分離兩種規格。', '粉末｜乳源'],
      ['SOY PROTEIN', '大豆分離蛋白', '植物性蛋白，適用素食配方。', '粉末｜植物'],
      ['PEA PROTEIN', '豌豆蛋白', '低致敏植物蛋白，風味需另行調整。', '粉末｜植物'],
      ['BCAA', '支鏈胺基酸', '白胺酸、異白胺酸與纈胺酸的組合。', '粉末｜胺基酸'],
      ['GLUTAMINE', '麩醯胺酸', '游離型胺基酸，常見於運動配方。', '粉末｜胺基酸'],
    ] },
  { slug: 'body-functions', en: 'SUPPORT BODY FUNCTIONS', zh: '調節生理機能',
    lead: '基礎營養素為主的配方方向，重點在劑量搭配與錠劑體積控制。',
    items: [
      ['VITAMIN B COMPLEX', '維生素 B 群', '涵蓋 B1、B2、B6、B12 與菸鹼醯胺等。', '粉末｜複方'],
      ['ZINC YEAST', '鋅酵母', '以酵母為載體的微量礦物質。', '粉末｜酵母'],
      ['COENZYME Q10', '輔酶 Q10', '有一般型與還原型（泛醇）兩種規格。', '粉末／油脂'],
      ['TAURINE', '牛磺酸', '游離型含硫胺基酸，水溶性佳。', '粉末｜胺基酸'],
    ] },
  { slug: 'energetic', en: 'HIGHLY ENERGETIC', zh: '精神旺盛',
    lead: '需明確規劃咖啡因總量，並考量與其他提神成分的疊加。',
    items: [
      ['GUARANA', '瓜拿納萃取', '天然含咖啡因的果實萃取。', '粉末｜果實萃取'],
      ['GINSENG', '人參萃取', '以人參皂苷含量標示規格。', '粉末｜根部萃取'],
      ['VITAMIN B12', '維生素 B12', '氰鈷胺或甲鈷胺型式。', '粉末｜結晶'],
      ['RHODIOLA', '紅景天萃取', '以紅景天苷標示規格的根部萃取。', '粉末｜根部萃取'],
    ] },
  { slug: 'gut', en: 'MAINTAIN GUT HEALTH', zh: '維持腸道機能',
    lead: '菌株專利、活菌數與包埋技術是這個方向最主要的規格差異。',
    items: [
      ['PROBIOTICS', '益生菌複方', '多菌株組合，以 CFU 標示並注意保存條件。', '粉末｜益生菌'],
      ['INULIN', '菊苣纖維', '取自菊苣根的水溶性膳食纖維。', '粉末｜膳食纖維'],
      ['PSYLLIUM', '洋車前子殼', '高吸水性的膳食纖維原料。', '粉末｜膳食纖維'],
      ['POSTBIOTICS', '後生元', '菌體經滅活處理後的代謝產物。', '粉末｜發酵'],
      ['XOS', '木寡糖', '常與益生菌搭配的寡醣類。', '粉末｜寡醣'],
    ] },
  { slug: 'generation-3c', en: '3C GENERATION', zh: '3C 世代',
    lead: '葉黃素的游離型與酯化型規格差異，是這個方向最常被詢問的問題。',
    items: [
      ['LUTEIN', '葉黃素', '多萃取自金盞花，分游離型與酯化型。', '粉末／油脂'],
      ['ZEAXANTHIN', '玉米黃素', '常與葉黃素以固定比例搭配。', '粉末｜植物萃取'],
      ['BILBERRY', '山桑子萃取', '以花青素含量標示規格。', '粉末｜果實萃取'],
      ['ASTAXANTHIN', '蝦紅素', '多來自雨生紅球藻的類胡蘿蔔素。', '油脂｜藻類'],
      ['DHA', '藻油 DHA', '植物性來源的 omega-3 脂肪酸。', '油脂｜藻類'],
    ] },
  { slug: 'balance', en: 'BALANCE BODY CONDITION', zh: '調節體質',
    lead: '多為真菌與植物萃取，需特別留意原料的來源證明與重金屬檢驗。',
    items: [
      ['ANTRODIA', '樟芝', '台灣特有真菌，以三萜類標示規格。', '粉末｜菌絲體'],
      ['REISHI', '靈芝萃取', '以多醣體含量標示規格。', '粉末｜子實體萃取'],
      ['ELDERBERRY', '接骨木莓', '含花青素的果實萃取。', '粉末｜果實萃取'],
      ['VITAMIN D3', '維生素 D3', '有羊毛脂與地衣兩種來源可選。', '粉末／油脂'],
    ] },
  { slug: 'action', en: 'KEY TO ACTION', zh: '行動關鍵',
    lead: '劑量普遍偏高，錠劑體積與每日服用顆數需要一起規劃。',
    items: [
      ['GLUCOSAMINE', '葡萄糖胺', '有鹽酸鹽與硫酸鹽兩種常見規格。', '粉末｜甲殼／發酵'],
      ['UC-II COLLAGEN', '非變性二型膠原蛋白', '低劑量使用的軟骨來源蛋白。', '粉末｜軟骨來源'],
      ['MSM', '甲基硫醯基甲烷', '含硫有機化合物。', '粉末｜結晶'],
      ['CURCUMIN', '薑黃素', '常與黑胡椒萃取搭配以利吸收。', '粉末｜根莖萃取'],
      ['CALCIUM', '鈣', '碳酸鈣、檸檬酸鈣或海藻鈣等不同來源。', '粉末｜礦物'],
    ] },
  { slug: 'sleep', en: 'RELAX & SLEEP WELL', zh: '幫助入睡',
    lead: '風味與睡前服用形式（粉包、飲品、軟糖）是體驗上的主要差異。',
    items: [
      ['GABA', 'γ-胺基丁酸', '多以發酵法製得的胺基酸類成分。', '粉末｜發酵'],
      ['L-TRYPTOPHAN', '色胺酸', '游離型必需胺基酸。', '粉末｜胺基酸'],
      ['ZIZIPHUS', '酸棗仁萃取', '傳統使用的種子萃取原料。', '粉末｜種子萃取'],
      ['CHAMOMILE', '洋甘菊萃取', '花部萃取，風味明顯需納入調味考量。', '粉末｜花部萃取'],
    ] },
  { slug: 'slender', en: 'SLENDER GRACEFUL', zh: '窈窕清盈',
    lead: '訴求敏感度高，包裝與文案都需要提前檢視法規用語。',
    items: [
      ['WHITE KIDNEY BEAN', '白腎豆萃取', '以澱粉酶抑制活性標示規格。', '粉末｜豆類萃取'],
      ['AFRICAN MANGO', '非洲芒果萃取', '種子萃取原料。', '粉末｜種子萃取'],
      ['CLA', '共軛亞麻油酸', '多來自紅花籽油的脂肪酸。', '油脂｜植物'],
      ['CHLOROGENIC ACID', '綠原酸', '取自生咖啡豆的多酚類。', '粉末｜植物萃取'],
    ] },
  { slug: 'meal', en: 'MEAL REPLACEMENT', zh: '纖體餐包',
    lead: '沖泡性、飽足感與整體熱量配比，比單一成分的選擇更關鍵。',
    items: [
      ['OAT BETA-GLUCAN', '燕麥β-葡聚醣', '穀物來源的水溶性纖維。', '粉末｜穀物'],
      ['CHIA SEED', '奇亞籽粉', '含膳食纖維與 omega-3 的種子原料。', '粉末｜種子'],
      ['MEAL PROTEIN', '餐包蛋白基底', '可依素食需求選擇乳源或植物來源。', '粉末｜複方'],
      ['FIBER BLEND', '膳食纖維複方', '多種水溶性與非水溶性纖維的組合。', '粉末｜複方'],
    ] },
  { slug: 'body-care', en: 'BODY CARE', zh: '體質調理',
    lead: '常作為長期服用型產品，原料的批次穩定性特別重要。',
    items: [
      ['TURMERIC', '薑黃萃取', '以薑黃素含量標示規格。', '粉末｜根莖萃取'],
      ['BLACK PEPPER', '黑胡椒萃取', '以胡椒鹼標示，常作為搭配用原料。', '粉末｜果實萃取'],
      ['PROBIOTICS', '益生菌', '依配方需求選擇單一或複合菌株。', '粉末｜益生菌'],
      ['ENZYME BLEND', '綜合酵素', '含蛋白酶、澱粉酶與脂肪酶等。', '粉末｜發酵'],
    ] },
  { slug: 'elderly', en: 'ELDERLY HEALTH', zh: '銀髮保健',
    lead: '吞嚥便利性影響劑型選擇，粉包與液態劑型的接受度較高。',
    items: [
      ['CALCIUM & MAGNESIUM', '鈣鎂複方', '以固定比例搭配的礦物質組合。', '粉末｜礦物'],
      ['VITAMIN D3 + K2', '維生素 D3＋K2', 'K2 常用 MK-7 型式。', '粉末／油脂'],
      ['COENZYME Q10', '輔酶 Q10', '可選一般型或還原型規格。', '粉末／油脂'],
      ['LECITHIN', '卵磷脂', '大豆或葵花來源的磷脂質。', '粉末／顆粒'],
    ] },
  { slug: 'women', en: 'WOMEN HEALTH', zh: '女性調理',
    lead: '不同年齡層的訴求差異大，配方通常需要分眾設計。',
    items: [
      ['SOY ISOFLAVONE', '大豆異黃酮', '以苷元含量標示規格。', '粉末｜豆類萃取'],
      ['EVENING PRIMROSE', '月見草油', '富含 GLA 的植物油脂。', '油脂｜冷壓'],
      ['IRON', '鐵', '常見為甘胺酸亞鐵等有機鐵型式。', '粉末｜礦物'],
      ['FOLATE', '葉酸', '有一般型與活性型（5-MTHF）可選。', '粉末｜結晶'],
      ['CHASTEBERRY', '聖潔莓萃取', '果實萃取原料。', '粉末｜果實萃取'],
    ] },
  { slug: 'men', en: 'MEN HEALTH', zh: '男性調理',
    lead: '包裝調性與訴求語言的設計，往往和成分選擇同等重要。',
    items: [
      ['SAW PALMETTO', '鋸棕櫚萃取', '以脂肪酸含量標示的果實萃取。', '油脂｜果實萃取'],
      ['ZINC', '鋅', '常見為酵母鋅或胺基酸螯合鋅。', '粉末｜礦物'],
      ['MACA', '瑪卡萃取', '根部萃取原料。', '粉末｜根部萃取'],
      ['L-ARGININE', '精胺酸', '游離型胺基酸。', '粉末｜胺基酸'],
      ['LYCOPENE', '茄紅素', '多來自番茄的類胡蘿蔔素。', '粉末／油脂'],
    ] },
  { slug: 'digestive', en: 'DIGESTIVE CARE', zh: '消化保健',
    lead: '酵素活性單位的標示方式，是報價與規格確認時最常見的落差來源。',
    items: [
      ['ENZYME BLEND', '消化酵素複方', '以活性單位標示，非以重量標示。', '粉末｜發酵'],
      ['BROMELAIN', '鳳梨酵素', '取自鳳梨莖部的蛋白酶。', '粉末｜果實來源'],
      ['PAPAIN', '木瓜酵素', '取自木瓜的蛋白酶。', '粉末｜果實來源'],
      ['GINGER', '薑萃取', '以薑辣素標示規格的根莖萃取。', '粉末｜根莖萃取'],
    ] },
  { slug: 'skin-care', en: 'SKIN CARE', zh: '膚質養護',
    lead: '與養顏美容方向重疊度高，區隔通常建立在劑型與使用情境上。',
    items: [
      ['CERAMIDE', '神經醯胺', '常見自米糠或小麥萃取。', '粉末｜植物萃取'],
      ['SIALIC ACID', '燕窩酸', '唾液酸，來源需附完整證明文件。', '粉末｜動物來源'],
      ['VITAMIN E', '維生素 E', '天然型與合成型的規格差異明顯。', '油脂｜生育醇'],
      ['BIOTIN', '生物素', '水溶性 B 群成分，使用劑量極低。', '粉末｜結晶'],
    ] },
  { slug: 'child', en: 'CHILD CARE', zh: '兒童保健',
    lead: '風味接受度與劑型安全性（避免嗆咳）是設計上的第一考量。',
    items: [
      ['ALGAL DHA', '藻油 DHA', '植物性 omega-3，避開魚腥味問題。', '油脂｜藻類'],
      ['CALCIUM', '鈣', '可選用顆粒或咀嚼錠等兒童友善劑型。', '粉末｜礦物'],
      ['MULTIVITAMIN', '綜合維生素', '依年齡層調整劑量的複方。', '粉末｜複方'],
      ['PROBIOTICS', '益生菌', '選擇適合兒童的菌株與活菌數。', '粉末｜益生菌'],
      ['LACTOFERRIN', '乳鐵蛋白', '乳源蛋白質，對熱較敏感。', '粉末｜乳源'],
    ] },
];

const esc = s => s.replace(/&/g, '&amp;');
const PLACEHOLDER = '../../../assets/premium/ingredient-placeholder.svg';

/* A fifth element is the path to a real photo. Where it is present the card
 * carries the client's own image and drops the placeholder alt text. */
function card([en, zh, desc, meta, img]) {
  const src = img || PLACEHOLDER;
  const alt = img ? `${zh}原料` : '';
  return `<article class="catalogue-card reveal">` +
    `<div class="catalogue-media"><img src="${src}" alt="${esc(alt)}" loading="lazy"></div>` +
    `<div class="catalogue-copy"><span class="catalogue-en">${esc(en)}</span><h3>${esc(zh)}</h3>` +
    `<p>${esc(desc)}</p><p class="ingredient-meta"><b>形式</b>　${esc(meta)}</p></div></article>`;
}

function page(c) {
  return `<!doctype html>
<html lang="zh-Hant">
<head>
  <meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(c.zh)}原料｜功能配方｜百達醫 BKE</title>
  <meta name="description" content="${esc(c.zh)}方向常用的原料選項與規格形式，供品牌在配方規劃階段參考。">
  <meta name="robots" content="noindex">
  <link rel="canonical" href="https://shengge820.github.io/baidayi-premium-redesign/全面性服務/功能配方/${c.slug}/">
  <meta name="theme-color" content="#171713">
  <link rel="icon" href="../../../wp-content/uploads/2025/09/BKE-favicon.png">
  <link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
  <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+TC:wght@300;400;500;600&family=Noto+Serif+TC:wght@500;600&family=Outfit:wght@300;400;500;600&display=swap" rel="stylesheet">
  <link rel="stylesheet" href="../../../premium-site.css?v=${V}"><link rel="stylesheet" href="../../../premium-inner.css?v=${V}">
  <link rel="stylesheet" href="../../../premium-motion.css?v=${V}">
</head>
<body class="premium-site premium-inner" data-root="../../../" data-active="service">
  <a class="skip-link" href="#main-content">跳到主要內容</a><div data-premium-header></div>
  <main id="main-content">
    <section class="inner-hero">
      <div class="inner-hero-media" aria-hidden="true"><img src="../../../assets/premium/research-ingredient-lab.jpg" alt=""></div><div class="inner-hero-shade" aria-hidden="true"></div>
      <div class="container inner-hero-content"><p class="eyebrow reveal">${esc(c.en)}</p><h1 class="reveal">${esc(c.zh)}</h1><p class="inner-hero-lead reveal">${esc(c.lead)}</p></div>
      <span class="inner-hero-index">原料選項</span>
    </section>
    <section class="page-section page-section-ivory"><div class="container">
      <p class="placeholder-note reveal"><strong>版面示意</strong>　本頁原料資料與圖片為暫代內容，僅供版面確認；實際品項、規格與說明待百達醫提供後替換。</p>
      <div class="page-heading"><div><p class="eyebrow eyebrow-dark reveal">COMMON MATERIALS</p><h2 class="page-title reveal">這個方向<br>常用的原料。</h2></div><p class="reveal">以下列出此配方方向較常被指定的原料與其形式。實際可用品項、規格與最小採購量，會依配方設計與供應狀況調整。</p></div>
      <div class="catalogue-grid catalogue-grid-ingredient">
        ${c.items.map(card).join('\n        ')}
      </div>
    </div></section>
    <section class="project-cta"><div class="container project-cta-inner"><div><p class="eyebrow eyebrow-dark reveal">DISCUSS YOUR FORMULA</p><h2 class="reveal">想用哪一支原料，<br>我們一起確認。</h2></div><div class="project-cta-copy reveal"><p>提供產品訴求與預計劑型，我們會協助評估原料選項、規格與可行的配方組合。</p><a class="button button-dark" href="../../../contact/index.html">與研發顧問討論 <span aria-hidden="true">↗</span></a></div></div></section>
  </main>
  <div data-premium-footer></div><script src="../../../premium-shell.js?v=${V}"></script><script src="../../../premium-site.js?v=${V}"></script>
  <script src="../../../premium-motion.js?v=${V}"></script>
</body>
</html>
`;
}

let n = 0;
for (const c of categories) {
  const dir = path.join('全面性服務', '功能配方', c.slug);
  fs.mkdirSync(dir, { recursive: true });
  fs.writeFileSync(path.join(dir, 'index.html'), page(c));
  n++;
}
console.log(`generated ${n} pages, ${categories.reduce((s, c) => s + c.items.length, 0)} ingredient cards`);
