/**
 * vibe coding 用 clasp 作業環境
 * 
 * このファイルは clasp push の動作確認用です。
 * 実際の開発コードは一時的にここで作成し、動作確認後に個人プロジェクトに移行してください。
 * 
 * 開発完了後は、このファイルを空の状態に戻してください。
 */


/**
 * タスク通知ボット - プロダクト向け（GAS × Notion × Slack）
 * 要件定義に基づく実装（DB構造に合わせて修正）
 */

/**
 * Notionプロパティ名の定数
 */
const NOTION_PROP = {
  // タスク関連
  TASK_NAME: '名前',
  TASK_STATUS: 'Taskステータス',
  TASK_DUE_DATE: 'Task期限',
  TASK_ASSIGNEE: '担当者',
  TASK_ISSUE: 'Issue',
  TASK_ISSUE_CATEGORY: 'Issue大分類',
  
  // プロダクト関連
  PRODUCT_SCRUM_MASTER: 'スクラムマスター',
  PRODUCT_REL: 'Product',
  
  // プロジェクト関連
  PROJECT_PJM: 'PjM (旧担当者)',
  PROJECT_REL: 'Project',
  
  // Issue関連
  ISSUE_TITLE: '名前',
  ISSUE_CATEGORY: '大分類',
  ISSUE_STATUS: 'ステータス'
};

/**
 * Slack API関連の定数
 */
const SLACK_API = {
  BASE_URL: 'https://slack.com/api',
  CHANNELS_JOIN: '/conversations.join',
  CHAT_POST_MESSAGE: '/chat.postMessage',
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000
};

// アプリケーション定数
const CONSTANTS = {
  NOTION: {
    PAGE_SIZE: 100,
    PRODUCT_CATEGORY: 'プロダクト開発',
    API_VERSION: '2022-06-28'
  },
  SLACK: {
    TEST_CHANNEL: 'C09ARFHBLBX',
    API_URL: 'https://slack.com/api/chat.postMessage',
    JOIN_URL: 'https://slack.com/api/conversations.join'
  },
  TIME: {
    SLEEP_MS: 1000,
    JST_OFFSET_HOURS: 9
  },
  STATUS: {
    COMPLETED: '完了',
    CANCELLED: 'キャンセル',
    BACKLOG: 'バックログ',
    EXECUTION_COMPLETED: '実行完了'
  },
  ISSUE_STATUS: {
    CANCELLED: 'キャンセル'
  }
};

// Script Properties の設定
const CONFIG = {
  NOTION_API_TOKEN: PropertiesService.getScriptProperties().getProperty('NOTION_API_TOKEN') || '',
  NOTION_TASK_DB_ID: PropertiesService.getScriptProperties().getProperty('NOTION_TASK_DB_ID') || '',
  NOTION_PRODUCT_DB_ID: PropertiesService.getScriptProperties().getProperty('NOTION_PRODUCT_DB_ID') || '',
  NOTION_PROJECT_DB_ID: PropertiesService.getScriptProperties().getProperty('NOTION_PROJECT_DB_ID') || '',
  SLACK_BOT_TOKEN: PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN') || ''
};

// 設定データは外部ファイルから読み込み（GAS環境では直接定義）
// NotionIDは動的に取得するため、初期値は空文字
const PRODUCT_MAPPING = {
  'Sakuden': { channelId: 'C4TU3K80K', mentionUserId: 'U08TLQTUJ21', notionId: '279c8633-ba79-43df-b2a7-b958c82fb421' },
  'Eitoku(MOALA認証)': { channelId: 'C01EGQMSZKL', mentionUserId: 'U048M5NP6M6', notionId: '12f13b08-0876-4e05-aaeb-6cb339af831b' },
  'Tanyu(MOALA認証+ )': { channelId: 'C08DJQCDY4F', mentionUserId: 'U048M5NP6M6', notionId: '1a07d6b7-b8c6-80c6-9cd0-ece4910b6d6c' },
  'Zeami (BioQR)': { channelId: 'C07G1TDVDS5', mentionUserId: 'U05HPC0BL3V', notionId: '99631441-6e85-4abe-9696-876b14f22ba9' },
  'Hokushin(MLS)': { channelId: 'C01BLD36T6K', mentionUserId: 'U04HB81EUTS', notionId: '9a799499-f3fe-431a-b4dc-208f58753f6b' },
  'Karaku': { channelId: 'C06RCNLQXPE', mentionUserId: 'U04HB81EUTS', notionId: '584877b3-396a-4b94-8264-89a3b16c3d2b' },
  'Karaku Web': { channelId: 'C07ENRL7EAF', mentionUserId: 'U048M5NP6M6', notionId: 'ee279157-c6db-451e-81be-f3be2472cd47' },
  'Karaku Admin': { channelId: 'C05UTQG55GR', mentionUserId: 'U08TLQTUJ21', notionId: '9386fe40-2ffc-484d-9fbd-b9adfbc96f48' },
  'Juko (MA)': { channelId: 'C055TBXD3PC', mentionUserId: 'U05HPC0BL3V', notionId: 'cafa03fe-bdc1-474a-912f-7697c04bce0e' },
  'Duchamp(MP)': { channelId: 'C03K2GKH2P9', mentionUserId: 'U048M5NP6M6', notionId: 'f7d71ec6-e5ee-4bf8-90a6-0b30c4f4a02c' },
  'Pollock(MP2)': { channelId: 'C08TSQCTEUT', mentionUserId: 'U048M5NP6M6', notionId: '2007d6b7-b8c6-8091-a919-d5132be0d9b4' },
  'Rick (MS)': { channelId: 'C0685K9KVH9', mentionUserId: 'U05HPC0BL3V', notionId: '87a38014-bb2d-4409-86f2-0c204f65248d' },
  '抽選プロダクト': { channelId: 'C07EN5VTL94', mentionUserId: 'U05HPC0BL3V', notionId: '22d7d6b7-b8c6-80d9-ac9a-fec255bf5418' }
};

