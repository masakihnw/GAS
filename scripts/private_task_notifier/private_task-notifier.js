/**
 * 個人タスク通知ボット - 花輪 真輝用（GAS × Notion × Slack）
 * 要件定義に基づく実装
 * 
 * このファイルは clasp push の動作確認用です。
 * 実際の開発コードは一時的にここで作成し、動作確認後に個人プロジェクトに移行してください。
 * 
 * 開発完了後は、このファイルを空の状態に戻してください。
 */

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
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000
};

// アプリケーション定数
const CONSTANTS = {
  NOTION: {
    PAGE_SIZE: 100,
    API_VERSION: '2022-06-28'
  },
  SLACK: {
    TEST_CHANNEL: 'C09ARFHBLBX',
  },
  STATUS: {
    COMPLETED: '完了',
    CANCELLED: 'キャンセル',
    BACKLOG: 'バックログ',
    EXECUTION_COMPLETED: '実行完了'
  },
  // 個人設定
  NOTION_USER_ID: '889b7bc4-3dcc-46cd-9995-d57d0a3bc81f', // 花輪 真輝
  SLACK_USER_ID: 'U05HPC0BL3V', // 花輪 真輝
  SLACK_CHANNEL_ID: 'C09NX2B48BV' // 個人用通知チャンネ🏻
};

// Script Properties の設定
const CONFIG = {
  NOTION_API_TOKEN: PropertiesService.getScriptProperties().getProperty('NOTION_API_TOKEN') || '',
  NOTION_TASK_DB_ID: 'afafabe758044461a3e9e9b4c037e5aa', // Task DB ID
  SLACK_BOT_TOKEN: PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN') || ''
};

/**
 * 設定値の検証
 */
function validateConfig() {
  const requiredKeys = ['NOTION_API_TOKEN', 'NOTION_TASK_DB_ID', 'SLACK_BOT_TOKEN'];
  const missingKeys = requiredKeys.filter(key => !CONFIG[key] && !(key === 'NOTION_TASK_DB_ID' && CONSTANTS.NOTION_USER_ID));
  
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
    console.warn('祝日取得エラー:', error);
    return [];
  }
}

/**
 * 通知しない日かどうかを判定
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
 * 花輪 真輝のタスクを3種類取得（期限切れ/今日/今週）
 */
function getPersonalTasks() {
  const today = getJSTToday();
  const thisWeekSaturday = getJSTThisWeekSaturday();
  
  // 共通のベースフィルタ
  const baseAnd = [
    {
      property: NOTION_PROP.TASK_ASSIGNEE,
      people: { contains: CONSTANTS.NOTION_USER_ID } // 花輪 真輝のIDでフィルタ
    },
    { property: NOTION_PROP.TASK_STATUS, status: { does_not_equal: CONSTANTS.STATUS.COMPLETED } },
    { property: NOTION_PROP.TASK_STATUS, status: { does_not_equal: CONSTANTS.STATUS.CANCELLED } },
    { property: NOTION_PROP.TASK_STATUS, status: { does_not_equal: CONSTANTS.STATUS.BACKLOG } },
    { property: NOTION_PROP.TASK_STATUS, status: { does_not_equal: CONSTANTS.STATUS.EXECUTION_COMPLETED } }
  ];
  
  // 期限切れタスク（昨日までの期限）
  const overdueFilter = {
    filter: {
      and: [
        ...baseAnd,
        { property: NOTION_PROP.TASK_DUE_DATE, date: { before: today } },
        { property: NOTION_PROP.TASK_DUE_DATE, date: { is_not_empty: true } }
      ]
    }
  };
  
  // 今日期限タスク（今日が期限）
  const todayFilter = {
    filter: {
      and: [
        ...baseAnd,
        { property: NOTION_PROP.TASK_DUE_DATE, date: { equals: today } }
      ]
    }
  };
  
  // 今週期限タスク（明日以降で今週末まで）
  const thisWeekFilter = {
    filter: {
      and: [
        ...baseAnd,
        { property: NOTION_PROP.TASK_DUE_DATE, date: { after: today } },
        { property: NOTION_PROP.TASK_DUE_DATE, date: { on_or_before: thisWeekSaturday } }
      ]
    }
  };
  
  try {
    console.log('タスク取得開始...');
    
    // 3種類のタスクを取得
    const overduePages = notionQueryAll(CONFIG.NOTION_TASK_DB_ID, overdueFilter);
    const todayPages = notionQueryAll(CONFIG.NOTION_TASK_DB_ID, todayFilter);
    const thisWeekPages = notionQueryAll(CONFIG.NOTION_TASK_DB_ID, thisWeekFilter);
    
    const overdueTasks = overduePages.map(page => parseTask(page)).filter(task => task !== null);
    const todayTasks = todayPages.map(page => parseTask(page)).filter(task => task !== null);
    const thisWeekTasks = thisWeekPages.map(page => parseTask(page)).filter(task => task !== null);
    
    console.log(`タスク取得完了: 期限切れ${overdueTasks.length}件, 今日${todayTasks.length}件, 今週${thisWeekTasks.length}件`);
    
    return {
      overdue: overdueTasks,
      today: todayTasks,
      thisWeek: thisWeekTasks
    };
    
  } catch (error) {
    console.error('タスク取得エラー:', error);
    throw error;
  }
}

