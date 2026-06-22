// ========================================
// 💾 各業務アプリのスプレッドシート読み書き
// ========================================

var TRIP_SHEET = '出張申請一覧';
var TRIP_HISTORY_SHEET = '承認履歴';
var TRIP_HEADERS = [
  '出張申請ID', '申請日', '申請者Email', '申請者名', '出張開始日', '直行', '出張終了日', '直帰',
  '出張先', '目的', '交通手段', '宿泊先', '宿泊代金', '仮払金', '備考',
  'ステータス', '精算状況', '精算ID', '承認者Email', '承認日時', '差戻し理由', '更新日時',
  '経路ID', '現在ステップ', '総ステップ数', '現在ステップ名'
];
var TRIP_HISTORY_HEADERS = ['出張申請ID', '操作日時', '操作者Email', '操作', 'コメント'];

var CLAIM_SHEET = '申請一覧';
var CLAIM_DETAIL_SHEET = '経費明細';
var CLAIM_HISTORY_SHEET = '承認履歴';
var CLAIM_HEADERS = [
  '精算ID', '出張申請ID', '申請日', '申請者Email', '申請者名', '出張開始日', '出張終了日',
  '出張先', '目的', 'ステータス', '合計金額', '日当日数', '日当合計', '備考',
  '承認者Email', '承認日時', '差戻し理由', '更新日時'
];
var CLAIM_DETAIL_HEADERS = ['精算ID', '行No', '日付', '経費区分', '内容', '金額', '領収書URL', '備考'];
var CLAIM_HISTORY_HEADERS = ['精算ID', '操作日時', '操作者Email', '操作', 'コメント'];

var PURCHASE_SHEET = '購買申請一覧';
var PURCHASE_HISTORY_SHEET = '承認履歴';
var PURCHASE_HEADERS = [
  '購買申請ID', '申請日', '申請者Email', '申請者名', '希望納期',
  '購入先', '品名', '数量', '単価', '合計金額', '購買目的', '予算区分', '支払方法', '備考',
  'マスタ登録状態', '未登録マスタ件数', 'ステータス', '承認者Email', '承認日時', '差戻し理由', '更新日時',
  '経路ID', '現在ステップ', '総ステップ数', '現在ステップ名'
];
var PURCHASE_HISTORY_HEADERS = ['購買申請ID', '操作日時', '操作者Email', '操作', 'コメント'];
var PURCHASE_DETAIL_SHEET = '購買明細';
var PURCHASE_DETAIL_HEADERS = ['購買申請ID', '行No', 'メーカー', '品番', '品名', '数量', '単価', '金額', '備考'];

function openAppSpreadsheet_(app) {
  if (!app || !String(app.ssId || '').trim()) return null;
  try {
    return SpreadsheetApp.openById(String(app.ssId).trim());
  } catch (e) {
    Logger.log('openAppSpreadsheet_(' + (app.appCode || '') + '): ' + e.message);
    return null;
  }
}

function ensureHeaders_(sheet, headers) {
  var existing = sheet.getLastRow() >= 1
    ? sheet.getRange(1, 1, 1, headers.length).getValues()[0]
    : [];
  var match = true;
  for (var i = 0; i < headers.length; i++) {
    if (String(existing[i] || '').trim() !== headers[i]) { match = false; break; }
  }
  if (!match) {
    sheet.getRange(1, 1, 1, headers.length).setValues([headers]);
    sheet.getRange(1, 1, 1, headers.length).setFontWeight('bold').setBackground('#e2e8f0');
    sheet.setFrozenRows(1);
  }
}

