/**
 * vibe coding 用 clasp 作業環境
 * 
 * このファイルは clasp push の動作確認用です。
 * 実際の開発コードは一時的にここで作成し、動作確認後に個人プロジェクトに移行してください。
 * 
 * 開発完了後は、このファイルを空の状態に戻してください。
 */

function testFunction() {
  console.log('clasp環境の動作確認用関数です');
  return 'OK';
}

/**
 * タスク通知ボット - プロダクト向け（GAS × Notion × Slack）
 * 要件定義に基づく実装（DB構造に合わせて修正）
 */

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
    BACKLOG: 'バックログ'
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
const PRODUCT_MAPPING = {
  'Sakuden': { channelId: 'C09ARFHBLBX', mentionUserId: 'U08TLQTUJ21' },
  'Eitoku(MOALA認証)': { channelId: 'C09ARFHBLBX', mentionUserId: 'U048M5NP6M6' },
  'Tanyu(MOALA認証+ )': { channelId: 'C09ARFHBLBX', mentionUserId: 'U048M5NP6M6' },
  'Zeami (BioQR)': { channelId: 'C09ARFHBLBX', mentionUserId: 'U05HPC0BL3V' },
  'Hokushin(MLS)': { channelId: 'C09ARFHBLBX', mentionUserId: 'U04HB81EUTS' },
  'Karaku': { channelId: 'C09ARFHBLBX', mentionUserId: 'U04HB81EUTS' },
  'Karaku Web': { channelId: 'C09ARFHBLBX', mentionUserId: 'U048M5NP6M6' },
  'Karaku Admin': { channelId: 'C09ARFHBLBX', mentionUserId: 'U08TLQTUJ21' },
  'Juko (MA)': { channelId: 'C09ARFHBLBX', mentionUserId: 'U05HPC0BL3V' },
  'Duchamp(MP)': { channelId: 'C09ARFHBLBX', mentionUserId: 'U048M5NP6M6' },
  'Pollock(MP2)': { channelId: 'C09ARFHBLBX', mentionUserId: 'U048M5NP6M6' },
  'Rick (MS)': { channelId: 'C09ARFHBLBX', mentionUserId: 'U05HPC0BL3V' },
  '抽選プロダクト': { channelId: 'C09ARFHBLBX', mentionUserId: 'U05HPC0BL3V' }
};

