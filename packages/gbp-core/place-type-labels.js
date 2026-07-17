'use strict';

/**
 * Google Places APIのtype識別子（英語）→日本語ラベルのマッピング。
 * Places APIはtypesの日本語ラベルを返さないため自前で保持する（2026-07-17追加）。
 * 「登録カテゴリ表示」セクション（primaryType・追加カテゴリの日本語表示）で使用。
 * 未収録の値は識別子をそのまま返す（フォールバック。表示が英語のままでもデータは失わない）。
 * 旧web/lib/industry-types.tsの25業種分をベースに、飲食・小売・専門職の主要typesを追加。
 */
const PLACE_TYPE_LABELS = {
  real_estate_agency: '不動産',
  restaurant: '飲食店',
  cafe: 'カフェ',
  coffee_shop: 'コーヒーショップ',
  tea_house: '茶房',
  beauty_salon: '美容室・エステ',
  hair_salon: '理容室・ヘアサロン',
  hair_care: 'ヘアケア',
  dentist: '歯科医院',
  doctor: 'クリニック・医院',
  veterinary_care: '動物病院',
  gym: 'ジム・フィットネス',
  fitness_center: 'フィットネスセンター',
  lawyer: '法律事務所',
  accounting: '税理士・会計事務所',
  insurance_agency: '保険代理店',
  car_repair: '自動車整備',
  car_dealer: '自動車販売',
  general_contractor: '建設・工務店',
  electrician: '電気工事',
  plumber: '水道工事',
  moving_company: '引越し業',
  pet_store: 'ペットショップ',
  florist: '花屋',
  bakery: 'パン屋',
  laundry: 'クリーニング店',
  travel_agency: '旅行代理店',
  photographer: '写真スタジオ',
  consultant: 'コンサルタント',
  // 追加（蔦重等の事例で必要になった一般的なtypes）
  art_museum: '美術館',
  museum: '博物館',
  tourist_attraction: '観光名所',
  art_gallery: 'ギャラリー',
  bar: 'バー',
  night_club: 'ナイトクラブ',
  bakery_cafe: 'ベーカリーカフェ',
  dessert_shop: 'デザート店',
  ice_cream_shop: 'アイスクリーム店',
  japanese_restaurant: '日本料理店',
  italian_restaurant: 'イタリア料理店',
  chinese_restaurant: '中華料理店',
  fast_food_restaurant: 'ファストフード店',
  meal_takeaway: 'テイクアウト',
  bar_and_grill: 'バー＆グリル',
  hotel: 'ホテル',
  lodging: '宿泊施設',
  clothing_store: '衣料品店',
  shoe_store: '靴店',
  jewelry_store: '宝飾店',
  book_store: '書店',
  furniture_store: '家具店',
  hardware_store: '金物店',
  home_goods_store: '生活雑貨店',
  supermarket: 'スーパーマーケット',
  convenience_store: 'コンビニエンスストア',
  department_store: '百貨店',
  shopping_mall: 'ショッピングモール',
  liquor_store: '酒屋',
  butcher_shop: '精肉店',
  seafood_market: '鮮魚店',
  physiotherapist: '理学療法士',
  chiropractor: 'カイロプラクティック',
  massage: 'マッサージ',
  spa: 'スパ',
  yoga_studio: 'ヨガスタジオ',
  tutoring_service: '学習塾',
  school: '学校',
  preschool: '幼稚園・保育園',
  language_school: '語学学校',
  driving_school: '自動車教習所',
  bank: '銀行',
  atm: 'ATM',
  finance: '金融サービス',
  locksmith: '鍵屋',
  painter: '塗装業',
  roofing_contractor: '屋根工事',
  landscaping: '造園・エクステリア',
  storage: '倉庫・トランクルーム',
  courier_service: '運送・宅配',
  printing_shop: '印刷業',
  real_estate_appraiser: '不動産鑑定',
};

// 表示から除外する汎用タイプ。GENERIC_PLACE_TYPES(places.js)と揃える
// （検索フィルタ用の除外リストと、表示用の除外リストで基準がズレないようにする）。
const { GENERIC_PLACE_TYPES } = require('./places');

/**
 * primaryType・typesの配列から、表示用の日本語ラベル一覧を作る。
 * 汎用タイプ（point_of_interest等）は除外する。
 * @returns {{ id: string, label: string }[]} 重複除去済み・登場順
 */
function toDisplayCategories(typeIds) {
  const seen = new Set();
  const result = [];
  for (const id of typeIds || []) {
    if (!id || GENERIC_PLACE_TYPES.has(id) || seen.has(id)) continue;
    seen.add(id);
    result.push({ id, label: PLACE_TYPE_LABELS[id] || id });
  }
  return result;
}

module.exports = { PLACE_TYPE_LABELS, toDisplayCategories };
