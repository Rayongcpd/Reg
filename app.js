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
  filterGroup: 'ALL', // 'ALL' | 'กลุ่มส่งเสริมสหกรณ์ 1' | 'กลุ่มส่งเสริมสหกรณ์ 2' | 'กลุ่มส่งเสริมสหกรณ์ 3' | 'นิคมสหกรณ์ชะแวะ'

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
  regFilterGroup: 'ALL', // 'ALL' | 'กลุ่มส่งเสริมสหกรณ์ 1' | 'กลุ่มส่งเสริมสหกรณ์ 2' | 'กลุ่มส่งเสริมสหกรณ์ 3' | 'นิคมสหกรณ์ชะแวะ'

  // Cooperative Directory State
  coopDirGroupFilter: 'ALL',

  // System State
  currentUser: null, // { email, name, role, token }
  isLoading: false
};


// ------------------------------------------------------------------------------
// 2. API Transport
// ------------------------------------------------------------------------------
const ApiClient = {
  async get(action, params = {}, retries = 2) {
    if (!CONFIG.APPS_SCRIPT_URL) {
      throw new Error('ยังไม่ได้กำหนดค่า APPS_SCRIPT_URL ใน config.js');
    }
    const url = new URL(CONFIG.APPS_SCRIPT_URL);
    url.searchParams.set('action', action);
    Object.keys(params).forEach(k => {
      if (params[k] !== undefined && params[k] !== null) url.searchParams.set(k, params[k]);
    });

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(url.toString(), {
          method: 'GET',
          credentials: 'omit',
          redirect: 'follow'
        });

        const text = await response.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch (parseErr) {
          console.warn(`[ApiClient] Parse error on ${action} (attempt ${attempt + 1}/${retries + 1}):`, text.substring(0, 300));
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
            continue;
          }
          if (text.includes('accounts.google.com') || text.includes('Service Login') || text.includes('Sign in')) {
            throw new Error('Google Apps Script ติดปัญหาการยืนยันตัวตน Google (แนะนำลองเปิดในโหมดไม่ระบุตัวตน / Incognito หรือตรวจการตั้งค่า Web App Deploy ให้สิทธิ์ Everyone/Anyone)');
          }
          if (text.includes('Google Docs') || text.includes('Service Spreadsheets') || text.includes('Exceeded')) {
            throw new Error('เซิร์ฟเวอร์ Google Apps Script กำลังยุ่งหรือทำงานเกินเวลา กรุณารีเฟรชใหม่อีกครั้ง');
          }
          throw new Error(`การตอบกลับจากเซิร์ฟเวอร์ไม่ใช่ JSON (${text.substring(0, 80)}...)`);
        }

        if (!json.success) throw new Error(json.error || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
        return json.data;
      } catch (err) {
        if (attempt < retries && !err.message.includes('ยังไม่ได้กำหนดค่า')) {
          await new Promise(r => setTimeout(r, 1200 * (attempt + 1)));
          continue;
        }
        throw err;
      }
    }
  },

  async post(action, data = {}, retries = 1) {
    if (!CONFIG.APPS_SCRIPT_URL) {
      throw new Error('ยังไม่ได้กำหนดค่า APPS_SCRIPT_URL ใน config.js');
    }
    const payload = {
      action: action,
      sessionToken: AppState.currentUser ? (AppState.currentUser.token || AppState.currentUser.sessionToken) : null,
      ...data
    };

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        const response = await fetch(CONFIG.APPS_SCRIPT_URL, {
          method: 'POST',
          credentials: 'omit',
          redirect: 'follow',
          headers: { 'Content-Type': 'text/plain;charset=utf-8' },
          body: JSON.stringify(payload)
        });

        const text = await response.text();
        let json;
        try {
          json = JSON.parse(text);
        } catch (parseErr) {
          console.warn(`[ApiClient.post] Parse error on ${action}:`, text.substring(0, 300));
          if (attempt < retries) {
            await new Promise(r => setTimeout(r, 1500));
            continue;
          }
          throw new Error(`การตอบกลับจากเซิร์ฟเวอร์ไม่ใช่ JSON (${text.substring(0, 80)}...)`);
        }

        if (!json.success) throw new Error(json.error || 'การบันทึกข้อมูลไม่สำเร็จ');
        return json.data;
      } catch (err) {
        if (attempt < retries && !err.message.includes('ยังไม่ได้กำหนดค่า')) {
          await new Promise(r => setTimeout(r, 1500));
          continue;
        }
        throw err;
      }
    }
  }
};

// ------------------------------------------------------------------------------
// 3. Helper Utilities & Cooperative Helpers
// ------------------------------------------------------------------------------
function escapeHtml(str) {
  if (!str) return '';
  return str.toString()
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
}

function getResolvedGroup(item) {
  if (!item) return '';
  if (item.promotionGroup && item.promotionGroup.trim() !== '') return item.promotionGroup.trim();
  if (item.group && item.group.trim() !== '') return item.group.trim();
  if (typeof CoopDatabaseUtil !== 'undefined' && item.coopName) {
    const matched = CoopDatabaseUtil.findByName(item.coopName);
    if (matched && matched.group) return matched.group;
  }
  return '';
}

function getGroupBadgeClass(groupName) {
  if (!groupName) return 'group-badge-default';
  if (groupName.includes('1')) return 'group-badge-1';
  if (groupName.includes('2')) return 'group-badge-2';
  if (groupName.includes('3')) return 'group-badge-3';
  if (groupName.includes('ชะแวะ')) return 'group-badge-chawoe';
  return 'group-badge-default';
}

function getGroupBadgeHtml(groupName) {
  if (!groupName || groupName === '-' || groupName === 'ไม่ระบุ') return '';
  const badgeClass = getGroupBadgeClass(groupName);
  return `<span class="group-badge ${badgeClass}" title="กลุ่มส่งเสริมสหกรณ์ที่รับผิดชอบ">${escapeHtml(groupName)}</span>`;
}

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
  const regDone = AppState.regulations.filter(r => r.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || r.status === 'รับจดทะเบียน/เห็นชอบแล้ว' || r.currentStep >= (CONFIG.REGULATION_STEPS?.length || 4)).length;
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
    // โหลดข้อมูลแบบ sequential เพื่อป้องกัน Google Apps Script เกิดปัญหา Concurrency/Lock ชนกัน
    await loadCasesData();
    await loadRegulationsData();
  } catch (err) {
    console.error('Initial data load error:', err);
  } finally {
    setLoading(false);
  }

  updateHubStatsDisplay();

  // โหลด/ซิงค์ฐานข้อมูลรายชื่อสหกรณ์ล่าสุดจาก Google Sheets (CoopDirectory) เบื้องหลัง
  if (typeof CoopDatabaseUtil !== 'undefined' && typeof CoopDatabaseUtil.syncFromRemote === 'function') {
    CoopDatabaseUtil.syncFromRemote().catch(e => console.warn('Background coop directory sync:', e));
  }
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
      (c.location && c.location.toLowerCase().includes(q)) ||
      (getResolvedGroup(c).toLowerCase().includes(q))
    );
  }

  // Filter by Group (กลุ่มส่งเสริมสหกรณ์ที่รับผิดชอบ)
  if (AppState.filterGroup && AppState.filterGroup !== 'ALL') {
    list = list.filter(c => {
      const g = getResolvedGroup(c);
      return g === AppState.filterGroup || g.includes(AppState.filterGroup);
    });
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
  if (filterKey === 'group') AppState.filterGroup = value;
  applyFilters();
}

function resetCaseFilters() {
  AppState.filterStep = 'ALL';
  AppState.filterStatus = 'ALL';
  AppState.filterType = 'ALL';
  AppState.filterGroup = 'ALL';
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
  document.querySelectorAll('[data-case-group]').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.caseGroup === AppState.filterGroup);
  });

  let activeCount = 0;
  if (AppState.filterStep !== 'ALL') activeCount++;
  if (AppState.filterStatus !== 'ALL') activeCount++;
  if (AppState.filterType !== 'ALL') activeCount++;
  if (AppState.filterGroup !== 'ALL') activeCount++;
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
    const groupBadgeHtml = getGroupBadgeHtml(getResolvedGroup(item));

    return `
      <div class="case-card">
        <div class="case-card-header">
          <div class="case-badge-group">
            <span class="case-type-badge ${isFarmerGroup ? 'farmer-group' : 'coop-type-badge'}">${escapeHtml(item.coopType)}</span>
            ${groupBadgeHtml}
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
    const groupBadgeHtml = getGroupBadgeHtml(getResolvedGroup(item));

    let issuesTooltip = '';
    if (item.hasIssues && item.issues) {
      issuesTooltip = item.issues.map(i => `ขั้นที่ ${i.stepNumber}: ${i.issue}`).join(' | ');
    }

    return `
      <tr>
        <td style="text-align: center; color: var(--text-muted);">${startIndex + idx + 1}</td>
        <td>
          <strong style="color: var(--primary);">${escapeHtml(item.coopName)}</strong>
          <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 2px;">
            <span>${escapeHtml(item.regNumber)}</span> | <span>${escapeHtml(item.location)}</span>
            ${groupBadgeHtml}
          </div>
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
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-outline-primary btn-sm" onclick="quickExportCasePdf('${item.caseId}')" title="ส่งออกข้อมูลสหกรณ์นี้เป็น PDF" style="padding: 4px 8px; margin-right: 4px;">
            📄 PDF
          </button>
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

    const caseGroup = getResolvedGroup(caseData);
    const groupBadgeEl = document.getElementById('detailCasePromotionGroupBadge');
    if (groupBadgeEl) {
      if (caseGroup) {
        groupBadgeEl.style.display = 'inline-flex';
        groupBadgeEl.className = `group-badge ${getGroupBadgeClass(caseGroup)}`;
        groupBadgeEl.innerText = caseGroup;
      } else {
        groupBadgeEl.style.display = 'none';
      }
    }

    const dissolutionType = caseData.dissolutionType || (caseData.orderNumber && caseData.orderNumber.includes('ประกาศ') ? 'ประกาศเลิก' : 'คำสั่งเลิก');
    const dissolutionLabelEl = document.getElementById('detailDissolutionLabel');
    if (dissolutionLabelEl) dissolutionLabelEl.innerText = `${dissolutionType}เลขที่`;

    document.getElementById('detailOrderNumber').innerText = caseData.orderNumber || '-';
    const ordDur = WorkingDaysUtil.calculate(caseData.orderDate, (caseData.caseStatus === 'เสร็จสิ้น' || caseData.currentStep >= 10) ? caseData.lastUpdated : null, caseData.caseStatus);
    document.getElementById('detailOrderDate').innerHTML = formatThaiDate(caseData.orderDate) + (ordDur.hasData ? ` <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted);" title="${escapeHtml(ordDur.tooltip)}">(${ordDur.workingDays} วันทำการ)</span>` : '');

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

  // คำนวณวันทำการรวมทุกขั้นตอน (ไม่รวมวันเสาร์-อาทิตย์ และวันหยุดราชการ)
  let totalWorkingDays = 0;
  const stepDurations = caseData.steps.map(step => {
    const dur = WorkingDaysUtil.calculate(step.startDate, step.endDate, step.status);
    if (dur.hasData && (step.status === 'เสร็จสิ้น' || step.status === 'กำลังดำเนินการ')) {
      totalWorkingDays += dur.workingDays;
    }
    return dur;
  });

  const completedCount = caseData.steps.filter(s => s.status === 'เสร็จสิ้น').length;
  const totalCount = caseData.steps.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const currentStepObj = caseData.steps.find(s => parseInt(s.stepNumber, 10) === parseInt(caseData.currentStep, 10)) || {};

  const summaryHtml = `
    <div class="timeline-summary-card">
      <div class="timeline-summary-header">
        <div class="summary-title-wrap">
          <span class="summary-icon">⏱️</span>
          <div>
            <div class="summary-title">สรุปภาพรวมระยะเวลาชำระบัญชี</div>
            <div class="summary-subtitle">คำนวณเฉพาะวันทำการ (ไม่นับวันเสาร์-อาทิตย์ และวันหยุดราชการ)</div>
          </div>
        </div>
        <div class="summary-total-badge">
          <span class="total-label">รวมระยะเวลาที่ใช้ไป:</span>
          <span class="total-number">${totalWorkingDays}</span>
          <span class="total-unit">วันทำการ</span>
        </div>
      </div>
      <div class="timeline-summary-grid">
        <div class="summary-grid-item">
          <span class="item-label">📊 ขั้นตอนที่เสร็จสิ้น</span>
          <strong class="item-val">${completedCount} จาก ${totalCount} ขั้นตอน (${progressPercent}%)</strong>
        </div>
        <div class="summary-grid-item">
          <span class="item-label">🚀 ขั้นตอนปัจจุบัน</span>
          <strong class="item-val">ขั้นที่ ${caseData.currentStep}: ${escapeHtml(currentStepObj.stepName || '-')}</strong>
        </div>
        <div class="summary-grid-item">
          <span class="item-label">📅 วันที่คำสั่ง/ประกาศเลิก</span>
          <strong class="item-val">${formatThaiDate(caseData.orderDate)}</strong>
        </div>
      </div>
    </div>
  `;

  const stepsHtml = caseData.steps.map((step, idx) => {
    const dur = stepDurations[idx];
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
            <span class="date-item">📅 เริ่ม: <strong>${formatThaiDate(step.startDate)}</strong></span>
            <span class="date-sep">|</span>
            <span class="date-item">🏁 เสร็จ: <strong>${formatThaiDate(step.endDate)}</strong></span>
            ${dur.hasData ? `
              <span class="date-sep">|</span>
              <span class="stepper-duration-tag ${dur.isOngoing ? 'ongoing' : isCompleted ? 'done' : ''}" title="${escapeHtml(dur.tooltip)}">
                ⏱️ ระยะเวลา: <strong>${dur.workingDays} วันทำการ</strong>${dur.isOngoing ? ' <span class="badge-subtext">(กำลังดำเนินการ)</span>' : ''}
              </span>
            ` : `
              <span class="date-sep">|</span>
              <span class="stepper-duration-tag pending" title="ยังไม่มีข้อมูลวันที่">
                ⏱️ ระยะเวลา: -
              </span>
            `}
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

  container.innerHTML = summaryHtml + `<div class="stepper-list-wrap">` + stepsHtml + `</div>`;
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
    promotionGroup: form.promotionGroup ? form.promotionGroup.value : '',
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
  if (document.getElementById('editCasePromotionGroup')) {
    document.getElementById('editCasePromotionGroup').value = caseData.promotionGroup || getResolvedGroup(caseData) || '';
  }
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
    promotionGroup: form.promotionGroup ? form.promotionGroup.value : '',
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
    list = list.filter(r => {
      const g = getResolvedGroup(r);
      return (r.coopName && r.coopName.toLowerCase().includes(q)) ||
        (r.title && r.title.toLowerCase().includes(q)) ||
        (r.docNumber && r.docNumber.toLowerCase().includes(q)) ||
        (r.officerName && r.officerName.toLowerCase().includes(q)) ||
        (r.regNumber && r.regNumber.toLowerCase().includes(q)) ||
        (g && g.toLowerCase().includes(q));
    });
  }

  // Filter by Promotion Group
  if (AppState.regFilterGroup && AppState.regFilterGroup !== 'ALL') {
    list = list.filter(r => getResolvedGroup(r) === AppState.regFilterGroup);
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
    const target = AppState.regFilterDocType;
    list = list.filter(r => {
      const dt = r.docType || '';
      if (dt === target) return true;
      if (target === 'ข้อบังคับสหกรณ์') {
        return dt.includes('ข้อบังคับ');
      }
      if (target === 'ระเบียบสหกรณ์ (เห็นชอบ)') {
        return dt.includes('เห็นชอบ');
      }
      if (target === 'ระเบียบสหกรณ์ (รับทราบ)') {
        return dt.includes('รับทราบ') || (dt.includes('ระเบียบ') && !dt.includes('เห็นชอบ'));
      }
      return false;
    });
  }

  if (AppState.regFilterStatus === 'IN_REVIEW') {
    list = list.filter(r => r.status === 'อยู่ระหว่างพิจารณา');
  } else if (AppState.regFilterStatus === 'APPROVED') {
    list = list.filter(r => r.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || r.status === 'รับจดทะเบียน/เห็นชอบแล้ว' || r.currentStep >= (CONFIG.REGULATION_STEPS?.length || 4));
  } else if (AppState.regFilterStatus === 'NEED_FIX') {
    list = list.filter(r => r.status === 'ส่งคืนแก้ไข');
  }

  AppState.filteredRegulations = list;
  AppState.regPage = 1;
  renderRegulationsList();
  updateHubStatsDisplay();
  updateRegFilterChipUI();
}

function getRegDuration(item) {
  if (!item) return { hasData: false, workingDays: 0, sla: null };
  const receiveDate = item.receiveDate || item.submitDate;
  // Step 3 end date (approved by registrar)
  const step3 = item.steps?.find(s => parseInt(s.stepNumber, 10) === 3);
  const approveDate = item.regApproveDate || step3?.endDate || (item.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || item.status === 'รับจดทะเบียน/เห็นชอบแล้ว' ? item.lastUpdated : null);
  const isApproved = !!approveDate || item.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || item.status === 'รับจดทะเบียน/เห็นชอบแล้ว';

  // Duration is counted strictly from receiveDate to approveDate (Step 3)!
  const dur = WorkingDaysUtil.calculate(receiveDate, isApproved ? approveDate : null, isApproved ? 'เสร็จสิ้น' : 'กำลังดำเนินการ');

  // SLA Calculation based on Document Type (By-law: 14d, Approval: 7d, Acknowledgment: 30d)
  const sla = RegSlaUtil.calculateSla(item.docType, receiveDate, approveDate, isApproved);

  return {
    ...dur,
    receiveDate,
    approveDate,
    isApproved,
    sla
  };
}

function getRegDocTypeBadge(docType) {
  const conf = RegSlaUtil.getDocTypeConfig(docType);
  return `<span class="case-type-badge ${conf.badgeClass}" title="${escapeHtml(conf.desc)}">${escapeHtml(conf.shortLabel || conf.id)}</span>`;
}

function setRegFilter(filterKey, value) {
  if (filterKey === 'step') AppState.regFilterStep = value;
  if (filterKey === 'docType') AppState.regFilterDocType = value;
  if (filterKey === 'status') AppState.regFilterStatus = value;
  if (filterKey === 'type') AppState.regFilterCoopType = value;
  if (filterKey === 'group') AppState.regFilterGroup = value;
  applyRegFilters();
}

function resetRegFilters() {
  AppState.regFilterStep = 'ALL';
  AppState.regFilterDocType = 'ALL';
  AppState.regFilterStatus = 'ALL';
  AppState.regFilterCoopType = 'ALL';
  AppState.regFilterGroup = 'ALL';
  AppState.regSearchTerm = '';
  const searchInput = document.getElementById('regSearchInput');
  if (searchInput) searchInput.value = '';
  applyRegFilters();
}

