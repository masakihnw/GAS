/**
 * 個人タスク通知ボット - 花輪 真輝用（GAS × Notion × Slack）
 * 要件定義に基づく実装（リファクタリング版）
 * 
 * このファイルは clasp push の動作確認用です。
 * 実際の開発コードは一時的にここで作成し、動作確認後に個人プロジェクトに移行してください。
 * 
 * 開発完了後は、このファイルを空の状態に戻してください。
 */

// Script Properties
const SP = PropertiesService.getScriptProperties();

/**
 * 環境設定（Script Propertiesから読み込み）
 */
const ENV = {
  NOTION_API_TOKEN: SP.getProperty('NOTION_API_TOKEN') || '',
  NOTION_TASK_DB_ID: SP.getProperty('NOTION_TASK_DB_ID') || '',
  SLACK_BOT_TOKEN: SP.getProperty('SLACK_BOT_TOKEN') || '',
  NOTION_USER_ID: SP.getProperty('NOTION_USER_ID') || '',
  SLACK_USER_ID: SP.getProperty('SLACK_USER_ID') || '',
  SLACK_CHANNEL_ID: SP.getProperty('SLACK_CHANNEL_ID') || '',
  ISSUE_PROP_NAME: SP.getProperty('ISSUE_PROP_NAME') || 'Issue',
  PRODUCT_PROP_NAME: SP.getProperty('PRODUCT_PROP_NAME') || 'Product',
  PROJECT_PROP_NAME: SP.getProperty('PROJECT_PROP_NAME') || 'Project'
};

/**
 * Notionプロパティ名の定数
 */
const NOTION_PROP = {
  TASK_NAME: '名前',
  TASK_STATUS: 'Taskステータス',
  TASK_DUE_DATE: 'Task期限',
  TASK_ASSIGNEE: '担当者'
};

/**
 * Slack API関連の定数
 */
const SLACK_API = {
  BASE_URL: 'https://slack.com/api',
  CHAT_POST_MESSAGE: '/chat.postMessage',
  CONVERSATIONS_JOIN: '/conversations.join',
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000
};

/**
 * アプリケーション定数
 */
const CONSTANTS = {
  NOTION: {
    PAGE_SIZE: 100,
    API_VERSION: '2022-06-28'
  },
  STATUS: {
    COMPLETED: '完了',
    CANCELLED: 'キャンセル',
    BACKLOG: 'バックログ',
    EXECUTION_COMPLETED: '実行完了'
  }
};

/**
 * 設定値の検証
 */
function validateConfig() {
  const requiredKeys = ['NOTION_API_TOKEN', 'NOTION_TASK_DB_ID', 'SLACK_BOT_TOKEN', 
                        'NOTION_USER_ID', 'SLACK_USER_ID', 'SLACK_CHANNEL_ID'];
  const missingKeys = requiredKeys.filter(key => !ENV[key]);
  
  if (missingKeys.length > 0) {
    throw new Error(`スクリプトプロパティが設定されていません: ${missingKeys.join(', ')}`);
  }
  
  console.log('設定値の検証完了');
}

/**
 * JST時間正規化のユーティリティ関数
 */
