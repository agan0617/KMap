// 世界區的共用設定：各洲、卡片欄位名稱、護照。各國的知識卡在 data/world-units-*.js（中英日寫在一起）。
window.KMAP_INFO = window.KMAP_INFO || {};
window.KMAP_INFO.world = Object.assign(window.KMAP_INFO.world || { units: {} }, {
  schema: 'multi',
  stamp: 'passport',
  flags: true,
  areas: {
    asia: { color: '#d0603f', zh: '亞洲', en: 'Asia', ja: 'アジア' },
    europe: { color: '#5b8fd9', zh: '歐洲', en: 'Europe', ja: 'ヨーロッパ' },
    africa: { color: '#d6a73a', zh: '非洲', en: 'Africa', ja: 'アフリカ' },
    namerica: { color: '#6aae5b', zh: '北美洲', en: 'North America', ja: '北アメリカ' },
    samerica: { color: '#9a74c9', zh: '南美洲', en: 'South America', ja: '南アメリカ' },
    oceania: { color: '#4aa3a0', zh: '大洋洲', en: 'Oceania', ja: 'オセアニア' },
  },
  labels: {
    zh: { cap: '首都', book: '護照' },
    en: { cap: 'Capital', book: 'Passport' },
    ja: { cap: '首都', book: 'パスポート' },
  },
});