const PROJECT_MAPPING = {
  'Mukuge Phase 1': { channelId: 'C09ARFHBLBX', mentionUserId: 'U9ZFLRRG9' },
  'HIROMITSU KITAYAMA LIVE TOUR 2025「波紋-HAMON-」': { channelId: 'C09ARFHBLBX', mentionUserId: 'U9ZFLRRG9' },
  'BE:FIRST 2nd Fan Meeting -Hello My "BESTY" vol.2-': { channelId: 'C09ARFHBLBX', mentionUserId: 'U9ZFLRRG9' },
  'Animate Girls Festival 2025 karaku/MA連携': { channelId: 'C09ARFHBLBX', mentionUserId: 'U04HB81EUTS' },
  'MLS保守': { channelId: 'C09ARFHBLBX', mentionUserId: 'U04HB81EUTS' },
  'UpfrontID連携': { channelId: 'C09ARFHBLBX', mentionUserId: 'U04HB81EUTS' },
  '東京ドーム': { channelId: 'C09ARFHBLBX', mentionUserId: 'U04HB81EUTS' }
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
 * 担当者名からSlackユーザーIDを取得する関数（後方互換性のため保持）
 */
function getSlackUserIdByName(name) {
  // slack&notion_user_room_filtered.mdのマッピング
  // メンションがうまくされない時は大体Notionの名前とこのリストの名前が間違っている（姓名間のスペースがないなど）
  const nameToSlackId = {
    '杉村 紀次': 'U51PGHBHA',
    '伊藤 KG 圭史': 'U52KGG5QX',
    '大野 孝弘': 'U76GVDSNL',
    '下郷 勝啓': 'U7BR1ST9B',
    '鈴木 遼': 'U9ZFLRRG9',
    '佐藤 秀高': 'UF0LZP6GG',
    '門井 香織': 'UL7R2KP44',
    '荒関 雄次': 'UN6AZJ1H8',
    '藤田 航大': 'U013PEHEAES',
    '元島 海': 'UDL1199PU',
    '別所 大輝': 'UCAP9CG01',
    '佐藤 秀紀': 'U02CX525CRY',
    '笹木 清楓': 'U02HMMCLEGP',
    '塚原 慎也': 'U02MB2K6796',
    '溝上 阿宜也': 'U03LJH7485A',
    '巽 利紗': 'U040U1SVDPG',
    '大森 桂太': 'U03NYU810TU',
    '池田 将久': 'U047ZTZT1KN',
    '渡部 愛菜': 'U048M5NP6M6',
    '橋本 瑶介': 'U04C8KW2TBP',
    '榊 航也': 'U04G17HM529',
    '赤塚 順一': 'U044WQD9LKS',
    '井口 新一郎  ': 'U04HB81EUTS',
    '舟口 翔梧': 'U03QYQF7RDY',
    '貴高章太朗': 'U05852LRK2A',
    '小俣 圭佑': 'U05HPEK4H4J',
    '有馬 圭人　': 'U05JD77UTEU',
    '大隈 峻太郎': 'U05QJBJ5083',
    '久保 亮介': 'U062WDAD7JB',
    '鈴木 花音': 'U06C8D96KC0',
    '川﨑亮佑': 'U07FFNU42G6',
    '徳永啓佑': 'U07P46R9WLB',
    '詫摩七海': 'U07U2CKSMLN',
    '居原田崇史': 'U08TLQTUJ21',
    '下村光彦': 'U093SKGPP7A',
    '下江衛': 'U093Y7PPCUT',
    '本城 明子': 'U014CACGXJ9',
    '新西 健太': 'U035T6ZDA8Z',
    'Yusuke Sugimoto': 'U03U75CR6KE',
    '尾関高文': 'U02LSRHQ9S6',
    '小野澤 洪作': 'U032C0QMJ14',
    '綾部 文香': 'U03DL6R7LG5',
    'Toshi Matsumoto': 'U04HAQ37000',
    '日髙光貴': 'U0501CTTH17',
    '花輪 真輝': 'U05HPC0BL3V',
    'KobayashiErika': 'U05H8T8G44F',
    '浜田 宏次郎': 'UP772HAP9',
    '桑野 竜乃介': 'U05APU9D1EC',
    '小倉 みゆき': 'U058BHU9ZB5',
    '金森 秀平': 'U053NGYJLMD',
    'Tetsuo Sugita': 'U05GZD2G2LQ',
    '宮入 則之': 'U03STC55PK6',
    'OshimotoYusuke': 'U046SM2G326',
    'KojimaToshihiro': 'U047GCBJS1E',
    '飯泉惇': 'U07GP8ME8TS',
    '林桐太': 'U07UXPUHUQG'
  };
  
  return nameToSlackId[name] || null;
}

/**
 * JST時間正規化のユーティリティ関数
 */
function getJSTDateString(date = new Date()) {
  // JST時間で日付を取得（Asia/Tokyoタイムゾーンを使用）
  const jstDate = new Date(date.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
  return jstDate.toISOString().split('T')[0];
}

function getJSTYesterday() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return getJSTDateString(yesterday);
}

function getJSTToday() {
  return getJSTDateString();
}

/**
 * 日付を相対表記に変換
 */
function formatRelativeDate(dateString) {
  // JST時間で今日の日付を取得
  const today = new Date();
  const jstToday = new Date(today.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
  const jstTodayString = jstToday.toISOString().split('T')[0];
  
  const targetDate = new Date(dateString);
  const jstTargetDate = new Date(targetDate.toLocaleString("en-US", {timeZone: "Asia/Tokyo"}));
  const jstTargetDateString = jstTargetDate.toISOString().split('T')[0];
  
  // 日付文字列で比較
  const diffTime = new Date(jstTargetDateString).getTime() - new Date(jstTodayString).getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  const weekdays = ['日', '月', '火', '水', '木', '金', '土'];
  const weekday = weekdays[jstTargetDate.getDay()];
  const month = jstTargetDate.getMonth() + 1;
  const day = jstTargetDate.getDate();
  
  if (diffDays === 0) {
    return `今日(${month}/${day}${weekday})`;
  } else if (diffDays === 1) {
    return `明日(${month}/${day}${weekday})`;
  } else if (diffDays === -1) {
    return `昨日(${month}/${day}${weekday})`;
  } else if (diffDays > 0) {
    return `${month}/${day}(${weekday})`;
  } else {
    const overdueDays = Math.abs(diffDays);
    return `${month}/${day}(${weekday}) ／ +${overdueDays}日超過`;
  }
}

/**
 * Project DBから対象プロジェクトを取得
 */
function getTargetProjects() {
  try {
    console.log('対象プロジェクト取得開始');
    
    const response = UrlFetchApp.fetch(`https://api.notion.com/v1/databases/${CONFIG.NOTION_PROJECT_DB_ID}/query`, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.NOTION_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': CONSTANTS.NOTION.API_VERSION
      },
      payload: JSON.stringify({
        page_size: CONSTANTS.NOTION.PAGE_SIZE
      })
    });
    
    if (!response.getResponseCode().toString().startsWith('2')) {
      throw new Error(`Project DB取得エラー: ${response.getResponseCode()} ${response.getContentText()}`);
    }
    
    const data = JSON.parse(response.getContentText());
    const allProjects = data.results.map(page => ({
      id: page.id,
      name: page.properties['名前']?.title?.[0]?.text?.content || '名前なし',
      pjm: page.properties['PjM']?.people?.[0]?.name || 'PjM未設定'
    }));
    
    console.log(`取得した全プロジェクト数: ${allProjects.length}`);
    
    // product_project_mapping.mdに記載されているプロジェクトのみを対象
    const targetProjectNames = [
      'Mukuge Phase 1',
      'HIROMITSU KITAYAMA LIVE TOUR 2025「波紋-HAMON-」',
      'BE:FIRST 2nd Fan Meeting -Hello My "BESTY" vol.2-',
      'Animate Girls Festival 2025 karaku/MA連携',
      'MLS保守',
      'UpfrontID連携',
      '東京ドーム'
    ];
    
    const targetProjects = allProjects.filter(project => 
      targetProjectNames.includes(project.name)
    );
    
    console.log(`フィルタリング後のプロジェクト数: ${targetProjects.length}`);
    console.log('取得したプロジェクト:', targetProjects);
    
    return targetProjects;
    
  } catch (error) {
    console.error('Project DB取得エラー:', error);
    throw error;
  }
}

/**
 * Product DBからプロダクト開発関連のプロダクトを取得
 */
function getProductDevelopmentProducts() {
  const url = `https://api.notion.com/v1/databases/${CONFIG.NOTION_PRODUCT_DB_ID}/query`;
  
  const payload = {
    page_size: CONSTANTS.NOTION.PAGE_SIZE
  };
  
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.NOTION_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': CONSTANTS.NOTION.API_VERSION
    },
    payload: JSON.stringify(payload)
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    console.log(`取得した全プロダクト数: ${data.results.length}`);
    
    // product_scrum_master_mapping.mdに記載されている13プロダクトのみを対象
    const targetProductNames = [
      'Sakuden',
      'Eitoku(MOALA認証)',
      'Tanyu(MOALA認証+ )',
      'Zeami (BioQR)',
      'Hokushin(MLS)',
      'Karaku',
      'Karaku Web',
      'Karaku Admin',
      'Juko (MA)',
      'Duchamp(MP)',
      'Pollock(MP2)',
      'Rick (MS)',
      '抽選プロダクト'
    ];
    
    const productDevelopmentProducts = data.results
      .map(page => ({
        id: page.id,
        name: page.properties.名前?.title?.[0]?.text?.content || '名前なし',
        scrumMaster: page.properties.スクラムマスター?.people?.[0]?.name || 'スクラムマスター未設定',
        tags: page.properties.タグ?.multi_select?.map(tag => tag.name) || []
      }))
      .filter(product => targetProductNames.includes(product.name));
    
    console.log(`フィルタリング後のプロダクト数: ${productDevelopmentProducts.length}`);
    
    return productDevelopmentProducts;
  } catch (error) {
    console.error('Product DB取得エラー:', error);
    throw error;
  }
}

