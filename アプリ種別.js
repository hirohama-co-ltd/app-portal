// ========================================
// 🔌 データ種別ごとの読取・承認ハンドラ
// 新規アプリ追加時: ここに種別を追加し、外部データ.js に読み書きを実装
// ========================================

var SUPPORTED_DATA_TYPES = ['trip', 'claim', 'purchase'];

/** ポータルからリンク起動のみ（申請一覧・承認待ちには出さない） */
var LAUNCHER_ONLY_DATA_TYPES = ['leave'];

function isSupportedDataType_(dataType) {
  return SUPPORTED_DATA_TYPES.indexOf(String(dataType || '').trim().toLowerCase()) >= 0;
}

function isLauncherOnlyDataType_(dataType) {
  return LAUNCHER_ONLY_DATA_TYPES.indexOf(String(dataType || '').trim().toLowerCase()) >= 0;
}

function isPendingRecord_(record, dataType, userEmail) {
  dataType = String(dataType || '').trim().toLowerCase();
  if (dataType === 'trip') {
    return record.status === TRIP_STATUS.SUBMITTED && record.approverEmail === userEmail;
  }
  if (dataType === 'claim') {
    return record.status === CLAIM_STATUS.SUBMITTED && record.approverEmail === userEmail;
  }
  if (dataType === 'purchase') {
    return record.status === PURCHASE_STATUS.SUBMITTED && record.approverEmail === userEmail;
  }
  return false;
}

function collectItemsFromApp_(app, filterFn) {
  var items = [];
  var dataType = String(app.dataType || '').trim().toLowerCase();
  var mark = portalPerfStart_('collectItemsFromApp_' + portalPerfAppLabel_(app));
  if (dataType === 'trip') {
    readTripRowsFromApp_(app, filterFn).forEach(function(t) {
      items.push(tripToPortalItem_(t, app));
    });
  } else if (dataType === 'claim') {
    readClaimRowsFromApp_(app, filterFn).forEach(function(c) {
      items.push(claimToPortalItem_(c, app));
    });
  } else if (dataType === 'purchase') {
    readPurchaseRowsFromApp_(app, filterFn).forEach(function(p) {
      items.push(purchaseToPortalItem_(p, app));
    });
  }
  portalPerfEnd_(mark, 'dataType=' + dataType + ' items=' + items.length);
  return items;
}

function getApplicationDetailByType_(app, requestId, userEmail) {
  var dataType = String(app.dataType || '').trim().toLowerCase();
  if (dataType === 'trip') {
    var trip = getTripFromApp_(app, requestId);
    if (!trip) return { success: false, message: '申請が見つかりません。' };
    if (!canViewApplication_(app, trip, userEmail)) {
      return { success: false, message: '閲覧権限がありません。' };
    }
    trip = enrichTripWithWorkflowStep_(trip);
    return {
      success: true,
      appCode: app.appCode,
      appName: app.appName,
      dataType: 'trip',
      item: tripToPortalItem_(trip, app),
      detail: trip,
      webAppUrl: app.webAppUrl || ''
    };
  }
  if (dataType === 'claim') {
    var claim = getClaimWithDetailsFromApp_(app, requestId);
    if (!claim) return { success: false, message: '申請が見つかりません。' };
    if (!canViewApplication_(app, claim, userEmail)) {
      return { success: false, message: '閲覧権限がありません。' };
    }
    return {
      success: true,
      appCode: app.appCode,
      appName: app.appName,
      dataType: 'claim',
      item: claimToPortalItem_(claim, app),
      detail: claim,
      webAppUrl: app.webAppUrl || ''
    };
  }
  if (dataType === 'purchase') {
    var purchase = getPurchaseWithDetailsFromApp_(app, requestId);
    if (!purchase) return { success: false, message: '申請が見つかりません。' };
    if (!canViewApplication_(app, purchase, userEmail)) {
      return { success: false, message: '閲覧権限がありません。' };
    }
    purchase = enrichTripWithWorkflowStep_(purchase);
    return {
      success: true,
      appCode: app.appCode,
      appName: app.appName,
      dataType: 'purchase',
      item: purchaseToPortalItem_(purchase, app),
      detail: purchase,
      webAppUrl: app.webAppUrl || ''
    };
  }
  return { success: false, message: '未対応のデータ種別です（' + dataType + '）' };
}

function approveApplicationByType_(app, requestId, comment) {
  var dataType = String(app.dataType || '').trim().toLowerCase();
  if (dataType === 'trip') return approveTripFromPortal_(app, requestId, comment);
  if (dataType === 'claim') return approveClaimFromPortal_(app, requestId, comment);
  if (dataType === 'purchase') return approvePurchaseFromPortal_(app, requestId, comment);
  return { success: false, message: '未対応のデータ種別です。' };
}

function rejectApplicationByType_(app, requestId, reason, rejectTargetChoice) {
  var dataType = String(app.dataType || '').trim().toLowerCase();
  if (dataType === 'trip') return rejectTripFromPortal_(app, requestId, reason, rejectTargetChoice);
  if (dataType === 'claim') return rejectClaimFromPortal_(app, requestId, reason);
  if (dataType === 'purchase') return rejectPurchaseFromPortal_(app, requestId, reason, rejectTargetChoice);
  return { success: false, message: '未対応のデータ種別です。' };
}
