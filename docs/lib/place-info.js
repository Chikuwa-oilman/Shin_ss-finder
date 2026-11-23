// API の返す値を、画面に出す言葉に読み替える処理と、検索語の補い方をまとめる。
// api.js が 200 行を超えないよう、通信と関係しない「読み替え」だけをここに分けた。

/** 営業状況。閉業・臨時休業を優先し、次に今の時間に開いているかを出す。 */
export function describeStatus(businessStatus, openNow) {
  if (businessStatus === 'CLOSED_PERMANENTLY') return '閉業';
  if (businessStatus === 'CLOSED_TEMPORARILY') return '臨時休業';
  if (openNow === true) return '営業中（現在営業時間内）';
  if (openNow === false) return '営業時間外';
  return businessStatus === 'OPERATIONAL' ? '営業中' : '';
}

const DAY_NAMES = ['日', '月', '火', '水', '木', '金', '土'];

/**
 * 定休日は API に項目が無いため、週の営業時間から「開く時間が1つも無い曜日」を求める。
 * 祝日や臨時休業は反映されない点に注意。
 */
export function describeHolidays(hours) {
  const periods = hours?.periods;
  if (!periods?.length) return '';
  // 24時間営業は「日曜0時に開いて閉まらない」1件だけで表される
  const first = periods[0].open;
  if (periods.length === 1 && !periods[0].close && first?.day === 0 && first?.hour === 0) {
    return 'なし（24時間営業）';
  }
  const openDays = new Set(periods.map((pd) => pd.open?.day));
  const closed = DAY_NAMES.filter((_, day) => !openDays.has(day));
  return closed.length ? `${closed.join('・')}曜` : 'なし';
}

// 店名に含まれる文字からブランドを推定する（API にブランドの項目が無いため）
const BRAND_PATTERNS = [
  [/ENEOS|エネオス/i, 'ENEOS'],
  [/apollo|アポロ/i, 'apollostation'],
  [/出光|idemitsu/i, '出光'],
  [/コスモ|cosmo/i, 'コスモ石油'],
  [/シェル|shell/i, 'シェル'],
  [/キグナス|kygnus/i, 'キグナス石油'],
  [/SOLATO|ソラト|太陽石油/i, 'SOLATO'],
  [/JA-?SS|ＪＡ/i, 'JA-SS'],
  [/エッソ|esso/i, 'エッソ'],
  [/モービル|mobil/i, 'モービル'],
];

export function guessBrand(name) {
  const hit = BRAND_PATTERNS.find(([pattern]) => pattern.test(name));
  return hit ? `${hit[1]}（店名から推定）` : '';
}

// 「ガソリンスタンドを探している」と Google に伝わる言葉
const GAS_STATION_WORDS = /ガソリン|スタンド|給油|石油|[SＳ][SＳ]|station/i;

/**
 * Google に送る検索語を作る。
 * 「天王町」のような地名だけだと、Google は地名そのものを探してしまい、
 * ガソリンスタンドに絞る条件と合わずに0件になる。店名やブランドが入っていないときは
 * 「ガソリンスタンド」を足して、その場所のスタンドを探すよう伝える。
 */
export function buildSearchText(query) {
  const text = query.trim();
  const mentionsStation = GAS_STATION_WORDS.test(text) || BRAND_PATTERNS.some(([pattern]) => pattern.test(text));
  return mentionsStation ? text : `${text} ガソリンスタンド`;
}
