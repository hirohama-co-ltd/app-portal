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

function purchaseToPortalItem_(purchase, app) {
  return {
    appCode: app.appCode,
    appName: app.appName,
    dataType: 'purchase',
    requestId: purchase.purchaseRequestId,
    requestDate: purchase.requestDate,
    applicantEmail: purchase.applicantEmail,
    applicantName: purchase.applicantName,
    title: purchase.itemName,
    subtitle: purchase.purpose,
    status: purchase.status,
    extraStatus: purchase.supplier || '',
    masterStatus: purchase.masterStatus || '登録済',
    unregisteredMasterCount: purchase.unregisteredMasterCount || 0,
    tripStart: purchase.desiredDate,
    tripEnd: purchase.desiredDate,
    amount: purchase.totalAmount,
    approverEmail: purchase.approverEmail,
    routeId: purchase.routeId,
    currentStep: purchase.currentStep,
    totalSteps: purchase.totalSteps,
    currentStepName: purchase.currentStepName,
    updatedAt: purchase.updatedAt,
    webAppUrl: app.webAppUrl || ''
  };
}

function isPurchaseMasterPendingNotice_(item, employee) {
  return item && item.dataType === 'purchase' &&
    item.status === PURCHASE_STATUS.APPROVED &&
    item.masterStatus === 'マスタ未登録あり' &&
    employeeHasRole_(employee, 'ワークフロー管理者');
}

function canViewApplication_(app, record, userEmail) {
  if (!record || !userEmail) return false;
  if (String(app.dataType || '').trim().toLowerCase() === 'purchase' &&
      record.status === PURCHASE_STATUS.APPROVED &&
      record.masterStatus === 'マスタ未登録あり' &&
      employeeHasRole_(findEmployeeByEmail(userEmail), 'ワークフロー管理者')) {
    return true;
  }
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

  var myApplications = [];
  var pendingApprovals = [];

  if (userEmail) {
    // 各業務アプリのブックは1回だけ開いて全行を読み、
    // 「自分の申請」と「承認待ち」をメモリ上で振り分ける（openById の重複回避）。
    getActivePortalApps_().forEach(function(app) {
      collectItemsFromApp_(app, null).forEach(function(item) {
        if (item.applicantEmail === userEmail) myApplications.push(item);
        if (isPendingRecord_(item, item.dataType, userEmail) || isPurchaseMasterPendingNotice_(item, employee)) {
          pendingApprovals.push(item);
        }
      });
    });

    myApplications.sort(function(a, b) {
      return (b.updatedAt || b.requestDate || '').localeCompare(a.updatedAt || a.requestDate || '');
    });
    pendingApprovals.sort(function(a, b) {
      return (a.requestDate || '').localeCompare(b.requestDate || '');
    });
  }

  return {
    userEmail: userEmail,
    employee: employee,
    launchers: getPortalLaunchers_(),
    myApplications: myApplications,
    pendingApprovals: pendingApprovals,
    configWarnings: getPortalConfigWarnings_(),
    workflowLinked: isWorkflowLinked_()
  };
}

function refreshPortalData() {
  return getPortalInitialData();
}
