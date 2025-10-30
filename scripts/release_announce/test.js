/**
 * Slackリリース通知のNotion朝会議事録への自動投稿 - テストスイート
 * 
 * テスト実行方法:
 * 1. GASエディタで test.js を追加
 * 2. 各テスト関数を個別に実行、または runAllTests() を実行
 */

/**
 * テスト結果を出力
 */
function logTestResult(testName, passed, message = '') {
  const status = passed ? '✅ PASS' : '❌ FAIL';
  console.log(`${status}: ${testName}${message ? ` - ${message}` : ''}`);
  return passed;
}

/**
 * テスト1: プロダクト名抽出のテスト
 */
function testExtractProductName() {
  console.log('\n=== テスト1: プロダクト名抽出 ===');
  
  const testCases = [
    {
      name: 'パターン1 - [Eitoku v3.4.1(369)]リリースしました',
      text: '[Eitoku v3.4.1(369)]リリースしました:tada: @channel',
      expected: 'Eitoku'
    },
    {
      name: 'パターン2 - [Karaku Admin] v2.9.3をリリースしました',
      text: '[Karaku Admin] v2.9.3をリリースしました！@channel',
      expected: 'Karaku Admin'
    },
    {
      name: 'パターン3 - Juko 1.28.0 をリリースしました',
      text: 'Juko 1.28.0 をリリースしました！',
      expected: 'Juko'
    },
    {
      name: 'パターン4 - 複数行のメッセージ（最初の行から抽出）',
      text: `[Zeami v2.1.0]リリースしました
リリース内容
Zeami v2.1.0
- 機能追加`,
      expected: 'Zeami'
    },
    {
      name: 'パターン5 - バージョンなし',
      text: '[Zeami]リリースしました',
      expected: 'Zeami'
    }
  ];
  
  let passedCount = 0;
  let totalCount = testCases.length;
  
  testCases.forEach(testCase => {
    const result = extractProductName(testCase.text);
    const passed = result === testCase.expected;
    logTestResult(testCase.name, passed, `期待値: "${testCase.expected}", 結果: "${result}"`);
    if (passed) passedCount++;
  });
  
  console.log(`\n結果: ${passedCount}/${totalCount} テスト合格\n`);
  return passedCount === totalCount;
}

/**
 * テスト2: 日付フォーマット変換のテスト
 */
function testFormatDateToNotionFormat() {
  console.log('\n=== テスト2: 日付フォーマット変換 ===');
  
  const testCases = [
    {
      name: '2025年1月29日',
      dateStr: '2025-01-29',
      expected: '2025年1月29日'
    },
    {
      name: '2025年12月31日',
      dateStr: '2025-12-31',
      expected: '2025年12月31日'
    },
    {
      name: '2025年3月5日',
      dateStr: '2025-03-05',
      expected: '2025年3月5日'
    }
  ];
  
  let passedCount = 0;
  let totalCount = testCases.length;
  
  testCases.forEach(testCase => {
    const result = formatDateToNotionFormat(testCase.dateStr);
    const passed = result === testCase.expected;
    logTestResult(testCase.name, passed, `期待値: "${testCase.expected}", 結果: "${result}"`);
    if (passed) passedCount++;
  });
  
  console.log(`\n結果: ${passedCount}/${totalCount} テスト合格\n`);
  return passedCount === totalCount;
}

/**
看著 * テスト3: 曜日名取得のテスト
 */