/**
 * Task DBから期限切れ・今日期限の未完了タスクを取得（統合版）
 */
function getExpiredAndTodayTasks(entityId, entityType = 'product') {
  const url = `https://api.notion.com/v1/databases/${CONFIG.NOTION_TASK_DB_ID}/query`;
  
  const yesterday = getJSTYesterday();
  const today = getJSTToday();
  
  // プロパティ名を動的に決定
  const relationProperty = entityType === 'product' ? 'Product' : 'Project';
  
  // 期限切れタスクのフィルタ（今日より前の期限）
  const overdueFilter = {
    filter: {
      and: [
        {
          property: relationProperty,
          rollup: {
            any: {
              relation: { contains: entityId }
            }
          }
        },
        { property: "Taskステータス", status: { does_not_equal: CONSTANTS.STATUS.COMPLETED } },
        { property: "Taskステータス", status: { does_not_equal: CONSTANTS.STATUS.CANCELLED } },
        { property: "Taskステータス", status: { does_not_equal: CONSTANTS.STATUS.BACKLOG } },
        { property: "Task期限", date: { before: today } }
      ]
    },
    page_size: CONSTANTS.NOTION.PAGE_SIZE
  };
  
  // 今日期限タスクのフィルタ（今日が期限）
  const todayFilter = {
    filter: {
      and: [
        {
          property: relationProperty,
          rollup: {
            any: {
              relation: { contains: entityId }
            }
          }
        },
        { property: "Taskステータス", status: { does_not_equal: CONSTANTS.STATUS.COMPLETED } },
        { property: "Taskステータス", status: { does_not_equal: CONSTANTS.STATUS.CANCELLED } },
        { property: "Taskステータス", status: { does_not_equal: CONSTANTS.STATUS.BACKLOG } },
        { property: "Task期限", date: { equals: today } }
      ]
    },
    page_size: CONSTANTS.NOTION.PAGE_SIZE
  };
  
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.NOTION_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': CONSTANTS.NOTION.API_VERSION
    }
  };
  
  try {
    // 期限切れタスクを取得
    options.payload = JSON.stringify(overdueFilter);
    const overdueResponse = UrlFetchApp.fetch(url, options);
    const overdueData = JSON.parse(overdueResponse.getContentText());
    
    // 今日期限タスクを取得
    options.payload = JSON.stringify(todayFilter);
    const todayResponse = UrlFetchApp.fetch(url, options);
    const todayData = JSON.parse(todayResponse.getContentText());
    
    const overdueTasks = overdueData.results.map(parseTask);
    const todayTasks = todayData.results.map(parseTask);
    
    // プロダクトの場合はIssue大分類フィルタリングを適用
    if (entityType === 'product') {
      const filteredOverdueTasks = overdueTasks.filter(task => task.issueCategory === CONSTANTS.NOTION.PRODUCT_CATEGORY);
      const filteredTodayTasks = todayTasks.filter(task => task.issueCategory === CONSTANTS.NOTION.PRODUCT_CATEGORY);
      
      return {
        overdue: filteredOverdueTasks,
        today: filteredTodayTasks
      };
    }
    
    // プロジェクトの場合はフィルタリングなし
    return {
      overdue: overdueTasks,
      today: todayTasks
    };
  } catch (error) {
    console.error('Task DB取得エラー:', error);
    throw error;
  }
}

/**
 * Issueページのタイトルを取得
 */