const PROJECT_MAPPING = {
  'Sakura': { channelId: 'C097XNLSBM0', mentionUserId: 'U05HPC0BL3V', notionId: '24e7d6b7-b8c6-801e-a9a3-caf1963d09ad' },
  'Mukuge Phase 1': { channelId: 'C097UBAK886', mentionUserId: 'U9ZFLRRG9', notionId: '23e7d6b7-b8c6-8077-8c70-fdafbdda9aa3' },
  'HIROMITSU KITAYAMA LIVE TOUR 2025「波紋-HAMON-」': { channelId: 'C08Q0V8UKMH', mentionUserId: 'U9ZFLRRG9', notionId: '1d87d6b7-b8c6-8036-9fe0-f5ed597229bb' },
  'BE:FIRST 2nd Fan Meeting -Hello My "BESTY" vol.2-': { channelId: 'C08NGHKS1B4', mentionUserId: 'U9ZFLRRG9', notionId: '1b37d6b7-b8c6-8053-a197-d9ac8b71ffcf' },
  'Animate Girls Festival 2025 karaku/MA連携': { channelId: 'C09EP48KGDC', mentionUserId: 'U04HB81EUTS', notionId: '1a77d6b7-b8c6-80ae-a651-e2e410f7d207' },
  'MLS保守': { channelId: 'C01BLD36T6K', mentionUserId: 'U04HB81EUTS', notionId: 'df8ca670-4e41-4c6f-a747-eda6f4a685e4' },
  'UpfrontID連携': { channelId: 'C09FG28S9A4', mentionUserId: 'U04HB81EUTS', notionId: '9920cadd-2423-4505-bffd-732c728acc2b' },
  '東京ドーム': { channelId: 'C03MHJR5RSR', mentionUserId: 'U04HB81EUTS', notionId: '18d3ac08-8d5e-407a-8074-0b9f5efc1e9b' }
};


/**
 * 設定値の検証
 */
function validateConfig() {
  const requiredKeys = ['NOTION_API_TOKEN', 'NOTION_TASK_DB_ID', 'NOTION_PRODUCT_DB_ID', 'NOTION_PROJECT_DB_ID', 'SLACK_BOT_TOKEN'];
  const missingKeys = requiredKeys.filter(key => !CONFIG[key]);
  
  if (missingKeys.length > 0) {
    throw new Error(`スクリプトプロパティが設定されていません: ${missingKeys.join(', ')}`);
  }
  
  console.log('設定値の検証完了');
}

/**
 * NotionユーザーIDからSlackユーザーIDを取得する関数
 */
function getSlackUserIdByNotionId(notionUserId) {
  // NotionユーザーID → SlackユーザーIDのマッピング
  const notionIdToSlackId = {
    '0309f8dd-5eee-48d3-b750-67a72d295504': 'U047ZTZT1KN', // 池田 将久
    '07b494b0-65d0-4c89-8373-1626a2d9a30e': 'U047GCBJS1E', // KojimaToshihiro
    '09a13b52-2e64-48a2-b986-c7dcb3cc2b18': 'U013PEHEAES', // 藤田 航大
    '105acef1-3642-4263-8c6a-d3db60f4af18': 'U03U75CR6KE', // Yusuke Sugimoto
    '10ed872b-594c-81f8-8564-00022e2ef133': 'U07P46R9WLB', // 徳永啓佑
    '112230ee-a1d7-4585-890c-f8ef99c1392d': 'U046SM2G326', // OshimotoYusuke
    '130d872b-594c-8126-b27c-000291b682ed': 'U07U2CKSMLN', // 詫摩七海
    '130d872b-594c-81c5-b109-0002275aecb2': 'U07UXPUHUQG', // 林桐太
    '150d872b-594c-819f-b2b6-00020ca3372c': 'U032C0QMJ14', // 小野澤 洪作
    '1ad69063-6cf4-46b3-8331-6fe1ebfd4187': 'U03LJH7485A', // 溝上 阿宜也
    '1c7d872b-594c-818f-9322-00023ec474cb': 'U03NYU810TU', // 大森 桂太
    '1f63f8a3-938e-4cd6-ad36-670a911f0117': 'U02CX525CRY', // 佐藤 秀紀
    '1fcd872b-594c-81ac-885f-000262d65c01': 'U05H8T8G44F', // KobayashiErika
    '1fcd872b-594c-81db-a6b8-0002763ee505': 'U08TLQTUJ21', // 居原田崇史
    '21ea7e58-9bb2-4cf1-a02f-515177d7627b': 'U05APU9D1EC', // 桑野 竜乃介
    '223d872b-594c-81e6-9225-00025e9954cc': 'U093SKGPP7A', // 下村光彦
    '225d872b-594c-8168-854c-0002e028226c': 'U093Y7PPCUT', // 下江衛
    '29d06f70-afd3-4a98-a59e-941d7e203905': 'U07FFNU42G6', // 川﨑亮佑
    '2ec46fcd-9e52-40f3-b988-3ffa155f894a': 'U040U1SVDPG', // 巽 利紗
    '3da930db-8bd4-417f-b29e-12ad510feb0c': 'U04C8KW2TBP', // 橋本 瑶介
    '541506f1-801c-4077-a947-481a4b2acb6d': 'UP772HAP9', // 浜田 宏次郎
    '554518ea-b9c7-4873-b8de-e1cf149e37bf': 'U02HMMCLEGP', // 笹木 清楓
    '5b68164e-1534-4981-ae6e-a210fb00a3e1': 'U02LSRHQ9S6', // 尾関高文
    '5e48d8e3-80b1-4818-a7d2-e3780c57303b': 'U035T6ZDA8Z', // 新西 健太
    '600e857d-58d8-4c69-88e4-50742ec657c2': 'U048M5NP6M6', // 渡部 愛菜
    '6340c48b-5cbc-432f-ac00-0359c8755ff9': 'U76GVDSNL', // 大野 孝弘
    '65908b59-a065-4a9e-bb53-714c6d375e5e': 'U05JD77UTEU', // 有馬 圭人　
    '67be2e00-d7c2-4bba-8a35-c0d6d7e22e0e': 'U51PGHBHA', // 杉村 紀次
    '68390122-8af2-4e81-8def-d4f31beef940': 'U05HPEK4H4J', // 小俣 圭佑
    '68ae2236-7f2e-4813-b265-0f349bb0b8e2': 'U07GP8ME8TS', // 飯泉惇
    '6d5f740a-5b47-491c-a460-00843180b26b': 'UL7R2KP44', // 門井 香織
    '76c89b82-0744-4da4-948c-bf7a2fd14ed4': 'U062WDAD7JB', // 久保 亮介
    '7fe220b2-6cd7-49b8-8c7c-18a17c1d8c77': 'UCAP9CG01', // 別所 大輝
    '87216aa3-bf08-4f84-83e5-e117042ffdd6': 'U9ZFLRRG9', // 鈴木 遼
    '889b7bc4-3dcc-46cd-9995-d57d0a3bc81f': 'U05HPC0BL3V', // 花輪 真輝
    '8f468c30-b806-46ce-90fb-7cfb5b5e6fa5': 'U058BHU9ZB5', // 小倉 みゆき
    '928c1361-576e-4182-a504-2b3c4f3678fa': 'U05852LRK2A', // 貴高章太朗
    '9c29df4d-3933-4434-a449-c295fbd12654': 'U04HB81EUTS', // 井口 新一郎
    'abe9faf8-9f97-467d-86b8-00a4be8ee577': 'U053NGYJLMD', // 金森 秀平
    'ad72983c-0494-4c54-9b3a-f41cdfd51c9e': 'U04HAQ37000', // Toshi Matsumoto
    'b210e268-53b5-469f-82f8-da143dbd2205': 'UDL1199PU', // 元島 海
    'b89db6e6-0e47-45e4-9db2-7330e4dcc626': 'U03DL6R7LG5', // 綾部 文香
    'b916c4e0-c338-49d8-a656-1e4b069537d5': 'U05QJBJ5083', // 大隈 峻太郎
    'c189d754-060c-45b7-b891-4fd4272ebb05': 'UF0LZP6GG', // 佐藤 秀高
    'c2aca59d-0653-40a8-a6a6-8a816c4de6c7': 'U05GZD2G2LQ', // Tetsuo Sugita
    'cac402b5-4002-4d6f-880b-079b8ca997f0': 'U52KGG5QX', // 伊藤 KG 圭史
    'cc75af0e-1dfd-4294-beae-937c12e8a87c': 'U044WQD9LKS', // 赤塚 順一
    'cd928220-6907-4ba2-a044-93a034693000': 'U03STC55PK6', // 宮入 則之
    'e1a3d209-ba12-40ed-897e-1edc2c2b2ece': 'U0501CTTH17', // 日髙光貴
    'eca400cc-9cd3-4eff-914d-7105d4ce088d': 'U014CACGXJ9', // 本城 明子
    'efd19535-2158-4bd3-b8bb-e7ffb8472c43': 'U7BR1ST9B', // 下郷 勝啓
    'fa94b086-4a97-4958-9956-869347ee01a6': 'U03QYQF7RDY', // 舟口 翔梧
    '0c629930-e675-48e6-b0cf-4f0234236af3': 'U06C8D96KC0', // 鈴木 花音
    '3484763d-9776-43b0-a645-62bd0e4b2994': 'U02MB2K6796', // 塚原 慎也
    '7ca7784f-894d-4110-abac-223ed1b23940': 'UN6AZJ1H8' // 荒関 雄次
  };
  
  return notionIdToSlackId[notionUserId] || null;
}


