// LocalStorage（APIキー・検索履歴・お気に入り）の読み書きをここに集める。
// 保存形式を1か所で管理し、壊れたデータを読んだときの扱いも統一するため。

const KEY_STORAGE_NAME = 'GMAPS_API_KEY';

// プライベートモードやストレージ無効の設定では localStorage へのアクセス自体が例外になる。
// そこでアプリ全体が止まらないよう、読み書きはすべてこの2つを通して例外を握りつぶす。
function safeGet(name) {
  try {
    return window.localStorage.getItem(name);
  } catch {
    return null;
  }
}

function safeSet(name, value) {
  try {
    if (value === null) {
      window.localStorage.removeItem(name);
    } else {
      window.localStorage.setItem(name, value);
    }
    return true;
  } catch {
    return false;
  }
}

/** 保存済みのAPIキー。無ければ空文字。 */
export function loadApiKey() {
  return (safeGet(KEY_STORAGE_NAME) || '').trim();
}

/** APIキーを保存する。保存できなかったら false（呼び出し側でユーザーに伝えるため）。 */
export function saveApiKey(key) {
  return safeSet(KEY_STORAGE_NAME, key.trim());
}

/** 保存済みのAPIキーを消す。 */
export function clearApiKey() {
  return safeSet(KEY_STORAGE_NAME, null);
}

/**
 * JSON を読む。手で書き換えられたり古い形式だったりして壊れていても、
 * アプリが止まらないよう fallback を返す（仕様書 6章）。
 */
function readJson(name, fallback) {
  const raw = safeGet(name);
  if (!raw) return fallback;
  try {
    return JSON.parse(raw);
  } catch {
    return fallback;
  }
}

const HISTORY_STORAGE_NAME = 'SS_FINDER_HISTORY';
const HISTORY_MAX = 20;

/** 検索履歴（新しい順）。形の合わない項目は捨てる。 */
export function loadHistory() {
  const list = readJson(HISTORY_STORAGE_NAME, []);
  if (!Array.isArray(list)) return [];
  return list.filter((e) => e && typeof e.query === 'string' && e.query.trim());
}

/**
 * 検索履歴の先頭に追加する。同じ言葉の古い履歴は消して先頭に移し、20件を超えた分は捨てる。
 * @returns 更新後の履歴（画面の描き直しに使う）
 */
export function addHistory(query, placeId) {
  const text = query.trim();
  const rest = loadHistory().filter((e) => e.query.trim().toLowerCase() !== text.toLowerCase());
  const next = [{ query: text, at: new Date().toISOString(), placeId }, ...rest].slice(0, HISTORY_MAX);
  safeSet(HISTORY_STORAGE_NAME, JSON.stringify(next));
  return next;
}

export function clearHistory() {
  return safeSet(HISTORY_STORAGE_NAME, null);
}