function mapTripRow_(data) {
  var directDepart = data[5] === true || data[5] === 'TRUE' || data[5] === 'はい';
  var directReturn = data[7] === true || data[7] === 'TRUE' || data[7] === 'はい';
  var tripStartRaw = data[4];
  var tripEndRaw = data[6];
  return {
    tripRequestId: String(data[0]),
    requestDate: normalizeDate(data[1]),
    applicantEmail: String(data[2] || '').trim().toLowerCase(),
    applicantName: String(data[3] || ''),
    tripStart: directDepart ? normalizeDate(tripStartRaw) : normalizeDateTime(tripStartRaw),
    directDepart: directDepart,
    tripEnd: directReturn ? normalizeDate(tripEndRaw) : normalizeDateTime(tripEndRaw),
    directReturn: directReturn,
    destination: String(data[8] || ''),
    purpose: String(data[9] || ''),
    transport: String(data[10] || ''),
    lodgingDestination: String(data[11] || ''),
    lodgingCost: normalizeAmount(data[12]),
    advancePayment: normalizeAmount(data[13]),
    note: String(data[14] || ''),
    status: String(data[15] || TRIP_STATUS.DRAFT),
    settlementStatus: String(data[16] || SETTLEMENT_STATUS.NONE),
    expenseClaimId: String(data[17] || ''),
    approverEmail: String(data[18] || '').trim().toLowerCase(),
    approvedAt: formatDateTime(data[19]),
    rejectReason: String(data[20] || ''),
    updatedAt: formatDateTime(data[21]),
    routeId: String(data[22] || '').trim(),
    currentStep: parseInt(data[23], 10) || 0,
    totalSteps: parseInt(data[24], 10) || 0,
    currentStepName: String(data[25] || '').trim()
  };
}

function tripRowToValues_(r) {
  return [
    r.tripRequestId, r.requestDate, r.applicantEmail, r.applicantName,
    r.tripStart, r.directDepart, r.tripEnd, r.directReturn,
    r.destination, r.purpose, r.transport, r.lodgingDestination,
    r.lodgingCost, r.advancePayment, r.note, r.status, r.settlementStatus, r.expenseClaimId,
    r.approverEmail, r.approvedAt, r.rejectReason, r.updatedAt,
    r.routeId || '', r.currentStep || 0, r.totalSteps || 0, r.currentStepName || ''
  ];
}

function readTripRowsFromApp_(app, filterFn) {
  var ss = openAppSpreadsheet_(app);
  if (!ss) return [];
  var sheet = ss.getSheetByName(TRIP_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var colCount = Math.max(TRIP_HEADERS.length, sheet.getLastColumn());
  var data = sheet.getRange(2, 1, sheet.getLastRow(), colCount).getValues();
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    if (!data[i][0]) continue;
    var row = mapTripRow_(data[i]);
    if (!filterFn || filterFn(row)) rows.push(row);
  }
  return rows;
}

function writeTripRowToApp_(app, trip) {
  var ss = openAppSpreadsheet_(app);
  if (!ss) throw new Error('出張申請ブックを開けません。ssId と権限を確認してください。');
  var sheet = ss.getSheetByName(TRIP_SHEET);
  if (!sheet) throw new Error('「' + TRIP_SHEET + '」シートがありません。');
  ensureHeaders_(sheet, TRIP_HEADERS);

  var all = readTripRowsFromApp_(app);
  var idx = -1;
  for (var i = 0; i < all.length; i++) {
    if (all[i].tripRequestId === trip.tripRequestId) { idx = i; break; }
  }
  if (idx >= 0) all[idx] = trip;
  else all.push(trip);

  sheet.getRange(1, 1, 1, TRIP_HEADERS.length).setValues([TRIP_HEADERS]);
  if (all.length === 0) {
    if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
    return;
  }
  var values = all.map(tripRowToValues_);
  if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
  sheet.getRange(2, 1, values.length, TRIP_HEADERS.length).setValues(values);
}

function appendTripHistory_(app, tripRequestId, action, comment) {
  var ss = openAppSpreadsheet_(app);
  if (!ss) return;
  var sheet = ss.getSheetByName(TRIP_HISTORY_SHEET) || ss.insertSheet(TRIP_HISTORY_SHEET);
  ensureHeaders_(sheet, TRIP_HISTORY_HEADERS);
  sheet.appendRow([tripRequestId, formatDateTime(new Date()), getCurrentUserEmail_(), action, comment || '']);
}

function getTripFromApp_(app, tripRequestId) {
  var id = String(tripRequestId || '').trim();
  var rows = readTripRowsFromApp_(app, function(r) { return r.tripRequestId === id; });
  return rows.length ? rows[0] : null;
}

function mapClaimRow_(data) {
  return {
    claimId: String(data[0]),
    tripRequestId: String(data[1] || ''),
    claimDate: normalizeDate(data[2]),
    applicantEmail: String(data[3] || '').trim().toLowerCase(),
    applicantName: String(data[4] || ''),
    tripStart: normalizeDate(data[5]),
    tripEnd: normalizeDate(data[6]),
    destination: String(data[7] || ''),
    purpose: String(data[8] || ''),
    status: String(data[9] || CLAIM_STATUS.DRAFT),
    totalAmount: normalizeAmount(data[10]),
    perDiemDays: parseInt(data[11], 10) || 0,
    perDiemTotal: normalizeAmount(data[12]),
    note: String(data[13] || ''),
    approverEmail: String(data[14] || '').trim().toLowerCase(),
    approvedAt: formatDateTime(data[15]),
    rejectReason: String(data[16] || ''),
    updatedAt: formatDateTime(data[17])
  };
}

