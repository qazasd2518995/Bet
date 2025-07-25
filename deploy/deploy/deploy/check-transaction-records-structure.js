// check-transaction-records-structure.js - Check the actual structure of transaction_records table
import db from './db/config.js';

async function checkTransactionRecordsStructure() {
    console.log('\n=== CHECKING TRANSACTION_RECORDS TABLE STRUCTURE ===\n');
    
    try {
        // 1. Get all columns from transaction_records
        console.log('1. ALL COLUMNS IN TRANSACTION_RECORDS TABLE:');
        const columns = await db.any(`
            SELECT 
                column_name, 
                data_type, 
                is_nullable,
                column_default
            FROM information_schema.columns 
            WHERE table_name = 'transaction_records'
            ORDER BY ordinal_position
        `);
        
        console.log(`Found ${columns.length} columns:`);
        columns.forEach((col, index) => {
            console.log(`${index + 1}. ${col.column_name} (${col.data_type}) - Nullable: ${col.is_nullable}, Default: ${col.column_default || 'none'}`);
        });
        
        // 2. Check a sample record to see actual data
        console.log('\n2. SAMPLE TRANSACTION RECORD:');
        const sampleRecord = await db.oneOrNone(`
            SELECT * FROM transaction_records 
            LIMIT 1
        `);
        
        if (sampleRecord) {
            console.log('Sample record structure:');
            Object.keys(sampleRecord).forEach(key => {
                console.log(`- ${key}: ${typeof sampleRecord[key]} (value: ${sampleRecord[key]})`);
            });
        } else {
            console.log('No records found in transaction_records table');
        }
        
        // 3. Now query specifically for period 20250716121
        console.log('\n3. QUERYING PERIOD 20250716121:');
        const period = '20250716121';
        
        // Use SELECT * to get all columns
        const periodRecords = await db.any(`
            SELECT * FROM transaction_records 
            WHERE period = $1::text
            ORDER BY created_at ASC
        `, [period]);
        
        console.log(`Found ${periodRecords.length} records for period ${period}`);
        
        if (periodRecords.length > 0) {
            // Group by type
            const byType = {};
            periodRecords.forEach(record => {
                const type = record.type || record.transaction_type || 'unknown';
                if (!byType[type]) byType[type] = [];
                byType[type].push(record);
            });
            
            Object.keys(byType).forEach(type => {
                console.log(`\n${type.toUpperCase()} transactions (${byType[type].length}):`);
                byType[type].forEach((record, index) => {
                    console.log(`\nRecord ${index + 1}:`);
                    // Show relevant fields based on what exists
                    const fieldsToShow = ['id', 'member_id', 'user_id', 'amount', 'rebate_percentage', 'description', 'created_at', 'bet_id'];
                    fieldsToShow.forEach(field => {
                        if (field in record) {
                            console.log(`  ${field}: ${record[field]}`);
                        }
                    });
                });
            });
            
            // Check specifically for rebate records
            const rebateRecords = periodRecords.filter(r => 
                (r.type === 'rebate' || r.transaction_type === 'rebate')
            );
            
            if (rebateRecords.length > 0) {
                console.log(`\n4. REBATE ANALYSIS:`);
                console.log(`Found ${rebateRecords.length} rebate transactions`);
                
                // Check rebate_percentage values
                const withPercentage = rebateRecords.filter(r => r.rebate_percentage !== null && r.rebate_percentage !== undefined);
                console.log(`- Records with rebate_percentage: ${withPercentage.length}`);
                
                if (withPercentage.length > 0) {
                    console.log('\nRebate percentages:');
                    withPercentage.forEach(r => {
                        const memberId = r.member_id || r.user_id;
                        console.log(`- Member ${memberId}: ${r.rebate_percentage}% (Amount: ${r.amount})`);
                    });
                }
            }
        }
        
    } catch (error) {
        console.error('Error checking table structure:', error);
    } finally {
        await db.$pool.end();
    }
}

// Run the check
checkTransactionRecordsStructure();