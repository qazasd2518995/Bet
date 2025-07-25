// check-settlement-logs-structure.js - Check the actual structure of settlement_logs table
import db from './db/config.js';

async function checkSettlementLogsStructure() {
    console.log('\n=== CHECKING SETTLEMENT_LOGS TABLE STRUCTURE ===\n');
    
    try {
        // 1. Check if settlement_logs table exists
        const tableExists = await db.oneOrNone(`
            SELECT EXISTS (
                SELECT FROM information_schema.tables 
                WHERE table_name = 'settlement_logs'
            );
        `);
        
        if (!tableExists.exists) {
            console.log('❌ settlement_logs table does not exist');
            return;
        }
        
        // 2. Get all columns from settlement_logs
        console.log('SETTLEMENT_LOGS TABLE COLUMNS:');
        const columns = await db.any(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_name = 'settlement_logs'
            ORDER BY ordinal_position
        `);
        
        console.log(`Found ${columns.length} columns:`);
        columns.forEach((col, index) => {
            console.log(`${index + 1}. ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}, Default: ${col.column_default || 'none'}`);
        });
        
        // 3. Check recent records
        console.log('\nRECENT SETTLEMENT_LOGS RECORDS:');
        const recentRecords = await db.any(`
            SELECT * FROM settlement_logs 
            ORDER BY created_at DESC 
            LIMIT 5
        `);
        
        if (recentRecords.length > 0) {
            console.log(`Found ${recentRecords.length} recent records:`);
            recentRecords.forEach((record, index) => {
                console.log(`\nRecord ${index + 1}:`);
                Object.keys(record).forEach(key => {
                    console.log(`  ${key}: ${record[key]}`);
                });
            });
        } else {
            console.log('No records found in settlement_logs table');
        }
        
    } catch (error) {
        console.error('Error checking settlement_logs structure:', error);
    } finally {
        await db.$pool.end();
    }
}

checkSettlementLogsStructure();