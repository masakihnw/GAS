/**
 * リリース日カレンダー招待自動化ツール
 * 各スクラムマスターが実行し、自分が担当しているプロダクトのリリースのみを処理
 * 要件定義に基づく実装
 */

/**
 * Notion API関連の定数
 */
const NOTION_API = {
  BASE_URL: 'https://api.notion.com/v1',
  API_VERSION: '2022-06-28',
  PAGE_SIZE: 100,
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000
};

/**
 * Notionプロパティ名の定数（実装時に実際のプロパティ名に合わせて調整）
 */
const NOTION_PROP = {
  // リリースDB
  RELEASE_TITLE: '名前',
  RELEASE_DATE: 'リリース日',
  RELEASE_PRODUCTS: 'プロダクト',
  RELEASE_ISSUES: '全社共通 Issue',
  RELEASE_CALENDAR_EVENT_ID: 'カレンダーイベントID',
  
  // プロダクトDB
  PRODUCT_SCRUM_MASTER: 'スクラムマスター',
  PRODUCT_NAME: '名前',
  PRODUCT_PDM: 'PdM',
  PRODUCT_PDM_ASSISTANT: 'PdM補佐',
  
  // Issue DB
  ISSUE_TASKS: 'タスク', // Notion DB構造ドキュメントに基づき、Issue DBのプロパティ名は「タスク」
  ISSUE_NAME: '名前',
  
  // Task DB
  TASK_ASSIGNEE: '担当者',
  TASK_NAME: '名前',
  TASK_ISSUE_CATEGORY: 'Issue大分類' // Issue大分類（rollupプロパティ）
};

/**
 * DRY-RUNモード判定
 */
function isDryRun() {
  return (CONFIG.DRY_RUN || 'false').toLowerCase() === 'true';
}

/**
 * 柔軟なプロパティ解決（プロパティ名の表記揺れ対策）
 */
function resolveProp(page, candidates) {
  const props = page && page.properties ? page.properties : {};
  for (const key of Object.keys(props)) {
    if (candidates.includes(key)) return props[key];
  }
  return undefined;
}

/**
 * タイトル取得（複数DBのtitleプロパティ候補を順に探す）
 */
function getTitleProp(page) {
  const candidates = [
    NOTION_PROP.RELEASE_TITLE,
    NOTION_PROP.PRODUCT_NAME,
    NOTION_PROP.ISSUE_NAME,
    NOTION_PROP.TASK_NAME,
    '名前'
  ];
  for (const key of candidates) {
    const prop = page.properties[key];
    if (prop && prop.title && prop.title.length > 0) return prop;
  }
  // フォールバック：最初のtitle型を探す
  for (const key of Object.keys(page.properties || {})) {
    const prop = page.properties[key];
    if (prop && prop.title && prop.title.length > 0) return prop;
  }
  return null;
}

/**
 * アプリケーション定数
 */
const CONSTANTS = {
  CALENDAR: {
    DEFAULT_START_HOUR: 12,
    DEFAULT_END_HOUR: 13,
    EVENT_TITLE_PREFIX: '[リリース]'
  },
  TIME: {
    TIMEZONE: 'Asia/Tokyo',
    JST_OFFSET_HOURS: 9
  },
  USER_MAPPING_CACHE_KEY: 'USER_MAPPING_CACHE',
  USER_MAPPING_CACHE_TTL_MS: 24 * 60 * 60 * 1000 // 24時間
};

// Script Properties の設定
const CONFIG = {
  NOTION_API_TOKEN: PropertiesService.getScriptProperties().getProperty('NOTION_API_TOKEN') || '',
  NOTION_RELEASE_DB_ID: PropertiesService.getScriptProperties().getProperty('NOTION_RELEASE_DB_ID') || '0cc4931427714c6bafe5f05bdc66ac22',
  NOTION_ISSUE_DB_ID: PropertiesService.getScriptProperties().getProperty('NOTION_ISSUE_DB_ID') || '61b50f425ae14687b44ba250869f09ae',
  NOTION_TASK_DB_ID: PropertiesService.getScriptProperties().getProperty('NOTION_TASK_DB_ID') || 'afafabe758044461a3e9e9b4c037e5aa',
  NOTION_PRODUCT_DB_ID: PropertiesService.getScriptProperties().getProperty('NOTION_PRODUCT_DB_ID') || '0d0b0f9639454862af2b2c401f229ca6',
  CALENDAR_ID: PropertiesService.getScriptProperties().getProperty('CALENDAR_ID') || '',
  USER_MAPPING_FILE_ID: PropertiesService.getScriptProperties().getProperty('USER_MAPPING_FILE_ID') || '1HjSu0MogpG38GqlHwxLOmNCJrAiRC_iG',
  EVENT_LOG_FOLDER_ID: PropertiesService.getScriptProperties().getProperty('EVENT_LOG_FOLDER_ID') || '1c-vpPiGQb-_oFQvgPN3_k_a82NRK1a4h', // Google DriveフォルダID（ログファイルを保存するフォルダ）
  DRY_RUN: PropertiesService.getScriptProperties().getProperty('DRY_RUN') || 'false'
};

/**
 * 設定値の検証（未設定キーとフォーマット検証）
 */
function validateConfig() {
  const requiredKeys = ['NOTION_API_TOKEN', 'NOTION_RELEASE_DB_ID', 'NOTION_ISSUE_DB_ID', 'NOTION_TASK_DB_ID', 'NOTION_PRODUCT_DB_ID', 'USER_MAPPING_FILE_ID'];
  const missingKeys = requiredKeys.filter(key => !CONFIG[key]);
  
  if (missingKeys.length > 0) {
    throw new Error(`スクリプトプロパティが設定されていません: ${missingKeys.join(', ')}`);
  }
  
  // UUID/Hex形式の検証（Notion DB ID）
  const dbIdPattern = /^[0-9a-f]{32}$/i; // 32桁hex（ハイフンなし）
  const dbIdKeys = ['NOTION_RELEASE_DB_ID', 'NOTION_ISSUE_DB_ID', 'NOTION_TASK_DB_ID', 'NOTION_PRODUCT_DB_ID'];
  for (const key of dbIdKeys) {
    if (CONFIG[key] && !dbIdPattern.test(CONFIG[key])) {
      throw new Error(`スクリプトプロパティ「${key}」の形式が不正です（32桁の16進数である必要があります）: ${CONFIG[key]}`);
    }
  }
  
  // Google Drive IDの検証（簡易的）
  const driveIdPattern = /^[a-zA-Z0-9_-]+$/;
  const driveIdKeys = ['USER_MAPPING_FILE_ID', 'EVENT_LOG_FOLDER_ID'];
  for (const key of driveIdKeys) {
    if (CONFIG[key] && !driveIdPattern.test(CONFIG[key])) {
      throw new Error(`スクリプトプロパティ「${key}」の形式が不正です（Google Drive ID形式である必要があります）: ${CONFIG[key]}`);
    }
  }
  
  // CALENDAR_IDの検証（任意項目）
  if (CONFIG.CALENDAR_ID && CONFIG.CALENDAR_ID !== '') {
    // @group.calendar.google.comを含むか、または通常のカレンダーID形式を許可
    const calendarIdPattern = /^[a-zA-Z0-9._-]+(@group\.calendar\.google\.com)?$/;
    if (!calendarIdPattern.test(CONFIG.CALENDAR_ID)) {
      console.warn(`スクリプトプロパティ「CALENDAR_ID」の形式が不正です: ${CONFIG.CALENDAR_ID}（空欄の場合はデフォルトカレンダーが使用されます）`);
    }
  }
  
  console.log('設定値の検証完了');
}

/**
 * Notion API呼び出し（リトライ機能付き）
 */
