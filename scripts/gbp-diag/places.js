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

/**
 * 同エリア・同業種の競合を Text Search で取得し、Place Details を取得する。
 * 対象事業者は除外する。
 *
 * 再現性についての注記（Q-1）: locationBias で対象事業者周辺3km円に絞り込むが、
 * Google Text Search のランキング自体は検索時点の内部シグナルに依存するため、
 * 同一条件での再実行でも競合セットが完全に一致する保証はない。
 * 取得した競合セットは data.json にそのまま保存されるため、後から検証可能。
 */
async function fetchCompetitors(area, category, excludePlaceId, apiKey, limit = 8, targetLocation) {
  const locationBias = targetLocation
    ? { latitude: targetLocation.latitude, longitude: targetLocation.longitude, radius: 3000 }
    : undefined;
  const candidates = await searchText(`${area} ${category}`, apiKey, { locationBias });
  const filtered = candidates.filter((p) => p.id !== excludePlaceId).slice(0, limit);
  const details = [];
  for (const c of filtered) {
    details.push(await getDetails(c.id, apiKey));
  }
  return details;
}

module.exports = { getApiKey, searchText, getDetails, fetchTargetPlace, fetchCompetitors };
