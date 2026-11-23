// Google Maps（Places API (New) と Maps Embed API）への通信をここに集める。
// 画面側が API の細かい仕様（フィールドマスクなど）を知らずに済むようにするため。

import { buildSearchText, describeHolidays, describeStatus, guessBrand } from './place-info.js';

const PLACES_BASE = 'https://places.googleapis.com/v1';
const EMBED_BASE = 'https://www.google.com/maps/embed/v1';

// Places API (New) は取得する項目ごとに料金区分が決まる。
// 検索では一覧に要る最小限だけ取り、電話・営業時間など高い区分の項目は詳細取得の1回に絞る。
const SEARCH_FIELDS = [
  'places.id',
  'places.displayName',
  'places.formattedAddress',
  'places.location',
].join(',');

const DETAIL_FIELDS = [
  'id',
  'displayName',
  'formattedAddress',
  'location',
  'nationalPhoneNumber',
  'regularOpeningHours',
  'currentOpeningHours.openNow',
  'businessStatus',
  'rating',
  'userRatingCount',
  'websiteUri',
  'googleMapsUri',
].join(',');

/** 画面に出す文言をエラーの種類ごとに持たせ、呼び出し側は message を出すだけで済むようにする。 */
export class ApiError extends Error {
  constructor(kind, message) {
    super(message);
    this.kind = kind;
  }
}

async function request(url, { key, signal, fields, method = 'GET', body }) {
  let res;
  try {
    res = await fetch(url, {
      method,
      signal,
      // ブラウザ標準では別サイトへの通信にドメインまでしか送らず（例: https://xxx.github.io/）、
      // キーのウェブサイト制限（…/Shin_ss-finder/*）と一致せず 403 になる。ページの URL まで送って照合させる
      referrerPolicy: 'no-referrer-when-downgrade',
      headers: {
        'Content-Type': 'application/json',
        'X-Goog-Api-Key': key,
        'X-Goog-FieldMask': fields,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
  } catch (err) {
    if (err.name === 'AbortError') {
      throw new ApiError('aborted', '検索をキャンセルしました。');
    }
    throw new ApiError('network', '通信できませんでした。インターネット接続を確認してください。');
  }
  if (!res.ok) {
    throw await toApiError(res);
  }
  // 応答が途中で切れるなどして読めなかったとき、英語の内部エラーをそのまま画面に出さないため
  return res.json().catch(() => {
    throw new ApiError('unknown', '応答を読み取れませんでした。時間をおいて試してください。');
  });
}

async function toApiError(res) {
  const detail = await res.json().catch(() => ({}));
  const serverMessage = detail?.error?.message || '';
  // 原因調査のため、Google からの英語メッセージは開発者ツールにだけ残す
  console.warn('Places API エラー', res.status, serverMessage);
  if (res.status === 400 && /api key/i.test(serverMessage)) {
    return new ApiError('invalid_key', 'APIキーが正しくありません。「APIキー設定」から入れ直してください。');
  }
  if (res.status === 403) {
    return new ApiError('forbidden', 'このキーは使えませんでした。キーのウェブサイト制限や、Places API (New) が有効かを確認してください。');
  }
  if (res.status === 429) {
    return new ApiError('quota', '今日の検索回数の上限に達しました。日本時間の夕方以降に、もう一度お試しください。');
  }
  return new ApiError('unknown', `検索に失敗しました（エラー ${res.status}）。時間をおいて試してください。`);
}

/** 店舗名や地名で検索し、候補の一覧を返す（ガソリンスタンドに限定）。 */
export async function searchPlaces(query, { key, signal }) {
  const data = await request(`${PLACES_BASE}/places:searchText`, {
    key,
    signal,
    method: 'POST',
    fields: SEARCH_FIELDS,
    body: {
      textQuery: buildSearchText(query),
      languageCode: 'ja',
      regionCode: 'JP',
      includedType: 'gas_station',
      strictTypeFiltering: true,
      pageSize: 10,
    },
  });
  return (data.places || []).map((p) => ({
    id: p.id,
    name: p.displayName?.text || '（名称不明）',
    address: p.formattedAddress || '',
    location: p.location || null,
  }));
}

/** 1件の詳細を取り、画面でそのまま使える形に整えて返す。 */
export async function getPlaceDetails(placeId, { key, signal }) {
  const url = `${PLACES_BASE}/places/${encodeURIComponent(placeId)}?languageCode=ja&regionCode=JP`;
  const p = await request(url, { key, signal, fields: DETAIL_FIELDS });
  const name = p.displayName?.text || '（名称不明）';
  return {
    id: p.id,
    name,
    address: p.formattedAddress || '',
    location: p.location || null,
    phone: p.nationalPhoneNumber || '',
    hours: (p.regularOpeningHours?.weekdayDescriptions || []).join('\n'),
    status: describeStatus(p.businessStatus, p.currentOpeningHours?.openNow),
    holidays: describeHolidays(p.regularOpeningHours),
    brand: guessBrand(name),
    // Places API に運営会社の項目は無い（仕様書 5.3）。取れないことを明示するため空にしておく
    operator: '',
    rating: typeof p.rating === 'number' ? `★ ${p.rating.toFixed(1)}（${p.userRatingCount || 0}件）` : '',
    website: p.websiteUri || '',
    mapsUrl: p.googleMapsUri || '',
  };
}

/** 地図の埋め込み URL。place_id で指定すると同名店舗の取り違えが起きない。 */
export function mapEmbedUrl(key, placeId) {
  const q = new URLSearchParams({ key, q: `place_id:${placeId}`, language: 'ja', region: 'JP' });
  return `${EMBED_BASE}/place?${q}`;
}

/** ストリートビューの埋め込み URL。ストリートビューは座標でしか指定できない。 */
export function streetViewEmbedUrl(key, location) {
  const q = new URLSearchParams({ key, location: `${location.latitude},${location.longitude}`, language: 'ja' });
  return `${EMBED_BASE}/streetview?${q}`;
}
