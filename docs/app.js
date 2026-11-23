// 画面のイベントと lib/ の処理をつなぐだけの薄いコントローラ。
// ロジックをここに書かないのは、機能ごとに lib/ を読めば分かる状態を保つため。
import * as api from './lib/api.js';
import * as storage from './lib/storage.js';
import * as ui from './lib/ui.js';

void api; // Step 4 で使う

const URL_KEY_PARAM = 'gmaps_key';

/**
 * 仕様の優先順位（URL > LocalStorage > config.js）でキーを決める。
 * どこから来たかも返すのは、消去ボタンを押してもキーが残るケース（config.js）を説明するため。
 */
function resolveApiKey() {
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

const SOURCE_LABELS = {
  url: '設定済み（URL から読み込み、このブラウザに保存しました）',
  storage: '設定済み（このブラウザに保存されています）',
  config: '設定済み（config.js から読み込み）',
  none: '未設定',
};

let apiKey = '';

/** キーの有無に合わせて画面全体の状態をそろえる。保存・消去のたびに呼ぶ。 */
function applyKeyState({ key, source }) {
  apiKey = key;
  ui.setKeyStatus(SOURCE_LABELS[source]);
  ui.setSearchEnabled(Boolean(key));
  if (key) {
    ui.setMessage('店舗名を入力して検索してください。', 'info');
  } else {
    ui.setKeyPanelOpen(true);
    ui.setMessage('APIキーが未設定です。上の「APIキー設定」から入力してください。', 'warn');
  }
}

function onKeySubmit(event) {
  event.preventDefault();
  const key = ui.getKeyInputValue();
  if (!key) {
    ui.setMessage('APIキーを入力してください。', 'warn');
    return;
  }
  if (!storage.saveApiKey(key)) {
    ui.setMessage('このブラウザではキーを保存できませんでした（プライベートモードなど）。', 'error');
    return;
  }
  ui.clearKeyInput();
  applyKeyState({ key, source: 'storage' });
  ui.setKeyPanelOpen(false);
  ui.setMessage('APIキーを保存しました。', 'success');
}

function onKeyClear() {
  storage.clearApiKey();
  ui.clearKeyInput();
  const next = resolveApiKey();
  applyKeyState(next);
  if (next.source === 'config') {
    // ブラウザの保存分は消えたが config.js のキーが残っていることを伝えないと、消えたと誤解される
    ui.setMessage('保存したキーを消しました。config.js のキーは残っているため、検索はできます。', 'info');
  } else {
    ui.setMessage('APIキーを消しました。', 'success');
  }
}

function init() {
  document.getElementById('key-form').addEventListener('submit', onKeySubmit);
  document.getElementById('key-clear').addEventListener('click', onKeyClear);
  document.getElementById('key-toggle').addEventListener('click', () => {
    ui.setKeyPanelOpen(!ui.isKeyPanelOpen());
  });
  applyKeyState(resolveApiKey());
}

init();

// Step 4 で検索処理から参照する
export function getApiKey() {
  return apiKey;
}