function callNotionAPI(endpoint, method = 'GET', body = null) {
  const url = `${NOTION_API.BASE_URL}${endpoint}`;
  const options = {
    method: method,
    headers: {
      'Authorization': `Bearer ${CONFIG.NOTION_API_TOKEN}`,
      'Notion-Version': NOTION_API.API_VERSION,
      'Content-Type': 'application/json'
    },
    muteHttpExceptions: true
  };
  
  if (body) {
    options.payload = JSON.stringify(body);
  }
  
  let lastError;
  for (let attempt = 1; attempt <= NOTION_API.RETRY_ATTEMPTS; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      const responseCode = response.getResponseCode();
      const responseText = response.getContentText();
      
      if (responseCode === 200) {
        return JSON.parse(responseText);
      } else if (responseCode === 429 || responseCode >= 500) {
        // レート制限またはサーバーエラー: 指数バックオフ
        const baseDelayMs = NOTION_API.RETRY_DELAY_MS;
        let delayMs;
        
        if (responseCode === 429) {
          // レート制限: Retry-Afterヘッダーを優先、なければ指数バックオフ
          const retryAfter = parseInt(response.getHeaders()['Retry-After'] || '0', 10);
          delayMs = retryAfter > 0 ? retryAfter * 1000 : Math.min(baseDelayMs * Math.pow(2, attempt - 1), 8000);
          console.warn(`レート制限に達しました。${delayMs}ms待機します... (試行 ${attempt}/${NOTION_API.RETRY_ATTEMPTS})`);
        } else {
          // 5xxエラー: 指数バックオフ
          delayMs = Math.min(baseDelayMs * Math.pow(2, attempt - 1), 8000);
          console.warn(`サーバーエラー (${responseCode})。${delayMs}ms後に再試行します... (試行 ${attempt}/${NOTION_API.RETRY_ATTEMPTS})`);
        }
        
        if (attempt < NOTION_API.RETRY_ATTEMPTS) {
          Utilities.sleep(delayMs);
          lastError = new Error(`Notion API エラー (${responseCode}): ${responseText}`);
          continue;
        } else {
          throw new Error(`Notion API エラー (${responseCode}): ${responseText}`);
        }
      } else if (responseCode >= 400 && responseCode < 500) {
        // 4xxエラー（429以外）: 即座に失敗（リトライしない）
        const errorMsg = `Notion API エラー (${responseCode}): ${responseText}`;
        console.error(errorMsg);
        throw new Error(errorMsg);
      } else {
        throw new Error(`Notion API エラー (${responseCode}): ${responseText}`);
      }
    } catch (error) {
      // 既にエラーをthrowした場合は再スロー
      if (error.message && error.message.includes('Notion API エラー')) {
        throw error;
      }
      
      lastError = error;
      if (attempt < NOTION_API.RETRY_ATTEMPTS) {
        // ネットワークエラーなど: 指数バックオフ
        const baseDelayMs = NOTION_API.RETRY_DELAY_MS;
        const delayMs = Math.min(baseDelayMs * Math.pow(2, attempt - 1), 8000);
        console.warn(`Notion API呼び出しエラー。${delayMs}ms後に再試行します... (試行 ${attempt}/${NOTION_API.RETRY_ATTEMPTS})`);
        Utilities.sleep(delayMs);
      }
    }
  }
  
  throw lastError || new Error('Notion API呼び出しに失敗しました');
}

/**
 * Notion DBから全件取得（ページネーション対応）
 */
function notionQueryAll(databaseId, filter = null, sorts = null) {
  const allResults = [];
  let cursor = null;
  
  do {
    const body = {
      page_size: NOTION_API.PAGE_SIZE
    };
    
    if (filter) {
      body.filter = filter;
    }
    
    if (sorts) {
      body.sorts = sorts;
    }
    
    if (cursor) {
      body.start_cursor = cursor;
    }
    
    const response = callNotionAPI(`/databases/${databaseId}/query`, 'POST', body);
    allResults.push(...response.results);
    cursor = response.next_cursor;
    
    // レート制限回避のため、少し待機
    if (cursor) {
      Utilities.sleep(200);
    }
  } while (cursor);
  
  return allResults;
}

/**
 * ユーザーマッピングのキャッシュをクリア
 * デバッグ・トラブルシューティング用
 */
function clearUserMappingCache() {
  const cacheKey = CONSTANTS.USER_MAPPING_CACHE_KEY;
  PropertiesService.getScriptProperties().deleteProperty(cacheKey);
  console.log('ユーザーマッピングのキャッシュをクリアしました');
}

/**
 * Google Driveからユーザーマッピングファイルを読み込み
 * キャッシュ機能は無効化（常にファイルから読み込み）
 */
function loadUserMappingFromDrive(fileId) {
  // ファイルを読み込み
  try {
    const file = DriveApp.getFileById(fileId);
    const content = file.getBlob().getDataAsString();
    
    // Markdownテーブルをパース
    const lines = content.split('\n');
    const mapping = {};
    
    // ヘッダー行を探す（列位置ドリフト対策）
    let headerRowIndex = -1;
    let emailColumnIndex = -1;
    let notionUserIdColumnIndex = -1;
    
    for (let i = 0; i < Math.min(3, lines.length); i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('|---')) continue;
      
      const columns = line.split('|').map(col => col.trim()).filter(col => col);
      // ヘッダー候補: 「メールアドレス」と「NotionユーザーID」を含む行
      if (columns.includes('メールアドレス') && columns.includes('NotionユーザーID')) {
        headerRowIndex = i;
        emailColumnIndex = columns.indexOf('メールアドレス');
        notionUserIdColumnIndex = columns.indexOf('NotionユーザーID');
        break;
      }
    }
    
    // ヘッダーが見つからない場合は従来の固定位置方式にフォールバック
    const useHeaderDetection = headerRowIndex >= 0 && emailColumnIndex >= 0 && notionUserIdColumnIndex >= 0;
    
    // UUIDパターン（ハイフン有無を許可）
    const uuidPattern = /^[0-9a-f]{8}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{4}-?[0-9a-f]{12}$/i;
    // メールアドレス簡易バリデーション
    const emailPattern = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    // データ行を処理（ヘッダー行+セパレーター行の後から）
    const startRow = useHeaderDetection ? headerRowIndex + 2 : 2;
    
    for (let i = startRow; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('|---')) continue;
      
      const columns = line.split('|').map(col => col.trim()).filter(col => col);
      
      let email, notionUserId;
      if (useHeaderDetection && emailColumnIndex < columns.length && notionUserIdColumnIndex < columns.length) {
        // ヘッダー検出方式
        email = columns[emailColumnIndex];
        notionUserId = columns[notionUserIdColumnIndex];
      } else if (columns.length >= 6) {
        // フォールバック: 固定位置（従来方式）
        email = columns[3];
        notionUserId = columns[5];
      } else {
        continue; // 列数不足
      }
      
      // バリデーション
      if (!email || !notionUserId) continue;
      
      // メールアドレスの簡易バリデーション
      if (!emailPattern.test(email)) {
        console.warn(`[loadUserMappingFromDrive] メールアドレス形式が不正: ${email}`);
        continue;
      }
      
      // NotionユーザーIDはUUID形式のみ受け入れる（ハイフン有無を許可）
      if (!uuidPattern.test(notionUserId)) {
        console.warn(`[loadUserMappingFromDrive] UUID形式でないNotionユーザーIDをスキップ: ${notionUserId} (メール: ${email})`);
        continue;
      }
      
      // マッピングに追加
      mapping[notionUserId] = email;
    }
    
    // キャッシュ機能は無効化（保存しない）
    console.log(`ユーザーマッピングを読み込みました（${Object.keys(mapping).length}件）`);
    // デバッグ: マッピングのサンプルを出力（最初の3件）
    const mappingKeys = Object.keys(mapping);
    if (mappingKeys.length > 0) {
      console.log(`[デバッグ] マッピングサンプル（最初の3件）:`);
      mappingKeys.slice(0, 3).forEach(key => {
        console.log(`  ${key} -> ${mapping[key]}`);
      });
      
      // デバッグ: 対象ユーザーIDが含まれているか確認
      const targetUserIds = ['223d872b-594c-81e6-9225-00025e9954cc', '7fe220b2-6cd7-49b8-8c7c-18a17c1d8c77'];
      targetUserIds.forEach(userId => {
        if (mapping[userId]) {
          console.log(`[デバッグ] ✅ 対象ユーザーIDが見つかりました: ${userId} -> ${mapping[userId]}`);
        } else {
          console.warn(`[デバッグ] ⚠️ 対象ユーザーIDが見つかりませんでした: ${userId}`);
        }
      });
    }
    return mapping;
  } catch (error) {
    console.error('ユーザーマッピングファイルの読み込みエラー:', error);
    throw new Error(`ユーザーマッピングファイルの読み込みに失敗しました: ${error.message}`);
  }
}