/**
 * JST時間正規化のユーティリティ関数
 */
/**
 * JST時刻処理の改善版
 */
function getJSTDate(date = new Date()) {
  // Utilities.formatDateを使用してJST時刻を取得
  return Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
}

function getJSTToday() {
  return getJSTDate();
}

function getJSTYesterday() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getJSTDate(yesterday);
}

/**
 * JST日付文字列をエポック時間に変換
 */
function toJstEpoch(dateStr) {
  if (!dateStr) return Number.POSITIVE_INFINITY;
  
  // 日時形式の場合は日付部分のみを抽出
  let dateOnly = dateStr;
  if (dateStr.includes('T')) {
    dateOnly = dateStr.split('T')[0];
  }
  
  // 日付の妥当性をチェック
  const testDate = new Date(dateOnly + 'T00:00:00+09:00');
  if (isNaN(testDate.getTime())) {
    console.warn(`無効な日付形式: ${dateStr}`);
    return Number.POSITIVE_INFINITY;
  }
  
  return new Date(dateOnly + 'T00:00:00+09:00').getTime();
}

/**
 * 日付を相対表記に変換
 */
function formatRelativeDate(dateString) {
  if (!dateString) return '期限なし';
  
  // 日時形式の場合は日付部分のみを抽出
  let dateOnly = dateString;
  if (dateString.includes('T')) {
    dateOnly = dateString.split('T')[0];
  }
  
  // 日付の妥当性をチェック
  const testDate = new Date(dateOnly + 'T00:00:00+09:00');
  if (isNaN(testDate.getTime())) {
    console.warn(`無効な日付形式: ${dateString}`);
    return '期限なし';
  }
  
  const todayStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy-MM-dd');
  const toMs = s => new Date(s + 'T00:00:00+09:00').getTime();
  const diffDays = Math.round((toMs(dateOnly) - toMs(todayStr)) / (1000 * 60 * 60 * 24));
  const d = new Date(dateOnly + 'T00:00:00+09:00');
  const weekdays = ['日','月','火','水','木','金','土'];
  const label = `${d.getMonth()+1}/${d.getDate()}(${weekdays[d.getDay()]})`;
  
  if (diffDays === 0) return `今日(${label})`;
  if (diffDays === 1) return `明日(${label})`;
  if (diffDays > 0) return label;
  return `${label} ／ +${Math.abs(diffDays)}日超過`;
}


/**
 * 日本の祝日を取得（Google Calendar API使用）
 */
function getJapaneseHolidays(year) {
  const calendarId = 'ja.japanese#holiday@group.v.calendar.google.com';
  const startDate = new Date(year, 0, 1);
  const endDate = new Date(year, 11, 31);
  
  try {
    const events = CalendarApp.getCalendarById(calendarId)
      .getEvents(startDate, endDate);
    
    const holidays = [];
    events.forEach(event => {
      const eventDate = event.getStartTime();
      const dateStr = Utilities.formatDate(eventDate, 'Asia/Tokyo', 'yyyy-MM-dd');
      holidays.push(dateStr);
    });
    
    console.log(`${year}年の祝日数: ${holidays.length}件`);
    return holidays;
  } catch (error) {
    console.warn('祝日取得エラー（固定祝日を使用）:', error);
    return getFixedHolidays(year);
  }
}

/**
 * 固定祝日（Google Calendar APIが使用できない場合のフォールバック）
 * 年によって日付が変わる祝日も含む
 */
function getFixedHolidays(year) {
  const holidays = [
    `${year}-01-01`, // 元日
    `${year}-02-11`, // 建国記念の日
    `${year}-02-23`, // 天皇誕生日
    `${year}-04-29`, // 昭和の日
    `${year}-05-03`, // 憲法記念日
    `${year}-05-04`, // みどりの日
    `${year}-05-05`, // こどもの日
    `${year}-11-03`, // 文化の日
    `${year}-11-23`  // 勤労感謝の日
  ];
  
  // 年によって日付が変わる祝日を計算
  holidays.push(...getVariableHolidays(year));
  
  return holidays;
}

/**
 * 年によって日付が変わる祝日を計算
 */
function getVariableHolidays(year) {
  const holidays = [];
  
  // 成人の日（1月第2月曜日）
  holidays.push(getSecondMonday(year, 1));
  
  // 海の日（7月第3月曜日）
  holidays.push(getThirdMonday(year, 7));
  
  // 山の日（8月11日、2020年から）
  if (year >= 2020) {
    holidays.push(`${year}-08-11`);
  }
  
  // 敬老の日（9月第3月曜日）
  holidays.push(getThirdMonday(year, 9));
  
  // スポーツの日（10月第2月曜日、2020年から）
  if (year >= 2020) {
    holidays.push(getSecondMonday(year, 10));
  }
  
  // 春分の日（天文学的に計算）
  holidays.push(getSpringEquinox(year));
  
  // 秋分の日（天文学的に計算）
  holidays.push(getAutumnEquinox(year));
  
  // 振替休日を計算
  holidays.push(...getSubstituteHolidays(year, holidays));
  
  return holidays;
}

