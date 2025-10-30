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
  
  // Issue DB
  ISSUE_TASKS: '全社共通Task',
  ISSUE_NAME: '名前',
  
  // Task DB
  TASK_ASSIGNEE: '担当者',
  TASK_NAME: '名前',
  TASK_ISSUE_CATEGORY: 'Issue大分類' // Issue大分類（rollupプロパティ）
};

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
  NOTION_PRODUCT_DB_ID: PropertiesService.getScriptProperties().getProperty('NOTION_PRODUCT_DB_ID') || '0d0V0f9639454862af2b2c401f229ca6',
  CALENDAR_ID: PropertiesService.getScriptProperties().getProperty('CALENDAR_ID') || '',
  USER_MAPPING_FILE_ID: PropertiesService.getScriptProperties().getProperty('USER_MAPPING_FILE_ID') || '1HjSu0MogpG38GqlHwxLOmNCJrAiRC_iG',
  EVENT_LOG_FOLDER_ID: PropertiesService.getScriptProperties().getProperty('EVENT_LOG_FOLDER_ID') || '' // Google DriveフォルダID（ログファイルを保存するフォルダ）
};

/**
 * 設定値の検証
 */
function validateConfig() {
  const requiredKeys = ['NOTION_API_TOKEN', 'NOTION_RELEASE_DB_ID', 'NOTION_ISSUE_DB_ID', 'NOTION_TASK_DB_ID', 'NOTION_PRODUCT_DB_ID', 'USER_MAPPING_FILE_ID'];
  const missingKeys = requiredKeys.filter(key => !CONFIG[key]);
  
  if (missingKeys.length > 0) {
    throw new Error(`スクリプトプロパティが設定されていません: ${missingKeys.join(', ')}`);
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
      } else if (responseCode === 429) {
        // レート制限
        const retryAfter = parseInt(response.getHeaders()['Retry-After'] || '1', 10);
        console.warn(`レート制限に達しました。${retryAfter}秒待機します... (試行 ${attempt}/${NOTION_API.RETRY_ATTEMPTS})`);
        Utilities.sleep(retryAfter * 1000);
        lastError = new Error(`Notion API エラー (${responseCode}): ${responseText}`);
        continue;
      } else {
        throw new Error(`Notion API エラー (${responseCode}): ${responseText}`);
      }
    } catch (error) {
      lastError = error;
      if (attempt < NOTION_API.RETRY_ATTEMPTS) {
        const delay = NOTION_API.RETRY_DELAY_MS * attempt;
        console.warn(`Notion API呼び出しエラー。${delay}ms後に再試行します... (試行 ${attempt}/${NOTION_API.RETRY_ATTEMPTS})`);
        Utilities.sleep(delay);
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
 * Google Driveからユーザーマッピングファイルを読み込み
 * キャッシュ機能付き（24時間）
 */
function loadUserMappingFromDrive(fileId) {
  // キャッシュ確認
  const cacheKey = CONSTANTS.USER_MAPPING_CACHE_KEY;
  const cached = PropertiesService.getScriptProperties().getProperty(cacheKey);
  if (cached) {
    try {
      const cacheData = JSON.parse(cached);
      const now = Date.now();
      if (now - cacheData.timestamp < CONSTANTS.USER_MAPPING_CACHE_TTL_MS) {
        console.log('ユーザーマッピングをキャッシュから読み込み');
        return cacheData.mapping;
      }
    } catch (e) {
      console.warn('キャッシュの解析に失敗しました。ファイルから再読み込みします。');
    }
  }
  
  // ファイルを読み込み
  try {
    const file = DriveApp.getFileById(fileId);
    const content = file.getBlob().getDataAsString();
    
    // Markdownテーブルをパース
    const lines = content.split('\n');
    const mapping = {};
    
    // ヘッダー行をスキップ（2行目まで）
    for (let i = 2; i < lines.length; i++) {
      const line = lines[i].trim();
      if (!line || line.startsWith('|---')) continue;
      
      const columns = line.split('|').map(col => col.trim()).filter(col => col);
      if (columns.length >= 6) {
        // 列構造: 名前 | slack表示名 | ハンドル | メールアドレス | Notionユーザー名 | NotionユーザーID | SlackユーザーID | ...
        // 注意: 最初の空列を除くと、インデックスは0から始まる
        // 例: |名前|slack表示名|... の場合、split('|')すると['', '名前', 'slack表示名', ...]
        // そのため、filterで空文字を削除すると ['名前', 'slack表示名', ...]
        // 実際の列位置: 
        // - columns[0]: 名前
        // - columns[1]: slack表示名
        // - columns[2]: ハンドル
        // - columns[3]: メールアドレス
        // - columns[4]: Notionユーザー名
        // - columns[5]: NotionユーザーID
        // - columns[6]: SlackユーザーID
        const email = columns[3]; // メールアドレス（4列目、インデックス3）
        const notionUserId = columns[5]; // NotionユーザーID（6列目、インデックス5）
        
        if (email && notionUserId) {
          mapping[notionUserId] = email;
        }
      }
    }
    
    // キャッシュに保存
    const cacheData = {
      timestamp: Date.now(),
      mapping: mapping
    };
    PropertiesService.getScriptProperties().setProperty(cacheKey, JSON.stringify(cacheData));
    
    console.log(`ユーザーマッピングを読み込みました（${Object.keys(mapping).length}件）`);
    return mapping;
  } catch (error) {
    console.error('ユーザーマッピングファイルの読み込みエラー:', error);
    throw new Error(`ユーザーマッピングファイルの読み込みに失敗しました: ${error.message}`);
  }
}

/**
 * NotionユーザーIDからメールアドレスを取得
 */
function getUserEmailByNotionId(notionUserId, userMapping) {
  return userMapping[notionUserId] || null;
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
 * 日付のみを比較（時間部分を無視）
 */
function compareDatesOnly(date1, date2) {
  const d1 = new Date(date1);
  const d2 = new Date(date2);
  d1.setHours(0, 0, 0, 0);
  d2.setHours(0, 0, 0, 0);
  return d1.getTime() === d2.getTime();
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
  const titleProp = page.properties[NOTION_PROP.RELEASE_TITLE] || page.properties[NOTION_PROP.PRODUCT_NAME] || page.properties[NOTION_PROP.ISSUE_NAME] || page.properties[NOTION_PROP.TASK_NAME];
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
 * イベント説明文を生成
 */
function generateEventDescription(releasePageId, issuePageIds = []) {
  const releaseUrl = getNotionPageUrl(releasePageId);
  let description = `リリース情報: ${releaseUrl}\n\n`;
  
  if (issuePageIds && issuePageIds.length > 0) {
    description += '関連Issue:\n';
    issuePageIds.forEach(issueId => {
      const issueUrl = getNotionPageUrl(issueId);
      description += `- ${issueUrl}\n`;
    });
  }
  
  return description;
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
  
  // リリース日が設定されているリリースを取得
  const filter = {
    and: [
      {
        property: NOTION_PROP.RELEASE_DATE,
        date: {
          is_not_empty: true
        }
      },
      {
        property: NOTION_PROP.RELEASE_PRODUCTS,
        relation: {
          contains: productIds
        }
      }
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
  
  const issueRelation = release.properties[NOTION_PROP.RELEASE_ISSUES]?.relation || [];
  console.log(`「${NOTION_PROP.RELEASE_ISSUES}」プロパティ:`, release.properties[NOTION_PROP.RELEASE_ISSUES]);
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
 */
function getTasksAndAssignees(issues) {
  const assigneeNotionUserIds = new Set();
  
  if (issues.length === 0) {
    console.log(`[getTasksAndAssignees] Issueが0件のため、Taskを取得できません`);
    return Array.from(assigneeNotionUserIds);
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
              assigneeNotionUserIds.add(person.id);
              console.log(`  担当者を追加: ${person.name || person.id}`);
            }
          });
        }
        
        Utilities.sleep(200); // レート制限回避
      } catch (error) {
        console.warn(`Task取得エラー (${taskId}):`, error);
      }
    }
  }
  
  return Array.from(assigneeNotionUserIds);
}

/**
 * タスクが「実装」に関連するかどうかを判定
 */
function isImplementationRelatedTask(task) {
  // 1. Issue大分類をチェック（rollupプロパティから）
  const issueCategoryProp = task.properties[NOTION_PROP.TASK_ISSUE_CATEGORY];
  if (issueCategoryProp && issueCategoryProp.rollup && issueCategoryProp.rollup.array) {
    const categories = issueCategoryProp.rollup.array;
    for (const categoryItem of categories) {
      if (categoryItem && categoryItem.select) {
        const categoryName = categoryItem.select.name || '';
        // 「実装」「プロダクト開発」など実装関連のカテゴリをチェック
        if (categoryName.includes('実装') || 
            categoryName.includes('プロダクト開発') ||
            categoryName.includes('開発')) {
          return true;
        }
      }
    }
  }
  
  // 2. タスク名に「実装」が含まれるかチェック
  const taskTitle = getPageTitle(task);
  if (taskTitle.includes('実装') || 
      taskTitle.includes('開発') ||
      taskTitle.toLowerCase().includes('implement') ||
      taskTitle.toLowerCase().includes('development')) {
    return true;
  }
  
  // 3. すべてのタスクを含める（フィルタリングしない）
  // 実装関連の判定ができない場合、安全のためすべてのタスクを含める
  // コメントアウト: return false;
  return true; // 暫定的にすべてのタスクを含める
}

/**
 * NotionユーザーIDの配列をメールアドレスの配列に変換
 */
function convertNotionUserIdsToEmails(notionUserIds, userMapping, excludeEmails = []) {
  const emails = [];
  for (const notionUserId of notionUserIds) {
    const email = getUserEmailByNotionId(notionUserId, userMapping);
    if (email && !excludeEmails.includes(email)) {
      emails.push(email);
    } else if (!email) {
      console.warn(`メールアドレスが見つかりません: NotionユーザーID=${notionUserId}`);
    }
  }
  return emails;
}


/**
 * ログファイルからイベントIDログファイルを取得または作成
 * @returns {GoogleAppsScript.Drive.File} ログファイル
 */
function getOrCreateEventLogFile() {
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
      console.log(`[getOrCreateEventLogFile] ログファイルを新規作成: ${fileName}`);
      return newFile;
    }
  } catch (error) {
    console.error(`[getOrCreateEventLogFile] ログファイル取得エラー:`, error);
    throw new Error(`ログファイルの取得に失敗しました: ${error.message}`);
  }
}

