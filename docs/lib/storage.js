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
