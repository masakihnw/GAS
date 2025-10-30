/**
 * Slackリリース通知のNotion朝会議事録への自動投稿
 * 要件定義に基づく実装
 */

/**
 * 定数定義
 */
const SLACK_API = {
  BASE_URL: 'https://slack.com/api',
  CONVERSATIONS_HISTORY: '/conversations.history',
  USERS_INFO: '/users.info',
  RETRY_ATTEMPTS: 3,
  RETRY_DELAY_MS: 1000
};

const NOTION_API = {
  BASE_URL: 'https://api.notion.com/v1',
  API_VERSION: '2022-06-28',
  PAGE_SIZE: 100
};

/**
 * Notionプロパティ名の定数
 */
const NOTION_PROP = {
  TITLE: '名前', // タイトルプロパティ名
  DATE: '日付'   // 日付プロパティ名（要確認）
};

/**
 * アプリケーション定数
 */
const CONSTANTS = {
  SLACK: {
    CHANNEL_ID: 'C6A3U5WTC', // リリース通知チャンネルID
    BASE_URL: 'https://playground-live.slack.com/archives'
  },
  NOTION: {
    DB_ID: 'cd1b1c95bfc34c7d9ec50405a5023cc9', // 朝会議事録データベースID
    TITLE_SUFFIX: 'チーム活動予定'
  },
  TIME: {
    TIMEZONE: 'Asia/Tokyo',
    EXEC_START_HOUR: 9,
    EXEC_END_HOUR: 10
  }
};

// Script Properties の設定
const CONFIG = {
  SLACK_BOT_TOKEN: PropertiesService.getScriptProperties().getProperty('SLACK_BOT_TOKEN') || '',
  NOTION_API_TOKEN: PropertiesService.getScriptProperties().getProperty('NOTION_API_TOKEN') || '',
  NOTION_DB_ID: PropertiesService.getScriptProperties().getProperty('NOTION_DB_ID') || CONSTANTS.NOTION.DB_ID,
  SLACK_CHANNEL_ID: PropertiesService.getScriptProperties().getProperty('SLACK_CHANNEL_ID') || CONSTANTS.SLACK.CHANNEL_ID
};

/**
 * 設定値の検証
 */
function validateConfig() {
  const requiredKeys = ['SLACK_BOT_TOKEN', 'NOTION_API_TOKEN'];
  const missingKeys = requiredKeys.filter(key => !CONFIG[key]);
  
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
 * 営業日かどうかを判定（土日祝日を除外）
 */
function isBusinessDay(date) {
  const dayOfWeek = date.getDay();
  
  // 土日を除外
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    return false;
  }
  
  // 祝日を除外
  const year = date.getFullYear();
  const dateStr = Utilities.formatDate(date, 'Asia/Tokyo', 'yyyy-MM-dd');
  const holidays = getJapaneseHolidays(year);
  if (holidays.includes(dateStr)) {
    return false;
  }
  
  return true;
}

/**
 * 前営業日の8:59を計算
 * @param {Date} date - 基準日（実行日）
 * @return {Date} 前営業日の8:59（JST）
 */
function getPreviousBusinessDayEnd(date) {
  const yesterday = new Date(date);
  yesterday.setDate(yesterday.getDate() - 1);
  
  // 前日から遡って最初の営業日を見つける
  while (!isBusinessDay(yesterday)) {
    yesterday.setDate(yesterday.getDate() - 1);
  }
  
  // 8:59のタイムスタンプを返す
  yesterday.setHours(8, 59, 0, 0);
  return yesterday;
}

/**
 * 実行条件チェック（平日・実行時間帯・二重実行防止）
 */
