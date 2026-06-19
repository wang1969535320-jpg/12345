const http = require("node:http");
const fsSync = require("node:fs");
const fs = require("node:fs/promises");
const path = require("node:path");

const root = __dirname;
const port = Number(process.env.PORT || 8788);
const host = process.env.HOST || "0.0.0.0";
const screenshotDir = process.env.SCREENSHOT_DIR || path.join(root, "screenshots");
const trainingDir = path.join(root, "training");
const trainingScreenshotDir = path.join(trainingDir, "screenshots");
const trainingExpectedPath = path.join(trainingDir, "expected.json");
const ocrCacheDir = path.join(root, "ocr-cache");
const kmbBase = "https://data.etabus.gov.hk/v1/transport/kmb";
const addressBase = "https://www.als.ogcio.gov.hk/lookup";
const nominatimBase = "https://nominatim.openstreetmap.org/search";
const cache = new Map();
const ocrAssets = {
  "/api/ocr/tesseract.min.js": {
    file: "tesseract.min.js",
    type: "text/javascript; charset=utf-8",
    sources: [
      "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/tesseract.min.js",
      "https://unpkg.com/tesseract.js@5/dist/tesseract.min.js"
    ]
  },
  "/api/ocr/worker.min.js": {
    file: "worker.min.js",
    type: "text/javascript; charset=utf-8",
    sources: [
      "https://cdn.jsdelivr.net/npm/tesseract.js@5/dist/worker.min.js",
      "https://unpkg.com/tesseract.js@5/dist/worker.min.js"
    ]
  },
  "/api/ocr/core/tesseract-core-simd.wasm.js": {
    file: "tesseract-core-simd.wasm.js",
    type: "text/javascript; charset=utf-8",
    sources: [
      "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd.wasm.js",
      "https://unpkg.com/tesseract.js-core@5/tesseract-core-simd.wasm.js"
    ]
  },
  "/api/ocr/core/tesseract-core-simd.wasm": {
    file: "tesseract-core-simd.wasm",
    type: "application/wasm",
    sources: [
      "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core-simd.wasm",
      "https://unpkg.com/tesseract.js-core@5/tesseract-core-simd.wasm"
    ]
  },
  "/api/ocr/core/tesseract-core.wasm.js": {
    file: "tesseract-core.wasm.js",
    type: "text/javascript; charset=utf-8",
    sources: [
      "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm.js",
      "https://unpkg.com/tesseract.js-core@5/tesseract-core.wasm.js"
    ]
  },
  "/api/ocr/core/tesseract-core.wasm": {
    file: "tesseract-core.wasm",
    type: "application/wasm",
    sources: [
      "https://cdn.jsdelivr.net/npm/tesseract.js-core@5/tesseract-core.wasm",
      "https://unpkg.com/tesseract.js-core@5/tesseract-core.wasm"
    ]
  },
  "/api/ocr/lang/chi_tra.traineddata.gz": {
    file: "chi_tra.traineddata.gz",
    type: "application/gzip",
    sources: [
      "https://tessdata.projectnaptha.com/4.0.0/chi_tra.traineddata.gz",
      "https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0/chi_tra.traineddata.gz"
    ]
  },
  "/api/ocr/lang/eng.traineddata.gz": {
    file: "eng.traineddata.gz",
    type: "application/gzip",
    sources: [
      "https://tessdata.projectnaptha.com/4.0.0/eng.traineddata.gz",
      "https://cdn.jsdelivr.net/gh/naptha/tessdata@gh-pages/4.0.0/eng.traineddata.gz"
    ]
  }
};
const localGazetteer = [
  { keys: ["朗豪坊", "langham", "langham place"], labelZh: "朗豪坊", labelEn: "Langham Place", lat: 22.3187, lng: 114.1689 },
  { keys: ["寶琳站", "宝琳站", "寶琳", "宝琳", "po lam", "po lam station"], labelZh: "寶琳站", labelEn: "Po Lam Station", lat: 22.3225, lng: 114.2578 },
  { keys: ["金鐘站", "金钟站", "金鐘", "金钟", "admiralty", "admiralty station"], labelZh: "金鐘站", labelEn: "Admiralty Station", lat: 22.2796, lng: 114.1655 },
  { keys: ["旺角站", "旺角", "mong kok", "mong kok station"], labelZh: "旺角站", labelEn: "Mong Kok Station", lat: 22.3193, lng: 114.1694 },
  { keys: ["香港科技大學", "香港科技大学", "科大", "hkust"], labelZh: "香港科技大學", labelEn: "HKUST", lat: 22.3364, lng: 114.2636 },
  { keys: ["又一城", "festival walk"], labelZh: "又一城", labelEn: "Festival Walk", lat: 22.3378, lng: 114.1746 },
  { keys: ["國際金融中心", "国际金融中心", "ifc"], labelZh: "國際金融中心", labelEn: "IFC", lat: 22.2858, lng: 114.1588 },
  { keys: ["海港城", "harbour city"], labelZh: "海港城", labelEn: "Harbour City", lat: 22.2951, lng: 114.1695 },
  { keys: ["太古城", "cityplaza", "city plaza"], labelZh: "太古城中心", labelEn: "Cityplaza", lat: 22.2869, lng: 114.2174 },
  { keys: ["apm", "創紀之城", "创纪之城"], labelZh: "apm 創紀之城", labelEn: "apm", lat: 22.3122, lng: 114.2253 },
  { keys: ["九龍區", "九龙区", "kowloon"], labelZh: "九龍區", labelEn: "Kowloon", lat: 22.3193, lng: 114.1694 },
  { keys: ["九龍城", "九龙城", "kowloon city"], labelZh: "九龍城", labelEn: "Kowloon City", lat: 22.3282, lng: 114.1916 },
  { keys: ["葵涌", "葵涌", "kwai chung"], labelZh: "葵涌", labelEn: "Kwai Chung", lat: 22.3639, lng: 114.1311 },
  { keys: ["柴灣", "柴湾", "chai wan"], labelZh: "柴灣", labelEn: "Chai Wan", lat: 22.2647, lng: 114.2371 },
  { keys: ["新蒲崗", "新蒲岗", "san po kong"], labelZh: "新蒲崗", labelEn: "San Po Kong", lat: 22.3351, lng: 114.1973 },
  { keys: ["薄扶林", "pok fu lam"], labelZh: "薄扶林", labelEn: "Pok Fu Lam", lat: 22.2678, lng: 114.1291 },
  { keys: ["觀塘", "观塘", "kwun tong"], labelZh: "觀塘", labelEn: "Kwun Tong", lat: 22.3120, lng: 114.2250 },
  { keys: ["荃灣", "荃湾", "tsuen wan"], labelZh: "荃灣", labelEn: "Tsuen Wan", lat: 22.3730, lng: 114.1170 },
  { keys: ["石籬", "石篱", "shek lei"], labelZh: "石籬", labelEn: "Shek Lei", lat: 22.3656, lng: 114.1396 },
  { keys: ["銅鑼灣", "铜锣湾", "causeway bay"], labelZh: "銅鑼灣", labelEn: "Causeway Bay", lat: 22.2802, lng: 114.1843 },
  { keys: ["灣仔", "湾仔", "wan chai"], labelZh: "灣仔", labelEn: "Wan Chai", lat: 22.2770, lng: 114.1737 },
  { keys: ["西環", "西环", "sai wan", "western district"], labelZh: "西環", labelEn: "Sai Wan", lat: 22.2860, lng: 114.1395 },
  { keys: ["中環", "中环", "central"], labelZh: "中環", labelEn: "Central", lat: 22.2819, lng: 114.1589 },
  { keys: ["尖沙咀", "tsim sha tsui", "tst"], labelZh: "尖沙咀", labelEn: "Tsim Sha Tsui", lat: 22.2976, lng: 114.1722 },
  { keys: ["佐敦", "jordan"], labelZh: "佐敦", labelEn: "Jordan", lat: 22.3046, lng: 114.1718 },
  { keys: ["油麻地", "yau ma tei"], labelZh: "油麻地", labelEn: "Yau Ma Tei", lat: 22.3133, lng: 114.1707 },
  { keys: ["九龍灣", "九龙湾", "kowloon bay"], labelZh: "九龍灣", labelEn: "Kowloon Bay", lat: 22.3230, lng: 114.2141 },
  { keys: ["九肚山", "kau to shan"], labelZh: "九肚山", labelEn: "Kau To Shan", lat: 22.4052, lng: 114.2030 },
  { keys: ["土瓜灣", "土瓜湾", "土瓜灣站", "土瓜湾站", "to kwa wan", "to kwa wan station"], labelZh: "土瓜灣站", labelEn: "To Kwa Wan Station", lat: 22.3170, lng: 114.1879 },
  { keys: ["宋皇臺", "宋皇台", "宋皇臺站", "宋皇台站", "sung wong toi", "sung wong toi station"], labelZh: "宋皇臺站", labelEn: "Sung Wong Toi Station", lat: 22.3256, lng: 114.1906 },
  { keys: ["啟德", "启德", "啟德站", "启德站", "kai tak", "kai tak station"], labelZh: "啟德站", labelEn: "Kai Tak Station", lat: 22.3314, lng: 114.1994 },
  { keys: ["何文田", "何文田站", "ho man tin", "ho man tin station"], labelZh: "何文田站", labelEn: "Ho Man Tin Station", lat: 22.3093, lng: 114.1821 },
  { keys: ["深水埗", "深水埗", "sham shui po"], labelZh: "深水埗", labelEn: "Sham Shui Po", lat: 22.3307, lng: 114.1622 },
  { keys: ["荔枝角", "lai chi kok"], labelZh: "荔枝角", labelEn: "Lai Chi Kok", lat: 22.3371, lng: 114.1481 },
  { keys: ["美孚", "mei foo"], labelZh: "美孚", labelEn: "Mei Foo", lat: 22.3377, lng: 114.1405 },
  { keys: ["青衣", "tsing yi"], labelZh: "青衣", labelEn: "Tsing Yi", lat: 22.3583, lng: 114.1070 },
  { keys: ["沙田", "sha tin"], labelZh: "沙田", labelEn: "Sha Tin", lat: 22.3828, lng: 114.1915 },
  { keys: ["大圍", "大围", "tai wai"], labelZh: "大圍", labelEn: "Tai Wai", lat: 22.3736, lng: 114.1783 },
  { keys: ["大埔", "tai po"], labelZh: "大埔", labelEn: "Tai Po", lat: 22.4501, lng: 114.1688 },
  { keys: ["元朗", "yuen long"], labelZh: "元朗", labelEn: "Yuen Long", lat: 22.4445, lng: 114.0222 },
  { keys: ["屯門", "屯门", "tuen mun"], labelZh: "屯門", labelEn: "Tuen Mun", lat: 22.3953, lng: 113.9737 },
  { keys: ["將軍澳", "将军澳", "tseung kwan o"], labelZh: "將軍澳", labelEn: "Tseung Kwan O", lat: 22.3074, lng: 114.2604 },
  { keys: ["坑口", "hang hau"], labelZh: "坑口", labelEn: "Hang Hau", lat: 22.3156, lng: 114.2646 },
  { keys: ["北角", "north point"], labelZh: "北角", labelEn: "North Point", lat: 22.2913, lng: 114.2005 },
  { keys: ["天后", "tin hau"], labelZh: "天后", labelEn: "Tin Hau", lat: 22.2821, lng: 114.1919 },
  { keys: ["炮台山", "fortress hill"], labelZh: "炮台山", labelEn: "Fortress Hill", lat: 22.2882, lng: 114.1932 },
  { keys: ["鰂魚涌", "鲗鱼涌", "quarry bay"], labelZh: "鰂魚涌", labelEn: "Quarry Bay", lat: 22.2887, lng: 114.2099 },
  { keys: ["太古", "tai koo"], labelZh: "太古", labelEn: "Tai Koo", lat: 22.2847, lng: 114.2167 },
  { keys: ["西灣河", "西湾河", "sai wan ho"], labelZh: "西灣河", labelEn: "Sai Wan Ho", lat: 22.2829, lng: 114.2221 },
  { keys: ["筲箕灣", "筲箕湾", "shau kei wan"], labelZh: "筲箕灣", labelEn: "Shau Kei Wan", lat: 22.2797, lng: 114.2280 },
  { keys: ["香港仔", "aberdeen"], labelZh: "香港仔", labelEn: "Aberdeen", lat: 22.2480, lng: 114.1555 },
  { keys: ["跑馬地", "跑马地", "happy valley"], labelZh: "跑馬地", labelEn: "Happy Valley", lat: 22.2699, lng: 114.1848 },
  { keys: ["何文田", "何文田站", "ho man tin", "ho man tin station"], labelZh: "何文田", labelEn: "Ho Man Tin", lat: 22.3093, lng: 114.1821 },
  { keys: ["啟德", "启德", "啟德站", "启德站", "kai tak", "kai tak station"], labelZh: "啟德", labelEn: "Kai Tak", lat: 22.3314, lng: 114.1994 },
  { keys: ["大角咀", "大角嘴", "tai kok tsui"], labelZh: "大角咀", labelEn: "Tai Kok Tsui", lat: 22.3214, lng: 114.1622 },
  { keys: ["元朗", "yuen long"], labelZh: "元朗", labelEn: "Yuen Long", lat: 22.4445, lng: 114.0222 },
  { keys: ["屯門", "屯门", "tuen mun"], labelZh: "屯門", labelEn: "Tuen Mun", lat: 22.3953, lng: 113.9737 },
  { keys: ["秀茂坪", "sau mau ping"], labelZh: "秀茂坪", labelEn: "Sau Mau Ping", lat: 22.3196, lng: 114.2340 },
  { keys: ["何文田", "ho man tin"], labelZh: "何文田", labelEn: "Ho Man Tin", lat: 22.3093, lng: 114.1821 },
  { keys: ["上環", "上环", "sheung wan"], labelZh: "上環", labelEn: "Sheung Wan", lat: 22.2866, lng: 114.1538 }
];