/**
 * ログファイルからイベントIDを取得
 * @param {string} releaseId - リリースID
 * @param {string} executorNotionUserId - 実行者のNotionユーザーID
 * @returns {string|null} イベントID
 */
function getEventIdFromLog(releaseId, executorNotionUserId) {
  try {
    const logFile = getOrCreateEventLogFile();
    const content = logFile.getBlob().getDataAsString();
    
    if (!content || content.trim() === '') {
      console.log(`[getEventIdFromLog] ログファイルが空です`);
      return null;
    }
    
    // JSON Lines形式をパース
    const lines = content.trim().split('\n').filter(line => line.trim());
    
    // 最新のレコードから検索（最後の行から逆順）
    for (let i = lines.length - 1; i >= 0; i--) {
      try {
        const record = JSON.parse(lines[i]);
        if (record.releaseId === releaseId && record.executorNotionUserId === executorNotionUserId) {
          console.log(`[getEventIdFromLog] イベントIDを発見: ${record.eventId}`);
          return record.eventId;
        }
      } catch (e) {
        console.warn(`[getEventIdFromLog] 行のパースエラー (${i}):`, e);
      }
    }
    
    console.log(`[getEventIdFromLog] イベントIDが見つかりませんでした`);
    return null;
  } catch (error) {
    console.warn(`[getEventIdFromLog] ログファイル読み込みエラー:`, error);
    return null;
  }
}