/**
 * NotionユーザーIDからメールアドレスを取得
 * 1. Notion APIから直接取得したメールアドレスを優先
 * 2. マッピングファイルから取得
 * 3. Notion Users APIでユーザー情報を取得してメールアドレスを取得（マッピングファイルにない場合）
 */
function getUserEmailByNotionId(notionUserId, userMapping, notionPersonData = null) {
  // 1. Notion APIから直接取得したメールアドレスを優先
  if (notionPersonData && notionPersonData.person && notionPersonData.person.email) {
    console.log(`[getUserEmailByNotionId] Notion APIから直接メールアドレスを取得: ${notionPersonData.person.email} (ユーザーID: ${notionUserId})`);
    return notionPersonData.person.email;
  }
  
  // 2. マッピングファイルから取得
  if (userMapping[notionUserId]) {
    console.log(`[getUserEmailByNotionId] マッピングファイルからメールアドレスを取得: ${userMapping[notionUserId]} (ユーザーID: ${notionUserId})`);
    return userMapping[notionUserId];
  }
  
  // 3. Notion Users APIでユーザー情報を取得してメールアドレスを取得（マッピングファイルにない場合）
  console.log(`[getUserEmailByNotionId] マッピングファイルに存在しないため、Notion Users APIから取得を試行: ${notionUserId}`);
  try {
    const userInfo = callNotionAPI(`/users/${notionUserId}`, 'GET');
    console.log(`[getUserEmailByNotionId] Notion Users APIレスポンス: type=${userInfo?.type}, hasPerson=${!!userInfo?.person}, hasEmail=${!!userInfo?.person?.email}`);
    
    if (userInfo && userInfo.type === 'person' && userInfo.person && userInfo.person.email) {
      console.log(`[getUserEmailByNotionId] Notion Users APIからメールアドレスを取得: ${userInfo.person.email} (ユーザーID: ${notionUserId})`);
      return userInfo.person.email;
    } else {
      console.warn(`[getUserEmailByNotionId] Notion Users APIからメールアドレスを取得できませんでした（条件不一致）: ${notionUserId}`);
      if (userInfo) {
        console.warn(`[getUserEmailByNotionId] userInfo構造:`, JSON.stringify(userInfo).substring(0, 200));
      }
    }
  } catch (error) {
    // ユーザー情報の取得に失敗した場合は無視（マッピングファイルから取得できない場合はnullを返す）
    console.error(`[getUserEmailByNotionId] Notion Users APIからユーザー情報を取得できませんでした: ${notionUserId}`, error.message);
    console.error(`[getUserEmailByNotionId] エラー詳細:`, error);
  }
  
  return null;
}

/**
 * メールアドレスからNotionユーザーIDを取得（逆引き）
 */
function getNotionUserIdByEmail(email, userMapping) {
  for (const [notionUserId, mappedEmail] of Object.entries(userMapping)) {
    if (mappedEmail === email) {
      return notionUserId;
    }
  }
  return null;
}

/**
 * JST日付を取得
 */
function getJSTDate(date = new Date()) {
  return Utilities.formatDate(date, CONSTANTS.TIME.TIMEZONE, 'yyyy-MM-dd');
}

/**
 * 日付のみを比較（時間部分を無視、タイムゾーンを考慮）
 */
function compareDatesOnly(date1, date2) {
  const s1 = Utilities.formatDate(new Date(date1), CONSTANTS.TIME.TIMEZONE, 'yyyy-MM-dd');
  const s2 = Utilities.formatDate(new Date(date2), CONSTANTS.TIME.TIMEZONE, 'yyyy-MM-dd');
  return s1 === s2;
}

/**
 * リリース日のDate型から12:00-13:00のDateオブジェクトを生成
 */
function createEventDateTimes(releaseDate) {
  const startDate = new Date(releaseDate);
  startDate.setHours(CONSTANTS.CALENDAR.DEFAULT_START_HOUR, 0, 0, 0);
  
  const endDate = new Date(releaseDate);
  endDate.setHours(CONSTANTS.CALENDAR.DEFAULT_END_HOUR, 0, 0, 0);
  
  return { startDate, endDate };
}

/**
 * Notionページのタイトルを取得
 */
function getPageTitle(page) {
  const titleProp = getTitleProp(page);
  if (titleProp && titleProp.title && titleProp.title.length > 0) {
    return titleProp.title.map(t => t.plain_text).join('');
  }
  return '無題';
}

/**
 * NotionページIDからURLを生成
 */
function getNotionPageUrl(pageId) {
  // NotionページID is UUID形式（ハイフン付き）だが、URLではハイフンを削除する必要がある
  const cleanId = pageId.replace(/-/g, '');
  return `https://www.notion.so/${cleanId}`;
}

/**
 * 「バージョン名 リリース」パターンのIssueかどうかを判定
 * @param {string} issueTitle - Issueのタイトル
 * @returns {boolean} リリース作業関連Issueの場合true
 */
function isReleaseTaskIssue(issueTitle) {
  // 「リリース」で終わるIssue名を除外（例: "1.30.0リリース", "Juko-1.30.0リリース"）
  return /リリース$/.test(issueTitle);
}

/**
 * イベント説明文を生成
 * @param {string} releasePageId - リリースページID
 * @param {Array<Object>} issues - Issueオブジェクトの配列
 */
function generateEventDescription(releasePageId, issues = []) {
  const releaseUrl = getNotionPageUrl(releasePageId);
  let description = `${releaseUrl}\n\n`;
  
  if (issues && issues.length > 0) {
    // 「バージョン名 リリース」パターンのIssueを除外
    const filteredIssues = issues.filter(issue => {
      const issueTitle = getPageTitle(issue);
      return !isReleaseTaskIssue(issueTitle);
    });
    
    if (filteredIssues.length > 0) {
      description += '関連Issue:\n';
      filteredIssues.forEach(issue => {
        const issueTitle = getPageTitle(issue);
        description += `- ${issueTitle}\n`;
      });
    }
  }
  
  return description;
}

/**
 * イベントタイトルを生成
 */
function buildEventTitle(releaseTitle) {
  return `${CONSTANTS.CALENDAR.EVENT_TITLE_PREFIX}${releaseTitle}`;
}

/**
 * イベント説明文を生成（Issueオブジェクトから）
 */
function buildEventDescriptionFromIssues(releasePageId, issues) {
  return generateEventDescription(releasePageId, issues);
}

/**
 * GAS実行者のメールアドレスを取得
 */
function getExecutorEmail() {
  try {
    return Session.getActiveUser().getEmail();
  } catch (e) {
    try {
      return Session.getEffectiveUser().getEmail();
    } catch (e2) {
      throw new Error('実行者のメールアドレスを取得できませんでした');
    }
  }
}

/**
 * 実行者の識別と対象プロダクトの特定
 */
function identifyExecutorAndGetProducts(userMapping) {
  // 1. 実行者のメールアドレスを取得
  const executorEmail = getExecutorEmail();
  console.log(`実行者メールアドレス: ${executorEmail}`);
  
  // 2. メールアドレス → NotionユーザーIDを逆引き
  const executorNotionUserId = getNotionUserIdByEmail(executorEmail, userMapping);
  if (!executorNotionUserId) {
    throw new Error(`実行者のNotionユーザーIDが見つかりません: ${executorEmail}`);
  }
  console.log(`実行者NotionユーザーID: ${executorNotionUserId}`);
  
  // 3. プロダクトDBから、実行者のNotionユーザーIDがスクラムマスターとして設定されているプロダクトを取得
  const filter = {
    property: NOTION_PROP.PRODUCT_SCRUM_MASTER,
    people: {
      contains: executorNotionUserId
    }
  };
  
  const products = notionQueryAll(CONFIG.NOTION_PRODUCT_DB_ID, filter);
  const productIds = products.map(product => product.id);
  
  if (productIds.length === 0) {
    console.log('実行者が担当しているプロダクトが見つかりませんでした');
    return { executorEmail, executorNotionUserId, productIds: [] };
  }
  
  console.log(`対象プロダクト数: ${productIds.length}件`);
  products.forEach(product => {
    const productName = getPageTitle(product);
    console.log(`  - ${productName} (${product.id})`);
  });
  
  return { executorEmail, executorNotionUserId, productIds };
}