const extraHongKongPlaces = [
  ["油尖旺", "Yau Tsim Mong", 22.3070, 114.1694, ["yau tsim mong"]],
  ["深水埗", "Sham Shui Po", 22.3307, 114.1622, ["sham shui po"]],
  ["九龍城", "Kowloon City", 22.3282, 114.1916, ["kowloon city"]],
  ["黃大仙", "Wong Tai Sin", 22.3417, 114.1931, ["wong tai sin"]],
  ["觀塘", "Kwun Tong", 22.3120, 114.2250, ["kwun tong"]],
  ["葵青", "Kwai Tsing", 22.3549, 114.1261, ["kwai tsing"]],
  ["荃灣", "Tsuen Wan", 22.3730, 114.1170, ["tsuen wan"]],
  ["屯門", "Tuen Mun", 22.3953, 113.9737, ["tuen mun"]],
  ["元朗", "Yuen Long", 22.4445, 114.0222, ["yuen long"]],
  ["北區", "North District", 22.5009, 114.1553, ["north district", "sheung shui", "fanling"]],
  ["大埔", "Tai Po", 22.4501, 114.1688, ["tai po"]],
  ["沙田", "Sha Tin", 22.3828, 114.1915, ["sha tin", "shatin"]],
  ["西貢", "Sai Kung", 22.3837, 114.2708, ["sai kung"]],
  ["離島", "Islands District", 22.2611, 113.9461, ["islands district"]],
  ["中西區", "Central and Western", 22.2830, 114.1490, ["central and western"]],
  ["灣仔", "Wan Chai", 22.2770, 114.1737, ["wan chai"]],
  ["東區", "Eastern District", 22.2810, 114.2240, ["eastern district"]],
  ["南區", "Southern District", 22.2470, 114.1580, ["southern district"]],
  ["太子", "Prince Edward", 22.3246, 114.1681, ["prince edward"]],
  ["長沙灣", "Cheung Sha Wan", 22.3351, 114.1555, ["cheung sha wan"]],
  ["石硤尾", "Shek Kip Mei", 22.3318, 114.1692, ["shek kip mei"]],
  ["樂富", "Lok Fu", 22.3380, 114.1870, ["lok fu"]],
  ["鑽石山", "Diamond Hill", 22.3400, 114.2010, ["diamond hill"]],
  ["彩虹", "Choi Hung", 22.3347, 114.2094, ["choi hung"]],
  ["牛頭角", "Ngau Tau Kok", 22.3156, 114.2192, ["ngau tau kok"]],
  ["藍田", "Lam Tin", 22.3068, 114.2331, ["lam tin"]],
  ["油塘", "Yau Tong", 22.2961, 114.2375, ["yau tong"]],
  ["黃埔", "Whampoa", 22.3049, 114.1905, ["whampoa"]],
  ["紅磡", "Hung Hom", 22.3030, 114.1820, ["hung hom"]],
  ["土瓜灣", "To Kwa Wan", 22.3170, 114.1879, ["to kwa wan"]],
  ["宋皇臺", "Sung Wong Toi", 22.3256, 114.1906, ["sung wong toi"]],
  ["啟德", "Kai Tak", 22.3314, 114.1994, ["kai tak"]],
  ["何文田", "Ho Man Tin", 22.3093, 114.1821, ["ho man tin"]],
  ["大角咀", "Tai Kok Tsui", 22.3223, 114.1620, ["tai kok tsui"]],
  ["奧運", "Olympic", 22.3177, 114.1600, ["olympic"]],
  ["柯士甸", "Austin", 22.3047, 114.1667, ["austin"]],
  ["尖東", "East Tsim Sha Tsui", 22.2959, 114.1741, ["east tsim sha tsui"]],
  ["南昌", "Nam Cheong", 22.3268, 114.1538, ["nam cheong"]],
  ["葵芳", "Kwai Fong", 22.3569, 114.1279, ["kwai fong"]],
  ["葵興", "Kwai Hing", 22.3632, 114.1315, ["kwai hing"]],
  ["大窩口", "Tai Wo Hau", 22.3708, 114.1250, ["tai wo hau"]],
  ["荃灣西", "Tsuen Wan West", 22.3685, 114.1097, ["tsuen wan west"]],
  ["青衣", "Tsing Yi", 22.3583, 114.1070, ["tsing yi"]],
  ["馬鞍山", "Ma On Shan", 22.4240, 114.2315, ["ma on shan"]],
  ["烏溪沙", "Wu Kai Sha", 22.4293, 114.2436, ["wu kai sha"]],
  ["大圍", "Tai Wai", 22.3736, 114.1783, ["tai wai"]],
  ["火炭", "Fo Tan", 22.3950, 114.1980, ["fo tan"]],
  ["大學", "University", 22.4136, 114.2104, ["university station"]],
  ["上水", "Sheung Shui", 22.5011, 114.1277, ["sheung shui"]],
  ["粉嶺", "Fanling", 22.4922, 114.1380, ["fanling"]],
  ["天水圍", "Tin Shui Wai", 22.4560, 114.0030, ["tin shui wai"]],
  ["兆康", "Siu Hong", 22.4119, 113.9788, ["siu hong"]],
  ["朗屏", "Long Ping", 22.4474, 114.0254, ["long ping"]],
  ["錦上路", "Kam Sheung Road", 22.4347, 114.0636, ["kam sheung road"]],
  ["赤鱲角", "Chek Lap Kok", 22.3080, 113.9185, ["chek lap kok", "airport"]],
  ["東涌", "Tung Chung", 22.2893, 113.9415, ["tung chung"]],
  ["迪士尼", "Disneyland", 22.3150, 114.0452, ["disneyland"]],
  ["西營盤", "Sai Ying Pun", 22.2866, 114.1427, ["sai ying pun"]],
  ["香港大學", "HKU", 22.2838, 114.1354, ["hku", "hong kong university"]],
  ["堅尼地城", "Kennedy Town", 22.2817, 114.1286, ["kennedy town"]],
  ["炮台山", "Fortress Hill", 22.2882, 114.1932, ["fortress hill"]],
  ["天后", "Tin Hau", 22.2821, 114.1919, ["tin hau"]],
  ["西灣河", "Sai Wan Ho", 22.2829, 114.2221, ["sai wan ho"]],
  ["筲箕灣", "Shau Kei Wan", 22.2797, 114.2280, ["shau kei wan"]],
  ["杏花邨", "Heng Fa Chuen", 22.2768, 114.2393, ["heng fa chuen"]],
  ["黃竹坑", "Wong Chuk Hang", 22.2480, 114.1685, ["wong chuk hang"]],
  ["海怡半島", "South Horizons", 22.2424, 114.1494, ["south horizons"]],
  ["利東", "Lei Tung", 22.2419, 114.1568, ["lei tung"]],
  ["海洋公園", "Ocean Park", 22.2483, 114.1740, ["ocean park"]],
  ["老圍", "Lo Wai", 22.3776, 114.1242, ["lo wai", "lo wai village"]],
  ["荔景", "Lai King", 22.3486, 114.1262, ["lai king"]],
  ["西環", "Sai Wan", 22.2867, 114.1356, ["sai wan", "western district"]],
  ["北角", "North Point", 22.2912, 114.2004, ["north point"]],
  ["薄扶林", "Pok Fu Lam", 22.2670, 114.1287, ["pok fu lam", "pokfulam"]],
  ["中環", "Central", 22.2819, 114.1589, ["central"]],
  ["葵涌", "Kwai Chung", 22.3632, 114.1340, ["kwai chung"]],
  ["秀茂坪", "Sau Mau Ping", 22.3196, 114.2340, ["sau mau ping"]]
];