/**
 * ログファイルにイベントIDを保存
 * @param {string} releaseId - リリースID
 * @param {string} eventId - イベントID
 * @param {string} executorNotionUserId - 実行者のNotionユーザーID
 */
function saveEventIdToLog(releaseId, eventId, executorNotionUserId) {
  try {
    const logFile = getOrCreateEventLogFile();
    const now = new Date();
    const timestamp = Utilities.formatDate(now, CONSTANTS.TIME.TIMEZONE, "yyyy-MM-dd'T'HH:mm:ssXXX");
    
    // JSON Lines形式で追記
    const record = {
      releaseId: releaseId,
      executorNotionUserId: executorNotionUserId,
      eventId: eventId,
      timestamp: timestamp
    };
    
    const line = JSON.stringify(record) + '\n';
    logFile.append(line);
    console.log(`[saveEventIdToLog] イベントIDをログファイルに保存: ${eventId}`);
  } catch (error) {
    console.error(`[saveEventIdToLog] ログファイル保存エラー:`, error);
    // エラーが発生しても処理は継続（カレンダーイベント自体は作成済みのため）
  }
}

/**
 * ログファイルからイベントIDを削除（リリース日削除時など）
 * @param {string} releaseId - リリースID
 * @param {string} executorNotionUserId - 実行者のNotionユーザーID
 */