/**
 * 対象プロダクトに紐づくリリースを取得
 */
function getTargetReleases(productIds) {
  if (productIds.length === 0) {
    return [];
  }
  
  // 現在の日時を取得（JST）
  const now = new Date();
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const todayStr = today.toISOString().split('T')[0]; // YYYY-MM-DD形式
  
  // リリース日が設定されているリリースを取得（未来のリリースのみ）
  // Notion APIのrelation.containsは配列を受け付けないため、複数プロダクトの場合はor条件を使用
  let productFilter;
  if (productIds.length === 1) {
    // 1つのプロダクトのみの場合はそのまま
    productFilter = {
      property: NOTION_PROP.RELEASE_PRODUCTS,
      relation: {
        contains: productIds[0]
      }
    };
  } else {
    // 複数プロダクトの場合はor条件で各プロダクトIDごとにフィルタを作成
    productFilter = {
      or: productIds.map(productId => ({
        property: NOTION_PROP.RELEASE_PRODUCTS,
        relation: {
          contains: productId
        }
      }))
    };
  }
  
  const filter = {
    and: [
      {
        property: NOTION_PROP.RELEASE_DATE,
        date: {
          is_not_empty: true
        }
      },
      {
        property: NOTION_PROP.RELEASE_DATE,
        date: {
          on_or_after: todayStr
        }
      },
      productFilter
    ]
  };
  
  return notionQueryAll(CONFIG.NOTION_RELEASE_DB_ID, filter);
}

/**
 * リリースに紐づくIssueを取得
 */
function getIssuesForRelease(release) {
  // デバッグ: リリースページのプロパティ構造を確認
  console.log(`リリースページのプロパティ一覧:`, Object.keys(release.properties || {}));
  
  const issueProp = resolveProp(release, [NOTION_PROP.RELEASE_ISSUES, '全社共通Issue', '全社共通 Issue']);
  const issueRelation = issueProp?.relation || [];
  console.log(`「${NOTION_PROP.RELEASE_ISSUES}」プロパティ:`, issueProp);
  console.log(`取得したIssue関係の数: ${issueRelation.length}`);
  
  const issueIds = issueRelation.map(rel => rel.id);
  
  if (issueIds.length === 0) {
    console.warn(`リリース「${getPageTitle(release)}」に紐づくIssueが見つかりませんでした`);
    return [];
  }
  
  // Issueページを取得
  const issues = [];
  for (const issueId of issueIds) {
    try {
      const issue = callNotionAPI(`/pages/${issueId}`, 'GET');
      issues.push(issue);
      Utilities.sleep(200); // レート制限回避
    } catch (error) {
      console.warn(`Issue取得エラー (${issueId}):`, error);
    }
  }
  
  return issues;
}

/**
 * Issueに紐づくTaskを取得し、担当者を抽出
 * 「実装」に関連するタスクの担当者も含める
 * @returns {Array<Object>} personオブジェクトの配列
 */
function getTasksAndAssignees(issues) {
  const assigneeMap = new Map(); // NotionユーザーIDをキーに、personオブジェクトを値として保持
  
  if (issues.length === 0) {
    console.log(`[getTasksAndAssignees] Issueが0件のため、Taskを取得できません`);
    return Array.from(assigneeMap.values());
  }
  
  for (const issue of issues) {
    const issueTitle = getPageTitle(issue);
    console.log(`[getTasksAndAssignees] Issue「${issueTitle}」からTaskを取得中...`);
    
    // デバッグ: Issueページのプロパティ構造を確認
    console.log(`[getTasksAndAssignees] Issueページのプロパティ一覧:`, Object.keys(issue.properties || {}));
    
    const taskRelation = issue.properties[NOTION_PROP.ISSUE_TASKS]?.relation || [];
    console.log(`[getTasksAndAssignees] 「${NOTION_PROP.ISSUE_TASKS}」プロパティ:`, issue.properties[NOTION_PROP.ISSUE_TASKS]);
    console.log(`[getTasksAndAssignees] 取得したTask関係の数: ${taskRelation.length}`);
    
    const taskIds = taskRelation.map(rel => rel.id);
    
    for (const taskId of taskIds) {
      try {
        const task = callNotionAPI(`/pages/${taskId}`, 'GET');
        
        // タスクが「実装」に関連するかチェック
        const isImplementationTask = isImplementationRelatedTask(task);
        
        if (isImplementationTask) {
          console.log(`「実装」関連タスクを検出: ${getPageTitle(task)} (${taskId})`);
          const assignees = task.properties[NOTION_PROP.TASK_ASSIGNEE]?.people || [];
          
          assignees.forEach(person => {
            if (person.id) {
              // personオブジェクト全体を保持（メールアドレス取得のため）
              assigneeMap.set(person.id, person);
              // personオブジェクトの構造をデバッグ出力
              if (!person.person?.email && !person.email) {
                console.log(`  [デバッグ] personオブジェクト構造: ${JSON.stringify(person).substring(0, 200)}...`);
              }
              // personオブジェクトにemailが含まれているか確認
              const email = person.person?.email || person.email || null;
              console.log(`  担当者を追加: ${person.name || person.id} (ID: ${person.id})${email ? ` (メール: ${email})` : ' (メール未取得)'}`);
            }
          });
        }
        
        Utilities.sleep(200); // レート制限回避
      } catch (error) {
        console.warn(`Task取得エラー (${taskId}):`, error);
      }
    }
  }
  
  return Array.from(assigneeMap.values());
}

/**
 * タスクが「実装」に関連するかどうかを判定
 * 設計、QA、デザイン、検討、テストといったタスクは除外する
 */
function isImplementationRelatedTask(task) {
  // 除外するキーワード（タスク名に含まれている場合は実装関連として扱わない）
  const excludeKeywords = ['設計', 'QA', 'デザイン', '検討', 'テスト', 'test', 'design', 'qa', 'review', 'レビュー', '仕様', '要件'];
  
  // 1. タスク名に除外キーワードが含まれている場合は除外
  const taskTitle = getPageTitle(task);
  const taskTitleLower = taskTitle.toLowerCase();
  for (const excludeKeyword of excludeKeywords) {
    if (taskTitle.includes(excludeKeyword) || taskTitleLower.includes(excludeKeyword.toLowerCase())) {
      return false; // 除外キーワードが含まれている場合は実装関連ではない
    }
  }
  
  // 2. タスク名に「実装」または「implement」が含まれるかチェック
  // 「開発」は除外（デザイン開発なども含むため）
  if (taskTitle.includes('実装') || taskTitle.toLowerCase().includes('implement')) {
    return true;
  }
  
  // 4. 上記の条件に該当しない場合は実装関連ではない
  return false;
}

/**
 * 担当者情報（personオブジェクトの配列）をメールアドレスの配列に変換
 * @param {Array<Object>} assignees - personオブジェクトの配列（getTasksAndAssignees()から取得）
 * @param {Object} userMapping - ユーザーマッピングオブジェクト
 * @param {Array<string>} excludeEmails - 除外するメールアドレスの配列
 */