for (const [labelZh, labelEn, lat, lng, aliases = []] of extraHongKongPlaces) {
  if (!localGazetteer.some(place => place.labelZh === labelZh)) {
    localGazetteer.push({
      keys: [labelZh, ...aliases],
      labelZh,
      labelEn,
      lat,
      lng
    });
  }
}

function loadSupplementalPlaces() {
  const files = [
    "hk-place-names.json",
    "ehkg-place-names.json"
  ];
  for (const fileName of files) {
    const filePath = path.join(root, "data", fileName);
    if (!fsSync.existsSync(filePath)) continue;
    try {
      const parsed = JSON.parse(fsSync.readFileSync(filePath, "utf8"));
      for (const item of parsed.places || []) {
        const labelZh = String(item.labelZh || "").trim();
        if (!labelZh || localGazetteer.some(place => place.labelZh === labelZh)) continue;
        const labelEn = String(item.labelEn || labelZh).trim();
        const keys = [labelZh, labelEn, ...(item.keys || [])]
          .filter(Boolean)
          .map(value => String(value).trim());
        localGazetteer.push({
          keys: Array.from(new Set(keys)),
          labelZh,
          labelEn,
          lat: Number.isFinite(Number(item.lat)) ? Number(item.lat) : null,
          lng: Number.isFinite(Number(item.lng)) ? Number(item.lng) : null,
          matchOnly: !(Number.isFinite(Number(item.lat)) && Number.isFinite(Number(item.lng)))
        });
      }
    } catch (error) {
      console.warn(`Failed to load supplemental place names from ${fileName}: ${error.message}`);
    }
  }
}