/**
 * 指定月の第N月曜日を取得
 */
function getNthMonday(year, month, nth) {
  const firstDay = new Date(year, month - 1, 1);
  const firstMonday = 1 + (8 - firstDay.getDay()) % 7;
  const targetDate = firstMonday + (nth - 1) * 7;
  return `${year}-${month.toString().padStart(2, '0')}-${targetDate.toString().padStart(2, '0')}`;
}

function getSecondMonday(year, month) {
  return getNthMonday(year, month, 2);
}

function getThirdMonday(year, month) {
  return getNthMonday(year, month, 3);
}

/**
 * 春分の日を計算（簡易版）
 */
function getSpringEquinox(year) {
  // 簡易計算式（実際の天文学計算ではない）
  const baseYear = 2000;
  const baseDate = 20.69; // 2000年の春分日
  const leapYearOffset = Math.floor((year - baseYear) / 4) * 0.2422;
  const day = Math.floor(baseDate + leapYearOffset);
  return `${year}-03-${day.toString().padStart(2, '0')}`;
}

/**
 * 秋分の日を計算（簡易版）
 */
function getAutumnEquinox(year) {
  // 簡易計算式（実際の天文学計算ではない）
  const baseYear = 2000;
  const baseDate = 23.26; // 2000年の秋分日
  const leapYearOffset = Math.floor((year - baseYear) / 4) * 0.2422;
  const day = Math.floor(baseDate + leapYearOffset);
  return `${year}-09-${day.toString().padStart(2, '0')}`;
}

/**
 * 振替休日を計算
 */
function getSubstituteHolidays(year, holidays) {
  const substituteHolidays = [];
  
  holidays.forEach(holiday => {
    const date = new Date(holiday + 'T00:00:00+09:00');
    const dayOfWeek = date.getDay();
    
    // 日曜日の場合は翌日が振替休日
    if (dayOfWeek === 0) {
      const nextDay = new Date(date);
      nextDay.setDate(nextDay.getDate() + 1);
      const nextDayStr = Utilities.formatDate(nextDay, 'Asia/Tokyo', 'yyyy-MM-dd');
      
      // 翌日が既に祝日でない場合のみ追加
      if (!holidays.includes(nextDayStr)) {
        substituteHolidays.push(nextDayStr);
      }
    }
  });
  
  return substituteHolidays;
}

/**
 * 通知しない日かどうかを判定
 */
function shouldSkipNotification() {
  const today = new Date();
  const todayStr = Utilities.formatDate(today, 'Asia/Tokyo', 'yyyy-MM-dd');
  const year = today.getFullYear();
  
  // 土日判定
  const dayOfWeek = today.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log(`今日は${dayOfWeek === 0 ? '日曜日' : '土曜日'}のため通知をスキップします`);
    return true;
  }
  
  // 年末年始判定（12/30-1/3）
  const month = today.getMonth() + 1;
  const day = today.getDate();
  
  if ((month === 12 && day >= 30) || (month === 1 && day <= 3)) {
    console.log(`年末年始期間（12/30-1/3）のため通知をスキップします`);
    return true;
  }
  
  // 祝日判定
  const holidays = getJapaneseHolidays(year);
  if (holidays.includes(todayStr)) {
    console.log(`今日は祝日のため通知をスキップします: ${todayStr}`);
    return true;
  }
  
  // 二重送信防止
  const lastNotifyKey = `LAST_NOTIFY_${todayStr.replace(/-/g, '')}`;
  const lastNotifyDate = PropertiesService.getScriptProperties().getProperty(lastNotifyKey);
  
  if (lastNotifyDate === todayStr) {
    console.log(`今日は既に通知済みのためスキップします: ${todayStr}`);
    return true;
  }
  
  return false;
}

/**
 * 通知実行日を記録
 */
function markNotificationExecuted() {
  const today = new Date();
  const todayStr = Utilities.formatDate(today, 'Asia/Tokyo', 'yyyy-MM-dd');
  const lastNotifyKey = `LAST_NOTIFY_${todayStr.replace(/-/g, '')}`;
  
  PropertiesService.getScriptProperties().setProperty(lastNotifyKey, todayStr);
  console.log(`通知実行日を記録しました: ${todayStr}`);
}
function getTargetProjects() {
  console.log('プロジェクトマッピングから対象プロジェクトを取得');
  
  const projects = Object.keys(PROJECT_MAPPING).map(projectName => {
    const mapping = PROJECT_MAPPING[projectName];
    return {
      id: mapping.notionId,
      name: projectName,
      pjm: getPjmNameBySlackId(mapping.mentionUserId),
      channelId: mapping.channelId,
      mentionUserId: mapping.mentionUserId
    };
  });
  
  console.log(`対象プロジェクト数: ${projects.length}`);
  console.log('対象プロジェクト:', projects.map(p => `${p.name} (${p.pjm})`));
  
  return projects;
}

/**
 * SlackユーザーIDからPjM名を取得（簡易版）
 */
function getPjmNameBySlackId(slackUserId) {
  // SlackユーザーID → 名前のマッピング（必要に応じて拡張）
  const slackIdToName = {
    'U05HPC0BL3V': '花輪 真輝',
    'U9ZFLRRG9': '鈴木 遼',
    'U04HB81EUTS': '井口 新一郎'
  };
  
  return slackIdToName[slackUserId] || 'PjM未設定';
}

/**
 * マッピングからプロダクト開発関連のプロダクトを取得（最適化版）
 */
function getProductDevelopmentProducts() {
  console.log('プロダクトマッピングから対象プロダクトを取得');
  
  const products = Object.keys(PRODUCT_MAPPING).map(productName => {
    const mapping = PRODUCT_MAPPING[productName];
    return {
      id: mapping.notionId,
      name: productName,
      scrumMaster: getScrumMasterNameBySlackId(mapping.mentionUserId),
      channelId: mapping.channelId,
      mentionUserId: mapping.mentionUserId
    };
  });
  
  console.log(`対象プロダクト数: ${products.length}`);
  console.log('対象プロダクト:', products.map(p => `${p.name} (${p.scrumMaster})`));
  
  return products;
}

/**
 * SlackユーザーIDからスクラムマスター名を取得（簡易版）
 */
function getScrumMasterNameBySlackId(slackUserId) {
  // SlackユーザーID → 名前のマッピング（必要に応じて拡張）
  const slackIdToName = {
    'U08TLQTUJ21': '居原田 崇史',
    'U048M5NP6M6': '渡部 愛菜',
    'U05HPC0BL3V': '花輪 真輝',
    'U04HB81EUTS': '井口 新一郎'
  };
  
  return slackIdToName[slackUserId] || 'スクラムマスター未設定';
}