function convertNotionUserIdsToEmails(assignees, userMapping, excludeEmails = []) {
  const emails = [];
  for (const person of assignees) {
    // 1. Notion APIから直接取得したメールアドレスを優先
    const notionEmail = person.person?.email || person.email || null;
    const email = notionEmail || getUserEmailByNotionId(person.id, userMapping, person);
    
    if (email && !excludeEmails.includes(email)) {
      emails.push(email);
    } else if (!email) {
      // デバッグ情報を出力
      console.warn(`メールアドレスが見つかりません: NotionユーザーID=${person.id}, 名前=${person.name || '不明'}`);
      console.warn(`  person.person?.email: ${person.person?.email || 'null'}, person.email: ${person.email || 'null'}`);
      console.warn(`  マッピングファイルに存在するか: ${userMapping[person.id] ? '存在する' : '存在しない'}`);
      
      // マッピングファイル全体をデバッグ出力（最初の10件）- 空でないもののみ、かつヘッダー行を除外
      const uuidPattern = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
      const mappingKeys = Object.keys(userMapping).filter(key => 
        key && 
        key !== '' && 
        key !== 'NotionユーザーID' && 
        key !== '---' &&
        !key.includes('->') &&
        userMapping[key] &&
        userMapping[key] !== 'メールアドレス' &&
        userMapping[key] !== '---' &&
        uuidPattern.test(key) // UUID形式のキーのみ
      );
      if (mappingKeys.length > 0) {
        console.warn(`  [デバッグ] マッピングファイルのNotionユーザーID（最初の10件）:`);
        mappingKeys.slice(0, 10).forEach(key => {
          console.warn(`    ${key} -> ${userMapping[key]}`);
        });
      }
      
      // 類似のIDを探す（部分一致）
      const similarKeys = mappingKeys.filter(key => key.includes(person.id.substring(0, 8)) || person.id.includes(key.substring(0, 8)));
      if (similarKeys.length > 0) {
        console.warn(`  [デバッグ] 類似のIDが見つかりました:`);
        similarKeys.forEach(key => {
          console.warn(`    ${key} -> ${userMapping[key]}`);
        });
      }
    }
  }
  return emails;
}



/**
 * イベントログ管理（JSONLファイル操作）
 */