loadSupplementalPlaces();

const queryAliases = {
  "銅鑼灣": ["铜锣湾", "causeway bay"],
  "灣仔": ["湾仔", "wan chai"],
  "中環": ["中环", "central"],
  "尖沙咀": ["tsim sha tsui"],
  "將軍澳": ["将军澳", "tseung kwan o"],
  "鰂魚涌": ["鲗鱼涌", "quarry bay"],
  "荔枝角": ["lai chi kok"],
  "深水埗": ["sham shui po"]
};

function send(res, status, body, headers = {}) {
  res.writeHead(status, {
    "Access-Control-Allow-Origin": "*",
    "Cache-Control": "no-store",
    ...headers
  });
  res.end(body);
}

function contentType(filePath) {
  if (filePath.endsWith(".html")) return "text/html; charset=utf-8";
  if (filePath.endsWith(".json")) return "application/json; charset=utf-8";
  if (filePath.endsWith(".webmanifest")) return "application/manifest+json; charset=utf-8";
  if (filePath.endsWith(".js")) return "text/javascript; charset=utf-8";
  if (filePath.endsWith(".css")) return "text/css; charset=utf-8";
  if (filePath.endsWith(".svg")) return "image/svg+xml; charset=utf-8";
  if (/\.(png)$/i.test(filePath)) return "image/png";
  if (/\.(jpg|jpeg)$/i.test(filePath)) return "image/jpeg";
  if (/\.(webp)$/i.test(filePath)) return "image/webp";
  return "text/plain; charset=utf-8";
}