/**
 * Notion DBクエリをページネーション対応で実行
 */
function notionQueryAll(databaseId, filter = {}) {
  const allResults = [];
  let hasMore = true;
  let startCursor = null;
  
  while (hasMore) {
  const payload = {
      page_size: CONSTANTS.NOTION.PAGE_SIZE,
      ...filter
    };
    
    if (startCursor) {
      payload.start_cursor = startCursor;
    }
    
    try {
      const response = UrlFetchApp.fetch(`https://api.notion.com/v1/databases/${databaseId}/query`, {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.NOTION_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': CONSTANTS.NOTION.API_VERSION
    },
    payload: JSON.stringify(payload)
      });
      
      const statusCode = response.getResponseCode();
      if (!statusCode.toString().startsWith('2')) {
        console.error(`Notion DBクエリエラー: ${statusCode} - ${response.getContentText()}`);
        throw new Error(`Notion API エラー: ${statusCode}`);
      }
      
    const data = JSON.parse(response.getContentText());
      allResults.push(...data.results);
      
      hasMore = data.has_more;
      startCursor = data.next_cursor;
      
      // レート制限対策
      if (hasMore) {
        Utilities.sleep(100);
      }
      
  } catch (error) {
      console.error('Notion DBクエリエラー:', error);
    throw error;
  }
  }
  
  console.log(`Notion DBクエリ完了: ${allResults.length}件取得`);
  return allResults;
}

/**
 * Task DBから期限切れ・今日期限の未完了タスクを取得（統合版・ページネーション対応）
 */
function getExpiredAndTodayTasks(entityId, entityType = 'product') {
  const today = getJSTToday();
  
  // プロパティ名を動的に決定
  const relationProperty = entityType === 'product' ? NOTION_PROP.PRODUCT_REL : NOTION_PROP.PROJECT_REL;
  
  // 基本フィルタ条件
  const baseAnd = [
        {
          property: relationProperty,
          rollup: {
            any: {
              relation: { contains: entityId }
            }
          }
        },
    { property: NOTION_PROP.TASK_STATUS, status: { does_not_equal: CONSTANTS.STATUS.COMPLETED } },
    { property: NOTION_PROP.TASK_STATUS, status: { does_not_equal: CONSTANTS.STATUS.CANCELLED } },
    { property: NOTION_PROP.TASK_STATUS, status: { does_not_equal: CONSTANTS.STATUS.BACKLOG } },
    { property: NOTION_PROP.TASK_STATUS, status: { does_not_equal: CONSTANTS.STATUS.EXECUTION_COMPLETED } }
  ];
  
  // プロダクトカテゴリフィルタ（プロダクトの場合のみ）
  const productCategoryAnd = (entityType === 'product')
    ? [{ property: NOTION_PROP.TASK_ISSUE_CATEGORY, rollup: { any: { select: { equals: CONSTANTS.NOTION.PRODUCT_CATEGORY } } } }]
    : [];
  
  // 期限切れタスクのフィルタ（今日より前の期限）
  const overdueFilter = { 
    filter: { 
      and: [...baseAnd, ...productCategoryAnd, { property: NOTION_PROP.TASK_DUE_DATE, date: { before: today } }] 
    } 
  };
  
  // 今日期限タスクのフィルタ（今日が期限）
  const todayFilter = {
    filter: {
      and: [...baseAnd, ...productCategoryAnd, { property: NOTION_PROP.TASK_DUE_DATE, date: { equals: today } }] 
    }
  };
  
  try {
    // 期限切れタスクを取得（ページネーション対応）
    const overduePages = notionQueryAll(CONFIG.NOTION_TASK_DB_ID, overdueFilter);
    const overdueTasks = overduePages.map(page => parseTask(page)).filter(task => task !== null);
    
    // 今日期限タスクを取得（ページネーション対応）
    const todayPages = notionQueryAll(CONFIG.NOTION_TASK_DB_ID, todayFilter);
    const todayTasks = todayPages.map(page => parseTask(page)).filter(task => task !== null);
    
    return {
      overdue: overdueTasks,
      today: todayTasks
    };
    
  } catch (error) {
    console.error('タスク取得エラー:', error);
    throw error;
  }
}

/**
 * Issueタイトルキャッシュを作成
 */
function createIssueTitleCache() {
  const cache = new Map();
  
  return {
    get: (issueId) => cache.get(issueId),
    set: (issueId, title) => cache.set(issueId, title),
    has: (issueId) => cache.has(issueId),
    clear: () => cache.clear()
  };
}

// グローバルキャッシュインスタンス
const issueTitleCache = createIssueTitleCache();

/**
 * Issueページのタイトルとステータスを取得（キャッシュ対応）
 */