/**
 * Notionページをタスクオブジェクトに変換
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
  
  // Notionリンクを生成
  const notionLink = `https://www.notion.so/${page.id.replace(/-/g, '')}`;
  
  return {
    id: page.id,
    title: title,
    status: status,
    dueDate: dueDate,
    notionLink: notionLink
  };
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
 * Slack通知メッセージを作成
 */
function createSlackBlocks(tasks) {
  const totalCount = tasks.overdue.length + tasks.today.length + tasks.thisWeek.length;
  
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🚨 花輪 真輝のタスク通知"
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<@${CONSTANTS.SLACK_USER_ID}> 以下のタスクがあります:`
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
  
  // 期限切れタスク
  if (tasks.overdue.length > 0) {
    const sortedOverdueTasks = tasks.overdue.slice().sort((a, b) => {
      return toJstEpoch(a.dueDate) - toJstEpoch(b.dueDate);
    });
    
    const taskList = sortedOverdueTasks.map(task => {
      return `• <${task.notionLink}|${task.title}>（${formatRelativeDate(task.dueDate)} ${task.status}）`;
    }).join('\n');
    
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `⚠️ *期限切れのタスク（${tasks.overdue.length}件）*\n${taskList}`
      }
    });
    blocks.push({ type: "divider" });
  }
  
  // 今日期限タスク
  if (tasks.today.length > 0) {
    const taskList = tasks.today.map(task => {
      return `• <${task.notionLink}|${task.title}>（${formatRelativeDate(task.dueDate)} ${task.status}）`;
    }).join('\n');
    
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `📅 *今日期限のタスク（${tasks.today.length}件）*\n${taskList}`
      }
    });
    blocks.push({ type: "divider" });
  }
  
  // 今週期限タスク
  if (tasks.thisWeek.length > 0) {
    const taskList = tasks.thisWeek.map(task => {
      return `• <${task.notionLink}|${task.title}>（${formatRelativeDate(task.dueDate)} ${task.status}）`;
    }).join('\n');
    
    blocks.push({
      type: "section",
      text: {
        type: "mrkdwn",
        text: `📆 *今週期限のタスク（${tasks.thisWeek.length}件）*\n${taskList}`
      }
    });
    blocks.push({ type: "divider" });
  }
  
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
 * エラー通知をSlackに送信
 */
function sendErrorNotification(functionName, errorMessage) {
  const nowStr = Utilities.formatDate(new Date(), 'Asia/Tokyo', 'yyyy/MM/dd HH:mm:ss');
  
  const blocks = [
    {
      type: "header",
      text: {
        type: "plain_text",
        text: "🚨 タスク通知エラー"
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `<@${CONSTANTS.SLACK_USER_ID}> 個人タスク通知でエラーが発生しました`
      }
    },
    {
      type: "section",
      text: {
        type: "mrkdwn",
        text: `*エラー詳細:*\n• 関数: \`${functionName}\`\n• エラー: ${errorMessage}\n• 発生時刻: ${nowStr}（JST）`
      }
    },
    {
      type: "context",
      elements: [{ type: "mrkdwn", text: "個人タスク通知ボット" }]
    }
  ];
  
  const text = `タスク通知エラー: ${functionName} - ${errorMessage}`;
  
  console.log(`エラー通知を送信: ${functionName} - ${errorMessage}`);
  
  // エラー通知はリトライなしで送信
  const success = postSlackMessage(CONSTANTS.SLACK_CHANNEL_ID, blocks, text, false);
  if (!success) {
    console.error('エラー通知の送信に失敗しました');
  }
  
  return success;
}