async function latestScreenshot() {
  return (await latestScreenshots(1))[0] || null;
}

async function latestScreenshots(limit = 2) {
  return listImageFiles(screenshotDir, limit);
}

async function listImageFiles(directory, limit = 20) {
  await fs.mkdir(directory, { recursive: true });
  const entries = await fs.readdir(directory, { withFileTypes: true });
  const images = [];
  for (const entry of entries) {
    if (!entry.isFile() || !/\.(png|jpg|jpeg|webp)$/i.test(entry.name)) continue;
    const filePath = path.join(directory, entry.name);
    const stat = await fs.stat(filePath);
    images.push({
      name: entry.name,
      path: filePath,
      size: stat.size,
      mtimeMs: stat.mtimeMs
    });
  }
  images.sort((a, b) => b.mtimeMs - a.mtimeMs);
  return images.slice(0, limit);
}

function lookupLocalPlace(query) {
  const normalized = normalizeQuery(query).toLowerCase();
  return localGazetteer.find(place => place.keys.some(key => normalized.includes(key.toLowerCase()) || key.toLowerCase().includes(normalized)));
}

function normalizeQuery(query) {
  return String(query || "")
    .trim()
    .replace(/地铁站|地鐵站|港铁站|港鐵站|港铁|港鐵|MTR站|mtr站/gi, "站")
    .replace(/\s+/g, " ")
    .trim();
}