function getIssueInfo(issueId) {
  if (!issueId) return { title: 'Issue情報なし', status: '' };
  
  // キャッシュから取得を試行
  const cacheKey = `issue_${issueId}`;
  if (issueTitleCache.has(cacheKey)) {
    return issueTitleCache.get(cacheKey);
  }
  
  try {
    const response = UrlFetchApp.fetch(`https://api.notion.com/v1/pages/${issueId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CONFIG.NOTION_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': CONSTANTS.NOTION.API_VERSION
      }
    });
    
    const statusCode = response.getResponseCode();
    if (statusCode.toString().startsWith('2')) {
      const data = JSON.parse(response.getContentText());
      const title = data.properties?.[NOTION_PROP.ISSUE_TITLE]?.title?.[0]?.text?.content || 
                   data.properties?.タイトル?.title?.[0]?.text?.content ||
                   `Issue-${issueId.slice(-8)}`;
      const status = data.properties?.[NOTION_PROP.ISSUE_STATUS]?.status?.name || '';
      
      const issueInfo = { title, status };
      // キャッシュに保存
      issueTitleCache.set(cacheKey, issueInfo);
      return issueInfo;
    } else {
      console.warn(`Issue ${issueId} の情報取得エラー: ${statusCode} - ${response.getContentText()}`);
    }
  } catch (error) {
    console.error(`Issue ${issueId} の取得エラー:`, error);
  }
  
  const fallbackInfo = { title: `Issue-${issueId.slice(-8)}`, status: '' };
  issueTitleCache.set(cacheKey, fallbackInfo);
  return fallbackInfo;
}

/**
 * Notionページをタスクオブジェクトに変換
 */
function parseTask(page) {
  // タスク名を取得（日付メンションに対応）
  let title = 'タイトルなし';
  const nameProperty = page.properties[NOTION_PROP.TASK_NAME];
  
  if (nameProperty?.title && Array.isArray(nameProperty.title)) {
    // タイトル配列の全要素を結合
    title = nameProperty.title.map(item => {
      if (item.text) {
        return item.text.content || '';
      } else if (item.mention) {
        // メンション（日付など）の場合は表示テキストを取得
        if (item.mention.date) {
          const dateStr = item.mention.date.start;
          return `@${dateStr}`;
        } else if (item.mention.user) {
          return `@${item.mention.user.name || 'ユーザー'}`;
        }
        return '';
      }
      return '';
    }).join('');
  }
  
  const status = page.properties[NOTION_PROP.TASK_STATUS]?.status?.name || 'ステータスなし';
  const dueDate = page.properties[NOTION_PROP.TASK_DUE_DATE]?.date?.start || '';
  const assignee = page.properties[NOTION_PROP.TASK_ASSIGNEE]?.people?.[0]?.name || '担当者なし';
  const assigneeId = page.properties[NOTION_PROP.TASK_ASSIGNEE]?.people?.[0]?.id || null;
  
  // Issue情報を取得（relationプロパティから）
  const issueRelation = page.properties[NOTION_PROP.TASK_ISSUE]?.relation || [];
  const issueId = issueRelation.length > 0 ? issueRelation[0].id : null;
  const issueInfo = getIssueInfo(issueId);
  
  // キャンセルされたIssueの場合はnullを返して除外
  if (issueInfo.status === CONSTANTS.ISSUE_STATUS.CANCELLED) {
    return null;
  }
  
  // Issue大分類を取得（rollupプロパティから）
  const issueCategory = page.properties[NOTION_PROP.TASK_ISSUE_CATEGORY]?.rollup?.array?.[0]?.select?.name || '分類なし';
  
  // Notionリンクを生成（正しいURL形式）
  const notionLink = `https://www.notion.so/${page.id.replace(/-/g, '')}`;
  
  return {
    id: page.id,
    title: title,
    status: status,
    dueDate: dueDate,
    assignee: assignee,
    assigneeId: assigneeId,
    notionLink: notionLink,
    issueTitle: issueInfo.title,
    issueStatus: issueInfo.status,
    issueId: issueId,
    issueCategory: issueCategory
  };
}

/**
 * タスクをIssue別にグループ化
 */
function groupTasksByIssue(tasks) {
  const grouped = {};
  
  tasks.forEach(task => {
    const issueKey = task.issueId || 'no-issue';
    const issueTitle = task.issueTitle || 'Issue情報なし';
    const issueStatus = task.issueStatus || '';
    
    if (!grouped[issueKey]) {
      grouped[issueKey] = {
        issueTitle: issueTitle,
        issueStatus: issueStatus,
        tasks: []
      };
    }
    
    grouped[issueKey].tasks.push(task);
  });
  
  return grouped;
}

/**
 * テスト用Slack通知を送信（テスト用チャンネルに送信）
 */
function sendTestSlackNotification(entityName, tasks, managerName, entityType = 'product') {
  const mapping = entityType === 'product' ? PRODUCT_MAPPING[entityName] : PROJECT_MAPPING[entityName];
  const testChannelId = 'C09ARFHBLBX'; // テスト用チャンネル
  
  console.log(`テスト通知: ${entityName} → テストチャンネル (${testChannelId})`);
  console.log(`本番通知先: ${mapping?.channelId || '未設定'}`);
  
  const blocks = createSlackBlocks(entityName, tasks, managerName, entityType);
  const text = `[テスト] ${entityName} のタスク通知`;
  
  const success = postSlackMessage(testChannelId, blocks, text);
  if (!success) {
    console.error(`[テスト] ${entityName} への通知送信が失敗しました`);
  }
}

/**
 * Slackメッセージを投稿（リトライ機能付き）
 */
function postSlackMessage(channelId, blocks, text) {
  const url = `${SLACK_API.BASE_URL}${SLACK_API.CHAT_POST_MESSAGE}`;
  const payload = {
    channel: channelId,
    blocks: blocks,
    text: text
  };
  
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload)
  };
  
  for (let attempt = 1; attempt <= SLACK_API.RETRY_ATTEMPTS; attempt++) {
  try {
    const response = UrlFetchApp.fetch(url, options);
      const statusCode = response.getResponseCode();
    const data = JSON.parse(response.getContentText());
    
    if (data.ok) {
        console.log(`Slack通知送信成功 (試行${attempt}回目)`);
        return true;
    } else {
        console.warn(`Slack通知送信失敗 (試行${attempt}回目): ${statusCode} - ${data.error}`);
        
        if (data.error === 'not_in_channel' && attempt < SLACK_API.RETRY_ATTEMPTS) {
          console.log('チャンネルに参加してからリトライします...');
          joinChannel(channelId);
          Utilities.sleep(SLACK_API.RETRY_DELAY_MS);
          continue;
        }
        
        if (attempt === SLACK_API.RETRY_ATTEMPTS) {
          console.error('Slack通知送信が最終的に失敗しました');
          return false;
      }
    }
  } catch (error) {
      console.error(`Slack通知送信エラー (試行${attempt}回目):`, error);
      if (attempt === SLACK_API.RETRY_ATTEMPTS) {
        return false;
      }
      Utilities.sleep(SLACK_API.RETRY_DELAY_MS);
    }
  }
  
  return false;
}

/**
 * Slackチャンネルに参加
 */
function joinChannel(channelId) {
  const url = `${SLACK_API.BASE_URL}${SLACK_API.CHANNELS_JOIN}`;
  const payload = { channel: channelId };
  
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload)
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const statusCode = response.getResponseCode();
    const data = JSON.parse(response.getContentText());
    
    if (data.ok) {
      console.log(`チャンネル ${channelId} への参加成功`);
      return true;
      } else {
      console.warn(`チャンネル ${channelId} への参加失敗: ${statusCode} - ${data.error}`);
      return false;
    }
  } catch (error) {
    console.error(`チャンネル ${channelId} への参加エラー:`, error);
    return false;
  }
}

/**
 * Slack通知を送信（統合版）
 */
function sendSlackNotification(entityName, tasks, managerName, entityType = 'product') {
  const mapping = entityType === 'product' ? PRODUCT_MAPPING[entityName] : PROJECT_MAPPING[entityName];
  if (!mapping || !mapping.channelId) {
    console.log(`${entityType === 'product' ? 'プロダクト' : 'プロジェクト'} ${entityName} のチャンネル設定がありません`);
    return;
  }
  
  const blocks = createSlackBlocks(entityName, tasks, managerName, entityType);
  const text = `${entityName} のタスク通知`;
  
  postSlackMessage(mapping.channelId, blocks, text);
}

/**
 * Slackブロックのフッター部分を作成
 */
function createFooterBlocks() {
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  return [{
    type: "context",
    elements: [{ type: "mrkdwn", text: `取得日時: ${nowStr}（JST）` }]
  }];
}

/**
 * Slackブロックのヘッダー部分を作成
 */