function testGetDayOfWeekName() {
  console.log('\n=== テスト3: 曜日名取得 ===');
  
  const testCases = [
    {
      name: '2025年1月27日（月曜日）',
      dateStr: '2025-01-27',
      expected: '月曜日'
    },
    {
      name: '2025年1月29日（水曜日）',
      dateStr: '2025-01-29',
      expected: '水曜日'
    },
    {
      name: '2025年1月26日（日曜日）',
      dateStr: '2025-01-26',
      expected: '日曜日'
    }
  ];
  
  let passedCount = 0;
  let totalCount = testCases.length;
  
  testCases.forEach(testCase => {
    const result = getDayOfWeekName(testCase.dateStr);
    const passed = result === testCase.expected;
    logTestResult(testCase.name, passed, `期待値: "${testCase.expected}", 結果: "${result}"`);
    if (passed) passedCount++;
  });
  
  console.log(`\n結果: ${passedCount}/${totalCount} テスト合格\n`);
  return passedCount === totalCount;
}

/**
 * テスト4: 営業日判定のテスト
 */
function testIsBusinessDay() {
  console.log('\n=== テスト4: 営業日判定 ===');
  
  // 注意: 実際の日付に依存するため、固定日付でテスト
  const testCases = [
    {
      name: '月曜日（営業日）',
      date: new Date('2025-01-27T00:00:00+09:00'),
      expected: true,
      description: '2025年1月27日（月）'
    },
    {
      name: '火曜日（営業日）',
      date: new Date('2025-01-28T00:00:00+09:00'),
      expected: true,
      description: '2025年1月28日（火）'
    },
    {
      name: '土曜日（非営業日）',
      date: new Date('2025-01-25T00:00:00+09:00'),
      expected: false,
      description: '2025年1月25日（土）'
    },
    {
      name: '日曜日（非営業日）',
      date: new Date('2025-01-26T00:00:00+09:00'),
      expected: false,
      description: '2025年1月26日（日）'
    }
  ];
  
  let passedCount = 0;
  let totalCount = testCases.length;
  
  testCases.forEach(testCase => {
    const result = isBusinessDay(testCase.date);
    const passed = result === testCase.expected;
    logTestResult(`${testCase.name} (${testCase.description})`, passed, 
      `期待値: ${testCase.expected}, 結果: ${result}`);
    if (passed) passedCount++;
  });
  
  console.log(`\n結果: ${passedCount}/${totalCount} テスト合格\n`);
  console.log('注意: 祝日判定は実際の祝日カレンダーに依存するため、祝日のテストは別途確認が必要です。\n');
  return passedCount === totalCount;
}

/**
 * テスト5: 前営業日計算のテスト
 */
