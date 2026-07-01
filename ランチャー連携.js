// ========================================
// アプリトップ向け — 通知サマリー（ライブラリ公開）
// ========================================

function getLauncherNotificationBundle(portalWebAppUrl) {
  return portalPerfRun_('getLauncherNotificationBundle', function() {
    portalWebAppUrl = String(portalWebAppUrl || '').trim();
    if (!portalWebAppUrl) {
      return {
        success: false,
        items: [],
        totalCount: 0,
        message: 'ポータルURLが未設定です。'
      };
    }

    var data = getPortalInitialData({ useCache: true });
    var userEmail = data.userEmail || getCurrentUserEmail_();
    var items = [];

    (data.pendingApprovals || []).forEach(function(item) {
      if (isPendingRecord_(item, item.dataType, userEmail)) {
        items.push(buildLauncherApprovalNotification_(item, portalWebAppUrl));
        return;
      }
      if (isPurchaseMasterPendingNotice_(item, data.employee)) {
        items.push(buildLauncherMasterNoticeNotification_(item, portalWebAppUrl));
      }
    });

    if (data.isMasterAdmin) {
      var masterResult = getPendingPurchaseMasterCandidatesForPortal_();
      if (masterResult.success) {
        (masterResult.candidates || []).forEach(function(candidate) {
          items.push(buildLauncherMasterCandidateNotification_(candidate, portalWebAppUrl));
        });
      }
    }

    return {
      success: true,
      totalCount: items.length,
      portalUrl: portalWebAppUrl,
      items: items
    };
  });
}

function buildLauncherApprovalNotification_(item, portalWebAppUrl) {
  return {
    kind: 'approval',
    kindLabel: '承認待ち',
    title: item.title || item.requestId || '（無題）',
    subtitle: buildLauncherNotificationSubtitle_(item),
    appCode: item.appCode,
    requestId: item.requestId,
    appName: item.appName,
    url: buildPortalDeepLink_(portalWebAppUrl, 'approval', item.appCode, item.requestId)
  };
}

function buildLauncherMasterNoticeNotification_(item, portalWebAppUrl) {
  return {
    kind: 'master_notice',
    kindLabel: 'マスタ未登録あり',
    title: item.title || item.requestId || '（無題）',
    subtitle: buildLauncherNotificationSubtitle_(item),
    appCode: item.appCode,
    requestId: item.requestId,
    appName: item.appName,
    url: buildPortalDeepLink_(portalWebAppUrl, 'approval', item.appCode, item.requestId)
  };
}

function buildLauncherMasterCandidateNotification_(candidate, portalWebAppUrl) {
  var subtitleParts = [];
  if (candidate.type) subtitleParts.push(candidate.type);
  if (candidate.appName) subtitleParts.push(candidate.appName);
  if (candidate.purchaseRequestId) subtitleParts.push(candidate.purchaseRequestId);

  return {
    kind: 'master',
    kindLabel: '未登録マスタ',
    title: candidate.inputName || candidate.officialName || '（名称未入力）',
    subtitle: subtitleParts.join(' / '),
    appCode: candidate.appCode,
    candidateId: candidate.candidateId,
    url: buildPortalDeepLink_(portalWebAppUrl, 'masters')
  };
}

function buildLauncherNotificationSubtitle_(item) {
  var parts = [];
  if (item.appName) parts.push(item.appName);
  if (item.requestId) parts.push(item.requestId);
  if (item.applicantName || item.applicantEmail) {
    parts.push('申請者: ' + (item.applicantName || item.applicantEmail));
  }
  return parts.join(' / ');
}

function buildPortalDeepLink_(baseUrl, tab, appCode, requestId) {
  var sep = baseUrl.indexOf('?') >= 0 ? '&' : '?';
  var url = baseUrl + sep + 'tab=' + encodeURIComponent(tab);
  if (appCode) url += '&app=' + encodeURIComponent(appCode);
  if (requestId) url += '&requestId=' + encodeURIComponent(requestId);
  return url;
}

function getLauncherEmployeeForEmail(email) {
  email = String(email || getCurrentUserEmail_() || '').trim().toLowerCase();
  if (!email) {
    return {
      success: false,
      userEmail: '',
      employee: null,
      employeeCount: 0,
      message: 'ログインユーザーのEmailを取得できません。'
    };
  }

  var employees = loadEmployeesFromSheet();
  var emp = findEmployeeByEmail(email);
  if (!emp) {
    return {
      success: false,
      userEmail: email,
      employee: null,
      employeeCount: employees.length,
      message: '社員マスタに「' + email + '」が見つかりません。'
    };
  }

  return {
    success: true,
    userEmail: email,
    employeeCount: employees.length,
    employee: {
      name: emp.name,
      email: emp.email,
      office: emp.office || '',
      department: emp.department || '',
      departments: getEmployeeDepartments_(emp)
    }
  };
}