function claimRowToValues_(r) {
  return [
    r.claimId, r.tripRequestId || '', r.claimDate, r.applicantEmail, r.applicantName,
    r.tripStart, r.tripEnd, r.destination, r.purpose, r.status,
    r.totalAmount, r.perDiemDays, r.perDiemTotal, r.note,
    r.approverEmail, r.approvedAt, r.rejectReason, r.updatedAt
  ];
}

function readClaimRowsFromApp_(app, filterFn) {
  var ss = openAppSpreadsheet_(app);
  if (!ss) return [];
  var sheet = ss.getSheetByName(CLAIM_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var lastCol = Math.max(sheet.getLastColumn(), CLAIM_HEADERS.length);
  var headers = sheet.getRange(1, 1, 1, lastCol).getValues()[0].map(function(h) {
    return String(h || '').trim();
  });
  var legacy = headers[0] === '申請ID' && headers.indexOf('出張申請ID') === -1;
  var data = sheet.getRange(2, 1, sheet.getLastRow(), lastCol).getValues();
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    if (!data[i][0]) continue;
    var row = legacy ? mapLegacyClaimRow_(data[i]) : mapClaimRow_(data[i]);
    if (!filterFn || filterFn(row)) rows.push(row);
  }
  return rows;
}

function mapLegacyClaimRow_(data) {
  return {
    claimId: String(data[0]),
    tripRequestId: '',
    claimDate: normalizeDate(data[1]),
    applicantEmail: String(data[2] || '').trim().toLowerCase(),
    applicantName: String(data[3] || ''),
    tripStart: normalizeDate(data[4]),
    tripEnd: normalizeDate(data[5]),
    destination: String(data[6] || ''),
    purpose: String(data[7] || ''),
    status: String(data[8] || CLAIM_STATUS.DRAFT),
    totalAmount: normalizeAmount(data[9]),
    perDiemDays: parseInt(data[10], 10) || 0,
    perDiemTotal: normalizeAmount(data[11]),
    note: String(data[12] || ''),
    approverEmail: String(data[13] || '').trim().toLowerCase(),
    approvedAt: formatDateTime(data[14]),
    rejectReason: String(data[15] || ''),
    updatedAt: formatDateTime(data[16])
  };
}

function writeClaimRowToApp_(app, claim) {
  var ss = openAppSpreadsheet_(app);
  if (!ss) throw new Error('旅費精算ブックを開けません。ssId と権限を確認してください。');
  var sheet = ss.getSheetByName(CLAIM_SHEET);
  if (!sheet) throw new Error('「' + CLAIM_SHEET + '」シートがありません。');
  ensureHeaders_(sheet, CLAIM_HEADERS);

  var all = readClaimRowsFromApp_(app);
  var idx = -1;
  for (var i = 0; i < all.length; i++) {
    if (all[i].claimId === claim.claimId) { idx = i; break; }
  }
  if (idx >= 0) all[idx] = claim;
  else all.push(claim);

  sheet.getRange(1, 1, 1, CLAIM_HEADERS.length).setValues([CLAIM_HEADERS]);
  if (all.length === 0) {
    if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
    return;
  }
  var values = all.map(claimRowToValues_);
  if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
  sheet.getRange(2, 1, values.length, CLAIM_HEADERS.length).setValues(values);
}

function appendClaimHistory_(app, claimId, action, comment) {
  var ss = openAppSpreadsheet_(app);
  if (!ss) return;
  var sheet = ss.getSheetByName(CLAIM_HISTORY_SHEET) || ss.insertSheet(CLAIM_HISTORY_SHEET);
  ensureHeaders_(sheet, CLAIM_HISTORY_HEADERS);
  sheet.appendRow([claimId, formatDateTime(new Date()), getCurrentUserEmail_(), action, comment || '']);
}

function getClaimFromApp_(app, claimId) {
  var id = String(claimId || '').trim();
  var rows = readClaimRowsFromApp_(app, function(r) { return r.claimId === id; });
  return rows.length ? rows[0] : null;
}

