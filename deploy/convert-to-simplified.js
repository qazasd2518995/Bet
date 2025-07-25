import fs from 'fs';
import path from 'path';
import * as OpenCC from 'opencc-js';
import { execSync } from 'child_process';

// 初始化轉換器（繁體轉簡體）
const converter = OpenCC.Converter({ from: 'tw', to: 'cn' });

// 需要處理的文件擴展名
const FILE_EXTENSIONS = [
    '.js', '.html', '.css', '.json', '.md', '.sql', '.txt', '.yml', '.yaml',
    '.vue', '.jsx', '.ts', '.tsx', '.sh'
];

// 需要跳過的目錄
const SKIP_DIRS = [
    'node_modules', '.git', '.next', 'dist', 'build', '.cache',
    'coverage', '.pytest_cache', '__pycache__', '.vscode',
    'logs', 'tmp', 'temp', '.idea', 'vendor', 'deploy'
];

// 需要跳過的文件
const SKIP_FILES = [
    'package-lock.json', 'yarn.lock', 'pnpm-lock.yaml',
    '.gitignore', '.env.local', '.env.production',
    'convert-to-simplified.js', 'convert_to_simplified.py'
];

// 統計信息
const stats = {
    filesProcessed: 0,
    filesSkipped: 0,
    filesError: 0,
    totalConversions: 0
};

// 判斷是否應該處理此文件
function shouldProcessFile(filePath) {
    // 檢查文件擴展名
    const ext = path.extname(filePath).toLowerCase();
    if (!FILE_EXTENSIONS.includes(ext)) {
        return false;
    }
    
    // 檢查是否在跳過列表中
    const fileName = path.basename(filePath);
    if (SKIP_FILES.includes(fileName)) {
        return false;
    }
    
    // 檢查文件大小（跳過超過 10MB 的文件）
    try {
        const fileStats = fs.statSync(filePath);
        if (fileStats.size > 10 * 1024 * 1024) {
            console.log(`跳過大文件: ${filePath}`);
            return false;
        }
    } catch (e) {
        return false;
    }
    
    return true;
}

// 轉換文本內容
function convertContent(content) {
    try {
        // 使用 OpenCC 進行轉換
        let converted = converter(content);
        
        return converted;
    } catch (e) {
        console.error(`轉換錯誤: ${e}`);
        return content;
    }
}

// 處理單個文件
function processFile(filePath) {
    try {
        // 讀取文件
        const content = fs.readFileSync(filePath, 'utf8');
        
        // 轉換內容
        const originalContent = content;
        const convertedContent = convertContent(content);
        
        // 如果內容有變化，寫回文件
        if (originalContent !== convertedContent) {
            fs.writeFileSync(filePath, convertedContent, 'utf8');
            stats.totalConversions++;
            console.log(`✓ 已轉換: ${filePath}`);
        } else {
            console.log(`- 無需轉換: ${filePath}`);
        }
        
        stats.filesProcessed++;
        
    } catch (e) {
        console.error(`✗ 處理失敗: ${filePath} - ${e.message}`);
        stats.filesError++;
    }
}

// 遞歸處理目錄
function processDirectory(directory) {
    try {
        const items = fs.readdirSync(directory);
        
        items.forEach(item => {
            const itemPath = path.join(directory, item);
            const itemStats = fs.statSync(itemPath);
            
            if (itemStats.isDirectory()) {
                // 檢查是否應該跳過此目錄
                if (!SKIP_DIRS.includes(item)) {
                    processDirectory(itemPath);
                }
            } else if (itemStats.isFile()) {
                if (shouldProcessFile(itemPath)) {
                    processFile(itemPath);
                } else {
                    stats.filesSkipped++;
                }
            }
        });
    } catch (e) {
        console.error(`處理目錄失敗: ${directory} - ${e.message}`);
    }
}

// 主函數
async function main() {
    console.log("=== 繁體中文轉簡體中文工具 ===");
    console.log(`當前目錄: ${process.cwd()}`);
    console.log("");
    
    // 開始處理
    console.log("開始處理...\n");
    
    // 處理當前目錄
    processDirectory('.');
    
    // 顯示統計信息
    console.log("\n=== 轉換完成 ===");
    console.log(`處理文件數: ${stats.filesProcessed}`);
    console.log(`跳過文件數: ${stats.filesSkipped}`);
    console.log(`錯誤文件數: ${stats.filesError}`);
    console.log(`實際轉換數: ${stats.totalConversions}`);
    
    // 同步到 deploy 目錄
    if (stats.totalConversions > 0) {
        console.log("\n同步到 deploy 目錄...");
        try {
            execSync('rsync -av --exclude=node_modules --exclude=.git --exclude=.next --exclude=logs . deploy/', { stdio: 'inherit' });
            console.log("同步完成！");
            
            // 提交到 Git
            console.log("\n準備提交到 GitHub...");
            execSync('git add -A', { stdio: 'inherit' });
            execSync('git commit -m "將所有繁體中文轉換為簡體中文"', { stdio: 'inherit' });
            execSync('git push', { stdio: 'inherit' });
            console.log("已推送到 GitHub！");
        } catch (e) {
            console.error("執行命令時出錯:", e.message);
        }
    } else {
        console.log("\n沒有需要轉換的文件。");
    }
}

// 執行主函數
main().catch(console.error);