
// 環境檢查腳本
console.log('🔍 檢查部署環境...');
console.log('NODE_ENV:', process.env.NODE_ENV);
console.log('PORT:', process.env.PORT);
console.log('當前目錄:', process.cwd());
console.log('文件結構:');

const fs = require('fs');
const path = require('path');

function listDir(dir, prefix = '') {
    try {
        const items = fs.readdirSync(dir);
        items.forEach(item => {
            const fullPath = path.join(dir, item);
            const stats = fs.statSync(fullPath);
            console.log(prefix + (stats.isDirectory() ? '📁 ' : '📄 ') + item);
            if (stats.isDirectory() && !item.startsWith('.') && item !== 'node_modules') {
                listDir(fullPath, prefix + '  ');
            }
        });
    } catch (err) {
        console.error('無法讀取目錄:', dir, err.message);
    }
}

listDir('.');
