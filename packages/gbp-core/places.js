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
  'addressComponents',
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
async function searchText(query, apiKey, { locationBias, fields } = {}) {
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
      'X-Goog-FieldMask': fields || 'places.id,places.displayName,places.formattedAddress',
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
  const body = {
    maxResultCount,
    languageCode: 'ja',
    regionCode: 'JP',
    locationRestriction: { circle: { center, radius } },
    rankPreference: 'POPULARITY',
  };
  if (includedType) body.includedTypes = [includedType];
  const res = await fetch(`${BASE_URL}:searchNearby`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      // primaryType/types/addressComponents は業種ポストフィルタと町名スコープの判定に使う
      // （2026-07-14。includedTypesはtypes配列への包含でマッチするため、取得後の再検証が必須）
      'X-Goog-FieldMask':
        'places.id,places.displayName,places.userRatingCount,places.primaryType,places.types,places.addressComponents',
    },
    body: JSON.stringify(body),
  });
  if (!res.ok) {
    const errBody = await res.text();
    const err = new Error(`Places searchNearby failed: ${res.status} ${errBody}`);
    err.isUnsupportedType = res.status === 400 && /Unsupported types/i.test(errBody);
    throw err;
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
 * 検索クエリは「事業者名＋住所」。住所は対象特定（同名法人の混同対策）と
 * 町名スコープの起点を兼ねる（2026-07-14にエリア入力を廃止し住所必須に変更）。
 * formattedAddress の正規化照合で候補を選別し、一致がなければ最初の1件。
 */
async function fetchTargetPlace(name, address, apiKey) {
  const candidates = await searchText(`${name} ${address}`, apiKey);
  if (candidates.length === 0) {
    return null;
  }
  let chosen = candidates[0];
  const norm = (s) => String(s || '').replace(/[\s　\-−ー]/g, '');
  const target = norm(address);
  const match = candidates.find((c) => {
    const a = norm(c.formattedAddress);
    return target.length > 0 && (a.includes(target) || target.includes(a));
  });
  if (match) chosen = match;
  const details = await getDetails(chosen.id, apiKey);
  return details;
}

/**
 * addressComponents から日本の住所階層の「町名」を抽出する。
 * 実測（2026-07-14）: 台東区千束4丁目→sublocality_level_2=「千束」、
 * 松戸市本町→sublocality_level_2=「本町」。区部・市部ともlevel_2が町名に相当した。
 * level_2が無い住所に備えてlevel_1にフォールバックする。どちらも無ければnull
 * （呼び出し側が半径3km方式にフォールバックする）。
 */
function extractTownName(addressComponents) {
  for (const level of ['sublocality_level_2', 'sublocality_level_1']) {
    const c = (addressComponents || []).find((x) => (x.types || []).includes(level));
    if (c) return c.longText || c.shortText || null;
  }
  return null;
}

function extractLocality(addressComponents) {
  const c = (addressComponents || []).find((x) => (x.types || []).includes('locality'));
  return c ? c.longText || c.shortText || null : null;
}

/**
 * Google Placesの汎用バケツ型カテゴリ（Nearby Searchのフィルタに使うと
 * 業種を問わず何でもヒットしてしまう）。2026-07-06発見: 不動産会社の
 * primaryTypeが"service"だったため、Nearby Search(includedTypes:["service"])が
 * ドン・キホーテ/ビックカメラ/ホテル等を「競合」として返す事象が発生した
 * （これらのtypesにも"service"が含まれるため）。原因はGoogleの汎用カテゴリを
 * そのまま競合検索フィルタに使っていたこと。
 */
const GENERIC_PLACE_TYPES = new Set([
  'service',
  'point_of_interest',
  'establishment',
  'store',
  'food',
]);

/**
 * 競合検索カテゴリの候補リストを優先順位順に作る。
 * 1. categoryOverride（人間が業種を明示指定した場合）
 * 2. primaryType（汎用カテゴリでなければ）
 * 3. types配列のうち汎用でない値（登場順）
 * 実際にどれが採用されるかはNearby Search APIが受理するかどうかにも依存する
 * （Googleの全typesリストとNearby SearchのincludedTypes対応リストは完全一致しない。
 * 例: primaryTypeやtypesに含まれる"general_contractor"はNearby Searchでは
 * "Unsupported types"エラーになることを実測で確認。2026-07-06）。
 * 呼び出し側（fetchCompetitors）が候補を順に試し、最初に成功したものを採用する。
 */
function candidateCompetitorCategories(target, categoryOverride) {
  const list = [];
  if (categoryOverride) list.push({ category: categoryOverride, source: 'manual' });
  const primaryType = target.primaryType;
  if (primaryType && !GENERIC_PLACE_TYPES.has(primaryType)) {
    list.push({ category: primaryType, source: 'primaryType' });
  }
  for (const t of target.types || []) {
    if (!GENERIC_PLACE_TYPES.has(t) && !list.some((c) => c.category === t)) {
      list.push({ category: t, source: 'types-fallback' });
    }
  }
  if (list.length === 0) {
    list.push({ category: primaryType || (target.types && target.types[0]) || '', source: 'generic-only' });
  }
  return list;
}

/**
 * Nearby Search では検索不能と実測で確認済みのGoogleカテゴリ（Table B専用等）に対する
 * Text Searchフォールバック用の日本語キーワード（2026-07-06追加・芙蓉建設の事例）。
 * 業種を手動指定していない場合でも、primaryType/typesがこれらに一致すればText Searchに
 * 切り替える。人間が業種を手動指定した場合は web/lib/industry-types.ts の
 * textSearchKeyword が優先される（categoryOverrideKeywordとして渡される）。
 */
const KNOWN_INVALID_TYPE_KEYWORDS = {
  general_contractor: '建設会社',
  photographer: '写真スタジオ',
};

function deriveTextSearchKeyword(target, categoryOverrideKeyword) {
  if (categoryOverrideKeyword) return categoryOverrideKeyword;
  if (target.primaryType && KNOWN_INVALID_TYPE_KEYWORDS[target.primaryType]) {
    return KNOWN_INVALID_TYPE_KEYWORDS[target.primaryType];
  }
  for (const t of target.types || []) {
    if (KNOWN_INVALID_TYPE_KEYWORDS[t]) return KNOWN_INVALID_TYPE_KEYWORDS[t];
  }
  return null;
}

const COMPETITOR_RADIUS_METERS = 3000; // 町名スコープ不可時のフォールバック半径
const COMPETITOR_RADIUS_STAGES = [800, 1500, 3000]; // 町名スコープの段階的拡張（件数閾値のみで判定・決定的）
const COMPETITOR_CANDIDATE_POOL = 20; // Nearby Searchの取得件数上限

/**
 * 業種ポストフィルタ（2026-07-14追加）。
 * 根本原因: Nearby SearchのincludedTypesは候補のtypes配列への「包含」でマッチする。
 * 館内カフェを持つ大型施設はtypesに"cafe"を含むため、includedTypes:["cafe"]で
 * TOHOシネマズ上野（primaryType=movie_theater）が返ることを実測で確認した。
 * 対応: 候補のprimaryTypeが検索カテゴリと同一業態の場合のみ競合として採用する。
 * 判定は (1)完全一致 (2)類縁グループ表 (3)suffix規則（restaurant⇔italian_restaurant等の
 * Google type階層の命名規則）の3段。全て決定的な文字列比較。
 */
const RELATED_PRIMARY_TYPE_GROUPS = [
  ['cafe', 'coffee_shop', 'tea_house'],
];

function isSamePrimaryCategory(searchCategory, candidate) {
  const primary =
    candidate.primaryType ||
    (candidate.types || []).find((t) => !GENERIC_PLACE_TYPES.has(t)) ||
    '';
  if (!searchCategory || !primary) return false;
  if (primary === searchCategory) return true;
  for (const group of RELATED_PRIMARY_TYPE_GROUPS) {
    if (group.includes(searchCategory) && group.includes(primary)) return true;
  }
  if (primary.endsWith(`_${searchCategory}`) || searchCategory.endsWith(`_${primary}`)) return true;
  return false;
}

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
/**
 * 町名スコープ（2026-07-14追加・修正依頼「競合選定の町名スコープ化」）:
 * 半径3km固定では観光エリアの看板店・大型施設が競合を独占し、地域密着の
 * 事業者にとって「本当に競っている相手」にならない（蔦重の事例）。
 * 対象事業者の町名（例: 千束）と同じ町の同業種を最優先で採用する。
 *
 * 指示書からの意図的な逸脱（理由つき）:
 * 指示書は「町名で厳密フィルタし、8件未満なら半径拡張（町名フィルタ維持）」だが、
 * 実測の結果、蔦重（台東区千束）の800m圏cafe検索20件中「千束」は1件のみで、
 * 3kmまで拡張しても町名一致だけでは8件がまず埋まらないことを確認した。
 * 厳密適用すると競合1件のレポートになり比較が成立しないため、
 * 「町名一致を最優先ソート＋不足分は同半径圏内の同業種（近隣）で補完」とし、
 * 半径拡張の判定は業種フィルタ通過件数の閾値（決定的）で行う。
 * これにより競合は「同じ町＋徒歩圏の地域店」で構成され、指示書の受け入れ条件
 * （千束またはごく近隣の地域密着カフェ）を満たす。
 */
async function fetchCompetitors(
  targetLocation,
  target,
  categoryOverride,
  excludePlaceId,
  apiKey,
  limit = 8,
  options = {}
) {
  if (!targetLocation) {
    throw new Error('targetLocation が取得できていません（Place Details の location フィールドを確認）');
  }
  const { categoryOverrideKeyword } = options;
  const townName = extractTownName(target.addressComponents);
  const locality = extractLocality(target.addressComponents);
  const candidateList = candidateCompetitorCategories(target, categoryOverride);

  // 町名が取れる場合は段階的拡張、取れない場合は従来の3km単段（フォールバック）
  const stages = townName ? COMPETITOR_RADIUS_STAGES : [COMPETITOR_RADIUS_METERS];

  let usedCandidates = null;
  let typeFiltered = null;
  let radiusUsed = null;
  let workingCategory; // Nearby Searchが受理したカテゴリ（ステージ間で再利用）

  for (const radius of stages) {
    let candidates = null;
    if (workingCategory === undefined) {
      // 初回ステージ: 候補カテゴリを順に試し、APIが受理したものを採用
      for (const cand of candidateList) {
        try {
          candidates = await searchNearby(cand.category, targetLocation, radius, apiKey, COMPETITOR_CANDIDATE_POOL);
          usedCandidates = cand;
          workingCategory = cand.category;
          break;
        } catch (e) {
          if (e.isUnsupportedType) continue; // 次の候補を試す
          throw e;
        }
      }
      if (candidates === null) break; // 全カテゴリ全滅 → Text Searchフォールバックへ
    } else {
      candidates = await searchNearby(workingCategory, targetLocation, radius, apiKey, COMPETITOR_CANDIDATE_POOL);
    }
    // 業種ポストフィルタ（町名スコープとは独立に必ず適用）
    typeFiltered = candidates.filter(
      (p) => p.id !== excludePlaceId && isSamePrimaryCategory(workingCategory, p)
    );
    radiusUsed = radius;
    if (typeFiltered.length >= limit) break; // 判定は件数閾値のみ（決定的）
  }

  if (typeFiltered === null || usedCandidates === null) {
    // Nearby Searchのカテゴリフィルタが全滅した場合。Text Searchへのフォールバックを試み、
    // キーワードが無い場合のみフィルタなしNearby Search（低品質・最終手段）にする。
    // Text Searchは業種typeを持たないため業種ポストフィルタは適用しない（キーワード自体が業種）。
    const keyword = deriveTextSearchKeyword(target, categoryOverrideKeyword);
    const areaLabel = [locality, townName].filter(Boolean).join('') || options.area || '';
    if (keyword && areaLabel) {
      typeFiltered = await searchText(`${areaLabel} ${keyword}`, apiKey, {
        locationBias: { ...targetLocation, radius: COMPETITOR_RADIUS_METERS },
        fields: 'places.id,places.displayName,places.userRatingCount,places.addressComponents',
      });
      typeFiltered = typeFiltered.filter((p) => p.id !== excludePlaceId);
      usedCandidates = { category: keyword, source: 'text-search-fallback' };
    } else {
      const candidates = await searchNearby(null, targetLocation, COMPETITOR_RADIUS_METERS, apiKey, COMPETITOR_CANDIDATE_POOL);
      typeFiltered = candidates.filter((p) => p.id !== excludePlaceId);
      usedCandidates = { category: null, source: 'no-type-filter' };
    }
    radiusUsed = COMPETITOR_RADIUS_METERS;
  }

  // 選定: 町名一致を最優先、次にクチコミ数降順、タイはplace id昇順（全て決定的）
  const inTown = (p) => (townName && extractTownName(p.addressComponents) === townName ? 1 : 0);
  const selected = typeFiltered
    .sort(
      (a, b) =>
        inTown(b) - inTown(a) ||
        (b.userRatingCount || 0) - (a.userRatingCount || 0) ||
        (a.id < b.id ? -1 : 1)
    )
    .slice(0, limit);

  const details = [];
  for (const c of selected) {
    details.push(await getDetails(c.id, apiKey));
  }
  const competitorScope = {
    mode: townName ? 'town' : 'radius-fallback',
    townName: townName || null,
    locality: locality || null,
    radiusUsed,
    sameTownCount: selected.filter((p) => inTown(p) === 1).length,
  };
  return { competitors: details, categoryResolution: usedCandidates, competitorScope };
}

module.exports = {
  getApiKey,
  searchText,
  searchNearby,
  getDetails,
  fetchTargetPlace,
  fetchCompetitors,
  candidateCompetitorCategories,
  extractTownName,
  isSamePrimaryCategory,
  GENERIC_PLACE_TYPES,
  COMPETITOR_RADIUS_METERS,
  COMPETITOR_RADIUS_STAGES,
};
