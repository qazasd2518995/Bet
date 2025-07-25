// investigate-period-544.js - Script to investigate period 544 discrepancies
import db from './db/config.js';

async function investigatePeriod544() {
  try {
    console.log('=== Investigating Period 544 ===\n');

    // 1. Check result_history table
    console.log('1. Checking result_history table:');
    const resultHistory = await db.manyOrNone(`
      SELECT period, result, created_at, draw_time,
             position_1, position_2, position_3, position_4, position_5,
             position_6, position_7, position_8, position_9, position_10
      FROM result_history
      WHERE period = 544
      ORDER BY created_at DESC
    `);
    
    if (resultHistory.length > 0) {
      console.log(`Found ${resultHistory.length} record(s) in result_history:`);
      resultHistory.forEach((record, index) => {
        console.log(`\nRecord ${index + 1}:`);
        console.log(`  Period: ${record.period}`);
        console.log(`  Result JSON: ${JSON.stringify(record.result)}`);
        console.log(`  Positions: ${record.position_1},${record.position_2},${record.position_3},${record.position_4},${record.position_5},${record.position_6},${record.position_7},${record.position_8},${record.position_9},${record.position_10}`);
        console.log(`  Draw Time: ${record.draw_time}`);
        console.log(`  Created: ${record.created_at}`);
      });
    } else {
      console.log('No records found in result_history for period 544');
    }

    // 2. Check draw_records table
    console.log('\n\n2. Checking draw_records table:');
    const drawRecords = await db.manyOrNone(`
      SELECT period, result, created_at, draw_time
      FROM draw_records
      WHERE period = '544'
      ORDER BY created_at DESC
    `);
    
    if (drawRecords.length > 0) {
      console.log(`Found ${drawRecords.length} record(s) in draw_records:`);
      drawRecords.forEach((record, index) => {
        console.log(`\nRecord ${index + 1}:`);
        console.log(`  Period: ${record.period}`);
        console.log(`  Result JSONB: ${JSON.stringify(record.result)}`);
        console.log(`  Draw Time: ${record.draw_time}`);
        console.log(`  Created: ${record.created_at}`);
      });
    } else {
      console.log('No records found in draw_records for period 544');
    }

    // 3. Check for any bets on period 544
    console.log('\n\n3. Checking bet_history for period 544:');
    const betCount = await db.one(`
      SELECT COUNT(*) as count
      FROM bet_history
      WHERE period = 544
    `);
    console.log(`Found ${betCount.count} bets for period 544`);

    // 4. Check the latest periods to see context
    console.log('\n\n4. Checking latest periods in result_history:');
    const latestPeriods = await db.manyOrNone(`
      SELECT period, result, draw_time, created_at,
             position_1, position_2, position_3, position_4
      FROM result_history
      WHERE period BETWEEN 540 AND 550
      ORDER BY period DESC
    `);
    
    if (latestPeriods.length > 0) {
      console.log('Recent periods:');
      latestPeriods.forEach(record => {
        console.log(`  Period ${record.period}: First 4 positions: ${record.position_1},${record.position_2},${record.position_3},${record.position_4} | Full result: ${JSON.stringify(record.result)}`);
      });
    }

    // 5. Check for duplicate period numbers
    console.log('\n\n5. Checking for duplicate period numbers:');
    const duplicates = await db.manyOrNone(`
      SELECT period, COUNT(*) as count
      FROM result_history
      WHERE period BETWEEN 540 AND 550
      GROUP BY period
      HAVING COUNT(*) > 1
    `);
    
    if (duplicates.length > 0) {
      console.log('Found duplicate periods:');
      duplicates.forEach(dup => {
        console.log(`  Period ${dup.period}: ${dup.count} records`);
      });
    } else {
      console.log('No duplicate periods found');
    }

    // 6. Check if there's a mismatch between displayed result format
    console.log('\n\n6. Analyzing result format for period 544:');
    if (resultHistory.length > 0) {
      const result = resultHistory[0].result;
      console.log(`Raw result string: "${result}"`);
      console.log(`Result length: ${result.length} characters`);
      
      // Check if it's comma-separated
      if (result.includes(',')) {
        const parts = result.split(',');
        console.log(`Comma-separated values: [${parts.join(', ')}]`);
        console.log(`Number of values: ${parts.length}`);
        
        // Check if we're showing only first 4
        if (parts.length >= 4) {
          console.log(`First 4 values: ${parts.slice(0, 4).join(',')}`);
          console.log(`All 10 values: ${parts.join(',')}`);
        }
      }
    }

  } catch (error) {
    console.error('Error investigating period 544:', error);
  } finally {
    await db.$pool.end();
  }
}

investigatePeriod544();