function shouldSkipExecution() {
  const now = new Date();
  const todayStr = getJSTToday();
  const year = now.getFullYear();
  
  // 実行時間帯チェック（9:00-10:00）
  const hour = Utilities.formatDate(now, 'Asia/Tokyo', 'H');
  const hourNum = parseInt(hour, 10);
  if (hourNum < CONSTANTS.TIME.EXEC_START_HOUR || hourNum >= CONSTANTS.TIME.EXEC_END_HOUR) {
    console.log(`実行時間外のためスキップします: ${hourNum}時`);
    return true;
  }
  
  // 土日祝日判定
  const dayOfWeek = now.getDay();
  if (dayOfWeek === 0 || dayOfWeek === 6) {
    console.log(`今日は${dayOfWeek === 0 ? '日曜日' : '土曜日'}のためスキップします`);
    return true;
  }
  
  // 祝日判定
  const holidays = getJapaneseHolidays(year);
  if (holidays.includes(todayStr)) {
    console.log(`今日は祝日のためスキップします: ${todayStr}`);
    return true;
  }
  
  // 二重実行防止
  const lastExecKey = `LAST_EXEC_DATE_${todayStr.replace(/-/g, '')}`;
  const lastExecDate = PropertiesService.getScriptProperties().getProperty(lastExecKey);
  if (lastExecDate === todayStr) {
    console.log(`今日は既に実行済みのためスキップします: ${todayStr}`);
    return true;
  }
  
  return false;
}

/**
 * 実行日を記録
 */
function markExecutionDate() {
  const todayStr = getJSTToday();
  const lastExecKey = `LAST_EXEC_DATE_${todayStr.replace(/-/g, '')}`;
  PropertiesService.getScriptProperties().setProperty(lastExecKey, todayStr);
  console.log(`実行日を記録しました: ${todayStr}`);
}

/**
 * 日付をNotion形式に変換（YYYY年MM月DD日）
 */
function formatDateToNotionFormat(dateStr) {
  const date = new Date(dateStr + 'T00:00:00+09:00');
  const year = date.getFullYear();
  const month = date.getMonth() + 1;
  const day = date.getDate();
  return `${year}年${month}月${day}日`;
}

/**
 * 曜日名を日本語で取得
 */
function getDayOfWeekName(dateStr) {
  const date = new Date(dateStr + 'T00:00:00+09:00');
  const dayOfWeek = date.getDay();
  const dayNames = ['日曜日', '月曜日', '火曜日', '水曜日', '木曜日', '金曜日', '土曜日'];
  return dayNames[dayOfWeek];
}

/**
 * Slack API呼び出し（リトライ機能付き）
 */
