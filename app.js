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
  searchTerm: '',
  filterType: 'ALL',
  filterStatus: 'ALL',

  // Module 2: Regulations & Bylaws State
  regulations: [],
  filteredRegulations: [],
  selectedReg: null,
  activeRegDetailTab: 'regTimeline',
  regViewMode: 'grid', // 'grid' | 'table'
  regSearchTerm: '',
  regFilterCoopType: 'ALL',
  regFilterDocType: 'ALL',
  regFilterStatus: 'ALL',

  // System State
  auditLogs: [],
  currentUser: null, // { email, name, role, token }
  isDemoMode: false,
  isLoading: false
};

// ------------------------------------------------------------------------------
// 2. Default Initial Mock Data
// ------------------------------------------------------------------------------

// 2.1 Mock Liquidation Cases (Module 1)
const INITIAL_MOCK_CASES = [
  {
    caseId: 'CASE-001-2566',
    coopId: 'COOP-001',
    coopName: 'สหกรณ์การเกษตรเมืองอุดรพัฒนา จำกัด',
    regNumber: 'ก.0123/2545',
    coopType: 'สหกรณ์การเกษตร',
    location: 'อ.เมือง จ.อุดรธานี',
    dissolutionType: 'คำสั่งเลิก',
    orderNumber: 'คำสั่ง นทส. ที่ 15/2566',
    orderDate: '2023-03-15T00:00:00.000Z',
    currentStep: 6,
    caseStatus: 'กำลังชำระบัญชี',
    lastUpdated: '2026-07-20T10:30:00.000Z',
    note: 'อยู่ระหว่างเร่งรัดติดตามหนี้สินจากสมาชิกลูกหนี้ 45 ราย',
    liquidators: 'นายสมศักดิ์ รักสหกรณ์',
    liquidatorsDetail: [
      {
        liquidatorId: 'LQ-001',
        name: 'นายสมศักดิ์ รักสหกรณ์',
        position: 'นักวิชาการสหกรณ์ชำนาญการ',
        orderNumber: 'คำสั่งแต่งตั้ง นทส. ที่ 16/2566',
        startDate: '2023-03-15T00:00:00.000Z',
        endDate: '',
        reason: '',
        status: 'ปัจจุบัน',
        contact: '081-234-5678'
      }
    ],
    hasIssues: true,
    issuesCount: 1,
    issues: [
      {
        stepNumber: 6,
        stepName: 'ดำเนินการจัดการทรัพย์สิน หนี้สิน และชำระสะสางหนี้สิน',
        issue: 'ลูกหนี้เงินกู้บางส่วนย้ายถิ่นฐาน ติดตามทวงถามได้ยาก อยู่ระหว่างประสานฝ่ายกฎหมาย'
      }
    ],
    steps: [
      { stepNumber: 1, stepName: 'ประกาศ/เผยแพร่การเลิกและผู้ชำระบัญชี', status: 'เสร็จสิ้น', startDate: '2023-03-15', endDate: '2023-04-01', issue: '', note: 'ประกาศราชกิจจานุเบกษาเรียบร้อย' },
      { stepNumber: 2, stepName: 'รับมอบทรัพย์สิน บัญชี เอกสาร และทำงบการเงิน ณ วันเลิก', status: 'เสร็จสิ้น', startDate: '2023-04-02', endDate: '2023-06-30', issue: '', note: 'รับมอบเอกสารและสรุปทรัพย์สิน' },
      { stepNumber: 3, stepName: 'ส่งงบการเงิน ณ วันเลิก ให้ผู้สอบบัญชี', status: 'เสร็จสิ้น', startDate: '2023-07-01', endDate: '2023-07-15', issue: '', note: 'ส่งสำนักงานตรวจบัญชีสหกรณ์' },
      { stepNumber: 4, stepName: 'ผู้สอบบัญชีตรวจสอบและรับรองงบการเงิน', status: 'เสร็จสิ้น', startDate: '2023-07-16', endDate: '2023-11-20', issue: '', note: 'ผู้สอบบัญชีรับรองแบบไม่มีเงื่อนไข' },
      { stepNumber: 5, stepName: 'เสนอขออนุมัติงบการเงิน ณ วันเลิก', status: 'เสร็จสิ้น', startDate: '2023-11-25', endDate: '2024-01-10', issue: '', note: 'นายทะเบียนสหกรณ์อนุมัติงบการเงิน' },
      { stepNumber: 6, stepName: 'จัดการทรัพย์สิน หนี้สิน และชำระสะสางหนี้สิน', status: 'กำลังดำเนินการ', startDate: '2024-01-15', endDate: '', issue: 'ลูกหนี้เงินกู้บางส่วนย้ายถิ่นฐาน ติดตามทวงถามได้ยาก อยู่ระหว่างประสานฝ่ายกฎหมาย', note: 'จำหน่ายทรัพย์สินได้แล้ว 60%' },
      { stepNumber: 7, stepName: 'จัดทำรายงานผลและงบเสร็จสิ้นการชำระบัญชี', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 8, stepName: 'ผู้สอบบัญชีตรวจสอบและรับรองงบเสร็จสิ้น', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 9, stepName: 'นายทะเบียนสหกรณ์สั่งถอนชื่อสหกรณ์', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 10, stepName: 'ส่งมอบบรรดาสมุด บัญชี และเอกสาร', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' }
    ],
    documents: [
      { docId: 'DOC-01', stepNumber: 1, fileName: 'คำสั่งเลิกสหกรณ์_15_2566.pdf', driveUrl: 'https://drive.google.com', docType: 'คำสั่ง/ประกาศ', fileSize: '1.4 MB', uploadDate: '2023-03-16' },
      { docId: 'DOC-02', stepNumber: 4, fileName: 'รายงานการสอบบัญชี_งบการเงินวันเลิก.pdf', driveUrl: 'https://drive.google.com', docType: 'งบการเงิน/รายงาน', fileSize: '3.8 MB', uploadDate: '2023-11-22' }
    ]
  },
  {
    caseId: 'CASE-002-2565',
    coopId: 'COOP-002',
    coopName: 'สหกรณ์บริการเดินรถสองแถวขอนแก่น จำกัด',
    regNumber: 'บ.0456/2539',
    coopType: 'สหกรณ์บริการ',
    location: 'อ.เมือง จ.ขอนแก่น',
    dissolutionType: 'ประกาศเลิก',
    orderNumber: 'ประกาศ นทส. ที่ 42/2565',
    orderDate: '2022-08-10T00:00:00.000Z',
    currentStep: 3,
    caseStatus: 'กำลังชำระบัญชี',
    lastUpdated: '2026-06-15T14:20:00.000Z',
    note: 'เปลี่ยนตัวผู้ชำระบัญชีเนื่องจากท่านเดิมเกษียณอายุราชการ',
    liquidators: 'นางสาววิไลลักษณ์ มั่นคง',
    liquidatorsDetail: [
      {
        liquidatorId: 'LQ-002-A',
        name: 'นายบุญเลิศ กองทอง',
        position: 'ผู้อำนวยการกลุ่มส่งเสริมสหกรณ์',
        orderNumber: 'คำสั่งแต่งตั้ง นทส. ที่ 43/2565',
        startDate: '2022-08-10T00:00:00.000Z',
        endDate: '2024-09-30T00:00:00.000Z',
        reason: 'เกษียณอายุราชการ',
        status: 'พ้นหน้าที่แล้ว',
        contact: '-'
      },
      {
        liquidatorId: 'LQ-002-B',
        name: 'นางสาววิไลลักษณ์ มั่นคง',
        position: 'นักวิชาการสหกรณ์ชำนาญการ',
        orderNumber: 'คำสั่งแต่งตั้ง นทส. ที่ 68/2567',
        startDate: '2024-10-01T00:00:00.000Z',
        endDate: '',
        reason: 'แต่งตั้งแทนผู้เกษียณอายุ',
        status: 'ปัจจุบัน',
        contact: '089-987-6543'
      }
    ],
    hasIssues: true,
    issuesCount: 1,
    issues: [
      {
        stepNumber: 3,
        stepName: 'ส่งงบการเงิน ณ วันเลิก ให้ผู้สอบบัญชี',
        issue: 'เอกสารใบสำคัญรับ-จ่ายในอดีตสูญหายบางส่วน อยู่ระหว่างรวบรวมพยานหลักฐานทดแทน'
      }
    ],
    steps: [
      { stepNumber: 1, stepName: 'ประกาศ/เผยแพร่การเลิกและผู้ชำระบัญชี', status: 'เสร็จสิ้น', startDate: '2022-08-10', endDate: '2022-09-01', issue: '', note: '' },
      { stepNumber: 2, stepName: 'รับมอบทรัพย์สิน บัญชี เอกสาร และทำงบการเงิน ณ วันเลิก', status: 'เสร็จสิ้น', startDate: '2022-09-02', endDate: '2024-03-30', issue: '', note: '' },
      { stepNumber: 3, stepName: 'ส่งงบการเงิน ณ วันเลิก ให้ผู้สอบบัญชี', status: 'กำลังดำเนินการ', startDate: '2024-04-01', endDate: '', issue: 'เอกสารใบสำคัญรับ-จ่ายในอดีตสูญหายบางส่วน อยู่ระหว่างรวบรวมพยานหลักฐานทดแทน', note: '' },
      { stepNumber: 4, stepName: 'ผู้สอบบัญชีตรวจสอบและรับรองงบการเงิน', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 5, stepName: 'เสนอขออนุมัติงบการเงิน ณ วันเลิก', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 6, stepName: 'จัดการทรัพย์สิน หนี้สิน และชำระสะสางหนี้สิน', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 7, stepName: 'จัดทำรายงานผลและงบเสร็จสิ้นการชำระบัญชี', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 8, stepName: 'ผู้สอบบัญชีตรวจสอบและรับรองงบเสร็จสิ้น', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 9, stepName: 'นายทะเบียนสหกรณ์สั่งถอนชื่อสหกรณ์', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 10, stepName: 'ส่งมอบบรรดาสมุด บัญชี และเอกสาร', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' }
    ],
    documents: [
      { docId: 'DOC-03', stepNumber: 1, fileName: 'ประกาศเลิกสหกรณ์_42_2565.pdf', driveUrl: 'https://drive.google.com', docType: 'คำสั่ง/ประกาศ', fileSize: '1.2 MB', uploadDate: '2022-08-12' }
    ]
  },
  {
    caseId: 'CASE-003-2566',
    coopId: 'GRP-001',
    coopName: 'กลุ่มเกษตรกรทำไร่นาดีพัฒนา',
    regNumber: 'กษ.0118/2548',
    coopType: 'กลุ่มเกษตรกรทำไร่',
    location: 'อ.หนองหาน จ.อุดรธานี',
    dissolutionType: 'คำสั่งเลิก',
    orderNumber: 'คำสั่ง นทส. ที่ 12/2566',
    orderDate: '2023-02-20T00:00:00.000Z',
    currentStep: 4,
    caseStatus: 'กำลังชำระบัญชี',
    lastUpdated: '2026-05-18T10:00:00.000Z',
    note: 'กลุ่มเกษตรกรหยุดดำเนินกิจการ สมาชิกมีมติยุบเลิกกลุ่ม',
    liquidators: 'นายกิตติชัย ส่งเสริมไทย',
    liquidatorsDetail: [
      {
        liquidatorId: 'LQ-003-GRP',
        name: 'นายกิตติชัย ส่งเสริมไทย',
        position: 'นักวิชาการส่งเสริมการเกษตรชำนาญการ',
        orderNumber: 'คำสั่งแต่งตั้ง นทส. ที่ 13/2566',
        startDate: '2023-02-20T00:00:00.000Z',
        endDate: '',
        reason: '',
        status: 'ปัจจุบัน',
        contact: '084-555-1234'
      }
    ],
    hasIssues: false,
    issuesCount: 0,
    issues: [],
    steps: [
      { stepNumber: 1, stepName: 'ประกาศ/เผยแพร่การเลิกและผู้ชำระบัญชี', status: 'เสร็จสิ้น', startDate: '2023-02-20', endDate: '2023-03-05', issue: '', note: '' },
      { stepNumber: 2, stepName: 'รับมอบทรัพย์สิน บัญชี เอกสาร และทำงบการเงิน ณ วันเลิก', status: 'เสร็จสิ้น', startDate: '2023-03-06', endDate: '2023-08-30', issue: '', note: '' },
      { stepNumber: 3, stepName: 'ส่งงบการเงิน ณ วันเลิก ให้ผู้สอบบัญชี', status: 'เสร็จสิ้น', startDate: '2023-09-01', endDate: '2023-11-15', issue: '', note: '' },
      { stepNumber: 4, stepName: 'ผู้สอบบัญชีตรวจสอบและรับรองงบการเงิน', status: 'กำลังดำเนินการ', startDate: '2023-11-20', endDate: '', issue: '', note: 'รอผู้สอบบัญชีรับรองงบการเงิน' },
      { stepNumber: 5, stepName: 'เสนอขออนุมัติงบการเงิน ณ วันเลิก', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 6, stepName: 'จัดการทรัพย์สิน หนี้สิน และชำระสะสางหนี้สิน', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 7, stepName: 'จัดทำรายงานผลและงบเสร็จสิ้นการชำระบัญชี', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 8, stepName: 'ผู้สอบบัญชีตรวจสอบและรับรองงบเสร็จสิ้น', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 9, stepName: 'นายทะเบียนสหกรณ์สั่งถอนชื่อสหกรณ์', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 10, stepName: 'ส่งมอบบรรดาสมุด บัญชี และเอกสาร', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' }
    ],
    documents: [
      { docId: 'DOC-GRP-01', stepNumber: 1, fileName: 'คำสั่งเลิกกลุ่มเกษตรกรทำไร่นาดีพัฒนา.pdf', driveUrl: 'https://drive.google.com', docType: 'คำสั่ง/ประกาศ', fileSize: '1.1 MB', uploadDate: '2023-02-22' }
    ]
  },
  {
    caseId: 'CASE-005-2566',
    coopId: 'GRP-002',
    coopName: 'กลุ่มเกษตรกรทำนาบ้านหนองบัวพัฒนา',
    regNumber: 'กษ.0089/2542',
    coopType: 'กลุ่มเกษตรกรทำนา',
    location: 'อ.เมือง จ.ขอนแก่น',
    dissolutionType: 'คำสั่งเลิก',
    orderNumber: 'คำสั่ง นทส. ที่ 29/2566',
    orderDate: '2023-08-15T00:00:00.000Z',
    currentStep: 2,
    caseStatus: 'กำลังชำระบัญชี',
    lastUpdated: '2026-06-01T11:20:00.000Z',
    note: 'อยู่ระหว่างรวบรวมทรัพย์สินและสมุดบัญชีจากคณะกรรมการชุดเดิม',
    liquidators: 'นางรัตนา ชัยมงคล',
    liquidatorsDetail: [
      {
        liquidatorId: 'LQ-005-GRP',
        name: 'นางรัตนา ชัยมงคล',
        position: 'นักวิชาการสหกรณ์ปฏิบัติการ',
        orderNumber: 'คำสั่งแต่งตั้ง นทส. ที่ 30/2566',
        startDate: '2023-08-15T00:00:00.000Z',
        endDate: '',
        reason: '',
        status: 'ปัจจุบัน',
        contact: '082-123-9988'
      }
    ],
    hasIssues: false,
    issuesCount: 0,
    issues: [],
    steps: [
      { stepNumber: 1, stepName: 'ประกาศ/เผยแพร่การเลิกและผู้ชำระบัญชี', status: 'เสร็จสิ้น', startDate: '2023-08-15', endDate: '2023-08-30', issue: '', note: '' },
      { stepNumber: 2, stepName: 'รับมอบทรัพย์สิน บัญชี เอกสาร และทำงบการเงิน ณ วันเลิก', status: 'กำลังดำเนินการ', startDate: '2023-09-01', endDate: '', issue: '', note: 'อยู่ระหว่างสรุปงบทรัพย์สิน' },
      { stepNumber: 3, stepName: 'ส่งงบการเงิน ณ วันเลิก ให้ผู้สอบบัญชี', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 4, stepName: 'ผู้สอบบัญชีตรวจสอบและรับรองงบการเงิน', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 5, stepName: 'เสนอขออนุมัติงบการเงิน ณ วันเลิก', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 6, stepName: 'จัดการทรัพย์สิน หนี้สิน และชำระสะสางหนี้สิน', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 7, stepName: 'จัดทำรายงานผลและงบเสร็จสิ้นการชำระบัญชี', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 8, stepName: 'ผู้สอบบัญชีตรวจสอบและรับรองงบเสร็จสิ้น', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 9, stepName: 'นายทะเบียนสหกรณ์สั่งถอนชื่อสหกรณ์', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 10, stepName: 'ส่งมอบบรรดาสมุด บัญชี และเอกสาร', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' }
    ],
    documents: []
  },
  {
    caseId: 'CASE-004-2564',
    coopId: 'COOP-003',
    coopName: 'สหกรณ์ร้านค้าครูนครราชสีมา จำกัด',
    regNumber: 'ร.0089/2535',
    coopType: 'สหกรณ์ร้านค้า',
    location: 'อ.เมือง จ.นครราชสีมา',
    dissolutionType: 'คำสั่งเลิก',
    orderNumber: 'คำสั่ง นทส. ที่ 08/2564',
    orderDate: '2021-05-18T00:00:00.000Z',
    currentStep: 10,
    caseStatus: 'เสร็จสิ้น',
    lastUpdated: '2026-03-10T09:00:00.000Z',
    note: 'การชำระบัญชีเสร็จสิ้นสมบูรณ์ ส่งมอบบัญชีและถอนชื่อเรียบร้อยแล้ว',
    liquidators: 'นายประสิทธิ์ กิจเจริญ',
    liquidatorsDetail: [
      {
        liquidatorId: 'LQ-004',
        name: 'นายประสิทธิ์ กิจเจริญ',
        position: 'นักวิชาการสหกรณ์ชำนาญการพิเศษ',
        orderNumber: 'คำสั่งแต่งตั้ง นทส. ที่ 09/2564',
        startDate: '2021-05-18T00:00:00.000Z',
        endDate: '2026-03-10T00:00:00.000Z',
        reason: 'เสร็จสิ้นการชำระบัญชี',
        status: 'เสร็จสิ้นภารกิจ',
        contact: '-'
      }
    ],
    hasIssues: false,
    issuesCount: 0,
    issues: [],
    steps: [
      { stepNumber: 1, stepName: 'ประกาศ/เผยแพร่การเลิกและผู้ชำระบัญชี', status: 'เสร็จสิ้น', startDate: '2021-05-18', endDate: '2021-06-05', issue: '', note: '' },
      { stepNumber: 2, stepName: 'รับมอบทรัพย์สิน บัญชี เอกสาร และทำงบการเงิน ณ วันเลิก', status: 'เสร็จสิ้น', startDate: '2021-06-06', endDate: '2021-12-15', issue: '', note: '' },
      { stepNumber: 3, stepName: 'ส่งงบการเงิน ณ วันเลิก ให้ผู้สอบบัญชี', status: 'เสร็จสิ้น', startDate: '2021-12-16', endDate: '2022-01-10', issue: '', note: '' },
      { stepNumber: 4, stepName: 'ผู้สอบบัญชีตรวจสอบและรับรองงบการเงิน', status: 'เสร็จสิ้น', startDate: '2022-01-11', endDate: '2022-05-20', issue: '', note: '' },
      { stepNumber: 5, stepName: 'เสนอขออนุมัติงบการเงิน ณ วันเลิก', status: 'เสร็จสิ้น', startDate: '2022-05-25', endDate: '2022-08-10', issue: '', note: '' },
      { stepNumber: 6, stepName: 'จัดการทรัพย์สิน หนี้สิน และชำระสะสางหนี้สิน', status: 'เสร็จสิ้น', startDate: '2022-08-15', endDate: '2024-11-30', issue: '', note: 'คืนทุนและจ่ายหนี้ครบถ้วน' },
      { stepNumber: 7, stepName: 'จัดทำรายงานผลและงบเสร็จสิ้นการชำระบัญชี', status: 'เสร็จสิ้น', startDate: '2024-12-01', endDate: '2025-04-15', issue: '', note: '' },
      { stepNumber: 8, stepName: 'ผู้สอบบัญชีตรวจสอบและรับรองงบเสร็จสิ้น', status: 'เสร็จสิ้น', startDate: '2025-04-16', endDate: '2025-09-30', issue: '', note: '' },
      { stepNumber: 9, stepName: 'นายทะเบียนสหกรณ์สั่งถอนชื่อสหกรณ์', status: 'เสร็จสิ้น', startDate: '2025-10-01', endDate: '2026-01-15', issue: '', note: 'ประกาศถอนชื่อในราชกิจจานุเบกษา' },
      { stepNumber: 10, stepName: 'ส่งมอบบรรดาสมุด บัญชี และเอกสาร', status: 'เสร็จสิ้น', startDate: '2026-01-20', endDate: '2026-03-10', issue: '', note: 'ส่งมอบคลังเอกสารเรียบร้อย' }
    ],
    documents: [
      { docId: 'DOC-05', stepNumber: 9, fileName: 'ประกาศถอนชื่อสหกรณ์ออกจากทะเบียน.pdf', driveUrl: 'https://drive.google.com', docType: 'คำสั่ง/ประกาศ', fileSize: '980 KB', uploadDate: '2026-01-18' }
    ]
  }
];

// 2.2 Mock Regulations & Bylaws Data (Module 2)
const INITIAL_MOCK_REGULATIONS = [
  {
    regId: 'REG-001-2567',
    coopName: 'สหกรณ์การเกษตรเมืองอุดรพัฒนา จำกัด',
    regNumber: 'ก.0123/2545',
    coopType: 'สหกรณ์การเกษตร',
    docType: 'ข้อบังคับสหกรณ์',
    title: 'ข้อบังคับสหกรณ์การเกษตรเมืองอุดรพัฒนา จำกัด พ.ศ. 2567 (ฉบับแก้ไขเพิ่มเติม ฉบับที่ 3)',
    docNumber: 'สห.อด 01/2567',
    submitDate: '2024-02-10T00:00:00.000Z',
    officerName: 'นายสมเกียรติ สหกรณ์ดี',
    officerContact: '081-999-8877',
    currentStep: 4,
    status: 'อยู่ระหว่างพิจารณา', // 'อยู่ระหว่างพิจารณา' | 'รับจดทะเบียน/เห็นชอบ/รับทราบ' | 'ส่งคืนแก้ไข'
    lastUpdated: '2026-07-25T11:00:00.000Z',
    note: 'มติที่ประชุมใหญ่สามัญประจำปี 2566 ขอแก้ไขเรื่องการถือหุ้นและการเลือกตั้งกรรมการ',
    hasIssues: false,
    issuesCount: 0,
    issues: [],
    steps: [
      { stepNumber: 1, stepName: 'ยื่นเรื่องและรับเอกสารคำขอ', status: 'เสร็จสิ้น', startDate: '2024-02-10', endDate: '2024-02-12', issue: '', note: 'รับเรื่องผ่านระบบสารบรรณ สห.อด 01/2567' },
      { stepNumber: 2, stepName: 'กลุ่มจัดตั้งฯ ตรวจสอบเบื้องต้น', status: 'เสร็จสิ้น', startDate: '2024-02-13', endDate: '2024-02-25', issue: '', note: 'มติที่ประชุมถูกต้องครบองค์ประชุมตามกฎหมาย' },
      { stepNumber: 3, stepName: 'กลุ่มตรวจการสหกรณ์/นิติการตรวจร่าง', status: 'เสร็จสิ้น', startDate: '2024-02-26', endDate: '2024-03-10', issue: '', note: 'ตรวจร่างข้อบังคับไม่ขัดต่อกฎหมายและระเบียบนายทะเบียนฯ' },
      { stepNumber: 4, stepName: 'เสนอนายทะเบียนสหกรณ์พิจารณา', status: 'กำลังดำเนินการ', startDate: '2024-03-15', endDate: '', issue: '', note: 'อยู่ระหว่างเสนอลงนามสั่งรับจดทะเบียน' },
      { stepNumber: 5, stepName: 'แจ้งผลและส่งมอบให้สหกรณ์ถือใช้', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' }
    ],
    documents: [
      { docId: 'RDOC-01', stepNumber: 1, fileName: 'คำขอจดทะเบียนและรายงานการประชุมใหญ่.pdf', driveUrl: 'https://drive.google.com', docType: 'มติที่ประชุม', fileSize: '2.4 MB', uploadDate: '2024-02-10' },
      { docId: 'RDOC-02', stepNumber: 3, fileName: 'ร่างข้อบังคับฉบับแก้ไขเพิ่มเติม_ผ่านการตรวจ.pdf', driveUrl: 'https://drive.google.com', docType: 'ร่างระเบียบ/ข้อบังคับ', fileSize: '1.8 MB', uploadDate: '2024-03-10' }
    ]
  },
  {
    regId: 'REG-002-2567',
    coopName: 'สหกรณ์ออมทรัพย์ครูขอนแก่น จำกัด',
    regNumber: 'อ.0456/2540',
    coopType: 'สหกรณ์ออมทรัพย์',
    docType: 'ระเบียบสหกรณ์',
    title: 'ระเบียบว่าด้วยการให้เงินกู้แก่สมาชิกสหกรณ์ พ.ศ. 2567',
    docNumber: 'รับที่ 312/67',
    submitDate: '2024-03-01T00:00:00.000Z',
    officerName: 'นางสาวพัชรา รักงาน',
    officerContact: '089-111-2233',
    currentStep: 3,
    status: 'ส่งคืนแก้ไข',
    lastUpdated: '2026-06-20T14:30:00.000Z',
    note: 'มติคณะกรรมการดำเนินการ ชุดที่ 35 ครั้งที่ 2/2567',
    hasIssues: true,
    issuesCount: 1,
    issues: [
      {
        stepNumber: 3,
        stepName: 'กลุ่มตรวจการสหกรณ์/นิติการตรวจร่าง',
        issue: 'ข้อ 18 กำหนดอัตราดอกเบี้ยและหลักประกันขัดต่อระเบียบนายทะเบียนสหกรณ์ ต้องปรับแก้ไขวงเงินและส่งร่างฉบับปรับปรุงใหม่'
      }
    ],
    steps: [
      { stepNumber: 1, stepName: 'ยื่นเรื่องและรับเอกสารคำขอ', status: 'เสร็จสิ้น', startDate: '2024-03-01', endDate: '2024-03-03', issue: '', note: '' },
      { stepNumber: 2, stepName: 'กลุ่มจัดตั้งฯ ตรวจสอบเบื้องต้น', status: 'เสร็จสิ้น', startDate: '2024-03-04', endDate: '2024-03-15', issue: '', note: 'เอกสารมติ ครบถ้วน' },
      { stepNumber: 3, stepName: 'กลุ่มตรวจการสหกรณ์/นิติการตรวจร่าง', status: 'กำลังดำเนินการ', startDate: '2024-03-16', endDate: '', issue: 'ข้อ 18 กำหนดอัตราดอกเบี้ยและหลักประกันขัดต่อระเบียบนายทะเบียนสหกรณ์ ต้องปรับแก้ไขวงเงินและส่งร่างฉบับปรับปรุงใหม่', note: 'ออกหนังสือแจ้งสหกรณ์เพื่อปรับปรุงข้อความ' },
      { stepNumber: 4, stepName: 'เสนอนายทะเบียนสหกรณ์พิจารณา', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 5, stepName: 'แจ้งผลและส่งมอบให้สหกรณ์ถือใช้', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' }
    ],
    documents: [
      { docId: 'RDOC-03', stepNumber: 1, fileName: 'มติคณะกรรมการ_ร่างระเบียบเงินกู้2567.pdf', driveUrl: 'https://drive.google.com', docType: 'มติที่ประชุม', fileSize: '1.5 MB', uploadDate: '2024-03-01' },
      { docId: 'RDOC-04', stepNumber: 3, fileName: 'หนังสือแจ้งข้อสังเกตและให้แก้ไขร่างระเบียบ.pdf', driveUrl: 'https://drive.google.com', docType: 'หนังสือแจ้งผล/รับจดทะเบียน', fileSize: '850 KB', uploadDate: '2024-03-20' }
    ]
  },
  {
    regId: 'REG-003-2567',
    coopName: 'กลุ่มเกษตรกรทำสวนยางพาราหนองสูง',
    regNumber: 'กษ.0055/2550',
    coopType: 'กลุ่มเกษตรกรทำสวน',
    docType: 'ข้อบังคับสหกรณ์',
    title: 'ข้อบังคับกลุ่มเกษตรกรทำสวนยางพาราหนองสูง พ.ศ. 2567 (ฉบับจัดตั้งและถือใช้ใหม่)',
    docNumber: 'กษ.มด 05/2567',
    submitDate: '2024-04-10T00:00:00.000Z',
    officerName: 'นายวรวุฒิ เกษตรมั่นคง',
    officerContact: '087-333-9900',
    currentStep: 2,
    status: 'อยู่ระหว่างพิจารณา',
    lastUpdated: '2026-05-12T15:00:00.000Z',
    note: 'มติที่ประชุมใหญ่จัดตั้งกลุ่มเกษตรกรตามระเบียบนายทะเบียน',
    hasIssues: false,
    issuesCount: 0,
    issues: [],
    steps: [
      { stepNumber: 1, stepName: 'ยื่นเรื่องและรับเอกสารคำขอ', status: 'เสร็จสิ้น', startDate: '2024-04-10', endDate: '2024-04-12', issue: '', note: 'รับเรื่องและแบบคำขอจัดตั้ง' },
      { stepNumber: 2, stepName: 'กลุ่มจัดตั้งฯ ตรวจสอบเบื้องต้น', status: 'กำลังดำเนินการ', startDate: '2024-04-15', endDate: '', issue: '', note: 'อยู่ระหว่างตรวจคุณสมบัติสมาชิกและมติที่ประชุม' },
      { stepNumber: 3, stepName: 'กลุ่มตรวจการสหกรณ์/นิติการตรวจร่าง', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 4, stepName: 'เสนอนายทะเบียนสหกรณ์พิจารณา', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 5, stepName: 'แจ้งผลและส่งมอบให้สหกรณ์ถือใช้', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' }
    ],
    documents: [
      { docId: 'RDOC-GRP-01', stepNumber: 1, fileName: 'คำขอจัดตั้งและร่างข้อบังคับกลุ่มเกษตรกร.pdf', driveUrl: 'https://drive.google.com', docType: 'มติที่ประชุม', fileSize: '2.1 MB', uploadDate: '2024-04-10' }
    ]
  },
  {
    regId: 'REG-005-2567',
    coopName: 'กลุ่มเกษตรกรเลี้ยงสัตว์ท่าบ่อพัฒนา',
    regNumber: 'กษ.0112/2544',
    coopType: 'กลุ่มเกษตรกรเลี้ยงสัตว์',
    docType: 'ระเบียบสหกรณ์',
    title: 'ระเบียบว่าด้วยการใช้เงินทุนเพื่อส่งเสริมการเลี้ยงโคเนื้อ พ.ศ. 2567',
    docNumber: 'กษ.นค 14/2567',
    submitDate: '2024-05-02T00:00:00.000Z',
    officerName: 'นางสาวจารุวรรณ เลี้ยงชีพ',
    officerContact: '083-456-7890',
    currentStep: 3,
    status: 'อยู่ระหว่างพิจารณา',
    lastUpdated: '2026-06-10T10:00:00.000Z',
    note: 'มติคณะกรรมการกลุ่มเกษตรกร ขอความเห็นชอบระเบียบการใช้เงินกองทุน',
    hasIssues: false,
    issuesCount: 0,
    issues: [],
    steps: [
      { stepNumber: 1, stepName: 'ยื่นเรื่องและรับเอกสารคำขอ', status: 'เสร็จสิ้น', startDate: '2024-05-02', endDate: '2024-05-04', issue: '', note: '' },
      { stepNumber: 2, stepName: 'กลุ่มจัดตั้งฯ ตรวจสอบเบื้องต้น', status: 'เสร็จสิ้น', startDate: '2024-05-05', endDate: '2024-05-18', issue: '', note: 'ตรวจสอบคุณสมบัติและวัตถุประสงค์ถูกต้อง' },
      { stepNumber: 3, stepName: 'กลุ่มตรวจการสหกรณ์/นิติการตรวจร่าง', status: 'กำลังดำเนินการ', startDate: '2024-05-20', endDate: '', issue: '', note: 'อยู่ระหว่างตรวจร่างระเบียบข้อกฎหมาย' },
      { stepNumber: 4, stepName: 'เสนอนายทะเบียนสหกรณ์พิจารณา', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' },
      { stepNumber: 5, stepName: 'แจ้งผลและส่งมอบให้สหกรณ์ถือใช้', status: 'ยังไม่เริ่ม', startDate: '', endDate: '', issue: '', note: '' }
    ],
    documents: [
      { docId: 'RDOC-GRP-02', stepNumber: 1, fileName: 'ร่างระเบียบการใช้เงินทุนเลี้ยงสัตว์.pdf', driveUrl: 'https://drive.google.com', docType: 'ร่างระเบียบ/ข้อบังคับ', fileSize: '1.4 MB', uploadDate: '2024-05-02' }
    ]
  },
  {
    regId: 'REG-004-2566',
    coopName: 'สหกรณ์บริการเดินรถสองแถวขอนแก่น จำกัด',
    regNumber: 'บ.0456/2539',
    coopType: 'สหกรณ์บริการ',
    docType: 'ระเบียบสหกรณ์',
    title: 'ระเบียบว่าด้วยการรับฝากเงินออมทรัพย์และเงินฝากประจำ พ.ศ. 2566',
    docNumber: 'สห.ขก 88/2566',
    submitDate: '2023-11-15T00:00:00.000Z',
    officerName: 'นายเอกชัย ส่งเสริม',
    officerContact: '086-444-5566',
    currentStep: 5,
    status: 'รับจดทะเบียน/เห็นชอบ/รับทราบ',
    lastUpdated: '2026-01-10T09:00:00.000Z',
    note: 'นายทะเบียนสหกรณ์ให้ความเห็นชอบและออกหนังสือแจ้งเรียบร้อยแล้ว',
    hasIssues: false,
    issuesCount: 0,
    issues: [],
    steps: [
      { stepNumber: 1, stepName: 'ยื่นเรื่องและรับเอกสารคำขอ', status: 'เสร็จสิ้น', startDate: '2023-11-15', endDate: '2023-11-16', issue: '', note: '' },
      { stepNumber: 2, stepName: 'กลุ่มจัดตั้งฯ ตรวจสอบเบื้องต้น', status: 'เสร็จสิ้น', startDate: '2023-11-17', endDate: '2023-11-28', issue: '', note: '' },
      { stepNumber: 3, stepName: 'กลุ่มตรวจการสหกรณ์/นิติการตรวจร่าง', status: 'เสร็จสิ้น', startDate: '2023-11-29', endDate: '2023-12-15', issue: '', note: 'ตรวจร่างผ่าน' },
      { stepNumber: 4, stepName: 'เสนอนายทะเบียนสหกรณ์พิจารณา', status: 'เสร็จสิ้น', startDate: '2023-12-16', endDate: '2023-12-28', issue: '', note: 'นายทะเบียนลงนามเห็นชอบ/รับทราบ' },
      { stepNumber: 5, stepName: 'แจ้งผลและส่งมอบให้สหกรณ์ถือใช้', status: 'เสร็จสิ้น', startDate: '2024-01-05', endDate: '2024-01-10', issue: '', note: 'ส่งมอบหนังสือเห็นชอบระเบียบให้สหกรณ์ประกาศถือใช้' }
    ],
    documents: [
      { docId: 'RDOC-05', stepNumber: 5, fileName: 'หนังสือเห็นชอบระเบียบการรับฝากเงิน_ประทับตรา.pdf', driveUrl: 'https://drive.google.com', docType: 'หนังสือแจ้งผล/รับจดทะเบียน', fileSize: '1.1 MB', uploadDate: '2024-01-10' }
    ]
  }
];

// ------------------------------------------------------------------------------
// 3. API Transport & Mock Engine
// ------------------------------------------------------------------------------
const ApiClient = {
  async get(action, params = {}) {
    if (AppState.isDemoMode || !CONFIG.APPS_SCRIPT_URL) {
      return this.mockGet(action, params);
    }
    try {
      const url = new URL(CONFIG.APPS_SCRIPT_URL);
      url.searchParams.set('action', action);
      Object.keys(params).forEach(k => {
        if (params[k] !== undefined && params[k] !== null) url.searchParams.set(k, params[k]);
      });
      const response = await fetch(url.toString(), { method: 'GET', headers: { 'Accept': 'application/json' } });
      const json = await response.json();
      if (!json.success) throw new Error(json.error || 'เกิดข้อผิดพลาดในการโหลดข้อมูล');
      return json.data;
    } catch (err) {
      console.warn('Live API Error -> Fallback to Demo Mode:', err);
      showToast('ไม่สามารถเชื่อมต่อฐานข้อมูลจริงได้ ระบบสลับเป็นโหมดทดสอบ (Demo)', 'warning');
      AppState.isDemoMode = true;
      updateModeBadge();
      return this.mockGet(action, params);
    }
  },

  async post(action, data = {}) {
    if (AppState.isDemoMode || !CONFIG.APPS_SCRIPT_URL) {
      return this.mockPost(action, data);
    }
    try {
      const payload = {
        action: action,
        sessionToken: AppState.currentUser ? AppState.currentUser.token : null,
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
    } catch (err) {
      console.error('POST Error:', err);
      throw err;
    }
  },

  mockGet(action, params) {
    // Liquidation
    if (action === 'listCases') {
      return JSON.parse(JSON.stringify(AppState.cases));
    }
    if (action === 'getCaseDetail') {
      const found = AppState.cases.find(c => c.caseId === params.caseId);
      if (!found) throw new Error('ไม่พบรายการชำระบัญชีที่ระบุ');
      return JSON.parse(JSON.stringify(found));
    }
    if (action === 'getStats') {
      return {
        totalCases: AppState.cases.length,
        activeCases: AppState.cases.filter(c => c.caseStatus !== 'เสร็จสิ้น' && c.currentStep < 10).length,
        completedCases: AppState.cases.filter(c => c.caseStatus === 'เสร็จสิ้น' || c.currentStep >= 10).length,
        casesWithIssues: AppState.cases.filter(c => c.hasIssues).length
      };
    }

    // Regulations & Bylaws
    if (action === 'listRegulations') {
      return JSON.parse(JSON.stringify(AppState.regulations));
    }
    if (action === 'getRegDetail') {
      const found = AppState.regulations.find(r => r.regId === params.regId);
      if (!found) throw new Error('ไม่พบข้อมูลระเบียบ/ข้อบังคับที่ระบุ');
      return JSON.parse(JSON.stringify(found));
    }

    if (action === 'getAuditLogs') {
      return JSON.parse(JSON.stringify(AppState.auditLogs));
    }
    return null;
  },

  mockPost(action, data) {
    const userEmail = AppState.currentUser ? AppState.currentUser.email : 'demo-admin@cpd.go.th';

    if (action === 'login') {
      return {
        sessionToken: 'demo-token-' + Date.now(),
        email: data.email || 'admin@cpd.go.th',
        name: data.name || 'ผู้ดูแลระบบ (Admin Demo)',
        role: 'Admin',
        expiresAt: new Date(Date.now() + 86400000).toISOString()
      };
    }

    // --- Liquidation Actions ---
    if (action === 'createCase') {
      const newCaseId = 'CASE-' + (AppState.cases.length + 1).toString().padStart(3, '0') + '-' + (new Date().getFullYear() + 543);
      const newCoopId = 'COOP-' + (AppState.cases.length + 1).toString().padStart(3, '0');
      const nowStr = new Date().toISOString();

      let liquidatorsDetail = [];
      if (Array.isArray(data.liquidators) && data.liquidators.length > 0) {
        liquidatorsDetail = data.liquidators
          .filter(l => l && l.name && l.name.trim() !== '')
          .map((liq, idx) => ({
            liquidatorId: 'LQ-' + Date.now() + '-' + (idx + 1),
            name: liq.name.trim(),
            position: liq.position ? liq.position.trim() : '',
            orderNumber: liq.orderNumber ? liq.orderNumber.trim() : (data.liquidatorOrderNumber || '-'),
            startDate: liq.startDate || data.orderDate || nowStr,
            endDate: '',
            reason: '',
            status: 'ปัจจุบัน',
            contact: liq.contact ? liq.contact.trim() : ''
          }));
      }

      const liquidatorsNames = liquidatorsDetail.map(l => l.name).join(', ') || 'ยังไม่ระบุ';

      const newCase = {
        caseId: newCaseId,
        coopId: newCoopId,
        coopName: data.coopName,
        regNumber: data.regNumber || '-',
        coopType: data.coopType || 'สหกรณ์การเกษตร',
        location: data.location || '-',
        dissolutionType: data.dissolutionType || 'คำสั่งเลิก',
        orderNumber: data.orderNumber || '-',
        orderDate: data.orderDate || nowStr,
        currentStep: 1,
        caseStatus: 'กำลังชำระบัญชี',
        lastUpdated: nowStr,
        note: data.note || '',
        liquidators: liquidatorsNames,
        liquidatorsDetail: liquidatorsDetail,
        hasIssues: false,
        issuesCount: 0,
        issues: [],
        steps: CONFIG.LIQUIDATION_STEPS.map((s, idx) => ({
          stepNumber: s.number,
          stepName: s.title,
          status: idx === 0 ? 'กำลังดำเนินการ' : 'ยังไม่เริ่ม',
          startDate: idx === 0 ? (data.orderDate || nowStr) : '',
          endDate: '',
          issue: '',
          note: ''
        })),
        documents: []
      };

      AppState.cases.unshift(newCase);
      saveCasesToStorage();
      addAuditLog(userEmail, 'CREATE_CASE', newCaseId, `สร้างรายการชำระบัญชีใหม่: ${data.coopName}`);
      return { caseId: newCaseId, message: 'สร้างรายการชำระบัญชีใหม่สำเร็จ' };
    }

    if (action === 'updateStep') {
      const targetCase = AppState.cases.find(c => c.caseId === data.caseId);
      if (targetCase && targetCase.steps) {
        const targetStep = targetCase.steps.find(s => parseInt(s.stepNumber, 10) === parseInt(data.stepNumber, 10));
        if (targetStep) {
          if (data.status !== undefined) targetStep.status = data.status;
          if (data.startDate !== undefined) targetStep.startDate = data.startDate;
          if (data.endDate !== undefined) targetStep.endDate = data.endDate;
          if (data.issue !== undefined) targetStep.issue = data.issue ? data.issue.trim() : '';
          if (data.note !== undefined) targetStep.note = data.note ? data.note.trim() : '';
        }

        let cur = 1;
        let allDone = true;
        for (let i = 1; i <= 10; i++) {
          const st = targetCase.steps.find(s => parseInt(s.stepNumber, 10) === i);
          if (!st || st.status !== 'เสร็จสิ้น') {
            cur = i;
            allDone = false;
            break;
          }
        }
        targetCase.currentStep = allDone ? 10 : cur;
        if (allDone) targetCase.caseStatus = 'เสร็จสิ้น';
        
        targetCase.issues = targetCase.steps
          .filter(s => s.status !== 'เสร็จสิ้น' && s.issue && s.issue.trim() !== '')
          .map(s => ({
            stepNumber: parseInt(s.stepNumber, 10),
            stepName: s.stepName,
            issue: s.issue.trim()
          }));

        targetCase.hasIssues = targetCase.issues.length > 0;
        targetCase.issuesCount = targetCase.issues.length;
        targetCase.lastUpdated = new Date().toISOString();

        saveCasesToStorage();
        addAuditLog(userEmail, 'UPDATE_STEP', data.caseId, `อัพเดตขั้นตอนชำระบัญชีที่ ${data.stepNumber} เป็น: ${data.status}`);
      }
      return { message: 'อัพเดตขั้นตอนสำเร็จ' };
    }

    if (action === 'addLiquidator') {
      const targetCase = AppState.cases.find(c => c.caseId === data.caseId);
      if (targetCase) {
        if (!targetCase.liquidatorsDetail) targetCase.liquidatorsDetail = [];

        if (data.setPreviousToInactive) {
          targetCase.liquidatorsDetail.forEach(l => {
            if (l.status === 'ปัจจุบัน') {
              l.status = 'พ้นหน้าที่แล้ว';
              l.endDate = data.startDate || new Date().toISOString();
              l.reason = data.previousReason || 'เปลี่ยนตัวผู้ชำระบัญชี';
            }
          });
        }

        targetCase.liquidatorsDetail.push({
          liquidatorId: 'LQ-' + Date.now(),
          name: data.name,
          position: data.position || '',
          orderNumber: data.orderNumber || '-',
          startDate: data.startDate || new Date().toISOString(),
          endDate: '',
          reason: '',
          status: 'ปัจจุบัน',
          contact: data.contact || ''
        });

        targetCase.liquidators = targetCase.liquidatorsDetail.filter(l => l.status === 'ปัจจุบัน').map(l => l.name).join(', ');
        targetCase.lastUpdated = new Date().toISOString();
        saveCasesToStorage();
        addAuditLog(userEmail, 'ADD_LIQUIDATOR', data.caseId, `แต่งตั้งผู้ชำระบัญชี: ${data.name}`);
      }
      return { message: 'แต่งตั้งผู้ชำระบัญชีเรียบร้อย' };
    }

    if (action === 'updateLiquidator') {
      const targetCase = AppState.cases.find(c => c.caseId === data.caseId);
      if (targetCase && targetCase.liquidatorsDetail) {
        const lq = targetCase.liquidatorsDetail.find(l => l.liquidatorId === data.liquidatorId);
        if (lq) {
          if (data.name !== undefined) lq.name = data.name;
          if (data.position !== undefined) lq.position = data.position;
          if (data.orderNumber !== undefined) lq.orderNumber = data.orderNumber;
          if (data.status !== undefined) lq.status = data.status;
          if (data.startDate !== undefined) lq.startDate = data.startDate;
          if (data.endDate !== undefined) lq.endDate = data.endDate;
          if (data.reason !== undefined) lq.reason = data.reason;
          if (data.contact !== undefined) lq.contact = data.contact;

          targetCase.liquidators = targetCase.liquidatorsDetail.filter(l => l.status === 'ปัจจุบัน').map(l => l.name).join(', ') || 'ยังไม่ระบุ';
          saveCasesToStorage();
          addAuditLog(userEmail, 'UPDATE_LIQUIDATOR', data.caseId, `แก้ไขข้อมูลผู้ชำระบัญชี: ${lq.name}`);
        }
      }
      return { message: 'แก้ไขข้อมูลผู้ชำระบัญชีเรียบร้อย' };
    }

    if (action === 'updateCaseInfo') {
      const targetCase = AppState.cases.find(c => c.caseId === data.caseId);
      if (targetCase) {
        if (data.coopName !== undefined) targetCase.coopName = data.coopName;
        if (data.regNumber !== undefined) targetCase.regNumber = data.regNumber;
        if (data.coopType !== undefined) targetCase.coopType = data.coopType;
        if (data.location !== undefined) targetCase.location = data.location;
        if (data.dissolutionType !== undefined) targetCase.dissolutionType = data.dissolutionType;
        if (data.orderNumber !== undefined) targetCase.orderNumber = data.orderNumber;
        if (data.orderDate !== undefined) targetCase.orderDate = data.orderDate;
        if (data.caseStatus !== undefined) targetCase.caseStatus = data.caseStatus;
        if (data.note !== undefined) targetCase.note = data.note;
        targetCase.lastUpdated = new Date().toISOString();
        saveCasesToStorage();
        addAuditLog(userEmail, 'UPDATE_CASE_INFO', data.caseId, `แก้ไขข้อมูลการชำระบัญชี: ${data.coopName || targetCase.coopName}`);
      }
      return { message: 'แก้ไขข้อมูลการชำระบัญชีสำเร็จ' };
    }

    if (action === 'uploadDocument') {
      const targetCase = AppState.cases.find(c => c.caseId === data.caseId);
      if (targetCase) {
        if (!targetCase.documents) targetCase.documents = [];

        let downloadUrl = 'https://drive.google.com';
        if (data.fileBase64 && data.mimeType) {
          downloadUrl = `data:${data.mimeType};base64,${data.fileBase64}`;
        }

        const newDoc = {
          docId: 'DOC-' + Date.now(),
          stepNumber: data.stepNumber ? parseInt(data.stepNumber, 10) : null,
          fileName: data.fileName,
          driveUrl: downloadUrl,
          docType: data.docType || 'เอกสารประกอบ',
          fileSize: data.fileSize || '1.2 MB',
          uploadDate: new Date().toISOString()
        };

        targetCase.documents.push(newDoc);
        saveCasesToStorage();
        addAuditLog(userEmail, 'UPLOAD_DOC', data.caseId, `อัพโหลดเอกสาร: ${data.fileName}`);
      }
      return { message: 'อัพโหลดเอกสารสำเร็จ' };
    }

    if (action === 'deleteDocument') {
      const targetCase = AppState.cases.find(c => c.caseId === data.caseId || (c.documents && c.documents.some(d => d.docId === data.docId)));
      if (targetCase && targetCase.documents) {
        const docIdx = targetCase.documents.findIndex(d => d.docId === data.docId);
        if (docIdx !== -1) {
          const docName = targetCase.documents[docIdx].fileName;
          targetCase.documents.splice(docIdx, 1);
          saveCasesToStorage();
          addAuditLog(userEmail, 'DELETE_DOC', targetCase.caseId, `ลบเอกสาร: ${docName}`);
        }
      }
      return { message: 'ลบเอกสารเรียบร้อย' };
    }

    if (action === 'deleteCase') {
      const idx = AppState.cases.findIndex(c => c.caseId === data.caseId);
      if (idx !== -1) {
        const name = AppState.cases[idx].coopName;
        AppState.cases.splice(idx, 1);
        saveCasesToStorage();
        addAuditLog(userEmail, 'DELETE_CASE', data.caseId, `ลบรายการชำระบัญชี: ${name}`);
      }
      return { message: 'ลบรายการชำระบัญชีสำเร็จ' };
    }

    // --- Regulations & Bylaws Actions (Module 2) ---
    if (action === 'createRegulation') {
      const newRegId = 'REG-' + (AppState.regulations.length + 1).toString().padStart(3, '0') + '-' + (new Date().getFullYear() + 543);
      const nowStr = new Date().toISOString();

      const newReg = {
        regId: newRegId,
        coopName: data.coopName,
        regNumber: data.regNumber || '-',
        coopType: data.coopType || 'สหกรณ์การเกษตร',
        docType: data.docType || 'ข้อบังคับสหกรณ์',
        title: data.title,
        docNumber: data.docNumber || '-',
        submitDate: data.submitDate || nowStr,
        officerName: data.officerName || 'ยังไม่ระบุ',
        officerContact: data.officerContact || '-',
        currentStep: 1,
        status: 'อยู่ระหว่างพิจารณา',
        lastUpdated: nowStr,
        note: data.note || '',
        hasIssues: false,
        issuesCount: 0,
        issues: [],
        steps: CONFIG.REGULATION_STEPS.map((s, idx) => ({
          stepNumber: s.number,
          stepName: s.title,
          status: idx === 0 ? 'กำลังดำเนินการ' : 'ยังไม่เริ่ม',
          startDate: idx === 0 ? (data.submitDate || nowStr) : '',
          endDate: '',
          issue: '',
          note: ''
        })),
        documents: []
      };

      AppState.regulations.unshift(newReg);
      saveRegulationsToStorage();
      addAuditLog(userEmail, 'CREATE_REGULATION', newRegId, `ยื่นเรื่องระเบียบ/ข้อบังคับใหม่: ${data.title} (${data.coopName})`);
      return { regId: newRegId, message: 'ยื่นเรื่องใหม่สำเร็จ' };
    }

    if (action === 'updateRegStep') {
      const target = AppState.regulations.find(r => r.regId === data.regId);
      if (target && target.steps) {
        const targetStep = target.steps.find(s => parseInt(s.stepNumber, 10) === parseInt(data.stepNumber, 10));
        if (targetStep) {
          if (data.status !== undefined) targetStep.status = data.status;
          if (data.startDate !== undefined) targetStep.startDate = data.startDate;
          if (data.endDate !== undefined) targetStep.endDate = data.endDate;
          if (data.issue !== undefined) targetStep.issue = data.issue ? data.issue.trim() : '';
          if (data.note !== undefined) targetStep.note = data.note ? data.note.trim() : '';
        }

        let cur = 1;
        let allDone = true;
        for (let i = 1; i <= 5; i++) {
          const st = target.steps.find(s => parseInt(s.stepNumber, 10) === i);
          if (!st || st.status !== 'เสร็จสิ้น') {
            cur = i;
            allDone = false;
            break;
          }
        }
        target.currentStep = allDone ? 5 : cur;
        
        target.issues = target.steps
          .filter(s => s.status !== 'เสร็จสิ้น' && s.issue && s.issue.trim() !== '')
          .map(s => ({
            stepNumber: parseInt(s.stepNumber, 10),
            stepName: s.stepName,
            issue: s.issue.trim()
          }));

        target.hasIssues = target.issues.length > 0;
        target.issuesCount = target.issues.length;

        if (allDone) {
          target.status = 'รับจดทะเบียน/เห็นชอบ/รับทราบ';
        } else if (target.hasIssues) {
          target.status = 'ส่งคืนแก้ไข';
        } else {
          target.status = 'อยู่ระหว่างพิจารณา';
        }

        target.lastUpdated = new Date().toISOString();
        saveRegulationsToStorage();
        addAuditLog(userEmail, 'UPDATE_REG_STEP', data.regId, `อัพเดตขั้นตอนระเบียบที่ ${data.stepNumber} เป็น: ${data.status}`);
      }
      return { message: 'อัพเดตขั้นตอนการพิจารณาเรียบร้อย' };
    }

    if (action === 'updateRegulationInfo') {
      const target = AppState.regulations.find(r => r.regId === data.regId);
      if (target) {
        if (data.coopName !== undefined) target.coopName = data.coopName;
        if (data.coopType !== undefined) target.coopType = data.coopType;
        if (data.docType !== undefined) target.docType = data.docType;
        if (data.title !== undefined) target.title = data.title;
        if (data.docNumber !== undefined) target.docNumber = data.docNumber;
        if (data.submitDate !== undefined) target.submitDate = data.submitDate;
        if (data.officerName !== undefined) target.officerName = data.officerName;
        if (data.officerContact !== undefined) target.officerContact = data.officerContact;
        if (data.status !== undefined) target.status = data.status;
        if (data.note !== undefined) target.note = data.note;
        target.lastUpdated = new Date().toISOString();
        saveRegulationsToStorage();
        addAuditLog(userEmail, 'UPDATE_REG_INFO', data.regId, `แก้ไขข้อมูลระเบียบ/ข้อบังคับ: ${data.title || target.title}`);
      }
      return { message: 'แก้ไขข้อมูลระเบียบ/ข้อบังคับสำเร็จ' };
    }

    if (action === 'uploadRegDocument') {
      const target = AppState.regulations.find(r => r.regId === data.regId);
      if (target) {
        if (!target.documents) target.documents = [];

        let downloadUrl = 'https://drive.google.com';
        if (data.fileBase64 && data.mimeType) {
          downloadUrl = `data:${data.mimeType};base64,${data.fileBase64}`;
        }

        const newDoc = {
          docId: 'RDOC-' + Date.now(),
          stepNumber: data.stepNumber ? parseInt(data.stepNumber, 10) : null,
          fileName: data.fileName,
          driveUrl: downloadUrl,
          docType: data.docType || 'เอกสารประกอบ',
          fileSize: data.fileSize || '1.2 MB',
          uploadDate: new Date().toISOString()
        };

        target.documents.push(newDoc);
        saveRegulationsToStorage();
        addAuditLog(userEmail, 'UPLOAD_REG_DOC', data.regId, `อัพโหลดเอกสารระเบียบ: ${data.fileName}`);
      }
      return { message: 'อัพโหลดเอกสารระเบียบสำเร็จ' };
    }

    if (action === 'deleteRegDocument') {
      const target = AppState.regulations.find(r => r.regId === data.regId || (r.documents && r.documents.some(d => d.docId === data.docId)));
      if (target && target.documents) {
        const docIdx = target.documents.findIndex(d => d.docId === data.docId);
        if (docIdx !== -1) {
          const docName = target.documents[docIdx].fileName;
          target.documents.splice(docIdx, 1);
          saveRegulationsToStorage();
          addAuditLog(userEmail, 'DELETE_REG_DOC', target.regId, `ลบเอกสารระเบียบ: ${docName}`);
        }
      }
      return { message: 'ลบเอกสารเรียบร้อย' };
    }

    if (action === 'deleteRegulation') {
      const idx = AppState.regulations.findIndex(r => r.regId === data.regId);
      if (idx !== -1) {
        const name = AppState.regulations[idx].title;
        AppState.regulations.splice(idx, 1);
        saveRegulationsToStorage();
        addAuditLog(userEmail, 'DELETE_REGULATION', data.regId, `ลบเรื่องระเบียบ/ข้อบังคับ: ${name}`);
      }
      return { message: 'ลบเรื่องสำเร็จ' };
    }

    return { message: 'ดำเนินการสำเร็จ' };
  }
};

// ------------------------------------------------------------------------------
// 4. LocalStorage Persistence
// ------------------------------------------------------------------------------
function loadCasesFromStorage() {
  try {
    const saved = localStorage.getItem('liquidation_demo_cases');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return JSON.parse(JSON.stringify(INITIAL_MOCK_CASES));
}

function saveCasesToStorage() {
  if (AppState.isDemoMode) {
    try {
      localStorage.setItem('liquidation_demo_cases', JSON.stringify(AppState.cases));
    } catch (e) {}
  }
}

function loadRegulationsFromStorage() {
  try {
    const saved = localStorage.getItem('regulations_demo_data');
    if (saved) {
      const data = JSON.parse(saved);
      // Auto-migrate step names and statuses if needed
      data.forEach(item => {
        if (item.status === 'รับจดทะเบียน/เห็นชอบแล้ว') item.status = 'รับจดทะเบียน/เห็นชอบ/รับทราบ';
        if (item.steps) {
          item.steps.forEach(s => {
            if (s.stepNumber === 2 && s.stepName && s.stepName.includes('กลุ่มส่งเสริมสหกรณ์')) {
              s.stepName = 'กลุ่มจัดตั้งฯ ตรวจสอบเบื้องต้น';
            }
          });
        }
      });
      return data;
    }
  } catch (e) {}
  return JSON.parse(JSON.stringify(INITIAL_MOCK_REGULATIONS));
}

function saveRegulationsToStorage() {
  if (AppState.isDemoMode) {
    try {
      localStorage.setItem('regulations_demo_data', JSON.stringify(AppState.regulations));
    } catch (e) {}
  }
}

function loadAuditLogsFromStorage() {
  try {
    const saved = localStorage.getItem('liquidation_demo_audit');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return [
    { timestamp: new Date(Date.now() - 3600000).toISOString(), email: 'admin@cpd.go.th', action: 'INIT', caseId: '-', detail: 'เริ่มต้นระบบศูนย์บริการงานนายทะเบียนสหกรณ์' }
  ];
}

function addAuditLog(email, action, caseId, detail) {
  const logItem = {
    timestamp: new Date().toISOString(),
    email: email || 'admin@cpd.go.th',
    action: action,
    caseId: caseId || '-',
    detail: detail
  };
  AppState.auditLogs.unshift(logItem);
  try {
    localStorage.setItem('liquidation_demo_audit', JSON.stringify(AppState.auditLogs));
  } catch (e) {}
}

function resetDemoData() {
  if (!confirm('ต้องการรีเซ็ตข้อมูลตัวอย่างทั้งหมด (ทั้งงานชำระบัญชี และระเบียบ/ข้อบังคับ) กลับเป็นค่าเริ่มต้นหรือไม่?')) return;
  localStorage.removeItem('liquidation_demo_cases');
  localStorage.removeItem('regulations_demo_data');
  localStorage.removeItem('liquidation_demo_audit');
  AppState.cases = JSON.parse(JSON.stringify(INITIAL_MOCK_CASES));
  AppState.regulations = JSON.parse(JSON.stringify(INITIAL_MOCK_REGULATIONS));
  AppState.auditLogs = loadAuditLogsFromStorage();
  
  applyFilters();
  updateStatsDisplay();
  applyRegFilters();
  updateRegStatsDisplay();
  updateHubStatsDisplay();
  
  showToast('รีเซ็ตข้อมูลตัวอย่างทั้งหมดกลับเป็นค่าเริ่มต้นเรียบร้อย', 'success');
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
// 6. App Initialization
// ------------------------------------------------------------------------------
async function initializeApp() {
  AppState.isDemoMode = CONFIG.FORCE_MOCK_DATA || !CONFIG.APPS_SCRIPT_URL;
  updateModeBadge();

  AppState.cases = loadCasesFromStorage();
  AppState.regulations = loadRegulationsFromStorage();
  AppState.auditLogs = loadAuditLogsFromStorage();

  loadSavedSession();
  await loadCasesData();
  await loadRegulationsData();
  setupEventListeners();
  setupGoogleAuth();

  updateHubStatsDisplay();
}

async function loadCasesData() {
  try {
    const cases = await ApiClient.get('listCases');
    if (cases && cases.length > 0) {
      AppState.cases = cases;
    }
    applyFilters();
    updateStatsDisplay();
  } catch (err) {
    console.warn('Load cases error:', err);
  }
}

async function loadRegulationsData() {
  try {
    const regs = await ApiClient.get('listRegulations');
    if (regs && regs.length > 0) {
      AppState.regulations = regs;
    }
    applyRegFilters();
    updateRegStatsDisplay();
  } catch (err) {
    console.warn('Load regulations error:', err);
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

  if (AppState.filterType !== 'ALL') {
    if (AppState.filterType === 'กลุ่มเกษตรกร') {
      list = list.filter(c => c.coopType && c.coopType.includes('กลุ่มเกษตรกร'));
    } else {
      list = list.filter(c => c.coopType === AppState.filterType);
    }
  }

  if (AppState.filterStatus === 'ACTIVE') {
    list = list.filter(c => c.caseStatus !== 'เสร็จสิ้น' && c.currentStep < 10);
  } else if (AppState.filterStatus === 'COMPLETED') {
    list = list.filter(c => c.caseStatus === 'เสร็จสิ้น' || c.currentStep >= 10);
  } else if (AppState.filterStatus === 'ISSUES') {
    list = list.filter(c => c.hasIssues);
  }

  AppState.filteredCases = list;
  renderCasesList();
  updateHubStatsDisplay();
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

  if (!gridContainer || !tableContainer || !emptyState) return;

  if (AppState.filteredCases.length === 0) {
    gridContainer.style.display = 'none';
    tableContainer.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  if (AppState.viewMode === 'grid') {
    gridContainer.style.display = 'grid';
    tableContainer.style.display = 'none';
    renderGrid(gridContainer);
  } else {
    gridContainer.style.display = 'none';
    tableContainer.style.display = 'block';
    renderTable(tableContainer);
  }
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

function renderGrid(container) {
  container.innerHTML = AppState.filteredCases.map(item => {
    const isDone = item.caseStatus === 'เสร็จสิ้น' || item.currentStep >= 10;
    const progressPercent = Math.min(100, Math.round((item.currentStep / 10) * 100));
    const stepObj = CONFIG.LIQUIDATION_STEPS.find(s => s.number === item.currentStep) || { title: `ขั้นตอนที่ ${item.currentStep}` };
    const dissolutionType = item.dissolutionType || (item.orderNumber && item.orderNumber.includes('ประกาศ') ? 'ประกาศเลิก' : 'คำสั่งเลิก');
    const isFarmerGroup = item.coopType && item.coopType.includes('กลุ่มเกษตรกร');

    return `
      <div class="case-card">
        <div class="case-card-header">
          <span class="case-type-badge ${isFarmerGroup ? 'farmer-group' : ''}">${escapeHtml(item.coopType)}</span>
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

function renderTable(container) {
  const tbody = document.getElementById('casesTableBody');
  if (!tbody) return;
  tbody.innerHTML = AppState.filteredCases.map((item, idx) => {
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
        <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
        <td>
          <strong style="color: var(--primary);">${escapeHtml(item.coopName)}</strong>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(item.regNumber)} | ${escapeHtml(item.location)}</div>
        </td>
        <td><span class="case-type-badge ${isFarmerGroup ? 'farmer-group' : ''}">${escapeHtml(item.coopType)}</span></td>
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
          <input type="date" name="liqStartDate" class="form-control">
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
        <input type="date" name="liqStartDate" class="form-control">
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
  document.getElementById('createOrderDate').valueAsDate = new Date();
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
        startDate: dateInput ? dateInput.value : '',
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
    orderDate: form.orderDate.value,
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
  document.getElementById('updateStepStartDate').value = step.startDate ? step.startDate.split('T')[0] : '';
  document.getElementById('updateStepEndDate').value = step.endDate ? step.endDate.split('T')[0] : '';
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
    startDate: form.startDate.value,
    endDate: form.endDate.value,
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
  document.getElementById('liqStartDate').valueAsDate = new Date();
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
    startDate: form.startDate.value,
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
  document.getElementById('editLiqStartDate').value = lq.startDate ? lq.startDate.split('T')[0] : '';
  document.getElementById('editLiqEndDate').value = lq.endDate ? lq.endDate.split('T')[0] : '';
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
    startDate: form.startDate.value,
    endDate: form.endDate.value,
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
  document.getElementById('editCaseOrderDate').value = caseData.orderDate ? caseData.orderDate.split('T')[0] : '';
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
    orderDate: form.orderDate.value,
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

  if (AppState.regFilterCoopType && AppState.regFilterCoopType !== 'ALL') {
    if (AppState.regFilterCoopType === 'กลุ่มเกษตรกร') {
      list = list.filter(r => r.coopType && r.coopType.includes('กลุ่มเกษตรกร'));
    } else {
      list = list.filter(r => r.coopType === AppState.regFilterCoopType);
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
  renderRegulationsList();
  updateHubStatsDisplay();
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

  if (!gridContainer || !tableContainer || !emptyState) return;

  if (AppState.filteredRegulations.length === 0) {
    gridContainer.style.display = 'none';
    tableContainer.style.display = 'none';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  if (AppState.regViewMode === 'grid') {
    gridContainer.style.display = 'grid';
    tableContainer.style.display = 'none';
    renderRegGrid(gridContainer);
  } else {
    gridContainer.style.display = 'none';
    tableContainer.style.display = 'block';
    renderRegTable(tableContainer);
  }
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

function renderRegGrid(container) {
  container.innerHTML = AppState.filteredRegulations.map(item => {
    const isApproved = item.status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || item.status === 'รับจดทะเบียน/เห็นชอบแล้ว' || item.currentStep >= 5;
    const isNeedFix = item.status === 'ส่งคืนแก้ไข';
    const progressPercent = Math.min(100, Math.round((item.currentStep / 5) * 100));
    const stepObj = CONFIG.REGULATION_STEPS.find(s => s.number === item.currentStep) || { title: `ขั้นตอนที่ ${item.currentStep}` };
    const isFarmerGroup = item.coopType && item.coopType.includes('กลุ่มเกษตรกร');

    let statusBadgeClass = 'active';
    let statusText = '● อยู่ระหว่างพิจารณา';
    if (isApproved) {
      statusBadgeClass = 'completed';
      statusText = '✓ รับจดทะเบียน/เห็นชอบ/รับทราบ';
    } else if (isNeedFix) {
      statusBadgeClass = 'issue';
      statusText = '⚠️ ส่งคืนแก้ไข';
    }

    const typeBadgeClass = item.docType === 'ข้อบังคับสหกรณ์' ? 'reg-type-bylaw' : 'reg-type-rule';

    return `
      <div class="case-card">
        <div class="case-card-header">
          <div style="display: flex; gap: 6px; flex-wrap: wrap;">
            <span class="case-type-badge ${typeBadgeClass}">${escapeHtml(item.docType)}</span>
            <span class="case-type-badge ${isFarmerGroup ? 'farmer-group' : ''}">${escapeHtml(item.coopType || 'สหกรณ์')}</span>
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

function renderRegTable(container) {
  const tbody = document.getElementById('regTableBody');
  if (!tbody) return;

  tbody.innerHTML = AppState.filteredRegulations.map((item, idx) => {
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
        <td style="text-align: center; color: var(--text-muted);">${idx + 1}</td>
        <td>
          <strong style="color: var(--primary);">${escapeHtml(item.coopName)}</strong>
          <div style="font-size: 0.8rem; color: var(--text-muted);">${escapeHtml(item.regNumber)} | <span class="case-type-badge ${isFarmerGroup ? 'farmer-group' : ''}" style="font-size: 0.7rem;">${escapeHtml(item.coopType || 'สหกรณ์')}</span></div>
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

function openCreateRegModal() {
  if (!AppState.currentUser) {
    showToast('กรุณาเข้าสู่ระบบในฐานะ Admin ก่อน', 'warning');
    openModal('loginModal');
    return;
  }
  document.getElementById('createRegForm').reset();
  document.getElementById('createRegSubmitDate').valueAsDate = new Date();
  openModal('createRegModal');
}

async function handleCreateRegSubmit(e) {
  e.preventDefault();
  const form = e.target;
  const payload = {
    coopName: form.coopName.value.trim(),
    regNumber: form.regNumber.value.trim(),
    coopType: form.coopType ? form.coopType.value : 'สหกรณ์การเกษตร',
    docType: form.docType.value,
    title: form.title.value.trim(),
    docNumber: form.docNumber.value.trim(),
    submitDate: form.submitDate.value,
    officerName: form.officerName.value.trim(),
    officerContact: form.officerContact.value.trim(),
    note: form.note.value.trim()
  };

  if (!payload.coopName || !payload.title) {
    showToast('กรุณากรอกข้อมูลที่จำเป็นให้ครบถ้วน', 'warning');
    return;
  }

  setLoading(true);
  try {
    await ApiClient.post('createRegulation', payload);
    showToast(`ยื่นเรื่อง ${payload.docType} สำเร็จ`, 'success');
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
  document.getElementById('updateRegStepStartDate').value = step.startDate ? step.startDate.split('T')[0] : '';
  document.getElementById('updateRegStepEndDate').value = step.endDate ? step.endDate.split('T')[0] : '';
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
    startDate: form.startDate.value,
    endDate: form.endDate.value,
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
  document.getElementById('editRegSubmitDate').value = regData.submitDate ? regData.submitDate.split('T')[0] : '';
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
    submitDate: form.submitDate.value,
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
  if (window.google && google.accounts && google.accounts.id && CONFIG.GOOGLE_CLIENT_ID) {
    google.accounts.id.initialize({
      client_id: CONFIG.GOOGLE_CLIENT_ID,
      callback: handleGoogleSignInCallback
    });

    const googleBtnContainer = document.getElementById('googleSignInBtn');
    if (googleBtnContainer) {
      google.accounts.id.renderButton(googleBtnContainer, {
        theme: 'outline',
        size: 'large',
        text: 'signin_with',
        shape: 'rectangular'
      });
    }
  }
}

async function handleGoogleSignInCallback(response) {
  setLoading(true);
  try {
    const authData = await ApiClient.post('login', { idToken: response.credential });
    setLoggedInUser(authData);
    closeModal('loginModal');
    showToast(`ยินดีต้อนรับ ${authData.name}`, 'success');
  } catch (err) {
    showToast('เข้าสู่ระบบไม่สำเร็จ: ' + err.message, 'error');
  } finally {
    setLoading(false);
  }
}

async function handleDemoLogin() {
  setLoading(true);
  try {
    const authData = await ApiClient.post('login', {
      email: 'admin@cpd.go.th',
      name: 'ผู้ดูแลระบบ (Admin Demo)'
    });
    setLoggedInUser(authData);
    closeModal('loginModal');
    showToast(`เข้าสู่ระบบในฐานะ ${authData.name}`, 'success');
  } catch (err) {
    showToast('เกิดข้อผิดพลาด: ' + err.message, 'error');
  } finally {
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
  } catch (e) {}
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

  if (AppState.currentUser) {
    if (loginBtn) loginBtn.style.display = 'none';
    if (userProfile) {
      userProfile.style.display = 'flex';
      document.getElementById('navUserName').innerText = AppState.currentUser.name;
      document.getElementById('navUserRole').innerText = AppState.currentUser.role || 'Admin';
    }
    if (adminAddCaseBtn) adminAddCaseBtn.style.display = AppState.currentView === 'liquidation' ? 'inline-flex' : 'none';
    if (adminAddRegBtn) adminAddRegBtn.style.display = AppState.currentView === 'regulations' ? 'inline-flex' : 'none';
  } else {
    if (loginBtn) loginBtn.style.display = 'inline-flex';
    if (userProfile) userProfile.style.display = 'none';
    if (adminAddCaseBtn) adminAddCaseBtn.style.display = 'none';
    if (adminAddRegBtn) adminAddRegBtn.style.display = 'none';
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

  document.getElementById('filterCoopType')?.addEventListener('change', (e) => {
    AppState.filterType = e.target.value;
    applyFilters();
  });

  document.getElementById('filterCaseStatus')?.addEventListener('change', (e) => {
    AppState.filterStatus = e.target.value;
    applyFilters();
  });

  // Liquidation View Toggle
  const btnGridView = document.getElementById('btnGridView');
  const btnTableView = document.getElementById('btnTableView');
  if (btnGridView && btnTableView) {
    btnGridView.addEventListener('click', () => {
      AppState.viewMode = 'grid';
      btnGridView.classList.add('active');
      btnTableView.classList.remove('active');
      renderCasesList();
    });
    btnTableView.addEventListener('click', () => {
      AppState.viewMode = 'table';
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

  document.getElementById('filterRegCoopType')?.addEventListener('change', (e) => {
    AppState.regFilterCoopType = e.target.value;
    applyRegFilters();
  });

  document.getElementById('filterRegDocType')?.addEventListener('change', (e) => {
    AppState.regFilterDocType = e.target.value;
    applyRegFilters();
  });

  document.getElementById('filterRegStatus')?.addEventListener('change', (e) => {
    AppState.regFilterStatus = e.target.value;
    applyRegFilters();
  });

  // Regulations View Toggle
  const btnRegGridView = document.getElementById('btnRegGridView');
  const btnRegTableView = document.getElementById('btnRegTableView');
  if (btnRegGridView && btnRegTableView) {
    btnRegGridView.addEventListener('click', () => {
      AppState.regViewMode = 'grid';
      btnRegGridView.classList.add('active');
      btnRegTableView.classList.remove('active');
      renderRegulationsList();
    });
    btnRegTableView.addEventListener('click', () => {
      AppState.regViewMode = 'table';
      btnRegTableView.classList.add('active');
      btnRegGridView.classList.remove('active');
      renderRegulationsList();
    });
  }

  // Forms
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

function updateModeBadge() {
  const badge = document.getElementById('appModeBadge');
  if (!badge) return;
  badge.className = AppState.isDemoMode ? 'badge-mode demo' : 'badge-mode live';
  badge.innerHTML = AppState.isDemoMode ? '🧪 โหมดทดสอบ (Demo)' : '🟢 เชื่อมต่อสด (Live)';
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
    return `${date.getDate()} ${months[date.getMonth()]} ${date.getFullYear() + 543}`;
  } catch (e) {
    return dateStr;
  }
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

async function openAuditLogModal() {
  setLoading(true);
  try {
    const logs = await ApiClient.get('getAuditLogs');
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
document.addEventListener('DOMContentLoaded', initializeApp);
