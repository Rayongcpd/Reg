/**
 * ==============================================================================
 * การกำหนดค่าระบบติดตามการชำระบัญชีสหกรณ์ (Cooperative Liquidation Tracking System)
 * ==============================================================================
 */

const CONFIG = {
  // URL ที่ได้จากการ Deploy Apps Script (Web App URL)
  APPS_SCRIPT_URL: 'https://script.google.com/macros/s/AKfycbwvlRLjCX30PNHS0rx92fwjg6uVa2RHum30M1rgRRV34pwvoQlTWxgQayHGVS31L7g/exec',

  // Google OAuth 2.0 Client ID (สำหรับปุ่ม Google Sign-In หากต้องการใช้งาน)
  GOOGLE_CLIENT_ID: '',

  // ข้อมูลหน่วยงานและระบบ
  APP_INFO: {
    NAME: 'ระบบติดตามการชำระบัญชีสหกรณ์',
    NAME_EN: 'Cooperative Liquidation Tracking System',
    DEPARTMENT: 'กรมส่งเสริมสหกรณ์',
    MINISTRY: 'กระทรวงเกษตรและสหกรณ์',
    VERSION: '1.0.0'
  },

  // สหกรณ์ 7 ประเภทตาม พ.ร.บ. สหกรณ์ พ.ศ. 2542
  COOP_TYPES: [
    'สหกรณ์การเกษตร',
    'สหกรณ์ประมง',
    'สหกรณ์นิคม',
    'สหกรณ์ร้านค้า',
    'สหกรณ์บริการ',
    'สหกรณ์ออมทรัพย์',
    'สหกรณ์เครดิตยูเนี่ยน'
  ],

  // กลุ่มเกษตรกร (แยกตามประเภทอาชีพเกษตรกรรม ตาม พ.ร.ฎ. ว่าด้วยกลุ่มเกษตรกร)
  FARMER_GROUP_TYPES: [
    'กลุ่มเกษตรกรทำนา',
    'กลุ่มเกษตรกรทำไร่',
    'กลุ่มเกษตรกรทำสวน',
    'กลุ่มเกษตรกรเลี้ยงสัตว์',
    'กลุ่มเกษตรกรประมง',
    'กลุ่มเกษตรกรอื่นๆ'
  ],

  // กลุ่มส่งเสริมสหกรณ์ / หน่วยงานกำกับดูแลที่รับผิดชอบ (Rayong CPD)
  PROMOTION_GROUPS: [
    'กลุ่มส่งเสริมสหกรณ์ 1',
    'กลุ่มส่งเสริมสหกรณ์ 2',
    'กลุ่มส่งเสริมสหกรณ์ 3',
    'นิคมสหกรณ์ชะแวะ'
  ],

  // ฐานข้อมูลสหกรณ์และกลุ่มเกษตรกร (เริ่มต้นว่าง ให้ผู้ใช้นำเข้าตามกลุ่มที่ต้องการ)
  COOPERATIVES: [],

  // รายการรวมสถาบันทั้งหมด
  ALL_INSTITUTION_TYPES: [
    'สหกรณ์การเกษตร',
    'สหกรณ์ประมง',
    'สหกรณ์นิคม',
    'สหกรณ์ร้านค้า',
    'สหกรณ์บริการ',
    'สหกรณ์ออมทรัพย์',
    'สหกรณ์เครดิตยูเนี่ยน',
    'กลุ่มเกษตรกรทำนา',
    'กลุ่มเกษตรกรทำไร่',
    'กลุ่มเกษตรกรทำสวน',
    'กลุ่มเกษตรกรเลี้ยงสัตว์',
    'กลุ่มเกษตรกรประมง',
    'กลุ่มเกษตรกรอื่นๆ'
  ],

  // 10 ขั้นตอนมาตรฐาน
  LIQUIDATION_STEPS: [
    { number: 1, title: 'ประกาศ/เผยแพร่การเลิกและผู้ชำระบัญชี', desc: 'ประกาศในราชกิจจานุเบกษา/หนังสือพิมพ์ และแจ้งนายทะเบียน' },
    { number: 2, title: 'รับมอบทรัพย์สิน บัญชี เอกสาร และทำงบการเงิน ณ วันเลิก', desc: 'ตามมาตรา 80 แห่ง พ.ร.บ. สหกรณ์' },
    { number: 3, title: 'ส่งงบการเงิน ณ วันเลิก ให้ผู้สอบบัญชี', desc: 'ส่งให้ผู้สอบบัญชีของกรมตรวจบัญชีสหกรณ์หรือผู้สอบบัญชีรับอนุญาต' },
    { number: 4, title: 'ผู้สอบบัญชีตรวจสอบและรับรองงบการเงิน', desc: 'ผู้สอบบัญชีตรวจสอบและลงนามรับรองงบการเงิน ณ วันเลิก' },
    { number: 5, title: 'เสนอขออนุมัติงบการเงิน ณ วันเลิก', desc: 'เสนอที่ประชุมใหญ่ของสหกรณ์ หรือนายทะเบียนสหกรณ์ (นทส.)' },
    { number: 6, title: 'จัดการทรัพย์สิน หนี้สิน และชำระสะสางหนี้สิน', desc: 'รวบรวมทรัพย์สิน เรียกเก็บหนี้สิน จำหน่ายทรัพย์สิน และจ่ายคืนเจ้าหนี้' },
    { number: 7, title: 'จัดทำรายงานผลและงบเสร็จสิ้นการชำระบัญชี', desc: 'ตามมาตรา 87 แห่ง พ.ร.บ. สหกรณ์' },
    { number: 8, title: 'ผู้สอบบัญชีตรวจสอบและรับรองงบเสร็จสิ้น', desc: 'ผู้สอบบัญชีตรวจสอบและรับรองงบเสร็จสิ้นการชำระบัญชี' },
    { number: 9, title: 'นายทะเบียนสหกรณ์สั่งถอนชื่อสหกรณ์', desc: 'นายทะเบียนสหกรณ์สั่งถอนชื่อสหกรณ์ออกจากทะเบียน' },
    { number: 10, title: 'ส่งมอบบรรดาสมุด บัญชี และเอกสาร', desc: 'ส่งมอบเอกสารทั้งหมดให้แก่นายทะเบียนสหกรณ์เพื่อเก็บรักษา' }
  ],

  // 4 ขั้นตอนมาตรฐานการพิจารณาระเบียบและข้อบังคับสหกรณ์
  REGULATION_STEPS: [
    { number: 1, title: 'ฝ่ายบริหาร สำนักงานสหกรณ์จังหวัดรับเอกสาร', desc: 'ฝ่ายบริหาร สำนักงานสหกรณ์จังหวัดรับเอกสารคำขอและลงทะเบียนรับเรื่อง' },
    { number: 2, title: 'กลุ่มจัดตั้งและส่งเสริมสหกรณ์ ตรวจสอบข้อมูล', desc: 'กลุ่มจัดตั้งและส่งเสริมสหกรณ์ตรวจสอบความถูกต้องครบถ้วนของข้อมูล เอกสาร และข้อกฎหมาย' },
    { number: 3, title: 'เสนอนายทะเบียนสหกรณ์ พิจารณา', desc: 'เสนอนายทะเบียนสหกรณ์ หรือผู้ได้รับมอบอำนาจพิจารณาให้ความเห็นชอบ/รับจดทะเบียน' },
    { number: 4, title: 'ส่งเอกสารให้สหกรณ์และหน่วยงานที่เกี่ยวข้อง', desc: 'ส่งเอกสารและหนังสือแจ้งผลให้แก่สหกรณ์และหน่วยงานที่เกี่ยวข้องถือใช้ปฏิบัติ' }
  ],

  // ประเภทระเบียบและข้อบังคับสหกรณ์ พร้อมกรอบเวลากำหนดพิจารณา (SLA)
  REGULATION_DOC_TYPES: [
    {
      id: 'ข้อบังคับสหกรณ์',
      label: 'ข้อบังคับสหกรณ์ (14 วัน)',
      shortLabel: 'ข้อบังคับ',
      category: 'ข้อบังคับ',
      slaDays: 14,
      actionWord: 'รับจดทะเบียน',
      desc: 'นายทะเบียนสหกรณ์พิจารณารับจดทะเบียนข้อบังคับภายใน 14 วัน หลังจากฝ่ายลงรับหนังสือ',
      badgeClass: 'reg-type-bylaw',
      themeColor: '#0284c7'
    },
    {
      id: 'ระเบียบสหกรณ์ (เห็นชอบ)',
      label: 'ระเบียบสหกรณ์ - เห็นชอบ (7 วัน)',
      shortLabel: 'ระเบียบ (เห็นชอบ)',
      category: 'ระเบียบ',
      slaDays: 7,
      actionWord: 'เห็นชอบ',
      desc: 'นายทะเบียนสหกรณ์จะต้องมีหนังสือเห็นชอบภายใน 7 วัน หลังจากฝ่ายลงรับหนังสือ',
      badgeClass: 'reg-type-approval',
      themeColor: '#0d9488'
    },
    {
      id: 'ระเบียบสหกรณ์ (รับทราบ)',
      label: 'ระเบียบสหกรณ์ - รับทราบ (30 วัน)',
      shortLabel: 'ระเบียบ (รับทราบ)',
      category: 'ระเบียบ',
      slaDays: 30,
      actionWord: 'รับทราบ',
      desc: 'นายทะเบียนสหกรณ์พิจารณารับทราบภายใน 30 วัน หลังจากฝ่ายลงรับหนังสือ',
      badgeClass: 'reg-type-ack',
      themeColor: '#6366f1'
    }
  ]
};