function callSlackAPI(endpoint, payload) {
  const url = `${SLACK_API.BASE_URL}${endpoint}`;
  
  for (let attempt = 1; attempt <= SLACK_API.RETRY_ATTEMPTS; attempt++) {
    try {
      const response = UrlFetchApp.fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${CONFIG.SLACK_BOT_TOKEN}`,
          'Content-Type': 'application/json'
        },
        payload: JSON.stringify(payload),
        muteHttpExceptions: true
      });
      
      const statusCode = response.getResponseCode();
      const data = JSON.parse(response.getContentText() || '{}');
      
      if (data.ok) {
        return data;
      } else {
        console.warn(`Slack API呼び出し失敗 (試行${attempt}回目): ${statusCode} - ${data.error}`);
        
        if (attempt === SLACK_API.RETRY_ATTEMPTS) {
          throw new Error(`Slack API エラー: ${data.error}`);
        }
        
        Utilities.sleep(SLACK_API.RETRY_DELAY_MS * attempt);
      }
    } catch (error) {
      console.error(`Slack API呼び出しエラー (試行${attempt}回目):`, error);
      if (attempt === SLACK_API.RETRY_ATTEMPTS) {
        throw error;
      }
      Utilities.sleep(SLACK_API.RETRY_DELAY_MS * attempt);
    }
  }
  
  throw new Error('Slack API呼び出しが失敗しました');
}

/**
 * Notion API呼び出し（リトライ機能付き）
 */
function callNotionAPI(endpoint, method = 'GET', payload = null) {
  const url = `${NOTION_API.BASE_URL}${endpoint}`;
  
  for (let attempt = 1; attempt <= 3; attempt++) {
    try {
      const options = {
        method: method,
        headers: {
          'Authorization': `Bearer ${CONFIG.NOTION_API_TOKEN}`,
          'Content-Type': 'application/json',
          'Notion-Version': NOTION_API.API_VERSION
        },
        muteHttpExceptions: true
      };
      
      if (payload) {
        options.payload = JSON.stringify(payload);
      }
      
      const response = UrlFetchApp.fetch(url, options);
      const statusCode = response.getResponseCode();
      
      if (statusCode.toString().startsWith('2')) {
        const data = JSON.parse(response.getContentText());
        return data;
      } else {
        const errorText = response.getContentText();
        console.warn(`Notion API呼び出し失敗 (試行${attempt}回目): ${statusCode} - ${errorText}`);
        
        if (attempt === 3) {
          throw new Error(`Notion API エラー: ${statusCode} - ${errorText}`);
        }
        
        Utilities.sleep(SLACK_API.RETRY_DELAY_MS * attempt);
      }
    } catch (error) {
      console.error(`Notion API呼び出しエラー (試行${attempt}回目):`, error);
      if (attempt === 3) {
        throw error;
      }
      Utilities.sleep(SLACK_API.RETRY_DELAY_MS * attempt);
    }
  }
  
  throw new Error('Notion API呼び出しが失敗しました');
}

/**
 * Slackユーザー情報を取得
 */
function getSlackUserInfo(userId) {
  try {
    const data = callSlackAPI(SLACK_API.USERS_INFO, { user: userId });
    if (data.ok && data.user) {
      const profile = data.user.profile || {};
      return {
        displayName: profile.display_name || profile.real_name || data.user.name || '不明',
        realName: profile.real_name || profile.display_name || data.user.name || '不明'
      };
    }
  } catch (error) {
    console.warn(`Slackユーザー情報取得エラー (${userId}):`, error);
  }
  return null;
}

/**
 * リリース通知からプロダクト名を抽出
 * @param {string} text - 投稿テキスト
 * @return {string|null} プロダクト名（抽出できない場合はnull）
 */
function extractProductName(text) {
  if (!text) return null;
  
  // 最初の行を取得（改行で分割）
  const firstLine = text.split('\n')[0].trim();
  
  // パターン1: [プロダクト名 バージョン]リリースしました
  // 例: [Eitoku v3.4.1(369)]リリースしました:tada: @channel
  let match = firstLine.match(/^\[([^\]]+?)\s+v?\d+[^\]]*?\]リリース/);
  if (match) {
    return match[1].trim();
  }
  
  // パターン2: [プロダクト名] バージョンをリリースしました
  // 例: [Karaku Admin] v2.9.3をリリースしました！@channel
  match = firstLine.match(/^\[([^\]]+)\]\s+v?\d+/);
  if (match) {
    return match[1].trim();
  }
  
  // パターン3: プロダクト名 バージョン をリリースしました
  // 例: Juko 1.28.0 をリリースしました！
  match = firstLine.match(/^([A-Za-z0-9\s]+?)\s+v?\d+[\d\.]*\s*をリリース/);
  if (match) {
    return match[1].trim();
  }
  
  // パターン4: プロダクト名 バージョンをリリースしました（漢字なし）
  // 例: Juko 1.28.0をリリースしました！
  match = firstLine.match(/^([A-Za-z0-9\s]+?)\s+v?\d+[\d\.]*をリリース/);
  if (match) {
    return match[1].trim();
  }
  
  // パターン5: [プロダクト名]リリース（バージョンなし）
  match = firstLine.match(/^\[([^\]]+)\][リリース]/);
  if (match) {
    return match[1].trim();
  }
  
  // フォールバック: 最初の単語をプロダクト名とする（アルファベット・数字・スペースのみ）
  match = firstLine.match(/^([A-Za-z0-9\s]+?)[\sリリース]/);
  if (match) {
    const candidate = match[1].trim();
    // 明らかに違うもの（チャンネル名、絵文字など）は除外
    if (candidate && !candidate.match(/^[@:]/) && candidate.length > 0 && candidate.length < 50) {
      return candidate;
    }
  }
  
  return null;
}

/**
 * Slackチャンネルからリリース通知を取得
 */
function getSlackReleaseNotifications(oldestTs, latestTs) {
  console.log(`Slack投稿取得開始: ${oldestTs} 〜 ${latestTs}`);
  
  const allMessages = [];
  let cursor = null;
  let hasMore = true;
  
  while (hasMore) {
    const payload = {
      channel: CONFIG.SLACK_CHANNEL_ID,
      oldest: oldestTs.toString(),
      latest: latestTs.toString(),
      limit: 1000
    };
    
    if (cursor) {
      payload.cursor = cursor;
    }
    
    try {
      const data = callSlackAPI(SLACK_API.CONVERSATIONS_HISTORY, payload);
      
      if (data.messages && Array.isArray(data.messages)) {
        allMessages.push(...data.messages);
      }
      
      hasMore = data.has_more === true;
      cursor = data.response_metadata?.next_cursor || null;
      
      if (hasMore && cursor) {
        Utilities.sleep(100); // レート制限対策
      }
    } catch (error) {
      console.error('Slack投稿取得エラー:', error);
      throw error;
    }
  }
  
  console.log(`Slack投稿取得完了: ${allMessages.length}件`);
  
  // リリース通知を抽出（このチャンネルはリリース投稿のみのため、全メッセージを対象）
  const releaseNotifications = [];
  const seenUsers = {}; // ユーザー情報キャッシュ
  
  for (const message of allMessages) {
    // ボットメッセージや空のメッセージは除外
    if (message.type !== 'message' || !message.text || message.bot_id) {
      continue;
    }
    
    // プロダクト名を抽出
    const productName = extractProductName(message.text);
    if (!productName) {
      console.warn(`プロダクト名を抽出できませんでした: ${message.text.substring(0, 50)}...`);
      // プロダクト名が抽出できなくても、投稿内容があるので処理対象とする
      // （フォールバックとして投稿者のみ記録）
    }
    
    // 投稿者名を取得（SlackユーザーIDから）
    let authorName = '不明';
    if (message.user) {
      if (!seenUsers[message.user]) {
        const userInfo = getSlackUserInfo(message.user);
        if (userInfo) {
          seenUsers[message.user] = userInfo;
          authorName = userInfo.displayName || userInfo.realName || message.user;
        } else {
          authorName = message.user; // ユーザー情報が取得できない場合
        }
      } else {
        const userInfo = seenUsers[message.user];
        authorName = userInfo.displayName || userInfo.realName || message.user;
      }
    } else {
      // ユーザーIDがない場合はフォールバック
      authorName = '不明';
    }
    
    // permalinkを取得
    const permalink = message.permalink || 
      `${CONSTANTS.SLACK.BASE_URL}/${CONFIG.SLACK_CHANNEL_ID}/p${message.ts.replace('.', '')}`;
    
    releaseNotifications.push({
      text: message.text,
      productName: productName || 'プロダクト名不明',
      authorName: authorName,
      ts: message.ts,
      permalink: permalink
    });
  }
  
  console.log(`リリース通知抽出完了: ${releaseNotifications.length}件`);
  return releaseNotifications;
}

/**
 * タイトルでNotionページを検索
 */
function searchNotionPageByTitle(pattern) {
  try {
    const filter = {
      filter: {
        property: NOTION_PROP.TITLE,
        title: {
          contains: pattern
        }
      },
      page_size: 10
    };
    
    const data = callNotionAPI(`/databases/${CONFIG.NOTION_DB_ID}/query`, 'POST', filter);
    
    if (data.results && data.results.length > 0) {
      return data.results[0].id;
    }
  } catch (error) {
    console.warn(`タイトル検索エラー (${pattern}):`, error);
  }
  
  return null;
}

/**
 * 日付プロパティでNotionページを検索
 */
function searchNotionPageByDateProperty(dateISO) {
  try {
    const filter = {
      filter: {
        property: NOTION_PROP.DATE,
        date: {
          equals: dateISO
        }
      },
      page_size: 10
    };
    
    const data = callNotionAPI(`/databases/${CONFIG.NOTION_DB_ID}/query`, 'POST', filter);
    
    if (data.results && data.results.length > 0) {
      return data.results[0].id;
    }
  } catch (error) {
    console.warn(`日付プロパティ検索エラー (${dateISO}):`, error);
  }
  
  return null;
}

/**
 * フォールバック: 全ページを取得してタイトルと日付プロパティを確認
 */
function findNotionPageByDateFallback(dateStr) {
  try {
    const data = callNotionAPI(`/databases/${CONFIG.NOTION_DB_ID}/query`, 'POST', {
      page_size: 100
    });
    
    if (data.results && Array.isArray(data.results)) {
      const dateISO = dateStr; // YYYY-MM-DD形式
      const dateNotionFormat = formatDateToNotionFormat(dateStr); // YYYY年MM月DD日形式
      
      for (const page of data.results) {
        // タイトルに日付が含まれるか確認
        const titleProp = page.properties[NOTION_PROP.TITLE];
        if (titleProp && titleProp.title && Array.isArray(titleProp.title)) {
          const titleText = titleProp.title.map(item => item.plain_text || '').join('');
          if (titleText.includes(dateNotionFormat) || titleText.includes(dateISO)) {
            return page.id;
          }
        }
        
        // 日付プロパティが一致するか確認
        const dateProp = page.properties[NOTION_PROP.DATE];
        if (dateProp && dateProp.date && dateProp.date.start) {
          const pageDate = dateProp.date.start.split('T')[0];
          if (pageDate === dateISO) {
            return page.id;
          }
        }
      }
    }
  } catch (error) {
    console.warn('フォールバック検索エラー:', error);
  }
  
  return null;
}

/**
 * 当日の朝会議事録ページを検索
 * @param {string} date - 日付（YYYY-MM-DD形式）
 * @return {string|null} ページID（見つからない場合はnull）
 */
function findNotionPage(date) {
  console.log(`Notionページ検索開始: ${date}`);
  
  // 日付を「YYYY年MM月DD日」形式と「YYYY-MM-DD」形式に変換
  const dateStr = formatDateToNotionFormat(date); // "2025年1月29日"
  const dateISO = date; // "2025-01-29" (既にYYYY-MM-DD形式)
  const dayOfWeek = getDayOfWeekName(date); // "水曜日"
  
  // 検索方法1: タイトルによる検索（優先度: 高）
  const searchPatterns = [
    `@今日 ${CONSTANTS.NOTION.TITLE_SUFFIX}`,
    `@${dateStr} ${CONSTANTS.NOTION.TITLE_SUFFIX}`,
    `@${dayOfWeek} ${CONSTANTS.NOTION.TITLE_SUFFIX}`
  ];
  
  // 各パターンで検索を試行
  for (const pattern of searchPatterns) {
    const pageId = searchNotionPageByTitle(pattern);
    if (pageId) {
      console.log(`ページ検索成功 (タイトル検索): ${pattern}`);
      return pageId;
    }
  }
  
  // 検索方法2: 日付プロパティによる検索（優先度: 中）
  const pageIdByDate = searchNotionPageByDateProperty(dateISO);
  if (pageIdByDate) {
    console.log(`ページ検索成功 (日付プロパティ検索): ${dateISO}`);
    return pageIdByDate;
  }
  
  // フォールバック: 全ページを取得してタイトルと日付プロパティを確認
  const pageIdFallback = findNotionPageByDateFallback(date);
  if (pageIdFallback) {
    console.log(`ページ検索成功 (フォールバック検索): ${date}`);
    return pageIdFallback;
  }
  
  console.error(`ページが見つかりませんでした: ${date}`);
  return null;
}

/**
 * Notionページの既存ブロックを取得
 */
function getNotionPageBlocks(pageId) {
  const allBlocks = [];
  let startCursor = null;
  let hasMore = true;
  
  while (hasMore) {
    let url = `/blocks/${pageId}/children?page_size=${NOTION_API.PAGE_SIZE}`;
    if (startCursor) {
      url += `&start_cursor=${startCursor}`;
    }
    
    const data = callNotionAPI(url, 'GET');
    
    if (data.results && Array.isArray(data.results)) {
      allBlocks.push(...data.results);
    }
    
    hasMore = data.has_more === true;
    startCursor = data.next_cursor || null;
    
    if (hasMore && startCursor) {
      Utilities.sleep(100); // レート制限対策
    }
  }
  
  return allBlocks;
}

/**
 * テンプレートブロックを削除
 */
function deleteTemplateBlocks(pageId, blocks) {
  console.log('テンプレートブロックを検索中...');
  
  const templatePatterns = [
    '[共有] タイトル - 発表者名',
    '[依頼] タイトル - 発表者名',
    '- 内容'
  ];
  
  const blocksToDelete = [];
  
  for (const block of blocks) {
    let blockText = '';
    
    // ブロックタイプに応じてテキストを取得
    if (block.type === 'heading_3' && block.heading_3 && block.heading_3.rich_text) {
      blockText = block.heading_3.rich_text.map(item => item.plain_text || '').join('');
    } else if (block.type === 'paragraph' && block.paragraph && block.paragraph.rich_text) {
      blockText = block.paragraph.rich_text.map(item => item.plain_text || '').join('');
    }
    
    // テンプレートパターンに一致するブロックを削除対象に追加
    for (const pattern of templatePatterns) {
      if (blockText.includes(pattern)) {
        blocksToDelete.push(block.id);
        console.log(`テンプレートブロックを発見: ${blockText.substring(0, 30)}...`);
        break;
      }
    }
  }
  
  // ブロックを削除
  for (const blockId of blocksToDelete) {
    try {
      callNotionAPI(`/blocks/${blockId}`, 'DELETE');
      console.log(`テンプレートブロック削除: ${blockId}`);
      Utilities.sleep(100); // レート制限対策
    } catch (error) {
      console.warn(`ブロック削除エラー (${blockId}):`, error);
    }
  }
  
  console.log(`テンプレートブロック削除完了: ${blocksToDelete.length}件`);
}

/**
 * Notionページに「なし」を追加
 */
function addNoContentBlock(pageId) {
  const children = [
    {
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: 'なし'
            }
          }
        ]
      }
    }
  ];
  
  try {
    callNotionAPI(`/blocks/${pageId}/children`, 'PATCH', { children: children });
    console.log('「なし」を追加しました');
  } catch (error) {
    console.error('「なし」追加エラー:', error);
    throw error;
  }
}

/**
 * Notionページにリリース通知を追加
 */
function addReleaseNotificationsToPage(pageId, notifications) {
  if (!notifications || notifications.length === 0) {
    console.log('追加する通知がありません');
    return;
  }
  
  console.log(`リリース通知を${notifications.length}件追加します`);
  
  const children = [];
  
  for (const notification of notifications) {
    // Heading 3: [共有] プロダクト名リリース - 投稿者名
    children.push({
      object: 'block',
      type: 'heading_3',
      heading_3: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: `[共有] ${notification.productName}リリース - ${notification.authorName}`
            }
          }
        ]
      }
    });
    
    // Paragraph: Slackリンク（プレビュー形式）
    children.push({
      object: 'block',
      type: 'paragraph',
      paragraph: {
        rich_text: [
          {
            type: 'text',
            text: {
              content: notification.permalink,
              link: {
                url: notification.permalink
              }
            }
          }
        ]
      }
    });
  }
  
  try {
    // ブロックを追加（一度に追加できるのは100件まで）
    const batchSize = 100;
    for (let i = 0; i < children.length; i += batchSize) {
      const batch = children.slice(i, i + batchSize);
      callNotionAPI(`/blocks/${pageId}/children`, 'PATCH', { children: batch });
      
      if (i + batchSize < children.length) {
        Utilities.sleep(200); // レート制限対策
      }
    }
    
    console.log(`リリース通知追加完了: ${children.length / 2}件`);
  } catch (error) {
    console.error('リリース通知追加エラー:', error);
    throw error;
  }
}

/**
 * Notionページにリリース通知を追加（テンプレート処理含む）
 */
function updateNotionPage(pageId, notifications) {
  console.log(`Notionページ更新開始: ${pageId}`);
  
  try {
    // 既存ブロックを取得
    const blocks = getNotionPageBlocks(pageId);
    console.log(`既存ブロック数: ${blocks.length}件`);
    
    if (notifications.length === 0) {
      // 通知がない場合: テンプレートを削除して「なし」を追加
      deleteTemplateBlocks(pageId, blocks);
      addNoContentBlock(pageId);
    } else {
      // 通知がある場合: テンプレートを削除して通知を追加
      deleteTemplateBlocks(pageId, blocks);
      addReleaseNotificationsToPage(pageId, notifications);
    }
    
    console.log('Notionページ更新完了');
  } catch (error) {
    console.error('Notionページ更新エラー:', error);
    throw error;
  }
}

/**
 * メイン実行関数
 */
function main() {
  try {
    console.log('=== Slackリリース通知のNotion追加処理開始 ===');
    const startTime = new Date();
    
    // 設定値の検証
    validateConfig();
    
    // 実行条件チェック
    if (shouldSkipExecution()) {
      console.log('実行条件を満たさないため、処理を終了します');
      return;
    }
    
    // 実行日の日付を取得
    const today = new Date();
    const todayStr = getJSTToday();
    console.log(`実行日: ${todayStr}`);
    
    // 前営業日の8:59を計算
    const previousBusinessDayEnd = getPreviousBusinessDayEnd(today);
    const previousBusinessDayEndStr = Utilities.formatDate(previousBusinessDayEnd, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm:ss');
    console.log(`対象期間終了: ${previousBusinessDayEndStr}`);
    
    // タイムスタンプに変換
    const oldestTs = Math.floor(previousBusinessDayEnd.getTime() / 1000);
    const latestTs = Math.floor(today.getTime() / 1000);
    
    // Slack投稿取得
    console.log('\n[Slack投稿取得]');
    const notifications = getSlackReleaseNotifications(oldestTs, latestTs);
    console.log(`取得件数: ${notifications.length}件`);
    
    if (notifications.length > 0) {
      notifications.forEach(notif => {
        console.log(`- [共有] ${notif.productName}リリース - ${notif.authorName}`);
      });
    }
    
    // Notionページ検索
    console.log('\n[Notionページ検索]');
    const pageId = findNotionPage(todayStr);
    
    if (!pageId) {
      throw new Error(`当日の朝会議事録ページが見つかりませんでした: ${todayStr}`);
    }
    
    console.log(`ページID: ${pageId}`);
    
    // Notionページ更新
    console.log('\n[Notionページ更新]');
    updateNotionPage(pageId, notifications);
    
    if (notifications.length > 0) {
      console.log(`通知を${notifications.length}件追加しました`);
    } else {
      console.log('通知がないため、「なし」を記載しました');
    }
    
    // 実行日を記録
    markExecutionDate();
    
    const endTime = new Date();
    const duration = (endTime.getTime() - startTime.getTime()) / 1000;
    console.log(`\n=== 処理完了 (実行時間: ${duration.toFixed(2)}秒) ===`);
    
  } catch (error) {
    console.error('メイン処理エラー:', error);
    throw error;
  }
}