function compactQuery(query) {
  return normalizeQuery(query).toLowerCase().replace(/\s+/g, "");
}

function searchLocalPlaces(query, limit = 8) {
  const normalized = normalizeQuery(query).toLowerCase();
  const compact = compactQuery(query);
  if (!normalized) return [];
  return localGazetteer
    .filter(place => place.keys.some(key => {
      const lowerKey = key.toLowerCase();
      const compactKey = lowerKey.replace(/\s+/g, "");
      const looseCompactMatch = compact.length >= 4
        && compactKey.length >= 4
        && (compactKey.includes(compact) || compact.includes(compactKey));
      return lowerKey.includes(normalized)
        || normalized.includes(lowerKey)
        || looseCompactMatch;
    }))
    .slice(0, limit)
    .map(place => ({
      source: "local",
      label: `${place.labelZh} ${place.labelEn}`,
      labelZh: place.labelZh,
      labelEn: place.labelEn,
      lat: place.lat,
      lng: place.lng
    }));
}

function normalizeNominatimPlace(item, fallback) {
  const name = item.name || (item.display_name || fallback).split(",")[0];
  return {
    source: "nominatim",
    label: item.display_name || name || fallback,
    labelZh: name || fallback,
    labelEn: item.display_name || name || fallback,
    lat: Number(item.lat),
    lng: Number(item.lon)
  };
}

async function searchMapPlaces(query, limit = 5) {
  const cleaned = normalizeQuery(query);
  const variants = [cleaned, ...(queryAliases[cleaned] || []), `${cleaned} Hong Kong`, `${cleaned} station Hong Kong`];
  const results = [];
  const seen = new Set();
  for (const variant of variants) {
    const target = `${nominatimBase}?format=jsonv2&limit=${limit}&countrycodes=hk&accept-language=zh-Hant,zh,en&q=${encodeURIComponent(variant)}`;
    const data = await fetchWithCache(target, 24 * 60 * 60_000);
    const parsed = JSON.parse(data.body);
    for (const item of parsed) {
      if (!item.lat || !item.lon) continue;
      const place = normalizeNominatimPlace(item, query);
      const key = `${place.lat}|${place.lng}`;
      if (seen.has(key)) continue;
      seen.add(key);
      results.push(place);
      if (results.length >= limit) return results;
    }
  }
  return results;
}

async function fetchWithCache(url, ttlMs = 60_000) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.time < ttlMs) return cached;

  const response = await fetch(url, {
    headers: {
      Accept: "application/json, text/xml;q=0.9, */*;q=0.8",
      "User-Agent": "hk-transit-planner-prototype/1.0"
    }
  });
  const body = await response.text();
  const entry = {
    time: Date.now(),
    status: response.status,
    body,
    type: response.headers.get("content-type") || "application/json; charset=utf-8"
  };
  if (response.ok) cache.set(url, entry);
  return entry;
}

