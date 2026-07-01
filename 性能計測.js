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

/**
 * GCP プロジェクト番号と Sheets API 有効化 URL を実行ログに出力する。
 * 関数一覧: diagnosePortalSheetsApi
 */
function diagnosePortalSheetsApi() {
  var token = ScriptApp.getOAuthToken();
  var ssId = String(WORKFLOW_SS_ID || '').trim();
  if (!ssId) {
    var apps = loadPortalApps_();
    for (var i = 0; i < apps.length; i++) {
      if (String(apps[i].ssId || '').trim()) {
        ssId = String(apps[i].ssId).trim();
        break;
      }
    }
  }
  if (!ssId) {
    return 'ワークフローまたは業務アプリの ssId が設定されていません。';
  }

  var range = encodeURIComponent("'ポータルアプリ登録'!A1:A1");
  var resp = UrlFetchApp.fetch(
    'https://sheets.googleapis.com/v4/spreadsheets/' + ssId + '/values/' + range,
    { headers: { Authorization: 'Bearer ' + token }, muteHttpExceptions: true }
  );
  var code = resp.getResponseCode();
  var text = resp.getContentText();
  var projectMatch = text.match(/project[:\s]+(\d{8,})/i);
  var lines = ['ssId=' + ssId, 'HTTP ' + code];

  if (code === 200) {
    lines.push('Sheets API は有効で、スプレッドシートへの読み取りも成功しました。');
    lines.push('Webアプリで「更新」→ fetchPortalSheetValuesParallel_ に 403 が出なければ OK です。');
  } else if (code === 403) {
    if (projectMatch) {
      lines.push('GCPプロジェクト番号: ' + projectMatch[1]);
      lines.push('Sheets API 有効化URL:');
      lines.push('https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=' + projectMatch[1]);
    } else {
      lines.push('Sheets API が無効、または権限不足の可能性があります。');
      lines.push('応答: ' + text.substring(0, 400));
    }
  } else if (code === 404) {
    lines.push('Sheets API は応答しています（404 = 指定 ssId/シートが見つからない）。');
    lines.push('API 未有効の場合は通常 403 になります。403 が解消されていれば有効化済みです。');
    lines.push('先ほどのプロジェクト番号: 797842167592');
    lines.push('有効化URL: https://console.cloud.google.com/apis/library/sheets.googleapis.com?project=797842167592');
  } else {
    lines.push('応答: ' + text.substring(0, 400));
  }

  var msg = lines.join('\n');
  Logger.log(msg);
  console.log(msg);
  return msg;
}
