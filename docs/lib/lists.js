// 候補一覧と比較枠の表示。ui.js が 200 行を超えないよう、一覧系の描画だけをここに分けた。
// ボタンには data-action と data-id を付け、クリック処理は app.js でまとめて受け取る。
import { infoRow } from './ui.js';

const $ = (id) => document.getElementById(id);

// カードで見せる候補の数。多すぎると結果カードより下が長くなりすぎるため、残りは名前だけにする
const TOP_COUNT = 4;
export const COMPARE_MAX = 3;

function button(text, action, id, className) {
  const btn = document.createElement('button');
  btn.type = 'button';
  btn.className = className;
  btn.textContent = text;
  btn.dataset.action = action;
  btn.dataset.id = id;
  return btn;
}

/**
 * 候補一覧を描画する。候補が1件以下なら選ぶ意味がないので欄ごと隠す。
 * @param {Array<{id: string, name: string, address: string}>} list 検索結果
 * @param {string} currentId いま基本情報カードに出している候補
 */
export function renderCandidates(list, currentId) {
  $('candidates-panel').hidden = list.length < 2;
  $('candidates').replaceChildren(...list.slice(0, TOP_COUNT).map((c) => candidateCard(c, c.id === currentId)));

  const rest = list.slice(TOP_COUNT);
  const more = $('candidates-more');
  more.hidden = rest.length === 0;
  more.replaceChildren(
    document.createTextNode('そのほか：'),
    ...rest.map((c) => button(c.name, 'select', c.id, 'link-btn')),
  );
}

function candidateCard(candidate, isCurrent) {
  const card = document.createElement('article');
  card.className = 'card card-compact';
  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = candidate.name;
  const address = document.createElement('p');
  address.className = 'muted';
  address.textContent = candidate.address || '住所不明';

  const actions = document.createElement('div');
  actions.className = 'row card-actions';
  const show = button(isCurrent ? '表示中' : 'この店舗を表示', 'select', candidate.id, 'btn btn-small btn-ghost');
  // 表示中の店舗をもう一度読むと無駄に API を使うので押せなくする
  show.disabled = isCurrent;
  actions.append(show, button('比較に追加', 'compare-add', candidate.id, 'btn btn-small btn-primary'));

  card.append(title, address, actions);
  return card;
}

/** 比較枠を描画する。空のときは使い方の案内を出す。 */
export function renderCompare(list) {
  $('compare-count').textContent = `${list.length}/${COMPARE_MAX}`;
  const box = $('compare');
  if (!list.length) {
    const hint = document.createElement('p');
    hint.className = 'muted';
    hint.textContent = '候補の「比較に追加」で、最大3件まで横に並べて見比べられます。';
    box.replaceChildren(hint);
    return;
  }
  box.replaceChildren(...list.map(compareCard));
}

function compareCard(place) {
  const card = document.createElement('article');
  card.className = 'card card-compact';

  const header = document.createElement('header');
  header.className = 'card-header';
  const title = document.createElement('h3');
  title.className = 'card-title';
  title.textContent = place.name;
  const close = button('×', 'compare-remove', place.id, 'icon-btn');
  close.setAttribute('aria-label', `${place.name} を比較から外す`);
  header.append(title, close);

  const dl = document.createElement('dl');
  dl.className = 'info-list info-list-compact';
  const rows = [
    ['住所', place.address],
    ['営業状況', place.status],
    ['定休日', place.holidays],
    ['評価', place.rating],
    ['ブランド', place.brand],
    ['地図', place.mapsUrl && { href: place.mapsUrl, text: 'Google マップで開く', external: true }],
  ];
  dl.append(...rows.flatMap(([label, value]) => infoRow(label, value)));

  card.append(header, dl);
  return card;
}
