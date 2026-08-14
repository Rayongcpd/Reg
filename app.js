/**
 * ==============================================================================
 * ศูนย์บริการงานนายทะเบียนและส่งเสริมสหกรณ์ (Cooperative Registrar & Promotion Portal)
 * Frontend Application Logic (app.js)
 * - Module 1: ระบบติดตามการชำระบัญชีสหกรณ์ (Liquidation)
 * - Module 2: ระบบติดตามการพิจารณาระเบียบและข้อบังคับสหกรณ์ (Regulations & Bylaws)
 * ==============================================================================
 */

// ------------------------------------------------------------------------------
// 1. Application State
// ------------------------------------------------------------------------------
const AppState = {
  currentView: 'portal', // 'portal' | 'liquidation' | 'regulations'

  // Module 1: Liquidation State
  cases: [],
  filteredCases: [],
  selectedCase: null,
  activeDetailTab: 'timeline',
  viewMode: 'grid', // 'grid' | 'table'
  casePage: 1,
  searchTerm: '',
  filterType: 'ALL',
  filterStatus: 'ALL',
  filterStep: 'ALL',

  // Module 2: Regulations & Bylaws State
  regulations: [],
  filteredRegulations: [],
  selectedReg: null,
  activeRegDetailTab: 'regTimeline',
  regViewMode: 'grid', // 'grid' | 'table'
  regPage: 1,
  regSearchTerm: '',
  regFilterCoopType: 'ALL',
  regFilterDocType: 'ALL',
  regFilterStatus: 'ALL',
  regFilterStep: 'ALL',

  // System State
  currentUser: null, // { email, name, role, token }
  isLoading: false
};


// ------------------------------------------------------------------------------
// 2. API Transport
// ------------------------------------------------------------------------------
const ApiClient = {
  async get(action, params = {}) {
    if (!CONFIG.APPS_SCRIPT_URL) {
      throw new Error('ยังไม่ได้กำหนดค่า APPS_SCRIPT_URL ใน config.js');
    }
    const url = new URL(CONFIG.APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null) url.searchParams.set(k, params[k]);
    });
    const response = await fetch(url.toString(), { method: 'GET', headers: { 'Accept': 'application/json' } });
    const json = await response.json();
    if (!json.success) throw new Error(json.error || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
    return json.data;
  },

  async post(action, data = {}) {
    if (!CONFIG.APPS_SCRIPT_URL) {
      throw new Error('ยังไม่ได้กำหนดค่า APPS_SCRIPT_URL ใน config.js');
    }
    const payload = {
      action: action,
      sessionToken: AppState.currentUser ? (AppState.currentUser.token || AppState.currentUser.sessionToken) : null,
      ...data
    };
    const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'text/plain;charset=utf-8' },
      body: JSON.stringify(payload)
    });
    const json = await response.json();
    if (!json.success) throw new Error(json.error || 'การบันทึกข้อมูลไม่สำเร็จ');
    return json.data;
  }
};

// ------------------------------------------------------------------------------
// 5. View Switcher & Global Hub
// ------------------------------------------------------------------------------
function switchAppView(viewName) {
  AppState.currentView = viewName;

  // Update Navbar Buttons
  document.getElementById('btnNavHub')?.classList.toggle('active', viewName === 'portal');
  document.getElementById('btnNavLiquidation')?.classList.toggle('active', viewName === 'liquidation');
  document.getElementById('btnNavRegulations')?.classList.toggle('active', viewName === 'regulations');

  // Toggle View Containers
  const portalEl = document.getElementById('viewPortalHub');
  const liqEl = document.getElementById('viewLiquidation');
  const regEl = document.getElementById('viewRegulations');

  if (portalEl) portalEl.style.display = viewName === 'portal' ? 'block' : 'none';
  if (liqEl) liqEl.style.display = viewName === 'liquidation' ? 'block' : 'none';
  if (regEl) regEl.style.display = viewName === 'regulations' ? 'block' : 'none';

  // Update Admin Buttons context
  updateAuthUI();

  // Scroll to top
  window.scrollTo({ top: 0, behavior: 'smooth' });

  // Refresh counts
  updateHubStatsDisplay();
  if (viewName === 'liquidation') {
    applyFilters();
    updateStatsDisplay();
  } else if (viewName === 'regulations') {
    applyRegFilters();
    updateRegStatsDisplay();
  }
}

function updateHubStatsDisplay() {
  // Liquidation Stats on Hub
  const liqTotal = AppState.cases.length;
  const liqActive = AppState.cases.filter(c => c.caseStatus !== 'เสร็จสิ้น' && c.currentStep < 10).length;
  const liqDone = AppState.cases.filter(c => c.caseStatus === 'เสร็จสิ้น' || c.currentStep >= 10).length;
  const liqIssues = AppState.cases.filter(c => c.hasIssues).length;

  document.getElementById('hubStatLiqTotal').innerText = liqTotal;
  document.getElementById('hubStatLiqActive').innerText = liqActive;
  document.getElementById('hubStatLiqDone').innerText = liqDone;
  document.getElementById('hubStatLiqIssues').innerText = liqIssues;

  // Regulations Stats on Hub
  const regTotal = AppState.regulations.length;
  const regReview = AppState.regulations.filter(r => r.status === 'อยู่ระหว่างพิจารณา').length;
  const regDone = AppState.regulations.filter(r => r.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || r.status === 'รับจดทะเบียน/เห็นชอบแล้ว' || r.currentStep >= 5).length;
  const regIssues = AppState.regulations.filter(r => r.status === 'ส่งคืนแก้ไข').length;

  document.getElementById('hubStatRegTotal').innerText = regTotal;
  document.getElementById('hubStatRegReview').innerText = regReview;
  document.getElementById('hubStatRegDone').innerText = regDone;
  document.getElementById('hubStatRegIssues').innerText = regIssues;
}

function handleHubGlobalSearch() {
  const query = document.getElementById('hubGlobalSearchInput')?.value.trim();
  if (!query) {
    showToast('กรุณากรอกคำค้นหา', 'warning');
    return;
  }

  const q = query.toLowerCase();
  const liqMatches = AppState.cases.filter(c =>
    (c.coopName && c.coopName.toLowerCase().includes(q)) ||
    (c.regNumber && c.regNumber.toLowerCase().includes(q))
  );

  const regMatches = AppState.regulations.filter(r =>
    (r.coopName && r.coopName.toLowerCase().includes(q)) ||
    (r.title && r.title.toLowerCase().includes(q))
  );

  if (regMatches.length > 0 && liqMatches.length === 0) {
    AppState.regSearchTerm = query;
    const input = document.getElementById('regSearchInput');
    if (input) input.value = query;
    switchAppView('regulations');
  } else {
    AppState.searchTerm = query;
    const input = document.getElementById('heroSearchInput');
    if (input) input.value = query;
    switchAppView('liquidation');
  }
}

// ------------------------------------------------------------------------------
// 4. App Initialization
// ------------------------------------------------------------------------------
async function initializeApp() {
  loadSavedSession();
  setupEventListeners();
  setupGoogleAuth();

  setLoading(true);
  try {
    await Promise.all([loadCasesData(), loadRegulationsData()]);
  } catch (err) {
    console.error('Initial data load error:', err);
  } finally {
    setLoading(false);
  }

  updateHubStatsDisplay();
}

async function loadCasesData() {
  try {
    const cases = await ApiClient.get('listCases');
    AppState.cases = Array.isArray(cases) ? cases : [];
    applyFilters();
    updateStatsDisplay();
  } catch (err) {
    console.warn('Load cases error:', err);
    showToast('ไม่สามารถโหลดข้อมูลชำระบัญชีได้: ' + (err.message || err), 'error');
  }
}

async function loadRegulationsData() {
  try {
    const regs = await ApiClient.get('listRegulations');
    AppState.regulations = Array.isArray(regs) ? regs : [];
    applyRegFilters();
    updateRegStatsDisplay();
  } catch (err) {
    console.warn('Load regulations error:', err);
    showToast('ไม่สามารถโหลดข้อมูลระเบียบ/ข้อบังคับได้: ' + (err.message || err), 'error');
  }
}

// ------------------------------------------------------------------------------
// 7. Module 1: Liquidation Operations & Rendering
// ------------------------------------------------------------------------------
function applyFilters() {
  let list = [...AppState.cases];

  if (AppState.searchTerm.trim() !== '') {
    const q = AppState.searchTerm.toLowerCase().trim();
    list = list.filter(c =>
      (c.coopName && c.coopName.toLowerCase().includes(q)) ||
      (c.regNumber && c.regNumber.toLowerCase().includes(q)) ||
      (c.orderNumber && c.orderNumber.toLowerCase().includes(q)) ||
      (c.liquidators && c.liquidators.toLowerCase().includes(q)) ||
      (c.location && c.location.toLowerCase().includes(q))
    );
  }

  // Filter by Step / Progress
  if (AppState.filterStep && AppState.filterStep !== 'ALL') {
    if (AppState.filterStep === '1-3') {
      list = list.filter(c => c.currentStep >= 1 && c.currentStep <= 3);
    } else if (AppState.filterStep === '4-6') {
      list = list.filter(c => c.currentStep >= 4 && c.currentStep <= 6);
    } else if (AppState.filterStep === '7-9') {
      list = list.filter(c => c.currentStep >= 7 && c.currentStep <= 9);
    } else if (AppState.filterStep === '10') {
      list = list.filter(c => c.currentStep >= 10 || c.caseStatus === 'เสร็จสิ้น');
    } else {
      const stepNum = parseInt(AppState.filterStep, 10);
      if (!isNaN(stepNum)) {
        list = list.filter(c => c.currentStep === stepNum);
      }
    }
  }

  // Filter by Type
  if (AppState.filterType !== 'ALL') {
    if (AppState.filterType === 'กลุ่มเกษตรกร') {
      list = list.filter(c => c.coopType && c.coopType.includes('กลุ่มเกษตรกร'));
    } else {
      list = list.filter(c => c.coopType === AppState.filterType || (c.coopType && c.coopType.includes(AppState.filterType)));
    }
  }

  // Filter by Status
  if (AppState.filterStatus === 'ACTIVE') {
    list = list.filter(c => c.caseStatus !== 'เสร็จสิ้น' && c.currentStep < 10);
  } else if (AppState.filterStatus === 'COMPLETED') {
    list = list.filter(c => c.caseStatus === 'เสร็จสิ้น' || c.currentStep >= 10);
  } else if (AppState.filterStatus === 'ISSUES') {
    list = list.filter(c => c.hasIssues);
  }

  AppState.filteredCases = list;
  AppState.casePage = 1;
  renderCasesList();
  updateHubStatsDisplay();
  updateCaseFilterChipUI();
}

function setCaseFilter(filterKey, value) {
  if (filterKey === 'step') AppState.filterStep = value;
  if (filterKey === 'status') AppState.filterStatus = value;
  if (filterKey === 'type') AppState.filterType = value;
  applyFilters();
}

function resetCaseFilters() {
  AppState.filterStep = 'ALL';
  AppState.filterStatus = 'ALL';
  AppState.filterType = 'ALL';
  AppState.searchTerm = '';
  const searchInput = document.getElementById('heroSearchInput');
  if (searchInput) searchInput.value = '';
  applyFilters();
}

function updateCaseFilterChipUI() {
  document.querySelectorAll('[data-case-step]').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.caseStep === AppState.filterStep);
  });
  document.querySelectorAll('[data-case-status]').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.caseStatus === AppState.filterStatus);
  });
  document.querySelectorAll('[data-case-type]').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.caseType === AppState.filterType);
  });

  let activeCount = 0;
  if (AppState.filterStep !== 'ALL') activeCount++;
  if (AppState.filterStatus !== 'ALL') activeCount++;
  if (AppState.filterType !== 'ALL') activeCount++;
  if (AppState.searchTerm.trim() !== '') activeCount++;

  const countEl = document.getElementById('caseFilterCount');
  if (countEl) {
    countEl.innerText = activeCount > 0 ? `เลือกแล้ว ${activeCount} ตัวกรอง` : 'ทั้งหมด';
  }

  const resetBtn = document.getElementById('btnResetCaseFilter');
  if (resetBtn) {
    resetBtn.style.display = activeCount > 0 ? 'inline-flex' : 'none';
  }

  const resultCountEl = document.getElementById('caseFilterResultCount');
  if (resultCountEl) {
    resultCountEl.innerText = `พบ ${AppState.filteredCases.length} จาก ${AppState.cases.length} สหกรณ์`;
  }
}

