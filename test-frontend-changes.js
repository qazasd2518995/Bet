// 快速測試前端修改是否生效
import fs from 'fs';
import path from 'path';

const frontendPath = '/Users/justin/Desktop/Bet/agent/frontend';

console.log('🔧 檢查前端修改是否正確應用...\n');

// 檢查 main.js 中的修改
const mainJsPath = path.join(frontendPath, 'js/main.js');
if (fs.existsSync(mainJsPath)) {
    const mainJsContent = fs.readFileSync(mainJsPath, 'utf8');
    
    console.log('1. 檢查 getLevelName 函數修改:');
    if (mainJsContent.includes("0: '總代理'")) {
        console.log('   ✅ getLevelName 函數已正確修改 (0: 總代理)');
    } else if (mainJsContent.includes("0: '客服'")) {
        console.log('   ❌ getLevelName 函數仍為舊版 (0: 客服)');
    } else {
        console.log('   ❓ 未找到 getLevelName 函數定義');
    }
    
    console.log('\n2. 檢查 changeMemberStatus 函數修改:');
    if (mainJsContent.includes('loadHierarchicalMembers()')) {
        console.log('   ✅ changeMemberStatus 函數已包含新的刷新邏輯');
    } else {
        console.log('   ❌ changeMemberStatus 函數缺少新的刷新邏輯');
    }
    
    console.log('\n3. 檢查 toggleMemberStatus 函數修改:');
    if (mainJsContent.includes('if (this.activeTab === \'accounts\' && this.hierarchicalMembers)')) {
        console.log('   ✅ toggleMemberStatus 函數已包含新的狀態更新邏輯');
    } else {
        console.log('   ❌ toggleMemberStatus 函數缺少新的狀態更新邏輯');
    }
} else {
    console.log('❌ 未找到 main.js 文件');
}

// 檢查 index.html 中的修改
const indexHtmlPath = path.join(frontendPath, 'index.html');
if (fs.existsSync(indexHtmlPath)) {
    const indexHtmlContent = fs.readFileSync(indexHtmlPath, 'utf8');
    
    console.log('\n4. 檢查 HTML 模板修改:');
    if (indexHtmlContent.includes('getLevelName((currentMemberManagingAgent')) {
        console.log('   ✅ HTML 模板中的級別顯示邏輯已正確設定');
    } else {
        console.log('   ❌ HTML 模板中的級別顯示邏輯可能有問題');
    }
} else {
    console.log('❌ 未找到 index.html 文件');
}

// 檢查是否有緩存問題
console.log('\n5. 緩存清除建議:');
console.log('   💡 請嘗試以下步驟清除緩存:');
console.log('   - 在瀏覽器中按 Ctrl+F5 (Windows) 或 Cmd+Shift+R (Mac) 硬重載');
console.log('   - 清除瀏覽器緩存和 Cookie');
console.log('   - 在開發者工具中禁用緩存');

console.log('\n6. 訪問 URL 檢查:');
console.log('   🌐 確保訪問: http://localhost:3003');
console.log('   🌐 不要訪問: http://localhost:3000 或其他端口');