async function fetchBinaryAsset(asset) {
  await fs.mkdir(ocrCacheDir, { recursive: true });
  const cachePath = path.join(ocrCacheDir, asset.file);
  try {
    return await fs.readFile(cachePath);
  } catch {}

  const errors = [];
  for (const source of asset.sources) {
    try {
      const response = await fetch(source, {
        headers: {
          Accept: "*/*",
          "User-Agent": "hk-transit-planner-prototype/1.0"
        }
      });
      if (!response.ok) throw new Error(`${response.status} ${response.statusText}`);
      const buffer = Buffer.from(await response.arrayBuffer());
      await fs.writeFile(cachePath, buffer);
      return buffer;
    } catch (error) {
      errors.push(`${source}: ${error.message}`);
    }
  }
  throw new Error(`OCR asset unavailable. ${errors.join(" | ")}`);
}

async function handleOcrAsset(res, url) {
  const asset = ocrAssets[url.pathname];
  if (!asset) {
    send(res, 404, "OCR asset not found");
    return;
  }
  const body = await fetchBinaryAsset(asset);
  send(res, 200, body, {
    "Content-Type": asset.type,
    "Cache-Control": "public, max-age=604800"
  });
}

async function handleApi(req, res, url) {
  try {
    if (url.pathname.startsWith("/api/ocr/")) {
      await handleOcrAsset(res, url);
      return;
    }

    if (url.pathname === "/api/health") {
      send(res, 200, JSON.stringify({
        ok: true,
        app: "jk-order-helper",
        time: new Date().toISOString()
      }), { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache" });
      return;
    }

    if (url.pathname === "/api/screenshots/latest") {
      const latest = await latestScreenshot();
      if (!latest) {
        send(res, 404, JSON.stringify({
          error: "No screenshot found",
          folder: screenshotDir
        }), { "Content-Type": "application/json; charset=utf-8" });
        return;
      }
      send(res, 200, JSON.stringify({
        name: latest.name,
        size: latest.size,
        mtimeMs: latest.mtimeMs,
        folder: screenshotDir,
        url: `/api/screenshots/latest-file?t=${Math.round(latest.mtimeMs)}`
      }), { "Content-Type": "application/json; charset=utf-8" });
      return;
    }

    if (url.pathname === "/api/screenshots/recent") {
      const limit = Math.max(1, Math.min(20, Number(url.searchParams.get("limit")) || 2));
      const files = await latestScreenshots(limit);
      if (!files.length) {
        send(res, 404, JSON.stringify({
          error: "No screenshot found",
          folder: screenshotDir
        }), { "Content-Type": "application/json; charset=utf-8" });
        return;
      }
      send(res, 200, JSON.stringify({
        folder: screenshotDir,
        files: files.map(file => ({
          name: file.name,
          size: file.size,
          mtimeMs: file.mtimeMs,
          url: `/api/screenshots/file?name=${encodeURIComponent(file.name)}&t=${Math.round(file.mtimeMs)}`
        }))
      }), { "Content-Type": "application/json; charset=utf-8" });
      return;
    }

    if (url.pathname === "/api/screenshots/file") {
      const name = path.basename(url.searchParams.get("name") || "");
      if (!name || !/\.(png|jpg|jpeg|webp)$/i.test(name)) {
        send(res, 400, "Invalid screenshot name");
        return;
      }
      const filePath = path.resolve(screenshotDir, name);
      if (!filePath.startsWith(path.resolve(screenshotDir))) {
        send(res, 403, "Forbidden");
        return;
      }
      const body = await fs.readFile(filePath);
      send(res, 200, body, { "Content-Type": contentType(filePath), "Cache-Control": "no-cache" });
      return;
    }

    if (url.pathname === "/api/screenshots/latest-file") {
      const latest = await latestScreenshot();
      if (!latest) {
        send(res, 404, "No screenshot found");
        return;
      }
      const body = await fs.readFile(latest.path);
      send(res, 200, body, { "Content-Type": contentType(latest.path), "Cache-Control": "no-cache" });
      return;
    }

    if (url.pathname === "/api/training/screenshots") {
      const limit = Math.max(1, Math.min(200, Number(url.searchParams.get("limit")) || 100));
      const files = await listImageFiles(trainingScreenshotDir, limit);
      send(res, 200, JSON.stringify({
        folder: trainingScreenshotDir,
        files: files.map(file => ({
          name: file.name,
          size: file.size,
          mtimeMs: file.mtimeMs,
          url: `/api/training/file?name=${encodeURIComponent(file.name)}&t=${Math.round(file.mtimeMs)}`
        }))
      }), { "Content-Type": "application/json; charset=utf-8" });
      return;
    }

    if (url.pathname === "/api/training/file") {
      const name = path.basename(url.searchParams.get("name") || "");
      if (!name || !/\.(png|jpg|jpeg|webp)$/i.test(name)) {
        send(res, 400, "Invalid training screenshot name");
        return;
      }
      const filePath = path.resolve(trainingScreenshotDir, name);
      if (!filePath.startsWith(path.resolve(trainingScreenshotDir))) {
        send(res, 403, "Forbidden");
        return;
      }
      const body = await fs.readFile(filePath);
      send(res, 200, body, { "Content-Type": contentType(filePath), "Cache-Control": "no-cache" });
      return;
    }

    if (url.pathname === "/api/training/expected") {
      if (!fsSync.existsSync(trainingExpectedPath)) {
        send(res, 404, JSON.stringify({ error: "No training expected.json found" }), { "Content-Type": "application/json; charset=utf-8" });
        return;
      }
      const body = await fs.readFile(trainingExpectedPath, "utf8");
      send(res, 200, body, { "Content-Type": "application/json; charset=utf-8", "Cache-Control": "no-cache" });
      return;
    }

    if (url.pathname.startsWith("/api/kmb/")) {
      const suffix = url.pathname.replace("/api/kmb", "");
      const target = `${kmbBase}${suffix}${url.search}`;
      const data = await fetchWithCache(target, 5 * 60_000);
      send(res, data.status, data.body, { "Content-Type": data.type });
      return;
    }

    if (url.pathname === "/api/address/suggest") {
      const query = url.searchParams.get("q") || "";
      const local = searchLocalPlaces(query);
      let map = [];
      if (query.trim().length >= 2) {
        try {
          map = await searchMapPlaces(query, Number(url.searchParams.get("limit") || 5));
        } catch {
          map = [];
        }
      }
      const seen = new Set();
      const data = [...local, ...map].filter(place => {
        const key = `${place.labelZh}|${place.lat}|${place.lng}`;
        if (seen.has(key)) return false;
        seen.add(key);
        return true;
      }).slice(0, Number(url.searchParams.get("limit") || 8));
      send(res, 200, JSON.stringify({ data }), { "Content-Type": "application/json; charset=utf-8" });
      return;
    }

    if (url.pathname === "/api/address/places") {
      send(res, 200, JSON.stringify({
        data: localGazetteer.map(place => ({
          source: "local",
          label: `${place.labelZh} ${place.labelEn}`,
          labelZh: place.labelZh,
          labelEn: place.labelEn,
          keys: place.keys,
          lat: place.lat,
          lng: place.lng
        }))
      }), { "Content-Type": "application/json; charset=utf-8" });
      return;
    }

    if (url.pathname === "/api/address") {
      const query = url.searchParams.get("q");
      if (!query) {
        send(res, 400, JSON.stringify({ error: "Missing q" }), { "Content-Type": "application/json; charset=utf-8" });
        return;
      }
      const local = lookupLocalPlace(query);
      if (local && Number.isFinite(local.lat) && Number.isFinite(local.lng)) {
        send(res, 200, JSON.stringify({
          source: "local",
          label: `${local.labelZh} ${local.labelEn}`,
          labelZh: local.labelZh,
          labelEn: local.labelEn,
          lat: local.lat,
          lng: local.lng
        }), { "Content-Type": "application/json; charset=utf-8" });
        return;
      }
      try {
        const target = `${addressBase}?q=${encodeURIComponent(query)}&n=${encodeURIComponent(url.searchParams.get("n") || "1")}`;
        const data = await fetchWithCache(target, 24 * 60 * 60_000);
        if (data.status < 200 || data.status >= 300) throw new Error(`Address service ${data.status}`);
        send(res, data.status, data.body, { "Content-Type": data.type });
      } catch {
        const first = (await searchMapPlaces(query, 1))[0];
        if (!first) {
          send(res, 404, JSON.stringify({ error: `Address not found: ${query}` }), { "Content-Type": "application/json; charset=utf-8" });
          return;
        }
        send(res, 200, JSON.stringify(first), { "Content-Type": "application/json; charset=utf-8" });
      }
      return;
    }

    send(res, 404, JSON.stringify({ error: "Unknown API" }), { "Content-Type": "application/json; charset=utf-8" });
  } catch (error) {
    send(res, 502, JSON.stringify({ error: error.message }), { "Content-Type": "application/json; charset=utf-8" });
  }
}

async function handleStatic(res, url) {
  const requested = url.pathname === "/" ? "/index.html" : decodeURIComponent(url.pathname);
  const filePath = path.resolve(root, `.${requested}`);
  if (!filePath.startsWith(root)) {
    send(res, 403, "Forbidden");
    return;
  }

  try {
    const body = await fs.readFile(filePath);
    send(res, 200, body, { "Content-Type": contentType(filePath), "Cache-Control": "no-cache" });
  } catch {
    send(res, 404, "Not found");
  }
}

const server = http.createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host || "localhost"}`);
  if (url.pathname.startsWith("/api/")) {
    await handleApi(req, res, url);
    return;
  }
  await handleStatic(res, url);
});

server.listen(port, host, () => {
  console.log(`HK transit planner is online: http://127.0.0.1:${port}`);
});
