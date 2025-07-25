#!/usr/bin/env node

import pgPromise from 'pg-promise';
import readline from 'readline';

const pgp = pgPromise();

// 数据库配置 - 根据环境自动选择
const isRender = process.env.NODE_ENV === 'production' || process.env.RENDER;
const dbConfig = isRender ? {
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false }
} : {
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'bet_game',
    user: process.env.DB_USER || 'justin',
    password: process.env.DB_PASSWORD
};

const db = pgp(dbConfig);

const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout
});

async function askQuestion(question) {
    return new Promise(resolve => {
        rl.question(question, resolve);
    });
}

async function cleanDatabase() {
    try {
        console.log('🔍 开始数据库清理分析...\n');
        console.log(`📡 连接环境: ${isRender ? 'Render Production' : 'Local Development'}`);

        // 1. 分析当前数据状况
        console.log('\n=== 数据分析 ===');
        
        const totalCount = await db.one('SELECT COUNT(*) as count FROM result_history');
        console.log(`📊 总开奖记录数: ${totalCount.count}`);

        // 检查异常期号
        console.log('\n🔍 检查异常数据...');
        
        // 检查期号长度异常的记录
        const abnormalLength = await db.any(`
            SELECT period, LENGTH(period::text) as len, created_at 
            FROM result_history 
            WHERE LENGTH(period::text) NOT IN (11, 12)
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        if (abnormalLength.length > 0) {
            console.log(`❌ 发现 ${abnormalLength.length} 条期号长度异常的记录:`);
            abnormalLength.forEach((r, i) => {
                console.log(`  ${i+1}. 期号: ${r.period} (长度: ${r.len}), 时间: ${r.created_at}`);
            });
        }

        // 检查包含特殊字符的期号
        const specialChars = await db.any(`
            SELECT period, created_at 
            FROM result_history 
            WHERE period::text ~ '[^0-9]' OR period::text LIKE '%1111%'
            ORDER BY created_at DESC
            LIMIT 10
        `);
        
        if (specialChars.length > 0) {
            console.log(`❌ 发现 ${specialChars.length} 条包含异常字符的期号:`);
            specialChars.forEach((r, i) => {
                console.log(`  ${i+1}. 期号: ${r.period}, 时间: ${r.created_at}`);
            });
        }

        // 检查旧格式期号（12位数字）
        const oldFormatCount = await db.one(`
            SELECT COUNT(*) as count 
            FROM result_history 
            WHERE LENGTH(period::text) = 12 AND period::text ~ '^202[0-9]{9}$'
        `);
        console.log(`🗓️ 旧格式期号数量: ${oldFormatCount.count} 条`);

        // 检查新格式期号（11位数字，YYYYMMDDXXX）
        const newFormatCount = await db.one(`
            SELECT COUNT(*) as count 
            FROM result_history 
            WHERE LENGTH(period::text) = 11 AND period::text ~ '^202[0-9]{8}$'
        `);
        console.log(`📅 新格式期号数量: ${newFormatCount.count} 条`);

        // 检查今日数据
        const today = new Date();
        const todayStr = `${today.getFullYear()}${(today.getMonth()+1).toString().padStart(2,'0')}${today.getDate().toString().padStart(2,'0')}`;
        const todayCount = await db.one('SELECT COUNT(*) as count FROM result_history WHERE period::text LIKE $1', [`${todayStr}%`]);
        console.log(`📋 今日(${todayStr})数据: ${todayCount.count} 条`);

        console.log('\n=== 清理选项 ===');
        console.log('1. 删除异常长度的期号记录');
        console.log('2. 删除包含特殊字符的期号记录');
        console.log('3. 删除旧格式期号记录 (保留最近7天的新格式数据)');
        console.log('4. 只保留今日数据 (删除所有历史数据)');
        console.log('5. 全面清理 (选项1+2+3)');
        console.log('6. 重置所有数据 (删除所有记录，重新开始)');
        console.log('0. 取消操作');

        const choice = await askQuestion('\n请选择清理选项 (0-6): ');

        switch (choice) {
            case '1':
                await cleanAbnormalLength();
                break;
            case '2':
                await cleanSpecialCharacters();
                break;
            case '3':
                await cleanOldFormat();
                break;
            case '4':
                await keepTodayOnly(todayStr);
                break;
            case '5':
                await fullCleanup();
                break;
            case '6':
                await resetAllData();
                break;
            case '0':
                console.log('❌ 操作已取消');
                break;
            default:
                console.log('❌ 无效选项');
        }

    } catch (error) {
        console.error('❌ 清理过程出错:', error);
    } finally {
        rl.close();
        db.$pool.end();
    }
}

async function cleanAbnormalLength() {
    console.log('\n🧹 清理异常长度期号...');
    const result = await db.result(`
        DELETE FROM result_history 
        WHERE LENGTH(period::text) NOT IN (11, 12)
    `);
    console.log(`✅ 已删除 ${result.rowCount} 条异常长度记录`);
}

async function cleanSpecialCharacters() {
    console.log('\n🧹 清理特殊字符期号...');
    const result = await db.result(`
        DELETE FROM result_history 
        WHERE period::text ~ '[^0-9]' OR period::text LIKE '%1111%'
    `);
    console.log(`✅ 已删除 ${result.rowCount} 条特殊字符记录`);
}

async function cleanOldFormat() {
    console.log('\n🧹 清理旧格式期号（保留最近7天新格式数据）...');
    
    // 计算7天前的日期
    const sevenDaysAgo = new Date();
    sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
    const sevenDaysStr = `${sevenDaysAgo.getFullYear()}${(sevenDaysAgo.getMonth()+1).toString().padStart(2,'0')}${sevenDaysAgo.getDate().toString().padStart(2,'0')}`;
    
    const result = await db.result(`
        DELETE FROM result_history 
        WHERE LENGTH(period::text) = 12 
        OR (LENGTH(period::text) = 11 AND period::text < $1)
    `, [`${sevenDaysStr}000`]);
    
    console.log(`✅ 已删除 ${result.rowCount} 条旧格式记录`);
}

async function keepTodayOnly(todayStr) {
    console.log(`\n🧹 只保留今日(${todayStr})数据...`);
    
    const confirm = await askQuestion('⚠️  这将删除所有历史数据，只保留今日数据。确定继续吗？(yes/no): ');
    if (confirm.toLowerCase() !== 'yes') {
        console.log('❌ 操作已取消');
        return;
    }
    
    const result = await db.result(`
        DELETE FROM result_history 
        WHERE NOT period::text LIKE $1
    `, [`${todayStr}%`]);
    
    console.log(`✅ 已删除 ${result.rowCount} 条历史记录`);
}

async function fullCleanup() {
    console.log('\n🧹 执行全面清理...');
    
    // 先清理异常数据
    await cleanAbnormalLength();
    await cleanSpecialCharacters();
    await cleanOldFormat();
    
    console.log('✅ 全面清理完成');
}

async function resetAllData() {
    console.log('\n⚠️  重置所有数据');
    
    const confirm1 = await askQuestion('这将删除所有开奖记录，确定继续吗？(yes/no): ');
    if (confirm1.toLowerCase() !== 'yes') {
        console.log('❌ 操作已取消');
        return;
    }
    
    const confirm2 = await askQuestion('最后确认：真的要删除所有数据吗？(DELETE): ');
    if (confirm2 !== 'DELETE') {
        console.log('❌ 操作已取消');
        return;
    }
    
    const result = await db.result('DELETE FROM result_history');
    console.log(`✅ 已删除所有 ${result.rowCount} 条记录`);
    
    // 重置序列
    await db.none('ALTER SEQUENCE result_history_id_seq RESTART WITH 1');
    console.log('✅ 已重置ID序列');
}

// 执行清理
cleanDatabase().catch(console.error); 