function getJSTDate(date = new Date()) {
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
 * 今週の土曜日を取得（JST）
 */
function getJSTThisWeekSaturday() {
  const today = new Date();
  const dayOfWeek = today.getDay();
  
  // 今日が何曜日か（0=日曜日, 6=土曜日）
  // 今週の土曜日までの日数を計算
  const daysUntilSaturday = 6 - dayOfWeek;
  const saturday = new Date(today);
  saturday.setDate(today.getDate() + daysUntilSaturday);
  
  return getJSTDate(saturday);
}

/**
 * JST日付文字列をエポック時間に変換
 */
function toJstEpoch(dateStr) {
  if (!dateStr) return Number.POSITIVE_INFINITY;
  
  let dateOnly = dateStr;
  if (dateStr.includes('T')) {
    dateOnly = dateStr.split('T')[0];
  }
  
  const testDate = new Date(dateOnly + 'T00:00:00+09:00');
  if (isNaN(testDate.getTime())) {
    console.warn(`無効な日付形式: ${dateStr}`);
    return Number.POSITIVE_INFINITY;
  }
  
  return testDate.getTime();
}

/**
 * 日付を相対表記に変換
 */
function formatRelativeDate(dateString) {
  if (!dateString) return '期限なし';
  
  let dateOnly = dateString;
  if (dateString.includes('T')) {
    dateOnly = dateString.split('T')[0];
  }
  
  const testDate = new Date(dateOnly + 'T00:00:00+09:00');
  if (isNaN(testDate.getTime())) {
    console.warn(`無効な日付形式: ${dateString}`);
    return '期限なし';
  }
  
  const todayStr = getJSTToday();
  const toMs = s => new Date(s + 'T00:00:00+09:00').getTime();
  const diffDays = Math.round((toMs(dateOnly) - toMs(todayStr)) / (1000 * 60 * 60 * 24));
  const d = new Date(dateOnly + 'T00:00:00+09:00');
  const weekdays = ['日','月','火','水','木','金','土'];
  const label = `${d.getMonth()+1}/${d.getDate()}(${weekdays[d.getDay()]})`;
  
  if (diffDays === 0) return `今日 ${label}`;
  if (diffDays === 1) return `明日 ${label}`;
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
    const events = CalendarApp.getCalendarById(calendarId).getEvents(startDate, endDate);
    
    const holidays = [];
    events.forEach(event => {
      const eventDate = event.getStartTime();
      const dateStr = Utilities.formatDate(eventDate, 'Asia/Tokyo', 'yyyy-MM-dd');
      holidays.push(dateStr);
    });
    
    console.log(`${year}年の祝日数: ${holidays.length}件`);
    return holidays;
  } catch (error) {
    console.warn('祝日取得エラー:', error);
    return [];
  }
}

/**
 * 通知しない日かどうかを判定（週末・祝日・年末年始）
 */
function shouldSkipNotification() {
  const today = new Date();
  const todayStr = getJSTToday();
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
  
  return false;
}

/**
 * 二重送信防止: 今日の通知実行済みフラグキーを取得
 */
function getTodayKey() {
  return `NOTIFIED_AT_${getJSTToday()}`;
}

/**
 * 二重送信防止: 今日既に通知済みかチェック
 */
function hasNotifiedToday() {
  return SP.getProperty(getTodayKey()) === 'done';
}

/**
 * 二重送信防止: 今日の通知実行済みフラグを立てる
 */
function markNotifiedToday() {
  SP.setProperty(getTodayKey(), 'done');
  console.log('本日の通知実行済みフラグを設定しました');
}

/**
 * エラー通知をSlackに送信（標準化版）
 */