function readClaimDetailsFromApp_(app, claimId) {
  var ss = openAppSpreadsheet_(app);
  if (!ss) return [];
  var sheet = ss.getSheetByName(CLAIM_DETAIL_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow(), CLAIM_DETAIL_HEADERS.length).getValues();
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    if (!data[i][0]) continue;
    if (claimId && String(data[i][0]) !== claimId) continue;
    rows.push({
      lineNo: parseInt(data[i][1], 10) || (i + 1),
      date: normalizeDate(data[i][2]),
      category: String(data[i][3] || ''),
      description: String(data[i][4] || ''),
      amount: normalizeAmount(data[i][5])
    });
  }
  rows.sort(function(a, b) { return a.lineNo - b.lineNo; });
  return rows;
}

function getClaimWithDetailsFromApp_(app, claimId) {
  var claim = getClaimFromApp_(app, claimId);
  if (!claim) return null;
  claim.details = readClaimDetailsFromApp_(app, claimId);
  return claim;
}

function mapHeaderColumns_(headers) {
  var map = {};
  for (var i = 0; i < headers.length; i++) {
    var key = String(headers[i] || '').trim();
    if (key) map[key] = i;
  }
  return map;
}

function portalCell_(data, colMap, header, fallback) {
  var idx = colMap && colMap.hasOwnProperty(header) ? colMap[header] : -1;
  return idx >= 0 ? data[idx] : fallback;
}

function mapPurchaseRow_(data, colMap) {
  return {
    purchaseRequestId: String(portalCell_(data, colMap, '購買申請ID', data[0]) || '').trim(),
    requestDate: normalizeDate(portalCell_(data, colMap, '申請日', data[1])),
    applicantEmail: String(portalCell_(data, colMap, '申請者Email', data[2]) || '').trim().toLowerCase(),
    applicantName: String(portalCell_(data, colMap, '申請者名', data[3]) || ''),
    desiredDate: normalizeDate(portalCell_(data, colMap, '希望納期', data[4])),
    supplier: String(portalCell_(data, colMap, '購入先', data[5]) || ''),
    itemName: String(portalCell_(data, colMap, '品名', data[6]) || ''),
    quantity: normalizeAmount(portalCell_(data, colMap, '数量', data[7])),
    unitPrice: normalizeAmount(portalCell_(data, colMap, '単価', data[8])),
    totalAmount: normalizeAmount(portalCell_(data, colMap, '合計金額', data[9])),
    purpose: String(portalCell_(data, colMap, '購買目的', data[10]) || ''),
    budgetCategory: String(portalCell_(data, colMap, '予算区分', data[11]) || ''),
    paymentMethod: String(portalCell_(data, colMap, '支払方法', data[12]) || ''),
    note: String(portalCell_(data, colMap, '備考', data[13]) || ''),
    masterStatus: String(portalCell_(data, colMap, 'マスタ登録状態', '登録済') || '登録済'),
    unregisteredMasterCount: parseInt(portalCell_(data, colMap, '未登録マスタ件数', 0), 10) || 0,
    status: String(portalCell_(data, colMap, 'ステータス', data[14]) || PURCHASE_STATUS.DRAFT),
    approverEmail: String(portalCell_(data, colMap, '承認者Email', data[15]) || '').trim().toLowerCase(),
    approvedAt: formatDateTime(portalCell_(data, colMap, '承認日時', data[16])),
    rejectReason: String(portalCell_(data, colMap, '差戻し理由', data[17]) || ''),
    updatedAt: formatDateTime(portalCell_(data, colMap, '更新日時', data[18])),
    routeId: String(portalCell_(data, colMap, '経路ID', data[19]) || '').trim(),
    currentStep: parseInt(portalCell_(data, colMap, '現在ステップ', data[20]), 10) || 0,
    totalSteps: parseInt(portalCell_(data, colMap, '総ステップ数', data[21]), 10) || 0,
    currentStepName: String(portalCell_(data, colMap, '現在ステップ名', data[22]) || '').trim()
  };
}

function purchaseRowToValues_(r) {
  return [
    r.purchaseRequestId, r.requestDate, r.applicantEmail, r.applicantName, r.desiredDate,
    r.supplier, r.itemName, r.quantity, r.unitPrice, r.totalAmount, r.purpose,
    r.budgetCategory, r.paymentMethod, r.note, r.masterStatus || '登録済',
    r.unregisteredMasterCount || 0, r.status, r.approverEmail, r.approvedAt,
    r.rejectReason, r.updatedAt, r.routeId || '', r.currentStep || 0, r.totalSteps || 0, r.currentStepName || ''
  ];
}

