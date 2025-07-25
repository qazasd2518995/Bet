import fs from 'fs';

console.log('=== 驗證 enhanced-settlement-system.js 版本 ===\n');

const filePath = './enhanced-settlement-system.js';
const content = fs.readFileSync(filePath, 'utf8');

// 檢查是否包含修復代碼
const hasFixLine1 = content.includes('即使沒有未結算投注，也要檢查是否需要處理退水');
const hasFixLine2 = content.includes('發現已結算但未處理退水的注單，開始處理退水');
const hasFixInNoUnsettled = content.includes('if (!unsettledBets || unsettledBets.length === 0)') && 
                            content.includes('const hasSettledBets = await t.oneOrNone');

console.log('檢查修復代碼:');
console.log(`  包含註釋"即使沒有未結算投注，也要檢查是否需要處理退水": ${hasFixLine1 ? '✅ 是' : '❌ 否'}`);
console.log(`  包含日誌"發現已結算但未處理退水的注單": ${hasFixLine2 ? '✅ 是' : '❌ 否'}`);
console.log(`  在沒有未結算投注時檢查退水: ${hasFixInNoUnsettled ? '✅ 是' : '❌ 否'}`);

console.log('\n結論:');
if (hasFixLine1 && hasFixLine2 && hasFixInNoUnsettled) {
  console.log('✅ 文件包含最新的修復');
  console.log('\n但是後端進程需要重啟才能載入這些修改！');
  console.log('\n期號 20250716041 (1:37 AM) 使用的是舊版本，因為:');
  console.log('- 修復時間: 1:34 AM (9:34 AM 顯示時間)');
  console.log('- 進程啟動: Monday 6PM');
  console.log('- 結算時間: 1:37 AM');
  console.log('\n後端進程從 Monday 6PM 運行至今，沒有載入新的修復。');
} else {
  console.log('❌ 文件可能不包含最新的修復');
}

// 檢查文件修改時間
const stats = fs.statSync(filePath);
console.log(`\n文件最後修改時間: ${stats.mtime}`);

console.log('\n解決方案:');
console.log('1. 立即重啟後端進程:');
console.log('   kill 89931  # 終止 backend.js');
console.log('   kill 89933  # 終止 agentBackend.js');
console.log('   npm start   # 重新啟動');
console.log('\n2. 手動處理遺漏的退水:');
console.log('   node process-single-period-rebate.js 20250716041');