/**
 * ==============================================================================
 * เครื่องมือคำนวณวันทำการ (Working Days Calculator)
 * ไม่นับวันเสาร์-อาทิตย์ และวันหยุดราชการไทย (Thai Public Holidays)
 * ==============================================================================
 */
const WorkingDaysUtil = {
  // วันหยุดประจำปีแบบระบุวันคงที่ (MM-DD)
  FIXED_HOLIDAYS: {
    '01-01': 'วันขึ้นปีใหม่',
    '04-06': 'วันจักรี',
    '04-13': 'วันสงกรานต์',
    '04-14': 'วันสงกรานต์',
    '04-15': 'วันสงกรานต์',
    '05-01': 'วันแรงงานแห่งชาติ',
    '05-04': 'วันฉัตรมงคล',
    '06-03': 'วันเฉลิมพระชนมพรรษาสมเด็จพระนางเจ้าฯ พระบรมราชินี',
    '07-28': 'วันเฉลิมพระชนมพรรษาพระบาทสมเด็จพระเจ้าอยู่หัว (ร.10)',
    '08-12': 'วันแม่แห่งชาติ / วันเฉลิมพระชนมพรรษาสมเด็จพระบรมราชชนนีพันปีหลวง',
    '10-13': 'วันนวมินทรมหาราช',
    '10-23': 'วันปิยมหาราช',
    '12-05': 'วันพ่อแห่งชาติ / วันชาติ / วันคล้ายวันพระบรมราชสมภพ ร.9',
    '12-10': 'วันรัฐธรรมนูญ',
    '12-31': 'วันสิ้นปี'
  },

  // ฐานข้อมูลวันหยุดตามปฏิทินจันทรคติ วันหยุดชดเชย และวันหยุดราชการกรณีพิเศษ (YYYY-MM-DD)
  SPECIFIC_HOLIDAYS: {
    // 2566 (2023)
    '2023-01-02': 'วันหยุดชดเชยวันขึ้นปีใหม่',
    '2023-03-06': 'วันมาฆบูชา',
    '2023-04-17': 'วันหยุดชดเชยวันสงกรานต์',
    '2023-05-05': 'วันหยุดราชการกรณีพิเศษ',
    '2023-06-05': 'วันหยุดชดเชยวันวิสาขบูชาและวันเฉลิมฯ พระราชินี',
    '2023-07-31': 'วันหยุดราชการกรณีพิเศษ',
    '2023-08-01': 'วันอาสาฬหบูชา',
    '2023-08-02': 'วันเข้าพรรษา',
    '2023-08-14': 'วันหยุดชดเชยวันแม่แห่งชาติ',
    '2023-12-11': 'วันหยุดชดเชยวันรัฐธรรมนูญ',
    '2023-12-29': 'วันหยุดราชการกรณีพิเศษ',

    // 2567 (2024)
    '2024-01-01': 'วันขึ้นปีใหม่',
    '2024-01-02': 'วันหยุดชดเชยวันสิ้นปี',
    '2024-02-26': 'วันหยุดชดเชยวันมาฆบูชา',
    '2024-04-08': 'วันหยุดชดเชยวันจักรี',
    '2024-04-12': 'วันหยุดราชการกรณีพิเศษ',
    '2024-04-16': 'วันหยุดชดเชยวันสงกรานต์',
    '2024-05-06': 'วันหยุดชดเชยวันฉัตรมงคล',
    '2024-05-22': 'วันวิสาขบูชา',
    '2024-07-20': 'วันอาสาฬหบูชา',
    '2024-07-22': 'วันหยุดชดเชยวันอาสาฬหบูชาและวันเข้าพรรษา',
    '2024-07-29': 'วันหยุดชดเชยวันเฉลิมฯ ร.10',
    '2024-10-14': 'วันหยุดชดเชยวันนวมินทรมหาราช',
    '2024-12-30': 'วันหยุดราชการกรณีพิเศษ',

    // 2568 (2025)
    '2025-01-01': 'วันขึ้นปีใหม่',
    '2025-02-12': 'วันมาฆบูชา',
    '2025-04-07': 'วันหยุดชดเชยวันจักรี',
    '2025-04-16': 'วันหยุดชดเชยวันสงกรานต์',
    '2025-05-05': 'วันหยุดชดเชยวันฉัตรมงคล',
    '2025-05-11': 'วันวิสาขบูชา',
    '2025-05-12': 'วันหยุดชดเชยวันวิสาขบูชา',
    '2025-06-02': 'วันหยุดราชการกรณีพิเศษ',
    '2025-07-10': 'วันอาสาฬหบูชา',
    '2025-07-11': 'วันเข้าพรรษา',
    '2025-08-11': 'วันหยุดราชการกรณีพิเศษ',

    // 2569 (2026 - ปีปัจจุบัน)
    '2026-01-01': 'วันขึ้นปีใหม่',
    '2026-01-02': 'วันหยุดราชการกรณีพิเศษ',
    '2026-03-03': 'วันมาฆบูชา',
    '2026-04-06': 'วันจักรี',
    '2026-04-13': 'วันสงกรานต์',
    '2026-04-14': 'วันสงกรานต์',
    '2026-04-15': 'วันสงกรานต์',
    '2026-05-01': 'วันแรงงานแห่งชาติ',
    '2026-05-04': 'วันฉัตรมงคล',
    '2026-05-31': 'วันวิสาขบูชา',
    '2026-06-01': 'วันหยุดชดเชยวันวิสาขบูชา',
    '2026-06-03': 'วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี',
    '2026-07-28': 'วันเฉลิมพระชนมพรรษา ร.10',
    '2026-07-29': 'วันอาสาฬหบูชา',
    '2026-07-30': 'วันเข้าพรรษา',
    '2026-08-12': 'วันแม่แห่งชาติ',
    '2026-10-13': 'วันนวมินทรมหาราช',
    '2026-10-23': 'วันปิยมหาราช',
    '2026-12-05': 'วันพ่อแห่งชาติ',
    '2026-12-07': 'วันหยุดชดเชยวันพ่อแห่งชาติ',
    '2026-12-10': 'วันรัฐธรรมนูญ',
    '2026-12-31': 'วันสิ้นปี',

    // 2570 (2027)
    '2027-01-01': 'วันขึ้นปีใหม่',
    '2027-02-21': 'วันมาฆบูชา',
    '2027-02-22': 'วันหยุดชดเชยวันมาฆบูชา',
    '2027-04-06': 'วันจักรี',
    '2027-04-13': 'วันสงกรานต์',
    '2027-04-14': 'วันสงกรานต์',
    '2027-04-15': 'วันสงกรานต์',
    '2027-04-16': 'วันหยุดชดเชยวันสงกรานต์',
    '2027-05-03': 'วันหยุดชดเชยวันแรงงานแห่งชาติ',
    '2027-05-04': 'วันฉัตรมงคล',
    '2027-05-20': 'วันวิสาขบูชา',
    '2027-06-03': 'วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี',
    '2027-07-18': 'วันอาสาฬหบูชา',
    '2027-07-19': 'วันเข้าพรรษา / วันหยุดชดเชย',
    '2027-07-28': 'วันเฉลิมพระชนมพรรษา ร.10',
    '2027-08-12': 'วันแม่แห่งชาติ',
    '2027-10-13': 'วันนวมินทรมหาราช',
    '2027-10-25': 'วันหยุดชดเชยวันปิยมหาราช',
    '2027-12-06': 'วันหยุดชดเชยวันพ่อแห่งชาติ',
    '2027-12-10': 'วันรัฐธรรมนูญ',
    '2027-12-31': 'วันสิ้นปี',

    // 2571 (2028)
    '2028-01-01': 'วันขึ้นปีใหม่',
    '2028-01-03': 'วันหยุดชดเชยวันขึ้นปีใหม่',
    '2028-02-09': 'วันมาฆบูชา',
    '2028-04-06': 'วันจักรี',
    '2028-04-13': 'วันสงกรานต์',
    '2028-04-14': 'วันสงกรานต์',
    '2028-04-15': 'วันสงกรานต์',
    '2028-04-17': 'วันหยุดชดเชยวันสงกรานต์',
    '2028-05-01': 'วันแรงงานแห่งชาติ',
    '2028-05-04': 'วันฉัตรมงคล',
    '2028-05-08': 'วันวิสาขบูชา',
    '2028-06-03': 'วันเฉลิมพระชนมพรรษาสมเด็จพระราชินี',
    '2028-06-05': 'วันหยุดชดเชยวันเฉลิมฯ พระราชินี',
    '2028-07-06': 'วันอาสาฬหบูชา',
    '2028-07-07': 'วันเข้าพรรษา',
    '2028-07-28': 'วันเฉลิมพระชนมพรรษา ร.10',
    '2028-08-12': 'วันแม่แห่งชาติ',
    '2028-08-14': 'วันหยุดชดเชยวันแม่แห่งชาติ',
    '2028-10-13': 'วันนวมินทรมหาราช',
    '2028-10-23': 'วันปิยมหาราช',
    '2028-12-05': 'วันพ่อแห่งชาติ',
    '2028-12-10': 'วันรัฐธรรมนูญ',
    '2028-12-11': 'วันหยุดชดเชยวันรัฐธรรมนูญ',
    '2028-12-31': 'วันสิ้นปี'
  },

  /**
   * แปลงข้อมูลวันที่ใดๆ (Date object, ISO string, 'DD/MM/YYYY' พ.ศ./ค.ศ.) เป็น Date Object (CE)
   */
  parseDate(val) {
    if (!val) return null;
    if (val instanceof Date) {
      if (isNaN(val.getTime())) return null;
      return new Date(val.getFullYear(), val.getMonth(), val.getDate());
    }
    if (typeof val === 'number') {
      const d = new Date(val);
      return isNaN(d.getTime()) ? null : new Date(d.getFullYear(), d.getMonth(), d.getDate());
    }
    const str = String(val).trim();
    if (!str || str === '-' || str === 'null' || str === 'undefined') return null;

    // ตรวจสอบรูปแบบ วว/ดด/ปปปป (พ.ศ. หรือ ค.ศ.)
    const ddmmyyyy = str.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
    if (ddmmyyyy) {
      const d = parseInt(ddmmyyyy[1], 10);
      const m = parseInt(ddmmyyyy[2], 10) - 1;
      let y = parseInt(ddmmyyyy[3], 10);
      if (y > 2400) y -= 543;
      return new Date(y, m, d);
    }

    // ตรวจสอบรูปแบบ YYYY-MM-DD
    const yyyymmdd = str.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (yyyymmdd) {
      let y = parseInt(yyyymmdd[1], 10);
      if (y > 2400) y -= 543;
      const m = parseInt(yyyymmdd[2], 10) - 1;
      const d = parseInt(yyyymmdd[3], 10);
      return new Date(y, m, d);
    }

    // fallback แปลงด้วย Date parser ทั่วไป
    const d = new Date(str);
    if (!isNaN(d.getTime())) {
      let y = d.getFullYear();
      if (y > 2400) y -= 543;
      return new Date(y, d.getMonth(), d.getDate());
    }
    return null;
  },

  formatIsoDate(d) {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  },

  getHolidayName(date) {
    const iso = this.formatIsoDate(date);
    if (this.SPECIFIC_HOLIDAYS[iso]) {
      return this.SPECIFIC_HOLIDAYS[iso];
    }
    const mmdd = iso.substring(5);
    if (this.FIXED_HOLIDAYS[mmdd]) {
      return this.FIXED_HOLIDAYS[mmdd];
    }
    return null;
  },

  isWeekend(date) {
    const day = date.getDay();
    return day === 0 || day === 6; // 0 = วันอาทิตย์, 6 = วันเสาร์
  },

  isNonWorkingDay(date) {
    if (this.isWeekend(date)) {
      return { isNonWorking: true, isWeekend: true, isHoliday: false, reason: date.getDay() === 0 ? 'วันอาทิตย์' : 'วันเสาร์' };
    }
    const holidayName = this.getHolidayName(date);
    if (holidayName) {
      return { isNonWorking: true, isWeekend: false, isHoliday: true, reason: holidayName };
    }
    return { isNonWorking: false, isWeekend: false, isHoliday: false };
  },

  /**
   * คำนวณจำนวนวันทำการระหว่าง startDate และ endDate
   * ไม่นับวันเสาร์-อาทิตย์ และวันหยุดราชการ
   * 
   * @param {string|Date} startDateInput 
   * @param {string|Date} endDateInput 
   * @param {string} status สถานะของขั้นตอน เช่น 'เสร็จสิ้น', 'กำลังดำเนินการ', 'ยังไม่เริ่ม'
   * @returns {Object} { hasData, workingDays, calendarDays, weekendsCount, holidaysCount, isOngoing, text, tooltip }
   */
  calculate(startDateInput, endDateInput, status) {
    const start = this.parseDate(startDateInput);
    if (!start) {
      return {
        hasData: false,
        workingDays: 0,
        calendarDays: 0,
        weekendsCount: 0,
        holidaysCount: 0,
        isOngoing: false,
        text: '-',
        tooltip: 'ยังไม่มีข้อมูลวันที่เริ่มต้น'
      };
    }

    let end = this.parseDate(endDateInput);
    let isOngoing = false;

    if (!end) {
      if (status === 'กำลังดำเนินการ' || status === 'อยู่ระหว่างพิจารณา') {
        end = this.parseDate(new Date());
        isOngoing = true;
      } else if (status === 'เสร็จสิ้น' || status === 'รับจดทะเบียน/เห็นชอบแล้ว' || status === 'รับจดทะเบียน/เห็นชอบ/รับทราบ' || status === 'รับทราบ' || status === 'เห็นชอบ' || status === 'รับจดทะเบียน') {
        end = new Date(start.getTime()); // fallback วันเดียวกัน
      } else {
        return {
          hasData: false,
          workingDays: 0,
          calendarDays: 0,
          weekendsCount: 0,
          holidaysCount: 0,
          isOngoing: false,
          text: '-',
          tooltip: 'ยังไม่ได้ระบุวันเสร็จสิ้น'
        };
      }
    }

    if (start.getTime() > end.getTime()) {
      return {
        hasData: true,
        workingDays: 0,
        calendarDays: 0,
        weekendsCount: 0,
        holidaysCount: 0,
        isOngoing,
        text: '0 วันทำการ',
        tooltip: 'วันที่เริ่มต้นอยู่หลังวันสิ้นสุด'
      };
    }

    let workingDays = 0;
    let weekendsCount = 0;
    let holidaysCount = 0;
    let calendarDays = 0;
    const holidaysFound = [];

    const curr = new Date(start.getTime());
    const endTimestamp = end.getTime();

    while (curr.getTime() <= endTimestamp) {
      calendarDays++;
      const check = this.isNonWorkingDay(curr);
      if (check.isWeekend) {
        weekendsCount++;
      } else if (check.isHoliday) {
        holidaysCount++;
        holidaysFound.push(`${this.formatIsoDate(curr)}: ${check.reason}`);
      } else {
        workingDays++;
      }
      curr.setDate(curr.getDate() + 1);
    }

    const durationText = `${workingDays} วันทำการ${isOngoing ? ' (กำลังดำเนินการ)' : ''}`;
    let tooltip = `รวมเวลาทั้งหมด ${calendarDays} วันปฏิทิน\n• วันทำการจริง: ${workingDays} วัน\n• วันเสาร์-อาทิตย์: ${weekendsCount} วัน\n• วันหยุดราชการ: ${holidaysCount} วัน`;
    if (holidaysFound.length > 0) {
      tooltip += `\n(วันหยุดราชการที่ตรงกับช่วงนี้: ${holidaysFound.join(', ')})`;
    }

    return {
      hasData: true,
      workingDays,
      calendarDays,
      weekendsCount,
      holidaysCount,
      isOngoing,
      text: durationText,
      tooltip
    };
  }
};

