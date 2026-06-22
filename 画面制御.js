function doGet() {
  return HtmlService.createTemplateFromFile('index')
    .evaluate()
    .setTitle('申請ポータル')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1.0')
    .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
}

function getInitialAppData() {
  return getPortalInitialData();
}

function refreshAppData() {
  return refreshPortalData();
}

function getApplicationDetailApi(appCode, requestId) {
  return getApplicationDetail(appCode, requestId);
}

function approveApplicationApi(appCode, requestId, comment) {
  var res = approveApplication(appCode, requestId, comment);
  if (res.success) {
    res.data = refreshPortalData();
  }
  return res;
}

function rejectApplicationApi(appCode, requestId, reason, rejectTargetChoice) {
  var res = rejectApplication(appCode, requestId, reason, rejectTargetChoice);
  if (res.success) {
    res.data = refreshPortalData();
  }
  return res;
}
