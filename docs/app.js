// 画面のイベントと lib/ の処理をつなぐだけの薄いコントローラ。
// ロジックをここに書かないのは、機能ごとに lib/ を読めば分かる状態を保つため。
import * as api from './lib/api.js';
import * as storage from './lib/storage.js';
import * as ui from './lib/ui.js';

// Step 3 以降で、APIキー設定・検索・履歴・お気に入りの処理をつないでいく
void api;
void storage;
void ui;
