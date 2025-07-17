// check-table-structure-20250716121.js - Check database table structure
import db from './db/config.js';

async function checkTableStructure() {
    console.log('\n=== CHECKING DATABASE TABLE STRUCTURE ===\n');
    
    try {
        // Get all tables
        const tables = await db.any(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            ORDER BY table_name
        `);
        
        console.log('Available tables:');
        tables.forEach(t => console.log(`- ${t.table_name}`));
        
        // Check bet_history table columns
        console.log('\n=== BET_HISTORY TABLE STRUCTURE ===');
        const betHistoryColumns = await db.any(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'bet_history'
            ORDER BY ordinal_position
        `);
        
        if (betHistoryColumns.length > 0) {
            console.log('Columns in bet_history:');
            betHistoryColumns.forEach(col => {
                console.log(`- ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
            });
        } else {
            console.log('bet_history table not found!');
        }
        
        // Check transaction_records table columns
        console.log('\n=== TRANSACTION_RECORDS TABLE STRUCTURE ===');
        const transactionColumns = await db.any(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'transaction_records'
            ORDER BY ordinal_position
        `);
        
        if (transactionColumns.length > 0) {
            console.log('Columns in transaction_records:');
            transactionColumns.forEach(col => {
                console.log(`- ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
            });
        } else {
            console.log('transaction_records table not found!');
        }
        
        // Check result_history table columns
        console.log('\n=== RESULT_HISTORY TABLE STRUCTURE ===');
        const resultColumns = await db.any(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns
            WHERE table_name = 'result_history'
            ORDER BY ordinal_position
        `);
        
        if (resultColumns.length > 0) {
            console.log('Columns in result_history:');
            resultColumns.forEach(col => {
                console.log(`- ${col.column_name} (${col.data_type}) ${col.is_nullable === 'NO' ? 'NOT NULL' : ''}`);
            });
        } else {
            console.log('result_history table not found!');
        }
        
        // Look for any table that might contain bet data
        console.log('\n=== SEARCHING FOR BET-RELATED TABLES ===');
        const betTables = await db.any(`
            SELECT table_name 
            FROM information_schema.tables 
            WHERE table_schema = 'public' 
            AND (table_name LIKE '%bet%' OR table_name LIKE '%wager%' OR table_name LIKE '%game%')
            ORDER BY table_name
        `);
        
        console.log('Found bet-related tables:');
        betTables.forEach(t => console.log(`- ${t.table_name}`));
        
    } catch (error) {
        console.error('Error checking table structure:', error);
    } finally {
        await db.$pool.end();
    }
}

checkTableStructure();