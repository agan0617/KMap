// 中國區的共用設定：分區、卡片欄位名稱、集章冊。各省的知識卡在 data/china-units-*.js（中英日寫在一起）。
window.KMAP_INFO = window.KMAP_INFO || {};
window.KMAP_INFO.china = Object.assign(window.KMAP_INFO.china || { units: {} }, {
  schema: 'multi',
  stamp: 'seal',
  areas: {
    north: { color: '#c7607a', zh: '華北', en: 'North', ja: '華北' },
    northeast: { color: '#5b8fd9', zh: '東北', en: 'Northeast', ja: '東北' },
    east: { color: '#e0864a', zh: '華東', en: 'East', ja: '華東' },
    central: { color: '#6aae5b', zh: '華中', en: 'Central', ja: '華中' },
    south: { color: '#d0603f', zh: '華南', en: 'South', ja: '華南' },
    southwest: { color: '#9a74c9', zh: '西南', en: 'Southwest', ja: '西南' },
    northwest: { color: '#d6a73a', zh: '西北', en: 'Northwest', ja: '西北' },
  },
  labels: {
    zh: { cap: '省會', old: '簡稱', dia: '方言', book: '集章冊' },
    en: { cap: 'Capital', old: 'Abbreviation', dia: 'Dialect', book: 'Seal Book' },
    ja: { cap: '省都', old: '略称', dia: '方言', book: '印章帳' },
  },
});
