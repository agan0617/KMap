// 美國區的共用設定：分區、卡片欄位名稱、護照章。各州的知識卡在 data/usa-units-*.js（中英日寫在一起）。
// 2026-10-22 Ken 要求在中國後面加一頁；50 州，華盛頓特區畫進馬里蘭州。分區大致照美國人口普查局的地區，南部、中西部各自很大，西部拆成西南、山區、太平洋岸。
window.KMAP_INFO = window.KMAP_INFO || {};
window.KMAP_INFO.usa = Object.assign(window.KMAP_INFO.usa || { units: {} }, {
  schema: 'multi',
  stamp: 'passport',
  areas: {
    newengland: { color: '#5b8fd9', zh: '新英格蘭', en: 'New England', ja: 'ニューイングランド' },
    midatlantic: { color: '#9a74c9', zh: '中大西洋', en: 'Mid-Atlantic', ja: '中部大西洋岸' },
    south: { color: '#d0603f', zh: '南部', en: 'South', ja: '南部' },
    midwest: { color: '#6aae5b', zh: '中西部', en: 'Midwest', ja: '中西部' },
    southwest: { color: '#d6a73a', zh: '西南', en: 'Southwest', ja: '南西部' },
    mountain: { color: '#c7607a', zh: '山區', en: 'Mountain', ja: '山岳部' },
    pacific: { color: '#4aa3a0', zh: '太平洋岸', en: 'Pacific', ja: '太平洋岸' },
  },
  labels: {
    zh: { cap: '州首府', old: '暱稱', book: '護照' },
    en: { cap: 'Capital', old: 'Nickname', book: 'Passport' },
    ja: { cap: '州都', old: '愛称', book: 'パスポート' },
  },
});
