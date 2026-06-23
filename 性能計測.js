// ========================================
// ⏱ 申請ポータル 性能計測（実行ログ / Cloud Logging）
// Apps Script エディタ → 実行数 → ログ、または GCP Cloud Logging で確認
// ========================================

var PORTAL_PERF_ENABLED = true;

function portalPerfStart_(label) {
  if (!PORTAL_PERF_ENABLED) return null;
  return { label: String(label || ''), start: Date.now() };
}

function portalPerfEnd_(mark, detail) {
  if (!mark) return;
  var ms = Date.now() - mark.start;
  var msg = '[portal-perf] ' + mark.label + ': ' + ms + 'ms';
  if (detail) msg += ' | ' + detail;
  Logger.log(msg);
  console.log(msg);
}

function portalPerfRun_(label, fn) {
  var mark = portalPerfStart_(label);
  try {
    return fn();
  } finally {
    portalPerfEnd_(mark);
  }
}

function portalPerfAppLabel_(app) {
  if (!app) return 'unknown';
  return String(app.appCode || app.appName || app.dataType || 'app').trim();
}

/**
 * Apps Script エディタで1回実行し、並列読取用の外部通信権限を付与する。
 * 関数一覧: authorizePortalParallelRead
 */
function authorizePortalParallelRead() {
  var token = ScriptApp.getOAuthToken();
  UrlFetchApp.fetch('https://sheets.googleapis.com/$discovery/rest?version=v4', {
    headers: { Authorization: 'Bearer ' + token },
    muteHttpExceptions: true
  });
  return 'OK: 権限を付与しました。Webアプリを再読み込みしてください。';
}
