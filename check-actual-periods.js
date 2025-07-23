// check-actual-periods.js - Check what periods are actually in the database
import db from './db/config.js';

async function checkActualPeriods() {
  try {
    console.log('=== Checking Actual Periods in Database ===\n');

    // 1. Check the latest periods in result_history
    console.log('1. Latest 20 periods in result_history:');
    const latestResultHistory = await db.manyOrNone(`
      SELECT period, draw_time, created_at,
             position_1, position_2, position_3, position_4, position_5,
             position_6, position_7, position_8, position_9, position_10
      FROM result_history
      ORDER BY period DESC
      LIMIT 20
    `);
    
    if (latestResultHistory.length > 0) {
      latestResultHistory.forEach(record => {
        const positions = `${record.position_1},${record.position_2},${record.position_3},${record.position_4},${record.position_5},${record.position_6},${record.position_7},${record.position_8},${record.position_9},${record.position_10}`;
        console.log(`  Period ${record.period}: ${positions} (${record.draw_time || 'No draw time'})`);
      });
    } else {
      console.log('  No records found');
    }

    // 2. Check the latest periods in draw_records
    console.log('\n2. Latest 20 periods in draw_records:');
    const latestDrawRecords = await db.manyOrNone(`
      SELECT period, result, draw_time, created_at
      FROM draw_records
      ORDER BY CAST(period AS BIGINT) DESC
      LIMIT 20
    `);
    
    if (latestDrawRecords.length > 0) {
      latestDrawRecords.forEach(record => {
        console.log(`  Period ${record.period}: ${JSON.stringify(record.result)} (${record.draw_time || 'No draw time'})`);
      });
    } else {
      console.log('  No records found');
    }

    // 3. Check if there's any period around 544
    console.log('\n3. Checking for periods around 544 (540-550):');
    const nearbyPeriods = await db.manyOrNone(`
      SELECT period, 
             position_1, position_2, position_3, position_4,
             draw_time
      FROM result_history
      WHERE period BETWEEN 540 AND 550
      ORDER BY period ASC
    `);
    
    if (nearbyPeriods.length > 0) {
      nearbyPeriods.forEach(record => {
        console.log(`  Period ${record.period}: ${record.position_1},${record.position_2},${record.position_3},${record.position_4} (${record.draw_time || 'No draw time'})`);
      });
    } else {
      console.log('  No periods found in range 540-550');
    }

    // 4. Check the total count and period range
    console.log('\n4. Period statistics:');
    const stats = await db.one(`
      SELECT 
        COUNT(*) as total_count,
        MIN(period) as min_period,
        MAX(period) as max_period
      FROM result_history
    `);
    console.log(`  Total periods: ${stats.total_count}`);
    console.log(`  Period range: ${stats.min_period} to ${stats.max_period}`);

    // 5. Check if there's a gap around period 544
    console.log('\n5. Checking for gaps in periods (530-560):');
    const periodGaps = await db.manyOrNone(`
      WITH period_sequence AS (
        SELECT generate_series(530, 560) as expected_period
      )
      SELECT ps.expected_period
      FROM period_sequence ps
      LEFT JOIN result_history rh ON ps.expected_period = rh.period
      WHERE rh.period IS NULL
      ORDER BY ps.expected_period
    `);
    
    if (periodGaps.length > 0) {
      console.log('  Missing periods:');
      console.log('  ' + periodGaps.map(g => g.expected_period).join(', '));
    } else {
      console.log('  No gaps found in period range 530-560');
    }

  } catch (error) {
    console.error('Error checking actual periods:', error);
  } finally {
    await db.$pool.end();
  }
}

checkActualPeriods();