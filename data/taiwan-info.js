// 台灣區的共用設定：分區、卡片欄位名稱、紀念章。各縣市的知識卡在 data/taiwan-units-*.js（中英日寫在一起）。
window.KMAP_INFO = window.KMAP_INFO || {};
window.KMAP_INFO.taiwan = Object.assign(window.KMAP_INFO.taiwan || { units: {} }, {
  schema: 'multi',
  stamp: 'station',
  areas: {
    north: { color: '#5b8fd9', zh: '北部', en: 'North', ja: '北部' },
    central: { color: '#6aae5b', zh: '中部', en: 'Central', ja: '中部' },
    south: { color: '#d0603f', zh: '南部', en: 'South', ja: '南部' },
    east: { color: '#4aa3a0', zh: '東部', en: 'East', ja: '東部' },
    islands: { color: '#d6a73a', zh: '離島', en: 'Outlying islands', ja: '離島' },
  },
  labels: {
    zh: { cap: '縣政府所在地', old: '舊稱', book: '紀念章冊' },
    en: { cap: 'County seat', old: 'Old name', book: 'Stamp Collection' },
    ja: { cap: '県庁所在地', old: '旧称', book: '記念スタンプ帳' },
  },
});
