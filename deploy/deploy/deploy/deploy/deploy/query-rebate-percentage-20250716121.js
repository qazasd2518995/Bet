// query-rebate-percentage-20250716121.js - Query transaction_records for rebate_percentage values
import db from './db/config.js';

const PERIOD = '20250716121';

async function queryRebatePercentages() {
    console.log(`\n=== QUERYING REBATE_PERCENTAGE VALUES FOR PERIOD ${PERIOD} ===\n`);
    
    try {
        // 1. First check if rebate_percentage column exists
        console.log('1. CHECKING TABLE STRUCTURE:');
        const columnCheck = await db.oneOrNone(`
            SELECT column_name, data_type, is_nullable
            FROM information_schema.columns 
            WHERE table_name = 'transaction_records' 
            AND column_name = 'rebate_percentage'
        `);
        
        if (!columnCheck) {
            console.log('WARNING: rebate_percentage column does not exist in transaction_records table');
            console.log('\nChecking all columns in transaction_records:');
            
            const allColumns = await db.any(`
                SELECT column_name, data_type, is_nullable
                FROM information_schema.columns 
                WHERE table_name = 'transaction_records'
                ORDER BY ordinal_position
            `);
            
            console.log('Available columns:');
            allColumns.forEach(col => {
                console.log(`- ${col.column_name} (${col.data_type})`);
            });
        } else {
            console.log(`rebate_percentage column exists: ${columnCheck.data_type}`);
        }
        
        // 2. Query all transaction records for this period
        console.log(`\n2. QUERYING ALL TRANSACTION RECORDS FOR PERIOD ${PERIOD}:`);
        
        // Build query based on whether rebate_percentage exists
        let query;
        if (columnCheck) {
            query = `
                SELECT 
                    transaction_id,
                    member_id,
                    period,
                    type,
                    amount,
                    rebate_percentage,
                    description,
                    created_at,
                    bet_id
                FROM transaction_records 
                WHERE period = $1::text
                ORDER BY created_at ASC
            `;
        } else {
            query = `
                SELECT 
                    transaction_id,
                    member_id,
                    period,
                    type,
                    amount,
                    description,
                    created_at,
                    bet_id
                FROM transaction_records 
                WHERE period = $1::text
                ORDER BY created_at ASC
            `;
        }
        
        const transactions = await db.any(query, [PERIOD]);
        
        console.log(`Found ${transactions.length} transactions for period ${PERIOD}`);
        
        if (transactions.length > 0) {
            // Group by transaction type
            const byType = {};
            transactions.forEach(t => {
                if (!byType[t.type]) byType[t.type] = [];
                byType[t.type].push(t);
            });
            
            Object.keys(byType).forEach(type => {
                console.log(`\n${type.toUpperCase()} transactions (${byType[type].length}):`);
                byType[type].forEach(t => {
                    console.log(`- Transaction ${t.transaction_id}:`);
                    console.log(`  Member ID: ${t.member_id}`);
                    console.log(`  Amount: ${t.amount}`);
                    if (columnCheck && t.rebate_percentage !== null) {
                        console.log(`  Rebate Percentage: ${t.rebate_percentage}%`);
                    }
                    console.log(`  Description: ${t.description || 'N/A'}`);
                    console.log(`  Created: ${t.created_at}`);
                    if (t.bet_id) {
                        console.log(`  Related Bet ID: ${t.bet_id}`);
                    }
                });
            });
        }
        
        // 3. Specifically look for rebate transactions
        console.log(`\n3. ANALYZING REBATE TRANSACTIONS:`);
        const rebateTransactions = transactions.filter(t => t.type === 'rebate');
        
        if (rebateTransactions.length > 0) {
            console.log(`Found ${rebateTransactions.length} rebate transactions`);
            
            // Check if rebate_percentage values are recorded
            if (columnCheck) {
                const withPercentage = rebateTransactions.filter(t => t.rebate_percentage !== null);
                const withoutPercentage = rebateTransactions.filter(t => t.rebate_percentage === null);
                
                console.log(`- With rebate_percentage: ${withPercentage.length}`);
                console.log(`- Without rebate_percentage: ${withoutPercentage.length}`);
                
                if (withPercentage.length > 0) {
                    console.log('\nRebate percentages recorded:');
                    withPercentage.forEach(t => {
                        console.log(`- Member ${t.member_id}: ${t.rebate_percentage}% (Amount: ${t.amount})`);
                    });
                }
            }
            
            // Calculate total rebate amount
            const totalRebate = rebateTransactions.reduce((sum, t) => sum + parseFloat(t.amount), 0);
            console.log(`\nTotal rebate amount: ${totalRebate.toFixed(2)}`);
        } else {
            console.log('No rebate transactions found for this period');
        }
        
        // 4. Cross-check with bet_history
        console.log(`\n4. CROSS-CHECKING WITH BET_HISTORY:`);
        const bets = await db.any(`
            SELECT 
                bet_id,
                member_id,
                amount,
                status,
                is_settled
            FROM bet_history 
            WHERE period = $1::bigint
        `, [PERIOD]);
        
        console.log(`Found ${bets.length} bets for period ${PERIOD}`);
        
        if (bets.length > 0 && rebateTransactions.length === 0) {
            console.log('\nWARNING: Bets exist but no rebates were processed!');
            console.log('This might indicate the rebate calculation error prevented processing.');
        }
        
        // 5. Check for any error logs in description
        console.log(`\n5. CHECKING FOR ERROR INDICATORS:`);
        const errorTransactions = transactions.filter(t => 
            t.description && 
            (t.description.toLowerCase().includes('error') || 
             t.description.toLowerCase().includes('fail'))
        );
        
        if (errorTransactions.length > 0) {
            console.log(`Found ${errorTransactions.length} transactions with error indicators:`);
            errorTransactions.forEach(t => {
                console.log(`- ${t.type}: ${t.description}`);
            });
        }
        
    } catch (error) {
        console.error('Error querying rebate percentages:', error);
    } finally {
        await db.$pool.end();
    }
}

// Run the query
queryRebatePercentages();