function getIssueTitle(issueId) {
  if (!issueId) return 'Issue情報なし';
  
  try {
    const response = UrlFetchApp.fetch(`https://api.notion.com/v1/pages/${issueId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CONFIG.NOTION_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': CONSTANTS.NOTION.API_VERSION
      }
    });
    
    if (response.getResponseCode().toString().startsWith('2')) {
      const data = JSON.parse(response.getContentText());
      const title = data.properties?.名前?.title?.[0]?.text?.content || 
                   data.properties?.タイトル?.title?.[0]?.text?.content ||
                   `Issue-${issueId.slice(-8)}`;
      return title;
    }
  } catch (error) {
    console.error(`Issue ${issueId} の取得エラー:`, error);
  }
  
  return `Issue-${issueId.slice(-8)}`;
}

/**
 * Notionページをタスクオブジェクトに変換
 */
function parseTask(page) {
  // タスク名を取得（日付メンションに対応）
  let title = 'タイトルなし';
  const nameProperty = page.properties.名前;
  
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
  
  const status = page.properties['Taskステータス']?.status?.name || 'ステータスなし';
  const dueDate = page.properties['Task期限']?.date?.start || '期限なし';
  const assignee = page.properties['担当者']?.people?.[0]?.name || '担当者なし';
  const assigneeId = page.properties['担当者']?.people?.[0]?.id || null;
  
  // Issue情報を取得（relationプロパティから）
  const issueRelation = page.properties['Issue']?.relation || [];
  const issueId = issueRelation.length > 0 ? issueRelation[0].id : null;
  const issueTitle = getIssueTitle(issueId);
  
  // Issue大分類を取得（rollupプロパティから）
  const issueCategory = page.properties['Issue大分類']?.rollup?.array?.[0]?.select?.name || '分類なし';
  
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
    issueTitle: issueTitle,
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
    
    if (!grouped[issueKey]) {
      grouped[issueKey] = {
        issueTitle: issueTitle,
        tasks: []
      };
    }
    
    grouped[issueKey].tasks.push(task);
  });
  
  return grouped;
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
  
  const url = CONSTANTS.SLACK.API_URL;
  const payload = {
    channel: mapping.channelId,
    blocks: blocks,
    text: `${entityName} のタスク通知`
  };
  
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
    const data = JSON.parse(response.getContentText());
    
    if (data.ok) {
      console.log(`${entityName} への通知送信成功`);
    } else {
      console.error(`${entityName} への通知送信失敗:`, data.error);
      
      if (data.error === 'not_in_channel') {
        joinChannelAndRetry(mapping.channelId, payload);
      }
    }
  } catch (error) {
    console.error(`${entityName} への通知送信エラー:`, error);
  }
}

/**
 * チャンネルに参加して再試行
 */
function joinChannelAndRetry(channelId, originalPayload) {
  const joinUrl = CONSTANTS.SLACK.JOIN_URL;
  const joinPayload = { channel: channelId };
  
  const joinOptions = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(joinPayload)
  };
  
  try {
    const joinResponse = UrlFetchApp.fetch(joinUrl, joinOptions);
    const joinData = JSON.parse(joinResponse.getContentText());
    
    if (joinData.ok) {
      const retryOptions = {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(originalPayload)
      };
      
      const retryResponse = UrlFetchApp.fetch('https://slack.com/api/chat.postMessage', retryOptions);
      const retryData = JSON.parse(retryResponse.getContentText());
      
      if (retryData.ok) {
        console.log('チャンネル参加後の再試行成功');
      } else {
        console.error('チャンネル参加後の再試行失敗:', retryData.error);
      }
    } else {
      console.error('チャンネル参加失敗:', joinData.error);
    }
  } catch (error) {
    console.error('チャンネル参加処理エラー:', error);
  }
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
        text: `🚨 ${entityName} タスク通知`
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
  
  // 期限切れタスクを超過日数でソート
  const sortedOverdueTasks = tasks.overdue.sort((a, b) => {
    const dateA = new Date(a.dueDate);
    const dateB = new Date(b.dueDate);
    return dateA.getTime() - dateB.getTime(); // 古い順（超過日数が多い順）
  });
  
  const overdueGrouped = groupTasksByIssue(sortedOverdueTasks);
  
  Object.values(overdueGrouped).forEach(group => {
    const taskList = group.tasks.map(task => {
      const slackUserId = getSlackUserIdByNotionId(task.assigneeId) || getSlackUserIdByName(task.assignee);
      const assigneeMention = slackUserId ? `<@${slackUserId}>` : task.assignee;
      return `• <${task.notionLink}|${task.title}>（${formatRelativeDate(task.dueDate)} ${assigneeMention} ${task.status}）`;
    }).join('\n');
    
    const text = `*${group.issueTitle}*\n${taskList}`;
    
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
      const slackUserId = getSlackUserIdByNotionId(task.assigneeId) || getSlackUserIdByName(task.assignee);
      const assigneeMention = slackUserId ? `<@${slackUserId}>` : task.assignee;
      return `• <${task.notionLink}|${task.title}>（${formatRelativeDate(task.dueDate)} ${assigneeMention} ${task.status}）`;
    }).join('\n');
    
    const text = `*${group.issueTitle}*\n${taskList}`;
    
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
 * フッターブロックを作成
 */
function createFooterBlocks() {
  const now = new Date();
  const timestamp = now.toLocaleString('ja-JP', { timeZone: 'Asia/Tokyo' });
  
  return [{
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `取得日時: ${timestamp}（JST）`
      }
    ]
  }];
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
 * メイン処理関数（プロダクト用）
 */
function runProductTaskNotifier() {
  try {
    validateConfig();
    console.log('プロダクトタスク通知開始');
    
    const products = getProductDevelopmentProducts();
    console.log(`対象プロダクト数: ${products.length}`);
    
    for (const product of products) {
      console.log(`処理中: ${product.name} (SM: ${product.scrumMaster})`);
      
      try {
        const tasks = getExpiredAndTodayTasks(product.id, 'product');
        
        if (tasks.overdue.length > 0 || tasks.today.length > 0) {
          console.log(`${product.name}: 期限切れ${tasks.overdue.length}件, 今日期限${tasks.today.length}件`);
          sendSlackNotification(product.name, tasks, product.scrumMaster, 'product');
        } else {
          console.log(`${product.name}: 通知対象タスクなし`);
        }
        
        Utilities.sleep(CONSTANTS.TIME.SLEEP_MS);
        
      } catch (error) {
        console.error(`${product.name} の処理でエラー:`, error);
      }
    }
    
    console.log('プロダクトタスク通知完了');
    
  } catch (error) {
    console.error('メイン処理エラー:', error);
    throw error;
  }
}

/**
 * プロジェクト向けメイン処理関数
 */
function runProjectTaskNotifier() {
  try {
    validateConfig();
    console.log('プロジェクトタスク通知開始');
    
    const projects = getTargetProjects();
    console.log(`対象プロジェクト数: ${projects.length}`);
    
    for (const project of projects) {
      console.log(`\n--- ${project.name} ---`);
      console.log(`PjM: ${project.pjm}`);
      
      const tasks = getExpiredAndTodayTasks(project.id, 'project');
      console.log(`期限切れタスク: ${tasks.overdue.length}件`);
      console.log(`今日期限タスク: ${tasks.today.length}件`);
      
      if (tasks.overdue.length > 0 || tasks.today.length > 0) {
        console.log('Slack通知を送信します...');
        sendSlackNotification(project.name, tasks, project.pjm, 'project');
      } else {
        console.log('通知対象タスクがありません');
      }
    }
    
    console.log('プロジェクトタスク通知完了');
  } catch (error) {
    console.error('プロジェクトタスク通知エラー:', error);
  }
}

/*
// Notionワークスペースの全ユーザーIDを取得（不要になったためコメントアウト）
function getNotionUserIds() {
  console.log('=== Notion全ユーザーID取得開始 ===');
  
  try {
    validateConfig();
    
    const url = 'https://api.notion.com/v1/users';
    
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CONFIG.NOTION_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': CONSTANTS.NOTION.API_VERSION
      }
    };
    
    const response = UrlFetchApp.fetch(url, options);
    
    if (!response.getResponseCode().toString().startsWith('2')) {
      throw new Error(`Notion Users API エラー: ${response.getResponseCode()} ${response.getContentText()}`);
    }
    
    const data = JSON.parse(response.getContentText());
    
    console.log(`取得したユーザー数: ${data.results.length}`);
    
    // ユーザーID情報を整理
    const users = data.results.map(user => ({
      notionUserId: user.id,
      name: user.name || '名前なし',
      email: user.person?.email || user.bot?.owner?.user?.person?.email || 'メールなし',
      type: user.type, // 'person' または 'bot'
      avatar_url: user.avatar_url || null
    }));
    
    console.log(`\n=== Notion全ユーザーID一覧 (${users.length}名) ===`);
    users.forEach(user => {
      console.log(`ID: ${user.notionUserId}`);
      console.log(`名前: ${user.name} (${user.type})`);
      if (user.email !== 'メールなし') {
        console.log(`メール: ${user.email}`);
      }
      console.log('---');
    });
    
    console.log('\n=== Notion全ユーザーID取得完了 ===');
    return users;
    
  } catch (error) {
    console.error('NotionユーザーID取得エラー:', error);
    throw error;
  }
}
*/

/**
 * 特定のタスクを取得して名前の構造をデバッグする関数
 */
function debugSpecificTask(taskId) {
  console.log('=== 特定タスクデバッグ開始 ===');
  console.log('タスクID:', taskId);
  
  try {
    validateConfig();
    
    const response = UrlFetchApp.fetch(`https://api.notion.com/v1/pages/${taskId}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CONFIG.NOTION_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': CONSTANTS.NOTION.API_VERSION
      }
    });
    
    if (!response.getResponseCode().toString().startsWith('2')) {
      throw new Error(`Notion API エラー: ${response.getResponseCode()} ${response.getContentText()}`);
    }
    
    const data = JSON.parse(response.getContentText());
    
    console.log('=== タスク全体の構造 ===');
    console.log('ページID:', data.id);
    console.log('作成日時:', data.created_time);
    console.log('更新日時:', data.last_edited_time);
    
    console.log('\n=== 名前プロパティの詳細 ===');
    const nameProperty = data.properties.名前;
    console.log('名前プロパティ:', JSON.stringify(nameProperty, null, 2));
    
    if (nameProperty?.title && Array.isArray(nameProperty.title)) {
      console.log('\n=== タイトル配列の各要素 ===');
      console.log('配列の要素数:', nameProperty.title.length);
      
      nameProperty.title.forEach((item, index) => {
        console.log(`\n--- 要素${index} ---`);
        console.log('タイプ:', item.type);
        console.log('内容:', JSON.stringify(item, null, 2));
        
        if (item.text) {
          console.log('テキスト内容:', item.text.content);
        } else if (item.mention) {
          console.log('メンションタイプ:', item.mention.type);
          if (item.mention.date) {
            console.log('日付メンション:', item.mention.date);
          } else if (item.mention.user) {
            console.log('ユーザーメンション:', item.mention.user);
          }
        }
      });
      
      // 全要素を結合してタスク名を再構築
      console.log('\n=== タスク名の再構築 ===');
      const reconstructedTitle = nameProperty.title.map(item => {
        if (item.text) {
          return item.text.content || '';
        } else if (item.mention) {
          if (item.mention.date) {
            // 日付メンションの場合
            const dateStr = item.mention.date.start;
            return `@${dateStr}`;
          } else if (item.mention.user) {
            // ユーザーメンションの場合
            return `@${item.mention.user.name || 'ユーザー'}`;
          }
          return '';
        }
        return '';
      }).join('');
      
      console.log('再構築されたタスク名:', reconstructedTitle);
    }
    
    console.log('\n=== 他のプロパティ ===');
    Object.keys(data.properties).forEach(key => {
      if (key !== '名前') {
        console.log(`${key}:`, JSON.stringify(data.properties[key], null, 2));
      }
    });
    
    console.log('\n=== 特定タスクデバッグ完了 ===');
    return data;
    
  } catch (error) {
    console.error('特定タスクデバッグエラー:', error);
    throw error;
  }
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
      
      console.log(`チャンネル設定: ${hasChannel ? '✓' : '✗'} (${mapping?.channelId || '未設定'})`);
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
      
      // 通知対象がある場合は実際に送信
      if (hasNotificationTarget && hasChannel && hasMention) {
        console.log('Slack通知を送信します...');
        sendSlackNotification(project.name, tasks, project.pjm, 'project');
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
      
      console.log(`チャンネル設定: ${hasChannel ? '✓' : '✗'} (${mapping?.channelId || '未設定'})`);
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
      
      // 通知対象がある場合は実際に送信
      if (hasNotificationTarget && hasChannel && hasMention) {
        console.log('Slack通知を送信します...');
        sendSlackNotification(product.name, tasks, product.scrumMaster);
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

// ============================================================================
// コメントアウトされた関数（処理速度に影響しないため保持）
// ============================================================================

/*
// 共通エラーハンドリング関数
function handleApiError(operation, error) {
  console.error(`${operation}エラー:`, error);
  throw error;
}

// Notion API呼び出しの共通処理
function callNotionApi(url, options) {
  try {
    const response = UrlFetchApp.fetch(url, options);
    
    if (!response.getResponseCode().toString().startsWith('2')) {
      throw new Error(`Notion API エラー: ${response.getResponseCode()} ${response.getContentText()}`);
    }
    
    return JSON.parse(response.getContentText());
  } catch (error) {
    handleApiError('Notion API呼び出し', error);
  }
}

// Slack API呼び出しの共通処理
function callSlackApi(url, options) {
  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    if (!data.ok) {
      throw new Error(`Slack API エラー: ${data.error}`);
    }
    
    return data;
  } catch (error) {
    handleApiError('Slack API呼び出し', error);
  }
}

// Notionワークスペースの全ユーザーを取得
function getAllNotionUsers() {
  console.log('=== Notion全ユーザー取得開始 ===');
  
  try {
    validateConfig();
    
    const url = 'https://api.notion.com/v1/users';
    
    const options = {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${CONFIG.NOTION_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': CONSTANTS.NOTION.API_VERSION
      }
    };
    
    const response = UrlFetchApp.fetch(url, options);
    
    if (!response.getResponseCode().toString().startsWith('2')) {
      throw new Error(`Notion Users API エラー: ${response.getResponseCode()} ${response.getContentText()}`);
    }
    
    const data = JSON.parse(response.getContentText());
    
    console.log(`取得したユーザー数: ${data.results.length}`);
    
    // ユーザー情報を整理
    const users = data.results.map(user => ({
      id: user.id,
      name: user.name || '名前なし',
      email: user.person?.email || user.bot?.owner?.user?.person?.email || 'メールなし',
      type: user.type, // 'person' または 'bot'
      avatar_url: user.avatar_url || null,
      slackUserId: getSlackUserIdByName(user.name || ''),
      canMention: getSlackUserIdByName(user.name || '') !== null
    }));
    
    console.log(`\n=== Notion全ユーザー一覧 (${users.length}名) ===`);
    users.forEach(user => {
      const mentionStatus = user.canMention ? '✅' : '❌';
      const slackInfo = user.canMention ? `→ <@${user.slackUserId}>` : '(メンション不可)';
      console.log(`${mentionStatus} ${user.name} (${user.type}) ${slackInfo}`);
      if (user.email !== 'メールなし') {
        console.log(`    📧 ${user.email}`);
      }
    });
    
    // 統計情報
    const personUsers = users.filter(u => u.type === 'person');
    const botUsers = users.filter(u => u.type === 'bot');
    const mentionableUsers = users.filter(u => u.canMention);
    const unmentionableUsers = users.filter(u => !u.canMention);
    
    console.log(`\n=== 統計 ===`);
    console.log(`総ユーザー数: ${users.length}`);
    console.log(`人物ユーザー: ${personUsers.length}`);
    console.log(`Botユーザー: ${botUsers.length}`);
    console.log(`メンション可能: ${mentionableUsers.length}`);
    console.log(`メンション不可: ${unmentionableUsers.length}`);
    
    // メンション不可のユーザー詳細
    if (unmentionableUsers.length > 0) {
      console.log(`\n=== メンション不可のユーザー ===`);
      unmentionableUsers.forEach(user => {
        console.log(`❌ ${user.name} (${user.type})`);
        if (user.email !== 'メールなし') {
          console.log(`   📧 ${user.email}`);
        }
      });
      
      console.log(`\n=== メンション不可のユーザー名（マッピング追加用） ===`);
      unmentionableUsers.forEach(user => {
        console.log(`'${user.name}': 'SLACK_USER_ID',`);
      });
    }
    
    console.log('\n=== Notion全ユーザー取得完了 ===');
    return {
      totalUsers: users.length,
      personUsers: personUsers.length,
      botUsers: botUsers.length,
      mentionableUsers: mentionableUsers.length,
      unmentionableUsers: unmentionableUsers.length,
      users: users
    };
    
  } catch (error) {
    console.error('Notionユーザー取得エラー:', error);
    throw error;
  }
}

// 担当者名の表記揺れを検出する関数
function detectNameVariations() {
  console.log('=== 担当者名の表記揺れ検出開始 ===');
  
  try {
    validateConfig();
    
    const url = `https://api.notion.com/v1/databases/${CONFIG.NOTION_TASK_DB_ID}/query`;
    
    const payload = {
      page_size: CONSTANTS.NOTION.PAGE_SIZE
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.NOTION_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': CONSTANTS.NOTION.API_VERSION
      },
      payload: JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    // 担当者名を収集
    const assigneeNames = new Set();
    data.results.forEach(page => {
      const assignee = page.properties['担当者']?.people?.[0]?.name;
      if (assignee) {
        assigneeNames.add(assignee);
      }
    });
    
    console.log(`\n=== 全担当者名 (${assigneeNames.size}名) ===`);
    Array.from(assigneeNames).sort().forEach(name => {
      console.log(`"${name}"`);
    });
    
    // 類似名の検出（簡易版）
    const nameList = Array.from(assigneeNames);
    const variations = [];
    
    for (let i = 0; i < nameList.length; i++) {
      for (let j = i + 1; j < nameList.length; j++) {
        const name1 = nameList[i];
        const name2 = nameList[j];
        
        // 同じ姓または名を含む場合
        const name1Parts = name1.split(/[\s　]+/);
        const name2Parts = name2.split(/[\s　]+/);
        
        const hasCommonPart = name1Parts.some(part1 => 
          name2Parts.some(part2 => 
            part1 === part2 || 
            part1.includes(part2) || 
            part2.includes(part1)
          )
        );
        
        if (hasCommonPart) {
          variations.push({
            name1: name1,
            name2: name2,
            reason: '共通部分あり'
          });
        }
      }
    }
    
    if (variations.length > 0) {
      console.log(`\n=== 表記揺れの可能性 (${variations.length}組) ===`);
      variations.forEach(variation => {
        console.log(`"${variation.name1}" ↔ "${variation.name2}" (${variation.reason})`);
      });
    } else {
      console.log('\n=== 表記揺れは検出されませんでした ===');
    }
    
    console.log('\n=== 担当者名の表記揺れ検出完了 ===');
    return {
      totalNames: assigneeNames.size,
      variations: variations
    };
    
  } catch (error) {
    console.error('表記揺れ検出エラー:', error);
    throw error;
  }
}

// Notionの担当者名を全件取得してメンション可能かチェック
function checkAllAssigneeNames() {
  console.log('=== Notion担当者名の全件チェック開始 ===');
  
  try {
    validateConfig();
    
    const url = `https://api.notion.com/v1/databases/${CONFIG.NOTION_TASK_DB_ID}/query`;
    
    const payload = {
      page_size: CONSTANTS.NOTION.PAGE_SIZE
    };
    
    const options = {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${CONFIG.NOTION_API_TOKEN}`,
        'Content-Type': 'application/json',
        'Notion-Version': CONSTANTS.NOTION.API_VERSION
      },
      payload: JSON.stringify(payload)
    };
    
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    console.log(`取得したタスク数: ${data.results.length}`);
    
    // 担当者名を収集
    const assigneeNames = new Set();
    const assigneeDetails = [];
    
    data.results.forEach(page => {
      const assignee = page.properties['担当者']?.people?.[0]?.name;
      if (assignee) {
        assigneeNames.add(assignee);
        assigneeDetails.push({
          taskId: page.id,
          taskTitle: page.properties.名前?.title?.[0]?.text?.content || 'タイトルなし',
          assignee: assignee,
          slackUserId: getSlackUserIdByName(assignee),
          canMention: getSlackUserIdByName(assignee) !== null
        });
      }
    });
    
    console.log(`\n=== 担当者名一覧 (${assigneeNames.size}名) ===`);
    Array.from(assigneeNames).sort().forEach(name => {
      const slackUserId = getSlackUserIdByName(name);
      const canMention = slackUserId !== null;
      console.log(`${canMention ? '✅' : '❌'} ${name} ${canMention ? `→ <@${slackUserId}>` : '(メンション不可)'}`);
    });
    
    // メンション可能/不可能の統計
    const mentionableCount = assigneeDetails.filter(d => d.canMention).length;
    const unmentionableCount = assigneeDetails.filter(d => !d.canMention).length;
    
    console.log(`\n=== 統計 ===`);
    console.log(`メンション可能: ${mentionableCount}件`);
    console.log(`メンション不可: ${unmentionableCount}件`);
    
    // メンション不可の詳細
    if (unmentionableCount > 0) {
      console.log(`\n=== メンション不可の担当者詳細 ===`);
      const unmentionableDetails = assigneeDetails.filter(d => !d.canMention);
      const unmentionableNames = [...new Set(unmentionableDetails.map(d => d.assignee))];
      
      unmentionableNames.forEach(name => {
        console.log(`\n❌ ${name}:`);
        const tasks = unmentionableDetails.filter(d => d.assignee === name);
        tasks.forEach(task => {
          console.log(`  - ${task.taskTitle}`);
        });
      });
      
      console.log(`\n=== メンション不可の担当者名（マッピング追加用） ===`);
      unmentionableNames.forEach(name => {
        console.log(`'${name}': 'SLACK_USER_ID',`);
      });
    }
    
    console.log('\n=== Notion担当者名の全件チェック完了 ===');
    return {
      totalNames: assigneeNames.size,
      mentionableCount: mentionableCount,
      unmentionableCount: unmentionableCount,
      unmentionableNames: unmentionableCount > 0 ? [...new Set(assigneeDetails.filter(d => !d.canMention).map(d => d.assignee))] : []
    };
    
  } catch (error) {
    console.error('担当者名チェックエラー:', error);
    throw error;
  }
}

// Task DBの構造を確認する関数
function debugTaskDBStructure() {
  console.log('Task DB構造確認開始');
  
  const url = `https://api.notion.com/v1/databases/${CONFIG.NOTION_TASK_DB_ID}`;
  
  const options = {
    method: 'GET',
    headers: {
      'Authorization': `Bearer ${CONFIG.NOTION_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': CONSTANTS.NOTION.API_VERSION
    }
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    console.log('Task DB構造:');
    console.log('タイトル:', data.title);
    console.log('プロパティ一覧:');
    
    for (const [key, value] of Object.entries(data.properties)) {
      console.log(`- ${key}: ${value.type}`);
    }
    
    return data;
  } catch (error) {
    console.error('Task DB構造確認エラー:', error);
    throw error;
  }
}

// テスト用関数
function testProductTaskNotifier() {
  console.log('テスト開始');
  
  console.log('JST今日:', getJSTToday());
  console.log('JST昨日:', getJSTYesterday());
  
  // Task DB構造を確認
  console.log('=== Task DB構造確認 ===');
  debugTaskDBStructure();
  
  const products = getProductDevelopmentProducts();
  console.log('取得したプロダクト:', products);
  
  if (products.length > 0) {
    const firstProduct = products[0];
    console.log(`テスト対象プロダクト: ${firstProduct.name}`);
    console.log(`スクラムマスター: ${firstProduct.scrumMaster}`);
    
    // カテゴリフィルタなしでタスク取得を試行
    console.log('カテゴリフィルタなしでタスク取得テスト');
    const tasks = getExpiredAndTodayTasksWithoutCategory(firstProduct.id);
    console.log('取得したタスク:', tasks);
  }
  
  console.log('テスト完了');
}

// カテゴリフィルタなしでタスクを取得（テスト用）
function getExpiredAndTodayTasksWithoutCategory(productPageId) {
  const url = `https://api.notion.com/v1/databases/${CONFIG.NOTION_TASK_DB_ID}/query`;
  
  const yesterday = getJSTYesterday();
  const today = getJSTToday();
  
  // 期限切れタスクのフィルタ（カテゴリフィルタなし）
  const overdueFilter = {
    filter: {
      and: [
        {
          property: "Product",
          rollup: {
            any: {
              relation: { contains: productPageId }
            }
          }
        },
        { property: "Taskステータス", status: { does_not_equal: CONSTANTS.STATUS.COMPLETED } },
        { property: "Taskステータス", status: { does_not_equal: CONSTANTS.STATUS.CANCELLED } },
        { property: "Taskステータス", status: { does_not_equal: CONSTANTS.STATUS.BACKLOG } },
        { property: "Task期限", date: { on_or_before: yesterday } }
      ]
    },
    page_size: CONSTANTS.NOTION.PAGE_SIZE
  };
  
  const options = {
    method: 'POST',
    headers: {
      'Authorization': `Bearer ${CONFIG.NOTION_API_TOKEN}`,
      'Content-Type': 'application/json',
      'Notion-Version': CONSTANTS.NOTION.API_VERSION
    },
    payload: JSON.stringify(overdueFilter)
  };
  
  try {
    const response = UrlFetchApp.fetch(url, options);
    const data = JSON.parse(response.getContentText());
    
    console.log(`期限切れタスク数: ${data.results.length}`);
    
    return data.results.map(parseTask);
  } catch (error) {
    console.error('Task DB取得エラー:', error);
    throw error;
  }
}

// 単一プロダクトのテスト用関数
function testSingleProduct(productName) {
  console.log(`${productName} のテスト開始`);
  
  const products = getProductDevelopmentProducts();
  const targetProduct = products.find(p => p.name === productName);
  
  if (!targetProduct) {
    console.log(`プロダクト ${productName} が見つかりません`);
    return;
  }
  
  console.log(`対象プロダクト: ${targetProduct.name} (ID: ${targetProduct.id})`);
  console.log(`スクラムマスター: ${targetProduct.scrumMaster}`);
  
  const tasks = getExpiredAndTodayTasks(targetProduct.id);
  console.log('取得したタスク:', tasks);
  
  console.log('通知内容プレビュー:');
  const mapping = PRODUCT_MAPPING[productName];
  if (mapping && mapping.channelId) {
    const blocks = createSlackBlocks(productName, tasks, targetProduct.scrumMaster);
    console.log(JSON.stringify(blocks, null, 2));
  } else {
    console.log('チャンネル設定がありません');
  }
  
  console.log(`${productName} のテスト完了`);
}

// 実際のSlack通知テスト（送信する）
function testSlackNotificationSend() {
  console.log('Slack通知送信テスト開始');
  
  const products = getProductDevelopmentProducts();
  
  // 最初のプロダクトでテスト送信
  if (products.length > 0) {
    const firstProduct = products[0];
    console.log(`テスト対象プロダクト: ${firstProduct.name}`);
    
    const tasks = getExpiredAndTodayTasks(firstProduct.id);
    console.log('取得したタスク:', tasks);
    
    // 実際にSlack通知を送信
    if (tasks.overdue.length > 0 || tasks.today.length > 0) {
      console.log('Slack通知を送信します...');
      sendSlackNotification(firstProduct.name, tasks, firstProduct.scrumMaster);
    } else {
      console.log('通知対象タスクがありません');
    }
  }
  
  console.log('Slack通知送信テスト完了');
}

// Pollockプロダクトのタスク通知テスト
function testPollockTaskNotification() {
  console.log('=== Pollockプロダクト タスク通知テスト開始 ===');
  
  // Pollockプロダクトでテスト
  const products = getProductDevelopmentProducts();
  const targetProduct = products.find(p => p.name === 'Pollock(MP2)');
  
  if (!targetProduct) {
    console.log('Pollock(MP2)プロダクトが見つかりません');
    return;
  }
  
  console.log(`テスト対象プロダクト: ${targetProduct.name}`);
  
  const tasks = getExpiredAndTodayTasks(targetProduct.id);
  console.log(`期限切れタスク: ${tasks.overdue.length}件`);
  console.log(`今日期限タスク: ${tasks.today.length}件`);
  
  if (tasks.overdue.length === 0 && tasks.today.length === 0) {
    console.log('通知対象のタスクがありません');
    return;
  }
  
  // Issue別グループ化のSlackメッセージを生成
  const blocks = createSlackBlocks(targetProduct.name, tasks, targetProduct.scrumMaster);
  
  console.log('=== Slack通知内容プレビュー ===');
  console.log(JSON.stringify(blocks, null, 2));
  
  // 実際に送信
  const mapping = PRODUCT_MAPPING[targetProduct.name];
  if (mapping && mapping.channelId) {
    console.log('Slack通知を送信します...');
    sendSlackNotification(targetProduct.name, tasks, targetProduct.scrumMaster);
    console.log('送信完了');
  }
  
  console.log('=== Pollockプロダクト タスク通知テスト完了 ===');
}

// Slack通知のテスト用関数（実際には送信しない）
function testSlackNotification() {
  console.log('Slack通知テスト開始');
  
  const products = getProductDevelopmentProducts();
  console.log(`対象プロダクト数: ${products.length}`);
  
  // 最初のプロダクトでテスト
  if (products.length > 0) {
    const firstProduct = products[0];
    console.log(`テスト対象プロダクト: ${firstProduct.name}`);
    
    const tasks = getExpiredAndTodayTasks(firstProduct.id);
    console.log('取得したタスク:', tasks);
    
    // 通知内容をプレビュー
    const mapping = PRODUCT_MAPPING[firstProduct.name];
    if (mapping && mapping.channelId) {
      console.log('Slack通知内容プレビュー:');
      const blocks = createSlackBlocks(firstProduct.name, tasks, firstProduct.scrumMaster);
      console.log(JSON.stringify(blocks, null, 2));
      
      console.log(`送信先チャンネル: ${mapping.channelId}`);
    } else {
      console.log('チャンネル設定がありません');
    }
  }
  
  console.log('Slack通知テスト完了');
}
*/