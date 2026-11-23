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

export function getSearchQuery() {
  return $('search-input').value.trim();
}

/** 履歴から再検索するとき、何で検索したかが入力欄でも分かるようにする。 */
export function setSearchQuery(text, prefecture = '') {
  $('search-input').value = text;
  $('pref-select').value = prefecture;
}

const PREFECTURES = '北海道 青森県 岩手県 宮城県 秋田県 山形県 福島県 茨城県 栃木県 群馬県 埼玉県 千葉県 東京都 神奈川県 新潟県 富山県 石川県 福井県 山梨県 長野県 岐阜県 静岡県 愛知県 三重県 滋賀県 京都府 大阪府 兵庫県 奈良県 和歌山県 鳥取県 島根県 岡山県 広島県 山口県 徳島県 香川県 愛媛県 高知県 福岡県 佐賀県 長崎県 熊本県 大分県 宮崎県 鹿児島県 沖縄県'.split(' ');

/** 都道府県の選択肢を作る。HTML に47行並べるより、一覧から作る方が読みやすいため。 */
export function initPrefectureSelect() {
  $('pref-select').append(...PREFECTURES.map((name) => new Option(name, name)));
}

/** 選ばれた都道府県（指定なしなら空文字）。 */
export function getPrefecture() {
  return $('pref-select').value;
}

/** 検索中は二重送信を防ぎ、代わりにキャンセルを出す。 */
export function setBusy(busy) {
  $('search-btn').disabled = busy;
  $('cancel-btn').hidden = !busy;
  $('results').setAttribute('aria-busy', String(busy));
}

/**
 * 基本情報カード・地図・ストリートビューをまとめて差し替える。
 * @param {object} place api.getPlaceDetails() の戻り値
 * @param {{map: string, streetView: string}} embeds 埋め込み URL（空なら案内文を出す）
 */
export function renderPlace(place, embeds) {
  $('info-name').textContent = place.name;
  const rows = [
    ['住所', place.address],
    ['電話', place.phone && { href: `tel:${place.phone.replace(/[^\d+]/g, '')}`, text: place.phone }],
    ['営業時間', place.hours],
    ['営業状況', place.status],
    ['定休日', place.holidays],
    ['ブランド', place.brand],
    ['運営会社', place.operator],
    ['評価', place.rating],
    ['公式サイト', place.website && { href: place.website, text: place.website, external: true }],
    ['Google 地図', place.mapsUrl && { href: place.mapsUrl, text: 'Google マップで開く', external: true }],
  ];
  $('info-list').replaceChildren(...rows.flatMap(([label, value]) => infoRow(label, value)));
  setEmbed('map-embed', embeds.map, `${place.name} の地図`, '地図を表示できませんでした');
  setEmbed('sv-embed', embeds.streetView, `${place.name} のストリートビュー`, 'ストリートビューを表示できませんでした');
}

/** 項目名と値の dt/dd を作る。値は文字列か {href, text, external}。比較枠でも同じ見せ方にするため export する。 */
export function infoRow(label, value) {
  const dt = document.createElement('dt');
  dt.textContent = label;
  const dd = document.createElement('dd');
  if (value && typeof value === 'object' && isSafeLink(value.href)) {
    const a = document.createElement('a');
    a.href = value.href;
    a.textContent = value.text;
    if (value.external) {
      // 別タブで開き、開いた先のページからこのページを操作されないようにする
      a.target = '_blank';
      a.rel = 'noopener noreferrer';
    }
    dd.append(a);
  } else {
    // 取れなかった項目は空欄ではなく「—」にして、取り忘れではないと分かるようにする
    dd.textContent = (typeof value === 'string' && value) || '—';
  }
  return [dt, dd];
}

// API が返した URL でも javascript: などを href に入れると危険なので、http(s) と tel だけ通す
function isSafeLink(href) {
  return /^(https?:|tel:)/i.test(href || '');
}

function setEmbed(containerId, url, title, emptyText) {
  const box = $(containerId);
  if (!url) {
    const p = document.createElement('p');
    p.className = 'embed-empty';
    p.textContent = emptyText;
    box.replaceChildren(p);
    return;
  }
  const iframe = document.createElement('iframe');
  iframe.src = url;
  iframe.title = title;
  iframe.loading = 'lazy';
  iframe.referrerPolicy = 'no-referrer-when-downgrade';
  iframe.allowFullscreen = true;
  box.replaceChildren(iframe);
}
