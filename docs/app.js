// 画面のイベントと lib/ の処理をつなぐだけの薄いコントローラ。
// ロジックをここに書かないのは、機能ごとに lib/ を読めば分かる状態を保つため。
import * as api from './lib/api.js';
import * as storage from './lib/storage.js';
import * as ui from './lib/ui.js';
import * as lists from './lib/lists.js';
import { resolveApiKey, SOURCE_LABELS } from './lib/key.js';

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

/**
 * 通信を伴う操作の共通処理（ボタンの状態・キャンセル・エラー表示）。
 * 検索・候補の切り替え・比較への追加で同じ扱いにするため1か所にまとめた。
 */
async function runTask(startMessage, task) {
  if (!apiKey) {
    applyKeyState({ key: '', source: 'none' });
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

function onSearchSubmit(event) {
  event.preventDefault();
  const query = ui.getSearchQuery();
  if (!query) {
    ui.setMessage('店舗名を入力してください。', 'warn');
    return;
  }
  runTask(`「${query}」を検索しています…`, async (signal) => {
    candidates = await api.searchPlaces(query, { key: apiKey, signal });
    if (!candidates.length) {
      lists.renderCandidates([], '');
      ui.setMessage('該当するガソリンスタンドが見つかりませんでした。店名や地名を変えて試してください。', 'warn');
      return;
    }
    showPlace(await loadDetails(candidates[0].id, signal));
    const summary = candidates.length > 1
      ? `${candidates.length}件見つかりました。1件目を表示しています。下の候補から切り替えられます。`
      : '1件見つかりました。';
    ui.setMessage(summary, 'success');
  });
}

function onSelectCandidate(placeId) {
  runTask('店舗の詳細を読み込んでいます…', async (signal) => {
    const place = await loadDetails(placeId, signal);
    showPlace(place);
    ui.setMessage(`「${place.name}」を表示しています。`, 'success');
  });
}

function onCompareAdd(placeId) {
  if (compareList.some((p) => p.id === placeId)) {
    ui.setMessage('この店舗はすでに比較に入っています。', 'info');
    return;
  }
  if (compareList.length >= lists.COMPARE_MAX) {
    ui.setMessage(`比較は${lists.COMPARE_MAX}件までです。× で外してから追加してください。`, 'warn');
    return;
  }
  runTask('比較用に詳細を読み込んでいます…', async (signal) => {
    const place = await loadDetails(placeId, signal);
    // 読み込み中に同じ店舗が追加された場合の二重登録を防ぐ
    if (!compareList.some((p) => p.id === place.id)) {
      compareList = [...compareList, place];
    }
    lists.renderCompare(compareList);
    ui.setMessage(`「${place.name}」を比較に追加しました（${compareList.length}/${lists.COMPARE_MAX}）。`, 'success');
  });
}

function onCompareRemove(placeId) {
  compareList = compareList.filter((p) => p.id !== placeId);
  lists.renderCompare(compareList);
  ui.setMessage(`比較から外しました（${compareList.length}/${lists.COMPARE_MAX}）。`, 'info');
}

// 候補や比較のボタンは描画のたびに作り直されるため、親でまとめてクリックを受け取る
const ACTIONS = { select: onSelectCandidate, 'compare-add': onCompareAdd, 'compare-remove': onCompareRemove };

function onActionClick(event) {
  const btn = event.target.closest('button[data-action]');
  if (btn && !btn.disabled && ACTIONS[btn.dataset.action]) {
    ACTIONS[btn.dataset.action](btn.dataset.id);
  }
}

function init() {
  document.getElementById('search-form').addEventListener('submit', onSearchSubmit);
  document.getElementById('cancel-btn').addEventListener('click', () => currentTask?.abort());
  document.getElementById('key-form').addEventListener('submit', onKeySubmit);
  document.getElementById('key-clear').addEventListener('click', onKeyClear);
  document.getElementById('key-toggle').addEventListener('click', () => {
    ui.setKeyPanelOpen(!ui.isKeyPanelOpen());
  });
  document.querySelector('main').addEventListener('click', onActionClick);
  applyKeyState(resolveApiKey());
}

init();
