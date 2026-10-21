// 六大洲分頁（Ken 2026-10-21 要求把「世界」拆成各洲一頁）：每一洲沿用世界地圖與世界的知識卡，
// 只取那一洲的國家，再依地理分成幾個分區。熟練度仍記在世界（store 的 world），各洲另外記今日挑戰與最佳成績。
// 分區大致照聯合國地理分區，臺灣慣用的叫法優先（伊朗放西亞、英國愛爾蘭放西歐、德奧瑞放中歐）。
window.KMAP_CONTINENTS = {
  asia: {
    eastasia: { color: '#d0603f', zh: '東亞', en: 'East Asia', ja: '東アジア', ids: ['CHN', 'JPN', 'KOR', 'PRK', 'MNG', 'TWN'] },
    seasia: { color: '#3c9a6a', zh: '東南亞', en: 'Southeast Asia', ja: '東南アジア', ids: ['BRN', 'IDN', 'KHM', 'LAO', 'MMR', 'MYS', 'PHL', 'SGP', 'THA', 'TLS', 'VNM'] },
    southasia: { color: '#d6a73a', zh: '南亞', en: 'South Asia', ja: '南アジア', ids: ['AFG', 'BGD', 'BTN', 'IND', 'LKA', 'MDV', 'NPL', 'PAK'] },
    centralasia: { color: '#5b8fd9', zh: '中亞', en: 'Central Asia', ja: '中央アジア', ids: ['KAZ', 'KGZ', 'TJK', 'TKM', 'UZB'] },
    westasia: { color: '#9a74c9', zh: '西亞', en: 'West Asia', ja: '西アジア', ids: ['ARE', 'ARM', 'AZE', 'BHR', 'CYP', 'GEO', 'IRN', 'IRQ', 'ISR', 'JOR', 'KWT', 'LBN', 'OMN', 'PSX', 'QAT', 'SAU', 'SYR', 'TUR', 'YEM'] },
  },
  europe: {
    north: { color: '#5b8fd9', zh: '北歐', en: 'Northern Europe', ja: '北欧', ids: ['DNK', 'EST', 'FIN', 'ISL', 'LTU', 'LVA', 'NOR', 'SWE'] },
    west: { color: '#d0603f', zh: '西歐', en: 'Western Europe', ja: '西欧', ids: ['BEL', 'FRA', 'GBR', 'IRL', 'LUX', 'MCO', 'NLD'] },
    central: { color: '#3c9a6a', zh: '中歐', en: 'Central Europe', ja: '中欧', ids: ['AUT', 'CHE', 'CZE', 'DEU', 'HUN', 'LIE', 'POL', 'SVK', 'SVN'] },
    south: { color: '#d6a73a', zh: '南歐', en: 'Southern Europe', ja: '南欧', ids: ['AND', 'ESP', 'GRC', 'ITA', 'MLT', 'PRT', 'SMR', 'VAT'] },
    balkans: { color: '#9a74c9', zh: '巴爾幹', en: 'Balkans', ja: 'バルカン', ids: ['ALB', 'BIH', 'BGR', 'HRV', 'KOS', 'MKD', 'MNE', 'SRB'] },
    east: { color: '#4aa3a0', zh: '東歐', en: 'Eastern Europe', ja: '東欧', ids: ['BLR', 'MDA', 'ROU', 'RUS', 'UKR'] },
  },
  africa: {
    north: { color: '#d6a73a', zh: '北非', en: 'North Africa', ja: '北アフリカ', ids: ['DZA', 'EGY', 'LBY', 'MAR', 'SDN', 'TUN'] },
    west: { color: '#d0603f', zh: '西非', en: 'West Africa', ja: '西アフリカ', ids: ['BEN', 'BFA', 'CIV', 'CPV', 'GHA', 'GIN', 'GMB', 'GNB', 'LBR', 'MLI', 'MRT', 'NER', 'NGA', 'SEN', 'SLE', 'TGO'] },
    central: { color: '#3c9a6a', zh: '中部非洲', en: 'Central Africa', ja: '中部アフリカ', ids: ['AGO', 'CAF', 'CMR', 'COD', 'COG', 'GAB', 'GNQ', 'STP', 'TCD'] },
    east: { color: '#5b8fd9', zh: '東非', en: 'East Africa', ja: '東アフリカ', ids: ['BDI', 'COM', 'DJI', 'ERI', 'ETH', 'KEN', 'MDG', 'MOZ', 'MUS', 'MWI', 'RWA', 'SDS', 'SOM', 'SYC', 'TZA', 'UGA', 'ZMB', 'ZWE'] },
    south: { color: '#9a74c9', zh: '南部非洲', en: 'Southern Africa', ja: '南部アフリカ', ids: ['BWA', 'LSO', 'NAM', 'SWZ', 'ZAF'] },
  },
  namerica: {
    mainland: { color: '#5b8fd9', zh: '北美本土', en: 'Mainland', ja: '北米本土', ids: ['CAN', 'USA', 'MEX'] },
    central: { color: '#3c9a6a', zh: '中美洲', en: 'Central America', ja: '中米', ids: ['BLZ', 'CRI', 'GTM', 'HND', 'NIC', 'PAN', 'SLV'] },
    caribbean: { color: '#d0603f', zh: '加勒比海', en: 'Caribbean', ja: 'カリブ海', ids: ['ATG', 'BHS', 'BRB', 'CUB', 'DMA', 'DOM', 'GRD', 'HTI', 'JAM', 'KNA', 'LCA', 'TTO', 'VCT'] },
  },
  samerica: {
    north: { color: '#3c9a6a', zh: '北部', en: 'North', ja: '北部', ids: ['BRA', 'GUY', 'SUR', 'VEN'] },
    andes: { color: '#d0603f', zh: '安地斯', en: 'Andes', ja: 'アンデス', ids: ['BOL', 'CHL', 'COL', 'ECU', 'PER'] },
    southcone: { color: '#5b8fd9', zh: '南錐', en: 'Southern Cone', ja: '南部', ids: ['ARG', 'PRY', 'URY'] },
  },
  oceania: {
    australasia: { color: '#d0603f', zh: '澳紐', en: 'Australasia', ja: 'オーストラレーシア', ids: ['AUS', 'NZL'] },
    melanesia: { color: '#3c9a6a', zh: '美拉尼西亞', en: 'Melanesia', ja: 'メラネシア', ids: ['FJI', 'PNG', 'SLB', 'VUT'] },
    micronesia: { color: '#5b8fd9', zh: '密克羅尼西亞群島', en: 'Micronesia', ja: 'ミクロネシア', ids: ['FSM', 'KIR', 'MHL', 'NRU', 'PLW'] },
    polynesia: { color: '#9a74c9', zh: '玻里尼西亞', en: 'Polynesia', ja: 'ポリネシア', ids: ['TON', 'TUV', 'WSM'] },
  },
};