function notifyErrorToSlack(where, error) {
  const when = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  const errorDetail = error && (error.stack || error.message || error);
  const text = `:warning: *エラー* @${where}\n• 時刻: ${when}\n• 詳細: ${errorDetail}`;
  
  try {
    postSlackMessage(ENV.SLACK_CHANNEL_ID, [
      { type: 'section', text: { type: 'mrkdwn', text } }
    ], 'エラー通知');
  } catch (e) {
    console.error('エラー通知失敗:', e);
  }
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
          'Authorization': `Bearer ${ENV.NOTION_API_TOKEN}`,
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
 * 部分継続: カテゴリ単位でタスクを安全に取得
 */
function safeFetchTasks(filterObj, label) {
  try {
    const pages = notionQueryAll(ENV.NOTION_TASK_DB_ID, filterObj);
    return pages.map(parseTask).filter(Boolean);
  } catch (e) {
    notifyErrorToSlack(`getPersonalTasks:${label}`, e);
    return [];
  }
}

/**
 * Notionページをタスクオブジェクトに変換（プロジェクト名対応）
 */
function parseTask(page) {
  // タスク名を取得
  let title = 'タイトルなし';
  const nameProperty = page.properties[NOTION_PROP.TASK_NAME];
  
  if (nameProperty?.title && Array.isArray(nameProperty.title)) {
    title = nameProperty.title.map(item => {
      if (item.text) {
        return item.text.content || '';
      } else if (item.mention) {
        if (item.mention.date) {
          const dateStr = item.mention.date.start;
          return `@${dateStr}`;
        }
      }
      return '';
    }).join('');
  }
  
  const status = page.properties[NOTION_PROP.TASK_STATUS]?.status?.name || 'ステータスなし';
  const dueDate = page.properties[NOTION_PROP.TASK_DUE_DATE]?.date?.start || '';
  
  // プロパティから名前を抽出するヘルパー関数
  const extractName = (prop, propType) => {
    if (!prop) {
      console.log(`  プロパティ ${propType}: 未定義`);
      return '';
    }
    if (prop.select?.name) {
      console.log(`  プロパティ ${propType}: select型 = ${prop.select.name}`);
      return prop.select.name;
    }
    if (prop.relation?.length) {
      console.log(`  プロパティ ${propType}: relation型（${prop.relation.length}件）`);
      return '(関連)';
    }
    if (prop.rich_text?.length) {
      const text = prop.rich_text.map(t => t.plain_text || '').join('');
      console.log(`  プロパティ ${propType}: rich_text型 = ${text}`);
      return text;
    }
    if (prop.title?.length) {
      const text = prop.title.map(t => t.plain_text || '').join('');
      console.log(`  プロパティ ${propType}: title型 = ${text}`);
      return text;
    }
    console.log(`  プロパティ ${propType}: 型が不明 - ${Object.keys(prop).join(', ')}`);
    return '';
  };
  
  // Issue名を取得（グループ化用）
  console.log(`タスク "${title}" のプロパティを取得中...`);
  console.log(`  利用可能なプロパティ名: ${Object.keys(page.properties || {}).join(', ')}`);
  console.log(`  設定されたプロパティ名: Issue="${ENV.ISSUE_PROP_NAME}", Product="${ENV.PRODUCT_PROP_NAME}", Project="${ENV.PROJECT_PROP_NAME}"`);
  
  const issueNameProp = extractName(page.properties?.[ENV.ISSUE_PROP_NAME], 'Issue');
  const issueName = issueNameProp || '(Issueなし)';
  
  // Product > Project の優先順位で名前を取得（表示用）
  const productName = extractName(page.properties?.[ENV.PRODUCT_PROP_NAME], 'Product');
  const projectName = extractName(page.properties?.[ENV.PROJECT_PROP_NAME], 'Project');
  const productOrProject = productName || projectName || '';
  
  console.log(`  結果: issueName="${issueName}", productOrProject="${productOrProject}"`);
  
  // Notionリンクを生成
  const notionLink = `https://www.notion.so/${page.id.replace(/-/g, '')}`;
  
  return {
    id: page.id,
    title: title,
    status: status,
    dueDate: dueDate,
    notionLink: notionLink,
    issueName: issueName,
    productOrProject: productOrProject
  };
}

/**
 * Slackチャンネルに参加
 */
function ensureJoinChannel(channelId) {
  try {
    const res = UrlFetchApp.fetch(`${SLACK_API.BASE_URL}${SLACK_API.CONVERSATIONS_JOIN}`, {
      method: 'post',
      headers: {
        'Authorization': `Bearer ${ENV.SLACK_BOT_TOKEN}`,
        'Content-Type': 'application/json'
      },
      payload: JSON.stringify({ channel: channelId }),
      muteHttpExceptions: true
    });
    const data = JSON.parse(res.getContentText() || '{}');
    if (!data.ok && !['already_in_channel', 'method_not_supported_for_channel_type'].includes(data.error)) {
      console.warn('conversations.join 失敗:', data.error);
    }
  } catch (e) {
    console.warn('conversations.join 例外:', e);
  }
}

/**
 * Slackメッセージを投稿（リトライ機能付き・チャンネル参加対応）
 */
function postSlackMessage(channel, blocks, debugLabel) {
  const payload = { channel, blocks };
  const doPost = () => UrlFetchApp.fetch(`${SLACK_API.BASE_URL}${SLACK_API.CHAT_POST_MESSAGE}`, {
    method: 'post',
    headers: {
      'Authorization': `Bearer ${ENV.SLACK_BOT_TOKEN}`,
      'Content-Type': 'application/json'
    },
    payload: JSON.stringify(payload),
    muteHttpExceptions: true
  });

  let res = doPost();
  let data = JSON.parse(res.getContentText() || '{}');
  if (!data.ok && ['channel_not_found', 'not_in_channel'].includes(data.error)) {
    ensureJoinChannel(channel);
    res = doPost();
    data = JSON.parse(res.getContentText() || '{}');
  }
  if (!data.ok) {
    console.error(`Slack送信失敗(${debugLabel}):`, data.error, res.getContentText());
          return false;
      }
  return true;
}

/**
 * タスクのSlack表示行を生成
 */
function lineOf(task) {
  const productOrProject = task.productOrProject ? `／ ${task.productOrProject}` : '';
  return `• <${task.notionLink}|${task.title}>（${formatRelativeDate(task.dueDate)} ${task.status}${productOrProject}）`;
}

/**
 * 花輪 真輝のタスクを3種類取得（期限切れ/今日/今週） - 部分継続対応
 */
function getPersonalTasks() {
  const today = getJSTToday();
  const saturday = getJSTThisWeekSaturday();
  
  // 共通のベースフィルタ
  const baseAnd = [
    { property: NOTION_PROP.TASK_ASSIGNEE, people: { contains: ENV.NOTION_USER_ID } },
    { property: NOTION_PROP.TASK_STATUS, status: { does_not_equal: CONSTANTS.STATUS.COMPLETED } },
    { property: NOTION_PROP.TASK_STATUS, status: { does_not_equal: CONSTANTS.STATUS.CANCELLED } },
    { property: NOTION_PROP.TASK_STATUS, status: { does_not_equal: CONSTANTS.STATUS.BACKLOG } },
    { property: NOTION_PROP.TASK_STATUS, status: { does_not_equal: CONSTANTS.STATUS.EXECUTION_COMPLETED } }
  ];

  // 期限切れタスク（昨日までの期限）
  const overdue = safeFetchTasks({ filter: { and: [
    ...baseAnd,
    { property: NOTION_PROP.TASK_DUE_DATE, date: { before: today } },
    { property: NOTION_PROP.TASK_DUE_DATE, date: { is_not_empty: true } }
  ]}}, 'overdue');

  // 今日期限タスク（今日が期限）
  const todayTasks = safeFetchTasks({ filter: { and: [
    ...baseAnd,
    { property: NOTION_PROP.TASK_DUE_DATE, date: { equals: today } }
  ]}}, 'today');

  // 今週期限タスク（明日以降で今週末まで）
  const thisWeek = safeFetchTasks({ filter: { and: [
    ...baseAnd,
    { property: NOTION_PROP.TASK_DUE_DATE, date: { after: today } },
    { property: NOTION_PROP.TASK_DUE_DATE, date: { on_or_before: saturday } }
  ]}}, 'thisWeek');

  // 全カテゴリで期限昇順ソート
  const asc = (a, b) => toJstEpoch(a.dueDate) - toJstEpoch(b.dueDate);
  
  return {
    overdue: overdue.sort(asc),
    today: todayTasks.sort(asc),
    thisWeek: thisWeek.sort(asc)
  };
}

/**
 * Issue（プロダクト名/プロジェクト名）でタスクをグループ化
 */
function groupTasksByIssue(tasks) {
  const allTasks = [...tasks.overdue, ...tasks.today, ...tasks.thisWeek];
  const issueGroups = {};
  
  allTasks.forEach(task => {
    const issueKey = task.issueName || '(Issueなし)';
    if (!issueGroups[issueKey]) {
      issueGroups[issueKey] = { overdue: [], today: [], thisWeek: [] };
    }
    
    // タスクがどのカテゴリに属するか判定
    const todayStr = getJSTToday();
    const toMs = s => new Date(s + 'T00:00:00+09:00').getTime();
    const dueDateOnly = task.dueDate.includes('T') ? task.dueDate.split('T')[0] : task.dueDate;
    const diffDays = Math.round((toMs(dueDateOnly) - toMs(todayStr)) / (1000 * 60 * 60 * 24));
    
    if (diffDays < 0) {
      issueGroups[issueKey].overdue.push(task);
    } else if (diffDays === 0) {
      issueGroups[issueKey].today.push(task);
    } else {
      issueGroups[issueKey].thisWeek.push(task);
    }
  });
  
  return issueGroups;
}

/**
 * Slack通知メッセージを作成（Issue別グループ化対応）
 */
function createSlackBlocks(tasks) {
  const totalCount = tasks.overdue.length + tasks.today.length + tasks.thisWeek.length;
  
  const blocks = [
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<@${ENV.SLACK_USER_ID}> 以下のタスクがあります:`
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `総件数: ${totalCount}件（期限切れ: ${tasks.overdue.length}／今日期限: ${tasks.today.length}／今週期限: ${tasks.thisWeek.length}）`
      }
    },
    {
      type: "divider"
    }
  ];
  
  // Issue別にグループ化
  const issueGroups = groupTasksByIssue(tasks);
  const issueKeys = Object.keys(issueGroups).sort();
  
  issueKeys.forEach(issueName => {
    const issueTasks = issueGroups[issueName];
    const issueTotal = issueTasks.overdue.length + issueTasks.today.length + issueTasks.thisWeek.length;
    
    // Issue名をヘッダーに
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*📋 ${issueName}*（${issueTotal}件）`
      }
    });
    
    // 期限切れタスク
    if (issueTasks.overdue.length > 0) {
      const taskList = issueTasks.overdue.map(lineOf).join('\n');
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
          text: `⚠️ 期限切れ（${issueTasks.overdue.length}件）\n${taskList}`
      }
    });
  }
  
    // 今日期限タスク
    if (issueTasks.today.length > 0) {
      const taskList = issueTasks.today.map(lineOf).join('\n');
  blocks.push({
    type: "section",
    text: {
      type: "mrkdwn",
          text: `📅 今日期限（${issueTasks.today.length}件）\n${taskList}`
        }
      });
    }
    
    // 今週期限タスク
    if (issueTasks.thisWeek.length > 0) {
      const taskList = issueTasks.thisWeek.map(lineOf).join('\n');
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
          text: `📆 今週期限（${issueTasks.thisWeek.length}件）\n${taskList}`
        }
      });
    }
    
    blocks.push({ type: "divider" });
  });
  
  // フッター
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
    blocks.push({
    type: "context",
    elements: [
      {
        type: "mrkdwn",
        text: `取得日時: ${nowStr}（JST）`
      }
    ]
  });
  
  return blocks;
}