function createHeaderBlocks(entityName, tasks, managerName, entityType) {
  const mapping = entityType === 'product' ? PRODUCT_MAPPING[entityName] : PROJECT_MAPPING[entityName];
  const mentionUserId = mapping?.mentionUserId;
  
  const totalCount = tasks.overdue.length + tasks.today.length;
  const overdueCount = tasks.overdue.length;
  const todayCount = tasks.today.length;
  
  const managerLabel = entityType === 'product' ? 'スクラムマスター' : 'PjM';
  
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: `${entityName} タスク通知`
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `総件数: ${totalCount}件（期限切れ: ${overdueCount}／今日期限: ${todayCount}）`
      }
    }
  ];
  
  // メンション付きのセクション
  if (mentionUserId) {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${managerLabel}: <@${mentionUserId}>`
      }
    });
  } else {
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `${managerLabel}: ${managerName}`
      }
    });
  }
  
  blocks.push({
    type: "divider"
  });
  
  return blocks;
}

/**
 * 期限切れタスクのブロックを作成
 */
function createOverdueTaskBlocks(tasks) {
  if (tasks.overdue.length === 0) return [];
  
  const blocks = [{
    type: "section",
    text: {
      type: "mrkdwn",
      text: `⚠️ *未完了タスク（期限切れ）*`
    }
  }];
  
  // 期限切れタスクを超過日数でソート（JST-safe）
  const sortedOverdueTasks = tasks.overdue.slice().sort((a, b) => {
    return toJstEpoch(a.dueDate) - toJstEpoch(b.dueDate); // 古い順（超過日数が多い順）
  });
  
  const overdueGrouped = groupTasksByIssue(sortedOverdueTasks);
  
  Object.values(overdueGrouped).forEach(group => {
    const taskList = group.tasks.map(task => {
      const slackUserId = getSlackUserIdByNotionId(task.assigneeId);
      const assigneeMention = slackUserId ? `<@${slackUserId}>` : task.assignee;
      return `• <${task.notionLink}|${task.title}>（${formatRelativeDate(task.dueDate)} ${assigneeMention} ${task.status}）`;
    }).join('\n');
    
    const text = `*${group.issueTitle}${group.issueStatus ? ` (${group.issueStatus})` : ''}*\n${taskList}`;
    
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: text
      }
    });
  });
  
  return blocks;
}

/**
 * 今日期限タスクのブロックを作成
 */
function createTodayTaskBlocks(tasks) {
  if (tasks.today.length === 0) return [];
  
  const blocks = [{
    type: "section",
    text: {
      type: "mrkdwn",
      text: `📅 *今日期限のタスク*`
    }
  }];
  
  // 今日期限タスクを担当者→期限→タイトルでソート
  const sortedTodayTasks = tasks.today.sort((a, b) => {
    if (a.assignee !== b.assignee) {
      return a.assignee.localeCompare(b.assignee);
    }
    if (a.dueDate !== b.dueDate) {
      return a.dueDate.localeCompare(b.dueDate);
    }
    return a.title.localeCompare(b.title);
  });
  
  const todayGrouped = groupTasksByIssue(sortedTodayTasks);
  
  Object.values(todayGrouped).forEach(group => {
    const taskList = group.tasks.map(task => {
      const slackUserId = getSlackUserIdByNotionId(task.assigneeId);
      const assigneeMention = slackUserId ? `<@${slackUserId}>` : task.assignee;
      return `• <${task.notionLink}|${task.title}>（${assigneeMention} ${task.status}）`;
    }).join('\n');
    
    const text = `*${group.issueTitle}${group.issueStatus ? ` (${group.issueStatus})` : ''}*\n${taskList}`;
    
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: text
      }
    });
  });
  
  return blocks;
}

/**
 * Slackブロック形式のメッセージを作成（統合版）
 */
function createSlackBlocks(entityName, tasks, managerName, entityType = 'product') {
  const headerBlocks = createHeaderBlocks(entityName, tasks, managerName, entityType);
  const overdueBlocks = createOverdueTaskBlocks(tasks);
  const todayBlocks = createTodayTaskBlocks(tasks);
  const footerBlocks = createFooterBlocks();
  
  return [...headerBlocks, ...overdueBlocks, ...todayBlocks, ...footerBlocks];
}

// ============================================================================
// 本番稼働用関数
// ============================================================================

/**
 * 統合タスク通知処理
 */
function runTaskNotifier(entityType) {
  try {
    validateConfig();
    console.log(`${entityType === 'product' ? 'プロダクト' : 'プロジェクト'}タスク通知開始`);
    
    const entities = entityType === 'product' ? getProductDevelopmentProducts() : getTargetProjects();
    console.log(`対象${entityType === 'product' ? 'プロダクト' : 'プロジェクト'}数: ${entities.length}`);
    
    for (const entity of entities) {
      const managerLabel = entityType === 'product' ? 'SM' : 'PjM';
      console.log(`処理中: ${entity.name} (${managerLabel}: ${entityType === 'product' ? entity.scrumMaster : entity.pjm})`);
      
      try {
        const tasks = getExpiredAndTodayTasks(entity.id, entityType);
        
        if (tasks.overdue.length > 0 || tasks.today.length > 0) {
          console.log(`${entity.name}: 期限切れ${tasks.overdue.length}件, 今日期限${tasks.today.length}件`);
          sendSlackNotification(entity.name, tasks, entityType === 'product' ? entity.scrumMaster : entity.pjm, entityType);
        } else {
          console.log(`${entity.name}: 通知対象タスクなし`);
        }
        
        Utilities.sleep(CONSTANTS.TIME.SLEEP_MS);
        
      } catch (error) {
        console.error(`${entity.name} の処理でエラー:`, error);
      }
    }
    
    console.log(`${entityType === 'product' ? 'プロダクト' : 'プロジェクト'}タスク通知完了`);
    
  } catch (error) {
    console.error('メイン処理エラー:', error);
    throw error;
  }
}

/**
 * メイン処理関数（プロダクト用）
 */
function runProductTaskNotifier() {
  runTaskNotifier('product');
}

/**
 * プロジェクト向けメイン処理関数
 */
function runProjectTaskNotifier() {
  runTaskNotifier('project');
}




// ============================================================================
// テスト用関数
// ============================================================================

/**
 * 全プロジェクトのタスク取得・メンション動作テスト
 */
function testAllProjectsTaskNotification() {
  console.log('=== 全プロジェクト タスク取得・メンション動作テスト開始 ===');
  
  const projects = getTargetProjects();
  console.log(`対象プロジェクト数: ${projects.length}`);
  
  const results = [];
  
  for (let i = 0; i < projects.length; i++) {
    const project = projects[i];
    console.log(`\n--- ${i + 1}/${projects.length}: ${project.name} ---`);
    
    try {
      // タスク取得テスト
      const tasks = getExpiredAndTodayTasks(project.id, 'project');
      console.log(`期限切れタスク: ${tasks.overdue.length}件`);
      console.log(`今日期限タスク: ${tasks.today.length}件`);
      
      // メンション設定確認
      const mapping = PROJECT_MAPPING[project.name];
      const hasChannel = mapping && mapping.channelId;
      const hasMention = mapping && mapping.mentionUserId;
      
      console.log(`チャンネル設定: ${hasChannel ? '✓' : '✗'} (本番: ${mapping?.channelId || '未設定'})`);
      console.log(`メンション設定: ${hasMention ? '✓' : '✗'} (${mapping?.mentionUserId || '未設定'})`);
      
      // 通知対象かどうか
      const hasNotificationTarget = tasks.overdue.length > 0 || tasks.today.length > 0;
      console.log(`通知対象: ${hasNotificationTarget ? '✓' : '✗'}`);
      
      // 結果を記録
      results.push({
        projectName: project.name,
        pjm: project.pjm,
        overdueCount: tasks.overdue.length,
        todayCount: tasks.today.length,
        hasChannel: hasChannel,
        hasMention: hasMention,
        hasNotificationTarget: hasNotificationTarget,
        status: 'success'
      });
      
      // 通知対象がある場合はテスト用チャンネルに送信
      if (hasNotificationTarget) {
        console.log('テスト用チャンネル (C09ARFHBLBX) にSlack通知を送信します...');
        sendTestSlackNotification(project.name, tasks, project.pjm, 'project');
        console.log('送信完了');
      }
      
    } catch (error) {
      console.error(`エラー: ${error.message}`);
      results.push({
        projectName: project.name,
        pjm: project.pjm,
        error: error.message,
        status: 'error'
      });
    }
  }
  
  // 結果サマリー
  console.log('\n=== テスト結果サマリー ===');
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const notificationTargetCount = results.filter(r => r.hasNotificationTarget).length;
  const channelConfiguredCount = results.filter(r => r.hasChannel).length;
  const mentionConfiguredCount = results.filter(r => r.hasMention).length;
  
  console.log(`総プロジェクト数: ${projects.length}`);
  console.log(`成功: ${successCount}`);
  console.log(`エラー: ${errorCount}`);
  console.log(`通知対象あり: ${notificationTargetCount}`);
  console.log(`チャンネル設定済み: ${channelConfiguredCount}`);
  console.log(`メンション設定済み: ${mentionConfiguredCount}`);
  
  // 詳細結果
  console.log('\n=== 詳細結果 ===');
  results.forEach(result => {
    if (result.status === 'success') {
      console.log(`${result.projectName}: 期限切れ${result.overdueCount}件, 今日期限${result.todayCount}件, チャンネル${result.hasChannel ? '✓' : '✗'}, メンション${result.hasMention ? '✓' : '✗'}`);
    } else {
      console.log(`${result.projectName}: エラー - ${result.error}`);
    }
  });
  
  console.log('\n=== 全プロジェクト タスク取得・メンション動作テスト完了 ===');
  return results;
}

/**
 * 全13プロダクトのタスク取得・メンション動作テスト
 */
function testAllProductsTaskNotification() {
  console.log('=== 全13プロダクト タスク取得・メンション動作テスト開始 ===');
  
  const products = getProductDevelopmentProducts();
  console.log(`対象プロダクト数: ${products.length}`);
  
  const results = [];
  
  for (let i = 0; i < products.length; i++) {
    const product = products[i];
    console.log(`\n--- ${i + 1}/${products.length}: ${product.name} ---`);
    
    try {
      // タスク取得テスト
      const tasks = getExpiredAndTodayTasks(product.id);
      console.log(`期限切れタスク: ${tasks.overdue.length}件`);
      console.log(`今日期限タスク: ${tasks.today.length}件`);
      
      // メンション設定確認
      const mapping = PRODUCT_MAPPING[product.name];
      const hasChannel = mapping && mapping.channelId;
      const hasMention = mapping && mapping.mentionUserId;
      
      console.log(`チャンネル設定: ${hasChannel ? '✓' : '✗'} (本番: ${mapping?.channelId || '未設定'})`);
      console.log(`メンション設定: ${hasMention ? '✓' : '✗'} (${mapping?.mentionUserId || '未設定'})`);
      
      // 通知対象かどうか
      const hasNotificationTarget = tasks.overdue.length > 0 || tasks.today.length > 0;
      console.log(`通知対象: ${hasNotificationTarget ? '✓' : '✗'}`);
      
      // 結果を記録
      results.push({
        productName: product.name,
        scrumMaster: product.scrumMaster,
        overdueCount: tasks.overdue.length,
        todayCount: tasks.today.length,
        hasChannel: hasChannel,
        hasMention: hasMention,
        hasNotificationTarget: hasNotificationTarget,
        status: 'success'
      });
      
      // 通知対象がある場合はテスト用チャンネルに送信
      if (hasNotificationTarget) {
        console.log('テスト用チャンネル (C09ARFHBLBX) にSlack通知を送信します...');
        sendTestSlackNotification(product.name, tasks, product.scrumMaster, 'product');
        console.log('送信完了');
      }
      
    } catch (error) {
      console.error(`エラー: ${error.message}`);
      results.push({
        productName: product.name,
        scrumMaster: product.scrumMaster,
        error: error.message,
        status: 'error'
      });
    }
  }
  
  // 結果サマリー
  console.log('\n=== テスト結果サマリー ===');
  const successCount = results.filter(r => r.status === 'success').length;
  const errorCount = results.filter(r => r.status === 'error').length;
  const notificationTargetCount = results.filter(r => r.hasNotificationTarget).length;
  const channelConfiguredCount = results.filter(r => r.hasChannel).length;
  const mentionConfiguredCount = results.filter(r => r.hasMention).length;
  
  console.log(`総プロダクト数: ${products.length}`);
  console.log(`成功: ${successCount}`);
  console.log(`エラー: ${errorCount}`);
  console.log(`通知対象あり: ${notificationTargetCount}`);
  console.log(`チャンネル設定済み: ${channelConfiguredCount}`);
  console.log(`メンション設定済み: ${mentionConfiguredCount}`);
  
  // 詳細結果
  console.log('\n=== 詳細結果 ===');
  results.forEach(result => {
    if (result.status === 'success') {
      console.log(`${result.productName}: 期限切れ${result.overdueCount}件, 今日期限${result.todayCount}件, チャンネル${result.hasChannel ? '✓' : '✗'}, メンション${result.hasMention ? '✓' : '✗'}`);
    } else {
      console.log(`${result.productName}: エラー - ${result.error}`);
    }
  });
  
  console.log('\n=== 全13プロダクト タスク取得・メンション動作テスト完了 ===');
  return results;
}