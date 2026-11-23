// お気に入り（⭐ボタン・一覧・エクスポート/インポート）をまとめる。
// app.js が 200 行を超えないよう、お気に入りに関する画面と保存の処理はすべてここに置く。
import * as storage from './storage.js';
import { setMessage } from './ui.js';

const $ = (id) => document.getElementById(id);

// いま基本情報カードに出している店舗（⭐ボタンの対象）
let currentPlace = null;

/** ⭐ボタンの見た目と読み上げを、いま表示中の店舗に合わせる。 */
function updateStar() {
  const btn = $('fav-toggle');
  const on = Boolean(currentPlace) && storage.loadFavorites().some((f) => f.id === currentPlace.id);
  // 店舗を表示する前に押しても対象が無いので押せなくする
  btn.disabled = !currentPlace;
  btn.textContent = on ? '★' : '☆';
  btn.setAttribute('aria-pressed', String(on));
  btn.setAttribute('aria-label', on ? 'お気に入りから外す' : 'お気に入りに追加');
}

function render(list = storage.loadFavorites()) {
  $('favorites-summary').textContent = list.length ? `お気に入り一覧（${list.length}件）` : 'お気に入り一覧';
  $('fav-export').disabled = list.length === 0;
  if (!list.length) {
    const empty = document.createElement('li');
    empty.className = 'empty';
    empty.textContent = 'まだお気に入りはありません。店舗カードの ☆ で追加できます。';
    $('favorites-list').replaceChildren(empty);
    return;
  }
  $('favorites-list').replaceChildren(...list.map(favoriteItem));
}

// 押すとその店舗を表示するボタンと、一覧から直接外す × ボタンの組
function favoriteItem(fav) {
  const li = document.createElement('li');
  li.className = 'chip-item';
  const open = document.createElement('button');
  open.type = 'button';
  open.className = 'chip';
  open.textContent = fav.name;
  open.title = fav.address || '';
  open.dataset.action = 'favorite';
  open.dataset.id = fav.id;
  const remove = document.createElement('button');
  remove.type = 'button';
  remove.className = 'icon-btn';
  remove.textContent = '×';
  remove.setAttribute('aria-label', `${fav.name} をお気に入りから外す`);
  remove.dataset.action = 'favorite-remove';
  remove.dataset.id = fav.id;
  li.append(open, remove);
  return li;
}

function save(list, okMessage) {
  if (!storage.saveFavorites(list)) {
    setMessage('このブラウザではお気に入りを保存できませんでした（プライベートモードなど）。', 'error');
    return;
  }
  render(list);
  updateStar();
  setMessage(okMessage, 'success');
}

function onToggle() {
  if (!currentPlace) return;
  const list = storage.loadFavorites();
  if (list.some((f) => f.id === currentPlace.id)) {
    save(list.filter((f) => f.id !== currentPlace.id), `「${currentPlace.name}」をお気に入りから外しました。`);
  } else {
    const fav = { id: currentPlace.id, name: currentPlace.name, address: currentPlace.address, addedAt: new Date().toISOString() };
    save([...list, fav], `「${currentPlace.name}」をお気に入りに追加しました。`);
  }
}

/** 一覧の × から外す（app.js のクリック処理から呼ばれる）。 */
export function removeFavorite({ id }) {
  const list = storage.loadFavorites();
  const target = list.find((f) => f.id === id);
  if (target) {
    save(list.filter((f) => f.id !== id), `「${target.name}」をお気に入りから外しました。`);
  }
}

/** 入出力欄を開く。エクスポートでは文字を入れて選択状態に、インポートでは空にして読み込むボタンを出す。 */
function openIoBox(mode, text) {
  $('fav-io-box').hidden = false;
  $('fav-io-label').textContent = mode === 'export'
    ? 'お気に入りのデータ（この文字を保存しておくと、別のブラウザで読み込めます）'
    : 'エクスポートした文字を貼り付けて「読み込む」を押してください';
  $('fav-io').value = text;
  $('fav-import-apply').hidden = mode !== 'import';
  $('fav-io').focus();
  $('fav-io').select();
}

async function onExport() {
  const data = { app: 'SS Finder', version: 1, favorites: storage.loadFavorites() };
  const text = JSON.stringify(data, null, 2);
  openIoBox('export', text);
  try {
    await navigator.clipboard.writeText(text);
    setMessage('お気に入りをクリップボードにコピーしました。メモ帳などに貼り付けて保存できます。', 'success');
  } catch {
    // ブラウザの設定でクリップボードが使えないこともあるため、欄から手でコピーしてもらう
    setMessage('下の欄の文字をすべて選んでコピーしてください。', 'info');
  }
}

function onImportApply() {
  let parsed;
  try {
    parsed = JSON.parse($('fav-io').value);
  } catch {
    setMessage('読み込めませんでした。エクスポートした文字をそのまま貼り付けてください。', 'error');
    return;
  }
  // 配列だけ、または { favorites: [...] } の形を受け付ける
  const incoming = Array.isArray(parsed) ? parsed : parsed?.favorites;
  if (!Array.isArray(incoming)) {
    setMessage('お気に入りのデータが見つかりませんでした。', 'error');
    return;
  }
  const valid = incoming.filter(storage.isFavorite);
  const list = storage.loadFavorites();
  // すでにある店舗は上書きせず、新しい店舗だけ足す（手元の追加日時を残すため）
  const added = valid.filter((f, i) => !list.some((x) => x.id === f.id) && valid.findIndex((y) => y.id === f.id) === i)
    .map((f) => ({ id: f.id, name: f.name, address: typeof f.address === 'string' ? f.address : '', addedAt: f.addedAt || new Date().toISOString() }));
  const skipped = incoming.length - added.length;
  $('fav-io-box').hidden = true;
  save([...list, ...added], `${added.length}件を読み込みました${skipped ? `（重複や形式の違う${skipped}件は省きました）` : ''}。`);
}

/** いま表示中の店舗を知らせる（⭐ボタンの対象を切り替えるため）。 */
export function setCurrentPlace(place) {
  currentPlace = place;
  updateStar();
}

export function initFavorites() {
  $('fav-toggle').addEventListener('click', onToggle);
  $('fav-export').addEventListener('click', onExport);
  $('fav-import').addEventListener('click', () => openIoBox('import', ''));
  $('fav-import-apply').addEventListener('click', onImportApply);
  $('fav-io-close').addEventListener('click', () => {
    $('fav-io-box').hidden = true;
  });
  render();
  updateStar();
}