function readPurchaseRowsFromApp_(app, filterFn) {
  var ss = openAppSpreadsheet_(app);
  if (!ss) return [];
  var sheet = ss.getSheetByName(PURCHASE_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var colCount = Math.max(PURCHASE_HEADERS.length, sheet.getLastColumn());
  var colMap = mapHeaderColumns_(sheet.getRange(1, 1, 1, colCount).getValues()[0]);
  var data = sheet.getRange(2, 1, sheet.getLastRow(), colCount).getValues();
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    if (!data[i][0]) continue;
    var row = mapPurchaseRow_(data[i], colMap);
    if (!filterFn || filterFn(row)) rows.push(row);
  }
  return rows;
}

function writePurchaseRowToApp_(app, purchase) {
  var ss = openAppSpreadsheet_(app);
  if (!ss) throw new Error('購買申請ブックを開けません。ssId と権限を確認してください。');
  var sheet = ss.getSheetByName(PURCHASE_SHEET);
  if (!sheet) throw new Error('「' + PURCHASE_SHEET + '」シートがありません。');
  ensureHeaders_(sheet, PURCHASE_HEADERS);

  var all = readPurchaseRowsFromApp_(app);
  var idx = -1;
  for (var i = 0; i < all.length; i++) {
    if (all[i].purchaseRequestId === purchase.purchaseRequestId) { idx = i; break; }
  }
  if (idx >= 0) all[idx] = purchase;
  else all.push(purchase);

  sheet.getRange(1, 1, 1, PURCHASE_HEADERS.length).setValues([PURCHASE_HEADERS]);
  if (all.length === 0) {
    if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
    return;
  }
  var values = all.map(purchaseRowToValues_);
  if (sheet.getLastRow() > 1) sheet.deleteRows(2, sheet.getLastRow() - 1);
  sheet.getRange(2, 1, values.length, PURCHASE_HEADERS.length).setValues(values);
}

function appendPurchaseHistory_(app, purchaseRequestId, action, comment) {
  var ss = openAppSpreadsheet_(app);
  if (!ss) return;
  var sheet = ss.getSheetByName(PURCHASE_HISTORY_SHEET) || ss.insertSheet(PURCHASE_HISTORY_SHEET);
  ensureHeaders_(sheet, PURCHASE_HISTORY_HEADERS);
  sheet.appendRow([purchaseRequestId, formatDateTime(new Date()), getCurrentUserEmail_(), action, comment || '']);
}

function getPurchaseFromApp_(app, purchaseRequestId) {
  var id = String(purchaseRequestId || '').trim();
  var rows = readPurchaseRowsFromApp_(app, function(r) { return r.purchaseRequestId === id; });
  return rows.length ? rows[0] : null;
}

function readPurchaseDetailsFromApp_(app, purchaseRequestId) {
  var ss = openAppSpreadsheet_(app);
  if (!ss) return [];
  var sheet = ss.getSheetByName(PURCHASE_DETAIL_SHEET);
  if (!sheet || sheet.getLastRow() < 2) return [];
  var data = sheet.getRange(2, 1, sheet.getLastRow() - 1, PURCHASE_DETAIL_HEADERS.length).getValues();
  var rows = [];
  for (var i = 0; i < data.length; i++) {
    if (!data[i][0]) continue;
    if (purchaseRequestId && String(data[i][0]) !== purchaseRequestId) continue;
    rows.push({
      lineNo: parseInt(data[i][1], 10) || (i + 1),
      maker: String(data[i][2] || ''),
      modelNumber: String(data[i][3] || ''),
      itemName: String(data[i][4] || ''),
      quantity: normalizeAmount(data[i][5]),
      unitPrice: normalizeAmount(data[i][6]),
      amount: normalizeAmount(data[i][7]),
      note: String(data[i][8] || '')
    });
  }
  rows.sort(function(a, b) { return a.lineNo - b.lineNo; });
  return rows;
}

function getPurchaseWithDetailsFromApp_(app, purchaseRequestId) {
  var purchase = getPurchaseFromApp_(app, purchaseRequestId);
  if (!purchase) return null;
  purchase.details = readPurchaseDetailsFromApp_(app, purchaseRequestId);
  return purchase;
}
