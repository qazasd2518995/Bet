const fs = require('fs');
const path = require('path');

// 需要修改的文件路徑
const files = [
    'frontend/index.html',
    'deploy/frontend/index.html'
];

// 需要替換的console.log模式
const replacements = [
    // 移除結果數據的顯示
    {
        from: /console\.log\(`✅ 獲取到有效的最新開獎結果: 期號=\${data\.result\.period}, 結果=`, resultArray\);/g,
        to: 'console.log(`✅ 獲取到有效的最新開獎結果: 期號=${data.result.period}`);'
    },
    {
        from: /console\.log\('🎯 獲取到最新開獎結果:', latestResult\);/g,
        to: 'console.log(\'🎯 獲取到最新開獎結果\');'
    },
    {
        from: /console\.log\(`🎯 顯示第\${index\+1}位結果: \${this\.lastResults\[index]}`\);/g,
        to: 'console.log(`🎯 顯示第${index+1}位結果`);'
    },
    {
        from: /console\.log\('🏆 開獎結果出來了，賽車競賽結束:', results\);/g,
        to: 'console.log(\'🏆 開獎結果出來了，賽車競賽結束\');'
    },
    {
        from: /console\.log\('🏁 當期開獎結果:', this\.lastResults\);/g,
        to: 'console.log(\'🏁 當期開獎結果已載入\');'
    },
    {
        from: /console\.log\('🏁 賽車開始！目標結果:', this\.lastResults\);/g,
        to: 'console.log(\'🏁 賽車開始！\');'
    },
    {
        from: /console\.log\(' 顯示開獎結果:', this\.lastResults\);/g,
        to: 'console.log(\'📊 顯示開獎結果\');'
    },
    {
        from: /console\.log\('賽車結果順序:', results\);/g,
        to: 'console.log(\'賽車結果順序已確定\');'
    },
    {
        from: /console\.log\(`✅ 第一次嘗試成功，獲取到結果:`, latestResult\);/g,
        to: 'console.log(`✅ 第一次嘗試成功，獲取到結果`);'
    },
    {
        from: /console\.log\(`✅ 第二次嘗試成功，獲取到結果:`, latestResult2\);/g,
        to: 'console.log(`✅ 第二次嘗試成功，獲取到結果`);'
    },
    {
        from: /console\.log\(`✅ 第三次嘗試成功，從遊戲數據獲取到結果:`, this\.lastResults\);/g,
        to: 'console.log(`✅ 第三次嘗試成功，從遊戲數據獲取到結果`);'
    },
    {
        from: /console\.warn\('⚠️ 結果數據格式不正確:', resultArray\);/g,
        to: 'console.warn(\'⚠️ 結果數據格式不正確\');'
    }
];

// 處理每個文件
files.forEach(filePath => {
    if (fs.existsSync(filePath)) {
        console.log(`正在處理文件: ${filePath}`);
        
        let content = fs.readFileSync(filePath, 'utf8');
        let modified = false;
        
        // 應用所有替換規則
        replacements.forEach(replacement => {
            const beforeCount = (content.match(replacement.from) || []).length;
            content = content.replace(replacement.from, replacement.to);
            const afterCount = (content.match(replacement.from) || []).length;
            
            if (beforeCount > afterCount) {
                console.log(`  - 替換了 ${beforeCount - afterCount} 處敏感console輸出`);
                modified = true;
            }
        });
        
        if (modified) {
            fs.writeFileSync(filePath, content, 'utf8');
            console.log(`✅ ${filePath} 安全性修復完成`);
        } else {
            console.log(`ℹ️ ${filePath} 無需修改`);
        }
    } else {
        console.log(`⚠️ 文件不存在: ${filePath}`);
    }
});

console.log('\n🔒 Console安全性修復完成，已移除所有敏感的開獎結果顯示'); 