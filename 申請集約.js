// ========================================
// 📊 申請一覧・承認待ちの横断集約
// ========================================

function tripToPortalItem_(trip, app) {
  return {
    appCode: app.appCode,
    appName: app.appName,
    dataType: 'trip',
    requestId: trip.tripRequestId,
    requestDate: trip.requestDate,
    applicantEmail: trip.applicantEmail,
    applicantName: trip.applicantName,
    title: trip.destination,
    subtitle: trip.purpose,
    status: trip.status,
    extraStatus: trip.settlementStatus,
    tripStart: trip.tripStart,
    tripEnd: trip.tripEnd,
    amount: trip.advancePayment,
    approverEmail: trip.approverEmail,
    routeId: trip.routeId,
    currentStep: trip.currentStep,
    totalSteps: trip.totalSteps,
    currentStepName: trip.currentStepName,
    updatedAt: trip.updatedAt,
    webAppUrl: app.webAppUrl || ''
  };
}

function claimToPortalItem_(claim, app) {
  return {
    appCode: app.appCode,
    appName: app.appName,
    dataType: 'claim',
    requestId: claim.claimId,
    requestDate: claim.claimDate,
    applicantEmail: claim.applicantEmail,
    applicantName: claim.applicantName,
    title: claim.destination,
    subtitle: claim.purpose,
    status: claim.status,
    extraStatus: claim.tripRequestId ? '出張:' + claim.tripRequestId : '',
    tripStart: claim.tripStart,
    tripEnd: claim.tripEnd,
    amount: normalizeAmount(claim.totalAmount) + normalizeAmount(claim.perDiemTotal),
    approverEmail: claim.approverEmail,
    routeId: '',
    currentStep: 0,
    totalSteps: 0,
    currentStepName: '',
    updatedAt: claim.updatedAt,
    webAppUrl: app.webAppUrl || ''
  };
}

function listMyApplications() {
  var userEmail = getCurrentUserEmail_();
  if (!userEmail) return [];

  var items = [];
  getActivePortalApps_().forEach(function(app) {
    items = items.concat(collectItemsFromApp_(app, function(r) {
      return r.applicantEmail === userEmail;
    }));
  });

  items.sort(function(a, b) {
    return (b.updatedAt || b.requestDate || '').localeCompare(a.updatedAt || a.requestDate || '');
  });
  return items;
}

function listPendingApprovals() {
  var userEmail = getCurrentUserEmail_();
  if (!userEmail) return [];

  var items = [];
  getActivePortalApps_().forEach(function(app) {
    items = items.concat(collectItemsFromApp_(app, function(r) {
      return isPendingRecord_(r, app.dataType, userEmail);
    }));
  });

  items.sort(function(a, b) {
    return (a.requestDate || '').localeCompare(b.requestDate || '');
  });
  return items;
}

function canViewApplication_(app, record, userEmail) {
  if (!record || !userEmail) return false;
  return record.applicantEmail === userEmail || record.approverEmail === userEmail;
}

function getApplicationDetail(appCode, requestId) {
  var app = getPortalAppByCode_(appCode);
  if (!app || !String(app.ssId || '').trim()) {
    return { success: false, message: 'アプリ設定が見つかりません。' };
  }
  if (!isSupportedDataType_(app.dataType)) {
    return { success: false, message: '未対応のデータ種別です。' };
  }
  return getApplicationDetailByType_(app, requestId, getCurrentUserEmail_());
}

function getPortalInitialData() {
  var userEmail = getCurrentUserEmail_();
  var employee = findEmployeeByEmail(userEmail);
  var pending = listPendingApprovals();

  return {
    userEmail: userEmail,
    employee: employee,
    launchers: getPortalLaunchers_(),
    myApplications: listMyApplications(),
    pendingApprovals: pending,
    configWarnings: getPortalConfigWarnings_(),
    workflowLinked: isWorkflowLinked_()
  };
}

function refreshPortalData() {
  return getPortalInitialData();
}