function toggleFilterPanel(panelId) {
  const body = document.getElementById(panelId + 'Body');
  const btn = document.getElementById('btnToggle' + panelId.charAt(0).toUpperCase() + panelId.slice(1));
  if (!body || !btn) return;

  const isCollapsed = body.classList.toggle('collapsed');
  const icon = btn.querySelector('.toggle-icon');
  const text = btn.querySelector('.toggle-text');
  if (icon) icon.innerText = isCollapsed ? '▼' : '▲';
  if (text) text.innerText = isCollapsed ? 'แสดงตัวกรอง' : 'ซ่อนตัวกรอง';
}

function updateStatsDisplay() {
  const total = AppState.cases.length;
  const active = AppState.cases.filter(c => c.caseStatus !== 'เสร็จสิ้น' && c.currentStep < 10).length;
  const completed = AppState.cases.filter(c => c.caseStatus === 'เสร็จสิ้น' || c.currentStep >= 10).length;
  const issues = AppState.cases.filter(c => c.hasIssues).length;

  document.getElementById('statTotal').innerText = total;
  document.getElementById('statActive').innerText = active;
  document.getElementById('statCompleted').innerText = completed;
  document.getElementById('statIssues').innerText = issues;
}

function renderCasesList() {
  const gridContainer = document.getElementById('casesGrid');
  const tableContainer = document.getElementById('casesTableWrap');
  const emptyState = document.getElementById('emptyState');
  const paginationContainer = document.getElementById('casesPagination');

  if (!gridContainer || !tableContainer || !emptyState) return;

  if (AppState.filteredCases.length === 0) {
    gridContainer.style.display = 'none';
    tableContainer.style.display = 'none';
    if (paginationContainer) paginationContainer.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  // ponytail: 6 items per page for card grid, 10 items per page for table
  const pageSize = AppState.viewMode === 'grid' ? 6 : 10;
  const total = AppState.filteredCases.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (AppState.casePage > totalPages) AppState.casePage = totalPages;
  if (AppState.casePage < 1) AppState.casePage = 1;

  const startIndex = (AppState.casePage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  const pageItems = AppState.filteredCases.slice(startIndex, endIndex);

  if (AppState.viewMode === 'grid') {
    gridContainer.style.display = 'grid';
    tableContainer.style.display = 'none';
    renderGrid(gridContainer, pageItems);
  } else {
    gridContainer.style.display = 'none';
    tableContainer.style.display = 'block';
    renderTable(tableContainer, pageItems, startIndex);
  }

  renderPaginationUI('casesPagination', AppState.casePage, totalPages, total, startIndex, endIndex, 'changeCasePage');
}

function renderCardIssuesHtml(item) {
  if (!item.hasIssues || !item.issues || item.issues.length === 0) return '';

  let activeIssues = item.issues;
  if (item.steps) {
    activeIssues = item.issues.filter(iss => {
      const stepObj = item.steps.find(s => parseInt(s.stepNumber, 10) === parseInt(iss.stepNumber, 10));
      return !stepObj || stepObj.status !== 'เสร็จสิ้น';
    });
  }

  if (activeIssues.length === 0) return '';

  const sortedIssues = [...activeIssues].sort((a, b) => {
    const aIsCurrent = parseInt(a.stepNumber, 10) === parseInt(item.currentStep, 10);
    const bIsCurrent = parseInt(b.stepNumber, 10) === parseInt(item.currentStep, 10);
    if (aIsCurrent && !bIsCurrent) return -1;
    if (!aIsCurrent && bIsCurrent) return 1;
    return parseInt(b.stepNumber, 10) - parseInt(a.stepNumber, 10);
  });

  return `
    <div class="case-issue-alert" style="flex-direction: column; align-items: flex-start; gap: 5px;">
      <div style="font-weight: 600; display: flex; align-items: center; gap: 4px; color: #991b1b; font-size: 0.85rem;">
        <span>⚠️ ปัญหาอุปสรรคปัจจุบัน (${sortedIssues.length} ขั้นตอน):</span>
      </div>
      <div style="font-size: 0.82rem; line-height: 1.4; width: 100%; display: flex; flex-direction: column; gap: 4px;">
        ${sortedIssues.map(iss => {
    const isCur = parseInt(iss.stepNumber, 10) === parseInt(item.currentStep, 10);
    return `
            <div style="background: rgba(255,255,255,0.7); padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(220, 38, 38, 0.2);">
              <strong style="color: #b91c1c;">ขั้นที่ ${iss.stepNumber}${isCur ? ' (กำลังดำเนินการ)' : ''}:</strong>
              <span style="color: #450a0a;">${escapeHtml(iss.issue)}</span>
            </div>
          `;
  }).join('')}
      </div>
    </div>
  `;
}

function renderGrid(container, items = AppState.filteredCases) {
  container.innerHTML = items.map(item => {
    const isDone = item.caseStatus === 'เสร็จสิ้น' || item.currentStep >= 10;
    const progressPercent = Math.min(100, Math.round((item.currentStep / 10) * 100));
    const stepObj = CONFIG.LIQUIDATION_STEPS.find(s => s.number === item.currentStep) || { title: `ขั้นตอนที่ ${item.currentStep}` };
    const dissolutionType = item.dissolutionType || (item.orderNumber && item.orderNumber.includes('ประกาศ') ? 'ประกาศเลิก' : 'คำสั่งเลิก');
    const isFarmerGroup = item.coopType && item.coopType.includes('กลุ่มเกษตรกร');

    return `
      <div class="case-card">
        <div class="case-card-header">
          <div class="case-badge-group">
            <span class="case-type-badge ${isFarmerGroup ? 'farmer-group' : 'coop-type-badge'}">${escapeHtml(item.coopType)}</span>
          </div>
          <span class="status-badge ${isDone ? 'completed' : 'active'}">
            ${isDone ? '✓ เสร็จสิ้นแล้ว' : '● กำลังชำระบัญชี'}
          </span>
        </div>

        <h3 class="case-title">${escapeHtml(item.coopName)}</h3>

        <div class="case-meta">
          <div class="case-meta-item">
            <span>🏛️ เลขทะเบียน: ${escapeHtml(item.regNumber)}</span>
          </div>
          <div class="case-meta-item">
            <span>📍 ${escapeHtml(item.location)}</span>
          </div>
          <div class="case-meta-item">
            <span>📜 ${escapeHtml(dissolutionType)}: <strong>${escapeHtml(item.orderNumber)}</strong></span>
          </div>
        </div>

        <div class="case-progress-wrap">
          <div class="progress-header">
            <span class="step-name">ขั้นที่ ${item.currentStep}/10: ${escapeHtml(stepObj.title)}</span>
            <span>${progressPercent}%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
          </div>
        </div>

        <div class="case-liquidator">
          <span>👤 ผู้ชำระบัญชี: <strong>${escapeHtml(item.liquidators || 'ยังไม่ระบุ')}</strong></span>
        </div>

        <!-- Problem / Obstacle Alert -->
        ${renderCardIssuesHtml(item)}

        <div class="case-card-footer">
          <span style="font-size: 0.78rem; color: var(--text-muted);">
            อัพเดต: ${formatThaiDate(item.lastUpdated)}
          </span>
          <button class="btn btn-primary btn-sm" onclick="openCaseDetail('${item.caseId}')">
            ดูรายละเอียด ➔
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderTable(container, items = AppState.filteredCases, startIndex = 0) {
  const tbody = document.getElementById('casesTableBody');
  if (!tbody) return;
  tbody.innerHTML = items.map((item, idx) => {
    const isDone = item.caseStatus === 'เสร็จสิ้น' || item.currentStep >= 10;
    const progressPercent = Math.min(100, Math.round((item.currentStep / 10) * 100));
    const dissolutionType = item.dissolutionType || (item.orderNumber && item.orderNumber.includes('ประกาศ') ? 'ประกาศเลิก' : 'คำสั่งเลิก');
    const isFarmerGroup = item.coopType && item.coopType.includes('กลุ่มเกษตรกร');

    let issuesTooltip = '';
    if (item.hasIssues && item.issues) {
      issuesTooltip = item.issues.map(i => `ขั้นที่ ${i.stepNumber}: ${i.issue}`).join(' | ');
    }

    return `
      <tr>
        <td style="text-align: center; color: var(--text-muted);">${startIndex + idx + 1}</td>
        <td>
          <strong style="color: var(--primary);">${escapeHtml(item.coopName)}</strong>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(item.regNumber)} | ${escapeHtml(item.location)}</div>
        </td>
        <td><span class="case-type-badge ${isFarmerGroup ? 'farmer-group' : 'coop-type-badge'}">${escapeHtml(item.coopType)}</span></td>
        <td>
          <div><strong>${escapeHtml(item.orderNumber)}</strong></div>
          <span style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(dissolutionType)} (${formatThaiDate(item.orderDate)})</span>
        </td>
        <td>
          <div style="font-weight: 500; font-size: 0.85rem;">ขั้นที่ ${item.currentStep}/10 (${progressPercent}%)</div>
          <div class="progress-bar-bg" style="height: 6px; width: 100px; margin-top: 4px;">
            <div class="progress-bar-fill" style="width: ${progressPercent}%;"></div>
          </div>
        </td>
        <td>${escapeHtml(item.liquidators || '-')}</td>
        <td>
          <span class="status-badge ${isDone ? 'completed' : 'active'}">
            ${isDone ? 'เสร็จสิ้น' : 'กำลังชำระบัญชี'}
          </span>
          ${item.hasIssues ? `<span class="status-badge issue" style="margin-left: 4px;" title="${escapeHtml(issuesTooltip)}">⚠️ มีปัญหา (${item.issuesCount})</span>` : ''}
        </td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm" onclick="openCaseDetail('${item.caseId}')">
            รายละเอียด
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function openCaseDetail(caseId) {
  setLoading(true);
  try {
    const caseData = await ApiClient.get('getCaseDetail', { caseId: caseId });
    AppState.selectedCase = caseData;

    document.getElementById('detailCoopName').innerText = caseData.coopName;
    document.getElementById('detailRegNumber').innerText = caseData.regNumber || '-';
    document.getElementById('detailCoopType').innerText = caseData.coopType || '-';
    document.getElementById('detailLocation').innerText = caseData.location || '-';

    const dissolutionType = caseData.dissolutionType || (caseData.orderNumber && caseData.orderNumber.includes('ประกาศ') ? 'ประกาศเลิก' : 'คำสั่งเลิก');
    const dissolutionLabelEl = document.getElementById('detailDissolutionLabel');
    if (dissolutionLabelEl) dissolutionLabelEl.innerText = `${dissolutionType}เลขที่`;

    document.getElementById('detailOrderNumber').innerText = caseData.orderNumber || '-';
    document.getElementById('detailOrderDate').innerText = formatThaiDate(caseData.orderDate);

    const isDone = caseData.caseStatus === 'เสร็จสิ้น' || caseData.currentStep >= 10;
    const statusBadge = document.getElementById('detailStatusBadge');
    statusBadge.className = `status-badge ${isDone ? 'completed' : 'active'}`;
    statusBadge.innerText = isDone ? '✓ เสร็จสิ้นกระบวนการ' : `● กำลังชำระบัญชี (ขั้นที่ ${caseData.currentStep}/10)`;

    const adminActions = document.getElementById('detailAdminActions');
    const adminAddLiqBtn = document.getElementById('adminAddLiqBtn');
    if (adminActions) adminActions.style.display = AppState.currentUser ? 'flex' : 'none';
    if (adminAddLiqBtn) adminAddLiqBtn.style.display = AppState.currentUser ? 'inline-flex' : 'none';

    renderDetailTimeline();
    renderDetailLiquidators();
    renderDetailDocuments();

    switchDetailTab('timeline');
    openModal('caseDetailModal');
  } catch (err) {
    showToast('ไม่สามารถเปิดรายละเอียดได้: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function renderDetailTimeline() {
  const container = document.getElementById('timelineContainer');
  const caseData = AppState.selectedCase;
  if (!caseData || !caseData.steps || !container) return;

  container.innerHTML = caseData.steps.map(step => {
    const isCompleted = step.status === 'เสร็จสิ้น';
    const isActive = step.status === 'กำลังดำเนินการ';
    const hasIssue = step.issue && step.issue.trim() !== '';

    let stateClass = 'pending';
    if (isCompleted) stateClass = 'completed';
    else if (isActive) stateClass = 'active';

    const stepDocs = (caseData.documents || []).filter(d => parseInt(d.stepNumber, 10) === parseInt(step.stepNumber, 10));

    return `
      <div class="stepper-item ${stateClass}">
        <div class="stepper-node">
          ${isCompleted ? '✓' : step.stepNumber}
        </div>
        <div class="stepper-content">
          <div class="stepper-header">
            <div>
              <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">ขั้นตอนที่ ${step.stepNumber}</span>
              <h4 class="stepper-title">${escapeHtml(step.stepName)}</h4>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="status-badge ${isCompleted ? 'completed' : isActive ? 'active' : 'pending'}">
                ${escapeHtml(step.status)}
              </span>
              ${AppState.currentUser ? `
                <button class="btn btn-secondary btn-sm" onclick="openUpdateStepModal(${step.stepNumber})" title="แก้ไขขั้นตอนนี้">
                  ✏️ แก้ไข
                </button>
              ` : ''}
            </div>
          </div>

          <div class="stepper-dates">
            <span>📅 เริ่ม: ${formatThaiDate(step.startDate)}</span>
            <span style="margin: 0 6px;">|</span>
            <span>🏁 เสร็จ: ${formatThaiDate(step.endDate)}</span>
          </div>

          ${hasIssue ? `
            <div class="stepper-obstacle" style="${isCompleted ? 'background: #f1f5f9; border-left-color: #94a3b8; color: #475569;' : ''}">
              <strong>${isCompleted ? 'ℹ️ ปัญหาที่เคยพบ (ผ่านขั้นตอนนี้แล้ว):' : '⚠️ ปัญหาอุปสรรค:'}</strong> ${escapeHtml(step.issue)}
            </div>
          ` : ''}

          ${step.note ? `
            <div class="stepper-note">
              <strong>📝 บันทึกเพิ่มเติม:</strong> ${escapeHtml(step.note)}
            </div>
          ` : ''}

          ${stepDocs.length > 0 ? `
            <div class="stepper-docs">
              ${stepDocs.map(d => `
                <a href="${escapeHtml(d.driveUrl)}" ${d.driveUrl.startsWith('data:') ? `download="${escapeHtml(d.fileName)}"` : 'target="_blank"'} class="doc-chip" title="เปิด/ดาวน์โหลดเอกสาร">
                  📄 ${escapeHtml(d.fileName)} (${escapeHtml(d.fileSize || 'ไฟล์แนบ')}) ↗
                </a>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderDetailLiquidators() {
  const container = document.getElementById('liquidatorsContainer');
  const caseData = AppState.selectedCase;
  if (!caseData || !caseData.liquidatorsDetail || !container) return;

  const list = caseData.liquidatorsDetail;

  if (list.length === 0) {
    container.innerHTML = `<p style="color: var(--text-muted); text-align: center; padding: 2rem;">ยังไม่มีการบันทึกข้อมูลผู้ชำระบัญชี</p>`;
    return;
  }

  container.innerHTML = list.map(l => {
    const isActive = l.status === 'ปัจจุบัน' || !l.endDate;

    return `
      <div class="liquidator-card ${isActive ? 'active' : 'inactive'}">
        <div style="flex: 1;">
          <div style="display: flex; align-items: center; gap: 8px; margin-bottom: 4px;">
            <strong style="font-size: 1.05rem; color: var(--text-main);">${escapeHtml(l.name)}</strong>
            <span class="status-badge ${isActive ? 'completed' : 'pending'}">
              ${isActive ? '● กำลังปฏิบัติหน้าที่' : 'พ้นหน้าที่แล้ว'}
            </span>
          </div>
          <div style="font-size: 0.88rem; color: var(--text-muted);">
            ตำแหน่ง/สังกัด: ${escapeHtml(l.position || '-')}
          </div>
          <div style="font-size: 0.85rem; color: var(--text-muted); margin-top: 4px;">
            📜 คำสั่งแต่งตั้งผู้ชำระบัญชี: <strong>${escapeHtml(l.orderNumber || 'ยังไม่ระบุ')}</strong>
            <span style="margin: 0 8px;">|</span>
            📅 ปฏิบัติหน้าที่: ${formatThaiDate(l.startDate)} ${l.endDate ? 'ถึง ' + formatThaiDate(l.endDate) : '(ปัจจุบัน)'}
          </div>
          ${l.reason ? `
            <div style="font-size: 0.82rem; color: var(--accent-amber); margin-top: 4px;">
              เหตุผลการเปลี่ยนแปลง: ${escapeHtml(l.reason)}
            </div>
          ` : ''}
          ${l.contact ? `
            <div style="font-size: 0.85rem; color: var(--primary); margin-top: 4px;">
              📞 ${escapeHtml(l.contact)}
            </div>
          ` : ''}
        </div>
        ${AppState.currentUser ? `
          <button class="btn btn-secondary btn-sm" onclick="openEditLiquidatorModal('${l.liquidatorId}')" title="แก้ไขข้อมูลผู้ชำระบัญชีนี้">
            ✏️ แก้ไข
          </button>
        ` : ''}
      </div>
    `;
  }).join('');
}

function renderDetailDocuments() {
  const container = document.getElementById('documentsContainer');
  const caseData = AppState.selectedCase;
  if (!caseData || !caseData.documents || !container) return;

  const docs = caseData.documents;

  if (docs.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem;">
        <div class="empty-icon">📁</div>
        <p>ยังไม่มีเอกสารแนบในรายการนี้</p>
        ${AppState.currentUser ? `
          <button class="btn btn-primary btn-sm" onclick="openUploadDocModal()" style="margin-top: 1rem;">
            + อัพโหลดเอกสารแรก
          </button>
        ` : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <span style="font-weight: 600; color: var(--text-main);">เอกสารทั้งหมด (${docs.length} รายการ)</span>
      ${AppState.currentUser ? `
        <button class="btn btn-primary btn-sm" onclick="openUploadDocModal()">
          + อัพโหลดเอกสารใหม่
        </button>
      ` : ''}
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${docs.map(d => `
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.5rem;">📄</span>
            <div>
              <a href="${escapeHtml(d.driveUrl)}" ${d.driveUrl.startsWith('data:') ? `download="${escapeHtml(d.fileName)}"` : 'target="_blank"'} style="font-weight: 600; color: var(--primary); font-size: 0.95rem;">
                ${escapeHtml(d.fileName)}
              </a>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                ${d.stepNumber ? `ผูกกับขั้นตอนที่ ${d.stepNumber}` : 'เอกสารทั่วไป'} • ขนาด ${escapeHtml(d.fileSize || '-')} • อัพโหลดเมื่อ ${formatThaiDate(d.uploadDate)}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <a href="${escapeHtml(d.driveUrl)}" ${d.driveUrl.startsWith('data:') ? `download="${escapeHtml(d.fileName)}"` : 'target="_blank"'} class="btn btn-secondary btn-sm">
              เปิดดู ↗
            </a>
            ${AppState.currentUser ? `
              <button class="btn btn-danger btn-sm" onclick="deleteDocument('${d.docId}')" title="ลบเอกสาร">
                🗑️
              </button>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function switchDetailTab(tab) {
  AppState.activeDetailTab = tab;
  document.querySelectorAll('#caseDetailModal .modal-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.getElementById('tabTimeline').style.display = tab === 'timeline' ? 'block' : 'none';
  document.getElementById('tabLiquidators').style.display = tab === 'liquidators' ? 'block' : 'none';
  document.getElementById('tabDocuments').style.display = tab === 'documents' ? 'block' : 'none';
}

function resetCreateCaseLiquidators() {
  const container = document.getElementById('createCaseLiquidatorsList');
  if (!container) return;
  container.innerHTML = `
    <div class="liquidator-input-row" style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span class="liquidator-row-title" style="font-weight: 600; font-size: 0.85rem; color: var(--primary);">👤 ผู้ชำระบัญชีคนที่ 1</span>
      </div>
      <div class="form-row">
        <div class="form-group" style="margin-bottom: 8px;">
          <label style="font-size: 0.82rem;">ชื่อ-นามสกุล <span style="color: red;">*</span></label>
          <input type="text" name="liqName" class="form-control" placeholder="เช่น นายสมศักดิ์ รักสหกรณ์" required>
        </div>
        <div class="form-group" style="margin-bottom: 8px;">
          <label style="font-size: 0.82rem;">ตำแหน่ง / สังกัด</label>
          <input type="text" name="liqPosition" class="form-control" placeholder="เช่น นักวิชาการสหกรณ์ชำนาญการ">
        </div>
      </div>
      <div class="form-row">
        <div class="form-group" style="margin-bottom: 8px;">
          <label style="font-size: 0.82rem;">เลขที่คำสั่งแต่งตั้งผู้ชำระบัญชี</label>
          <input type="text" name="liqOrderNumber" class="form-control" placeholder="เช่น คำสั่ง นทส. ที่ 16/2566">
        </div>
        <div class="form-group" style="margin-bottom: 8px;">
          <label style="font-size: 0.82rem;">วันที่เริ่มปฏิบัติหน้าที่</label>
          <input type="text" name="liqStartDate" class="form-control thai-date-input" placeholder="วว/ดด/ปปปป (พ.ศ.)" maxlength="10">
        </div>
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <label style="font-size: 0.82rem;">เบอร์โทรศัพท์ / ช่องทางติดต่อ</label>
        <input type="text" name="liqContact" class="form-control" placeholder="เช่น 081-234-5678">
      </div>
    </div>
  `;
}

function addLiquidatorRowToCreateForm() {
  const container = document.getElementById('createCaseLiquidatorsList');
  if (!container) return;
  const currentCount = container.querySelectorAll('.liquidator-input-row').length;
  const nextNum = currentCount + 1;

  const newRow = document.createElement('div');
  newRow.className = 'liquidator-input-row';
  newRow.style.cssText = 'background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; position: relative; animation: fadeIn 0.2s ease-in;';
  newRow.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <span class="liquidator-row-title" style="font-weight: 600; font-size: 0.85rem; color: var(--primary);">👤 ผู้ชำระบัญชีคนที่ ${nextNum}</span>
      <button type="button" class="btn btn-danger btn-sm" onclick="removeLiquidatorRow(this)" style="padding: 2px 8px; font-size: 0.75rem;">
        ✕ ลบออก
      </button>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin-bottom: 8px;">
        <label style="font-size: 0.82rem;">ชื่อ-นามสกุล <span style="color: red;">*</span></label>
        <input type="text" name="liqName" class="form-control" placeholder="เช่น นางสาววิไลลักษณ์ มั่นคง" required>
      </div>
      <div class="form-group" style="margin-bottom: 8px;">
        <label style="font-size: 0.82rem;">ตำแหน่ง / สังกัด</label>
        <input type="text" name="liqPosition" class="form-control" placeholder="เช่น นักวิชาการสหกรณ์ปฏิบัติการ">
      </div>
    </div>
    <div class="form-row">
      <div class="form-group" style="margin-bottom: 8px;">
        <label style="font-size: 0.82rem;">เลขที่คำสั่งแต่งตั้งผู้ชำระบัญชี</label>
        <input type="text" name="liqOrderNumber" class="form-control" placeholder="เช่น คำสั่ง นทส. ที่ 17/2566">
      </div>
      <div class="form-group" style="margin-bottom: 8px;">
        <label style="font-size: 0.82rem;">วันที่เริ่มปฏิบัติหน้าที่</label>
        <input type="text" name="liqStartDate" class="form-control thai-date-input" placeholder="วว/ดด/ปปปป (พ.ศ.)" maxlength="10">
      </div>
    </div>
    <div class="form-group" style="margin-bottom: 0;">
      <label style="font-size: 0.82rem;">เบอร์โทรศัพท์ / ช่องทางติดต่อ</label>
      <input type="text" name="liqContact" class="form-control" placeholder="เช่น 089-987-6543">
    </div>
  `;
  container.appendChild(newRow);
}

function removeLiquidatorRow(btn) {
  const row = btn.closest('.liquidator-input-row');
  if (row) {
    row.remove();
    const rows = document.querySelectorAll('#createCaseLiquidatorsList .liquidator-input-row');
    rows.forEach((r, idx) => {
      const title = r.querySelector('.liquidator-row-title');
      if (title) title.innerText = `👤 ผู้ชำระบัญชีคนที่ ${idx + 1}`;
    });
  }
}

function openCreateCaseModal() {
  if (!AppState.currentUser) {
    showToast('กรุณาเข้าสู่ระบบในฐานะ Admin ก่อน', 'warning');
    openModal('loginModal');
    return;
  }
  document.getElementById('createCaseForm').reset();
  resetCreateCaseLiquidators();
  document.getElementById('createOrderDate').value = todayThaiDate();
  openModal('createCaseModal');
}

async function handleCreateCaseSubmit(e) {
  e.preventDefault();
  const form = e.target;

  const liqRows = document.querySelectorAll('#createCaseLiquidatorsList .liquidator-input-row');
  const liquidators = [];
  liqRows.forEach(row => {
    const nameInput = row.querySelector('input[name="liqName"]');
    const posInput = row.querySelector('input[name="liqPosition"]');
    const orderInput = row.querySelector('input[name="liqOrderNumber"]');
    const dateInput = row.querySelector('input[name="liqStartDate"]');
    const contactInput = row.querySelector('input[name="liqContact"]');
    if (nameInput && nameInput.value.trim() !== '') {
      liquidators.push({
        name: nameInput.value.trim(),
        position: posInput ? posInput.value.trim() : '',
        orderNumber: orderInput ? orderInput.value.trim() : '',
        startDate: dateInput ? fromThaiDateInput(dateInput.value) : '',
        contact: contactInput ? contactInput.value.trim() : ''
      });
    }
  });

  const payload = {
    coopName: form.coopName.value.trim(),
    regNumber: form.regNumber.value.trim(),
    coopType: form.coopType.value,
    location: form.location.value.trim(),
    dissolutionType: form.dissolutionType ? form.dissolutionType.value : 'คำสั่งเลิก',
    orderNumber: form.orderNumber.value.trim(),
    orderDate: fromThaiDateInput(form.orderDate.value),
    initialStep: form.initialStep ? parseInt(form.initialStep.value, 10) : 1,
    liquidators: liquidators,
    note: form.note.value.trim()
  };

  if (!payload.coopName) {
    showToast('กรุณาระบุชื่อสหกรณ์ / กลุ่มเกษตรกร', 'warning');
    return;
  }

  setLoading(true);
  try {
    await ApiClient.post('createCase', payload);
    showToast(`สร้างรายการชำระบัญชี (${payload.dissolutionType}) สำเร็จ`, 'success');
    closeModal('createCaseModal');
    await loadCasesData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function openUpdateStepModal(stepNumber) {
  const caseData = AppState.selectedCase;
  if (!caseData) return;
  const step = (caseData.steps || []).find(s => parseInt(s.stepNumber, 10) === parseInt(stepNumber, 10));
  if (!step) return;

  document.getElementById('updateStepNumber').value = stepNumber;
  document.getElementById('updateStepTitle').innerText = `แก้ไขขั้นตอนที่ ${stepNumber}: ${step.stepName}`;
  document.getElementById('updateStepStatus').value = step.status || 'ยังไม่เริ่ม';
  document.getElementById('updateStepStartDate').value = toThaiDateInput(step.startDate);
  document.getElementById('updateStepEndDate').value = toThaiDateInput(step.endDate);
  document.getElementById('updateStepIssue').value = step.issue || '';
  document.getElementById('updateStepNote').value = step.note || '';

  openModal('updateStepModal');
}

async function handleUpdateStepSubmit(e) {
  e.preventDefault();
  const caseData = AppState.selectedCase;
  if (!caseData) return;

  const form = e.target;
  const payload = {
    caseId: caseData.caseId,
    stepNumber: parseInt(form.stepNumber.value, 10),
    status: form.status.value,
    startDate: fromThaiDateInput(form.startDate.value),
    endDate: fromThaiDateInput(form.endDate.value),
    issue: form.issue.value.trim(),
    note: form.note.value.trim()
  };

  setLoading(true);
  try {
    await ApiClient.post('updateStep', payload);
    showToast('อัพเดตขั้นตอนและปัญหาอุปสรรคเรียบร้อย', 'success');
    closeModal('updateStepModal');
    await openCaseDetail(caseData.caseId);
    await loadCasesData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function openAddLiquidatorModal() {
  document.getElementById('addLiquidatorForm').reset();
  document.getElementById('liqStartDate').value = todayThaiDate();
  openModal('addLiquidatorModal');
}

async function handleAddLiquidatorSubmit(e) {
  e.preventDefault();
  const caseData = AppState.selectedCase;
  if (!caseData) return;

  const form = e.target;
  const payload = {
    caseId: caseData.caseId,
    name: form.name.value.trim(),
    position: form.position.value.trim(),
    orderNumber: form.orderNumber.value.trim(),
    startDate: fromThaiDateInput(form.startDate.value),
    contact: form.contact.value.trim(),
    setPreviousToInactive: form.setPreviousToInactive.checked,
    previousReason: form.previousReason.value.trim()
  };

  if (!payload.name) {
    showToast('กรุณาระบุชื่อ-นามสกุล', 'warning');
    return;
  }

  setLoading(true);
  try {
    await ApiClient.post('addLiquidator', payload);
    showToast('บันทึกข้อมูลผู้ชำระบัญชีเรียบร้อย', 'success');
    closeModal('addLiquidatorModal');
    await openCaseDetail(caseData.caseId);
    await loadCasesData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function openEditLiquidatorModal(liquidatorId) {
  const caseData = AppState.selectedCase;
  if (!caseData || !caseData.liquidatorsDetail) return;
  const lq = caseData.liquidatorsDetail.find(l => l.liquidatorId === liquidatorId);
  if (!lq) return;

  document.getElementById('editLiqId').value = liquidatorId;
  document.getElementById('editLiqName').value = lq.name || '';
  document.getElementById('editLiqPosition').value = lq.position || '';
  document.getElementById('editLiqOrderNumber').value = lq.orderNumber || '';
  document.getElementById('editLiqStatus').value = lq.status || 'ปัจจุบัน';
  document.getElementById('editLiqStartDate').value = toThaiDateInput(lq.startDate);
  document.getElementById('editLiqEndDate').value = toThaiDateInput(lq.endDate);
  document.getElementById('editLiqReason').value = lq.reason || '';
  document.getElementById('editLiqContact').value = lq.contact || '';

  openModal('editLiquidatorModal');
}

async function handleEditLiquidatorSubmit(e) {
  e.preventDefault();
  const caseData = AppState.selectedCase;
  if (!caseData) return;

  const form = e.target;
  const payload = {
    caseId: caseData.caseId,
    liquidatorId: form.liquidatorId.value,
    name: form.name.value.trim(),
    position: form.position.value.trim(),
    orderNumber: form.orderNumber.value.trim(),
    status: form.status.value,
    startDate: fromThaiDateInput(form.startDate.value),
    endDate: fromThaiDateInput(form.endDate.value),
    reason: form.reason.value.trim(),
    contact: form.contact.value.trim()
  };

  setLoading(true);
  try {
    await ApiClient.post('updateLiquidator', payload);
    showToast('แก้ไขข้อมูลผู้ชำระบัญชีสำเร็จ', 'success');
    closeModal('editLiquidatorModal');
    await openCaseDetail(caseData.caseId);
    await loadCasesData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function openEditCaseInfoModal() {
  const caseData = AppState.selectedCase;
  if (!caseData) return;

  document.getElementById('editCaseCoopName').value = caseData.coopName || '';
  document.getElementById('editCaseRegNumber').value = caseData.regNumber || '';
  document.getElementById('editCaseCoopType').value = caseData.coopType || 'สหกรณ์การเกษตร';
  document.getElementById('editCaseLocation').value = caseData.location || '';
  document.getElementById('editCaseDissolutionType').value = caseData.dissolutionType || 'คำสั่งเลิก';
  document.getElementById('editCaseOrderNumber').value = caseData.orderNumber || '';
  document.getElementById('editCaseOrderDate').value = toThaiDateInput(caseData.orderDate);
  document.getElementById('editCaseStatus').value = caseData.caseStatus || 'กำลังชำระบัญชี';
  document.getElementById('editCaseNote').value = caseData.note || '';

  openModal('editCaseModal');
}

async function handleEditCaseSubmit(e) {
  e.preventDefault();
  const caseData = AppState.selectedCase;
  if (!caseData) return;

  const form = e.target;
  const payload = {
    caseId: caseData.caseId,
    coopName: form.coopName.value.trim(),
    regNumber: form.regNumber.value.trim(),
    coopType: form.coopType.value,
    location: form.location.value.trim(),
    dissolutionType: form.dissolutionType.value,
    orderNumber: form.orderNumber.value.trim(),
    orderDate: fromThaiDateInput(form.orderDate.value),
    caseStatus: form.caseStatus.value,
    note: form.note.value.trim()
  };

  setLoading(true);
  try {
    await ApiClient.post('updateCaseInfo', payload);
    showToast('แก้ไขข้อมูลการชำระบัญชีสำเร็จ', 'success');
    closeModal('editCaseModal');
    await openCaseDetail(caseData.caseId);
    await loadCasesData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function openUploadDocModal() {
  const form = document.getElementById('uploadDocForm');
  form.reset();
  document.getElementById('uploadFilePreview').style.display = 'none';
  openModal('uploadDocModal');
}

async function handleUploadDocSubmit(e) {
  e.preventDefault();
  const caseData = AppState.selectedCase;
  if (!caseData) return;

  const form = e.target;
  const fileInput = form.docFile;
  const file = fileInput.files[0];

  if (!file) {
    showToast('กรุณาเลือกไฟล์ที่ต้องการอัพโหลด', 'warning');
    return;
  }

  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    showToast('ขนาดไฟล์เกินกำหนด (สูงสุด 10 MB)', 'error');
    return;
  }

  setLoading(true);
  try {
    const base64Data = await fileToBase64(file);
    const payload = {
      caseId: caseData.caseId,
      stepNumber: form.stepNumber.value || null,
      docType: form.docType.value,
      fileName: file.name,
      mimeType: file.type,
      fileBase64: base64Data,
      fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB'
    };

    await ApiClient.post('uploadDocument', payload);
    showToast('อัพโหลดไฟล์สำเร็จ', 'success');
    closeModal('uploadDocModal');
    await openCaseDetail(caseData.caseId);
  } catch (err) {
    showToast('อัพโหลดไม่สำเร็จ: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function deleteDocument(docId) {
  if (!confirm('ยืนยันการลบเอกสารนี้?')) return;
  const caseData = AppState.selectedCase;

  setLoading(true);
  try {
    await ApiClient.post('deleteDocument', { docId: docId, caseId: caseData ? caseData.caseId : null });
    showToast('ลบเอกสารเรียบร้อย', 'success');
    if (caseData) await openCaseDetail(caseData.caseId);
  } catch (err) {
    showToast('ไม่สามารถลบเอกสารได้: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function deleteCurrentCase() {
  const caseData = AppState.selectedCase;
  if (!caseData) return;
  if (!confirm(`ยืนยันการลบรายการชำระบัญชี "${caseData.coopName}"?`)) return;

  setLoading(true);
  try {
    await ApiClient.post('deleteCase', { caseId: caseData.caseId });
    showToast('ลบรายการชำระบัญชีเรียบร้อย', 'success');
    closeModal('caseDetailModal');
    await loadCasesData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

// ------------------------------------------------------------------------------
// 8. Module 2: Regulations & Bylaws Operations & Rendering
// ------------------------------------------------------------------------------
function applyRegFilters() {
  let list = [...AppState.regulations];

  if (AppState.regSearchTerm.trim() !== '') {
    const q = AppState.regSearchTerm.toLowerCase().trim();
    list = list.filter(r =>
      (r.coopName && r.coopName.toLowerCase().includes(q)) ||
      (r.title && r.title.toLowerCase().includes(q)) ||
      (r.docNumber && r.docNumber.toLowerCase().includes(q)) ||
      (r.officerName && r.officerName.toLowerCase().includes(q)) ||
      (r.regNumber && r.regNumber.toLowerCase().includes(q))
    );
  }

  // Filter by Step / Progress
  if (AppState.regFilterStep && AppState.regFilterStep !== 'ALL') {
    const stepNum = parseInt(AppState.regFilterStep, 10);
    if (!isNaN(stepNum)) {
      list = list.filter(r => r.currentStep === stepNum);
    }
  }

  if (AppState.regFilterCoopType && AppState.regFilterCoopType !== 'ALL') {
    if (AppState.regFilterCoopType === 'กลุ่มเกษตรกร') {
      list = list.filter(r => r.coopType && r.coopType.includes('กลุ่มเกษตรกร'));
    } else {
      list = list.filter(r => r.coopType === AppState.regFilterCoopType || (r.coopType && r.coopType.includes(AppState.regFilterCoopType)));
    }
  }

  if (AppState.regFilterDocType !== 'ALL') {
    list = list.filter(r => r.docType === AppState.regFilterDocType);
  }

  if (AppState.regFilterStatus === 'IN_REVIEW') {
    list = list.filter(r => r.status === 'อยู่ระหว่างพิจารณา');
  } else if (AppState.regFilterStatus === 'APPROVED') {
    list = list.filter(r => r.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || r.status === 'รับจดทะเบียน/เห็นชอบแล้ว' || r.currentStep >= 5);
  } else if (AppState.regFilterStatus === 'NEED_FIX') {
    list = list.filter(r => r.status === 'ส่งคืนแก้ไข');
  }

  AppState.filteredRegulations = list;
  AppState.regPage = 1;
  renderRegulationsList();
  updateHubStatsDisplay();
  updateRegFilterChipUI();
}

function setRegFilter(filterKey, value) {
  if (filterKey === 'step') AppState.regFilterStep = value;
  if (filterKey === 'docType') AppState.regFilterDocType = value;
  if (filterKey === 'status') AppState.regFilterStatus = value;
  if (filterKey === 'type') AppState.regFilterCoopType = value;
  applyRegFilters();
}

function resetRegFilters() {
  AppState.regFilterStep = 'ALL';
  AppState.regFilterDocType = 'ALL';
  AppState.regFilterStatus = 'ALL';
  AppState.regFilterCoopType = 'ALL';
  AppState.regSearchTerm = '';
  const searchInput = document.getElementById('regSearchInput');
  if (searchInput) searchInput.value = '';
  applyRegFilters();
}

function updateRegFilterChipUI() {
  document.querySelectorAll('[data-reg-step]').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.regStep === AppState.regFilterStep);
  });
  document.querySelectorAll('[data-reg-doc]').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.regDoc === AppState.regFilterDocType);
  });
  document.querySelectorAll('[data-reg-status]').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.regStatus === AppState.regFilterStatus);
  });
  document.querySelectorAll('[data-reg-type]').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.regType === AppState.regFilterCoopType);
  });

  let activeCount = 0;
  if (AppState.regFilterStep !== 'ALL') activeCount++;
  if (AppState.regFilterDocType !== 'ALL') activeCount++;
  if (AppState.regFilterStatus !== 'ALL') activeCount++;
  if (AppState.regFilterCoopType !== 'ALL') activeCount++;
  if (AppState.regSearchTerm.trim() !== '') activeCount++;

  const countEl = document.getElementById('regFilterCount');
  if (countEl) {
    countEl.innerText = activeCount > 0 ? `เลือกแล้ว ${activeCount} ตัวกรอง` : 'ทั้งหมด';
  }

  const resetBtn = document.getElementById('btnResetRegFilter');
  if (resetBtn) {
    resetBtn.style.display = activeCount > 0 ? 'inline-flex' : 'none';
  }

  const resultCountEl = document.getElementById('regFilterResultCount');
  if (resultCountEl) {
    resultCountEl.innerText = `พบ ${AppState.filteredRegulations.length} จาก ${AppState.regulations.length} รายการ`;
  }
}

function updateRegStatsDisplay() {
  const total = AppState.regulations.length;
  const inReview = AppState.regulations.filter(r => r.status === 'อยู่ระหว่างพิจารณา').length;
  const approved = AppState.regulations.filter(r => r.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || r.status === 'รับจดทะเบียน/เห็นชอบแล้ว' || r.currentStep >= 5).length;
  const needFix = AppState.regulations.filter(r => r.status === 'ส่งคืนแก้ไข').length;

  document.getElementById('regStatTotal').innerText = total;
  document.getElementById('regStatReview').innerText = inReview;
  document.getElementById('regStatApproved').innerText = approved;
  document.getElementById('regStatFixes').innerText = needFix;
}

function renderRegulationsList() {
  const gridContainer = document.getElementById('regGrid');
  const tableContainer = document.getElementById('regTableWrap');
  const emptyState = document.getElementById('regEmptyState');
  const paginationContainer = document.getElementById('regPagination');

  if (!gridContainer || !tableContainer || !emptyState) return;

  if (AppState.filteredRegulations.length === 0) {
    gridContainer.style.display = 'none';
    tableContainer.style.display = 'none';
    if (paginationContainer) paginationContainer.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  // ponytail: 6 items per page for card grid, 10 items per page for table
  const pageSize = AppState.regViewMode === 'grid' ? 6 : 10;
  const total = AppState.filteredRegulations.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));

  if (AppState.regPage > totalPages) AppState.regPage = totalPages;
  if (AppState.regPage < 1) AppState.regPage = 1;

  const startIndex = (AppState.regPage - 1) * pageSize;
  const endIndex = Math.min(startIndex + pageSize, total);
  const pageItems = AppState.filteredRegulations.slice(startIndex, endIndex);

  if (AppState.regViewMode === 'grid') {
    gridContainer.style.display = 'grid';
    tableContainer.style.display = 'none';
    renderRegGrid(gridContainer, pageItems);
  } else {
    gridContainer.style.display = 'none';
    tableContainer.style.display = 'block';
    renderRegTable(tableContainer, pageItems, startIndex);
  }

  renderPaginationUI('regPagination', AppState.regPage, totalPages, total, startIndex, endIndex, 'changeRegPage');
}

function renderRegCardIssuesHtml(item) {
  if (!item.hasIssues || !item.issues || item.issues.length === 0) return '';

  return `
    <div class="case-issue-alert" style="flex-direction: column; align-items: flex-start; gap: 5px;">
      <div style="font-weight: 600; display: flex; align-items: center; gap: 4px; color: #991b1b; font-size: 0.85rem;">
        <span>⚠️ ข้อสังเกต / จุดที่ต้องแก้ไข:</span>
      </div>
      <div style="font-size: 0.82rem; line-height: 1.4; width: 100%; display: flex; flex-direction: column; gap: 4px;">
        ${item.issues.map(iss => `
          <div style="background: rgba(255,255,255,0.7); padding: 4px 8px; border-radius: 4px; border: 1px solid rgba(220, 38, 38, 0.2);">
            <strong style="color: #b91c1c;">ขั้นที่ ${iss.stepNumber}:</strong>
            <span style="color: #450a0a;">${escapeHtml(iss.issue)}</span>
          </div>
        `).join('')}
      </div>
    </div>
  `;
}

function renderRegGrid(container, items = AppState.filteredRegulations) {
  container.innerHTML = items.map(item => {
    const isApproved = item.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || item.status === 'รับจดทะเบียน/เห็นชอบแล้ว' || item.currentStep >= 5;
    const isNeedFix = item.status === 'ส่งคืนแก้ไข';
    const progressPercent = Math.min(100, Math.round((item.currentStep / 5) * 100));
    const stepObj = CONFIG.REGULATION_STEPS.find(s => s.number === item.currentStep) || { title: `ขั้นตอนที่ ${item.currentStep}` };
    const isFarmerGroup = item.coopType && item.coopType.includes('กลุ่มเกษตรกร');

    let statusBadgeClass = 'active';
    let statusText = '● อยู่ระหว่างพิจารณา';
    if (isApproved) {
      statusBadgeClass = 'completed';
      statusText = '✓ รับจดทะเบียนแล้ว';
    } else if (isNeedFix) {
      statusBadgeClass = 'issue';
      statusText = '⚠️ ส่งคืนแก้ไข';
    }

    const typeBadgeClass = item.docType === 'ข้อบังคับสหกรณ์' ? 'reg-type-bylaw' : 'reg-type-rule';

    return `
      <div class="case-card">
        <div class="case-card-header">
          <div class="case-badge-group">
            <span class="case-type-badge ${typeBadgeClass}">${escapeHtml(item.docType)}</span>
            <span class="case-type-badge ${isFarmerGroup ? 'farmer-group' : 'coop-type-badge'}">${escapeHtml(item.coopType || 'สหกรณ์')}</span>
          </div>
          <span class="status-badge ${statusBadgeClass}">${statusText}</span>
        </div>

        <h3 class="case-title" style="font-size: 1.05rem; line-height: 1.4;">${escapeHtml(item.title)}</h3>
        <div style="font-size: 0.88rem; font-weight: 600; color: var(--primary); margin-bottom: 8px;">
          🏛️ ${escapeHtml(item.coopName)}
        </div>

        <div class="case-meta">
          <div class="case-meta-item">
            <span>📄 เลขที่รับเรื่อง: ${escapeHtml(item.docNumber || '-')}</span>
          </div>
          <div class="case-meta-item">
            <span>📅 ยื่นเมื่อ: ${formatThaiDate(item.submitDate)}</span>
          </div>
        </div>

        <div class="case-progress-wrap">
          <div class="progress-header">
            <span class="step-name">ขั้นที่ ${item.currentStep}/5: ${escapeHtml(stepObj.title)}</span>
            <span>${progressPercent}%</span>
          </div>
          <div class="progress-bar-bg">
            <div class="progress-bar-fill" style="width: ${progressPercent}%; background: linear-gradient(90deg, #0d9488, #0284c7);"></div>
          </div>
        </div>

        <div class="case-liquidator">
          <span>👤 จนท. ผู้รับผิดชอบ: <strong>${escapeHtml(item.officerName || 'ยังไม่ระบุ')}</strong> ${item.officerContact ? '(' + escapeHtml(item.officerContact) + ')' : ''}</span>
        </div>

        <!-- Issue Alert -->
        ${renderRegCardIssuesHtml(item)}

        <div class="case-card-footer">
          <span style="font-size: 0.78rem; color: var(--text-muted);">
            อัพเดต: ${formatThaiDate(item.lastUpdated)}
          </span>
          <button class="btn btn-primary btn-sm" onclick="openRegDetail('${item.regId}')">
            ดูรายละเอียด ➔
          </button>
        </div>
      </div>
    `;
  }).join('');
}

function renderRegTable(container, items = AppState.filteredRegulations, startIndex = 0) {
  const tbody = document.getElementById('regTableBody');
  if (!tbody) return;

  tbody.innerHTML = items.map((item, idx) => {
    const isApproved = item.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || item.status === 'รับจดทะเบียน/เห็นชอบแล้ว' || item.currentStep >= 5;
    const isNeedFix = item.status === 'ส่งคืนแก้ไข';
    const progressPercent = Math.min(100, Math.round((item.currentStep / 5) * 100));
    const isFarmerGroup = item.coopType && item.coopType.includes('กลุ่มเกษตรกร');

    let statusBadgeClass = 'active';
    let statusText = 'อยู่ระหว่างพิจารณา';
    if (isApproved) {
      statusBadgeClass = 'completed';
      statusText = 'รับจดทะเบียน/เห็นชอบ/รับทราบ';
    } else if (isNeedFix) {
      statusBadgeClass = 'issue';
      statusText = 'ส่งคืนแก้ไข';
    }

    const typeBadgeClass = item.docType === 'ข้อบังคับสหกรณ์' ? 'reg-type-bylaw' : 'reg-type-rule';

    return `
      <tr>
        <td style="text-align: center; color: var(--text-muted);">${startIndex + idx + 1}</td>
        <td>
          <strong style="color: var(--primary);">${escapeHtml(item.coopName)}</strong>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(item.regNumber)} | <span class="case-type-badge ${isFarmerGroup ? 'farmer-group' : 'coop-type-badge'}" style="font-size: 0.7rem;">${escapeHtml(item.coopType || 'สหกรณ์')}</span></div>
        </td>
        <td><span class="case-type-badge ${typeBadgeClass}">${escapeHtml(item.docType)}</span></td>
        <td>
          <div style="font-weight: 500; font-size: 0.9rem;">${escapeHtml(item.title)}</div>
        </td>
        <td>
          <div>${escapeHtml(item.docNumber || '-')}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${formatThaiDate(item.submitDate)}</div>
        </td>
        <td>
          <div style="font-size: 0.85rem; font-weight: 500;">ขั้นที่ ${item.currentStep}/5 (${progressPercent}%)</div>
          <div class="progress-bar-bg" style="height: 6px; width: 90px; margin-top: 4px;">
            <div class="progress-bar-fill" style="width: ${progressPercent}%; background: #0d9488;"></div>
          </div>
        </td>
        <td>${escapeHtml(item.officerName || '-')}</td>
        <td>
          <span class="status-badge ${statusBadgeClass}">
            ${statusText}
          </span>
        </td>
        <td style="text-align: right;">
          <button class="btn btn-secondary btn-sm" onclick="openRegDetail('${item.regId}')">
            รายละเอียด
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

async function openRegDetail(regId) {
  setLoading(true);
  try {
    const regData = await ApiClient.get('getRegDetail', { regId: regId });
    AppState.selectedReg = regData;

    document.getElementById('detailRegTitle').innerText = regData.title;
    document.getElementById('detailRegCoopName').innerText = `🏛️ ${regData.coopName} (${regData.regNumber || '-'}) [${regData.coopType || 'สหกรณ์'}]`;

    const docTypeBadge = document.getElementById('detailRegDocType');
    docTypeBadge.innerText = regData.docType;
    docTypeBadge.className = `case-type-badge ${regData.docType === 'ข้อบังคับสหกรณ์' ? 'reg-type-bylaw' : 'reg-type-rule'}`;

    document.getElementById('detailRegDocNumber').innerText = regData.docNumber || '-';
    document.getElementById('detailRegSubmitDate').innerText = formatThaiDate(regData.submitDate);
    document.getElementById('detailRegOfficer').innerText = regData.officerName || '-';
    document.getElementById('detailRegContact').innerText = regData.officerContact || '-';

    const isApproved = regData.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || regData.status === 'รับจดทะเบียน/เห็นชอบแล้ว' || regData.currentStep >= 5;
    const statusBadge = document.getElementById('detailRegStatusBadge');
    if (isApproved) {
      statusBadge.className = 'status-badge completed';
      statusBadge.innerText = '✓ รับจดทะเบียน / เห็นชอบ / รับทราบแล้ว';
    } else if (regData.status === 'ส่งคืนแก้ไข') {
      statusBadge.className = 'status-badge issue';
      statusBadge.innerText = '⚠️ ส่งคืนแก้ไขปรับปรุง';
    } else {
      statusBadge.className = 'status-badge active';
      statusBadge.innerText = `● อยู่ระหว่างพิจารณา (ขั้นที่ ${regData.currentStep}/5)`;
    }

    const adminActions = document.getElementById('detailRegAdminActions');
    if (adminActions) adminActions.style.display = AppState.currentUser ? 'flex' : 'none';

    renderRegDetailTimeline();
    renderRegDetailDocuments();

    switchRegDetailTab('regTimeline');
    openModal('regDetailModal');
  } catch (err) {
    showToast('ไม่สามารถเปิดรายละเอียดระเบียบได้: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function renderRegDetailTimeline() {
  const container = document.getElementById('regTimelineContainer');
  const regData = AppState.selectedReg;
  if (!regData || !regData.steps || !container) return;

  container.innerHTML = regData.steps.map(step => {
    const isCompleted = step.status === 'เสร็จสิ้น';
    const isActive = step.status === 'กำลังดำเนินการ';
    const hasIssue = step.issue && step.issue.trim() !== '';

    let stateClass = 'pending';
    if (isCompleted) stateClass = 'completed';
    else if (isActive) stateClass = 'active';

    const stepDocs = (regData.documents || []).filter(d => parseInt(d.stepNumber, 10) === parseInt(step.stepNumber, 10));

    return `
      <div class="stepper-item ${stateClass}">
        <div class="stepper-node" style="${isCompleted ? 'background: #0d9488;' : ''}">
          ${isCompleted ? '✓' : step.stepNumber}
        </div>
        <div class="stepper-content">
          <div class="stepper-header">
            <div>
              <span style="font-size: 0.8rem; font-weight: 600; color: var(--text-muted);">ขั้นตอนที่ ${step.stepNumber}</span>
              <h4 class="stepper-title">${escapeHtml(step.stepName)}</h4>
            </div>
            <div style="display: flex; align-items: center; gap: 8px;">
              <span class="status-badge ${isCompleted ? 'completed' : isActive ? 'active' : 'pending'}">
                ${escapeHtml(step.status)}
              </span>
              ${AppState.currentUser ? `
                <button class="btn btn-secondary btn-sm" onclick="openUpdateRegStepModal(${step.stepNumber})" title="แก้ไขขั้นตอนนี้">
                  ✏️ แก้ไข
                </button>
              ` : ''}
            </div>
          </div>

          <div class="stepper-dates">
            <span>📅 เริ่ม: ${formatThaiDate(step.startDate)}</span>
            <span style="margin: 0 6px;">|</span>
            <span>🏁 เสร็จ: ${formatThaiDate(step.endDate)}</span>
          </div>

          ${hasIssue ? `
            <div class="stepper-obstacle" style="${isCompleted ? 'background: #f1f5f9; border-left-color: #94a3b8; color: #475569;' : ''}">
              <strong>${isCompleted ? 'ℹ️ ข้อสังเกตเดิม:' : '⚠️ ข้อสังเกต / จุดที่ต้องแก้ไข:'}</strong> ${escapeHtml(step.issue)}
            </div>
          ` : ''}

          ${step.note ? `
            <div class="stepper-note">
              <strong>📝 บันทึกเพิ่มเติม:</strong> ${escapeHtml(step.note)}
            </div>
          ` : ''}

          ${stepDocs.length > 0 ? `
            <div class="stepper-docs">
              ${stepDocs.map(d => `
                <a href="${escapeHtml(d.driveUrl)}" ${d.driveUrl.startsWith('data:') ? `download="${escapeHtml(d.fileName)}"` : 'target="_blank"'} class="doc-chip" title="เปิด/ดาวน์โหลดเอกสาร">
                  📄 ${escapeHtml(d.fileName)} (${escapeHtml(d.fileSize || 'ไฟล์แนบ')}) ↗
                </a>
              `).join('')}
            </div>
          ` : ''}
        </div>
      </div>
    `;
  }).join('');
}

function renderRegDetailDocuments() {
  const container = document.getElementById('regDocumentsContainer');
  const regData = AppState.selectedReg;
  if (!regData || !regData.documents || !container) return;

  const docs = regData.documents;

  if (docs.length === 0) {
    container.innerHTML = `
      <div class="empty-state" style="padding: 2rem;">
        <div class="empty-icon">📁</div>
        <p>ยังไม่มีเอกสารแนบในรายการนี้</p>
        ${AppState.currentUser ? `
          <button class="btn btn-primary btn-sm" onclick="openUploadRegDocModal()" style="margin-top: 1rem;">
            + อัพโหลดเอกสารแรก
          </button>
        ` : ''}
      </div>
    `;
    return;
  }

  container.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem;">
      <span style="font-weight: 600; color: var(--text-main);">เอกสารทั้งหมด (${docs.length} รายการ)</span>
      ${AppState.currentUser ? `
        <button class="btn btn-primary btn-sm" onclick="openUploadRegDocModal()">
          + อัพโหลดเอกสารใหม่
        </button>
      ` : ''}
    </div>
    <div style="display: flex; flex-direction: column; gap: 10px;">
      ${docs.map(d => `
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px 16px; display: flex; justify-content: space-between; align-items: center;">
          <div style="display: flex; align-items: center; gap: 12px;">
            <span style="font-size: 1.5rem;">📄</span>
            <div>
              <a href="${escapeHtml(d.driveUrl)}" ${d.driveUrl.startsWith('data:') ? `download="${escapeHtml(d.fileName)}"` : 'target="_blank"'} style="font-weight: 600; color: #0d9488; font-size: 0.95rem;">
                ${escapeHtml(d.fileName)}
              </a>
              <div style="font-size: 0.8rem; color: var(--text-muted); margin-top: 2px;">
                ${d.stepNumber ? `ผูกกับขั้นตอนที่ ${d.stepNumber}` : 'เอกสารทั่วไป'} • ขนาด ${escapeHtml(d.fileSize || '-')} • อัพโหลดเมื่อ ${formatThaiDate(d.uploadDate)}
              </div>
            </div>
          </div>
          <div style="display: flex; gap: 8px;">
            <a href="${escapeHtml(d.driveUrl)}" ${d.driveUrl.startsWith('data:') ? `download="${escapeHtml(d.fileName)}"` : 'target="_blank"'} class="btn btn-secondary btn-sm">
              เปิดดู ↗
            </a>
            ${AppState.currentUser ? `
              <button class="btn btn-danger btn-sm" onclick="deleteRegDocument('${d.docId}')" title="ลบเอกสาร">
                🗑️
              </button>
            ` : ''}
          </div>
        </div>
      `).join('')}
    </div>
  `;
}

function switchRegDetailTab(tab) {
  AppState.activeRegDetailTab = tab;
  document.querySelectorAll('#regDetailModal .modal-tab').forEach(el => {
    el.classList.toggle('active', el.dataset.tab === tab);
  });
  document.getElementById('tabRegTimeline').style.display = tab === 'regTimeline' ? 'block' : 'none';
  document.getElementById('tabRegDocuments').style.display = tab === 'regDocuments' ? 'block' : 'none';
}

function resetCreateRegItems() {
  const container = document.getElementById('createRegItemsList');
  if (!container) return;
  container.innerHTML = `
    <div class="reg-input-row" style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span class="reg-row-title" style="font-weight: 600; font-size: 0.85rem; color: var(--primary);">📜 รายการระเบียบ / ข้อบังคับที่ 1</span>
      </div>
      <div class="form-row" style="margin-bottom: 8px;">
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.82rem;">ประเภทรายการ <span style="color: red;">*</span></label>
          <select name="itemDocType" class="form-control" required>
            <option value="ข้อบังคับสหกรณ์">ข้อบังคับสหกรณ์ / ข้อบังคับกลุ่มเกษตรกร</option>
            <option value="ระเบียบสหกรณ์" selected>ระเบียบสหกรณ์ / ระเบียบกลุ่มเกษตรกร</option>
          </select>
        </div>
        <div class="form-group" style="margin-bottom: 0;">
          <label style="font-size: 0.82rem;">ขั้นตอนเริ่มต้น / อยู่ที่ขั้นตอน <span style="color: red;">*</span></label>
          <select name="itemStep" class="form-control" style="font-weight: 500;" required>
            <option value="1" selected>🟡 ขั้นที่ 1: ยื่นเรื่องและรับเอกสารคำขอ</option>
            <option value="2">🟡 ขั้นที่ 2: กลุ่มจัดตั้งฯ ตรวจสอบเบื้องต้น</option>
            <option value="3">🟡 ขั้นที่ 3: กลุ่มตรวจการฯ/นิติการตรวจร่าง</option>
            <option value="4">🟡 ขั้นที่ 4: เสนอนายทะเบียนสหกรณ์พิจารณา</option>
            <option value="5">🟢 ขั้นที่ 5: แจ้งผลและส่งมอบให้ถือใช้ (เสร็จสิ้น)</option>
          </select>
        </div>
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <label style="font-size: 0.82rem;">ชื่อระเบียบ / ข้อบังคับ <span style="color: red;">*</span></label>
        <input type="text" name="itemTitle" class="form-control" placeholder="เช่น ระเบียบว่าด้วยการให้เงินกู้แก่สมาชิก พ.ศ. 2567" required>
      </div>
    </div>
  `;
}

function addRegulationRowToCreateForm() {
  const container = document.getElementById('createRegItemsList');
  if (!container) return;
  const currentCount = container.querySelectorAll('.reg-input-row').length;
  const nextNum = currentCount + 1;

  const newRow = document.createElement('div');
  newRow.className = 'reg-input-row';
  newRow.style.cssText = 'background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; position: relative; animation: fadeIn 0.2s ease-in;';
  newRow.innerHTML = `
    <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
      <span class="reg-row-title" style="font-weight: 600; font-size: 0.85rem; color: var(--primary);">📜 รายการระเบียบ / ข้อบังคับที่ ${nextNum}</span>
      <button type="button" class="btn btn-danger btn-sm" onclick="removeRegulationRow(this)" style="padding: 2px 8px; font-size: 0.75rem;">
        ✕ ลบออก
      </button>
    </div>
    <div class="form-row" style="margin-bottom: 8px;">
      <div class="form-group" style="margin-bottom: 0;">
        <label style="font-size: 0.82rem;">ประเภทรายการ <span style="color: red;">*</span></label>
        <select name="itemDocType" class="form-control" required>
          <option value="ข้อบังคับสหกรณ์">ข้อบังคับสหกรณ์ / ข้อบังคับกลุ่มเกษตรกร</option>
          <option value="ระเบียบสหกรณ์" selected>ระเบียบสหกรณ์ / ระเบียบกลุ่มเกษตรกร</option>
        </select>
      </div>
      <div class="form-group" style="margin-bottom: 0;">
        <label style="font-size: 0.82rem;">ขั้นตอนเริ่มต้น / อยู่ที่ขั้นตอน <span style="color: red;">*</span></label>
        <select name="itemStep" class="form-control" style="font-weight: 500;" required>
          <option value="1" selected>🟡 ขั้นที่ 1: ยื่นเรื่องและรับเอกสารคำขอ</option>
          <option value="2">🟡 ขั้นที่ 2: กลุ่มจัดตั้งฯ ตรวจสอบเบื้องต้น</option>
          <option value="3">🟡 ขั้นที่ 3: กลุ่มตรวจการฯ/นิติการตรวจร่าง</option>
          <option value="4">🟡 ขั้นที่ 4: เสนอนายทะเบียนสหกรณ์พิจารณา</option>
          <option value="5">🟢 ขั้นที่ 5: แจ้งผลและส่งมอบให้ถือใช้ (เสร็จสิ้น)</option>
        </select>
      </div>
    </div>
    <div class="form-group" style="margin-bottom: 0;">
      <label style="font-size: 0.82rem;">ชื่อระเบียบ / ข้อบังคับ <span style="color: red;">*</span></label>
      <input type="text" name="itemTitle" class="form-control" placeholder="เช่น ระเบียบว่าด้วยการรับฝากเงิน พ.ศ. 2567" required>
    </div>
  `;
  container.appendChild(newRow);
}

function removeRegulationRow(btn) {
  const row = btn.closest('.reg-input-row');
  if (row) {
    row.remove();
    const rows = document.querySelectorAll('#createRegItemsList .reg-input-row');
    rows.forEach((r, idx) => {
      const title = r.querySelector('.reg-row-title');
      if (title) title.innerText = `📜 รายการระเบียบ / ข้อบังคับที่ ${idx + 1}`;
    });
  }
}

function openCreateRegModal() {
  if (!AppState.currentUser) {
    showToast('กรุณาเข้าสู่ระบบในฐานะ Admin ก่อน', 'warning');
    openModal('loginModal');
    return;
  }
  document.getElementById('createRegForm').reset();
  resetCreateRegItems();
  document.getElementById('createRegSubmitDate').value = todayThaiDate();
  openModal('createRegModal');
}

async function handleCreateRegSubmit(e) {
  e.preventDefault();
  const form = e.target;

  const itemRows = document.querySelectorAll('#createRegItemsList .reg-input-row');
  const items = [];
  itemRows.forEach(row => {
    const docTypeSelect = row.querySelector('select[name="itemDocType"]');
    const stepSelect = row.querySelector('select[name="itemStep"]');
    const titleInput = row.querySelector('input[name="itemTitle"]');
    if (titleInput && titleInput.value.trim() !== '') {
      items.push({
        docType: docTypeSelect ? docTypeSelect.value : 'ระเบียบสหกรณ์',
        title: titleInput.value.trim(),
        initialStep: stepSelect ? parseInt(stepSelect.value, 10) : 1
      });
    }
  });

  const coopName = form.coopName.value.trim();
  if (!coopName || items.length === 0) {
    showToast('กรุณากรอกชื่อสหกรณ์และระบุชื่อระเบียบ/ข้อบังคับอย่างน้อย 1 รายการ', 'warning');
    return;
  }

  const payload = {
    coopName: coopName,
    regNumber: form.regNumber.value.trim(),
    coopType: form.coopType ? form.coopType.value : 'สหกรณ์การเกษตร',
    docNumber: form.docNumber.value.trim(),
    submitDate: fromThaiDateInput(form.submitDate.value),
    officerName: form.officerName.value.trim(),
    officerContact: form.officerContact.value.trim(),
    note: form.note.value.trim(),
    items: items,
    // ponytail: fallback single fields for backward compatibility
    docType: items[0].docType,
    title: items[0].title,
    initialStep: items[0].initialStep || 1
  };

  setLoading(true);
  try {
    await ApiClient.post('createRegulation', payload);
    const count = items.length;
    showToast(`ยื่นเรื่องระเบียบ/ข้อบังคับสำเร็จ (${count} รายการ)`, 'success');
    closeModal('createRegModal');
    await loadRegulationsData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function openUpdateRegStepModal(stepNumber) {
  const regData = AppState.selectedReg;
  if (!regData) return;
  const step = (regData.steps || []).find(s => parseInt(s.stepNumber, 10) === parseInt(stepNumber, 10));
  if (!step) return;

  document.getElementById('updateRegStepNumber').value = stepNumber;
  document.getElementById('updateRegStepTitle').innerText = `แก้ไขขั้นตอนที่ ${stepNumber}: ${step.stepName}`;
  document.getElementById('updateRegStepStatus').value = step.status || 'ยังไม่เริ่ม';
  document.getElementById('updateRegStepStartDate').value = toThaiDateInput(step.startDate);
  document.getElementById('updateRegStepEndDate').value = toThaiDateInput(step.endDate);
  document.getElementById('updateRegStepIssue').value = step.issue || '';
  document.getElementById('updateRegStepNote').value = step.note || '';

  openModal('updateRegStepModal');
}

async function handleUpdateRegStepSubmit(e) {
  e.preventDefault();
  const regData = AppState.selectedReg;
  if (!regData) return;

  const form = e.target;
  const payload = {
    regId: regData.regId,
    stepNumber: parseInt(form.stepNumber.value, 10),
    status: form.status.value,
    startDate: fromThaiDateInput(form.startDate.value),
    endDate: fromThaiDateInput(form.endDate.value),
    issue: form.issue.value.trim(),
    note: form.note.value.trim()
  };

  setLoading(true);
  try {
    await ApiClient.post('updateRegStep', payload);
    showToast('อัพเดตขั้นตอนการพิจารณาเรียบร้อย', 'success');
    closeModal('updateRegStepModal');
    await openRegDetail(regData.regId);
    await loadRegulationsData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function openEditRegInfoModal() {
  const regData = AppState.selectedReg;
  if (!regData) return;

  document.getElementById('editRegCoopName').value = regData.coopName || '';
  if (document.getElementById('editRegCoopType')) {
    document.getElementById('editRegCoopType').value = regData.coopType || 'สหกรณ์การเกษตร';
  }
  document.getElementById('editRegDocType').value = regData.docType || 'ข้อบังคับสหกรณ์';
  document.getElementById('editRegTitle').value = regData.title || '';
  document.getElementById('editRegDocNumber').value = regData.docNumber || '';
  document.getElementById('editRegSubmitDate').value = toThaiDateInput(regData.submitDate);
  document.getElementById('editRegOfficerName').value = regData.officerName || '';
  document.getElementById('editRegOfficerContact').value = regData.officerContact || '';
  document.getElementById('editRegOverallStatus').value = regData.status || 'อยู่ระหว่างพิจารณา';
  document.getElementById('editRegNote').value = regData.note || '';

  openModal('editRegModal');
}

async function handleEditRegSubmit(e) {
  e.preventDefault();
  const regData = AppState.selectedReg;
  if (!regData) return;

  const form = e.target;
  const payload = {
    regId: regData.regId,
    coopName: form.coopName.value.trim(),
    coopType: form.coopType ? form.coopType.value : (regData.coopType || 'สหกรณ์การเกษตร'),
    docType: form.docType.value,
    title: form.title.value.trim(),
    docNumber: form.docNumber.value.trim(),
    submitDate: fromThaiDateInput(form.submitDate.value),
    officerName: form.officerName.value.trim(),
    officerContact: form.officerContact.value.trim(),
    status: form.status.value,
    note: form.note.value.trim()
  };

  setLoading(true);
  try {
    await ApiClient.post('updateRegulationInfo', payload);
    showToast('แก้ไขข้อมูลระเบียบ/ข้อบังคับสำเร็จ', 'success');
    closeModal('editRegModal');
    await openRegDetail(regData.regId);
    await loadRegulationsData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

function openUploadRegDocModal() {
  const form = document.getElementById('uploadRegDocForm');
  form.reset();
  document.getElementById('regUploadFilePreview').style.display = 'none';
  openModal('uploadRegDocModal');
}

async function handleUploadRegDocSubmit(e) {
  e.preventDefault();
  const regData = AppState.selectedReg;
  if (!regData) return;

  const form = e.target;
  const fileInput = form.docFile;
  const file = fileInput.files[0];

  if (!file) {
    showToast('กรุณาเลือกไฟล์ที่ต้องการอัพโหลด', 'warning');
    return;
  }

  const maxBytes = 10 * 1024 * 1024;
  if (file.size > maxBytes) {
    showToast('ขนาดไฟล์เกินกำหนด (สูงสุด 10 MB)', 'error');
    return;
  }

  setLoading(true);
  try {
    const base64Data = await fileToBase64(file);
    const payload = {
      regId: regData.regId,
      stepNumber: form.stepNumber.value || null,
      docType: form.docType.value,
      fileName: file.name,
      mimeType: file.type,
      fileBase64: base64Data,
      fileSize: (file.size / 1024 / 1024).toFixed(2) + ' MB'
    };

    await ApiClient.post('uploadRegDocument', payload);
    showToast('อัพโหลดไฟล์สำเร็จ', 'success');
    closeModal('uploadRegDocModal');
    await openRegDetail(regData.regId);
  } catch (err) {
    showToast('อัพโหลดไม่สำเร็จ: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function deleteRegDocument(docId) {
  if (!confirm('ยืนยันการลบเอกสารนี้?')) return;
  const regData = AppState.selectedReg;

  setLoading(true);
  try {
    await ApiClient.post('deleteRegDocument', { docId: docId, regId: regData ? regData.regId : null });
    showToast('ลบเอกสารเรียบร้อย', 'success');
    if (regData) await openRegDetail(regData.regId);
  } catch (err) {
    showToast('ไม่สามารถลบเอกสารได้: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function deleteCurrentReg() {
  const regData = AppState.selectedReg;
  if (!regData) return;
  if (!confirm(`ยืนยันการลบเรื่อง "${regData.title}"?`)) return;

  setLoading(true);
  try {
    await ApiClient.post('deleteRegulation', { regId: regData.regId });
    showToast('ลบเรื่องเรียบร้อย', 'success');
    closeModal('regDetailModal');
    await loadRegulationsData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

// ------------------------------------------------------------------------------
// 9. Auth & Session Management
// ------------------------------------------------------------------------------
function setupGoogleAuth() {
  const googleBtnContainer = document.getElementById('googleSignInBtn');
  if (window.google && google.accounts && google.accounts.id && CONFIG.GOOGLE_CLIENT_ID) {
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleGoogleSignInCallback
    });

    if (googleBtnContainer) {
      googleBtnContainer.style.display = 'flex';
      google.accounts.id.renderButton(googleBtnContainer, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular'
      });
    }
  } else if (googleBtnContainer) {
    googleBtnContainer.style.display = 'none';
  }
}

let isLoggingIn = false;

async function handleGoogleSignInCallback(response) {
  if (isLoggingIn) return;
  isLoggingIn = true;
  setLoading(true);
  try {
    const authData = await ApiClient.post('login', { idToken: response.credential });
    setLoggedInUser(authData);
    closeModal('loginModal');
    showToast(`ยินดีต้อนรับ ${authData.name}`, 'success');
  } catch (err) {
    showToast('เข้าสู่ระบบไม่สำเร็จ: ' + err.message, 'error');
  } finally {
    isLoggingIn = false;
    setLoading(false);
  }
}

async function handleAdminLoginSubmit(e) {
  if (e) e.preventDefault();
  if (isLoggingIn) return;

  const email = (document.getElementById('loginEmail')?.value || '').trim();

  if (!email) {
    showToast('กรุณากรอกอีเมลเจ้าหน้าที่', 'warning');
    return;
  }

  isLoggingIn = true;
  setLoading(true);
  try {
    const authData = await ApiClient.post('login', { email });
    setLoggedInUser(authData);
    closeModal('loginModal');
    showToast(`ยินดีต้อนรับ ${authData.name || email}`, 'success');
  } catch (err) {
    showToast('เข้าสู่ระบบไม่สำเร็จ: ' + (err.message || err), 'error');
  } finally {
    isLoggingIn = false;
    setLoading(false);
  }
}

function setLoggedInUser(user) {
  AppState.currentUser = user;
  localStorage.setItem('liquidation_auth', JSON.stringify(user));
  updateAuthUI();
}

function loadSavedSession() {
  try {
    const saved = localStorage.getItem('liquidation_auth');
    if (saved) {
      const user = JSON.parse(saved);
      if (user.expiresAt && new Date(user.expiresAt) > new Date()) {
        AppState.currentUser = user;
      } else {
        localStorage.removeItem('liquidation_auth');
      }
    }
  } catch (e) { }
  updateAuthUI();
}

function logout() {
  AppState.currentUser = null;
  localStorage.removeItem('liquidation_auth');
  updateAuthUI();
  showToast('ออกจากระบบเรียบร้อย', 'info');
  if (AppState.selectedCase) openCaseDetail(AppState.selectedCase.caseId);
  if (AppState.selectedReg) openRegDetail(AppState.selectedReg.regId);
}

function updateAuthUI() {
  const loginBtn = document.getElementById('navLoginBtn');
  const userProfile = document.getElementById('navUserProfile');
  const adminAddCaseBtn = document.getElementById('adminAddCaseBtn');
  const adminAddRegBtn = document.getElementById('adminAddRegBtn');
  const adminAuditLogBtn = document.getElementById('adminAuditLogBtn');

  if (AppState.currentUser) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userProfile) {
      userProfile.style.display = 'flex';
      document.getElementById('navUserName').innerText = AppState.currentUser.name;
      document.getElementById('navUserRole').innerText = AppState.currentUser.role || 'Admin';
    }
    if (adminAddCaseBtn) adminAddCaseBtn.style.display = AppState.currentView === 'liquidation' ? 'inline-flex' : 'none';
    if (adminAddRegBtn) adminAddRegBtn.style.display = AppState.currentView === 'regulations' ? 'inline-flex' : 'none';
    if (adminAuditLogBtn) adminAuditLogBtn.style.display = 'inline-flex';
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (userProfile) userProfile.style.display = 'none';
    if (adminAddCaseBtn) adminAddCaseBtn.style.display = 'none';
    if (adminAddRegBtn) adminAddRegBtn.style.display = 'none';
    if (adminAuditLogBtn) adminAuditLogBtn.style.display = 'none';
  }
}

// ------------------------------------------------------------------------------
// 10. Event Listeners & UI Helpers
// ------------------------------------------------------------------------------
function setupEventListeners() {
  // Global Hub Search Enter key
  document.getElementById('hubGlobalSearchInput')?.addEventListener('keyup', (e) => {
    if (e.key === 'Enter') handleHubGlobalSearch();
  });

  // Liquidation Filters
  const searchInput = document.getElementById('heroSearchInput');
  const searchBtn = document.getElementById('heroSearchBtn');

  if (searchInput) {
    searchInput.addEventListener('input', (e) => {
      AppState.searchTerm = e.target.value;
      applyFilters();
    });
  }
  if (searchBtn) searchBtn.addEventListener('click', () => applyFilters());

  // Liquidation View Toggle
  const btnGridView = document.getElementById('btnGridView');
  const btnTableView = document.getElementById('btnTableView');
  if (btnGridView && btnTableView) {
    btnGridView.addEventListener('click', () => {
      AppState.viewMode = 'grid';
      AppState.casePage = 1;
      btnGridView.classList.add('active');
      btnTableView.classList.remove('active');
      renderCasesList();
    });
    btnTableView.addEventListener('click', () => {
      AppState.viewMode = 'table';
      AppState.casePage = 1;
      btnTableView.classList.add('active');
      btnGridView.classList.remove('active');
      renderCasesList();
    });
  }

  // Regulations Filters
  const regSearchInput = document.getElementById('regSearchInput');
  if (regSearchInput) {
    regSearchInput.addEventListener('input', (e) => {
      AppState.regSearchTerm = e.target.value;
      applyRegFilters();
    });
  }

  // Regulations View Toggle
  const btnRegGridView = document.getElementById('btnRegGridView');
  const btnRegTableView = document.getElementById('btnRegTableView');
  if (btnRegGridView && btnRegTableView) {
    btnRegGridView.addEventListener('click', () => {
      AppState.regViewMode = 'grid';
      AppState.regPage = 1;
      btnRegGridView.classList.add('active');
      btnRegTableView.classList.remove('active');
      renderRegulationsList();
    });
    btnRegTableView.addEventListener('click', () => {
      AppState.regViewMode = 'table';
      AppState.regPage = 1;
      btnRegTableView.classList.add('active');
      btnRegGridView.classList.remove('active');
      renderRegulationsList();
    });
  }

  // Forms
  document.getElementById('adminLoginForm')?.addEventListener('submit', handleAdminLoginSubmit);
  document.getElementById('createCaseForm')?.addEventListener('submit', handleCreateCaseSubmit);
  document.getElementById('updateStepForm')?.addEventListener('submit', handleUpdateStepSubmit);
  document.getElementById('addLiquidatorForm')?.addEventListener('submit', handleAddLiquidatorSubmit);
  document.getElementById('editLiquidatorForm')?.addEventListener('submit', handleEditLiquidatorSubmit);
  document.getElementById('editCaseForm')?.addEventListener('submit', handleEditCaseSubmit);
  document.getElementById('uploadDocForm')?.addEventListener('submit', handleUploadDocSubmit);

  document.getElementById('createRegForm')?.addEventListener('submit', handleCreateRegSubmit);
  document.getElementById('updateRegStepForm')?.addEventListener('submit', handleUpdateRegStepSubmit);
  document.getElementById('editRegForm')?.addEventListener('submit', handleEditRegSubmit);
  document.getElementById('uploadRegDocForm')?.addEventListener('submit', handleUploadRegDocSubmit);

  setupDropzones();
}

function setupDropzones() {
  // Liquidation Dropzone
  setupSingleDropzone('fileDropzone', 'docFileInput', 'uploadFilePreview');
  // Regulations Dropzone
  setupSingleDropzone('regFileDropzone', 'regDocFileInput', 'regUploadFilePreview');
}

function setupSingleDropzone(dropzoneId, inputId, previewId) {
  const dropzone = document.getElementById(dropzoneId);
  const fileInput = document.getElementById(inputId);
  const preview = document.getElementById(previewId);

  if (!dropzone || !fileInput) return;

  dropzone.addEventListener('click', () => fileInput.click());

  dropzone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropzone.classList.add('dragover');
  });

  dropzone.addEventListener('dragleave', () => dropzone.classList.remove('dragover'));

  dropzone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropzone.classList.remove('dragover');
    if (e.dataTransfer.files.length > 0) {
      fileInput.files = e.dataTransfer.files;
      showSelectedFileName(e.dataTransfer.files[0], preview);
    }
  });

  fileInput.addEventListener('change', (e) => {
    if (e.target.files.length > 0) {
      showSelectedFileName(e.target.files[0], preview);
    }
  });

  function showSelectedFileName(file, prevEl) {
    if (prevEl) {
      prevEl.style.display = 'block';
      prevEl.innerHTML = `<strong>📁 ไฟล์ที่เลือก:</strong> ${escapeHtml(file.name)} (${(file.size / 1024 / 1024).toFixed(2)} MB)`;
    }
  }
}

function openModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.add('show');
    document.body.style.overflow = 'hidden';
  }
}

function closeModal(id) {
  const modal = document.getElementById(id);
  if (modal) {
    modal.classList.remove('show');
    document.body.style.overflow = '';
  }
}

function showToast(message, type = 'info') {
  if (type === 'danger') type = 'error';
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = `toast ${type}`;
  let icon = type === 'success' ? '✅' : type === 'error' ? '❌' : type === 'warning' ? '⚠️' : 'ℹ️';

  toast.innerHTML = `<span>${icon}</span> <span>${escapeHtml(message)}</span>`;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateX(100%)';
    setTimeout(() => toast.remove(), 300);
  }, 4000);
}

function setLoading(isLoading) {
  AppState.isLoading = isLoading;
  const loader = document.getElementById('globalLoader');
  if (loader) loader.style.display = isLoading ? 'flex' : 'none';
}

function fileToBase64(file) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      resolve(result.substring(result.indexOf(',') + 1));
    };
    reader.onerror = error => reject(error);
    reader.readAsDataURL(file);
  });
}

function formatThaiDate(dateStr) {
  if (!dateStr) return '-';
  try {
    const date = new Date(dateStr);
    if (isNaN(date.getTime())) return dateStr;
    const months = ['ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.', 'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.'];
    let year = date.getFullYear();
    if (year < 2400) year += 543;
    return `${date.getDate()} ${months[date.getMonth()]} ${year}`;
  } catch (e) {
    return dateStr;
  }
}

// ponytail: Thai Buddhist Era date input helpers for form fields
// Converts ISO date string (yyyy-mm-dd) to Thai input format (dd/mm/พ.ศ.)
function toThaiDateInput(isoStr) {
  if (!isoStr) return '';
  const d = new Date(isoStr);
  if (isNaN(d.getTime())) return '';
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear() + 543;
  return `${dd}/${mm}/${yyyy}`;
}

// Converts Thai input format (dd/mm/พ.ศ.) back to ISO date string (yyyy-mm-dd) for backend
function fromThaiDateInput(thaiStr) {
  if (!thaiStr) return '';
  const parts = thaiStr.split('/');
  if (parts.length !== 3) return '';
  const dd = parts[0], mm = parts[1], buddhistYear = parseInt(parts[2], 10);
  if (isNaN(buddhistYear)) return '';
  const ceYear = buddhistYear - 543;
  return `${ceYear}-${mm}-${dd}`;
}

// Returns today in Thai date input format
function todayThaiDate() {
  const d = new Date();
  const dd = String(d.getDate()).padStart(2, '0');
  const mm = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear() + 543;
  return `${dd}/${mm}/${yyyy}`;
}

// Auto-format Thai date input: inserts '/' after dd and mm as user types, digits only
function initThaiDateInputs() {
  document.addEventListener('input', function (e) {
    if (!e.target.classList.contains('thai-date-input')) return;
    let v = e.target.value.replace(/[^\d/]/g, '');
    // Auto-insert slashes
    const digits = v.replace(/\//g, '');
    if (digits.length >= 4) {
      v = digits.slice(0, 2) + '/' + digits.slice(2, 4) + '/' + digits.slice(4, 8);
    } else if (digits.length >= 2) {
      v = digits.slice(0, 2) + '/' + digits.slice(2);
    }
    e.target.value = v;
  });
}

// Call once on page load
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initThaiDateInputs);
} else {
  initThaiDateInputs();
}

function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function renderPaginationUI(containerId, currentPage, totalPages, totalItems, startIndex, endIndex, onPageChangeFnName) {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (totalItems === 0) {
    container.style.display = 'none';
    return;
  }

  container.style.display = 'flex';

  const infoHtml = `<div class="pagination-info">แสดง <strong>${startIndex + 1} - ${endIndex}</strong> จากทั้งหมด <strong>${totalItems}</strong> รายการ</div>`;

  if (totalPages <= 1) {
    container.innerHTML = infoHtml + `<div class="pagination-controls"></div>`;
    return;
  }

  let pagesHtml = '';
  const prevDisabled = currentPage <= 1 ? 'disabled' : '';
  pagesHtml += `<button type="button" class="pagination-btn" ${prevDisabled} onclick="${onPageChangeFnName}(${currentPage - 1})" title="หน้าก่อนหน้า">« ก่อนหน้า</button>`;

  const pages = [];
  if (totalPages <= 7) {
    for (let i = 1; i <= totalPages; i++) pages.push(i);
  } else {
    pages.push(1);
    if (currentPage > 3) pages.push('...');

    const start = Math.max(2, currentPage - 1);
    const end = Math.min(totalPages - 1, currentPage + 1);
    for (let i = start; i <= end; i++) pages.push(i);

    if (currentPage < totalPages - 2) pages.push('...');
    pages.push(totalPages);
  }

  pages.forEach(p => {
    if (p === '...') {
      pagesHtml += `<span class="pagination-ellipsis">…</span>`;
    } else {
      const activeClass = p === currentPage ? 'active' : '';
      pagesHtml += `<button type="button" class="pagination-btn ${activeClass}" onclick="${onPageChangeFnName}(${p})">${p}</button>`;
    }
  });

  const nextDisabled = currentPage >= totalPages ? 'disabled' : '';
  pagesHtml += `<button type="button" class="pagination-btn" ${nextDisabled} onclick="${onPageChangeFnName}(${currentPage + 1})" title="หน้าถัดไป">ถัดไป »</button>`;

  container.innerHTML = infoHtml + `<div class="pagination-controls">${pagesHtml}</div>`;
}

function changeCasePage(newPage) {
  AppState.casePage = newPage;
  renderCasesList();
  const el = document.getElementById('casesGrid');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function changeRegPage(newPage) {
  AppState.regPage = newPage;
  renderRegulationsList();
  const el = document.getElementById('regGrid');
  if (el) el.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

// Expose to window for inline onclick handlers
window.changeCasePage = changeCasePage;
window.changeRegPage = changeRegPage;

async function openAuditLogModal() {
  // ponytail: admin-only guard for audit log access
  if (!AppState.currentUser) {
    showToast('กรุณาเข้าสู่ระบบในฐานะ Admin ก่อน', 'warning');
    openModal('loginModal');
    return;
  }
  setLoading(true);
  try {
    const logs = await ApiClient.post('getAuditLogs', {});
    const container = document.getElementById('auditLogList');
    if (!logs || logs.length === 0) {
      container.innerHTML = '<p style="color: var(--text-muted); text-align: center; padding: 2rem;">ยังไม่มีประวัติการทำรายการ</p>';
    } else {
      container.innerHTML = logs.map(l => `
        <div style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 10px 14px; font-size: 0.88rem;">
          <div style="display: flex; justify-content: space-between; margin-bottom: 2px;">
            <strong style="color: var(--primary);">${escapeHtml(l.action)}</strong>
            <span style="font-size: 0.78rem; color: var(--text-muted);">${formatThaiDate(l.timestamp)}</span>
          </div>
          <div style="color: var(--text-main);">${escapeHtml(l.detail)}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted); margin-top: 2px;">โดย: ${escapeHtml(l.email)} ${l.caseId ? '| รหัส: ' + escapeHtml(l.caseId) : ''}</div>
        </div>
      `).join('');
    }
    openModal('auditLogModal');
  } catch (err) {
    showToast('ไม่สามารถดึง Audit Logs ได้', 'error');
  } finally {
    setLoading(false);
  }
}

// Startup
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}