/**
 * メイン処理関数
 * @param {boolean} skipDuplicateCheck - trueの場合、二重送信防止チェックをスキップ（テスト用）
 */
function runPersonalTaskNotifier(skipDuplicateCheck = false) {
  try {
    console.log('=== 個人タスク通知開始 ===');
    
    // 設定値の検証
    validateConfig();
    
    // 週末・祝日・年末年始のスキップ判定
    if (shouldSkipNotification()) return;
    
    // 二重送信防止（時間帯ガードは不要・トリガーで制御）
    if (!skipDuplicateCheck && hasNotifiedToday()) {
      console.log('本日は既に通知済みのためスキップ');
      return;
    }
    
    // タスク取得（部分継続対応）
    const tasks = getPersonalTasks();
    const total = tasks.overdue.length + tasks.today.length + tasks.thisWeek.length;
    
    if (total === 0) {
      console.log('通知対象なし');
      if (!skipDuplicateCheck) {
        markNotifiedToday(); // タスクがなくてもフラグ立てる（テスト時はスキップ）
      }
      return;
    }
    
    // Slack通知
    const blocks = createSlackBlocks(tasks);
    const ok = postSlackMessage(ENV.SLACK_CHANNEL_ID, blocks, 'タスク通知');
    
    if (!ok) throw new Error('Slack送信失敗');
    
    if (!skipDuplicateCheck) {
      markNotifiedToday(); // テスト時はスキップ
    }
    console.log('=== 個人タスク通知完了 ===');
    
  } catch (e) {
    console.error('メイン処理エラー', e);
    notifyErrorToSlack('runPersonalTaskNotifier', e);
  }
}

// テスト用関数（二重送信防止をスキップ）
function testPersonalTaskNotifier() {
  runPersonalTaskNotifier(true);
}