function updateRegFilterChipUI() {
  document.querySelectorAll('[data-reg-group]').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.regGroup === AppState.regFilterGroup);
  });
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
  if (AppState.regFilterGroup && AppState.regFilterGroup !== 'ALL') activeCount++;
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
  const approved = AppState.regulations.filter(r => r.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || r.status === 'รับจดทะเบียน/เห็นชอบแล้ว' || r.currentStep >= (CONFIG.REGULATION_STEPS?.length || 4)).length;
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
  const maxRegSteps = CONFIG.REGULATION_STEPS?.length || 4;
  container.innerHTML = items.map(item => {
    const isApproved = item.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || item.status === 'รับจดทะเบียน/เห็นชอบแล้ว' || item.currentStep >= maxRegSteps;
    const isNeedFix = item.status === 'ส่งคืนแก้ไข';
    const progressPercent = Math.min(100, Math.round((item.currentStep / maxRegSteps) * 100));
    const stepObj = CONFIG.REGULATION_STEPS.find(s => s.number === item.currentStep) || { title: `ขั้นตอนที่ ${item.currentStep}` };
    const isFarmerGroup = item.coopType && item.coopType.includes('กลุ่มเกษตรกร');
    const dur = getRegDuration(item);
    const sla = dur.sla;

    let statusBadgeClass = 'active';
    let statusText = '● อยู่ระหว่างพิจารณา';
    if (isApproved) {
      statusBadgeClass = 'completed';
      statusText = '✓ รับจดทะเบียนแล้ว';
    } else if (isNeedFix) {
      statusBadgeClass = 'issue';
      statusText = '⚠️ ส่งคืนแก้ไข';
    }

    const docTypeBadgeHtml = getRegDocTypeBadge(item.docType);

    return `
      <div class="case-card">
        <div class="case-card-header">
          <div class="case-badge-group">
            ${docTypeBadgeHtml}
            <span class="case-type-badge ${isFarmerGroup ? 'farmer-group' : 'coop-type-badge'}">${escapeHtml(item.coopType || 'สหกรณ์')}</span>
          </div>
          <span class="status-badge ${statusBadgeClass}">${statusText}</span>
        </div>

        <h3 class="case-title" style="font-size: 1.05rem; line-height: 1.4;">${escapeHtml(item.title)}</h3>
        <div style="font-size: 0.88rem; font-weight: 600; color: var(--primary); margin-bottom: 8px; display: flex; align-items: center; gap: 6px; flex-wrap: wrap;">
          <span>🏛️ ${escapeHtml(item.coopName)}</span>
          ${getGroupBadgeHtml(getResolvedGroup(item))}
        </div>

        <div class="case-meta">
          <div class="case-meta-item">
            <span>📄 เลขที่รับเรื่อง: ${escapeHtml(item.docNumber || '-')}</span>
          </div>
          <div class="case-meta-item">
            <span>📅 ลงรับ: ${formatThaiDate(item.receiveDate || item.submitDate)}</span>
          </div>
          ${item.regApproveDate ? `
            <div class="case-meta-item" style="color: #059669; font-weight: 500;">
              <span>✍️ รับจดทะเบียน/เห็นชอบ: ${formatThaiDate(item.regApproveDate)}</span>
            </div>
          ` : ''}
          ${sla && sla.hasData ? `
            <div class="case-meta-item" style="display: flex; justify-content: space-between; align-items: center; width: 100%; margin-top: 4px; padding-top: 4px; border-top: 1px dashed var(--border-color);">
              <span style="font-size: 0.78rem;">⏱️ SLA: <strong>${sla.slaDays} วัน</strong></span>
              <span class="sla-badge ${sla.badgeClass}">${sla.badgeText}</span>
            </div>
          ` : ''}
        </div>

        <div class="case-progress-wrap">
          <div class="progress-header">
            <span class="step-name">ขั้นที่ ${item.currentStep}/${maxRegSteps}: ${escapeHtml(stepObj.title)}</span>
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
            ${dur.hasData ? `ใช้ไป ${dur.workingDays} วันทำการ` : `อัพเดต: ${formatThaiDate(item.lastUpdated)}`}
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

  const maxRegSteps = CONFIG.REGULATION_STEPS?.length || 4;
  tbody.innerHTML = items.map((item, idx) => {
    const isApproved = item.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || item.status === 'รับจดทะเบียน/เห็นชอบแล้ว' || item.currentStep >= maxRegSteps;
    const isNeedFix = item.status === 'ส่งคืนแก้ไข';
    const progressPercent = Math.min(100, Math.round((item.currentStep / maxRegSteps) * 100));
    const isFarmerGroup = item.coopType && item.coopType.includes('กลุ่มเกษตรกร');
    const dur = getRegDuration(item);
    const sla = dur.sla;

    let statusBadgeClass = 'active';
    let statusText = 'อยู่ระหว่างพิจารณา';
    if (isApproved) {
      statusBadgeClass = 'completed';
      statusText = 'รับจดทะเบียน/เห็นชอบ/รับทราบ';
    } else if (isNeedFix) {
      statusBadgeClass = 'issue';
      statusText = 'ส่งคืนแก้ไข';
    }

    const docTypeBadgeHtml = getRegDocTypeBadge(item.docType);

    return `
      <tr>
        <td style="text-align: center; color: var(--text-muted);">${startIndex + idx + 1}</td>
        <td>
          <strong style="color: var(--primary);">${escapeHtml(item.coopName)}</strong>
          <div style="font-size: 0.8rem; color: var(--text-muted); display: flex; align-items: center; gap: 4px; flex-wrap: wrap; margin-top: 2px;">
            <span>${escapeHtml(item.regNumber)}</span>
            <span>|</span>
            <span class="case-type-badge ${isFarmerGroup ? 'farmer-group' : 'coop-type-badge'}" style="font-size: 0.7rem;">${escapeHtml(item.coopType || 'สหกรณ์')}</span>
            ${getGroupBadgeHtml(getResolvedGroup(item))}
          </div>
        </td>
        <td>
          ${docTypeBadgeHtml}
          ${sla && sla.hasData ? `<div style="margin-top: 4px;"><span class="sla-badge ${sla.badgeClass}">${sla.badgeText}</span></div>` : ''}
        </td>
        <td>
          <div style="font-weight: 500; font-size: 0.9rem;">${escapeHtml(item.title)}</div>
        </td>
        <td>
          <div>${escapeHtml(item.docNumber || '-')}</div>
          <div style="font-size: 0.78rem; color: var(--text-muted);">${formatThaiDate(item.receiveDate || item.submitDate)}</div>
        </td>
        <td>
          <div style="font-size: 0.85rem; font-weight: 500;">ขั้นที่ ${item.currentStep}/${maxRegSteps} (${progressPercent}%)</div>
          <div class="progress-bar-bg" style="height: 6px; width: 90px; margin-top: 4px;">
            <div class="progress-bar-fill" style="width: ${progressPercent}%; background: #0d9488;"></div>
          </div>
          ${dur.hasData ? `<div style="font-size: 0.74rem; color: #0369a1; margin-top: 2px;">${dur.workingDays} วันทำการ</div>` : ''}
        </td>
        <td>${escapeHtml(item.officerName || '-')}</td>
        <td>
          <span class="status-badge ${statusBadgeClass}">
            ${statusText}
          </span>
        </td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-outline-primary btn-sm" onclick="quickExportRegPdf('${item.regId}')" title="ส่งออกข้อมูลระเบียบ/ข้อบังคับนี้เป็น PDF" style="padding: 4px 8px; margin-right: 4px;">
            📄 PDF
          </button>
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

    const dur = getRegDuration(regData);
    const sla = dur.sla;

    document.getElementById('detailRegTitle').innerText = regData.title;
    document.getElementById('detailRegCoopName').innerText = `🏛️ ${regData.coopName} (${regData.regNumber || '-'}) [${regData.coopType || 'สหกรณ์'}]`;

    const regGroup = getResolvedGroup(regData);
    const groupBadgeEl = document.getElementById('detailRegPromotionGroupBadge');
    if (groupBadgeEl) {
      if (regGroup) {
        groupBadgeEl.style.display = 'inline-flex';
        groupBadgeEl.className = `group-badge ${getGroupBadgeClass(regGroup)}`;
        groupBadgeEl.innerText = regGroup;
      } else {
        groupBadgeEl.style.display = 'none';
      }
    }

    const docTypeBadge = document.getElementById('detailRegDocType');
    const docConf = RegSlaUtil.getDocTypeConfig(regData.docType);
    docTypeBadge.innerText = docConf.label || regData.docType;
    docTypeBadge.className = `case-type-badge ${docConf.badgeClass}`;

    const maxRegSteps = CONFIG.REGULATION_STEPS?.length || 4;
    document.getElementById('detailRegDocNumber').innerText = regData.docNumber || '-';
    const isApproved = regData.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || regData.status === 'รับจดทะเบียน/เห็นชอบแล้ว' || regData.currentStep >= maxRegSteps;
    const subDur = WorkingDaysUtil.calculate(regData.receiveDate || regData.submitDate, isApproved ? (regData.regApproveDate || regData.lastUpdated) : null, regData.status);
    document.getElementById('detailRegSubmitDate').innerHTML = formatThaiDate(regData.receiveDate || regData.submitDate) + (subDur.hasData ? ` <span style="font-size: 0.8rem; font-weight: normal; color: var(--text-muted);" title="${escapeHtml(subDur.tooltip)}">(${subDur.workingDays} วันทำการ)</span>` : '');
    document.getElementById('detailRegOfficer').innerText = regData.officerName || '-';
    document.getElementById('detailRegContact').innerText = regData.officerContact || '-';
    const statusBadge = document.getElementById('detailRegStatusBadge');
    if (isApproved) {
      statusBadge.className = 'status-badge completed';
      statusBadge.innerText = '✓ รับจดทะเบียน / เห็นชอบ / รับทราบแล้ว';
    } else if (regData.status === 'ส่งคืนแก้ไข') {
      statusBadge.className = 'status-badge issue';
      statusBadge.innerText = '⚠️ ส่งคืนแก้ไขปรับปรุง';
    } else {
      statusBadge.className = 'status-badge active';
      statusBadge.innerText = `● อยู่ระหว่างพิจารณา (ขั้นที่ ${regData.currentStep}/${maxRegSteps})`;
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

  const s1 = regData.steps?.find(s => parseInt(s.stepNumber, 10) === 1);
  const s2 = regData.steps?.find(s => parseInt(s.stepNumber, 10) === 2);
  const s3 = regData.steps?.find(s => parseInt(s.stepNumber, 10) === 3);
  const s4 = regData.steps?.find(s => parseInt(s.stepNumber, 10) === 4);

  const receiveDate = regData.receiveDate || s1?.startDate || regData.submitDate;
  const groupExitDate = regData.groupExitDate || s2?.endDate || '';
  const regApproveDate = regData.regApproveDate || s3?.endDate || '';
  const dispatchDate = regData.dispatchDate || s4?.endDate || '';
  const isApproved = !!regApproveDate || regData.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || regData.status === 'รับจดทะเบียน/เห็นชอบแล้ว';

  // SLA Timer stops at Step 3 (regApproveDate)!
  const totalDur = WorkingDaysUtil.calculate(receiveDate, isApproved ? regApproveDate : null, isApproved ? 'เสร็จสิ้น' : 'กำลังดำเนินการ');
  const totalWorkingDays = totalDur.hasData ? totalDur.workingDays : 0;

  // Step 2 duration: from receiveDate to groupExitDate
  const durStep2 = WorkingDaysUtil.calculate(receiveDate, groupExitDate, s2?.status);

  // Step 3 duration: from groupExitDate to regApproveDate
  const durStep3 = WorkingDaysUtil.calculate(groupExitDate, regApproveDate, s3?.status);

  // SLA Calculation based on Document Type (By-law: 14d, Approval: 7d, Acknowledgment: 30d)
  const sla = RegSlaUtil.calculateSla(regData.docType, receiveDate, regApproveDate, isApproved);

  const completedCount = regData.steps.filter(s => s.status === 'เสร็จสิ้น').length;
  const totalCount = regData.steps.length;
  const progressPercent = Math.round((completedCount / totalCount) * 100);
  const currentStepObj = regData.steps.find(s => parseInt(s.stepNumber, 10) === parseInt(regData.currentStep, 10)) || {};

  const summaryHtml = `
    <div class="timeline-summary-card reg-theme">
      <div class="timeline-summary-header">
        <div class="summary-title-wrap">
          <span class="summary-icon">⏱️</span>
          <div>
            <div style="display: flex; align-items: center; gap: 8px; flex-wrap: wrap;">
              <span class="summary-title">สรุปภาพรวมระยะเวลาพิจารณา (นับถึงขั้นตอนที่ 3)</span>
              ${sla && sla.hasData ? `<span class="sla-badge ${sla.badgeClass}" style="font-size: 0.8rem;">${sla.badgeText}</span>` : ''}
            </div>
            <div class="summary-subtitle">
              ${escapeHtml(sla.conf.desc)}
            </div>
          </div>
        </div>
        <div class="summary-total-badge reg-badge">
          <span class="total-label">รวมระยะเวลาพิจารณา:</span>
          <span class="total-number">${totalWorkingDays}</span>
          <span class="total-unit">วันทำการ</span>
        </div>
      </div>

      <!-- SLA Progress & Due Date Banner -->
      ${sla && sla.hasData ? `
        <div style="background: rgba(255, 255, 255, 0.7); border-radius: 8px; padding: 10px 14px; margin-bottom: 14px; border: 1px solid rgba(0, 0, 0, 0.05); display: flex; justify-content: space-between; align-items: center; flex-wrap: wrap; gap: 10px;">
          <div style="display: flex; align-items: center; gap: 8px;">
            <span style="font-size: 1.1rem;">⚖️</span>
            <div>
              <div style="font-size: 0.82rem; font-weight: 600; color: var(--primary);">
                กรอบเวลากำหนด: <strong>${sla.slaDays} วัน</strong> (${escapeHtml(sla.conf.actionWord)}) • ใช้ไปแล้ว ${sla.daysUsed} วัน
              </div>
              <div style="font-size: 0.76rem; color: var(--text-muted);">
                วันที่ฝ่ายลงรับ: ${formatThaiDate(receiveDate)} ➔ ครบกำหนด: <strong>${formatThaiDate(sla.dueDate)}</strong>
              </div>
            </div>
          </div>
          <div>
            <span class="case-type-badge ${sla.conf.badgeClass}" style="font-size: 0.8rem; padding: 4px 10px;">
              ${escapeHtml(sla.conf.label)}
            </span>
          </div>
        </div>
      ` : ''}

      <div class="timeline-summary-grid">
        <div class="summary-grid-item">
          <span class="item-label">📥 1. วันที่ฝ่ายลงรับหนังสือ</span>
          <strong class="item-val">${receiveDate ? formatThaiDate(receiveDate) : 'ยังไม่ระบุ'}</strong>
        </div>
        <div class="summary-grid-item">
          <span class="item-label">📤 2. วันที่ออกจากกลุ่มจัดตั้ง</span>
          <strong class="item-val">${groupExitDate ? formatThaiDate(groupExitDate) + (durStep2.hasData ? ` (${durStep2.workingDays} วันทำการ)` : '') : 'อยู่ระหว่างตรวจสอบ'}</strong>
        </div>
        <div class="summary-grid-item">
          <span class="item-label">✍️ 3. วันที่นายทะเบียนรับจดทะเบียน/เห็นชอบ</span>
          <strong class="item-val" style="color: ${regApproveDate ? '#059669' : 'inherit'};">${regApproveDate ? formatThaiDate(regApproveDate) + (durStep3.hasData ? ` (${durStep3.workingDays} วันทำการ)` : '') : 'อยู่ระหว่างเสนอพิจารณา'}</strong>
        </div>
        <div class="summary-grid-item">
          <span class="item-label">📦 4. การส่งมอบเอกสาร</span>
          <strong class="item-val">${s4?.status === 'เสร็จสิ้น' ? '✓ ส่งให้สหกรณ์แล้ว' : 'รอดำเนินการส่งมอบ'}</strong>
        </div>
      </div>
    </div>
    ${AppState.currentUser ? `
      <div style="display: flex; justify-content: flex-end; margin-bottom: 1rem;">
        <button class="btn btn-primary btn-sm" onclick="openUpdateRegMilestonesModal()" style="display: flex; align-items: center; gap: 6px; font-weight: 600;">
          📅 บันทึกวันสำคัญ 3 ขั้นตอน / ปรับปรุงสถานะ
        </button>
      </div>
    ` : ''}
  `;

  const stepsHtml = regData.steps.map((step, idx) => {
    let dur = { hasData: false, workingDays: 0 };
    if (step.stepNumber === 1) {
      dur = WorkingDaysUtil.calculate(step.startDate, step.endDate, step.status);
    } else if (step.stepNumber === 2) {
      dur = durStep2;
    } else if (step.stepNumber === 3) {
      dur = durStep3;
    } else if (step.stepNumber === 4) {
      dur = WorkingDaysUtil.calculate(step.startDate, step.endDate, step.status);
    }

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
                <button class="btn btn-secondary btn-sm" onclick="openUpdateRegMilestonesModal()" title="บันทึกวันสำคัญของขั้นตอนนี้">
                  ✏️ แก้ไข
                </button>
              ` : ''}
            </div>
          </div>

          <div class="stepper-dates">
            ${step.stepNumber === 1 ? `
              <span class="date-item">📥 วันที่ฝ่ายลงรับ: <strong>${step.startDate ? formatThaiDate(step.startDate) : '-'}</strong></span>
            ` : step.stepNumber === 2 ? `
              <span class="date-item">📅 วันที่เข้ากลุ่ม: <strong>${step.startDate ? formatThaiDate(step.startDate) : '-'}</strong></span>
              <span class="date-sep">|</span>
              <span class="date-item">📤 วันที่ออกจากกลุ่ม: <strong>${step.endDate ? formatThaiDate(step.endDate) : 'อยู่ระหว่างตรวจ'}</strong></span>
            ` : step.stepNumber === 3 ? `
              <span class="date-item">📅 วันที่เสนอ: <strong>${step.startDate ? formatThaiDate(step.startDate) : '-'}</strong></span>
              <span class="date-sep">|</span>
              <span class="date-item">✍️ วันที่รับจดทะเบียน: <strong>${step.endDate ? formatThaiDate(step.endDate) : 'อยู่ระหว่างพิจารณา'}</strong></span>
            ` : `
              <span class="date-item">📦 สถานะส่งมอบ: <strong>${isCompleted ? (step.endDate ? 'ส่งแล้วเมื่อ ' + formatThaiDate(step.endDate) : 'ส่งมอบเรียบร้อย') : 'รอดำเนินการส่งมอบ'}</strong></span>
            `}
            ${dur.hasData ? `
              <span class="date-sep">|</span>
              <span class="stepper-duration-tag ${dur.isOngoing ? 'ongoing' : isCompleted ? 'done' : ''}" title="${escapeHtml(dur.tooltip)}">
                ⏱️ ระยะเวลา: <strong>${dur.workingDays} วันทำการ</strong>${dur.isOngoing ? ' <span class="badge-subtext">(กำลังดำเนินการ)</span>' : ''}
              </span>
            ` : ''}
            ${step.stepNumber === 3 && isCompleted ? `
              <span class="badge" style="background: #dcfce7; color: #166534; font-size: 0.72rem; padding: 2px 8px; border-radius: 4px; font-weight: 600;">🏁 สิ้นสุดการนับระยะเวลา</span>
            ` : ''}
            ${step.stepNumber === 4 ? `
              <span style="font-size: 0.72rem; color: var(--text-muted);">(ไม่นำมานับในระยะเวลาพิจารณา)</span>
            ` : ''}
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

  container.innerHTML = summaryHtml + `<div class="stepper-list-wrap">` + stepsHtml + `</div>`;
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

function renderRegulationRowHtml(num, hasRemoveBtn = false) {
  return `
    <div class="reg-input-row" style="background: #f8fafc; border: 1px solid var(--border-color); border-radius: var(--radius-md); padding: 12px; margin-bottom: 8px;">
      <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 8px;">
        <span class="reg-row-title" style="font-weight: 600; font-size: 0.85rem; color: var(--primary);">📜 รายการระเบียบ / ข้อบังคับที่ ${num}</span>
        ${hasRemoveBtn ? `
          <button type="button" class="btn btn-danger btn-sm" onclick="removeRegulationRow(this)" style="padding: 2px 8px; font-size: 0.75rem;">
            ✕ ลบออก
          </button>
        ` : ''}
      </div>

      <div class="form-row" style="margin-bottom: 8px;">
        <div class="form-group" style="margin-bottom: 0; flex: 1;">
          <label style="font-size: 0.82rem;">ประเภทรายการ <span style="color: red;">*</span></label>
          <select name="itemDocCategory" class="form-control" onchange="onRegCategoryChange(this)" required>
            <option value="ระเบียบสหกรณ์" selected>📙 ระเบียบสหกรณ์</option>
            <option value="ข้อบังคับสหกรณ์">📘 ข้อบังคับสหกรณ์</option>
          </select>
        </div>

        <div class="form-group reg-sub-type-wrap" style="margin-bottom: 0; flex: 1.2;">
          <label style="font-size: 0.82rem;">ลักษณะระเบียบ / กำหนดเวลา <span style="color: red;">*</span></label>
          <select name="itemDocSubType" class="form-control" style="font-weight: 500;">
            <option value="ระเบียบสหกรณ์ (รับทราบ)" selected>📙 ระเบียบรับทราบ (กำหนด 30 วัน)</option>
            <option value="ระเบียบสหกรณ์ (เห็นชอบ)">📗 ระเบียบเห็นชอบ (กำหนด 7 วัน)</option>
          </select>
        </div>

        <div class="form-group reg-bylaw-hint" style="margin-bottom: 0; flex: 1.2; display: none;">
          <label style="font-size: 0.82rem;">กรอบเวลาพิจารณา (SLA)</label>
          <div style="padding: 8px 12px; background: #e0f2fe; border: 1px solid #bae6fd; border-radius: 6px; color: #0369a1; font-size: 0.82rem; font-weight: 600;">
            ⏱️ ข้อบังคับกำหนดรับจดทะเบียนใน 14 วัน
          </div>
        </div>

        <div class="form-group" style="margin-bottom: 0; flex: 1.1;">
          <label style="font-size: 0.82rem;">ขั้นตอนเริ่มต้น <span style="color: red;">*</span></label>
          <select name="itemStep" class="form-control" style="font-weight: 500;" required>
            <option value="1" selected>🟡 ขั้นที่ 1: ฝ่ายบริหารลงรับ</option>
            <option value="2">🟡 ขั้นที่ 2: กลุ่มจัดตั้งฯตรวจ</option>
            <option value="3">🟡 ขั้นที่ 3: เสนอนายทะเบียน</option>
            <option value="4">🟢 ขั้นที่ 4: ส่งเอกสาร (เสร็จ)</option>
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

function onRegCategoryChange(selectEl) {
  const row = selectEl.closest('.reg-input-row');
  if (!row) return;
  const isRule = selectEl.value === 'ระเบียบสหกรณ์';
  const subWrap = row.querySelector('.reg-sub-type-wrap');
  const bLawHint = row.querySelector('.reg-bylaw-hint');
  if (subWrap) subWrap.style.display = isRule ? 'block' : 'none';
  if (bLawHint) bLawHint.style.display = isRule ? 'none' : 'block';
}

function onEditRegCategoryChange() {
  const mainCatEl = document.getElementById('editRegMainCategory');
  if (!mainCatEl) return;
  const isRule = mainCatEl.value === 'ระเบียบสหกรณ์';
  const subWrap = document.getElementById('editRegSubTypeWrap');
  const bLawHint = document.getElementById('editRegBylawHint');
  if (subWrap) subWrap.style.display = isRule ? 'block' : 'none';
  if (bLawHint) bLawHint.style.display = isRule ? 'none' : 'block';
}

function resetCreateRegItems() {
  const container = document.getElementById('createRegItemsList');
  if (!container) return;
  container.innerHTML = renderRegulationRowHtml(1, false);
}

function addRegulationRowToCreateForm() {
  const container = document.getElementById('createRegItemsList');
  if (!container) return;
  const currentCount = container.querySelectorAll('.reg-input-row').length;
  const nextNum = currentCount + 1;

  const wrapper = document.createElement('div');
  wrapper.innerHTML = renderRegulationRowHtml(nextNum, true);
  const newRow = wrapper.firstElementChild;
  if (newRow) {
    newRow.style.animation = 'fadeIn 0.2s ease-in';
    container.appendChild(newRow);
  }
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
    const catSelect = row.querySelector('select[name="itemDocCategory"]');
    const subSelect = row.querySelector('select[name="itemDocSubType"]');
    const legacyTypeSelect = row.querySelector('select[name="itemDocType"]');
    const stepSelect = row.querySelector('select[name="itemStep"]');
    const titleInput = row.querySelector('input[name="itemTitle"]');

    let resolvedDocType = 'ข้อบังคับสหกรณ์';
    if (catSelect) {
      if (catSelect.value === 'ระเบียบสหกรณ์') {
        resolvedDocType = subSelect ? subSelect.value : 'ระเบียบสหกรณ์ (รับทราบ)';
      } else {
        resolvedDocType = 'ข้อบังคับสหกรณ์';
      }
    } else if (legacyTypeSelect) {
      resolvedDocType = legacyTypeSelect.value;
    }

    if (titleInput && titleInput.value.trim() !== '') {
      items.push({
        docType: resolvedDocType,
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
    regNumber: form.regNumber ? form.regNumber.value.trim() : '',
    coopType: form.coopType ? form.coopType.value : 'สหกรณ์การเกษตร',
    promotionGroup: form.promotionGroup ? form.promotionGroup.value : '',
    docNumber: form.docNumber ? form.docNumber.value.trim() : '',
    submitDate: fromThaiDateInput(form.submitDate.value),
    officerName: form.officerName ? form.officerName.value.trim() : '',
    officerContact: form.officerContact ? form.officerContact.value.trim() : '',
    note: form.note ? form.note.value.trim() : '',
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

function openUpdateRegMilestonesModal() {
  const regData = AppState.selectedReg;
  if (!regData) return;

  const regIdInput = document.getElementById('updateRegMilestonesRegId');
  if (regIdInput) regIdInput.value = regData.regId || '';

  const subTitle = document.getElementById('updateRegMilestonesSub');
  if (subTitle) {
    subTitle.innerText = `${regData.coopName || ''} • ${regData.title || ''}`;
  }

  // 1. วันที่ฝ่ายบริหารลงรับหนังสือ
  const recInput = document.getElementById('regMilestoneReceiveDate');
  if (recInput) {
    recInput.value = toThaiDateInput(regData.receiveDate || regData.submitDate || '');
  }

  // 2. วันที่หนังสือออกจากกลุ่มจัดตั้ง
  const exitInput = document.getElementById('regMilestoneGroupExitDate');
  if (exitInput) {
    exitInput.value = toThaiDateInput(regData.groupExitDate || '');
  }

  // 3. วันที่นายทะเบียนรับจดทะเบียน (จุดสิ้นสุดการนับวันทำการ)
  const appInput = document.getElementById('regMilestoneApproveDate');
  if (appInput) {
    appInput.value = toThaiDateInput(regData.approveDate || regData.regApproveDate || '');
  }

  // 4. การส่งเอกสารให้สหกรณ์
  const dispCheck = document.getElementById('regMilestoneDocDispatched');
  const dispDateInput = document.getElementById('regMilestoneDispatchDate');
  const isDispatched = !!(regData.dispatchDate || (regData.steps && regData.steps.some(s => parseInt(s.stepNumber, 10) === 4 && s.status === 'เสร็จสิ้น')));
  if (dispCheck) {
    dispCheck.checked = isDispatched;
  }
  if (dispDateInput) {
    dispDateInput.value = toThaiDateInput(regData.dispatchDate || '');
  }

  // ข้อสังเกต / จุดที่ต้องแก้ไข
  const issueInput = document.getElementById('regMilestoneIssue');
  if (issueInput) {
    let issueVal = regData.issue || '';
    if (!issueVal && Array.isArray(regData.steps)) {
      const s3 = regData.steps.find(s => parseInt(s.stepNumber, 10) === 3);
      const s2 = regData.steps.find(s => parseInt(s.stepNumber, 10) === 2);
      issueVal = (s3 && s3.issue) || (s2 && s2.issue) || '';
    }
    issueInput.value = issueVal;
  }

  // หมายเหตุ
  const noteInput = document.getElementById('regMilestoneNote');
  if (noteInput) {
    noteInput.value = regData.note || '';
  }

  openModal('updateRegMilestonesModal');
}

function openUpdateRegStepModal(stepNumber) {
  openUpdateRegMilestonesModal();
}

async function handleUpdateRegMilestonesSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const regId = form.regId ? form.regId.value : (AppState.selectedReg ? AppState.selectedReg.regId : null);
  if (!regId) {
    showToast('ไม่พบรหัสระเบียบ/ข้อบังคับ', 'error');
    return;
  }

  const payload = {
    regId: regId,
    receiveDate: fromThaiDateInput(form.receiveDate ? form.receiveDate.value : ''),
    groupExitDate: fromThaiDateInput(form.groupExitDate ? form.groupExitDate.value : ''),
    regApproveDate: fromThaiDateInput(form.regApproveDate ? form.regApproveDate.value : ''),
    docDispatched: form.docDispatched ? form.docDispatched.checked : false,
    dispatchDate: fromThaiDateInput(form.dispatchDate ? form.dispatchDate.value : ''),
    issue: form.issue ? form.issue.value.trim() : '',
    note: form.note ? form.note.value.trim() : ''
  };

  setLoading(true);
  try {
    await ApiClient.post('updateRegMilestones', payload);
    showToast('บันทึกวันสำคัญและอัพเดตขั้นตอนการพิจารณาเรียบร้อย', 'success');
    closeModal('updateRegMilestonesModal');
    await openRegDetail(regId);
    await loadRegulationsData();
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function handleUpdateRegStepSubmit(e) {
  return handleUpdateRegMilestonesSubmit(e);
}

function openEditRegInfoModal() {
  const regData = AppState.selectedReg;
  if (!regData) return;

  document.getElementById('editRegCoopName').value = regData.coopName || '';
  if (document.getElementById('editRegCoopType')) {
    document.getElementById('editRegCoopType').value = regData.coopType || 'สหกรณ์การเกษตร';
  }
  if (document.getElementById('editRegPromotionGroup')) {
    document.getElementById('editRegPromotionGroup').value = regData.promotionGroup || getResolvedGroup(regData) || '';
  }
  document.getElementById('editRegDocType').value = regData.docType || 'ข้อบังคับสหกรณ์';
  document.getElementById('editRegTitle').value = regData.title || '';
  document.getElementById('editRegDocNumber').value = regData.docNumber || '';
  document.getElementById('editRegSubmitDate').value = toThaiDateInput(regData.submitDate);
  if (document.getElementById('editRegOfficerContact')) {
    document.getElementById('editRegOfficerContact').value = regData.officerContact || '';
  }
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
    promotionGroup: form.promotionGroup ? form.promotionGroup.value : '',
    docType: form.docType.value,
    title: form.title.value.trim(),
    docNumber: form.docNumber.value.trim(),
    submitDate: fromThaiDateInput(form.submitDate.value),
    officerName: form.officerName.value.trim(),
    officerContact: form.officerContact ? form.officerContact.value.trim() : (regData.officerContact || ''),
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

  // If a detail modal is already open, re-render its content to show admin buttons
  const isCaseDetailOpen = document.getElementById('caseDetailModal')?.classList.contains('show');
  if (isCaseDetailOpen && AppState.selectedCase) {
    const adminActions = document.getElementById('detailAdminActions');
    const adminAddLiqBtn = document.getElementById('adminAddLiqBtn');
    if (adminActions) adminActions.style.display = 'flex';
    if (adminAddLiqBtn) adminAddLiqBtn.style.display = 'inline-flex';
    renderDetailTimeline();
    renderDetailLiquidators();
    renderDetailDocuments();
  }

  const isRegDetailOpen = document.getElementById('regDetailModal')?.classList.contains('show');
  if (isRegDetailOpen && AppState.selectedReg) {
    const adminActions = document.getElementById('detailRegAdminActions');
    if (adminActions) adminActions.style.display = 'flex';
    renderRegDetailTimeline();
    renderRegDetailDocuments();
  }

  renderCasesList();
  renderRegulationsList();
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

  // Close any admin-only modals that may be open
  const adminModals = [
    'createCaseModal', 'updateStepModal', 'addLiquidatorModal', 'editLiquidatorModal',
    'editCaseModal', 'uploadDocModal', 'createRegModal', 'updateRegStepModal', 'updateRegMilestonesModal',
    'editRegModal', 'uploadRegDocModal', 'auditLogModal', 'loginModal'
  ];
  adminModals.forEach(modalId => closeModal(modalId));

  // If a detail modal is currently open, re-render its content to hide admin buttons without re-opening
  const isCaseDetailOpen = document.getElementById('caseDetailModal')?.classList.contains('show');
  if (isCaseDetailOpen && AppState.selectedCase) {
    const adminActions = document.getElementById('detailAdminActions');
    const adminAddLiqBtn = document.getElementById('adminAddLiqBtn');
    if (adminActions) adminActions.style.display = 'none';
    if (adminAddLiqBtn) adminAddLiqBtn.style.display = 'none';
    renderDetailTimeline();
    renderDetailLiquidators();
    renderDetailDocuments();
  }

  const isRegDetailOpen = document.getElementById('regDetailModal')?.classList.contains('show');
  if (isRegDetailOpen && AppState.selectedReg) {
    const adminActions = document.getElementById('detailRegAdminActions');
    if (adminActions) adminActions.style.display = 'none';
    renderRegDetailTimeline();
    renderRegDetailDocuments();
  }

  renderCasesList();
  renderRegulationsList();
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
  document.getElementById('updateRegMilestonesForm')?.addEventListener('submit', handleUpdateRegMilestonesSubmit);
  document.getElementById('updateRegStepForm')?.addEventListener('submit', handleUpdateRegStepSubmit);
  document.getElementById('editRegForm')?.addEventListener('submit', handleEditRegSubmit);
  document.getElementById('uploadRegDocForm')?.addEventListener('submit', handleUploadRegDocSubmit);

  // Auto set dispatch date when checkbox is checked
  const milestoneDocDispatchedCheck = document.getElementById('regMilestoneDocDispatched');
  if (milestoneDocDispatchedCheck) {
    milestoneDocDispatchedCheck.addEventListener('change', (e) => {
      const dispatchInput = document.getElementById('regMilestoneDispatchDate');
      if (dispatchInput) {
        if (e.target.checked && !dispatchInput.value.trim()) {
          dispatchInput.value = todayThaiDate();
        }
      }
    });
  }

  setupDropzones();
  setupCooperativeAutocompletes();
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

/**
 * ==============================================================================
 * PDF Export & Official Report Engine
 * ==============================================================================
 */

// Format full Thai date and time for official report headers
function formatThaiDateTime(dateVal) {
  const date = dateVal ? new Date(dateVal) : new Date();
  if (isNaN(date.getTime())) return '-';
  const months = ['มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน', 'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม'];
  let year = date.getFullYear();
  if (year < 2400) year += 543;
  const hours = String(date.getHours()).padStart(2, '0');
  const minutes = String(date.getMinutes()).padStart(2, '0');
  return `${date.getDate()} ${months[date.getMonth()]} พ.ศ. ${year} เวลา ${hours}:${minutes} น.`;
}

// Helper: Safely check if a case item has issues (supports boolean, array of objects, or string)
function hasCaseIssues(item) {
  if (!item) return false;
  if (item.caseStatus === 'มีปัญหา') return true;
  if (item.hasIssues) return true;
  if (Array.isArray(item.issues) && item.issues.length > 0) return true;
  if (typeof item.issues === 'string' && item.issues.trim().length > 0) return true;
  return false;
}

// Helper: Safely extract issues text summary as string
function getIssuesSummaryText(item) {
  if (!item) return '';
  if (Array.isArray(item.issues)) {
    return item.issues.map(iss => {
      if (typeof iss === 'string') return iss;
      if (iss && iss.issue) return `ขั้นที่ ${iss.stepNumber || ''}: ${iss.issue}`;
      if (iss && iss.text) return iss.text;
      return JSON.stringify(iss);
    }).filter(Boolean).join(' | ');
  }
  if (typeof item.issues === 'string') return item.issues.trim();
  if (item.hasIssues) return 'มีปัญหาอุปสรรค';
  return '';
}

// Helper: Safely extract liquidators summary text
function getLiquidatorsSummaryText(item) {
  if (!item) return '-';
  if (Array.isArray(item.liquidators)) {
    const names = item.liquidators.map(l => (typeof l === 'string' ? l : (l?.name || ''))).filter(Boolean);
    if (names.length > 0) return names.join(', ');
  }
  if (Array.isArray(item.liquidatorsDetail)) {
    const names = item.liquidatorsDetail.map(l => l?.name || '').filter(Boolean);
    if (names.length > 0) return names.join(', ');
  }
  if (typeof item.liquidators === 'string' && item.liquidators.trim()) {
    return item.liquidators.trim();
  }
  if (typeof item.liquidatorName === 'string' && item.liquidatorName.trim()) {
    return item.liquidatorName.trim();
  }
  return '-';
}

// 1. Export Individual Liquidation Case PDF
function exportCurrentCasePdf() {
  const caseData = AppState.selectedCase;
  if (!caseData) {
    showToast('ไม่พบข้อมูลสหกรณ์ที่เลือกสำหรับการส่งออก PDF', 'warning');
    return;
  }

  const isDone = caseData.caseStatus === 'เสร็จสิ้น' || caseData.currentStep >= 10;
  const printDateStr = formatThaiDateTime(new Date());
  const dissolutionType = caseData.dissolutionType || (caseData.orderNumber && caseData.orderNumber.includes('ประกาศ') ? 'ประกาศเลิก' : 'คำสั่งเลิก');

  // Calculate working days summary
  let totalWorkingDays = 0;
  if (Array.isArray(caseData.steps)) {
    caseData.steps.forEach(step => {
      const dur = WorkingDaysUtil.calculate(step.startDate, step.endDate, step.status);
      if (dur.hasData && (step.status === 'เสร็จสิ้น' || step.status === 'กำลังดำเนินการ')) {
        totalWorkingDays += dur.workingDays;
      }
    });
  }

  // Steps rows
  const stepsRows = (caseData.steps || []).map((step, idx) => {
    const dur = WorkingDaysUtil.calculate(step.startDate, step.endDate, step.status);
    let badgeClass = 'report-badge-pending';
    let badgeText = 'รอดำเนินการ';
    if (step.status === 'เสร็จสิ้น') {
      badgeClass = 'report-badge-done';
      badgeText = '✓ เสร็จสิ้น';
    } else if (step.status === 'กำลังดำเนินการ') {
      badgeClass = 'report-badge-active';
      badgeText = '● กำลังดำเนินการ';
    }

    const issuesHtml = step.issues ? `<div style="color: #dc2626; font-size: 0.76rem; margin-top: 3px;"><strong>⚠️ ปัญหา:</strong> ${escapeHtml(step.issues)}</div>` : '';
    const notesHtml = step.notes ? `<div style="color: #475569; font-size: 0.76rem; margin-top: 2px;">${escapeHtml(step.notes)}</div>` : '';

    return `
      <tr>
        <td style="text-align: center; font-weight: 600;">${idx + 1}</td>
        <td>
          <div style="font-weight: 600; color: #0e3760;">${escapeHtml(step.stepTitle || CONFIG.LIQUIDATION_STEPS[idx]?.title || 'ขั้นตอนที่ ' + (idx + 1))}</div>
          <div style="font-size: 0.75rem; color: #64748b;">${escapeHtml(CONFIG.LIQUIDATION_STEPS[idx]?.desc || '')}</div>
        </td>
        <td style="text-align: center;">
          <span class="report-badge ${badgeClass}">${badgeText}</span>
        </td>
        <td style="font-size: 0.78rem;">
          <div><strong>เริ่ม:</strong> ${formatThaiDate(step.startDate)}</div>
          <div><strong>เสร็จ:</strong> ${formatThaiDate(step.endDate)}</div>
          ${dur.hasData ? `<div style="color: #0369a1; font-weight: 500;">(${dur.workingDays} วันทำการ)</div>` : ''}
        </td>
        <td style="font-size: 0.78rem;">
          <div>${escapeHtml(step.documentNumber || '-')}</div>
          ${notesHtml}
          ${issuesHtml}
        </td>
      </tr>
    `;
  }).join('');

  // Liquidators rows
  const liqList = Array.isArray(caseData.liquidatorsDetail) && caseData.liquidatorsDetail.length > 0
    ? caseData.liquidatorsDetail
    : (Array.isArray(caseData.liquidators) ? caseData.liquidators : []);

  const liqRows = liqList.length > 0 ? liqList.map((liq, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td style="font-weight: 600;">${escapeHtml(typeof liq === 'string' ? liq : (liq.name || '-'))}</td>
      <td>${escapeHtml((typeof liq === 'object' && liq.position) ? liq.position : 'ผู้ชำระบัญชี')}</td>
      <td>${(typeof liq === 'object' && liq.appointmentDate) ? formatThaiDate(liq.appointmentDate) : '-'}</td>
      <td>${(typeof liq === 'object' && liq.vacateDate) ? formatThaiDate(liq.vacateDate) : '-'}</td>
      <td>${escapeHtml((typeof liq === 'object' && liq.phone) ? liq.phone : '-')}</td>
      <td style="text-align: center;">
        <span class="report-badge ${(typeof liq === 'object' && liq.status === 'พ้นตำแหน่ง') ? 'report-badge-pending' : 'report-badge-done'}">
          ${escapeHtml((typeof liq === 'object' && liq.status) ? liq.status : 'ปฏิบัติหน้าที่')}
        </span>
      </td>
    </tr>
  `).join('') : (typeof caseData.liquidators === 'string' && caseData.liquidators.trim() ? `
    <tr>
      <td style="text-align: center;">1</td>
      <td style="font-weight: 600;">${escapeHtml(caseData.liquidators)}</td>
      <td>ผู้ชำระบัญชี</td>
      <td>${formatThaiDate(caseData.orderDate)}</td>
      <td>-</td>
      <td>-</td>
      <td style="text-align: center;"><span class="report-badge report-badge-done">ปฏิบัติหน้าที่</span></td>
    </tr>
  ` : `
    <tr>
      <td colspan="7" style="text-align: center; color: #94a3b8; padding: 12px;">ยังไม่มีข้อมูลการแต่งตั้งผู้ชำระบัญชี</td>
    </tr>
  `);

  // Documents list
  const docRows = (caseData.documents && caseData.documents.length > 0) ? caseData.documents.map((doc, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td style="font-weight: 500;">${escapeHtml(doc.fileName || 'เอกสารแนบ')}</td>
      <td style="text-align: center;">${doc.stepNumber ? 'ขั้นตอนที่ ' + doc.stepNumber : 'เอกสารทั่วไป'}</td>
      <td style="text-align: center;">${formatThaiDate(doc.uploadedDate)}</td>
    </tr>
  `).join('') : `
    <tr>
      <td colspan="4" style="text-align: center; color: #94a3b8; padding: 10px;">ไม่มีไฟล์เอกสารแนบในระบบ</td>
    </tr>
  `;

  const html = `
    <div class="report-header">
      <div class="report-brand-wrap">
        <div class="report-emblem">🏛️</div>
        <div class="report-header-text">
          <h2>กรมส่งเสริมสหกรณ์ กระทรวงเกษตรและสหกรณ์</h2>
          <p>ระบบติดตามการชำระบัญชีสหกรณ์ (Cooperative Liquidation Tracking System)</p>
        </div>
      </div>
      <div class="report-meta-box">
        <div><strong>วันที่พิมพ์รายงาน:</strong></div>
        <div>${printDateStr}</div>
      </div>
    </div>

    <div class="report-title-banner">
      <h3>รายงานข้อมูลและความคืบหน้าการชำระบัญชีสหกรณ์</h3>
      <div class="report-subtitle">${escapeHtml(caseData.coopName)} (${escapeHtml(caseData.coopType || '-')})</div>
    </div>

    <!-- Section 1: Basic Info -->
    <div class="report-section">
      <div class="report-section-header">
        <h4 class="report-section-title">1. ข้อมูลทั่วไปของสหกรณ์ / สถาบันเกษตรกร</h4>
      </div>
      <div class="report-info-grid">
        <div class="report-info-item">
          <span class="report-info-label">ชื่อสหกรณ์ / สถาบัน</span>
          <span class="report-info-value" style="color: #0e3760; font-size: 1rem;">${escapeHtml(caseData.coopName)}</span>
        </div>
        <div class="report-info-item">
          <span class="report-info-label">ประเภทสหกรณ์</span>
          <span class="report-info-value">${escapeHtml(caseData.coopType || '-')}</span>
        </div>
        <div class="report-info-item">
          <span class="report-info-label">เลขทะเบียนสหกรณ์</span>
          <span class="report-info-value">${escapeHtml(caseData.regNumber || '-')}</span>
        </div>
        <div class="report-info-item">
          <span class="report-info-label">ที่ตั้งสำนักงาน / อำเภอ / จังหวัด</span>
          <span class="report-info-value">${escapeHtml(caseData.location || '-')}</span>
        </div>
        <div class="report-info-item">
          <span class="report-info-label">${escapeHtml(dissolutionType)}เลขที่</span>
          <span class="report-info-value">${escapeHtml(caseData.orderNumber || '-')}</span>
        </div>
        <div class="report-info-item">
          <span class="report-info-label">วันที่ออก${escapeHtml(dissolutionType)}</span>
          <span class="report-info-value">${formatThaiDate(caseData.orderDate)}</span>
        </div>
        <div class="report-info-item">
          <span class="report-info-label">สถานะปัจจุบัน</span>
          <span class="report-info-value">
            <span class="report-badge ${isDone ? 'report-badge-done' : 'report-badge-active'}">
              ${isDone ? '✓ เสร็จสิ้นกระบวนการชำระบัญชี' : `● กำลังชำระบัญชี (ขั้นที่ ${caseData.currentStep || 1}/10)`}
            </span>
          </span>
        </div>
        <div class="report-info-item">
          <span class="report-info-label">ระยะเวลาดำเนินการรวม (วันทำการ)</span>
          <span class="report-info-value" style="color: #0e3760; font-weight: 700;">${totalWorkingDays} วันทำการ (ไม่รวมวันหยุดราชการ)</span>
        </div>
      </div>
    </div>

    <!-- Section 2: Liquidators -->
    <div class="report-section">
      <div class="report-section-header">
        <h4 class="report-section-title">2. รายนามผู้ชำระบัญชีและประวัติการแต่งตั้ง</h4>
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 40px;">ลำดับ</th>
            <th>ชื่อ - นามสกุล</th>
            <th>ตำแหน่ง</th>
            <th>วันที่แต่งตั้ง</th>
            <th>วันที่พ้นตำแหน่ง</th>
            <th>เบอร์ติดต่อ</th>
            <th style="width: 90px;">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          ${liqRows}
        </tbody>
      </table>
    </div>

    <!-- Section 3: 10 Steps Progress -->
    <div class="report-section">
      <div class="report-section-header">
        <h4 class="report-section-title">3. ผลการดำเนินงาน 10 ขั้นตอนการชำระบัญชีตามกฎหมาย</h4>
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 40px;">ขั้น</th>
            <th style="width: 32%;">ขั้นตอนการดำเนินงาน</th>
            <th style="width: 95px;">สถานะ</th>
            <th style="width: 140px;">ระยะเวลาดำเนินงาน</th>
            <th>เลขที่เอกสาร / รายละเอียดผลการดำเนินงาน</th>
          </tr>
        </thead>
        <tbody>
          ${stepsRows}
        </tbody>
      </table>
    </div>

    <!-- Section 4: Attached Documents -->
    <div class="report-section">
      <div class="report-section-header">
        <h4 class="report-section-title">4. รายการเอกสารหลักฐานแนบในระบบ</h4>
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 40px;">ลำดับ</th>
            <th>ชื่อไฟล์เอกสาร</th>
            <th style="width: 120px;">ขั้นตอนที่เกี่ยวข้อง</th>
            <th style="width: 120px;">วันที่บันทึกเข้าระบบ</th>
          </tr>
        </thead>
        <tbody>
          ${docRows}
        </tbody>
      </table>
    </div>

    <!-- Signatures -->
    <div class="report-signature-section">
      <div class="report-sig-box">
        <div>ลงชื่อ...................................................................ผู้รายงาน</div>
        <div class="report-sig-line"></div>
        <div>(...................................................................)</div>
        <div>ตำแหน่ง.............................................................</div>
        <div>วันที่.......เดือน.......................พ.ศ............</div>
      </div>
      <div class="report-sig-box">
        <div>ลงชื่อ...................................................................ผู้รับรอง</div>
        <div class="report-sig-line"></div>
        <div>(...................................................................)</div>
        <div>ตำแหน่ง นายทะเบียนสหกรณ์ / ผู้ตรวจการสหกรณ์</div>
        <div>วันที่.......เดือน.......................พ.ศ............</div>
      </div>
    </div>

    <div class="report-footer">
      <div>ระบบศูนย์บริการงานนายทะเบียนและส่งเสริมสหกรณ์ กรมส่งเสริมสหกรณ์</div>
      <div>พิมพ์เมื่อ ${printDateStr}</div>
    </div>
  `;

  const safeName = (caseData.coopName || 'สหกรณ์').replace(/[/\\?%*:|"<>]/g, '_');
  const filename = `รายงานชำระบัญชี_${safeName}.pdf`;

  openPdfPreview(html, filename, 'รายงานสรุปข้อมูลการชำระบัญชีสหกรณ์', caseData.coopName, 'portrait');
}

// 2. Export Individual Regulation / By-law PDF
function exportCurrentRegPdf() {
  const regData = AppState.selectedReg;
  if (!regData) {
    showToast('ไม่พบข้อมูลระเบียบ/ข้อบังคับสำหรับการส่งออก PDF', 'warning');
    return;
  }

  const maxRegSteps = CONFIG.REGULATION_STEPS?.length || 4;
  const isApproved = regData.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || regData.status === 'รับจดทะเบียน/เห็นชอบแล้ว' || regData.currentStep >= maxRegSteps;
  const printDateStr = formatThaiDateTime(new Date());

  // Calculate working days (SLA counts strictly up to Step 3: Registrar Approval)
  const regDur = getRegDuration(regData);
  const totalWorkingDays = regDur.hasData ? regDur.workingDays : 0;
  const regSla = regDur.sla;

  // Steps rows
  const stepsRows = (regData.steps || []).map((step, idx) => {
    const dur = WorkingDaysUtil.calculate(step.startDate, step.endDate, step.status);
    let badgeClass = 'report-badge-pending';
    let badgeText = 'รอดำเนินการ';
    if (step.status === 'เสร็จสิ้น') {
      badgeClass = 'report-badge-done';
      badgeText = '✓ เสร็จสิ้น';
    } else if (step.status === 'กำลังดำเนินการ') {
      badgeClass = 'report-badge-active';
      badgeText = '● กำลังดำเนินการ';
    } else if (step.status === 'ส่งคืนแก้ไข') {
      badgeClass = 'report-badge-issue';
      badgeText = '⚠️ ส่งคืนแก้ไข';
    }

    const notesHtml = step.notes ? `<div style="color: #475569; font-size: 0.76rem; margin-top: 2px;">${escapeHtml(step.notes)}</div>` : '';

    return `
      <tr>
        <td style="text-align: center; font-weight: 600;">${idx + 1}</td>
        <td>
          <div style="font-weight: 600; color: #0e3760;">${escapeHtml(step.stepTitle || CONFIG.REGULATION_STEPS[idx]?.title || 'ขั้นตอนที่ ' + (idx + 1))}</div>
          <div style="font-size: 0.75rem; color: #64748b;">${escapeHtml(CONFIG.REGULATION_STEPS[idx]?.desc || '')}</div>
        </td>
        <td style="text-align: center;">
          <span class="report-badge ${badgeClass}">${badgeText}</span>
        </td>
        <td style="font-size: 0.78rem;">
          <div><strong>เริ่ม:</strong> ${formatThaiDate(step.startDate)}</div>
          <div><strong>เสร็จ:</strong> ${formatThaiDate(step.endDate)}</div>
          ${dur.hasData ? `<div style="color: #0369a1; font-weight: 500;">(${dur.workingDays} วันทำการ)</div>` : ''}
        </td>
        <td style="font-size: 0.78rem;">
          <div>${escapeHtml(step.documentNumber || '-')}</div>
          ${notesHtml}
        </td>
      </tr>
    `;
  }).join('');

  // Documents list
  const docRows = (regData.documents && regData.documents.length > 0) ? regData.documents.map((doc, idx) => `
    <tr>
      <td style="text-align: center;">${idx + 1}</td>
      <td style="font-weight: 500;">${escapeHtml(doc.fileName || 'เอกสารร่าง/มติ')}</td>
      <td style="text-align: center;">${doc.stepNumber ? 'ขั้นตอนที่ ' + doc.stepNumber : 'เอกสารทั่วไป'}</td>
      <td style="text-align: center;">${formatThaiDate(doc.uploadedDate)}</td>
    </tr>
  `).join('') : `
    <tr>
      <td colspan="4" style="text-align: center; color: #94a3b8; padding: 10px;">ไม่มีไฟล์เอกสารแนบในระบบ</td>
    </tr>
  `;

  const html = `
    <div class="report-header">
      <div class="report-brand-wrap">
        <div class="report-emblem">📜</div>
        <div class="report-header-text">
          <h2>กรมส่งเสริมสหกรณ์ กระทรวงเกษตรและสหกรณ์</h2>
          <p>ระบบติดตามการพิจารณาระเบียบและข้อบังคับสหกรณ์</p>
        </div>
      </div>
      <div class="report-meta-box">
        <div><strong>วันที่พิมพ์รายงาน:</strong></div>
        <div>${printDateStr}</div>
      </div>
    </div>

    <div class="report-title-banner">
      <h3>รายงานผลการพิจารณาระเบียบและข้อบังคับสหกรณ์</h3>
      <div class="report-subtitle">${escapeHtml(regData.title)} - ${escapeHtml(regData.coopName)}</div>
    </div>

    <!-- Section 1: Basic Info -->
    <div class="report-section">
      <div class="report-section-header">
        <h4 class="report-section-title">1. ข้อมูลระเบียบ / ข้อบังคับ และสหกรณ์ที่ยื่นคำขอ</h4>
      </div>
      <div class="report-info-grid">
        <div class="report-info-item">
          <span class="report-info-label">ชื่อเรื่อง ระเบียบ / ข้อบังคับ</span>
          <span class="report-info-value" style="color: #0e3760; font-size: 1rem;">${escapeHtml(regData.title)}</span>
        </div>
        <div class="report-info-item">
          <span class="report-info-label">ประเภทเอกสาร</span>
          <span class="report-info-value">${escapeHtml((regSla && regSla.conf && regSla.conf.label) || regData.docType || 'ข้อบังคับสหกรณ์')}</span>
        </div>
        <div class="report-info-item">
          <span class="report-info-label">สหกรณ์ / สถาบันเกษตรกร</span>
          <span class="report-info-value">${escapeHtml(regData.coopName)} (${escapeHtml(regData.regNumber || '-')})</span>
        </div>
        <div class="report-info-item">
          <span class="report-info-label">ประเภทสหกรณ์</span>
          <span class="report-info-value">${escapeHtml(regData.coopType || '-')}</span>
        </div>
        <div class="report-info-item">
          <span class="report-info-label">เลขที่รับเรื่องคำขอ</span>
          <span class="report-info-value">${escapeHtml(regData.docNumber || '-')}</span>
        </div>
        <div class="report-info-item">
          <span class="report-info-label">วันที่ฝ่ายลงรับหนังสือ</span>
          <span class="report-info-value">${formatThaiDate(regData.receiveDate || regData.submitDate)}</span>
        </div>
        <div class="report-info-item">
          <span class="report-info-label">เจ้าหน้าที่ผู้รับผิดชอบ</span>
          <span class="report-info-value">${escapeHtml(regData.officerName || '-')} ${regData.officerContact ? '(' + escapeHtml(regData.officerContact) + ')' : ''}</span>
        </div>
        <div class="report-info-item">
          <span class="report-info-label">สถานะการพิจารณา</span>
          <span class="report-info-value">
            <span class="report-badge ${isApproved ? 'report-badge-done' : (regData.status === 'ส่งคืนแก้ไข' ? 'report-badge-issue' : 'report-badge-active')}">
              ${escapeHtml(regData.status || 'อยู่ระหว่างพิจารณา')}
            </span>
          </span>
        </div>
        <div class="report-info-item">
          <span class="report-info-label">กรอบเวลากำหนดตามระเบียบ/กฎหมาย (SLA)</span>
          <span class="report-info-value" style="color: #0e3760; font-weight: 600;">
            ${regSla && regSla.hasData ? `${regSla.slaDays} วัน (${escapeHtml(regSla.conf.actionWord)}) • ${regSla.badgeText} (ครบกำหนด: ${formatThaiDate(regSla.dueDate)})` : '-'}
          </span>
        </div>
        <div class="report-info-item">
          <span class="report-info-label">ระยะเวลาพิจารณาจริงสะสม (วันทำการ)</span>
          <span class="report-info-value" style="color: #0e3760; font-weight: 700;">${totalWorkingDays} วันทำการ (นับถึงขั้นตอนที่ 3: นายทะเบียนรับจดทะเบียน)</span>
        </div>
      </div>
    </div>

    <!-- Section 2: 4 Steps Progress -->
    <div class="report-section">
      <div class="report-section-header">
        <h4 class="report-section-title">2. ผลการดำเนินงาน 4 ขั้นตอนการพิจารณา</h4>
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 40px;">ขั้น</th>
            <th style="width: 35%;">ขั้นตอนการพิจารณา</th>
            <th style="width: 105px;">สถานะ</th>
            <th style="width: 140px;">ระยะเวลาดำเนินงาน</th>
            <th>เลขที่หนังสือ / บันทึกผลการพิจารณา</th>
          </tr>
        </thead>
        <tbody>
          ${stepsRows}
        </tbody>
      </table>
    </div>

    <!-- Section 3: Attached Documents -->
    <div class="report-section">
      <div class="report-section-header">
        <h4 class="report-section-title">3. รายการเอกสารร่าง มติที่ประชุม และเอกสารแนบ</h4>
      </div>
      <table class="report-table">
        <thead>
          <tr>
            <th style="width: 40px;">ลำดับ</th>
            <th>ชื่อไฟล์เอกสาร</th>
            <th style="width: 120px;">ขั้นตอนที่เกี่ยวข้อง</th>
            <th style="width: 120px;">วันที่บันทึกเข้าระบบ</th>
          </tr>
        </thead>
        <tbody>
          ${docRows}
        </tbody>
      </table>
    </div>

    <!-- Signatures -->
    <div class="report-signature-section">
      <div class="report-sig-box">
        <div>ลงชื่อ...................................................................เจ้าหน้าที่ผู้รับผิดชอบ</div>
        <div class="report-sig-line"></div>
        <div>(${escapeHtml(regData.officerName || '...................................................................')})</div>
        <div>ตำแหน่ง นักวิชาการสหกรณ์ / นิติกร</div>
        <div>วันที่.......เดือน.......................พ.ศ............</div>
      </div>
      <div class="report-sig-box">
        <div>ลงชื่อ...................................................................ผู้อนุมัติ/นายทะเบียน</div>
        <div class="report-sig-line"></div>
        <div>(...................................................................)</div>
        <div>ตำแหน่ง นายทะเบียนสหกรณ์ / ผู้ได้รับมอบอำนาจ</div>
        <div>วันที่.......เดือน.......................พ.ศ............</div>
      </div>
    </div>

    <div class="report-footer">
      <div>ระบบศูนย์บริการงานนายทะเบียนและส่งเสริมสหกรณ์ กรมส่งเสริมสหกรณ์</div>
      <div>พิมพ์เมื่อ ${printDateStr}</div>
    </div>
  `;

  const safeTitle = (regData.title || 'ระเบียบข้อบังคับ').replace(/[/\\?%*:|"<>]/g, '_').substring(0, 30);
  const filename = `รายงานระเบียบข้อบังคับ_${safeTitle}.pdf`;

  openPdfPreview(html, filename, 'รายงานผลการพิจารณาระเบียบและข้อบังคับ', regData.title, 'portrait');
}

// 3. Export Summary Table of Liquidation Cases List PDF (Landscape)
function exportCasesListPdf() {
  const items = AppState.filteredCases || [];
  if (items.length === 0) {
    showToast('ไม่มีรายการข้อมูลตามตัวกรองที่เลือกสำหรับการส่งออก PDF', 'warning');
    return;
  }

  const printDateStr = formatThaiDateTime(new Date());

  // Statistics
  const totalCount = items.length;
  const activeCount = items.filter(c => c.caseStatus !== 'เสร็จสิ้น' && c.currentStep < 10).length;
  const doneCount = items.filter(c => c.caseStatus === 'เสร็จสิ้น' || c.currentStep >= 10).length;
  const issuesCount = items.filter(c => hasCaseIssues(c)).length;

  // Filter summary text
  const filterDesc = `ตัวกรอง: ขั้นตอน [${AppState.filterStep}] | สถานะ [${AppState.filterStatus}] | ประเภท [${AppState.filterType}] ${AppState.searchTerm ? '| ค้นหา: "' + AppState.searchTerm + '"' : ''}`;

  const rows = items.map((item, idx) => {
    const isDone = item.caseStatus === 'เสร็จสิ้น' || item.currentStep >= 10;
    const dissolutionType = item.dissolutionType || (item.orderNumber && item.orderNumber.includes('ประกาศ') ? 'ประกาศ' : 'คำสั่ง');
    const liqName = getLiquidatorsSummaryText(item);

    return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>
          <div style="font-weight: 600; color: #0e3760;">${escapeHtml(item.coopName)}</div>
          <div style="font-size: 0.74rem; color: #64748b;">ทะเบียน: ${escapeHtml(item.regNumber || '-')} | ที่ตั้ง: ${escapeHtml(item.location || '-')}</div>
        </td>
        <td>${escapeHtml(item.coopType || '-')}</td>
        <td style="font-size: 0.76rem;">
          <div>${escapeHtml(dissolutionType)}: ${escapeHtml(item.orderNumber || '-')}</div>
          <div style="color: #64748b;">วันที่: ${formatThaiDate(item.orderDate)}</div>
        </td>
        <td style="text-align: center; font-size: 0.76rem;">
          <div style="font-weight: 600;">ขั้นที่ ${item.currentStep || 1}/10</div>
          <div style="color: #64748b;">(${Math.round(((item.currentStep || 1) / 10) * 100)}%)</div>
        </td>
        <td style="font-size: 0.76rem;">${escapeHtml(liqName)}</td>
        <td style="text-align: center;">
          <span class="report-badge ${isDone ? 'report-badge-done' : 'report-badge-active'}">
            ${isDone ? 'เสร็จสิ้น' : 'กำลังชำระ'}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  const html = `
    <div class="report-header">
      <div class="report-brand-wrap">
        <div class="report-emblem">🏛️</div>
        <div class="report-header-text">
          <h2>กรมส่งเสริมสหกรณ์ กระทรวงเกษตรและสหกรณ์</h2>
          <p>ระบบติดตามการชำระบัญชีสหกรณ์ (Cooperative Liquidation Tracking System)</p>
        </div>
      </div>
      <div class="report-meta-box">
        <div><strong>วันที่พิมพ์รายงาน:</strong></div>
        <div>${printDateStr}</div>
      </div>
    </div>

    <div class="report-title-banner">
      <h3>รายงานสรุปรายการสหกรณ์ที่อยู่ระหว่างการชำระบัญชี</h3>
      <div class="report-subtitle">${escapeHtml(filterDesc)}</div>
    </div>

    <!-- KPI Summary Cards -->
    <div class="report-kpi-row">
      <div class="report-kpi-card">
        <div class="report-kpi-val">${totalCount}</div>
        <div class="report-kpi-lbl">รายการทั้งหมด</div>
      </div>
      <div class="report-kpi-card">
        <div class="report-kpi-val" style="color: #0284c7;">${activeCount}</div>
        <div class="report-kpi-lbl">กำลังชำระบัญชี</div>
      </div>
      <div class="report-kpi-card">
        <div class="report-kpi-val" style="color: #059669;">${doneCount}</div>
        <div class="report-kpi-lbl">ชำระบัญชีเสร็จสิ้น</div>
      </div>
      <div class="report-kpi-card">
        <div class="report-kpi-val" style="color: #dc2626;">${issuesCount}</div>
        <div class="report-kpi-lbl">มีปัญหาอุปสรรค</div>
      </div>
    </div>

    <!-- Data Table -->
    <table class="report-table">
      <thead>
        <tr>
          <th style="width: 35px;">ลำดับ</th>
          <th>สหกรณ์ / เลขทะเบียน / ที่ตั้ง</th>
          <th style="width: 120px;">ประเภท</th>
          <th style="width: 140px;">คำสั่ง/ประกาศเลิก</th>
          <th style="width: 90px;">ความคืบหน้า</th>
          <th style="width: 140px;">ผู้ชำระบัญชี</th>
          <th style="width: 80px;">สถานะ</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="report-footer">
      <div>พิมพ์จากระบบศูนย์บริการงานนายทะเบียนและส่งเสริมสหกรณ์ (พบ ${totalCount} รายการ)</div>
      <div>พิมพ์เมื่อ ${printDateStr}</div>
    </div>
  `;

  const filename = `รายงานสรุปรายการชำระบัญชี_${todayThaiDate().replace(/\//g, '-')}.pdf`;
  openPdfPreview(html, filename, 'รายงานสรุปรายการชำระบัญชีสหกรณ์', `จำนวนทั้งสิ้น ${totalCount} รายการ`, 'landscape');
}

// 4. Export Summary Table of Regulations List PDF (Landscape)
function exportRegulationsListPdf() {
  const items = AppState.filteredRegulations || [];
  if (items.length === 0) {
    showToast('ไม่มีรายการข้อมูลระเบียบ/ข้อบังคับสำหรับการส่งออก PDF', 'warning');
    return;
  }

  const printDateStr = formatThaiDateTime(new Date());

  // Statistics
  const totalCount = items.length;
  const bylawCount = items.filter(r => r.docType === 'ข้อบังคับสหกรณ์').length;
  const maxRegSteps = CONFIG.REGULATION_STEPS?.length || 4;
  const ruleCount = items.filter(r => r.docType === 'ระเบียบสหกรณ์').length;
  const doneCount = items.filter(r => r.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || r.status === 'รับจดทะเบียน/เห็นชอบแล้ว' || r.currentStep >= maxRegSteps).length;
  const pendingCount = items.filter(r => r.status !== 'รับจดทะเบียน/เห็นชอบ/รับทราบ' && r.status !== 'รับจดทะเบียน/เห็นชอบแล้ว' && r.currentStep < maxRegSteps).length;

  const filterDesc = `ตัวกรอง: ประเภทเอกสาร [${AppState.regFilterDocType}] | ขั้นตอน [${AppState.regFilterStep}] | สถานะ [${AppState.regFilterStatus}] ${AppState.regSearchTerm ? '| ค้นหา: "' + AppState.regSearchTerm + '"' : ''}`;

  const rows = items.map((item, idx) => {
    const isDone = item.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || item.status === 'รับจดทะเบียน/เห็นชอบแล้ว' || item.currentStep >= maxRegSteps;

    return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>
          <div style="font-weight: 600; color: #0e3760;">${escapeHtml(item.title)}</div>
          <div style="font-size: 0.74rem; color: #64748b;">${escapeHtml(item.coopName)} (${escapeHtml(item.regNumber || '-')})</div>
        </td>
        <td style="text-align: center; font-size: 0.76rem;">
          <span class="report-badge ${item.docType === 'ข้อบังคับสหกรณ์' ? 'report-badge-active' : 'report-badge-pending'}">
            ${escapeHtml(item.docType || 'ข้อบังคับ')}
          </span>
        </td>
        <td style="font-size: 0.76rem;">${escapeHtml(item.docNumber || '-')}</td>
        <td style="font-size: 0.76rem; text-align: center;">${formatThaiDate(item.submitDate)}</td>
        <td style="text-align: center; font-size: 0.76rem;">
          <div style="font-weight: 600;">ขั้นที่ ${item.currentStep || 1}/${maxRegSteps}</div>
        </td>
        <td style="font-size: 0.76rem;">${escapeHtml(item.officerName || '-')}</td>
        <td style="text-align: center;">
          <span class="report-badge ${isDone ? 'report-badge-done' : (item.status === 'ส่งคืนแก้ไข' ? 'report-badge-issue' : 'report-badge-active')}">
            ${escapeHtml(item.status || 'อยู่ระหว่างพิจารณา')}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  const html = `
    <div class="report-header">
      <div class="report-brand-wrap">
        <div class="report-emblem">📜</div>
        <div class="report-header-text">
          <h2>กรมส่งเสริมสหกรณ์ กระทรวงเกษตรและสหกรณ์</h2>
          <p>ระบบติดตามการพิจารณาระเบียบและข้อบังคับสหกรณ์</p>
        </div>
      </div>
      <div class="report-meta-box">
        <div><strong>วันที่พิมพ์รายงาน:</strong></div>
        <div>${printDateStr}</div>
      </div>
    </div>

    <div class="report-title-banner">
      <h3>รายงานสรุปการพิจารณาระเบียบและข้อบังคับสหกรณ์</h3>
      <div class="report-subtitle">${escapeHtml(filterDesc)}</div>
    </div>

    <!-- KPI Summary Cards -->
    <div class="report-kpi-row">
      <div class="report-kpi-card">
        <div class="report-kpi-val">${totalCount}</div>
        <div class="report-kpi-lbl">รายการทั้งหมด</div>
      </div>
      <div class="report-kpi-card">
        <div class="report-kpi-val" style="color: #7c3aed;">${bylawCount}</div>
        <div class="report-kpi-lbl">ข้อบังคับสหกรณ์</div>
      </div>
      <div class="report-kpi-card">
        <div class="report-kpi-val" style="color: #0284c7;">${ruleCount}</div>
        <div class="report-kpi-lbl">ระเบียบสหกรณ์</div>
      </div>
      <div class="report-kpi-card">
        <div class="report-kpi-val" style="color: #059669;">${doneCount}</div>
        <div class="report-kpi-lbl">รับจดทะเบียน/เห็นชอบแล้ว</div>
      </div>
    </div>

    <!-- Data Table -->
    <table class="report-table">
      <thead>
        <tr>
          <th style="width: 35px;">ลำดับ</th>
          <th>ชื่อระเบียบ/ข้อบังคับ / สหกรณ์</th>
          <th style="width: 100px;">ประเภท</th>
          <th style="width: 110px;">เลขที่รับเรื่อง</th>
          <th style="width: 95px;">วันที่ยื่น</th>
          <th style="width: 80px;">ความคืบหน้า</th>
          <th style="width: 130px;">จนท. ผู้รับผิดชอบ</th>
          <th style="width: 110px;">สถานะ</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="report-footer">
      <div>พิมพ์จากระบบศูนย์บริการงานนายทะเบียนและส่งเสริมสหกรณ์ (พบ ${totalCount} รายการ)</div>
      <div>พิมพ์เมื่อ ${printDateStr}</div>
    </div>
  `;

  const filename = `รายงานสรุปรายการระเบียบข้อบังคับ_${todayThaiDate().replace(/\//g, '-')}.pdf`;
  openPdfPreview(html, filename, 'รายงานสรุปการพิจารณาระเบียบและข้อบังคับ', `จำนวนทั้งสิ้น ${totalCount} รายการ`, 'landscape');
}

// 5. Open PDF Preview Modal
function openPdfPreview(htmlContent, filename, title, subtitle, orientation = 'portrait') {
  AppState.currentPdfData = {
    html: htmlContent,
    filename: filename || 'document.pdf',
    orientation: orientation
  };

  const titleEl = document.getElementById('pdfPreviewModalTitle');
  const subtitleEl = document.getElementById('pdfPreviewModalSubtitle');
  const contentEl = document.getElementById('pdfPreviewContent');

  if (titleEl) titleEl.innerText = title || 'ตัวอย่างเอกสารรายงาน PDF';
  if (subtitleEl) subtitleEl.innerText = subtitle || 'ระบบศูนย์บริการงานนายทะเบียนและส่งเสริมสหกรณ์';
  if (contentEl) {
    contentEl.className = `pdf-document-paper ${orientation === 'landscape' ? 'landscape' : ''}`;
    contentEl.innerHTML = htmlContent;
  }

  openModal('pdfPreviewModal');
}

// 6. Trigger Direct PDF Download using html2pdf.js
function triggerDirectPdfDownload() {
  if (!AppState.currentPdfData) {
    showToast('ไม่มีข้อมูลเอกสารสำหรับดาวน์โหลด', 'warning');
    return;
  }

  const contentEl = document.getElementById('pdfPreviewContent');
  if (!contentEl) return;

  const { filename, orientation } = AppState.currentPdfData;
  const isLandscape = orientation === 'landscape';

  showToast('กำลังประมวลผลและสร้างไฟล์ PDF...', 'info');
  setLoading(true);

  const opt = {
    margin: isLandscape ? [8, 8, 8, 8] : [10, 10, 10, 10],
    filename: filename || 'report.pdf',
    image: { type: 'jpeg', quality: 0.98 },
    html2canvas: {
      scale: 2,
      useCORS: true,
      letterRendering: true,
      logging: false
    },
    jsPDF: {
      unit: 'mm',
      format: 'a4',
      orientation: orientation || 'portrait'
    },
    pagebreak: { mode: ['avoid-all', 'css', 'legacy'] }
  };

  // Check if html2pdf is available
  if (typeof window.html2pdf !== 'undefined') {
    window.html2pdf().set(opt).from(contentEl).save()
      .then(() => {
        setLoading(false);
        showToast('ดาวน์โหลดไฟล์ PDF เรียบร้อยแล้ว', 'success');
      })
      .catch((err) => {
        setLoading(false);
        console.error('html2pdf error:', err);
        showToast('เกิดข้อผิดพลาดในการสร้างไฟล์ PDF กำลังเปลี่ยนไปใช้ Print to PDF', 'warning');
        triggerPrintDialog();
      });
  } else {
    setLoading(false);
    showToast('กำลังเปิดหน้าต่างพิมพ์ (Print / Save as PDF)...', 'info');
    triggerPrintDialog();
  }
}

// 7. Trigger Native Print Dialog (Vector high-res print to PDF)
function triggerPrintDialog() {
  if (!AppState.currentPdfData) {
    showToast('ไม่มีข้อมูลเอกสารสำหรับพิมพ์', 'warning');
    return;
  }

  const { html, orientation } = AppState.currentPdfData;
  const isLandscape = orientation === 'landscape';

  // Create dedicated hidden print iframe for pure isolated printing
  let printFrame = document.getElementById('reportPrintFrame');
  if (!printFrame) {
    printFrame = document.createElement('iframe');
    printFrame.id = 'reportPrintFrame';
    printFrame.style.position = 'fixed';
    printFrame.style.top = '-9999px';
    printFrame.style.left = '-9999px';
    printFrame.style.width = '0px';
    printFrame.style.height = '0px';
    printFrame.style.border = 'none';
    document.body.appendChild(printFrame);
  }

  const frameDoc = printFrame.contentWindow.document;
  frameDoc.open();
  frameDoc.write(`
    <!DOCTYPE html>
    <html lang="th">
    <head>
      <meta charset="UTF-8">
      <title>${escapeHtml(AppState.currentPdfData.filename || 'พิมพ์รายงาน')}</title>
      <link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Prompt:wght@400;500;600;700&family=Sarabun:wght@400;500;600;700&display=swap">
      <link rel="stylesheet" href="styles.css">
      <style>
        body {
          background: #ffffff !important;
          margin: 0 !important;
          padding: ${isLandscape ? '10mm' : '12mm'} !important;
        }
        .pdf-document-paper {
          box-shadow: none !important;
          padding: 0 !important;
          max-width: 100% !important;
          width: 100% !important;
        }
        @page {
          size: A4 ${isLandscape ? 'landscape' : 'portrait'};
          margin: ${isLandscape ? '8mm' : '10mm'};
        }
      </style>
    </head>
    <body>
      <div class="pdf-document-paper ${isLandscape ? 'landscape' : ''}">
        ${html}
      </div>
      <script>
        window.onload = function() {
          setTimeout(function() {
            window.focus();
            window.print();
          }, 300);
        };
      </script>
    </body>
    </html>
  `);
  frameDoc.close();
}

// Quick Export Helpers
async function quickExportCasePdf(caseId) {
  if (AppState.selectedCase && AppState.selectedCase.caseId === caseId) {
    exportCurrentCasePdf();
    return;
  }
  setLoading(true);
  try {
    const caseData = await ApiClient.get('getCaseDetail', { caseId: caseId });
    AppState.selectedCase = caseData;
    exportCurrentCasePdf();
  } catch (err) {
    showToast('ไม่สามารถดึงข้อมูลสำหรับส่งออก PDF ได้: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function quickExportRegPdf(regId) {
  if (AppState.selectedReg && AppState.selectedReg.regId === regId) {
    exportCurrentRegPdf();
    return;
  }
  setLoading(true);
  try {
    const regData = await ApiClient.get('getRegDetail', { regId: regId });
    AppState.selectedReg = regData;
    exportCurrentRegPdf();
  } catch (err) {
    showToast('ไม่สามารถดึงข้อมูลสำหรับส่งออก PDF ได้: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

// 8. Export Combined Master Report for Filtered Operations (Both Modules or Filtered)
async function exportAllActiveOperationsPdf() {
  if ((!AppState.cases || AppState.cases.length === 0) || (!AppState.regulations || AppState.regulations.length === 0)) {
    setLoading(true);
    try {
      await Promise.all([loadCasesData(), loadRegulationsData()]);
    } catch (e) {
      console.warn('Load data error for master report:', e);
    } finally {
      setLoading(false);
    }
  }

  const filteredCases = getFilteredExportCases();
  const filteredRegs = getFilteredExportRegulations();
  const totalCount = filteredCases.length + filteredRegs.length;

  if (totalCount === 0) {
    showToast('ไม่มีรายการข้อมูลตรงตามตัวกรองที่เลือกสำหรับการส่งออก PDF', 'warning');
    return;
  }

  const printDateStr = formatThaiDateTime(new Date());
  const filterSummary = getActiveFilterSummaryText();

  // Statistics
  const totalCasesCount = filteredCases.length;
  const totalRegsCount = filteredRegs.length;
  const casesWithIssues = filteredCases.filter(c => hasCaseIssues(c)).length;
  const regsWithIssues = filteredRegs.filter(r => r.status === 'ส่งคืนแก้ไข').length;
  const totalIssues = casesWithIssues + regsWithIssues;

  // Render Liquidation Cases Table Rows
  const caseRows = filteredCases.length > 0 ? filteredCases.map((item, idx) => {
    const dissolutionType = item.dissolutionType || (item.orderNumber && item.orderNumber.includes('ประกาศ') ? 'ประกาศเลิก' : 'คำสั่งเลิก');
    const liqName = getLiquidatorsSummaryText(item);
    const curStepNum = parseInt(item.currentStep, 10) || 1;
    const dur = WorkingDaysUtil.calculate(item.orderDate, null, item.caseStatus || 'กำลังชำระบัญชี');
    const issuesText = getIssuesSummaryText(item);

    let stepGroup = '🌱 ขั้น 1-3';
    if (curStepNum >= 10) stepGroup = '🏁 ขั้น 10 (เสร็จสิ้น)';
    else if (curStepNum >= 7) stepGroup = '📑 ขั้น 7-9';
    else if (curStepNum >= 4) stepGroup = '⚖️ ขั้น 4-6';

    return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>
          <div style="font-weight: 600; color: #0e3760;">${escapeHtml(item.coopName)}</div>
          <div style="font-size: 0.72rem; color: #64748b;">ทะเบียน: ${escapeHtml(item.regNumber || '-')} | ที่ตั้ง: ${escapeHtml(item.location || '-')}</div>
        </td>
        <td style="font-size: 0.74rem;">${escapeHtml(item.coopType || '-')}</td>
        <td style="font-size: 0.74rem;">
          <div>${escapeHtml(dissolutionType)}: ${escapeHtml(item.orderNumber || '-')}</div>
          <div style="color: #64748b;">วันที่: ${formatThaiDate(item.orderDate)}</div>
        </td>
        <td style="text-align: center; font-size: 0.74rem;">
          <div style="font-weight: 600; color: #0369a1;">${stepGroup} (ขั้นที่ ${curStepNum}/10)</div>
          <div style="color: #64748b;">ความคืบหน้า ${curStepNum * 10}%</div>
        </td>
        <td style="font-size: 0.74rem;">${escapeHtml(liqName)}</td>
        <td style="text-align: center; font-size: 0.74rem; font-weight: 600; color: #0e3760;">
          ${dur.hasData ? `${dur.workingDays} วันทำการ` : '-'}
        </td>
        <td style="font-size: 0.74rem;">
          ${issuesText ? `<span style="color: #dc2626; font-weight: 500;">⚠️ ${escapeHtml(issuesText)}</span>` : '<span style="color: #059669;">ปกติ</span>'}
        </td>
      </tr>
    `;
  }).join('') : `
    <tr>
      <td colspan="8" style="text-align: center; color: #64748b; padding: 14px;">- ไม่มีรายการสหกรณ์ตรงตามตัวกรอง -</td>
    </tr>
  `;

  // Render Regulations Table Rows
  const regRows = filteredRegs.length > 0 ? filteredRegs.map((item, idx) => {
    const curStepNum = parseInt(item.currentStep, 10) || 1;
    const dur = getRegDuration(item);
    const isReturned = item.status === 'ส่งคืนแก้ไข';

    return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>
          <div style="font-weight: 600; color: #0e3760;">${escapeHtml(item.title)}</div>
          <div style="font-size: 0.72rem; color: #64748b;">${escapeHtml(item.coopName)} (${escapeHtml(item.regNumber || '-')})</div>
        </td>
        <td style="text-align: center; font-size: 0.74rem;">
          <span class="report-badge ${dur.sla?.conf?.badgeClass || 'report-badge-active'}">
            ${escapeHtml(dur.sla?.conf?.shortLabel || item.docType || 'ข้อบังคับ')}
          </span>
          <div style="font-size: 0.68rem; color: #64748b; margin-top: 2px;">SLA: ${dur.sla?.slaDays || 14} วัน</div>
        </td>
        <td style="font-size: 0.74rem;">
          <div>${escapeHtml(item.docNumber || '-')}</div>
          <div style="color: #64748b;">ลงรับ: ${formatThaiDate(item.receiveDate || item.submitDate)}</div>
        </td>
        <td style="text-align: center; font-size: 0.74rem;">
          <div style="font-weight: 600; color: #0d9488;">ขั้นที่ ${curStepNum}/${CONFIG.REGULATION_STEPS?.length || 4}</div>
          <div style="font-size: 0.7rem; color: #64748b;">${escapeHtml(CONFIG.REGULATION_STEPS[curStepNum - 1]?.title || '')}</div>
        </td>
        <td style="font-size: 0.74rem;">
          <div>${escapeHtml(item.officerName || '-')}</div>
          ${item.officerContact ? `<div style="color: #64748b; font-size: 0.7rem;">${escapeHtml(item.officerContact)}</div>` : ''}
        </td>
        <td style="text-align: center; font-size: 0.74rem; font-weight: 600; color: #0e3760;">
          ${dur.hasData ? `${dur.workingDays} วันทำการ` : '-'}
          ${dur.sla && dur.sla.hasData ? `<div style="margin-top: 3px;"><span class="sla-badge ${dur.sla.badgeClass}" style="font-size: 0.65rem;">${dur.sla.badgeText}</span></div>` : ''}
        </td>
        <td style="text-align: center;">
          <span class="report-badge ${isReturned ? 'report-badge-issue' : 'report-badge-active'}">
            ${isReturned ? '⚠️ ส่งคืนแก้ไข' : '● ' + escapeHtml(item.status || 'อยู่ระหว่างพิจารณา')}
          </span>
        </td>
      </tr>
    `;
  }).join('') : `
    <tr>
      <td colspan="8" style="text-align: center; color: #64748b; padding: 14px;">- ไม่มีรายการระเบียบ/ข้อบังคับตรงตามตัวกรอง -</td>
    </tr>
  `;

  // Build PDF HTML
  const showCases = ExportFilterState.module !== 'REGS';
  const showRegs = ExportFilterState.module !== 'CASES';

  const html = `
    <div class="report-header">
      <div class="report-brand-wrap">
        <div class="report-emblem">🏛️</div>
        <div class="report-header-text">
          <h2>กรมส่งเสริมสหกรณ์ กระทรวงเกษตรและสหกรณ์</h2>
          <p>ระบบศูนย์บริการงานนายทะเบียนและส่งเสริมสหกรณ์ (Master Operations Tracking)</p>
        </div>
      </div>
      <div class="report-meta-box">
        <div><strong>วันที่พิมพ์รายงาน:</strong></div>
        <div>${printDateStr}</div>
      </div>
    </div>

    <div class="report-title-banner">
      <h3>รายงานสรุปข้อมูลงานนายทะเบียนและส่งเสริมสหกรณ์ (Data Summary Report)</h3>
      <div class="report-subtitle">
        เงื่อนไขตัวกรอง: <strong>${escapeHtml(filterSummary)}</strong>
      </div>
    </div>

    <!-- Executive KPI Row -->
    <div class="report-kpi-row">
      <div class="report-kpi-card" style="border-left: 4px solid #0e3760;">
        <div class="report-kpi-val">${totalCount}</div>
        <div class="report-kpi-lbl">ข้อมูลตรงตามตัวกรองทั้งหมด (เรื่อง)</div>
      </div>
      <div class="report-kpi-card" style="border-left: 4px solid #0284c7;">
        <div class="report-kpi-val" style="color: #0284c7;">${totalCasesCount}</div>
        <div class="report-kpi-lbl">งานชำระบัญชีสหกรณ์ (แห่ง)</div>
      </div>
      <div class="report-kpi-card" style="border-left: 4px solid #0d9488;">
        <div class="report-kpi-val" style="color: #0d9488;">${totalRegsCount}</div>
        <div class="report-kpi-lbl">งานระเบียบ/ข้อบังคับ (เรื่อง)</div>
      </div>
      <div class="report-kpi-card" style="border-left: 4px solid #dc2626;">
        <div class="report-kpi-val" style="color: #dc2626;">${totalIssues}</div>
        <div class="report-kpi-lbl">รายการที่มีปัญหา/ส่งคืนแก้ไข (เรื่อง)</div>
      </div>
    </div>

    ${showCases ? `
      <!-- Section 1: Liquidation Cases -->
      <div class="report-section" style="margin-top: 18px;">
        <div class="report-section-header">
          <h4 class="report-section-title">หมวดที่ 1: รายการสหกรณ์ที่อยู่ระหว่าง/เสร็จสิ้นการชำระบัญชี (${totalCasesCount} แห่ง)</h4>
        </div>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 32px;">ที่</th>
              <th>ชื่อสหกรณ์ / ทะเบียน / ที่ตั้ง</th>
              <th style="width: 100px;">ประเภท</th>
              <th style="width: 120px;">คำสั่ง/ประกาศเลิก</th>
              <th style="width: 110px;">ความคืบหน้า</th>
              <th style="width: 120px;">ผู้ชำระบัญชี</th>
              <th style="width: 85px;">วันทำการที่ใช้</th>
              <th style="width: 120px;">ปัญหาอุปสรรค</th>
            </tr>
          </thead>
          <tbody>
            ${caseRows}
          </tbody>
        </table>
      </div>
    ` : ''}

    ${showRegs ? `
      <!-- Section 2: Regulations -->
      <div class="report-section" style="margin-top: 24px;">
        <div class="report-section-header">
          <h4 class="report-section-title">หมวดที่ 2: รายการระเบียบและข้อบังคับสหกรณ์ (${totalRegsCount} เรื่อง)</h4>
        </div>
        <table class="report-table">
          <thead>
            <tr>
              <th style="width: 32px;">ที่</th>
              <th>ชื่อเรื่อง ระเบียบ/ข้อบังคับ / สหกรณ์</th>
              <th style="width: 85px;">ประเภท</th>
              <th style="width: 100px;">เลขที่/วันยื่น</th>
              <th style="width: 120px;">ขั้นตอนปัจจุบัน</th>
              <th style="width: 110px;">จนท. ผู้รับผิดชอบ</th>
              <th style="width: 85px;">วันทำการที่ใช้</th>
              <th style="width: 105px;">สถานะ</th>
            </tr>
          </thead>
          <tbody>
            ${regRows}
          </tbody>
        </table>
      </div>
    ` : ''}

    <!-- Signatures -->
    <div class="report-signature-section">
      <div class="report-sig-box">
        <div>ลงชื่อ...................................................................ผู้รวบรวมรายงาน</div>
        <div class="report-sig-line"></div>
        <div>(...................................................................)</div>
        <div>ตำแหน่ง เจ้าหน้าที่กลุ่มส่งเสริมและพัฒนาการบริหารการจัดการสหกรณ์</div>
        <div>วันที่.......เดือน.......................พ.ศ............</div>
      </div>
      <div class="report-sig-box">
        <div>ลงชื่อ...................................................................ผู้รับทราบ/นายทะเบียน</div>
        <div class="report-sig-line"></div>
        <div>(...................................................................)</div>
        <div>ตำแหน่ง นายทะเบียนสหกรณ์ / สหกรณ์จังหวัด</div>
        <div>วันที่.......เดือน.......................พ.ศ............</div>
      </div>
    </div>

    <div class="report-footer">
      <div>ศูนย์บริการงานนายทะเบียนและส่งเสริมสหกรณ์ กรมส่งเสริมสหกรณ์ (รวมข้อมูลตรงตามตัวกรอง ${totalCount} รายการ)</div>
      <div>พิมพ์เมื่อ ${printDateStr}</div>
    </div>
  `;

  const filename = `รายงานสรุปข้อมูล_${todayThaiDate().replace(/\//g, '-')}.pdf`;
  openPdfPreview(html, filename, 'รายงานสรุปข้อมูลตามตัวกรอง', `จำนวนทั้งสิ้น ${totalCount} รายการ`, 'landscape');
}

// 9. Export Dedicated Liquidation Cases Summary PDF (Respecting Filters)
function exportActiveCasesOnlyPdf() {
  const filteredCases = getFilteredExportCases();
  if (filteredCases.length === 0) {
    showToast('ไม่มีรายการสหกรณ์ตรงตามตัวกรองที่เลือกสำหรับการส่งออก PDF', 'warning');
    return;
  }

  const printDateStr = formatThaiDateTime(new Date());
  const totalCount = filteredCases.length;
  const issuesCount = filteredCases.filter(c => hasCaseIssues(c)).length;
  const filterSummary = getActiveFilterSummaryText();

  const rows = filteredCases.map((item, idx) => {
    const dissolutionType = item.dissolutionType || (item.orderNumber && item.orderNumber.includes('ประกาศ') ? 'ประกาศเลิก' : 'คำสั่งเลิก');
    const liqName = getLiquidatorsSummaryText(item);
    const curStepNum = parseInt(item.currentStep, 10) || 1;
    const dur = WorkingDaysUtil.calculate(item.orderDate, null, item.caseStatus || 'กำลังชำระบัญชี');
    const issuesText = getIssuesSummaryText(item);

    return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>
          <div style="font-weight: 600; color: #0e3760;">${escapeHtml(item.coopName)}</div>
          <div style="font-size: 0.74rem; color: #64748b;">ทะเบียน: ${escapeHtml(item.regNumber || '-')} | ที่ตั้ง: ${escapeHtml(item.location || '-')}</div>
        </td>
        <td style="font-size: 0.76rem;">${escapeHtml(item.coopType || '-')}</td>
        <td style="font-size: 0.76rem;">
          <div>${escapeHtml(dissolutionType)}: ${escapeHtml(item.orderNumber || '-')}</div>
          <div style="color: #64748b;">วันที่: ${formatThaiDate(item.orderDate)}</div>
        </td>
        <td style="text-align: center; font-size: 0.76rem;">
          <div style="font-weight: 600; color: #0284c7;">ขั้นที่ ${curStepNum}/10 (${curStepNum * 10}%)</div>
          <div style="font-size: 0.7rem; color: #64748b;">${escapeHtml(CONFIG.LIQUIDATION_STEPS[curStepNum - 1]?.title || '')}</div>
        </td>
        <td style="font-size: 0.76rem;">${escapeHtml(liqName)}</td>
        <td style="text-align: center; font-size: 0.76rem; font-weight: 600; color: #0e3760;">
          ${dur.hasData ? `${dur.workingDays} วันทำการ` : '-'}
        </td>
        <td style="font-size: 0.76rem;">
          ${issuesText ? `<span style="color: #dc2626; font-weight: 500;">⚠️ ${escapeHtml(issuesText)}</span>` : '<span style="color: #059669;">ปกติ</span>'}
        </td>
      </tr>
    `;
  }).join('');

  const html = `
    <div class="report-header">
      <div class="report-brand-wrap">
        <div class="report-emblem">⚖️</div>
        <div class="report-header-text">
          <h2>กรมส่งเสริมสหกรณ์ กระทรวงเกษตรและสหกรณ์</h2>
          <p>ระบบติดตามการชำระบัญชีสหกรณ์ (Cooperative Liquidation Tracking System)</p>
        </div>
      </div>
      <div class="report-meta-box">
        <div><strong>วันที่พิมพ์รายงาน:</strong></div>
        <div>${printDateStr}</div>
      </div>
    </div>

    <div class="report-title-banner">
      <h3>รายงานสรุปรายการสหกรณ์ชำระบัญชี (ตามตัวกรอง)</h3>
      <div class="report-subtitle">เงื่อนไขตัวกรอง: <strong>${escapeHtml(filterSummary)}</strong></div>
    </div>

    <div class="report-kpi-row">
      <div class="report-kpi-card">
        <div class="report-kpi-val" style="color: #0284c7;">${totalCount}</div>
        <div class="report-kpi-lbl">สหกรณ์ตรงตามตัวกรอง (แห่ง)</div>
      </div>
      <div class="report-kpi-card">
        <div class="report-kpi-val" style="color: #059669;">${totalCount - issuesCount}</div>
        <div class="report-kpi-lbl">การดำเนินงานปกติ (แห่ง)</div>
      </div>
      <div class="report-kpi-card">
        <div class="report-kpi-val" style="color: #dc2626;">${issuesCount}</div>
        <div class="report-kpi-lbl">มีปัญหาอุปสรรค (แห่ง)</div>
      </div>
    </div>

    <table class="report-table">
      <thead>
        <tr>
          <th style="width: 35px;">ที่</th>
          <th>สหกรณ์ / เลขทะเบียน / ที่ตั้ง</th>
          <th style="width: 110px;">ประเภท</th>
          <th style="width: 130px;">คำสั่ง/ประกาศเลิก</th>
          <th style="width: 140px;">ขั้นตอนปัจจุบัน</th>
          <th style="width: 130px;">ผู้ชำระบัญชี</th>
          <th style="width: 90px;">วันทำการที่ใช้</th>
          <th style="width: 120px;">ปัญหาอุปสรรค</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="report-signature-section">
      <div class="report-sig-box">
        <div>ลงชื่อ...................................................................ผู้จัดทำรายงาน</div>
        <div class="report-sig-line"></div>
        <div>(...................................................................)</div>
        <div>ตำแหน่ง.............................................................</div>
      </div>
      <div class="report-sig-box">
        <div>ลงชื่อ...................................................................นายทะเบียนสหกรณ์</div>
        <div class="report-sig-line"></div>
        <div>(...................................................................)</div>
        <div>ตำแหน่ง นายทะเบียนสหกรณ์ / ผู้ตรวจการสหกรณ์</div>
      </div>
    </div>

    <div class="report-footer">
      <div>ระบบติดตามการชำระบัญชีสหกรณ์ กรมส่งเสริมสหกรณ์ (พบ ${totalCount} รายการ)</div>
      <div>พิมพ์เมื่อ ${printDateStr}</div>
    </div>
  `;

  const filename = `รายงานสรุปชำระบัญชี_${todayThaiDate().replace(/\//g, '-')}.pdf`;
  openPdfPreview(html, filename, 'รายงานสหกรณ์ชำระบัญชีตามตัวกรอง', `จำนวนทั้งสิ้น ${totalCount} แห่ง`, 'landscape');
}

// 10. Export Dedicated Regulations Summary PDF (Respecting Filters)
function exportActiveRegulationsOnlyPdf() {
  const filteredRegs = getFilteredExportRegulations();
  if (filteredRegs.length === 0) {
    showToast('ไม่มีรายการระเบียบ/ข้อบังคับตรงตามตัวกรองที่เลือกสำหรับการส่งออก PDF', 'warning');
    return;
  }

  const printDateStr = formatThaiDateTime(new Date());
  const totalCount = filteredRegs.length;
  const returnedCount = filteredRegs.filter(r => r.status === 'ส่งคืนแก้ไข').length;
  const filterSummary = getActiveFilterSummaryText();

  const rows = filteredRegs.map((item, idx) => {
    const curStepNum = parseInt(item.currentStep, 10) || 1;
    const dur = getRegDuration(item);
    const isReturned = item.status === 'ส่งคืนแก้ไข';

    return `
      <tr>
        <td style="text-align: center;">${idx + 1}</td>
        <td>
          <div style="font-weight: 600; color: #0e3760;">${escapeHtml(item.title)}</div>
          <div style="font-size: 0.74rem; color: #64748b;">${escapeHtml(item.coopName)} (${escapeHtml(item.regNumber || '-')})</div>
        </td>
        <td style="text-align: center; font-size: 0.76rem;">
          <span class="report-badge ${dur.sla?.conf?.badgeClass || 'report-badge-active'}">
            ${escapeHtml(dur.sla?.conf?.shortLabel || item.docType || 'ข้อบังคับ')}
          </span>
          <div style="font-size: 0.68rem; color: #64748b; margin-top: 2px;">SLA: ${dur.sla?.slaDays || 14} วัน</div>
        </td>
        <td style="font-size: 0.76rem;">
          <div>${escapeHtml(item.docNumber || '-')}</div>
          <div style="color: #64748b;">ลงรับ: ${formatThaiDate(item.receiveDate || item.submitDate)}</div>
        </td>
        <td style="text-align: center; font-size: 0.76rem;">
          <div style="font-weight: 600; color: #0d9488;">ขั้นที่ ${curStepNum}/${CONFIG.REGULATION_STEPS?.length || 4}</div>
          <div style="font-size: 0.7rem; color: #64748b;">${escapeHtml(CONFIG.REGULATION_STEPS[curStepNum - 1]?.title || '')}</div>
        </td>
        <td style="font-size: 0.76rem;">
          <div>${escapeHtml(item.officerName || '-')}</div>
          ${item.officerContact ? `<div style="color: #64748b; font-size: 0.7rem;">${escapeHtml(item.officerContact)}</div>` : ''}
        </td>
        <td style="text-align: center; font-size: 0.76rem; font-weight: 600; color: #0e3760;">
          ${dur.hasData ? `${dur.workingDays} วันทำการ` : '-'}
          ${dur.sla && dur.sla.hasData ? `<div style="margin-top: 3px;"><span class="sla-badge ${dur.sla.badgeClass}" style="font-size: 0.65rem;">${dur.sla.badgeText}</span></div>` : ''}
        </td>
        <td style="text-align: center;">
          <span class="report-badge ${isReturned ? 'report-badge-issue' : 'report-badge-active'}">
            ${isReturned ? '⚠️ ส่งคืนแก้ไข' : '● ' + escapeHtml(item.status || 'อยู่ระหว่างพิจารณา')}
          </span>
        </td>
      </tr>
    `;
  }).join('');

  const html = `
    <div class="report-header">
      <div class="report-brand-wrap">
        <div class="report-emblem">📜</div>
        <div class="report-header-text">
          <h2>กรมส่งเสริมสหกรณ์ กระทรวงเกษตรและสหกรณ์</h2>
          <p>ระบบติดตามการพิจารณาระเบียบและข้อบังคับสหกรณ์</p>
        </div>
      </div>
      <div class="report-meta-box">
        <div><strong>วันที่พิมพ์รายงาน:</strong></div>
        <div>${printDateStr}</div>
      </div>
    </div>

    <div class="report-title-banner">
      <h3>รายงานสรุปการพิจารณาระเบียบและข้อบังคับ (ตามตัวกรอง)</h3>
      <div class="report-subtitle">เงื่อนไขตัวกรอง: <strong>${escapeHtml(filterSummary)}</strong></div>
    </div>

    <div class="report-kpi-row">
      <div class="report-kpi-card">
        <div class="report-kpi-val" style="color: #0d9488;">${totalCount}</div>
        <div class="report-kpi-lbl">เรื่องตรงตามตัวกรอง (เรื่อง)</div>
      </div>
      <div class="report-kpi-card">
        <div class="report-kpi-val" style="color: #0284c7;">${totalCount - returnedCount}</div>
        <div class="report-kpi-lbl">ปกติ / รับจดทะเบียน (เรื่อง)</div>
      </div>
      <div class="report-kpi-card">
        <div class="report-kpi-val" style="color: #dc2626;">${returnedCount}</div>
        <div class="report-kpi-lbl">ส่งคืนแก้ไขปรับปรุง (เรื่อง)</div>
      </div>
    </div>

    <table class="report-table">
      <thead>
        <tr>
          <th style="width: 35px;">ที่</th>
          <th>ชื่อระเบียบ/ข้อบังคับ / สหกรณ์</th>
          <th style="width: 100px;">ประเภท</th>
          <th style="width: 110px;">เลขที่/วันยื่น</th>
          <th style="width: 130px;">ขั้นตอนปัจจุบัน</th>
          <th style="width: 120px;">จนท. ผู้รับผิดชอบ</th>
          <th style="width: 90px;">วันทำการที่ใช้</th>
          <th style="width: 110px;">สถานะ</th>
        </tr>
      </thead>
      <tbody>
        ${rows}
      </tbody>
    </table>

    <div class="report-signature-section">
      <div class="report-sig-box">
        <div>ลงชื่อ...................................................................เจ้าหน้าที่ผู้รวบรวม</div>
        <div class="report-sig-line"></div>
        <div>(...................................................................)</div>
        <div>ตำแหน่ง นักวิชาการสหกรณ์ / นิติกร</div>
      </div>
      <div class="report-sig-box">
        <div>ลงชื่อ...................................................................นายทะเบียนสหกรณ์</div>
        <div class="report-sig-line"></div>
        <div>(...................................................................)</div>
        <div>ตำแหน่ง นายทะเบียนสหกรณ์ / ผู้ได้รับมอบอำนาจ</div>
      </div>
    </div>

    <div class="report-footer">
      <div>ระบบติดตามการพิจารณาระเบียบและข้อบังคับสหกรณ์ (พบ ${totalCount} เรื่อง)</div>
      <div>พิมพ์เมื่อ ${printDateStr}</div>
    </div>
  `;

  const filename = `รายงานสรุประเบียบข้อบังคับ_${todayThaiDate().replace(/\//g, '-')}.pdf`;
  openPdfPreview(html, filename, 'รายงานระเบียบและข้อบังคับตามตัวกรอง', `จำนวนทั้งสิ้น ${totalCount} เรื่อง`, 'landscape');
}

// ==============================================================================
// 10. Master Data Summary Export & Reporting Hub Engine
// ==============================================================================

const ExportFilterState = {
  scope: 'ACTIVE',       // 'ACTIVE' | 'DONE' | 'ALL'
  module: 'ALL',        // 'ALL' | 'CASES' | 'REGS'
  coopType: 'ALL',      // 'ALL' | specific type
  caseStep: 'ALL',      // 'ALL' | 'PHASE_1' | 'PHASE_2' | 'PHASE_3' | 'PHASE_4' | '1'..'10'
  regStep: 'ALL',       // 'ALL' | '1'..'4'
  docType: 'ALL',       // 'ALL' | specific doc type
  issue: 'ALL',         // 'ALL' | 'ISSUES' | 'NORMAL' | 'OVERDUE'
  search: '',           // search query
  activeTab: 'cases'    // 'cases' | 'regs'
};

function getFilteredExportCases() {
  const allCases = AppState.cases || [];
  return allCases.filter(item => {
    // 1. Module check
    if (ExportFilterState.module === 'REGS') return false;

    // 2. Scope / Status check
    const stepNum = parseInt(item.currentStep, 10) || 1;
    const isDone = item.caseStatus === 'เสร็จสิ้น' || stepNum >= 10;
    if (ExportFilterState.scope === 'ACTIVE' && isDone) return false;
    if (ExportFilterState.scope === 'DONE' && !isDone) return false;

    // 3. Coop Type
    if (ExportFilterState.coopType !== 'ALL') {
      if (ExportFilterState.coopType === 'กลุ่มเกษตรกร') {
        if (!item.coopType || !item.coopType.includes('กลุ่มเกษตรกร')) return false;
      } else {
        if (item.coopType !== ExportFilterState.coopType) return false;
      }
    }

    // 4. Case Step
    if (ExportFilterState.caseStep !== 'ALL') {
      if (ExportFilterState.caseStep === 'PHASE_1' && (stepNum < 1 || stepNum > 3)) return false;
      else if (ExportFilterState.caseStep === 'PHASE_2' && (stepNum < 4 || stepNum > 6)) return false;
      else if (ExportFilterState.caseStep === 'PHASE_3' && (stepNum < 7 || stepNum > 9)) return false;
      else if (ExportFilterState.caseStep === 'PHASE_4' && stepNum !== 10) return false;
      else if (!isNaN(parseInt(ExportFilterState.caseStep, 10)) && stepNum !== parseInt(ExportFilterState.caseStep, 10)) return false;
    }

    // 5. Issues / SLA
    const hasIssue = hasCaseIssues(item);
    if (ExportFilterState.issue === 'ISSUES' && !hasIssue) return false;
    if (ExportFilterState.issue === 'NORMAL' && hasIssue) return false;
    if (ExportFilterState.issue === 'OVERDUE') {
      const dur = WorkingDaysUtil.calculate(item.orderDate, null, item.caseStatus || 'กำลังชำระบัญชี');
      if (!dur.hasData || dur.workingDays < 180) return false;
    }

    // 6. Search keyword
    if (ExportFilterState.search) {
      const q = ExportFilterState.search.toLowerCase();
      const dissolutionType = item.dissolutionType || (item.orderNumber && item.orderNumber.includes('ประกาศ') ? 'ประกาศเลิก' : 'คำสั่งเลิก');
      const liqText = getLiquidatorsSummaryText(item).toLowerCase();
      const issueText = getIssuesSummaryText(item).toLowerCase();
      const match = (
        (item.coopName && item.coopName.toLowerCase().includes(q)) ||
        (item.regNumber && item.regNumber.toLowerCase().includes(q)) ||
        (item.orderNumber && item.orderNumber.toLowerCase().includes(q)) ||
        (item.location && item.location.toLowerCase().includes(q)) ||
        (item.coopType && item.coopType.toLowerCase().includes(q)) ||
        (dissolutionType && dissolutionType.toLowerCase().includes(q)) ||
        liqText.includes(q) ||
        issueText.includes(q)
      );
      if (!match) return false;
    }

    return true;
  });
}

function getFilteredExportRegulations() {
  const allRegs = AppState.regulations || [];
  return allRegs.filter(item => {
    // 1. Module check
    if (ExportFilterState.module === 'CASES') return false;

    // 2. Scope / Status check
    const stepNum = parseInt(item.currentStep, 10) || 1;
    const isDone = item.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || item.status === 'รับจดทะเบียน/เห็นชอบแล้ว' || stepNum >= 4;
    if (ExportFilterState.scope === 'ACTIVE' && isDone) return false;
    if (ExportFilterState.scope === 'DONE' && !isDone) return false;

    // 3. Coop Type
    if (ExportFilterState.coopType !== 'ALL') {
      if (ExportFilterState.coopType === 'กลุ่มเกษตรกร') {
        if (!item.coopType || !item.coopType.includes('กลุ่มเกษตรกร')) return false;
      } else {
        if (item.coopType && item.coopType !== ExportFilterState.coopType) return false;
      }
    }

    // 4. Doc Type
    if (ExportFilterState.docType !== 'ALL') {
      if (item.docType !== ExportFilterState.docType) return false;
    }

    // 5. Reg Step
    if (ExportFilterState.regStep !== 'ALL') {
      if (stepNum !== parseInt(ExportFilterState.regStep, 10)) return false;
    }

    // 6. Issues / SLA
    const dur = getRegDuration(item);
    const isReturned = item.status === 'ส่งคืนแก้ไข';
    const isOverdue = dur.sla && dur.sla.isOverdue;
    if (ExportFilterState.issue === 'ISSUES' && !isReturned) return false;
    if (ExportFilterState.issue === 'NORMAL' && (isReturned || isOverdue)) return false;
    if (ExportFilterState.issue === 'OVERDUE' && !isOverdue) return false;

    // 7. Search keyword
    if (ExportFilterState.search) {
      const q = ExportFilterState.search.toLowerCase();
      const match = (
        (item.title && item.title.toLowerCase().includes(q)) ||
        (item.coopName && item.coopName.toLowerCase().includes(q)) ||
        (item.regNumber && item.regNumber.toLowerCase().includes(q)) ||
        (item.docNumber && item.docNumber.toLowerCase().includes(q)) ||
        (item.docType && item.docType.toLowerCase().includes(q)) ||
        (item.officerName && item.officerName.toLowerCase().includes(q)) ||
        (item.officerContact && item.officerContact.toLowerCase().includes(q)) ||
        (item.remarks && item.remarks.toLowerCase().includes(q)) ||
        (item.reviewNotes && item.reviewNotes.toLowerCase().includes(q))
      );
      if (!match) return false;
    }

    return true;
  });
}

function getActiveFilterSummaryText() {
  const parts = [];
  // Scope
  if (ExportFilterState.scope === 'ACTIVE') parts.push('สถานะ: กำลังดำเนินการ');
  else if (ExportFilterState.scope === 'DONE') parts.push('สถานะ: เสร็จสิ้น/อนุมัติแล้ว');
  else parts.push('สถานะ: ทุกสถานะ');

  // Module
  if (ExportFilterState.module === 'CASES') parts.push('หมวด: ชำระบัญชี');
  else if (ExportFilterState.module === 'REGS') parts.push('หมวด: ระเบียบข้อบังคับ');
  else parts.push('หมวด: รวม 2 ด้าน');

  // Coop Type
  if (ExportFilterState.coopType !== 'ALL') parts.push(`ประเภท: ${ExportFilterState.coopType}`);

  // Steps
  if (ExportFilterState.caseStep !== 'ALL') {
    if (ExportFilterState.caseStep === 'PHASE_1') parts.push('ขั้นชำระบัญชี: ขั้น 1-3');
    else if (ExportFilterState.caseStep === 'PHASE_2') parts.push('ขั้นชำระบัญชี: ขั้น 4-6');
    else if (ExportFilterState.caseStep === 'PHASE_3') parts.push('ขั้นชำระบัญชี: ขั้น 7-9');
    else if (ExportFilterState.caseStep === 'PHASE_4') parts.push('ขั้นชำระบัญชี: ขั้น 10');
    else parts.push(`ขั้นชำระบัญชี: ขั้นที่ ${ExportFilterState.caseStep}`);
  }
  if (ExportFilterState.regStep !== 'ALL') parts.push(`ขั้นระเบียบ: ขั้นที่ ${ExportFilterState.regStep}`);

  // Doc Type
  if (ExportFilterState.docType !== 'ALL') parts.push(`เอกสาร: ${ExportFilterState.docType}`);

  // Issues
  if (ExportFilterState.issue === 'ISSUES') parts.push('ประเด็น: มีปัญหาอุปสรรค/ส่งคืน');
  else if (ExportFilterState.issue === 'NORMAL') parts.push('ประเด็น: สถานะปกติ');
  else if (ExportFilterState.issue === 'OVERDUE') parts.push('ประเด็น: เกินกำหนด SLA');

  // Search
  if (ExportFilterState.search) parts.push(`คำค้นหา: "${ExportFilterState.search}"`);

  return parts.join(' | ');
}

function syncExportFilterInputs() {
  const selScope = document.getElementById('exportFilterScope');
  const selModule = document.getElementById('exportFilterModule');
  const selCoop = document.getElementById('exportFilterCoopType');
  const selCaseStep = document.getElementById('exportFilterCaseStep');
  const selRegStep = document.getElementById('exportFilterRegStep');
  const selDocType = document.getElementById('exportFilterDocType');
  const selIssue = document.getElementById('exportFilterIssue');
  const inputSearch = document.getElementById('exportSearchInput');
  const clearBtn = document.getElementById('exportSearchClearBtn');

  if (selScope) selScope.value = ExportFilterState.scope;
  if (selModule) selModule.value = ExportFilterState.module;
  if (selCoop) selCoop.value = ExportFilterState.coopType;
  if (selCaseStep) selCaseStep.value = ExportFilterState.caseStep;
  if (selRegStep) selRegStep.value = ExportFilterState.regStep;
  if (selDocType) selDocType.value = ExportFilterState.docType;
  if (selIssue) selIssue.value = ExportFilterState.issue;
  if (inputSearch) inputSearch.value = ExportFilterState.search || '';
  if (clearBtn) clearBtn.style.display = ExportFilterState.search ? 'block' : 'none';

  updateExportPresetPills();
}

function updateExportPresetPills() {
  const pActive = document.getElementById('presetActiveOnly');
  const pDone = document.getElementById('presetDoneOnly');
  const pAll = document.getElementById('presetAllRecords');
  const pIssues = document.getElementById('presetIssuesOnly');

  if (pActive) pActive.classList.toggle('active', ExportFilterState.scope === 'ACTIVE' && ExportFilterState.issue === 'ALL');
  if (pDone) pDone.classList.toggle('active', ExportFilterState.scope === 'DONE' && ExportFilterState.issue === 'ALL');
  if (pAll) pAll.classList.toggle('active', ExportFilterState.scope === 'ALL' && ExportFilterState.issue === 'ALL');
  if (pIssues) pIssues.classList.toggle('active', ExportFilterState.issue === 'ISSUES');
}

function renderExportFilterTags() {
  const tagsContainer = document.getElementById('exportTagsContainer');
  const tagsWrap = document.getElementById('exportActiveFilterTags');
  if (!tagsContainer || !tagsWrap) return;

  const chips = [];

  // Scope
  if (ExportFilterState.scope === 'ACTIVE') {
    chips.push({ key: 'scope', label: 'สถานะ: กำลังดำเนินการ', cls: '' });
  } else if (ExportFilterState.scope === 'DONE') {
    chips.push({ key: 'scope', label: 'สถานะ: เสร็จสิ้นแล้ว', cls: 'tag-done' });
  } else if (ExportFilterState.scope === 'ALL') {
    chips.push({ key: 'scope', label: 'สถานะ: ทุกสถานะ', cls: '' });
  }

  // Module
  if (ExportFilterState.module === 'CASES') chips.push({ key: 'module', label: 'หมวด: ชำระบัญชีเท่านั้น', cls: '' });
  else if (ExportFilterState.module === 'REGS') chips.push({ key: 'module', label: 'หมวด: ระเบียบข้อบังคับเท่านั้น', cls: '' });

  // Coop Type
  if (ExportFilterState.coopType !== 'ALL') chips.push({ key: 'coopType', label: `สถาบัน: ${ExportFilterState.coopType}`, cls: '' });

  // Steps
  if (ExportFilterState.caseStep !== 'ALL') {
    let stepLbl = ExportFilterState.caseStep;
    if (stepLbl === 'PHASE_1') stepLbl = 'ขั้น 1-3';
    else if (stepLbl === 'PHASE_2') stepLbl = 'ขั้น 4-6';
    else if (stepLbl === 'PHASE_3') stepLbl = 'ขั้น 7-9';
    else if (stepLbl === 'PHASE_4') stepLbl = 'ขั้น 10';
    else stepLbl = `ขั้นที่ ${stepLbl}`;
    chips.push({ key: 'caseStep', label: `ชำระบัญชี: ${stepLbl}`, cls: '' });
  }
  if (ExportFilterState.regStep !== 'ALL') chips.push({ key: 'regStep', label: `ระเบียบ: ขั้น ${ExportFilterState.regStep}`, cls: '' });

  // Doc Type
  if (ExportFilterState.docType !== 'ALL') chips.push({ key: 'docType', label: `เอกสาร: ${ExportFilterState.docType}`, cls: '' });

  // Issues
  if (ExportFilterState.issue === 'ISSUES') chips.push({ key: 'issue', label: '⚠️ มีปัญหา/ส่งคืน', cls: 'tag-issue' });
  else if (ExportFilterState.issue === 'NORMAL') chips.push({ key: 'issue', label: '✅ สถานะปกติ', cls: 'tag-done' });
  else if (ExportFilterState.issue === 'OVERDUE') chips.push({ key: 'issue', label: '⏰ เกินกำหนด SLA', cls: 'tag-issue' });

  // Search
  if (ExportFilterState.search) chips.push({ key: 'search', label: `🔍 "${ExportFilterState.search}"`, cls: '' });

  if (chips.length === 0) {
    tagsWrap.style.display = 'none';
    tagsContainer.innerHTML = '';
  } else {
    tagsWrap.style.display = 'flex';
    tagsContainer.innerHTML = chips.map(c => `
      <span class="export-tag-chip ${c.cls}">
        ${escapeHtml(c.label)}
        <span class="export-tag-remove" onclick="removeExportFilterTag('${c.key}')" title="ยกเลิกตัวกรองนี้">&times;</span>
      </span>
    `).join('');
  }
}

function removeExportFilterTag(key) {
  if (key === 'scope') ExportFilterState.scope = 'ACTIVE';
  else if (key === 'module') ExportFilterState.module = 'ALL';
  else if (key === 'coopType') ExportFilterState.coopType = 'ALL';
  else if (key === 'caseStep') ExportFilterState.caseStep = 'ALL';
  else if (key === 'regStep') ExportFilterState.regStep = 'ALL';
  else if (key === 'docType') ExportFilterState.docType = 'ALL';
  else if (key === 'issue') ExportFilterState.issue = 'ALL';
  else if (key === 'search') ExportFilterState.search = '';

  syncExportFilterInputs();
  handleExportFilterChange();
}

function handleExportFilterChange() {
  const selScope = document.getElementById('exportFilterScope');
  const selModule = document.getElementById('exportFilterModule');
  const selCoop = document.getElementById('exportFilterCoopType');
  const selCaseStep = document.getElementById('exportFilterCaseStep');
  const selRegStep = document.getElementById('exportFilterRegStep');
  const selDocType = document.getElementById('exportFilterDocType');
  const selIssue = document.getElementById('exportFilterIssue');
  const inputSearch = document.getElementById('exportSearchInput');
  const clearBtn = document.getElementById('exportSearchClearBtn');

  if (selScope) ExportFilterState.scope = selScope.value;
  if (selModule) ExportFilterState.module = selModule.value;
  if (selCoop) ExportFilterState.coopType = selCoop.value;
  if (selCaseStep) ExportFilterState.caseStep = selCaseStep.value;
  if (selRegStep) ExportFilterState.regStep = selRegStep.value;
  if (selDocType) ExportFilterState.docType = selDocType.value;
  if (selIssue) ExportFilterState.issue = selIssue.value;
  if (inputSearch) {
    ExportFilterState.search = inputSearch.value.trim();
    if (clearBtn) clearBtn.style.display = ExportFilterState.search ? 'block' : 'none';
  }

  updateExportPresetPills();

  // Module contextual visibility
  const caseStepWrap = document.getElementById('exportFilterCaseStepWrap');
  const regStepWrap = document.getElementById('exportFilterRegStepWrap');
  const docTypeWrap = document.getElementById('exportFilterDocTypeWrap');
  if (caseStepWrap) caseStepWrap.style.display = ExportFilterState.module === 'REGS' ? 'none' : 'flex';
  if (regStepWrap) regStepWrap.style.display = ExportFilterState.module === 'CASES' ? 'none' : 'flex';
  if (docTypeWrap) docTypeWrap.style.display = ExportFilterState.module === 'CASES' ? 'none' : 'flex';

  updateExportModalView();
}

function setExportScopePreset(presetKey) {
  if (presetKey === 'ACTIVE') {
    ExportFilterState.scope = 'ACTIVE';
    ExportFilterState.issue = 'ALL';
  } else if (presetKey === 'DONE') {
    ExportFilterState.scope = 'DONE';
    ExportFilterState.issue = 'ALL';
  } else if (presetKey === 'ALL') {
    ExportFilterState.scope = 'ALL';
    ExportFilterState.issue = 'ALL';
  } else if (presetKey === 'ISSUES') {
    ExportFilterState.scope = 'ALL';
    ExportFilterState.issue = 'ISSUES';
  }

  syncExportFilterInputs();
  handleExportFilterChange();
}

function resetExportFilters() {
  ExportFilterState.scope = 'ACTIVE';
  ExportFilterState.module = 'ALL';
  ExportFilterState.coopType = 'ALL';
  ExportFilterState.caseStep = 'ALL';
  ExportFilterState.regStep = 'ALL';
  ExportFilterState.docType = 'ALL';
  ExportFilterState.issue = 'ALL';
  ExportFilterState.search = '';

  syncExportFilterInputs();
  handleExportFilterChange();
  showToast('ล้างตัวกรองการส่งออกเรียบร้อยแล้ว', 'info');
}

function clearExportSearchInput() {
  const inputSearch = document.getElementById('exportSearchInput');
  if (inputSearch) inputSearch.value = '';
  handleExportFilterChange();
}

function updateExportModalView() {
  const filteredCases = getFilteredExportCases();
  const filteredRegs = getFilteredExportRegulations();

  const totalCount = filteredCases.length + filteredRegs.length;
  const casesIssues = filteredCases.filter(c => hasCaseIssues(c)).length;
  const regsIssues = filteredRegs.filter(r => r.status === 'ส่งคืนแก้ไข').length;
  const totalIssues = casesIssues + regsIssues;

  // Update KPI counters
  const elTotal = document.getElementById('exportKpiTotalActive');
  const elCases = document.getElementById('exportKpiActiveCases');
  const elRegs = document.getElementById('exportKpiActiveRegs');
  const elIssues = document.getElementById('exportKpiTotalIssues');
  const badgeCases = document.getElementById('exportTabCasesBadge');
  const badgeRegs = document.getElementById('exportTabRegsBadge');
  const matchedText = document.getElementById('exportFilterMatchedText');

  if (elTotal) elTotal.innerText = totalCount;
  if (elCases) elCases.innerText = filteredCases.length;
  if (elRegs) elRegs.innerText = filteredRegs.length;
  if (elIssues) elIssues.innerText = totalIssues;
  if (badgeCases) badgeCases.innerText = filteredCases.length;
  if (badgeRegs) badgeRegs.innerText = filteredRegs.length;
  if (matchedText) matchedText.innerText = `พบ ${totalCount} รายการ`;

  // Render Table Previews
  renderActiveExportTables(filteredCases, filteredRegs);

  // Render Active Filter Tag Chips
  renderExportFilterTags();

  // If user selected only CASES or only REGS, switch tab appropriately
  if (ExportFilterState.module === 'CASES' && ExportFilterState.activeTab === 'regs') {
    switchActiveExportTab('cases');
  } else if (ExportFilterState.module === 'REGS' && ExportFilterState.activeTab === 'cases') {
    switchActiveExportTab('regs');
  }
}

async function openActiveExportModal() {
  if ((!AppState.cases || AppState.cases.length === 0) || (!AppState.regulations || AppState.regulations.length === 0)) {
    setLoading(true);
    try {
      await Promise.all([loadCasesData(), loadRegulationsData()]);
    } catch (e) {
      console.warn('Load data error for active export modal:', e);
    } finally {
      setLoading(false);
    }
  }

  // Sync modal inputs from ExportFilterState
  syncExportFilterInputs();

  // Update view (KPIs, Badges, Tables, Filter Tags)
  updateExportModalView();

  // Default to Tab 1 (Cases)
  switchActiveExportTab('cases');

  openModal('activeExportModal');
}

function renderActiveExportTables(casesToRender, regsToRender) {
  const tbodyCases = document.getElementById('exportCasesTableBody');
  const tbodyRegs = document.getElementById('exportRegsTableBody');

  if (tbodyCases) {
    if (casesToRender.length === 0) {
      tbodyCases.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">
            <div style="font-size: 1.5rem; margin-bottom: 6px;">🔍</div>
            <div style="font-weight: 600;">ไม่พบข้อมูลสหกรณ์ชำระบัญชีที่ตรงตามตัวกรอง</div>
            <div style="font-size: 0.78rem; margin-top: 4px;">ลองปรับเปลี่ยนตัวกรอง หรือกดปุ่ม <a href="javascript:void(0)" onclick="resetExportFilters()" style="color: #0284c7; text-decoration: underline;">ล้างตัวกรอง</a></div>
          </td>
        </tr>
      `;
    } else {
      tbodyCases.innerHTML = casesToRender.map((item, idx) => {
        const dissolutionType = item.dissolutionType || (item.orderNumber && item.orderNumber.includes('ประกาศ') ? 'ประกาศเลิก' : 'คำสั่งเลิก');
        const liqName = getLiquidatorsSummaryText(item);
        const curStepNum = parseInt(item.currentStep, 10) || 1;
        const dur = WorkingDaysUtil.calculate(item.orderDate, null, item.caseStatus || 'กำลังชำระบัญชี');
        const issuesText = getIssuesSummaryText(item);

        let stepGroup = '🌱 ขั้น 1-3';
        if (curStepNum >= 10) stepGroup = '🏁 ขั้น 10 (เสร็จสิ้น)';
        else if (curStepNum >= 7) stepGroup = '📑 ขั้น 7-9';
        else if (curStepNum >= 4) stepGroup = '⚖️ ขั้น 4-6';

        return `
          <tr>
            <td style="text-align: center; color: var(--text-muted); font-weight: 500;">${idx + 1}</td>
            <td>
              <div style="font-weight: 600; color: var(--primary);">${escapeHtml(item.coopName)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">เลขทะเบียน: ${escapeHtml(item.regNumber || '-')} | ที่ตั้ง: ${escapeHtml(item.location || '-')}</div>
            </td>
            <td><span class="case-type-badge coop-type-badge">${escapeHtml(item.coopType || '-')}</span></td>
            <td>
              <div><strong>${escapeHtml(item.orderNumber || '-')}</strong></div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(dissolutionType)} (${formatThaiDate(item.orderDate)})</div>
            </td>
            <td>
              <div style="font-weight: 600; color: #0369a1; font-size: 0.8rem;">${stepGroup} (ขั้นที่ ${curStepNum}/10)</div>
              <div class="progress-bar-bg" style="height: 5px; width: 80px; margin-top: 3px;">
                <div class="progress-bar-fill" style="width: ${curStepNum * 10}%;"></div>
              </div>
            </td>
            <td style="font-size: 0.78rem;">${escapeHtml(liqName)}</td>
            <td style="text-align: center; font-weight: 600; color: var(--primary);">
              ${dur.hasData ? `${dur.workingDays} วัน` : '-'}
            </td>
            <td>
              ${issuesText ? `<span class="status-badge issue" style="font-size: 0.72rem;">⚠️ ${escapeHtml(issuesText)}</span>` : '<span class="status-badge" style="background:#ecfdf5; color:#059669; font-size: 0.72rem;">ปกติ</span>'}
            </td>
          </tr>
        `;
      }).join('');
    }
  }

  if (tbodyRegs) {
    if (regsToRender.length === 0) {
      tbodyRegs.innerHTML = `
        <tr>
          <td colspan="8" style="text-align: center; color: var(--text-muted); padding: 30px;">
            <div style="font-size: 1.5rem; margin-bottom: 6px;">🔍</div>
            <div style="font-weight: 600;">ไม่พบข้อมูลระเบียบและข้อบังคับที่ตรงตามตัวกรอง</div>
            <div style="font-size: 0.78rem; margin-top: 4px;">ลองปรับเปลี่ยนตัวกรอง หรือกดปุ่ม <a href="javascript:void(0)" onclick="resetExportFilters()" style="color: #0284c7; text-decoration: underline;">ล้างตัวกรอง</a></div>
          </td>
        </tr>
      `;
    } else {
      tbodyRegs.innerHTML = regsToRender.map((item, idx) => {
        const curStepNum = parseInt(item.currentStep, 10) || 1;
        const dur = getRegDuration(item);
        const isReturned = item.status === 'ส่งคืนแก้ไข';
        const typeBadgeClass = item.docType === 'ข้อบังคับสหกรณ์' ? 'reg-type-bylaw' : 'reg-type-rule';

        return `
          <tr>
            <td style="text-align: center; color: var(--text-muted); font-weight: 500;">${idx + 1}</td>
            <td>
              <div style="font-weight: 600; color: var(--primary);">${escapeHtml(item.title)}</div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">${escapeHtml(item.coopName)} (${escapeHtml(item.regNumber || '-')})</div>
            </td>
            <td><span class="case-type-badge ${typeBadgeClass}">${escapeHtml(item.docType || 'ข้อบังคับ')}</span></td>
            <td>
              <div><strong>${escapeHtml(item.docNumber || '-')}</strong></div>
              <div style="font-size: 0.75rem; color: var(--text-muted);">ยื่น: ${formatThaiDate(item.submitDate)}</div>
            </td>
            <td>
              <div style="font-weight: 600; color: #0d9488; font-size: 0.8rem;">ขั้นที่ ${curStepNum}/${CONFIG.REGULATION_STEPS?.length || 4}</div>
              <div style="font-size: 0.72rem; color: var(--text-muted);">${escapeHtml(CONFIG.REGULATION_STEPS[curStepNum - 1]?.title || '')}</div>
            </td>
            <td style="font-size: 0.78rem;">
              <div>${escapeHtml(item.officerName || '-')}</div>
              ${item.officerContact ? `<div style="font-size: 0.7rem; color: var(--text-muted);">${escapeHtml(item.officerContact)}</div>` : ''}
            </td>
            <td style="text-align: center; font-weight: 600; color: var(--primary);">
              ${dur.hasData ? `${dur.workingDays} วัน` : '-'}
            </td>
            <td style="text-align: center;">
              <span class="status-badge ${isReturned ? 'issue' : 'active'}" style="font-size: 0.72rem;">
                ${isReturned ? '⚠️ ส่งคืนแก้ไข' : '● ' + escapeHtml(item.status || 'อยู่ระหว่างพิจารณา')}
              </span>
            </td>
          </tr>
        `;
      }).join('');
    }
  }
}

function switchActiveExportTab(tabName) {
  ExportFilterState.activeTab = tabName;
  const btnCases = document.getElementById('btnExportTabCases');
  const btnRegs = document.getElementById('btnExportTabRegs');
  const contentCases = document.getElementById('exportTabContentCases');
  const contentRegs = document.getElementById('exportTabContentRegs');

  if (tabName === 'cases') {
    if (btnCases) btnCases.classList.add('active');
    if (btnRegs) btnRegs.classList.remove('active');
    if (contentCases) { contentCases.style.display = 'block'; contentCases.classList.add('active'); }
    if (contentRegs) { contentRegs.style.display = 'none'; contentRegs.classList.remove('active'); }
  } else {
    if (btnRegs) btnRegs.classList.add('active');
    if (btnCases) btnCases.classList.remove('active');
    if (contentRegs) { contentRegs.style.display = 'block'; contentRegs.classList.add('active'); }
    if (contentCases) { contentCases.style.display = 'none'; contentCases.classList.remove('active'); }
  }
}

function filterActiveExportPreview(query) {
  ExportFilterState.search = (query || '').trim();
  const inputSearch = document.getElementById('exportSearchInput');
  if (inputSearch && inputSearch.value !== ExportFilterState.search) {
    inputSearch.value = ExportFilterState.search;
  }
  handleExportFilterChange();
}

// 11. Export Filtered Operations to Excel (.xlsx) with Multi-Sheets
async function exportCombinedActiveExcel() {
  if (typeof XLSX === 'undefined') {
    showToast('กำลังโหลดโมดูล Excel กรุณารอสักครู่...', 'info');
    return;
  }

  if ((!AppState.cases || AppState.cases.length === 0) || (!AppState.regulations || AppState.regulations.length === 0)) {
    setLoading(true);
    try {
      await Promise.all([loadCasesData(), loadRegulationsData()]);
    } catch (e) {
      console.warn('Load data error for Excel export:', e);
    } finally {
      setLoading(false);
    }
  }

  const filteredCases = getFilteredExportCases();
  const filteredRegs = getFilteredExportRegulations();
  const totalCount = filteredCases.length + filteredRegs.length;

  if (totalCount === 0) {
    showToast('ไม่มีรายการข้อมูลตรงตามตัวกรองที่เลือกสำหรับการส่งออก Excel', 'warning');
    return;
  }

  const printDateStr = formatThaiDateTime(new Date());
  const filterSummary = getActiveFilterSummaryText();
  const wb = XLSX.utils.book_new();

  // ----------------------------------------------------
  // Sheet 1: งานชำระบัญชี (ตามตัวกรอง)
  // ----------------------------------------------------
  if (ExportFilterState.module !== 'REGS') {
    const caseHeader = [
      ["ระบบติดตามการชำระบัญชีสหกรณ์ กรมส่งเสริมสหกรณ์"],
      ["รายงานรายการสหกรณ์ชำระบัญชี (ตามเงื่อนไขตัวกรอง)"],
      [`เงื่อนไขตัวกรอง: ${filterSummary}`],
      [`ข้อมูล ณ วันที่: ${printDateStr}`, `จำนวนทั้งหมด: ${filteredCases.length} แห่ง`],
      [],
      [
        "ลำดับ",
        "ชื่อสหกรณ์ / สถาบันเกษตรกร",
        "เลขทะเบียนสหกรณ์",
        "ที่ตั้ง (จังหวัด/อำเภอ)",
        "ประเภทสถาบัน",
        "ประเภทการเลิก",
        "เลขที่คำสั่ง/ประกาศ",
        "วันที่สั่งเลิก",
        "ขั้นตอนปัจจุบัน",
        "ชื่อขั้นตอนมาตรฐาน",
        "ความคืบหน้า (%)",
        "รายชื่อผู้ชำระบัญชี",
        "ระยะเวลาสะสม (วันทำการ)",
        "สถานะการดำเนินงาน",
        "ปัญหาและอุปสรรค",
        "วันที่ปรับปรุงข้อมูลล่าสุด"
      ]
    ];

    const caseRows = filteredCases.map((item, idx) => {
      const dissolutionType = item.dissolutionType || (item.orderNumber && item.orderNumber.includes('ประกาศ') ? 'ประกาศเลิก' : 'คำสั่งเลิก');
      const liqName = getLiquidatorsSummaryText(item);
      const curStepNum = parseInt(item.currentStep, 10) || 1;
      const dur = WorkingDaysUtil.calculate(item.orderDate, null, item.caseStatus || 'กำลังชำระบัญชี');
      const stepTitle = CONFIG.LIQUIDATION_STEPS[curStepNum - 1]?.title || `ขั้นที่ ${curStepNum}`;

      return [
        idx + 1,
        item.coopName || '-',
        item.regNumber || '-',
        item.location || '-',
        item.coopType || '-',
        dissolutionType,
        item.orderNumber || '-',
        formatThaiDate(item.orderDate),
        `ขั้นที่ ${curStepNum}/10`,
        stepTitle,
        `${curStepNum * 10}%`,
        liqName,
        dur.hasData ? dur.workingDays : 0,
        item.caseStatus || 'กำลังชำระบัญชี',
        getIssuesSummaryText(item) || 'ปกติ',
        formatThaiDate(item.updatedAt || item.createdAt)
      ];
    });

    const wsCasesData = [...caseHeader, ...caseRows];
    const wsCases = XLSX.utils.aoa_to_sheet(wsCasesData);
    wsCases['!cols'] = [
      { wch: 6 },  // ลำดับ
      { wch: 36 }, // ชื่อสหกรณ์
      { wch: 18 }, // เลขทะเบียน
      { wch: 22 }, // ที่ตั้ง
      { wch: 22 }, // ประเภทสถาบัน
      { wch: 15 }, // ประเภทการเลิก
      { wch: 22 }, // เลขที่คำสั่ง
      { wch: 14 }, // วันที่สั่งเลิก
      { wch: 14 }, // ขั้นตอน
      { wch: 40 }, // ชื่อขั้นตอน
      { wch: 14 }, // ความคืบหน้า
      { wch: 30 }, // ผู้ชำระบัญชี
      { wch: 22 }, // ระยะเวลาวันทำการ
      { wch: 18 }, // สถานะ
      { wch: 35 }, // ปัญหาอุปสรรค
      { wch: 18 }  // วันที่ปรับปรุง
    ];
    XLSX.utils.book_append_sheet(wb, wsCases, "งานชำระบัญชี");
  }

  // ----------------------------------------------------
  // Sheet 2: ระเบียบข้อบังคับ (ตามตัวกรอง)
  // ----------------------------------------------------
  if (ExportFilterState.module !== 'CASES') {
    const regHeader = [
      ["ระบบติดตามการพิจารณาระเบียบและข้อบังคับสหกรณ์ กรมส่งเสริมสหกรณ์"],
      ["รายงานรายการระเบียบและข้อบังคับ (ตามเงื่อนไขตัวกรอง)"],
      [`เงื่อนไขตัวกรอง: ${filterSummary}`],
      [`ข้อมูล ณ วันที่: ${printDateStr}`, `จำนวนทั้งหมด: ${filteredRegs.length} เรื่อง`],
      [],
      [
        "ลำดับ",
        "ชื่อเรื่อง ระเบียบ/ข้อบังคับ",
        "ชื่อสหกรณ์ / สถาบันเกษตรกร",
        "เลขทะเบียนสหกรณ์",
        "ประเภทเอกสาร",
        "กรอบเวลา SLA (วัน)",
        "สถานะ SLA",
        "เลขที่หนังสือยื่น",
        "วันที่ฝ่ายลงรับหนังสือ",
        "ขั้นตอนปัจจุบัน",
        "ชื่อขั้นตอนการพิจารณา",
        "เจ้าหน้าที่ผู้รับผิดชอบ",
        "เบอร์ติดต่อเจ้าหน้าที่",
        "ระยะเวลาสะสม (วันทำการ)",
        "สถานะการพิจารณา",
        "ข้อตรวจพบ/หมายเหตุ",
        "วันที่ปรับปรุงข้อมูลล่าสุด"
      ]
    ];

    const regRows = filteredRegs.map((item, idx) => {
      const curStepNum = parseInt(item.currentStep, 10) || 1;
      const dur = getRegDuration(item);
      const stepTitle = CONFIG.REGULATION_STEPS[curStepNum - 1]?.title || `ขั้นที่ ${curStepNum}`;
      const sla = dur.sla;

      return [
        idx + 1,
        item.title || '-',
        item.coopName || '-',
        item.regNumber || '-',
        (sla && sla.conf && sla.conf.label) || item.docType || 'ข้อบังคับ',
        sla ? sla.slaDays : 14,
        sla ? sla.badgeText : '-',
        item.docNumber || '-',
        formatThaiDate(item.receiveDate || item.submitDate),
        `ขั้นที่ ${curStepNum}/${CONFIG.REGULATION_STEPS?.length || 4}`,
        stepTitle,
        item.officerName || '-',
        item.officerContact || '-',
        dur.hasData ? dur.workingDays : 0,
        item.status || 'อยู่ระหว่างพิจารณา',
        item.remarks || item.reviewNotes || '-',
        formatThaiDate(item.updatedAt || item.createdAt)
      ];
    });

    const wsRegsData = [...regHeader, ...regRows];
    const wsRegs = XLSX.utils.aoa_to_sheet(wsRegsData);
    wsRegs['!cols'] = [
      { wch: 6 },  // ลำดับ
      { wch: 38 }, // ชื่อเรื่อง
      { wch: 35 }, // ชื่อสหกรณ์
      { wch: 18 }, // เลขทะเบียน
      { wch: 20 }, // ประเภทเอกสาร
      { wch: 16 }, // SLA
      { wch: 18 }, // สถานะ SLA
      { wch: 20 }, // เลขที่ยื่น
      { wch: 14 }, // วันที่ยื่น
      { wch: 14 }, // ขั้นตอน
      { wch: 38 }, // ชื่อขั้นตอน
      { wch: 24 }, // เจ้าหน้าที่
      { wch: 18 }, // เบอร์ติดต่อ
      { wch: 22 }, // ระยะเวลาวันทำการ
      { wch: 20 }, // สถานะ
      { wch: 35 }, // หมายเหตุ
      { wch: 18 }  // วันที่ปรับปรุง
    ];
    XLSX.utils.book_append_sheet(wb, wsRegs, "งานระเบียบข้อบังคับ");
  }

  // ----------------------------------------------------
  // Sheet 3: สรุปภาพรวม (Summary KPIs & Filter Info)
  // ----------------------------------------------------
  const casesWithIssues = filteredCases.filter(c => hasCaseIssues(c)).length;
  const regsWithIssues = filteredRegs.filter(r => r.status === 'ส่งคืนแก้ไข').length;
  const totalIssues = casesWithIssues + regsWithIssues;

  const overviewData = [
    ["ระบบศูนย์บริการงานนายทะเบียนและส่งเสริมสหกรณ์ กรมส่งเสริมสหกรณ์"],
    ["รายงานสรุปภาพรวมข้อมูลตามตัวกรอง (Filtered Operations Summary)"],
    [],
    ["หัวข้อสรุป", "จำนวนตัวเลข", "หน่วยนับ", "คำอธิบาย"],
    ["1. รายการที่ตรงตามตัวกรองทั้งหมด", totalCount, "เรื่อง", "รวมทั้งงานชำระบัญชีและงานระเบียบข้อบังคับตามตัวกรอง"],
    ["2. รายการชำระบัญชีสหกรณ์", filteredCases.length, "แห่ง", "ตรงตามเงื่อนไขตัวกรอง"],
    ["3. รายการระเบียบและข้อบังคับสหกรณ์", filteredRegs.length, "เรื่อง", "ตรงตามเงื่อนไขตัวกรอง"],
    ["4. รายการที่มีปัญหาอุปสรรค / ส่งคืนแก้ไข", totalIssues, "เรื่อง", `ชำระบัญชีมีปัญหา: ${casesWithIssues} แห่ง | ระเบียบส่งคืน: ${regsWithIssues} เรื่อง`],
    [],
    ["เงื่อนไขตัวกรองที่เลือกใช้งาน", filterSummary, "", ""],
    ["วันที่ส่งออกรายงาน", printDateStr, "", ""],
    ["ผู้จัดทำรายงาน", AppState.currentUser ? (AppState.currentUser.name || AppState.currentUser.email) : "เจ้าหน้าที่กลุ่มส่งเสริมและพัฒนาการบริหารการจัดการสหกรณ์", "", ""]
  ];

  const wsOverview = XLSX.utils.aoa_to_sheet(overviewData);
  wsOverview['!cols'] = [
    { wch: 35 },
    { wch: 30 },
    { wch: 14 },
    { wch: 50 }
  ];
  XLSX.utils.book_append_sheet(wb, wsOverview, "ภาพรวมสรุป");

  const filename = `รายงานสรุปข้อมูล_${todayThaiDate().replace(/\//g, '-')}.xlsx`;
  XLSX.writeFile(wb, filename);

  showToast(`ส่งออกไฟล์ Excel (${filename}) ตามตัวกรองสำเร็จ (${totalCount} รายการ)`, 'success');
}

// 12. Export Filtered CSV (UTF-8 with Thai BOM)
function exportCombinedActiveCsv() {
  const filteredCases = getFilteredExportCases();
  const filteredRegs = getFilteredExportRegulations();
  const totalCount = filteredCases.length + filteredRegs.length;

  if (totalCount === 0) {
    showToast('ไม่มีรายการข้อมูลตรงตามตัวกรองที่เลือกสำหรับการส่งออก CSV', 'warning');
    return;
  }

  const printDateStr = formatThaiDateTime(new Date());
  const filterSummary = getActiveFilterSummaryText();
  let csvContent = '\uFEFF'; // UTF-8 BOM for Excel Thai

  csvContent += `# รายงานสรุปข้อมูลศูนย์บริการงานนายทะเบียนและส่งเสริมสหกรณ์\r\n`;
  csvContent += `# วันที่ส่งออก: ${printDateStr}\r\n`;
  csvContent += `# เงื่อนไขตัวกรอง: ${filterSummary}\r\n`;
  csvContent += `# จำนวนรายการทั้งหมด: ${totalCount} เรื่อง (ชำระบัญชี: ${filteredCases.length}, ระเบียบ: ${filteredRegs.length})\r\n\r\n`;

  if (ExportFilterState.module !== 'REGS' && filteredCases.length > 0) {
    csvContent += "=== หมวดที่ 1: รายการสหกรณ์ชำระบัญชี ===\r\n";
    csvContent += "ลำดับ,ชื่อสหกรณ์,เลขทะเบียน,ที่ตั้ง,ประเภทสถาบัน,ประเภทการเลิก,เลขที่คำสั่ง/ประกาศ,วันที่สั่งเลิก,ขั้นตอนปัจจุบัน,ความคืบหน้า,ผู้ชำระบัญชี,วันทำการสะสม,สถานะ,ปัญหาอุปสรรค\r\n";
    
    filteredCases.forEach((item, idx) => {
      const dissolutionType = item.dissolutionType || (item.orderNumber && item.orderNumber.includes('ประกาศ') ? 'ประกาศเลิก' : 'คำสั่งเลิก');
      const liqName = getLiquidatorsSummaryText(item);
      const curStepNum = parseInt(item.currentStep, 10) || 1;
      const dur = WorkingDaysUtil.calculate(item.orderDate, null, item.caseStatus || 'กำลังชำระบัญชี');

      const row = [
        idx + 1,
        `"${(item.coopName || '').replace(/"/g, '""')}"`,
        `"${(item.regNumber || '').replace(/"/g, '""')}"`,
        `"${(item.location || '').replace(/"/g, '""')}"`,
        `"${(item.coopType || '').replace(/"/g, '""')}"`,
        `"${dissolutionType}"`,
        `"${(item.orderNumber || '').replace(/"/g, '""')}"`,
        `"${formatThaiDate(item.orderDate)}"`,
        `"ขั้นที่ ${curStepNum}/10"`,
        `"${curStepNum * 10}%"`,
        `"${liqName.replace(/"/g, '""')}"`,
        dur.hasData ? dur.workingDays : 0,
        `"${item.caseStatus || 'กำลังชำระบัญชี'}"`,
        `"${(getIssuesSummaryText(item) || 'ปกติ').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(',') + "\r\n";
    });
  }

  if (ExportFilterState.module !== 'CASES' && filteredRegs.length > 0) {
    csvContent += "\r\n=== หมวดที่ 2: รายการระเบียบและข้อบังคับสหกรณ์ ===\r\n";
    csvContent += "ลำดับ,ชื่อเรื่องระเบียบ/ข้อบังคับ,ชื่อสหกรณ์,เลขทะเบียน,ประเภทเอกสาร,กรอบเวลา SLA (วัน),สถานะ SLA,เลขที่ยื่น,วันที่ฝ่ายลงรับหนังสือ,ขั้นตอนปัจจุบัน,จนท.ผู้รับผิดชอบ,เบอร์ติดต่อ,วันทำการสะสม,สถานะ,ข้อตรวจพบ/หมายเหตุ\r\n";

    filteredRegs.forEach((item, idx) => {
      const curStepNum = parseInt(item.currentStep, 10) || 1;
      const dur = getRegDuration(item);
      const sla = dur.sla;

      const row = [
        idx + 1,
        `"${(item.title || '').replace(/"/g, '""')}"`,
        `"${(item.coopName || '').replace(/"/g, '""')}"`,
        `"${(item.regNumber || '').replace(/"/g, '""')}"`,
        `"${(sla && sla.conf && sla.conf.label) || item.docType || 'ข้อบังคับ'}"`,
        sla ? sla.slaDays : 14,
        `"${(sla ? sla.badgeText : '-').replace(/"/g, '""')}"`,
        `"${(item.docNumber || '').replace(/"/g, '""')}"`,
        `"${formatThaiDate(item.receiveDate || item.submitDate)}"`,
        `"ขั้นที่ ${curStepNum}/${CONFIG.REGULATION_STEPS?.length || 4}"`,
        `"${(item.officerName || '').replace(/"/g, '""')}"`,
        `"${(item.officerContact || '').replace(/"/g, '""')}"`,
        dur.hasData ? dur.workingDays : 0,
        `"${item.status || 'อยู่ระหว่างพิจารณา'}"`,
        `"${(item.remarks || item.reviewNotes || '-').replace(/"/g, '""')}"`
      ];
      csvContent += row.join(',') + "\r\n";
    });
  }

  const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.setAttribute('href', url);
  link.setAttribute('download', `รายงานสรุปข้อมูล_${todayThaiDate().replace(/\//g, '-')}.csv`);
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);

  showToast(`ส่งออกไฟล์ CSV ตามตัวกรองสำเร็จ (${totalCount} รายการ)`, 'success');
}

function triggerActiveExportDirectPrint() {
  exportAllActiveOperationsPdf();
  setTimeout(() => {
    triggerPrintDialog();
  }, 400);
}

// Expose PDF and Active Export functions to global window scope
window.exportCurrentCasePdf = exportCurrentCasePdf;
window.exportCurrentRegPdf = exportCurrentRegPdf;
window.exportCasesListPdf = exportCasesListPdf;
window.exportRegulationsListPdf = exportRegulationsListPdf;
window.exportAllActiveOperationsPdf = exportAllActiveOperationsPdf;
window.exportActiveCasesOnlyPdf = exportActiveCasesOnlyPdf;
window.exportActiveRegulationsOnlyPdf = exportActiveRegulationsOnlyPdf;
window.quickExportCasePdf = quickExportCasePdf;
window.quickExportRegPdf = quickExportRegPdf;
window.openPdfPreview = openPdfPreview;
window.triggerDirectPdfDownload = triggerDirectPdfDownload;
window.triggerPrintDialog = triggerPrintDialog;
window.openActiveExportModal = openActiveExportModal;
window.switchActiveExportTab = switchActiveExportTab;
window.filterActiveExportPreview = filterActiveExportPreview;
window.exportCombinedActiveExcel = exportCombinedActiveExcel;
window.exportCombinedActiveCsv = exportCombinedActiveCsv;
window.handleExportFilterChange = handleExportFilterChange;
window.clearExportSearchInput = clearExportSearchInput;
window.setExportScopePreset = setExportScopePreset;
window.resetExportFilters = resetExportFilters;
window.removeExportFilterTag = removeExportFilterTag;
window.openUpdateRegMilestonesModal = openUpdateRegMilestonesModal;
window.handleUpdateRegMilestonesSubmit = handleUpdateRegMilestonesSubmit;
window.openUpdateRegStepModal = openUpdateRegStepModal;
window.handleUpdateRegStepSubmit = handleUpdateRegStepSubmit;
window.triggerActiveExportDirectPrint = triggerActiveExportDirectPrint;

// ------------------------------------------------------------------------------
// 15. Cooperative Directory & Smart Autocomplete Module
// ------------------------------------------------------------------------------

/**
 * Highlight matching text portions with <span class="coop-item-highlight">
 */
function highlightCoopMatch(text, query) {
  if (!text) return '';
  if (!query || !query.trim()) return escapeHtml(text);
  const q = query.trim().replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const regex = new RegExp(`(${q})`, 'gi');
  return escapeHtml(text).replace(regex, '<span class="coop-item-highlight">$1</span>');
}

/**
 * Setup smart autocomplete dropdown for a cooperative input
 */
function setupCoopAutocomplete(inputId, dropdownId, onSelect) {
  const input = document.getElementById(inputId);
  const dropdown = document.getElementById(dropdownId);
  if (!input || !dropdown) return;

  let activeIndex = -1;
  let currentResults = [];

  function closeDropdown() {
    dropdown.style.display = 'none';
    dropdown.innerHTML = '';
    activeIndex = -1;
    currentResults = [];
  }

  function renderResults(results, query) {
    if (!query || query.trim().length === 0) {
      closeDropdown();
      return;
    }
    currentResults = results;
    activeIndex = -1;
    if (!results || results.length === 0) {
      dropdown.innerHTML = `
        <div style="padding: 10px 14px; color: var(--text-muted); font-size: 0.84rem; text-align: center;">
          🔍 ไม่พบสหกรณ์ที่ตรงกับ "<strong>${escapeHtml(query)}</strong>"
          <div style="margin-top: 4px;">
            <a href="javascript:void(0)" onclick="openCoopDirectoryModal(); toggleBatchImportForm(true);" style="color: var(--primary); font-weight: 500; text-decoration: underline;">
              📥 คลิกที่นี่เพื่อนำเข้ารายชื่อสหกรณ์เข้ากลุ่มส่งเสริมฯ
            </a>
          </div>
        </div>
      `;
      dropdown.style.display = 'block';
      return;
    }

    const itemsHtml = results.slice(0, 10).map((coop, idx) => {
      const groupBadge = getGroupBadgeHtml(coop.group);
      const isFarmer = coop.type && coop.type.includes('กลุ่มเกษตรกร');
      const typeBadge = `<span class="case-type-badge ${isFarmer ? 'farmer-group' : 'coop-type-badge'}" style="font-size: 0.68rem; padding: 1px 6px;">${escapeHtml(coop.type || 'สหกรณ์')}</span>`;
      const highlightedName = highlightCoopMatch(coop.name, query);
      const districtText = coop.district ? `📍 ${escapeHtml(coop.district)}` : '';
      const regText = coop.regNumber ? ` | 📄 เลขทะเบียน ${escapeHtml(coop.regNumber)}` : '';

      return `
        <div class="coop-autocomplete-item" data-index="${idx}">
          <div class="coop-item-main">
            <div class="coop-item-name">${highlightedName}</div>
            <div class="coop-item-badges">
              ${groupBadge}
              ${typeBadge}
            </div>
          </div>
          <div class="coop-item-sub">
            ${districtText}${regText}
          </div>
        </div>
      `;
    }).join('');

    dropdown.innerHTML = itemsHtml;
    dropdown.style.display = 'block';

    // Bind click events on items
    dropdown.querySelectorAll('.coop-autocomplete-item').forEach(itemEl => {
      itemEl.addEventListener('mousedown', (e) => {
        e.preventDefault(); // prevent blur before click completes
        const idx = parseInt(itemEl.dataset.index, 10);
        if (currentResults[idx]) {
          onSelect(currentResults[idx]);
          closeDropdown();
        }
      });
    });
  }

  function updateItemHighlight() {
    const items = dropdown.querySelectorAll('.coop-autocomplete-item');
    items.forEach((item, idx) => {
      item.classList.toggle('selected', idx === activeIndex);
      if (idx === activeIndex) {
        item.scrollIntoView({ block: 'nearest' });
      }
    });
  }

  input.addEventListener('input', () => {
    const q = input.value.trim();
    if (q.length === 0) {
      closeDropdown();
      return;
    }
    const results = CoopDatabaseUtil.search(q);
    renderResults(results, q);
  });

  input.addEventListener('focus', () => {
    const q = input.value.trim();
    if (q.length === 0) {
      closeDropdown();
    } else {
      const results = CoopDatabaseUtil.search(q);
      renderResults(results, q);
    }
  });

  input.addEventListener('keydown', (e) => {
    if (dropdown.style.display !== 'block') return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (currentResults.length > 0) {
        activeIndex = (activeIndex + 1) % Math.min(currentResults.length, 10);
        updateItemHighlight();
      }
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (currentResults.length > 0) {
        activeIndex = (activeIndex - 1 + Math.min(currentResults.length, 10)) % Math.min(currentResults.length, 10);
        updateItemHighlight();
      }
    } else if (e.key === 'Enter') {
      if (activeIndex >= 0 && currentResults[activeIndex]) {
        e.preventDefault();
        onSelect(currentResults[activeIndex]);
        closeDropdown();
      }
    } else if (e.key === 'Escape') {
      closeDropdown();
    }
  });

  document.addEventListener('click', (e) => {
    if (!input.contains(e.target) && !dropdown.contains(e.target)) {
      closeDropdown();
    }
  });
}

/**
 * Initialize autocompletes on all creation and editing modals
 */
function setupCooperativeAutocompletes() {
  // 1. Create Regulation Modal
  setupCoopAutocomplete('createRegCoopName', 'createRegCoopDropdown', (coop) => {
    const nameInput = document.getElementById('createRegCoopName');
    if (nameInput) nameInput.value = coop.name;

    const typeSelect = document.getElementById('createRegCoopType');
    if (typeSelect && coop.type) typeSelect.value = coop.type;

    const groupSelect = document.getElementById('createRegPromotionGroup');
    if (groupSelect && coop.group) groupSelect.value = coop.group;

    const regNumInput = document.getElementById('createRegNumber');
    if (regNumInput && coop.regNumber) regNumInput.value = coop.regNumber;
  });

  // 2. Edit Regulation Modal
  setupCoopAutocomplete('editRegCoopName', 'editRegCoopDropdown', (coop) => {
    const nameInput = document.getElementById('editRegCoopName');
    if (nameInput) nameInput.value = coop.name;

    const typeSelect = document.getElementById('editRegCoopType');
    if (typeSelect && coop.type) typeSelect.value = coop.type;

    const groupSelect = document.getElementById('editRegPromotionGroup');
    if (groupSelect && coop.group) groupSelect.value = coop.group;
  });

  // 3. Create Case Modal (Liquidation)
  setupCoopAutocomplete('createCaseCoopName', 'createCaseCoopDropdown', (coop) => {
    const nameInput = document.getElementById('createCaseCoopName');
    if (nameInput) nameInput.value = coop.name;

    const regNumInput = document.getElementById('createCaseRegNumber');
    if (regNumInput && coop.regNumber) regNumInput.value = coop.regNumber;

    const typeSelect = document.getElementById('createCaseCoopType');
    if (typeSelect && coop.type) typeSelect.value = coop.type;

    const locationInput = document.getElementById('createCaseLocation');
    if (locationInput && coop.district) locationInput.value = coop.district;

    const groupSelect = document.getElementById('createCasePromotionGroup');
    if (groupSelect && coop.group) groupSelect.value = coop.group;
  });

  // 4. Edit Case Modal (Liquidation)
  setupCoopAutocomplete('editCaseCoopName', 'editCaseCoopDropdown', (coop) => {
    const nameInput = document.getElementById('editCaseCoopName');
    if (nameInput) nameInput.value = coop.name;

    const regNumInput = document.getElementById('editCaseRegNumber');
    if (regNumInput && coop.regNumber) regNumInput.value = coop.regNumber;

    const typeSelect = document.getElementById('editCaseCoopType');
    if (typeSelect && coop.type) typeSelect.value = coop.type;

    const locationInput = document.getElementById('editCaseLocation');
    if (locationInput && coop.district) locationInput.value = coop.district;

    const groupSelect = document.getElementById('editCasePromotionGroup');
    if (groupSelect && coop.group) groupSelect.value = coop.group;
  });
}

/**
 * Open Cooperative Directory Modal
 */
function openCoopDirectoryModal() {
  AppState.coopDirGroupFilter = 'ALL';
  const searchInput = document.getElementById('coopDirectorySearchInput');
  if (searchInput) searchInput.value = '';
  
  const allCoops = CoopDatabaseUtil.getAll();
  updateCoopDirChipUI();
  renderCoopDirectoryList();
  
  // If database is empty, automatically open the batch import form
  if (allCoops.length === 0) {
    toggleBatchImportForm(true);
  } else {
    toggleBatchImportForm(false);
  }
  
  openModal('coopDirectoryModal');

  // ซิงค์ข้อมูลล่าสุดจาก Google Sheets (CoopDirectory)
  syncCoopDirectoryWithRemote(false);
}

/**
 * Sync cooperative directory from Google Sheets
 */
async function syncCoopDirectoryWithRemote(manual = false) {
  const syncBadge = document.getElementById('coopDirSyncBadge');
  const spinIcon = document.getElementById('coopSyncSpin');
  
  if (syncBadge) {
    syncBadge.innerText = '⏳ กำลังซิงค์กับ Google Sheets...';
    syncBadge.style.background = '#fef3c7';
    syncBadge.style.color = '#92400e';
  }
  if (spinIcon) spinIcon.classList.add('spin-animation');

  try {
    const list = await CoopDatabaseUtil.syncFromRemote();
    renderCoopDirectoryList();
    if (syncBadge) {
      syncBadge.innerText = '☁️ ซิงค์ Google Sheets (CoopDirectory) แล้ว';
      syncBadge.style.background = '#dcfce7';
      syncBadge.style.color = '#166534';
    }
    if (manual) {
      showToast(`ซิงค์ข้อมูลกับ Google Sheets สำเร็จ (${list.length} สหกรณ์)`, 'success');
    }
  } catch (err) {
    if (syncBadge) {
      syncBadge.innerText = '⚠️ ใช้ข้อมูลในเครื่อง (ออฟไลน์)';
      syncBadge.style.background = '#fee2e2';
      syncBadge.style.color = '#991b1b';
    }
    if (manual) {
      showToast('ไม่สามารถเชื่อมต่อ Google Sheets ได้ กำลังใช้ข้อมูลในเครื่อง', 'warning');
    }
  } finally {
    if (spinIcon) spinIcon.classList.remove('spin-animation');
  }
}

/**
 * Set Group filter in directory modal
 */
function setCoopDirectoryGroupFilter(group) {
  AppState.coopDirGroupFilter = group;
  updateCoopDirChipUI();
  renderCoopDirectoryList();
  
  // Also sync the target group in the batch import form if currently visible
  const targetGroupSelect = document.getElementById('batchImportTargetGroup');
  if (targetGroupSelect && group !== 'ALL') {
    targetGroupSelect.value = group;
  }
}

/**
 * Update active state for directory filter chips
 */
function updateCoopDirChipUI() {
  document.querySelectorAll('#coopDirectoryGroupChips [data-dir-group]').forEach(chip => {
    chip.classList.toggle('active', chip.dataset.dirGroup === AppState.coopDirGroupFilter);
  });
}

/**
 * Toggle batch import form card
 */
function toggleBatchImportForm(force) {
  const card = document.getElementById('batchImportCoopCard');
  if (!card) return;
  const isVisible = card.style.display !== 'none';
  const show = typeof force === 'boolean' ? force : !isVisible;
  card.style.display = show ? 'block' : 'none';
  
  if (show) {
    // If a specific group filter is active, pre-select it
    if (AppState.coopDirGroupFilter && AppState.coopDirGroupFilter !== 'ALL') {
      const select = document.getElementById('batchImportTargetGroup');
      if (select) select.value = AppState.coopDirGroupFilter;
    }
    const textarea = document.getElementById('batchCoopNamesInput');
    if (textarea) setTimeout(() => textarea.focus(), 50);
  }
}

/**
 * Real-time count preview of batch cooperative names
 */
function updateBatchNamesCountPreview() {
  const val = document.getElementById('batchCoopNamesInput')?.value || '';
  const lines = val.split('\n')
    .map(s => s.trim().replace(/^(\d+[\.\)]|\-|\•|\*)\s*/, ''))
    .filter(Boolean);
  const countEl = document.getElementById('batchNamesCountPreview');
  if (countEl) {
    countEl.innerText = `${lines.length} รายชื่อ`;
  }
}

/**
 * Handle Batch Import Submission (บันทึกทั้ง LocalStorage และ Google Sheets)
 */
async function handleBatchImportCoops(e) {
  e.preventDefault();
  const group = document.getElementById('batchImportTargetGroup')?.value;
  const defaultType = document.getElementById('batchImportDefaultType')?.value || 'สหกรณ์การเกษตร';
  const rawText = document.getElementById('batchCoopNamesInput')?.value || '';

  const lines = rawText.split('\n')
    .map(s => s.trim())
    .filter(Boolean);

  if (!group) {
    showToast('กรุณาเลือกกลุ่มส่งเสริมสหกรณ์ที่รับผิดชอบ', 'warning');
    return;
  }

  if (lines.length === 0) {
    showToast('กรุณาใส่ชื่อสหกรณ์อย่างน้อย 1 รายชื่อ', 'warning');
    return;
  }

  const submitBtn = e.target.querySelector('button[type="submit"]');
  const origBtnText = submitBtn ? submitBtn.innerHTML : '';
  if (submitBtn) {
    submitBtn.disabled = true;
    submitBtn.innerHTML = '⏳ กำลังบันทึกลง Google Sheets...';
  }

  try {
    const result = await CoopDatabaseUtil.batchAddRemote(group, lines, defaultType);

    showToast(`นำเข้ารายชื่อสหกรณ์เข้า "${group}" สำเร็จ ${result.added} รายชื่อ (บันทึกลง Google Sheets เรียบร้อยแล้ว)`, 'success');
    
    // Reset textarea
    const textarea = document.getElementById('batchCoopNamesInput');
    if (textarea) textarea.value = '';
    updateBatchNamesCountPreview();

    toggleBatchImportForm(false);
    renderCoopDirectoryList();
  } catch (err) {
    showToast('บันทึกลงเครื่องสำเร็จ แต่อาจเกิดปัญหาในการเชื่อมต่อ Google Sheets: ' + (err.message || err), 'warning');
    renderCoopDirectoryList();
  } finally {
    if (submitBtn) {
      submitBtn.disabled = false;
      submitBtn.innerHTML = origBtnText;
    }
  }
}

/**
 * Delete a single cooperative from database and Google Sheets
 */
async function handleDeleteCoop(coopName) {
  if (!coopName) return;
  if (!confirm(`คุณต้องการลบ "${coopName}" ออกจากฐานข้อมูลและ Google Sheets หรือไม่?`)) return;

  showToast(`กำลังลบ "${coopName}"...`, 'info');
  await CoopDatabaseUtil.deleteCoopRemote(coopName);
  showToast(`ลบ "${coopName}" เรียบร้อยแล้ว`, 'info');
  renderCoopDirectoryList();
}

/**
 * Clear all cooperatives from database and Google Sheets
 */
async function handleClearAllCoops() {
  const allCoops = CoopDatabaseUtil.getAll();
  if (allCoops.length === 0) {
    showToast('ไม่มีข้อมูลสหกรณ์ในฐานข้อมูลอยู่แล้ว', 'info');
    return;
  }

  if (!confirm(`คุณต้องการล้างรายชื่อสหกรณ์ทั้งหมด ${allCoops.length} รายการออกจากระบบและ Google Sheets หรือไม่?`)) return;

  showToast('กำลังล้างข้อมูลใน Google Sheets...', 'info');
  await CoopDatabaseUtil.clearAllRemote();
  showToast('ล้างรายชื่อสหกรณ์ทั้งหมดออกจากระบบและ Google Sheets เรียบร้อยแล้ว', 'info');
  renderCoopDirectoryList();
  toggleBatchImportForm(true);
}

/**
 * Render Cooperative Directory Table and Counts
 */
function renderCoopDirectoryList() {
  const allCoops = CoopDatabaseUtil.getAll();

  // Update counts
  const totalCount = allCoops.length;
  const g1Count = allCoops.filter(c => c.group === 'กลุ่มส่งเสริมสหกรณ์ 1').length;
  const g2Count = allCoops.filter(c => c.group === 'กลุ่มส่งเสริมสหกรณ์ 2').length;
  const g3Count = allCoops.filter(c => c.group === 'กลุ่มส่งเสริมสหกรณ์ 3').length;
  const gChawoeCount = allCoops.filter(c => c.group === 'นิคมสหกรณ์ชะแวะ').length;

  if (document.getElementById('coopDirTotalCount')) document.getElementById('coopDirTotalCount').innerText = totalCount;
  if (document.getElementById('coopDirG1Count')) document.getElementById('coopDirG1Count').innerText = g1Count;
  if (document.getElementById('coopDirG2Count')) document.getElementById('coopDirG2Count').innerText = g2Count;
  if (document.getElementById('coopDirG3Count')) document.getElementById('coopDirG3Count').innerText = g3Count;
  if (document.getElementById('coopDirGChawoeCount')) document.getElementById('coopDirGChawoeCount').innerText = gChawoeCount;

  // Filter
  let list = [...allCoops];
  if (AppState.coopDirGroupFilter && AppState.coopDirGroupFilter !== 'ALL') {
    list = list.filter(c => c.group === AppState.coopDirGroupFilter);
  }

  const searchInput = document.getElementById('coopDirectorySearchInput');
  const query = searchInput ? searchInput.value.trim().toLowerCase() : '';
  if (query) {
    list = list.filter(c =>
      (c.name && c.name.toLowerCase().includes(query)) ||
      (c.type && c.type.toLowerCase().includes(query)) ||
      (c.group && c.group.toLowerCase().includes(query))
    );
  }

  const tbody = document.getElementById('coopDirectoryTableBody');
  if (!tbody) return;

  if (list.length === 0) {
    const isTotalEmpty = allCoops.length === 0;
    tbody.innerHTML = `
      <tr>
        <td colspan="5" style="text-align: center; padding: 2.5rem 1rem; color: var(--text-muted);">
          <div style="font-size: 2rem; margin-bottom: 0.5rem;">📂</div>
          <div style="font-size: 1rem; font-weight: 600; color: var(--primary); margin-bottom: 0.25rem;">
            ${isTotalEmpty ? 'ยังไม่มีรายชื่อสหกรณ์ในฐานข้อมูล' : 'ไม่พบข้อมูลสหกรณ์ที่ตรงกับเงื่อนไขการค้นหา'}
          </div>
          <p style="margin: 0 0 1rem; font-size: 0.85rem;">
            ${isTotalEmpty ? 'คุณสามารถเลือกกลุ่มส่งเสริมฯ และวางรายชื่อสหกรณ์ทีละหลายชื่อเพื่อนำเข้าสู่ระบบได้ทันที' : 'ลองปรับคำค้นหาหรือเลือกกลุ่มส่งเสริมสหกรณ์อื่น'}
          </p>
          ${isTotalEmpty ? `
            <button class="btn btn-primary btn-sm" onclick="toggleBatchImportForm(true)">
              📥 เริ่มนำเข้ารายชื่อสหกรณ์ (แบบชุด)
            </button>
          ` : ''}
        </td>
      </tr>
    `;
    return;
  }

  tbody.innerHTML = list.map((c, idx) => {
    const groupBadge = getGroupBadgeHtml(c.group);
    const isFarmer = c.type && c.type.includes('กลุ่มเกษตรกร');
    const typeBadge = `<span class="case-type-badge ${isFarmer ? 'farmer-group' : 'coop-type-badge'}" style="font-size: 0.72rem;">${escapeHtml(c.type || 'สหกรณ์')}</span>`;
    const escapedName = escapeHtml(c.name);
    const encodedName = escapedName.replace(/'/g, "\\'");

    return `
      <tr>
        <td style="text-align: center; color: var(--text-muted); font-size: 0.8rem;">${idx + 1}</td>
        <td>
          <strong style="color: var(--primary); font-size: 0.92rem;">${escapedName}</strong>
        </td>
        <td>${groupBadge}</td>
        <td>${typeBadge}</td>
        <td style="text-align: right; white-space: nowrap;">
          <button class="btn btn-outline-primary btn-sm" onclick="useCoopFromDirectory('${encodedName}')" style="padding: 2px 8px; font-size: 0.75rem; margin-right: 4px;" title="นำข้อมูลสหกรณ์นี้ไปกรอกในแบบฟอร์ม">
            นำไปใช้ ➔
          </button>
          <button class="btn btn-outline-danger btn-sm" onclick="handleDeleteCoop('${encodedName}')" style="padding: 2px 6px; font-size: 0.75rem; border-color: #fca5a5; color: #dc2626;" title="ลบสหกรณ์นี้">
            🗑️
          </button>
        </td>
      </tr>
    `;
  }).join('');
}

/**
 * Use cooperative from directory into active or new form
 */
function useCoopFromDirectory(coopName) {
  const coop = CoopDatabaseUtil.findByName(coopName);
  if (!coop) return;

  // Check which module or modal is currently visible
  const regModal = document.getElementById('createRegModal');
  const caseModal = document.getElementById('createCaseModal');
  const editRegModal = document.getElementById('editRegModal');
  const editCaseModal = document.getElementById('editCaseModal');

  if (regModal && regModal.classList.contains('active')) {
    if (document.getElementById('createRegCoopName')) document.getElementById('createRegCoopName').value = coop.name;
    if (document.getElementById('createRegCoopType') && coop.type) document.getElementById('createRegCoopType').value = coop.type;
    if (document.getElementById('createRegPromotionGroup') && coop.group) document.getElementById('createRegPromotionGroup').value = coop.group;
  } else if (caseModal && caseModal.classList.contains('active')) {
    if (document.getElementById('createCaseCoopName')) document.getElementById('createCaseCoopName').value = coop.name;
    if (document.getElementById('createCaseCoopType') && coop.type) document.getElementById('createCaseCoopType').value = coop.type;
    if (document.getElementById('createCasePromotionGroup') && coop.group) document.getElementById('createCasePromotionGroup').value = coop.group;
  } else if (editRegModal && editRegModal.classList.contains('active')) {
    if (document.getElementById('editRegCoopName')) document.getElementById('editRegCoopName').value = coop.name;
    if (document.getElementById('editRegCoopType') && coop.type) document.getElementById('editRegCoopType').value = coop.type;
    if (document.getElementById('editRegPromotionGroup') && coop.group) document.getElementById('editRegPromotionGroup').value = coop.group;
  } else if (editCaseModal && editCaseModal.classList.contains('active')) {
    if (document.getElementById('editCaseCoopName')) document.getElementById('editCaseCoopName').value = coop.name;
    if (document.getElementById('editCaseCoopType') && coop.type) document.getElementById('editCaseCoopType').value = coop.type;
    if (document.getElementById('editCasePromotionGroup') && coop.group) document.getElementById('editCasePromotionGroup').value = coop.group;
  } else {
    closeModal('coopDirectoryModal');
    if (AppState.currentModule === 'regulations') {
      openCreateRegModal();
      setTimeout(() => {
        if (document.getElementById('createRegCoopName')) document.getElementById('createRegCoopName').value = coop.name;
        if (document.getElementById('createRegCoopType') && coop.type) document.getElementById('createRegCoopType').value = coop.type;
        if (document.getElementById('createRegPromotionGroup') && coop.group) document.getElementById('createRegPromotionGroup').value = coop.group;
      }, 100);
    } else {
      openCreateCaseModal();
      setTimeout(() => {
        if (document.getElementById('createCaseCoopName')) document.getElementById('createCaseCoopName').value = coop.name;
        if (document.getElementById('createCaseCoopType') && coop.type) document.getElementById('createCaseCoopType').value = coop.type;
        if (document.getElementById('createCasePromotionGroup') && coop.group) document.getElementById('createCasePromotionGroup').value = coop.group;
      }, 100);
    }
    showToast(`นำข้อมูล "${coop.name}" เข้าสู่แบบฟอร์มแล้ว`, 'success');
    return;
  }

  closeModal('coopDirectoryModal');
  showToast(`นำข้อมูล "${coop.name}" เข้าสู่แบบฟอร์มแล้ว`, 'success');
}

// Clean any legacy mock storage on startup
try {
  localStorage.removeItem('cpd_custom_cooperatives');
} catch (e) {}

// Expose directory functions to global window scope
window.openCoopDirectoryModal = openCoopDirectoryModal;
window.setCoopDirectoryGroupFilter = setCoopDirectoryGroupFilter;
window.renderCoopDirectoryList = renderCoopDirectoryList;
window.toggleBatchImportForm = toggleBatchImportForm;
window.updateBatchNamesCountPreview = updateBatchNamesCountPreview;
window.handleBatchImportCoops = handleBatchImportCoops;
window.handleDeleteCoop = handleDeleteCoop;
window.handleClearAllCoops = handleClearAllCoops;
window.useCoopFromDirectory = useCoopFromDirectory;

// Startup
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', initializeApp);
} else {
  initializeApp();
}



