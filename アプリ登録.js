// ========================================
// 📋 ポータルアプリ登録（ワークフローブックから読込）
// ========================================

var SHEET_PORTAL_APPS = 'ポータルアプリ登録';

/** シート未作成時のフォールバック（通常はワークフローブックの登録を使用） */
var DEFAULT_PORTAL_APPS = [
  {
    appCode: 'TRIP_REQUEST',
    appName: '出張申請',
    ssId: '',
    webAppUrl: '',
    dataType: 'trip',
    active: true,
    sortOrder: 1
  },
  {
    appCode: 'EXPENSE_CLAIM',
    appName: '出張旅費精算',
    ssId: '',
    webAppUrl: '',
    dataType: 'claim',
    active: true,
    sortOrder: 2
  }
];

function portalAppsCacheKey_() {
  return 'portal_apps_' + String(WORKFLOW_SS_ID || '').trim();
}

function clearPortalAppsCache_() {
  try {
    CacheService.getScriptCache().remove(portalAppsCacheKey_());
  } catch (e) { /* ignore */ }
}

function isFallbackPortalApps_(apps) {
  if (!apps || apps.length !== DEFAULT_PORTAL_APPS.length) return false;
  for (var i = 0; i < apps.length; i++) {
    if (apps[i].appCode !== DEFAULT_PORTAL_APPS[i].appCode) return false;
    if (String(apps[i].ssId || '').trim()) return false;
  }
  return true;
}

var portalAppsLastLoadError_ = '';

function getPortalAppsLastLoadError_() {
  return String(portalAppsLastLoadError_ || '').trim();
}

function loadPortalApps_() {
  var mark = portalPerfStart_('loadPortalApps_');
  portalAppsLastLoadError_ = '';
  if (!String(WORKFLOW_SS_ID || '').trim()) {
    portalAppsLastLoadError_ = 'WORKFLOW_SS_ID が未設定です。';
    portalPerfEnd_(mark, 'fallback apps=' + DEFAULT_PORTAL_APPS.length);
    return DEFAULT_PORTAL_APPS.slice();
  }

  var cacheKey = portalAppsCacheKey_();
  var cached = getCachedJson_(cacheKey);
  if (cached && !isFallbackPortalApps_(cached)) {
    portalPerfEnd_(mark, 'cache=hit apps=' + cached.length);
    return cached;
  }

  try {
    var openMark = portalPerfStart_('loadPortalApps_.openById');
    var ss = SpreadsheetApp.openById(WORKFLOW_SS_ID);
    portalPerfEnd_(openMark);
    var sheet = ss.getSheetByName(SHEET_PORTAL_APPS);
    if (!sheet || sheet.getLastRow() < 2) {
      portalAppsLastLoadError_ = 'ワークフローブックに「' + SHEET_PORTAL_APPS + '」シートが見つからないか、データ行がありません。';
      portalPerfEnd_(mark, 'empty sheet');
      return DEFAULT_PORTAL_APPS.slice();
    }

    var readMark = portalPerfStart_('loadPortalApps_.getValues');
    var colCount = Math.max(8, sheet.getLastColumn());
    var data = sheet.getRange(2, 1, sheet.getLastRow(), colCount).getValues();
    portalPerfEnd_(readMark, 'rows=' + data.length);
    var rows = [];
    for (var i = 0; i < data.length; i++) {
      if (!data[i][0]) continue;
      rows.push({
        appCode: String(data[i][0] || '').trim(),
        appName: String(data[i][1] || '').trim(),
        dataType: String(data[i][2] || '').trim().toLowerCase(),
        ssId: String(data[i][3] || '').trim(),
        webAppUrl: String(data[i][4] || '').trim(),
        active: String(data[i][5] || 'Y').trim() !== 'N',
        sortOrder: parseInt(data[i][6], 10) || 0,
        note: String(data[i][7] || '').trim()
      });
    }

    rows.sort(function(a, b) {
      if (a.sortOrder !== b.sortOrder) return a.sortOrder - b.sortOrder;
      return a.appName.localeCompare(b.appName);
    });

    if (rows.length) {
      putCachedJson_(cacheKey, rows);
    } else {
      clearPortalAppsCache_();
    }
    portalPerfEnd_(mark, 'cache=miss apps=' + rows.length);
    return rows.length ? rows : DEFAULT_PORTAL_APPS.slice();
  } catch (e) {
    portalAppsLastLoadError_ = e.message || String(e);
    Logger.log('ポータルアプリ登録読込エラー: ' + portalAppsLastLoadError_);
    clearPortalAppsCache_();
    portalPerfEnd_(mark, 'error=' + portalAppsLastLoadError_);
    return DEFAULT_PORTAL_APPS.slice();
  }
}

function getActivePortalApps_() {
  return loadPortalApps_().filter(function(a) {
    return a.active !== false && String(a.ssId || '').trim() && isSupportedDataType_(a.dataType);
  });
}

function getPortalAppByCode_(appCode) {
  var code = String(appCode || '').trim();
  var apps = loadPortalApps_();
  for (var i = 0; i < apps.length; i++) {
    if (apps[i].appCode === code) return apps[i];
  }
  return null;
}

function getPortalLaunchers_() {
  return loadPortalApps_().filter(function(a) {
    return a.active !== false;
  }).map(function(a) {
    return {
      appCode: a.appCode,
      appName: a.appName,
      dataType: a.dataType,
      webAppUrl: String(a.webAppUrl || '').trim(),
      configured: !!String(a.ssId || '').trim(),
      hasUrl: !!String(a.webAppUrl || '').trim(),
      supported: isSupportedDataType_(a.dataType)
    };
  });
}

function getPortalConfigWarnings_() {
  var warnings = [];
  var apps = loadPortalApps_();
  var loadError = getPortalAppsLastLoadError_();
  if (loadError) {
    warnings.push('ポータルアプリ登録の読込エラー: ' + loadError);
  }
  apps.forEach(function(a) {
    if (a.active === false) return;
    if (!isSupportedDataType_(a.dataType)) {
      warnings.push(a.appName + ' のデータ種別「' + a.dataType + '」は未対応です（開発者に連絡）');
    }
    if (!String(a.ssId || '').trim()) {
      warnings.push(a.appName + ' の ssId が未設定です（ワークフロー設定 → ポータル連携）');
    }
    if (!String(a.webAppUrl || '').trim()) {
      warnings.push(a.appName + ' の Web URL が未設定です（新規申請リンク用）');
    }
  });
  if (!getActivePortalApps_().length) {
    warnings.push('有効な業務アプリがありません。ワークフロー設定の「ポータルアプリ登録」を確認してください。');
  }
  return warnings;
}