/**
 * ==============================================================================
 * เครื่องมือจัดการกรอบเวลา SLA ระเบียบและข้อบังคับ (Regulation SLA Utility)
 * ==============================================================================
 */
const RegSlaUtil = {
  getDocTypeConfig(docType) {
    if (!docType) return CONFIG.REGULATION_DOC_TYPES[0];
    const cleanType = String(docType).trim();
    // Exact match
    const found = CONFIG.REGULATION_DOC_TYPES.find(t => t.id === cleanType);
    if (found) return found;

    // Fuzzy matching
    if (cleanType.includes('เห็นชอบ')) {
      return CONFIG.REGULATION_DOC_TYPES.find(t => t.id === 'ระเบียบสหกรณ์ (เห็นชอบ)');
    }
    if (cleanType.includes('รับทราบ')) {
      return CONFIG.REGULATION_DOC_TYPES.find(t => t.id === 'ระเบียบสหกรณ์ (รับทราบ)');
    }
    if (cleanType.includes('ข้อบังคับ')) {
      return CONFIG.REGULATION_DOC_TYPES.find(t => t.id === 'ข้อบังคับสหกรณ์');
    }
    // Default fallback for legacy "ระเบียบสหกรณ์" -> ให้เป็นรับทราบ (30 วัน)
    if (cleanType.includes('ระเบียบ')) {
      return CONFIG.REGULATION_DOC_TYPES.find(t => t.id === 'ระเบียบสหกรณ์ (รับทราบ)');
    }
    return CONFIG.REGULATION_DOC_TYPES[0];
  },

  getCompletedStatusText(docType) {
    const conf = this.getDocTypeConfig(docType);
    if (conf && conf.actionWord) {
      return conf.actionWord;
    }
    const cleanType = String(docType || '').trim();
    if (cleanType.includes('เห็นชอบ')) return 'เห็นชอบ';
    if (cleanType.includes('รับทราบ')) return 'รับทราบ';
    if (cleanType.includes('ข้อบังคับ')) return 'รับจดทะเบียน';
    return 'รับทราบ';
  },

  calculateSla(docType, receiveDateInput, approveDateInput, isFinished) {
    const conf = this.getDocTypeConfig(docType);
    const slaDays = conf.slaDays;
    const start = WorkingDaysUtil.parseDate(receiveDateInput);

    if (!start) {
      return {
        hasData: false,
        conf,
        slaDays,
        daysUsed: 0,
        daysRemaining: slaDays,
        dueDate: null,
        status: 'no_date',
        badgeClass: 'sla-badge-muted',
        badgeText: `SLA ${slaDays} วัน`,
        isOverdue: false
      };
    }

    // คำนวณวันครบกำหนดตาม SLA (start + slaDays วัน)
    const dueDate = new Date(start.getTime());
    dueDate.setDate(dueDate.getDate() + slaDays);

    // วันที่สิ้นสุดการคิดเวลา (ถ้านายทะเบียนรับจด/เห็นชอบ/รับทราบแล้ว ใช้ approveDate หรือถ้ายังไม่เสร็จใช้วันนี้)
    let end = WorkingDaysUtil.parseDate(approveDateInput);
    let isApproved = !!isFinished;
    if (end) {
      isApproved = true;
    } else if (isFinished) {
      end = new Date(start.getTime());
    } else {
      end = WorkingDaysUtil.parseDate(new Date());
    }

    // คำนวณจำนวนวันปฏิทินที่ใช้ไป (เริ่มนับตั้งแต่วันที่ฝ่ายลงรับหนังสือ)
    const oneDayMs = 24 * 60 * 60 * 1000;
    const daysUsed = Math.max(0, Math.floor((end.getTime() - start.getTime()) / oneDayMs) + 1);
    const daysRemaining = slaDays - daysUsed;
    const isOverdue = daysUsed > slaDays;

    let status = 'ontrack';
    let badgeClass = 'sla-badge-ontrack';
    let badgeText = '';

    if (isApproved) {
      if (isOverdue) {
        status = 'completed_overdue';
        badgeClass = 'sla-badge-overdue';
        badgeText = `⚠️ เสร็จสิ้นเกิน SLA (${daysUsed}/${slaDays} วัน)`;
      } else {
        status = 'completed_ontime';
        badgeClass = 'sla-badge-done';
        badgeText = `✓ ทันกำหนด SLA (${daysUsed}/${slaDays} วัน)`;
      }
    } else {
      if (isOverdue) {
        status = 'overdue';
        badgeClass = 'sla-badge-overdue';
        badgeText = `🔴 เกิน SLA ${Math.abs(daysRemaining)} วัน`;
      } else if (daysRemaining <= 2 || (daysUsed / slaDays) >= 0.75) {
        status = 'neardue';
        badgeClass = 'sla-badge-neardue';
        badgeText = `🟡 ใกล้ครบกำหนด (เหลือ ${daysRemaining} วัน)`;
      } else {
        status = 'ontrack';
        badgeClass = 'sla-badge-ontrack';
        badgeText = `🟢 ทันกำหนด (เหลือ ${daysRemaining} วัน)`;
      }
    }

    return {
      hasData: true,
      conf,
      slaDays,
      daysUsed,
      daysRemaining,
      dueDate,
      status,
      badgeClass,
      badgeText,
      isOverdue
    };
  }
};