function deleteEventIdFromLog(releaseId, executorNotionUserId) {
  try {
    const logFile = getOrCreateEventLogFile();
    const content = logFile.getBlob().getDataAsString();
    
    if (!content || content.trim() === '') {
      return;
    }
    
    // JSON Lines形式をパースして、該当レコードを除外
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
        // パースエラーは保持
        filteredLines.push(line);
      }
    }
    
    // ファイルを書き直し
    const newContent = filteredLines.length > 0 ? filteredLines.join('\n') + '\n' : '';
    logFile.setContent(newContent);
    console.log(`[deleteEventIdFromLog] イベントIDをログファイルから削除`);
  } catch (error) {
    console.warn(`[deleteEventIdFromLog] ログファイル削除エラー:`, error);
  }
}

/**
 * Notion DBにイベントIDを保存
 * 複数の実行者が存在する場合を考慮して、JSON形式で管理
 */
function saveEventIdToNotion(releaseId, eventId, executorNotionUserId) {
  try {
    // 既存のイベントIDを取得
    const existingEventId = getEventIdFromNotion(releaseId);
    
    let eventIdValue;
    if (existingEventId && typeof existingEventId === 'object') {
      // 既にJSON形式で複数の実行者が存在する場合
      existingEventId[executorNotionUserId] = eventId;
      eventIdValue = JSON.stringify(existingEventId);
    } else if (existingEventId) {
      // 既存のイベントIDが単一のテキストの場合、JSON形式に変換
      // 既存の実行者IDは不明のため、'unknown'として保存
      eventIdValue = JSON.stringify({
        'unknown': existingEventId,
        [executorNotionUserId]: eventId
      });
    } else {
      // 新規作成の場合、実行者のIDとイベントIDを保存
      eventIdValue = JSON.stringify({
        [executorNotionUserId]: eventId
      });
    }
    
    // Notionページを更新
    const updateBody = {
      properties: {
        [NOTION_PROP.RELEASE_CALENDAR_EVENT_ID]: {
          rich_text: [
            {
              text: {
                content: eventIdValue
              }
            }
          ]
        }
      }
    };
    
    console.log(`[saveEventIdToNotion] 更新リクエスト送信:`, JSON.stringify(updateBody, null, 2));
    const response = callNotionAPI(`/pages/${releaseId}`, 'PATCH', updateBody);
    console.log(`[saveEventIdToNotion] 更新レスポンス:`, JSON.stringify(response, null, 2));
    console.log(`Notion DBにイベントIDを保存しました: ${releaseId}`);
  } catch (error) {
    console.warn(`Notion DBへのイベントID保存エラー (${releaseId}):`, error);
    // エラーが発生しても処理は継続（カレンダーイベント自体は作成済みのため）
    // 403エラーの場合、Notion IntegrationにリリースDBの「更新」権限が必要です
    if (error.message && error.message.includes('403')) {
      console.error('⚠️ Notion IntegrationにリリースDBの「更新」権限を付与してください');
    }
  }
}

/**
 * Notion DBからイベントIDを削除
 * 実行者のNotionユーザーIDに紐づくイベントIDのみを削除
 */
function deleteEventIdFromNotion(releaseId, executorNotionUserId) {
  try {
    const existingEventId = getEventIdFromNotion(releaseId);
    
    if (!existingEventId) {
      // 既に削除されている
      return;
    }
    
    if (typeof existingEventId === 'object' && existingEventId[executorNotionUserId]) {
      // JSON形式で複数の実行者が存在する場合、該当実行者のみ削除
      delete existingEventId[executorNotionUserId];
      
      const remainingKeys = Object.keys(existingEventId);
      if (remainingKeys.length > 0) {
        // 他の実行者が存在する場合は、残りの実行者を保存
        const updateBody = {
          properties: {
            [NOTION_PROP.RELEASE_CALENDAR_EVENT_ID]: {
              rich_text: [
                {
                  text: {
                    content: JSON.stringify(existingEventId)
                  }
                }
              ]
            }
          }
        };
        callNotionAPI(`/pages/${releaseId}`, 'PATCH', updateBody);
        console.log(`Notion DBのイベントIDから実行者の情報を削除しました: ${releaseId}`);
      } else {
        // すべての実行者が削除された場合、プロパティをクリア
        const updateBody = {
          properties: {
            [NOTION_PROP.RELEASE_CALENDAR_EVENT_ID]: {
              rich_text: []
            }
          }
        };
        callNotionAPI(`/pages/${releaseId}`, 'PATCH', updateBody);
        console.log(`Notion DBのイベントIDプロパティをクリアしました: ${releaseId}`);
      }
    } else {
      // 単一のイベントIDの場合、プロパティをクリア
      const updateBody = {
        properties: {
          [NOTION_PROP.RELEASE_CALENDAR_EVENT_ID]: {
            rich_text: []
          }
        }
      };
      callNotionAPI(`/pages/${releaseId}`, 'PATCH', updateBody);
      console.log(`Notion DBのイベントIDプロパティをクリアしました: ${releaseId}`);
    }
  } catch (error) {
    console.warn(`Notion DBからのイベントID削除エラー (${releaseId}):`, error);
    // エラーが発生しても処理は継続
  }
}

