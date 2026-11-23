// 画面のイベントと lib/ の処理をつなぐだけの薄いコントローラ。
// ロジックをここに書かないのは、機能ごとに lib/ を読めば分かる状態を保つため。
import * as api from './lib/api.js';
import * as storage from './lib/storage.js';
import * as ui from './lib/ui.js';
import * as lists from './lib/lists.js';
import { initKeyControls, showMissingKey } from './lib/key.js';

let apiKey = '';
// 直近の検索結果（候補一覧）と、いま基本情報カードに出している店舗
let candidates = [];
let currentPlaceId = '';
// 比較枠に入れた店舗の詳細
let compareList = [];
// 詳細取得は1回ごとに料金と1日の回数を使うため、一度取った店舗は覚えておいて使い回す
const detailCache = new Map();
// 実行中の通信。新しい操作やキャンセルで前の通信を止め、古い結果で画面が上書きされないようにする
let currentTask = null;

/**
 * 通信を伴う操作の共通処理（ボタンの状態・キャンセル・エラー表示）。
 * 検索・候補の切り替え・比較への追加で同じ扱いにするため1か所にまとめた。
 */
async function runTask(startMessage, task) {
  if (!apiKey) {
    showMissingKey();
    return;
  }
  currentTask?.abort();
  const controller = new AbortController();
  currentTask = controller;
  ui.setBusy(true);
  ui.setMessage(startMessage, 'info');
  try {
    await task(controller.signal);
  } catch (err) {
    ui.setMessage(err.message || '予期しないエラーが起きました。', err.kind === 'aborted' ? 'info' : 'error');
  } finally {
    // 後から始まった操作が動いている間は、そちらのボタン状態を壊さない
    if (currentTask === controller) {
      currentTask = null;
      ui.setBusy(false);
      ui.setSearchEnabled(Boolean(apiKey));
    }
  }
}

async function loadDetails(placeId, signal) {
  if (!detailCache.has(placeId)) {
    detailCache.set(placeId, await api.getPlaceDetails(placeId, { key: apiKey, signal }));
  }
  return detailCache.get(placeId);
}

function showPlace(place) {
  currentPlaceId = place.id;
  ui.renderPlace(place, {
    map: api.mapEmbedUrl(apiKey, place.id),
    streetView: place.location ? api.streetViewEmbedUrl(apiKey, place.location) : '',
  });
  lists.renderCandidates(candidates, currentPlaceId);
}

function runSearch(query) {
  runTask(`「${query}」を検索しています…`, async (signal) => {
    candidates = await api.searchPlaces(query, { key: apiKey, signal });
    if (!candidates.length) {
      lists.renderCandidates([], '');
      ui.setMessage('該当するガソリンスタンドが見つかりませんでした。店名や地名を変えて試してください。', 'warn');
      return;
    }
    // 見つかった検索だけを履歴に残す（見つからなかった言葉を再検索しても意味がないため）
    lists.renderHistory(storage.addHistory(query, candidates[0].id));
    showPlace(await loadDetails(candidates[0].id, signal));
    const summary = candidates.length > 1
      ? `${candidates.length}件見つかりました。1件目を表示しています。下の候補から切り替えられます。`
      : '1件見つかりました。';
    ui.setMessage(summary, 'success');
  });
}

function onSearchSubmit(event) {
  event.preventDefault();
  const query = ui.getSearchQuery();
  if (!query) {
    ui.setMessage('店舗名を入力してください。', 'warn');
    return;
  }
  runSearch(query);
}

function onHistorySelect({ query }) {
  ui.setSearchQuery(query);
  runSearch(query);
}

function onHistoryClear() {
  storage.clearHistory();
  lists.renderHistory([]);
  ui.setMessage('検索履歴を消しました。', 'success');
}

function onSelectCandidate({ id }) {
  runTask('店舗の詳細を読み込んでいます…', async (signal) => {
    const place = await loadDetails(id, signal);
    showPlace(place);
    ui.setMessage(`「${place.name}」を表示しています。`, 'success');
  });
}

function onCompareAdd({ id }) {
  if (compareList.some((p) => p.id === id)) {
    ui.setMessage('この店舗はすでに比較に入っています。', 'info');
    return;
  }
  if (compareList.length >= lists.COMPARE_MAX) {
    ui.setMessage(`比較は${lists.COMPARE_MAX}件までです。× で外してから追加してください。`, 'warn');
    return;
  }
  runTask('比較用に詳細を読み込んでいます…', async (signal) => {
    const place = await loadDetails(id, signal);
    // 読み込み中に同じ店舗が追加された場合の二重登録を防ぐ
    if (!compareList.some((p) => p.id === place.id)) {
      compareList = [...compareList, place];
    }
    lists.renderCompare(compareList);
    ui.setMessage(`「${place.name}」を比較に追加しました（${compareList.length}/${lists.COMPARE_MAX}）。`, 'success');
  });
}

function onCompareRemove({ id }) {
  compareList = compareList.filter((p) => p.id !== id);
  lists.renderCompare(compareList);
  ui.setMessage(`比較から外しました（${compareList.length}/${lists.COMPARE_MAX}）。`, 'info');
}

// 候補・比較・履歴のボタンは描画のたびに作り直されるため、親でまとめてクリックを受け取る。
// 各処理にはボタンの data-* 属性（id, query など）をそのまま渡す
const ACTIONS = {
  select: onSelectCandidate,
  'compare-add': onCompareAdd,
  'compare-remove': onCompareRemove,
  history: onHistorySelect,
};

function onActionClick(event) {
  const btn = event.target.closest('button[data-action]');
  if (btn && !btn.disabled && ACTIONS[btn.dataset.action]) {
    ACTIONS[btn.dataset.action](btn.dataset);
  }
}

function init() {
  document.getElementById('search-form').addEventListener('submit', onSearchSubmit);
  document.getElementById('cancel-btn').addEventListener('click', () => currentTask?.abort());
  document.getElementById('history-clear').addEventListener('click', onHistoryClear);
  document.querySelector('main').addEventListener('click', onActionClick);
  lists.renderHistory(storage.loadHistory());
  initKeyControls((key) => {
    apiKey = key;
  });
}

init();
