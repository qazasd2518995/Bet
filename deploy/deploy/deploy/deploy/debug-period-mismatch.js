// debug-period-mismatch.js - Comprehensive debugging for period display mismatch
import db from './db/config.js';

async function debugPeriodMismatch() {
  try {
    console.log('=== Debugging Period Display Mismatch ===\n');

    // 1. Get the latest result from the API endpoint logic
    console.log('1. Checking /api/results/latest endpoint logic:');
    const latestResult = await db.oneOrNone(`
      SELECT period, result, created_at,
             position_1, position_2, position_3, position_4, position_5,
             position_6, position_7, position_8, position_9, position_10
      FROM result_history 
      ORDER BY created_at DESC 
      LIMIT 1
    `);
    
    if (latestResult) {
      console.log(`Latest period: ${latestResult.period}`);
      const positionArray = [];
      for (let i = 1; i <= 10; i++) {
        positionArray.push(latestResult[`position_${i}`]);
      }
      console.log(`Position array: [${positionArray.join(',')}]`);
      console.log(`Created at: ${latestResult.created_at}\n`);
    } else {
      console.log('No results found in result_history\n');
    }

    // 2. Check for any periods ending with 544
    console.log('2. Searching for any periods ending with "544":');
    const periods544 = await db.any(`
      SELECT period, result, created_at,
             position_1, position_2, position_3, position_4, position_5,
             position_6, position_7, position_8, position_9, position_10
      FROM result_history
      WHERE period::text LIKE '%544'
      ORDER BY created_at DESC
      LIMIT 5
    `);
    
    if (periods544.length > 0) {
      console.log(`Found ${periods544.length} periods ending with 544:`);
      periods544.forEach(record => {
        const positions = [];
        for (let i = 1; i <= 10; i++) {
          positions.push(record[`position_${i}`]);
        }
        console.log(`Period ${record.period}: [${positions.join(',')}]`);
      });
    } else {
      console.log('No periods ending with 544 found');
    }
    console.log('');

    // 3. Check game_state table
    console.log('3. Checking game_state table:');
    const gameState = await db.oneOrNone(`
      SELECT * FROM game_state 
      WHERE id = 1
    `);
    
    if (gameState) {
      console.log(`Current period: ${gameState.current_period}`);
      console.log(`Game status: ${gameState.game_status}`);
      console.log(`Last result: ${JSON.stringify(gameState.last_result)}`);
      console.log(`Updated at: ${gameState.updated_at}\n`);
    } else {
      console.log('No game state found\n');
    }

    // 4. Check history API logic - simulate what the history modal would see
    console.log('4. Simulating /api/history endpoint for today:');
    const today = new Date().toISOString().split('T')[0];
    const historyResults = await db.any(`
      SELECT period, result, created_at,
             position_1, position_2, position_3, position_4, position_5,
             position_6, position_7, position_8, position_9, position_10
      FROM result_history 
      WHERE result IS NOT NULL 
        AND position_1 IS NOT NULL 
        AND LENGTH(period::text) = 11
        AND DATE(created_at) = $1
      ORDER BY created_at DESC 
      LIMIT 20
    `, [today]);
    
    if (historyResults.length > 0) {
      console.log(`Found ${historyResults.length} results for today (${today}):`);
      historyResults.slice(0, 5).forEach(record => {
        const positionArray = [];
        for (let i = 1; i <= 10; i++) {
          positionArray.push(record[`position_${i}`]);
        }
        console.log(`Period ${record.period}: [${positionArray.join(',')}]`);
      });
    } else {
      console.log(`No results found for today (${today})`);
    }
    console.log('');

    // 5. Check for data inconsistencies
    console.log('5. Checking for data inconsistencies:');
    
    // Check if result field matches position fields
    const mismatchedRecords = await db.any(`
      SELECT period, result,
             position_1, position_2, position_3, position_4, position_5,
             position_6, position_7, position_8, position_9, position_10
      FROM result_history
      WHERE result IS NOT NULL
        AND position_1 IS NOT NULL
      ORDER BY created_at DESC
      LIMIT 10
    `);
    
    let inconsistentCount = 0;
    mismatchedRecords.forEach(record => {
      const positionArray = [];
      for (let i = 1; i <= 10; i++) {
        positionArray.push(record[`position_${i}`]);
      }
      
      // Parse result field
      let resultArray = [];
      try {
        if (typeof record.result === 'string') {
          resultArray = JSON.parse(record.result);
        } else if (Array.isArray(record.result)) {
          resultArray = record.result;
        }
      } catch (e) {
        // Ignore parse errors
      }
      
      // Compare
      const positionsMatch = JSON.stringify(positionArray) === JSON.stringify(resultArray);
      if (!positionsMatch && resultArray.length > 0) {
        inconsistentCount++;
        console.log(`\nInconsistency found in period ${record.period}:`);
        console.log(`  Position fields: [${positionArray.join(',')}]`);
        console.log(`  Result field: [${resultArray.join(',')}]`);
      }
    });
    
    if (inconsistentCount === 0) {
      console.log('No inconsistencies found between result and position fields');
    } else {
      console.log(`\nFound ${inconsistentCount} periods with inconsistent data`);
    }

    // 6. Frontend debugging suggestions
    console.log('\n\n=== Frontend Debugging Suggestions ===');
    console.log('1. The main display might be showing cached data or a truncated result');
    console.log('2. Check if the frontend is slicing the results array somewhere');
    console.log('3. Verify that both displays are showing the same period number');
    console.log('4. The issue might be CSS-related if only 4 numbers are visible');
    console.log('\nTo fix the synchronization issue:');
    console.log('1. Ensure both displays use the same data source');
    console.log('2. Clear any cached data when switching between views');
    console.log('3. Verify that the period numbers match exactly');
    console.log('4. Check for any frontend code that might limit the display to 4 numbers');

  } catch (error) {
    console.error('Error during debugging:', error);
  } finally {
    await db.$pool.end();
  }
}

debugPeriodMismatch();