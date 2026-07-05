'use strict';

const BASE_URL = 'https://places.googleapis.com/v1/places';

const DETAILS_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'nationalPhoneNumber',
  'websiteUri',
  'regularOpeningHours',
  'businessStatus',
  'rating',
  'userRatingCount',
  'reviews',
  'reviews.publishTime',
  'reviews.relativePublishTimeDescription',
  'types',
  'primaryType',
  'photos',
  'location',
].join(',');

function getApiKey() {
  const key = process.env.GOOGLE_PLACES_API_KEY;
  if (!key) {
    throw new Error(
      'GOOGLE_PLACES_API_KEY が設定されていません。~/.secrets/gbp-diag.env に保存し、起動時に読み込んでください。'
    );
  }
  return key;
}

/**
 * locationBias: 対象事業者の座標が分かっている場合、その周辺円内を優先させる。
 * 未指定だとGoogle側のランキングのみに依存し、競合セットの再現性が下がる（Q-1対応）。
 */
async function searchText(query, apiKey, { locationBias } = {}) {
  const body = { textQuery: query, languageCode: 'ja', regionCode: 'JP' };
  if (locationBias) {
    body.locationBias = {
      circle: {
        center: { latitude: locationBias.latitude, longitude: locationBias.longitude },
        radius: locationBias.radius || 3000,
      },
    };
  }
  const res = await fetch(`${BASE_URL}:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    throw new Error(`Places searchText failed: ${res.status} ${errBody}`);
  }
  const data = await res.json();
  return data.places || [];
}

/**
 * 対象事業者の座標を中心に、指定タイプの事業者を構造化フィルタで取得する。
 * Text Searchのテキストクエリ（自由文）は同一パラメータでも実行ごとにランキングが
 * 揺れることを実測で確認したため（Q-1根本原因）、競合選定はNearby Searchに一本化する。
 * rankPreference: "POPULARITY" は2回連続で完全一致する結果セットを実測済み。
 */
async function searchNearby(includedType, center, radius, apiKey, maxResultCount = 20) {
  const res = await fetch(`${BASE_URL}:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.userRatingCount',
    },
    body: JSON.stringify({
      includedTypes: [includedType],
      maxResultCount,
      languageCode: 'ja',
      regionCode: 'JP',
      locationRestriction: { circle: { center, radius } },
      rankPreference: 'POPULARITY',
    }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Places searchNearby failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return data.places || [];
}

async function getDetails(placeId, apiKey) {
  const res = await fetch(
    `${BASE_URL}/${placeId}?languageCode=ja&regionCode=JP`,
    {
      headers: {
        'X-Goog-Api-Key': apiKey,
        'X-Goog-FieldMask': DETAILS_FIELDS,
      },
    }
  );
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Places getDetails failed: ${res.status} ${body}`);
  }
  return res.json();
}

/**
 * 対象事業者を検索し、Place Details を取得する。
 * 複数候補がヒットした場合は最初の1件を採用する。
 */
async function fetchTargetPlace(name, area, apiKey) {
  const candidates = await searchText(`${area} ${name}`, apiKey);
  if (candidates.length === 0) {
    return null;
  }
  const details = await getDetails(candidates[0].id, apiKey);
  return details;
}

const COMPETITOR_RADIUS_METERS = 3000;
const COMPETITOR_CANDIDATE_POOL = 20; // Nearby Searchの取得件数上限

/**
 * 同エリア・同業種の競合を取得する。対象事業者は除外する。
 *
 * 再現性についての注記（Q-1回答・根本原因）:
 * 旧実装はText Search（自由文クエリ）を使っていたが、実測の結果、
 * 同一パラメータ（テキスト・languageCode・regionCode・locationBias）で連続実行しても
 * 返却順序・件数がそのつど変わることを確認した（例: 「株式会社エイブル 松戸店」が
 * 実行によって候補に入ったり消えたりした。languageCode/regionCodeの追加自体が
 * 原因ではなく、Text Search内部の関連度ランキングが検索時点で揺れることが原因）。
 * このため競合発見はNearby Search（構造化フィルタ）に一本化した。
 * includedTypes + locationRestriction（対象事業者座標中心・半径3km）+
 * rankPreference: "POPULARITY" の組み合わせは、同一条件で2回連続実行し
 * 候補セットが完全一致することを実測で確認済み。
 * 取得した候補プール（最大20件）からは、こちらのコード側でuserRatingCount降順に
 * 決定論的にソートして上位N件を選ぶ（タイは place id 昇順で確定させる）。
 */
async function fetchCompetitors(targetLocation, category, excludePlaceId, apiKey, limit = 8) {
  if (!targetLocation) {
    throw new Error('targetLocation が取得できていません（Place Details の location フィールドを確認）');
  }
  const candidates = await searchNearby(
    category,
    targetLocation,
    COMPETITOR_RADIUS_METERS,
    apiKey,
    COMPETITOR_CANDIDATE_POOL
  );
  const filtered = candidates
    .filter((p) => p.id !== excludePlaceId)
    .sort((a, b) => (b.userRatingCount || 0) - (a.userRatingCount || 0) || (a.id < b.id ? -1 : 1))
    .slice(0, limit);
  const details = [];
  for (const c of filtered) {
    details.push(await getDetails(c.id, apiKey));
  }
  return details;
}

module.exports = { getApiKey, searchText, searchNearby, getDetails, fetchTargetPlace, fetchCompetitors };