const EventLog = {
  /**
   * イベントログファイルを取得または作成
   * @returns {GoogleAppsScript.Drive.File} ログファイル
   * @private
   */
  _getOrCreateFile() {
    const folderId = CONFIG.EVENT_LOG_FOLDER_ID;
    if (!folderId) {
      throw new Error('EVENT_LOG_FOLDER_IDが設定されていません。Script Propertiesに設定してください。');
    }
    
    try {
      const folder = DriveApp.getFolderById(folderId);
      const fileName = 'event_ids.jsonl';
      const files = folder.getFilesByName(fileName);
      
      if (files.hasNext()) {
        return files.next();
      } else {
        // ファイルが存在しない場合、新規作成
        const newFile = folder.createFile(fileName, '');
        console.log(`[EventLog] ログファイルを新規作成: ${fileName}`);
        return newFile;
      }
    } catch (error) {
      console.error(`[EventLog] ログファイル取得エラー:`, error);
      throw new Error(`ログファイルの取得に失敗しました: ${error.message}`);
    }
  },

  /**
   * イベントIDを取得
   * @param {string} releaseId - リリースID
   * @param {string} executorNotionUserId - 実行者のNotionユーザーID
   * @returns {string|null} イベントID
   */
  get(releaseId, executorNotionUserId) {
    try {
      const logFile = this._getOrCreateFile();
      const content = logFile.getBlob().getDataAsString();
      
      if (!content || content.trim() === '') {
        return null;
      }
      
      // JSON Lines形式をパース（空行・壊れた行をスキップ）
      const lines = content.trim().split('\n').filter(line => line.trim());
      
      // 最新のレコードから検索（最後の行から逆順）
      for (let i = lines.length - 1; i >= 0; i--) {
        try {
          const record = JSON.parse(lines[i]);
          if (record.releaseId === releaseId && record.executorNotionUserId === executorNotionUserId) {
            console.log(`[EventLog] イベントIDを発見: ${record.eventId}`);
            return record.eventId;
          }
        } catch (e) {
          // パースエラーは警告してスキップ（壊れた行の許可）
          console.warn(`[EventLog] 行のパースエラーをスキップ (行${i + 1}):`, e.message);
        }
      }
      
      return null;
    } catch (error) {
      console.warn(`[EventLog] ログファイル読み込みエラー:`, error);
      return null;
    }
  },

  /**
   * イベントIDを保存
   * @param {string} releaseId - リリースID
   * @param {string} eventId - イベントID
   * @param {string} executorNotionUserId - 実行者のNotionユーザーID
   * @param {Date} [timestamp] - タイムスタンプ（省略時は現在時刻）
   */
  put(releaseId, eventId, executorNotionUserId, timestamp = null) {
    try {
      const logFile = this._getOrCreateFile();
      const now = timestamp || new Date();
      const timestampStr = Utilities.formatDate(now, CONSTANTS.TIME.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
      
      // JSON Lines形式で追記
      const record = {
        releaseId: releaseId,
        executorNotionUserId: executorNotionUserId,
        eventId: eventId,
        timestamp: timestampStr
      };
      
      // 既存の内容を読み取る（エラー時は空文字列として扱う）
      let existingContent = '';
      try {
        existingContent = logFile.getBlob().getDataAsString();
      } catch (e) {
        existingContent = '';
      }
      
      // 新しい行を追加
      const line = JSON.stringify(record) + '\n';
      const newContent = existingContent + line;
      
      // ファイルを更新
      logFile.setContent(newContent);
      console.log(`[EventLog] イベントIDを保存: ${eventId}`);
    } catch (error) {
      console.error(`[EventLog] ログファイル保存エラー:`, error);
      // エラーが発生しても処理は継続（カレンダーイベント自体は作成済みのため）
    }
  },

  /**
   * イベントIDを削除
   * @param {string} releaseId - リリースID
   * @param {string} executorNotionUserId - 実行者のNotionユーザーID
   */
  delete(releaseId, executorNotionUserId) {
    try {
      const logFile = this._getOrCreateFile();
      const content = logFile.getBlob().getDataAsString();
      
      if (!content || content.trim() === '') {
        return;
      }
      
      // JSON Lines形式をパースして、該当レコードを除外（壊れた行は保持）
      const lines = content.trim().split('\n').filter(line => line.trim());
      const filteredLines = [];
      
      for (const line of lines) {
        try {
          const record = JSON.parse(line);
          // 該当レコード以外を保持
          if (!(record.releaseId === releaseId && record.executorNotionUserId === executorNotionUserId)) {
            filteredLines.push(line);
          }
        } catch (e) {
          // パースエラーは保持（壊れた行も残す）
          filteredLines.push(line);
        }
      }
      
      // ファイルを書き直し
      const newContent = filteredLines.length > 0 ? filteredLines.join('\n') + '\n' : '';
      logFile.setContent(newContent);
      console.log(`[EventLog] イベントIDを削除`);
    } catch (error) {
      console.warn(`[EventLog] ログファイル削除エラー:`, error);
    }
  }
};

/**
 * ログファイルからイベントIDログファイルを取得または作成（後方互換用ラッパ）
 * @returns {GoogleAppsScript.Drive.File} ログファイル
 * @deprecated EventLog._getOrCreateFile() を使用してください
 */
function getOrCreateEventLogFile() {
  return EventLog._getOrCreateFile();
}

/**
 * ログファイルからイベントIDを取得（後方互換用ラッパ）
 * @param {string} releaseId - リリースID
 * @param {string} executorNotionUserId - 実行者のNotionユーザーID
 * @returns {string|null} イベントID
 * @deprecated EventLog.get() を使用してください
 */
function getEventIdFromLog(releaseId, executorNotionUserId) {
  return EventLog.get(releaseId, executorNotionUserId);
}

/**
 * ログファイルにイベントIDを保存（後方互換用ラッパ）
 * @param {string} releaseId - リリースID
 * @param {string} eventId - イベントID
 * @param {string} executorNotionUserId - 実行者のNotionユーザーID
 * @deprecated EventLog.put() を使用してください
 */
function saveEventIdToLog(releaseId, eventId, executorNotionUserId) {
  EventLog.put(releaseId, eventId, executorNotionUserId);
}

/**
 * ログファイルからイベントIDを削除（後方互換用ラッパ）
 * @param {string} releaseId - リリースID
 * @param {string} executorNotionUserId - 実行者のNotionユーザーID
 * @deprecated EventLog.delete() を使用してください
 */
function deleteEventIdFromLog(releaseId, executorNotionUserId) {
  EventLog.delete(releaseId, executorNotionUserId);
}

/**
 * リリースからプロダクトのPdMとPdM補佐のメールアドレスを取得
 */
function getProductPdMEmails(release, userMapping) {
  const pdmEmails = [];
  
  try {
    // リリースのプロダクトリレーションを取得
    const productRelation = release.properties[NOTION_PROP.RELEASE_PRODUCTS]?.relation || [];
    
    if (productRelation.length === 0) {
      console.log('[getProductPdMEmails] リリースに紐づくプロダクトが見つかりませんでした');
      return pdmEmails;
    }
    
    // 各プロダクトからPdMとPdM補佐を取得
    for (const productRel of productRelation) {
      try {
        const product = callNotionAPI(`/pages/${productRel.id}`, 'GET');
        
        // PdMを取得
        const pdmPeople = product.properties[NOTION_PROP.PRODUCT_PDM]?.people || [];
        for (const pdmPerson of pdmPeople) {
          const email = getUserEmailByNotionId(pdmPerson.id, userMapping, pdmPerson);
          if (email && !pdmEmails.includes(email)) {
            pdmEmails.push(email);
            console.log(`[getProductPdMEmails] PdMを追加: ${email} (${pdmPerson.name || pdmPerson.id})`);
          }
        }
        
        // PdM補佐を取得
        const pdmAssistantPeople = product.properties[NOTION_PROP.PRODUCT_PDM_ASSISTANT]?.people || [];
        for (const pdmAssistantPerson of pdmAssistantPeople) {
          const email = getUserEmailByNotionId(pdmAssistantPerson.id, userMapping, pdmAssistantPerson);
          if (email && !pdmEmails.includes(email)) {
            pdmEmails.push(email);
            console.log(`[getProductPdMEmails] PdM補佐を追加: ${email} (${pdmAssistantPerson.name || pdmAssistantPerson.id})`);
          }
        }
        
        Utilities.sleep(200); // レート制限回避
      } catch (error) {
        console.warn(`[getProductPdMEmails] プロダクト取得エラー (${productRel.id}):`, error);
      }
    }
  } catch (error) {
    console.warn(`[getProductPdMEmails] エラー:`, error);
  }
  
  return pdmEmails;
}

/**
 * ゲストリストから除外対象のメールアドレスをフィルタリング
 * @param {Array<string>} guests - ゲストリスト（メールアドレスの配列）
 * @returns {Array<string>} フィルタリング後のゲストリスト
 */
function filterExcludedGuests(guests) {
  // 除外対象のメールアドレスリスト
  const EXCLUDED_EMAILS = [
    'keiji.ito@playground.live',
    'mamoru.shimoe@playground.live',
    'toshi.matsumoto@playground.live'
  ];
  
  return guests.filter(email => {
    const shouldExclude = EXCLUDED_EMAILS.includes(email.toLowerCase());
    if (shouldExclude) {
      console.log(`[filterExcludedGuests] 除外対象のメールアドレスを除外: ${email}`);
    }
    return !shouldExclude;
  });
}

/**
 * Googleカレンダーイベントを作成
 */
function createCalendarEvent(release, executorEmail, taskAssigneeEmails, userMapping) {
  const calendar = CONFIG.CALENDAR_ID 
    ? CalendarApp.getCalendarById(CONFIG.CALENDAR_ID)
    : CalendarApp.getDefaultCalendar();
  
  const releaseTitle = getPageTitle(release);
  const releaseDateProp = release.properties[NOTION_PROP.RELEASE_DATE]?.date;
  
  if (!releaseDateProp || !releaseDateProp.start) {
    throw new Error('リリース日が設定されていません');
  }
  
  const releaseDate = new Date(releaseDateProp.start);
  const { startDate, endDate } = createEventDateTimes(releaseDate);
  
  const title = buildEventTitle(releaseTitle);
  
  // Issueを取得して説明文を生成
  const issues = getIssuesForRelease(release);
  const description = buildEventDescriptionFromIssues(release.id, issues);
  
  // PdMとPdM補佐のメールアドレスを取得
  const productPdMEmails = getProductPdMEmails(release, userMapping);
  
  // ゲストリスト（実行者 + Task担当者 + PdM + PdM補佐、重複排除、除外対象フィルタリング）
  const guests = [executorEmail, ...taskAssigneeEmails, ...productPdMEmails];
  const uniqueGuests = [...new Set(guests)];
  const filteredGuests = filterExcludedGuests(uniqueGuests);
  
  console.log(`イベント作成: ${title}, 日時: ${Utilities.formatDate(startDate, CONSTANTS.TIME.TIMEZONE, 'yyyy-MM-dd HH:mm')}, ゲスト数: ${filteredGuests.length}`);
  
  const event = calendar.createEvent(
    title,
    startDate,
    endDate,
    {
      description: description,
      guests: filteredGuests.join(','),
      sendInvites: !isDryRun()
    }
  );
  
  const eventId = event.getId();
  console.log(`イベント作成完了: ${eventId}`);
  
  return eventId;
}

/**
 * Googleカレンダーイベントを更新（日付のみ）
 */
function updateCalendarEvent(eventId, newReleaseDate) {
  const calendar = CONFIG.CALENDAR_ID 
    ? CalendarApp.getCalendarById(CONFIG.CALENDAR_ID)
    : CalendarApp.getDefaultCalendar();
  
  try {
    const event = calendar.getEventById(eventId);
    const { startDate, endDate } = createEventDateTimes(newReleaseDate);
    
    event.setTime(startDate, endDate);
    console.log(`イベント更新完了: ${eventId}, 新日時: ${Utilities.formatDate(startDate, CONSTANTS.TIME.TIMEZONE, 'yyyy-MM-dd HH:mm')}`);
    return true;
  } catch (error) {
    console.warn(`イベント更新エラー (${eventId}):`, error);
    return false;
  }
}

/**
 * Googleカレンダーイベントの説明文とゲストリストを更新
 * @param {string} eventId - イベントID
 * @param {string} newDescription - 新しい説明文
 * @param {Array<string>} newGuests - 新しいゲストリスト（メールアドレスの配列）
 * @returns {boolean} 更新が行われたかどうか
 */
function updateCalendarEventDetails(eventId, newDescription, newGuests) {
  const calendar = CONFIG.CALENDAR_ID 
    ? CalendarApp.getCalendarById(CONFIG.CALENDAR_ID)
    : CalendarApp.getDefaultCalendar();
  
  try {
    const event = calendar.getEventById(eventId);
    const currentDescription = event.getDescription() || '';
    const currentGuests = event.getGuestList().map(guest => guest.getEmail()).sort();
    const newGuestsSorted = [...new Set(newGuests)].sort();
    
    let updated = false;
    
    // 説明文を比較して更新
    if (currentDescription !== newDescription) {
      event.setDescription(newDescription);
      console.log(`[updateCalendarEventDetails] 説明文を更新: ${eventId}`);
      updated = true;
    }
    
    // ゲストリストを比較して更新
    const currentGuestsStr = currentGuests.join(',');
    const newGuestsStr = newGuestsSorted.join(',');
    if (currentGuestsStr !== newGuestsStr) {
      // 追加すべきゲストを追加
      const guestsToAdd = newGuestsSorted.filter(email => !currentGuests.includes(email));
      if (guestsToAdd.length > 0) {
        guestsToAdd.forEach(email => {
          try {
            event.addGuest(email);
          } catch (e) {
            // 既に追加済みの場合は無視
          }
        });
        console.log(`[updateCalendarEventDetails] ゲストを追加: ${guestsToAdd.join(', ')}`);
        updated = true;
      }
      
      // 削除すべきゲストを削除
      const guestsToRemove = currentGuests.filter(email => !newGuestsSorted.includes(email));
      if (guestsToRemove.length > 0) {
        // 主催者は削除できないため、主催者を除外
        const organizerEmails = event.getCreators();
        const removableGuests = guestsToRemove.filter(email => !organizerEmails.includes(email));
        
        removableGuests.forEach(email => {
          try {
            // event.removeGuest()メソッドでゲストを削除
            event.removeGuest(email);
            console.log(`[updateCalendarEventDetails] ゲストを削除: ${email}`);
            updated = true;
          } catch (e) {
            console.warn(`[updateCalendarEventDetails] ゲスト削除エラー (${email}):`, e.message);
          }
        });
        
        // 主催者の削除が必要な場合は警告
        const organizersToRemove = guestsToRemove.filter(email => organizerEmails.includes(email));
        if (organizersToRemove.length > 0) {
          console.warn(`[updateCalendarEventDetails] 主催者は削除できません: ${organizersToRemove.join(', ')}`);
        }
      }
    }
    
    return updated;
  } catch (error) {
    console.warn(`[updateCalendarEventDetails] イベント更新エラー (${eventId}):`, error);
    return false;
  }
}

/**
 * Googleカレンダーイベントを削除
 */
function deleteCalendarEvent(eventId) {
  const calendar = CONFIG.CALENDAR_ID 
    ? CalendarApp.getCalendarById(CONFIG.CALENDAR_ID)
    : CalendarApp.getDefaultCalendar();
  
  try {
    const event = calendar.getEventById(eventId);
    event.deleteEvent();
    console.log(`イベント削除完了: ${eventId}`);
    return true;
  } catch (error) {
    console.warn(`イベント削除エラー (${eventId}):`, error);
    return false;
  }
}

/**
 * メイン処理: リリース日の入力・変更・削除を処理
 */

/**
 * メイン処理: リリース日の入力・変更・削除を処理
 */
function processReleases() {
  try {
    validateConfig();
    
    // ユーザーマッピングファイルを読み込み
    console.log('ユーザーマッピングファイルを読み込み中...');
    const userMapping = loadUserMappingFromDrive(CONFIG.USER_MAPPING_FILE_ID);
    
    // 実行者の識別と対象プロダクトの特定
    console.log('実行者の識別と対象プロダクトの特定中...');
    const { executorEmail, executorNotionUserId, productIds } = identifyExecutorAndGetProducts(userMapping);
    
    if (productIds.length === 0) {
      console.log('処理対象のプロダクトがありません。処理を終了します。');
      return;
    }
    
    // 対象リリースを取得
    console.log('対象リリースを取得中...');
    const releases = getTargetReleases(productIds);
    
    if (releases.length === 0) {
      console.log('処理対象のリリースがありません。処理を終了します。');
      return;
    }
    
    console.log(`処理対象リリース数: ${releases.length}件`);
    
    // 各リリースを処理
    for (const release of releases) {
      try {
        const releaseId = release.id;
        const releaseTitle = getPageTitle(release);
        const releaseDateProp = release.properties[NOTION_PROP.RELEASE_DATE]?.date;
        
        if (!releaseDateProp) {
          // リリース日が未設定の場合、既存のイベントを削除
          const logEventId = EventLog.get(releaseId, executorNotionUserId);
          
          if (logEventId) {
            if (isDryRun()) {
              console.log(`[DRY_RUN] would delete event for ${releaseTitle} (${logEventId})`);
            } else {
              console.log(`リリース日が未設定のため、イベントを削除します: ${releaseTitle} (${logEventId})`);
              deleteCalendarEvent(logEventId);
              EventLog.delete(releaseId, executorNotionUserId);
            }
          }
          continue;
        }
        
        const releaseDate = new Date(releaseDateProp.start);
        // JSONLログファイルからイベントIDを取得
        const logEventId = EventLog.get(releaseId, executorNotionUserId);
        
        if (logEventId) {
          // 既存イベントがある場合、日付を確認して更新
          console.log(`既存イベントを確認中: ${releaseTitle} (${logEventId})`);
          
          try {
            const calendar = CONFIG.CALENDAR_ID 
              ? CalendarApp.getCalendarById(CONFIG.CALENDAR_ID)
              : CalendarApp.getDefaultCalendar();
            const event = calendar.getEventById(logEventId);
            const currentEventDate = event.getStartTime();
            
            // 最新のIssueとTask担当者を取得
            const issues = getIssuesForRelease(release);
            const assignees = getTasksAndAssignees(issues);
            const taskAssigneeEmails = convertNotionUserIdsToEmails(assignees, userMapping, [executorEmail]);
            const productPdMEmails = getProductPdMEmails(release, userMapping);
            
            // 新しい説明文とゲストリストを生成
            const newDescription = buildEventDescriptionFromIssues(release.id, issues);
            const guests = [executorEmail, ...taskAssigneeEmails, ...productPdMEmails];
            const uniqueGuests = [...new Set(guests)];
            const newGuests = filterExcludedGuests(uniqueGuests);
            
            let needsUpdate = false;
            
            // 日付を確認
            if (!compareDatesOnly(currentEventDate, releaseDate)) {
              // 日付が異なる場合、更新
              if (isDryRun()) {
                console.log(`[DRY_RUN] would update event for ${releaseTitle}, old date: ${getJSTDate(currentEventDate)}, new date: ${getJSTDate(releaseDate)}`);
              } else {
                console.log(`リリース日が変更されました: ${releaseTitle}, 旧日付: ${getJSTDate(currentEventDate)}, 新日付: ${getJSTDate(releaseDate)}`);
                const updated = updateCalendarEvent(logEventId, releaseDate);
                if (!updated) {
                  // イベントが見つからない場合（手動削除など）、新規作成
                  console.log(`イベントが見つかりません。新規作成します。`);
                  throw new Error('イベントが見つかりません');
                }
                needsUpdate = true;
              }
            }
            
            // 説明文とゲストリストを確認して更新
            if (isDryRun()) {
              console.log(`[DRY_RUN] would check and update description and guests for ${releaseTitle}`);
            } else {
              const updated = updateCalendarEventDetails(logEventId, newDescription, newGuests);
              if (updated) {
                needsUpdate = true;
              }
            }
            
            if (!needsUpdate) {
              console.log(`リリース情報に変更はありません: ${releaseTitle}`);
            }
          } catch (error) {
            // イベントが見つからない場合（手動削除など）、新規作成
            console.log(`イベントが見つかりません（ID: ${logEventId}）。新規作成します。`);
            
            // IssueとTaskを取得して担当者を抽出
            const issues = getIssuesForRelease(release);
            const assignees = getTasksAndAssignees(issues);
            const taskAssigneeEmails = convertNotionUserIdsToEmails(assignees, userMapping, [executorEmail]);
            
            // 新規イベントを作成
            if (isDryRun()) {
              console.log(`[DRY_RUN] would create event for ${releaseTitle}`);
            } else {
              const newEventId = createCalendarEvent(release, executorEmail, taskAssigneeEmails, userMapping);
              // JSONLログファイルに保存
              EventLog.put(releaseId, newEventId, executorNotionUserId);
            }
          }
        } else {
          // 新規イベントを作成
          console.log(`新規イベントを作成します: ${releaseTitle}`);
          
          // IssueとTaskを取得して担当者を抽出
          const issues = getIssuesForRelease(release);
          const assignees = getTasksAndAssignees(issues);
          const taskAssigneeEmails = convertNotionUserIdsToEmails(assignees, userMapping, [executorEmail]);
          
          // イベントを作成
          if (isDryRun()) {
            console.log(`[DRY_RUN] would create event for ${releaseTitle}`);
          } else {
            const eventId = createCalendarEvent(release, executorEmail, taskAssigneeEmails, userMapping);
            // JSONLログファイルに保存
            EventLog.put(releaseId, eventId, executorNotionUserId);
          }
        }
        
        // レート制限回避
        Utilities.sleep(500);
        
      } catch (error) {
        console.error(`リリース処理エラー (${release.id}):`, error);
        // エラーが発生しても次のリリースを処理する
      }
    }
    
    console.log('処理完了');
    
  } catch (error) {
    console.error('メイン処理エラー:', error);
    throw error;
  }
}

/**
 * メイン実行関数（手動実行・トリガー用）
 */
function main() {
  processReleases();
}

/**
 * テスト用: Jukoのリリース（今日より未来の日付）を1件取得してカレンダー招待を作成
 */
function testJukoReleaseCalendarInvite() {
  try {
    validateConfig();
    
    // ユーザーマッピングファイルを読み込み
    console.log('ユーザーマッピングファイルを読み込み中...');
    const userMapping = loadUserMappingFromDrive(CONFIG.USER_MAPPING_FILE_ID);
    
    // 実行者の識別
    const executorEmail = getExecutorEmail();
    console.log(`実行者メールアドレス: ${executorEmail}`);
    
    const executorNotionUserId = getNotionUserIdByEmail(executorEmail, userMapping);
    if (!executorNotionUserId) {
      throw new Error(`実行者のNotionユーザーIDが見つかりません: ${executorEmail}`);
    }
    console.log(`実行者NotionユーザーID: ${executorNotionUserId}`);
    
    // Jukoのプロダクトを取得（プロダクト名に"Juko"または"MA"を含む）
    let productFilter = {
      property: NOTION_PROP.PRODUCT_NAME,
      title: {
        contains: 'Juko'
      }
    };
    
    let products = notionQueryAll(CONFIG.NOTION_PRODUCT_DB_ID, productFilter);
    
    // プロダクトが見つからない場合、"MA"を含むものを検索（「Juko (MA)」の場合）
    if (products.length === 0) {
      console.log('「Juko」を含むプロダクトが見つかりませんでした。「MA」を含むプロダクトを検索します...');
      productFilter = {
        property: NOTION_PROP.PRODUCT_NAME,
        title: {
          contains: 'MA'
        }
      };
      products = notionQueryAll(CONFIG.NOTION_PRODUCT_DB_ID, productFilter);
      
      // Juko (MA) を特定
      products = products.filter(product => {
        const productName = getPageTitle(product);
        return productName.includes('Juko') || productName.includes('MA');
      });
    }
    
    if (products.length === 0) {
      throw new Error('JukoまたはMAのプロダクトが見つかりませんでした');
    }
    
    console.log(`\nJuko関連プロダクト数: ${products.length}件`);
    products.forEach(product => {
      const productName = getPageTitle(product);
      console.log(`  - ${productName} (${product.id})`);
    });
    
    const jukoProductId = products[0].id; // 最初のプロダクトを使用
    const jukoProductName = getPageTitle(products[0]);
    console.log(`\n使用するプロダクト: ${jukoProductName} (${jukoProductId})`);
    
    // 今日より未来の日付が設定されているリリースを取得
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const todayISO = today.toISOString().split('T')[0];
    
    console.log(`\n検索条件: リリース日 >= ${todayISO}`);
    
    const releaseFilter = {
      and: [
        {
          property: NOTION_PROP.RELEASE_DATE,
          date: {
            on_or_after: todayISO
          }
        },
        {
          property: NOTION_PROP.RELEASE_PRODUCTS,
          relation: {
            contains: jukoProductId
          }
        }
      ]
    };
    
    const releases = notionQueryAll(CONFIG.NOTION_RELEASE_DB_ID, releaseFilter);
    
    if (releases.length === 0) {
      throw new Error(`Jukoに関連する未来日付のリリースが見つかりませんでした（検索条件: 日付 >= ${todayISO}）`);
    }
    
    console.log(`\n対象リリース数: ${releases.length}件`);
    releases.forEach((release, index) => {
      const releaseTitle = getPageTitle(release);
      const releaseDateProp = release.properties[NOTION_PROP.RELEASE_DATE]?.date;
      const releaseDateStr = releaseDateProp?.start || '日付なし';
      console.log(`  ${index + 1}. ${releaseTitle} (${releaseDateStr})`);
    });
    
    // 各リリースを処理
    for (const release of releases) {
      try {
        const releaseId = release.id;
        const releaseTitle = getPageTitle(release);
        const releaseDateProp = release.properties[NOTION_PROP.RELEASE_DATE]?.date;
        
        console.log(`\n========== 処理対象リリース ==========`);
        console.log(`リリース名: ${releaseTitle}`);
        console.log(`リリースID: ${releaseId}`);
        console.log(`リリース日: ${releaseDateProp?.start || '日付なし'}`);
        console.log(`=====================================`);
        
        if (!releaseDateProp || !releaseDateProp.start) {
          console.warn(`リリース日が設定されていないため、スキップします: ${releaseTitle}`);
          continue;
        }
        
        const releaseDate = new Date(releaseDateProp.start);
        // JSONLログファイルからイベントIDを取得
        const logEventId = EventLog.get(releaseId, executorNotionUserId);
        
        if (logEventId) {
          // 既存イベントがある場合、日付・説明文・ゲストリストを確認して更新
          console.log(`既存イベントを確認中: ${releaseTitle} (${logEventId})`);
          
          try {
            const calendar = CONFIG.CALENDAR_ID 
              ? CalendarApp.getCalendarById(CONFIG.CALENDAR_ID)
              : CalendarApp.getDefaultCalendar();
            const event = calendar.getEventById(logEventId);
            const currentEventDate = event.getStartTime();
            
            // 最新のIssueとTask担当者を取得
            const issues = getIssuesForRelease(release);
            const assignees = getTasksAndAssignees(issues);
            const taskAssigneeEmails = convertNotionUserIdsToEmails(assignees, userMapping, [executorEmail]);
            const productPdMEmails = getProductPdMEmails(release, userMapping);
            
            // 新しい説明文とゲストリストを生成
            const newDescription = buildEventDescriptionFromIssues(release.id, issues);
            const guests = [executorEmail, ...taskAssigneeEmails, ...productPdMEmails];
            const uniqueGuests = [...new Set(guests)];
            const newGuests = filterExcludedGuests(uniqueGuests);
            
            let needsUpdate = false;
            
            // 日付を確認
            if (!compareDatesOnly(currentEventDate, releaseDate)) {
              // 日付が異なる場合、更新
              if (isDryRun()) {
                console.log(`[DRY_RUN] would update event date for ${releaseTitle}, old date: ${getJSTDate(currentEventDate)}, new date: ${getJSTDate(releaseDate)}`);
              } else {
                console.log(`リリース日が変更されました: ${releaseTitle}, 旧日付: ${getJSTDate(currentEventDate)}, 新日付: ${getJSTDate(releaseDate)}`);
                const updated = updateCalendarEvent(logEventId, releaseDate);
                if (!updated) {
                  // イベントが見つからない場合（手動削除など）、新規作成
                  console.log(`イベントが見つかりません。新規作成します。`);
                  throw new Error('イベントが見つかりません');
                }
                needsUpdate = true;
              }
            }
            
            // 説明文とゲストリストを確認して更新
            if (isDryRun()) {
              console.log(`[DRY_RUN] would check and update description and guests for ${releaseTitle}`);
            } else {
              const updated = updateCalendarEventDetails(logEventId, newDescription, newGuests);
              if (updated) {
                needsUpdate = true;
              }
            }
            
            if (!needsUpdate) {
              console.log(`リリース情報に変更はありません: ${releaseTitle}`);
            }
          } catch (error) {
            // イベントが見つからない場合（手動削除など）、新規作成
            console.log(`イベントが見つかりません（ID: ${logEventId}）。新規作成します。`);
            
            // IssueとTaskを取得して担当者を抽出
            const issues = getIssuesForRelease(release);
            const assignees = getTasksAndAssignees(issues);
            const taskAssigneeEmails = convertNotionUserIdsToEmails(assignees, userMapping, [executorEmail]);
            
            // 新規イベントを作成
            if (isDryRun()) {
              console.log(`[DRY_RUN] would create event for ${releaseTitle}`);
            } else {
              const newEventId = createCalendarEvent(release, executorEmail, taskAssigneeEmails, userMapping);
              // JSONLログファイルに保存
              EventLog.put(releaseId, newEventId, executorNotionUserId);
              console.log(`✅ カレンダーイベント作成完了: ${releaseTitle} (${newEventId})`);
            }
          }
        } else {
          // 新規イベントを作成
          console.log(`新規イベントを作成します: ${releaseTitle}`);
          
          // IssueとTaskを取得して担当者を抽出
          const issues = getIssuesForRelease(release);
          const assignees = getTasksAndAssignees(issues);
          const taskAssigneeEmails = convertNotionUserIdsToEmails(assignees, userMapping, [executorEmail]);
          
          // イベントを作成
          if (isDryRun()) {
            console.log(`[DRY_RUN] would create event for ${releaseTitle}`);
          } else {
            const eventId = createCalendarEvent(release, executorEmail, taskAssigneeEmails, userMapping);
            // JSONLログファイルに保存
            EventLog.put(releaseId, eventId, executorNotionUserId);
            console.log(`✅ カレンダーイベント作成完了: ${releaseTitle} (${eventId})`);
          }
        }
        
        // レート制限回避
        Utilities.sleep(500);
        
      } catch (error) {
        console.error(`リリース処理エラー (${release.id}):`, error);
        // エラーが発生しても次のリリースを処理する
      }
    }
    
    console.log('\n✅ ========== 全リリース処理完了！ ==========');
    
  } catch (error) {
    console.error('\n❌ テスト実行エラー:', error);
    throw error;
  }
}