function testGetPreviousBusinessDayEnd() {
  console.log('\n=== テスト5: 前営業日計算 ===');
  
  // テストケース: 実行日から前営業日の8:59を計算
  const testCases = [
    {
      name: '水曜日実行 → 火曜日8:59',
      execDate: new Date('2025-01-29T09:00:00+09:00'), // 水曜日
      expectedDate: new Date('2025-01-28T08:59:00+09:00'), // 火曜日8:59
      description: '2025年1月29日（水）9:00 → 2025年1月28日（火）8:59'
    },
    {
      name: '月曜日実行 → 金曜日8:59',
      execDate: new Date('2025-01-27T09:00:00+09:00'), // 月曜日
      expectedDate: new Date('2025-01-24T08:59:00+09:00'), // 金曜日8:59
      description: '2025年1月27日（月）9:00 → 2025年1月24日（金）8:59'
    }
  ];
  
  let passedCount = 0;
  let totalCount = testCases.length;
  
  testCases.forEach(testCase => {
    const result = getPreviousBusinessDayEnd(testCase.execDate);
    const resultStr = Utilities.formatDate(result, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
    const expectedStr = Utilities.formatDate(testCase.expectedDate, 'Asia/Tokyo', 'yyyy-MM-dd HH:mm');
    const passed = result.getTime() === testCase.expectedDate.getTime();
    logTestResult(testCase.name, passed, 
      `期待値: ${expectedStr}, 結果: ${resultStr}`);
    if (passed) passedCount++;
  });
  
  console.log(`\n結果: ${passedCount}/${totalCount} テスト合格\n`);
  return passedCount === totalCount;
}

/**
 * テスト6: JST日付取得のテスト
 */
function testGetJSTDate() {
  console.log('\n=== テスト6: JST日付取得 ===');
  
  // 現在の日付を取得してテスト
  const today = new Date();
  const result = getJSTDate(today);
  const expected = Utilities.formatDate(today, 'Asia/Tokyo', 'yyyy-MM-dd');
  
  const passed = result === expected;
  logTestResult('現在日付のJST変換', passed, 
    `期待値: "${expected}", 結果: "${result}"`);
  
  // 特定日付のテスト
  const testDate = new Date('2025-01-29T15:30:00+09:00');
  const result2 = getJSTDate(testDate);
  const expected2 = '2025-01-29';
  const passed2 = result2 === expected2;
  logTestResult('特定日付のJST変換', passed2, 
    `期待値: "${expected2}", 結果: "${result2}"`);
  
  const totalPassed = (passed ? 1 : 0) + (passed2 ? 1 : 0);
  console.log(`\n結果: ${totalPassed}/2 テスト合格\n`);
  return totalPassed === 2;
}

/**
 * テスト7: リリース通知データ構造のテスト（モックデータ）
 */
function testReleaseNotificationStructure() {
  console.log('\n=== テスト7: リリース通知データ構造 ===');
  
  // モックリリース通知データ
  const mockNotifications = [
    {
      text: '[Eitoku v3.4.1(369)]リリースしました:tada: @channel',
      productName: 'Eitoku',
      authorName: '花輪',
      ts: '1706785200.123456',
      permalink: 'https://playground-live.slack.com/archives/C6A3U5WTC/p1706785200123456'
    },
    {
      text: 'Juko 1.28.0 をリリースしました！',
      productName: 'Juko',
      authorName: '渡部',
      ts: '1706871600.654321',
      permalink: 'https://playground-live.slack.com/archives/C6A3U5WTC/p1706871600654321'
    }
  ];
  
  // データ構造の検証
  let passedCount = 0;
  const totalCount = mockNotifications.length * 4; // 各通知に対して4つのフィールドをチェック
  
  mockNotifications.forEach((notif, index) => {
    // textフィールド
    const hasText = notif.hasOwnProperty('text') && typeof notif.text === 'string';
    logTestResult(`通知${index + 1} - textフィールド`, hasText);
    if (hasText) passedCount++;
    
    // productNameフィールド
    const hasProductName = notif.hasOwnProperty('productName') && typeof notif.productName === 'string';
    logTestResult(`通知${index + 1} - productNameフィールド`, hasProductName);
    if (hasProductName) passedCount++;
    
    // authorNameフィールド
    const hasAuthorName = notif.hasOwnProperty('authorName') && typeof notif.authorName === 'string';
    logTestResult(`通知${index + 1} - authorNameフィールド`, hasAuthorName);
    if (hasAuthorName) passedCount++;
    
    // permalinkフィールド
    const hasPermalink = notif.hasOwnProperty('permalink') && typeof notif.permalink === 'string';
    logTestResult(`通知${index + 1} - permalinkフィールド`, hasPermalink);
    if (hasPermalink) passedCount++;
  });
  
  console.log(`\n結果: ${passedCount}/${totalCount} テスト合格\n`);
  return passedCount === totalCount;
}

/**
 * テスト8: 設定値検証のテスト
 */
function testValidateConfig() {
  console.log('\n=== テスト8: 設定値検証 ===');
  
  // 注意: 実際のScript Propertiesに依存するため、エラーハンドリングをテスト
  try {
    validateConfig();
    logTestResult('設定値検証（エラーなし）', true, 
      'Script Propertiesが正しく設定されています');
    return true;
  } catch (error) {
    logTestResult('設定値検証（エラーあり）', false, error.message);
    console.log('注意: Script Propertiesを設定してください:');
    console.log('  - SLACK_BOT_TOKEN');
    console.log('  - NOTION_API_TOKEN\n');
    return false;
  }
}

/**
 * 統合テスト: プロダクト名抽出とデータ構造の統合
 */
function testIntegrationProductNameExtraction() {
  console.log('\n=== 統合テスト: プロダクト名抽出 ===');
  
  const mockMessages = [
    {
      text: '[Eitoku v3.4.1(369)]リリースしました:tada: @channel\nリリース内容\n...',
      user: 'U05HPC0BL3V',
      expectedProduct: 'Eitoku'
    },
    {
      text: 'Juko 1.28.0 をリリースしました！\n主な変更\n...',
      user: 'U048M5NP6M6',
      expectedProduct: 'Juko'
    },
    {
      text: '[Karaku Admin] v2.9.3をリリースしました！@channel\nリリース内容\n...',
      user: 'U08TLQTUJ21',
      expectedProduct: 'Karaku Admin'
    }
  ];
  
  let passedCount = 0;
  const totalCount = mockMessages.length;
  
  mockMessages.forEach((msg, index) => {
    const productName = extractProductName(msg.text);
    const passed = productName === msg.expectedProduct;
    logTestResult(`統合テスト${index + 1}`, passed, 
      `期待値: "${msg.expectedProduct}", 結果: "${productName}"`);
    if (passed) passedCount++;
  });
  
  console.log(`\n結果: ${passedCount}/${totalCount} テスト合格\n`);
  return passedCount === totalCount;
}

/**
 * 全テストを実行
 */
function runAllTests() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║   Slackリリース通知Notion投稿 - テストスイート      ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  
  const results = [];
  
  // 各テストを実行
  results.push({ name: 'プロダクト名抽出', passed: testExtractProductName() });
  results.push({ name: '日付フォーマット変換', passed: testFormatDateToNotionFormat() });
  results.push({ name: '曜日名取得', passed: testGetDayOfWeekName() });
  results.push({ name: '営業日判定', passed: testIsBusinessDay() });
  results.push({ name: '前営業日計算', passed: testGetPreviousBusinessDayEnd() });
  results.push({ name: 'JST日付取得', passed: testGetJSTDate() });
  results.push({ name: 'リリース通知データ構造', passed: testReleaseNotificationStructure() });
  results.push({ name: '設定値検証', passed: testValidateConfig() });
  results.push({ name: '統合テスト（プロダクト名抽出）', passed: testIntegrationProductNameExtraction() });
  
  // 結果サマリー
  console.log('\n╔═══════════════════════════════════════════════════════╗');
  console.log('║                   テスト結果サマリー                  ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  
  results.forEach(result => {
    const status = result.passed ? '✅ PASS' : '❌ FAIL';
    console.log(`${status}: ${result.name}`);
  });
  
  console.log(`\n合計: ${passedTests}/${totalTests} テスト合格`);
  
  if (passedTests === totalTests) {
    console.log('\n🎉 全てのテストが合格しました！');
  } else {
    console.log('\n⚠️  一部のテストが失敗しました。詳細は上記を確認してください。');
  }
  
  return passedTests === totalTests;
}

/**
 * クイックテスト: 主要機能のみテスト
 */
function runQuickTest() {
  console.log('╔═══════════════════════════════════════════════════════╗');
  console.log('║              クイックテスト（主要機能）              ║');
  console.log('╚═══════════════════════════════════════════════════════╝\n');
  
  const results = [];
  results.push({ name: 'プロダクト名抽出', passed: testExtractProductName() });
  results.push({ name: '日付フォーマット変換', passed: testFormatDateToNotionFormat() });
  results.push({ name: '統合テスト（プロダクト名抽出）', passed: testIntegrationProductNameExtraction() });
  
  const passedTests = results.filter(r => r.passed).length;
  const totalTests = results.length;
  
  console.log(`\n結果: ${passedTests}/${totalTests} テスト合格`);
  return passedTests === totalTests;
}