/**
 * Notion DBから実行者のイベントIDを取得
 */
function getExecutorEventIdFromNotion(releaseId, executorNotionUserId) {
  const eventIdData = getEventIdFromNotion(releaseId);
  
  if (!eventIdData) {
    return null;
  }
  
  if (typeof eventIdData === 'object') {
    // JSON形式の場合、実行者のIDに対応するイベントIDを返す
    return eventIdData[executorNotionUserId] || null;
  } else {
    // 単一のテキストの場合、そのまま返す（後方互換性のため）
    return eventIdData;
  }
}

/**
 * Googleカレンダーイベントを作成
 */
function createCalendarEvent(release, executorEmail, taskAssigneeEmails) {
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
  
  const title = `${CONSTANTS.CALENDAR.EVENT_TITLE_PREFIX}${releaseTitle}`;
  
  // Issueを取得して説明文を生成
  const issues = getIssuesForRelease(release);
  const issueIds = issues.map(issue => issue.id);
  const description = generateEventDescription(release.id, issueIds);
  
  // ゲストリスト（実行者 + Task担当者、重複排除）
  const guests = [executorEmail, ...taskAssigneeEmails];
  const uniqueGuests = [...new Set(guests)];
  
  console.log(`イベント作成: ${title}, 日時: ${Utilities.formatDate(startDate, CONSTANTS.TIME.TIMEZONE, 'yyyy-MM-dd HH:mm')}, ゲスト数: ${uniqueGuests.length}`);
  
  const event = calendar.createEvent(
    title,
    startDate,
    endDate,
    {
      description: description,
      guests: uniqueGuests.join(','),
      sendInvites: true
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
          const notionEventId = getExecutorEventIdFromNotion(releaseId, executorNotionUserId);
          
          if (notionEventId) {
            console.log(`リリース日が未設定のため、イベントを削除します: ${releaseTitle} (${notionEventId})`);
            deleteCalendarEvent(notionEventId);
            deleteEventIdFromNotion(releaseId, executorNotionUserId);
          }
          continue;
        }
        
        const releaseDate = new Date(releaseDateProp.start);
        // Notion DBからイベントIDを取得
        const notionEventId = getExecutorEventIdFromNotion(releaseId, executorNotionUserId);
        
        if (notionEventId) {
          // 既存イベントがある場合、日付を確認して更新
          console.log(`既存イベントを確認中: ${releaseTitle} (${notionEventId})`);
          
          try {
            const calendar = CONFIG.CALENDAR_ID 
              ? CalendarApp.getCalendarById(CONFIG.CALENDAR_ID)
              : CalendarApp.getDefaultCalendar();
            const event = calendar.getEventById(notionEventId);
            const currentEventDate = event.getStartTime();
            
            if (!compareDatesOnly(currentEventDate, releaseDate)) {
              // 日付が異なる場合、更新
              console.log(`リリース日が変更されました: ${releaseTitle}, 旧日付: ${getJSTDate(currentEventDate)}, 新日付: ${getJSTDate(releaseDate)}`);
              const updated = updateCalendarEvent(notionEventId, releaseDate);
              if (!updated) {
                // イベントが見つからない場合（手動削除など）、新規作成
                console.log(`イベントが見つかりません。新規作成します。`);
                throw new Error('イベントが見つかりません');
              }
            } else {
              console.log(`リリース日は変更されていません: ${releaseTitle}`);
            }
          } catch (error) {
            // イベントが見つからない場合（手動削除など）、新規作成
            console.log(`イベントが見つかりません（ID: ${notionEventId}）。新規作成します。`);
            
            // IssueとTaskを取得して担当者を抽出
            const issues = getIssuesForRelease(release);
            const assigneeNotionUserIds = getTasksAndAssignees(issues);
            const taskAssigneeEmails = convertNotionUserIdsToEmails(assigneeNotionUserIds, userMapping, [executorEmail]);
            
            // 新規イベントを作成
            const newEventId = createCalendarEvent(release, executorEmail, taskAssigneeEmails);
            // Notion DBに保存
            saveEventIdToNotion(releaseId, newEventId, executorNotionUserId);
          }
        } else {
          // 新規イベントを作成
          console.log(`新規イベントを作成します: ${releaseTitle}`);
          
          // IssueとTaskを取得して担当者を抽出
          const issues = getIssuesForRelease(release);
          const assigneeNotionUserIds = getTasksAndAssignees(issues);
          const taskAssigneeEmails = convertNotionUserIdsToEmails(assigneeNotionUserIds, userMapping, [executorEmail]);
          
          // イベントを作成
          const eventId = createCalendarEvent(release, executorEmail, taskAssigneeEmails);
          // Notion DBに保存
          saveEventIdToNotion(releaseId, eventId, executorNotionUserId);
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
    
    // 最初のリリースを処理
    const targetRelease = releases[0];
    const releaseId = targetRelease.id;
    const releaseTitle = getPageTitle(targetRelease);
    const releaseDateProp = targetRelease.properties[NOTION_PROP.RELEASE_DATE]?.date;
    
    if (!releaseDateProp || !releaseDateProp.start) {
      throw new Error('リリース日が設定されていません');
    }
    
    console.log(`\n========== 処理対象リリース ==========`);
    console.log(`リリース名: ${releaseTitle}`);
    console.log(`リリースID: ${releaseId}`);
    console.log(`リリース日: ${releaseDateProp.start}`);
    console.log(`=====================================\n`);
    
    // 既存のイベントIDを確認（Notion DBから取得）
    const notionEventId = getExecutorEventIdFromNotion(releaseId, executorNotionUserId);
    
    if (notionEventId) {
      console.log(`⚠️  既存のイベントIDが見つかりました: ${notionEventId}`);
      console.log('既存のままで終了します。再作成したい場合は、Notion DBのカレンダーイベントIDプロパティから削除してください。');
      return;
    }
    
    // IssueとTaskを取得して担当者を抽出
    console.log('IssueとTaskを取得中...');
    const issues = getIssuesForRelease(targetRelease);
    console.log(`Issue数: ${issues.length}件`);
    
    if (issues.length > 0) {
      issues.forEach((issue, index) => {
        const issueTitle = getPageTitle(issue);
        console.log(`  ${index + 1}. ${issueTitle}`);
      });
    }
    
    const assigneeNotionUserIds = getTasksAndAssignees(issues);
    console.log(`\nTask担当者（NotionユーザーID）数: ${assigneeNotionUserIds.length}件`);
    
    const taskAssigneeEmails = convertNotionUserIdsToEmails(assigneeNotionUserIds, userMapping, [executorEmail]);
    console.log(`Task担当者（メールアドレス）数: ${taskAssigneeEmails.length}件`);
    if (taskAssigneeEmails.length > 0) {
      taskAssigneeEmails.forEach(email => {
        console.log(`  - ${email}`);
      });
    } else {
      console.log('  （Task担当者が見つかりませんでした）');
    }
    
    // ゲストリスト（実行者 + Task担当者）
    const allGuests = [executorEmail, ...taskAssigneeEmails];
    const uniqueGuests = [...new Set(allGuests)];
    console.log(`\n招待ゲスト（重複排除済み）: ${uniqueGuests.length}人`);
    uniqueGuests.forEach(email => {
      console.log(`  - ${email}`);
    });
    
    // カレンダーイベントを作成
    console.log('\n========== カレンダーイベント作成中 ==========');
    const eventId = createCalendarEvent(targetRelease, executorEmail, taskAssigneeEmails);
    
    // イベントIDをNotion DBに保存
    saveEventIdToNotion(releaseId, eventId, executorNotionUserId);
    
    console.log('\n✅ ========== カレンダーイベント作成完了！ ==========');
    console.log(`イベントID: ${eventId}`);
    console.log(`リリース: ${releaseTitle}`);
    console.log(`日時: ${releaseDateProp.start} 12:00-13:00 JST`);
    console.log(`招待ゲスト数: ${uniqueGuests.length}人`);
    console.log('=============================================');
    
  } catch (error) {
    console.error('\n❌ テスト実行エラー:', error);
    throw error;
  }
}

