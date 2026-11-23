// DOM を組み立てる・書き換える小さな関数をここに集める。
// 同じ表示処理を app.js のあちこちに書かないため。

const $ = (id) => document.getElementById(id);

/**
 * 結果メッセージ欄を更新する。
 * @param {string} text 表示する文。空文字なら欄ごと隠れる（CSS の :empty）
 * @param {'info'|'success'|'warn'|'error'} state 左線の色を決める状態
 */
export function setMessage(text, state = 'info') {
  const el = $('message');
  el.dataset.state = state;
  el.textContent = text;
}

/** APIキー設定欄の開閉。ボタンの aria-expanded も合わせて、読み上げと見た目を一致させる。 */
export function setKeyPanelOpen(open) {
  $('key-panel').hidden = !open;
  $('key-toggle').setAttribute('aria-expanded', String(open));
  if (open) {
    $('key-input').focus();
  }
}

export function isKeyPanelOpen() {
  return !$('key-panel').hidden;
}

/** キーが無い状態で検索させると必ず失敗するため、検索ボタンごと押せなくする。 */
export function setSearchEnabled(enabled) {
  $('search-btn').disabled = !enabled;
}

/** キーの出どころを設定欄に表示する。キー本体は画面に出さない（覗き見・スクショ対策）。 */
export function setKeyStatus(text) {
  $('key-status').textContent = text;
}

export function getKeyInputValue() {
  return $('key-input').value.trim();
}

export function clearKeyInput() {
  $('key-input').value = '';
}