/**
 * Slackメッセージを投稿（リトライ機能付き・オプション）
 */
function postSlackMessage(channelId, blocks, text, retry = true) {
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
  
  const retryAttempts = retry ? SLACK_API.RETRY_ATTEMPTS : 1;
  
  for (let attempt = 1; attempt <= retryAttempts; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, options);
      const statusCode = response.getResponseCode();
      const data = JSON.parse(response.getContentText());
      
      if (data.ok) {
        console.log(`Slack通知送信成功 (試行${attempt}回目)`);
        return true;
      } else {
        console.warn(`Slack通知送信失敗 (試行${attempt}回目): ${statusCode} - ${data.error}`);
        
        if (attempt === retryAttempts) {
          console.error('Slack通知送信が最終的に失敗しました');
          return false;
        }
      }
    } catch (error) {
      console.error(`Slack通知送信エラー (試行${attempt}回目):`, error);
      if (attempt === retryAttempts) {
        return false;
      }
      Utilities.sleep(SLACK_API.RETRY_DELAY_MS);
    }
  }
  
  return false;
}

/**
 * メイン処理関数
 */
function runPersonalTaskNotifier() {
  try {
    console.log('=== 個人タスク通知開始 ===');
    
    // 設定値の検証
    try {
      validateConfig();
    } catch (error) {
      console.error('設定値の検証エラー:', error);
      sendErrorNotification('validateConfig', error.message);
      return;
    }
    
    // 土日・祝日・年末年始の通知スキップ判定
    if (shouldSkipNotification()) {
      console.log('今日は通知対象外の日付のため、処理を終了します');
      return;
    }
    
    // タスクを取得
    let tasks;
    try {
      tasks = getPersonalTasks();
    } catch (error) {
      console.error('タスク取得エラー:', error);
      sendErrorNotification('getPersonalTasks', error.message);
      return;
    }
    
    const totalCount = tasks.overdue.length + tasks.today.length + tasks.thisWeek.length;
    
    if (totalCount === 0) {
      console.log('通知対象のタスクがありません');
      return;
    }
    
    console.log(`通知対象タスク: ${totalCount}件`);
    
    // Slack通知
    const blocks = createSlackBlocks(tasks);
    const text = '花輪 真輝のタスク通知';
    
    const success = postSlackMessage(CONSTANTS.SLACK_CHANNEL_ID, blocks, text);
    
    if (success) {
      console.log('通知送信完了');
    } else {
      console.error('通知送信失敗');
      // 通知送信失敗もエラー通知
      sendErrorNotification('postSlackMessage', 'Slack通知送信に失敗しました');
    }
    
    console.log('=== 個人タスク通知完了 ===');
    
  } catch (error) {
    console.error('メイン処理エラー:', error);
    // 想定外のエラーも通知
    sendErrorNotification('runPersonalTaskNotifier', error.message);
    throw error;
  }
}

// テスト用関数
function testPersonalTaskNotifier() {
  runPersonalTaskNotifier();
}
