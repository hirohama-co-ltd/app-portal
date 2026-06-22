// ========================================
// ✅ ポータルからの承認・差戻し
// ========================================

function approveApplication(appCode, requestId, comment) {
  var app = getPortalAppByCode_(appCode);
  if (!app) return { success: false, message: 'アプリが見つかりません。' };
  if (!isSupportedDataType_(app.dataType)) {
    return { success: false, message: '未対応のデータ種別です。' };
  }
  return approveApplicationByType_(app, requestId, comment || '承認しました');
}

function rejectApplication(appCode, requestId, reason, rejectTargetChoice) {
  reason = String(reason || '').trim();
  if (!reason) return { success: false, message: '差戻し理由を入力してください。' };

  var app = getPortalAppByCode_(appCode);
  if (!app) return { success: false, message: 'アプリが見つかりません。' };
  if (!isSupportedDataType_(app.dataType)) {
    return { success: false, message: '未対応のデータ種別です。' };
  }
  return rejectApplicationByType_(app, requestId, reason, rejectTargetChoice);
}

function approveTripFromPortal_(app, tripRequestId, comment) {
  var userEmail = getCurrentUserEmail_();
  var trip = getTripFromApp_(app, tripRequestId);
  if (!trip) return { success: false, message: '申請が見つかりません。' };
  if (trip.status !== TRIP_STATUS.SUBMITTED) {
    return { success: false, message: '申請中のデータのみ承認できます。' };
  }
  if (trip.approverEmail !== userEmail) {
    return { success: false, message: '承認権限がありません。' };
  }

  try {
    var nextStep = getNextWorkflowStep_(trip.routeId, trip.applicantEmail, trip.currentStep);
    if (nextStep) {
      trip.currentStep = nextStep.stepNo;
      trip.currentStepName = nextStep.stepName;
      trip.approverEmail = nextStep.approverEmail;
      trip.updatedAt = formatDateTime(new Date());
      writeTripRowToApp_(app, trip);
      appendTripHistory_(app, tripRequestId, '承認（' + (trip.currentStep - 1) + '/' + trip.totalSteps + '）', comment);
      return {
        success: true,
        message: '承認しました。次の承認者（' + nextStep.stepName + '）に回りました。'
      };
    }

    trip.status = TRIP_STATUS.APPROVED;
    trip.approvedAt = formatDateTime(new Date());
    trip.rejectReason = '';
    trip.updatedAt = trip.approvedAt;
    writeTripRowToApp_(app, trip);
    appendTripHistory_(app, tripRequestId, '承認', comment);
    return { success: true, message: '承認しました。' };
  } catch (e) {
    return { success: false, message: e.message || String(e) };
  }
}

function rejectTripFromPortal_(app, tripRequestId, reason, rejectTargetChoice) {
  var userEmail = getCurrentUserEmail_();
  var trip = getTripFromApp_(app, tripRequestId);
  if (!trip) return { success: false, message: '申請が見つかりません。' };
  if (trip.status !== TRIP_STATUS.SUBMITTED) {
    return { success: false, message: '申請中のデータのみ差戻しできます。' };
  }
  if (trip.approverEmail !== userEmail) {
    return { success: false, message: '承認権限がありません。' };
  }

  try {
    trip = enrichTripWithWorkflowStep_(trip);
    var route = resolveRejectRoute_(trip, rejectTargetChoice);
    if (route.mode === 'previous_step') {
      trip.currentStep = route.stepNo;
      trip.currentStepName = route.stepName;
      trip.approverEmail = route.approverEmail;
      trip.rejectReason = reason;
      trip.updatedAt = formatDateTime(new Date());
      writeTripRowToApp_(app, trip);
      appendTripHistory_(app, tripRequestId, '差戻し（前ステップへ）', reason);
      return {
        success: true,
        message: '差戻しました。前の承認者（' + route.stepName + '）に戻しました。'
      };
    }

    trip.status = TRIP_STATUS.REJECTED;
    trip.rejectReason = reason;
    trip.approvedAt = '';
    trip.currentStep = 0;
    trip.currentStepName = '';
    trip.updatedAt = formatDateTime(new Date());
    writeTripRowToApp_(app, trip);
    appendTripHistory_(app, tripRequestId, '差戻し', reason);
    return { success: true, message: '差戻しました。' };
  } catch (e) {
    return { success: false, message: e.message || String(e) };
  }
}

function approveClaimFromPortal_(app, claimId, comment) {
  var userEmail = getCurrentUserEmail_();
  var claim = getClaimFromApp_(app, claimId);
  if (!claim) return { success: false, message: '申請が見つかりません。' };
  if (claim.status !== CLAIM_STATUS.SUBMITTED) {
    return { success: false, message: '申請中のデータのみ承認できます。' };
  }
  if (claim.approverEmail !== userEmail) {
    return { success: false, message: '承認権限がありません。' };
  }

  try {
    claim.status = CLAIM_STATUS.APPROVED;
    claim.approvedAt = formatDateTime(new Date());
    claim.rejectReason = '';
    claim.updatedAt = claim.approvedAt;
    writeClaimRowToApp_(app, claim);
    appendClaimHistory_(app, claimId, '承認', comment);
    return { success: true, message: '承認しました。' };
  } catch (e) {
    return { success: false, message: e.message || String(e) };
  }
}

function rejectClaimFromPortal_(app, claimId, reason) {
  var userEmail = getCurrentUserEmail_();
  var claim = getClaimFromApp_(app, claimId);
  if (!claim) return { success: false, message: '申請が見つかりません。' };
  if (claim.status !== CLAIM_STATUS.SUBMITTED) {
    return { success: false, message: '申請中のデータのみ差戻しできます。' };
  }
  if (claim.approverEmail !== userEmail) {
    return { success: false, message: '承認権限がありません。' };
  }

  try {
    claim.status = CLAIM_STATUS.REJECTED;
    claim.rejectReason = reason;
    claim.approvedAt = '';
    claim.updatedAt = formatDateTime(new Date());
    writeClaimRowToApp_(app, claim);
    appendClaimHistory_(app, claimId, '差戻し', reason);
    return { success: true, message: '差戻しました。' };
  } catch (e) {
    return { success: false, message: e.message || String(e) };
  }
}