/**
 * ==============================================================================
 * เครื่องมือจัดการฐานข้อมูลสหกรณ์และกลุ่มส่งเสริมสหกรณ์ (Cooperative Database Utility)
 * ==============================================================================
 */
const CoopDatabaseUtil = {
  STORAGE_KEY: 'cpd_cooperative_directory_v2',

  // ดึงรายชื่อสหกรณ์ทั้งหมดจาก LocalStorage
  getAll() {
    try {
      const stored = localStorage.getItem(this.STORAGE_KEY);
      if (stored) {
        const list = JSON.parse(stored);
        if (Array.isArray(list)) return list;
      }
    } catch (e) {
      console.warn('Cannot read cooperatives from storage:', e);
    }
    return [];
  },

  // ตรวจจับประเภทสถาบัน/สหกรณ์จากชื่ออัตโนมัติ 100%
  detectType(name) {
    if (!name) return 'สหกรณ์การเกษตร';
    const n = String(name).trim();

    // 1. กลุ่มเกษตรกร (แยกประเภทตามสายอาชีพ)
    if (n.includes('กลุ่มเกษตรกร')) {
      if (n.includes('ทำสวน') || n.includes('สวน')) return 'กลุ่มเกษตรกรทำสวน';
      if (n.includes('ทำไร่') || n.includes('ไร่')) return 'กลุ่มเกษตรกรทำไร่';
      if (n.includes('ทำนา') || n.includes('นา')) return 'กลุ่มเกษตรกรทำนา';
      if (n.includes('ประมง') || n.includes('สัตว์น้ำ')) return 'กลุ่มเกษตรกรประมง';
      if (n.includes('เลี้ยงสัตว์') || n.includes('สัตว์') || n.includes('โคนม') || n.includes('โคเนื้อ') || n.includes('สุกร')) return 'กลุ่มเกษตรกรเลี้ยงสัตว์';
      return 'กลุ่มเกษตรกร';
    }

    // 2. สหกรณ์ 7 ประเภท
    if (n.includes('ออมทรัพย์') || n.startsWith('สอ.')) {
      return 'สหกรณ์ออมทรัพย์';
    }
    if (n.includes('เครดิตยูเนี่ยน') || n.startsWith('คส.') || n.includes('ยูเนี่ยน')) {
      return 'สหกรณ์เครดิตยูเนี่ยน';
    }
    if (n.includes('ประมง')) {
      return 'สหกรณ์ประมง';
    }
    if (n.includes('สหกรณ์นิคม') || (n.includes('นิคม') && !n.includes('นิคมพัฒนา'))) {
      return 'สหกรณ์นิคม';
    }
    if (n.includes('ร้านค้า')) {
      return 'สหกรณ์ร้านค้า';
    }
    if (n.includes('บริการ') || n.includes('เดินรถ') || n.includes('แท็กซี่') || n.includes('ผู้ใช้น้ำ') || n.includes('ส่งเสริมอาชีพ')) {
      return 'สหกรณ์บริการ';
    }
    if (n.includes('การเกษตร') || n.startsWith('สกก.') || n.includes('เพื่อการเกษตร') || n.includes('สวนปาล์ม') || n.includes('ผู้ปลูก') || n.includes('แปรรูป') || n.includes('ผู้เลี้ยง') || n.includes('เกษตร') || n.includes('สกต.')) {
      return 'สหกรณ์การเกษตร';
    }

    // สหกรณ์ทั่วไปที่ไม่มีคำเฉพาะ ให้จัดเป็น สหกรณ์การเกษตร
    if (n.includes('สหกรณ์')) {
      return 'สหกรณ์การเกษตร';
    }

    return 'สหกรณ์การเกษตร';
  },

  // บันทึกรายชื่อสหกรณ์แบบกลุ่ม (Batch Import by Group)
  batchAdd(group, namesList) {
    if (!group || !Array.isArray(namesList)) return { added: 0, total: 0 };
    const current = this.getAll();
    let addedCount = 0;

    namesList.forEach(rawName => {
      let name = String(rawName || '').trim();
      // ตัดเลขลำดับข้างหน้า เช่น 1. หรือ 1) หรือ - หรือ bullet ออก
      name = name.replace(/^(\d+[\.\)]|\-|\•|\*)\s*/, '').trim();
      if (!name) return;

      // ตรวจหาประเภทอัตโนมัติจากชื่อสหกรณ์ 100%
      const detectedType = this.detectType(name);

      const existingIndex = current.findIndex(c => c.name === name);
      if (existingIndex >= 0) {
        current[existingIndex].group = group;
        current[existingIndex].type = detectedType;
      } else {
        current.push({
          name: name,
          shortName: '',
          group: group,
          type: detectedType,
          district: '',
          regNumber: ''
        });
        addedCount++;
      }
    });

    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(current));
    } catch (e) {
      console.warn('Cannot save cooperatives to storage:', e);
    }

    return { added: addedCount, total: current.length };
  },

  // ลบสหกรณ์ทีละราย
  deleteCoop(name) {
    if (!name) return false;
    let list = this.getAll();
    const prevLen = list.length;
    list = list.filter(c => c.name !== name);
    try {
      localStorage.setItem(this.STORAGE_KEY, JSON.stringify(list));
      return list.length < prevLen;
    } catch (e) {
      return false;
    }
  },

  // ล้างฐานข้อมูลทั้งหมด
  clearAll() {
    try {
      localStorage.removeItem(this.STORAGE_KEY);
      localStorage.removeItem('cpd_custom_cooperatives'); // clean legacy key
      return true;
    } catch (e) {
      return false;
    }
  },

  // ค้นหาสหกรณ์ตาม Keyword (ชื่อ, กลุ่มส่งเสริม, อำเภอ, ประเภท)
  search(keyword = '', limit = 10) {
    const all = this.getAll();
    if (!keyword || !keyword.trim()) {
      return all.slice(0, limit);
    }
    const q = keyword.toLowerCase().trim();
    const matches = all.filter(c => {
      const name = (c.name || '').toLowerCase();
      const short = (c.shortName || '').toLowerCase();
      const group = (c.group || '').toLowerCase();
      const dist = (c.district || '').toLowerCase();
      const type = (c.type || '').toLowerCase();
      const reg = (c.regNumber || '').toLowerCase();
      return name.includes(q) || short.includes(q) || group.includes(q) || dist.includes(q) || type.includes(q) || reg.includes(q);
    });

    // เรียงลำดับ: คำที่ขึ้นต้นตรงกันมาก่อน
    matches.sort((a, b) => {
      const aStarts = (a.name || '').toLowerCase().startsWith(q) ? 1 : 0;
      const bStarts = (b.name || '').toLowerCase().startsWith(q) ? 1 : 0;
      return bStarts - aStarts;
    });

    return matches.slice(0, limit);
  },

  // ค้นหาแบบตรงชื่อหรือใกล้เคียงที่สุด
  findByName(name) {
    if (!name) return null;
    const clean = name.trim().toLowerCase();
    const all = this.getAll();
    return all.find(c => (c.name || '').trim().toLowerCase() === clean) ||
           all.find(c => (c.shortName || '').trim().toLowerCase() === clean) ||
           all.find(c => (c.name || '').toLowerCase().includes(clean)) || null;
  },

  // บันทึกสหกรณ์รายเดี่ยว (ใช้งานร่วมกับ batchAdd)
  saveCoop(coopData) {
    if (!coopData || !coopData.name) return null;
    return this.batchAdd(coopData.group, [coopData.name], coopData.type);
  },

  // ซิงค์ข้อมูลล่าสุดจาก Google Sheets (แท็บ CoopDirectory) ลงเครื่อง
  async syncFromRemote() {
    if (typeof ApiClient === 'undefined' || !CONFIG.APPS_SCRIPT_URL) {
      return this.getAll();
    }
    try {
      const remoteData = await ApiClient.get('getCoopDirectory');
      if (Array.isArray(remoteData)) {
        localStorage.setItem(this.STORAGE_KEY, JSON.stringify(remoteData));
        return remoteData;
      }
    } catch (e) {
      console.warn('Cannot sync coop directory from Google Sheets:', e);
    }
    return this.getAll();
  },

  // นำเข้ารายชื่อสหกรณ์ (บันทึกทั้ง LocalStorage และ Google Sheets ทันที - เฉพาะ Admin)
  async batchAddRemote(group, namesList, defaultType) {
    if (typeof AppState !== 'undefined' && !AppState.currentUser) {
      throw new Error('ต้องเข้าสู่ระบบ Admin ก่อนทำการนำเข้ารายชื่อสหกรณ์');
    }
    const localResult = this.batchAdd(group, namesList);
    if (typeof ApiClient !== 'undefined' && CONFIG.APPS_SCRIPT_URL) {
      try {
        await ApiClient.post('saveCoopDirectoryBatch', {
          group: group,
          namesList: namesList,
          defaultType: defaultType
        });
      } catch (err) {
        console.warn('Cloud sync error on batchAdd:', err);
      }
    }
    return localResult;
  },

  // ลบสหกรณ์รายตัว (ลบทั้ง LocalStorage และ Google Sheets - เฉพาะ Admin)
  async deleteCoopRemote(name) {
    if (typeof AppState !== 'undefined' && !AppState.currentUser) {
      throw new Error('ต้องเข้าสู่ระบบ Admin ก่อนทำการลบรายชื่อสหกรณ์');
    }
    const localResult = this.deleteCoop(name);
    if (typeof ApiClient !== 'undefined' && CONFIG.APPS_SCRIPT_URL) {
      try {
        await ApiClient.post('deleteCoopFromDirectory', { coopName: name });
      } catch (err) {
        console.warn('Cloud sync error on deleteCoop:', err);
      }
    }
    return localResult;
  },

  // ล้างฐานข้อมูลทั้งหมด (ล้างทั้ง LocalStorage และ Google Sheets - เฉพาะ Admin)
  async clearAllRemote() {
    if (typeof AppState !== 'undefined' && !AppState.currentUser) {
      throw new Error('ต้องเข้าสู่ระบบ Admin ก่อนทำการล้างฐานข้อมูลสหกรณ์');
    }
    const localResult = this.clearAll();
    if (typeof ApiClient !== 'undefined' && CONFIG.APPS_SCRIPT_URL) {
      try {
        await ApiClient.post('clearCoopDirectory', {});
      } catch (err) {
        console.warn('Cloud sync error on clearAll:', err);
      }
    }
    return localResult;
  }
};


