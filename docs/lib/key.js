// APIキーをどこから読むかを決める。app.js が 200 行を超えないよう、キーの決定ロジックだけをここに分けた。
import * as storage from './storage.js';

const URL_KEY_PARAM = 'gmaps_key';

export const SOURCE_LABELS = {
  url: '設定済み（URL から読み込み、このブラウザに保存しました）',
  storage: '設定済み（このブラウザに保存されています）',
  config: '設定済み（config.js から読み込み）',
  none: '未設定',
};

/**
 * 仕様の優先順位（URL > LocalStorage > config.js）でキーを決める。
 * どこから来たかも返すのは、消去ボタンを押してもキーが残るケース（config.js）を説明するため。
 * @returns {{key: string, source: 'url'|'storage'|'config'|'none'}}
 */
export function resolveApiKey() {
  const fromUrl = takeKeyFromUrl();
  if (fromUrl) {
    storage.saveApiKey(fromUrl);
    return { key: fromUrl, source: 'url' };
  }
  const stored = storage.loadApiKey();
  if (stored) {
    return { key: stored, source: 'storage' };
  }
  const fromConfig = (window.CONFIG?.GOOGLE_MAPS_API_KEY || '').trim();
  if (fromConfig) {
    return { key: fromConfig, source: 'config' };
  }
  return { key: '', source: 'none' };
}

/**
 * URL の ?gmaps_key= を読み取り、URL からは消す。
 * 残すとブラウザ履歴やブックマーク、画面共有にキーが写り込むため。
 */
function takeKeyFromUrl() {
  const url = new URL(window.location.href);
  const key = (url.searchParams.get(URL_KEY_PARAM) || '').trim();
  if (key) {
    url.searchParams.delete(URL_KEY_PARAM);
    window.history.replaceState(null, '', url);
  }
  return key;
}
