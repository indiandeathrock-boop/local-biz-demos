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
  'types',
  'primaryType',
  'photos',
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

async function searchText(query, apiKey) {
  const res = await fetch(`${BASE_URL}:searchText`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': 'places.id,places.displayName,places.formattedAddress',
    },
    body: JSON.stringify({ textQuery: query, languageCode: 'ja' }),
  });
  if (!res.ok) {
    const body = await res.text();
    throw new Error(`Places searchText failed: ${res.status} ${body}`);
  }
  const data = await res.json();
  return data.places || [];
}

async function getDetails(placeId, apiKey) {
  const res = await fetch(`${BASE_URL}/${placeId}`, {
    headers: {
      'X-Goog-Api-Key': apiKey,
      'X-Goog-FieldMask': DETAILS_FIELDS,
      'X-Goog-LanguageCode': 'ja',
    },
  });
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
 */
async function fetchCompetitors(area, category, excludePlaceId, apiKey, limit = 8) {
  const candidates = await searchText(`${area} ${category}`, apiKey);
  const filtered = candidates.filter((p) => p.id !== excludePlaceId).slice(0, limit);
  const details = [];
  for (const c of filtered) {
    details.push(await getDetails(c.id, apiKey));
  }
  return details;
}

module.exports = { getApiKey, searchText, getDetails, fetchTargetPlace, fetchCompetitors };
