const pgp = require('pg-promise')();
const db = pgp({
  host: 'dpg-d0e2imc9c44c73che3kg-a.oregon-postgres.render.com',
  port: 5432,
  database: 'bet_game',
  user: 'bet_game_user',
  password: 'Vm4J5g1gymwPfBNcgYfGCe4GEZqCjoIy',
  ssl: true
});

async function checkAgentRebateValues() {
  try {
    console.log('Checking rebate_percentage values for agents...\n');
    
    // Query specific agents
    const agents = await db.any(`
      SELECT 
        username,
        rebate_percentage,
        max_rebate_percentage,
        market_type,
        level
      FROM agents
      WHERE username IN ('justin2025A', 'ti2025A')
      ORDER BY username
    `);
    
    if (agents.length === 0) {
      console.log('No agents found with usernames justin2025A or ti2025A');
      return;
    }
    
    console.log('Agent Rebate Information:');
    console.log('========================');
    
    agents.forEach(agent => {
      console.log(`\nAgent: ${agent.username}`);
      console.log(`  Level: ${agent.level}`);
      console.log(`  Market Type: ${agent.market_type}`);
      console.log(`  Rebate Percentage: ${agent.rebate_percentage}`);
      console.log(`  Max Rebate Percentage: ${agent.max_rebate_percentage}`);
      
      // Check if stored as decimal or percentage
      if (agent.rebate_percentage) {
        const rebateValue = parseFloat(agent.rebate_percentage);
        if (rebateValue < 1) {
          console.log(`  -> Stored as decimal (${rebateValue} = ${(rebateValue * 100).toFixed(1)}%)`);
        } else {
          console.log(`  -> Stored as percentage (${rebateValue}%)`);
        }
      }
    });
    
    // Also check the data type of the column
    console.log('\n\nColumn Information:');
    console.log('==================');
    const columnInfo = await db.any(`
      SELECT 
        column_name,
        data_type,
        numeric_precision,
        numeric_scale
      FROM information_schema.columns
      WHERE table_name = 'agents'
      AND column_name IN ('rebate_percentage', 'max_rebate_percentage')
    `);
    
    columnInfo.forEach(col => {
      console.log(`\nColumn: ${col.column_name}`);
      console.log(`  Data Type: ${col.data_type}`);
      console.log(`  Precision: ${col.numeric_precision}`);
      console.log(`  Scale: ${col.numeric_scale}`);
    });
    
  } catch (error) {
    console.error('Error checking agent rebate values:', error);
  } finally {
    pgp.end();
  }
}

checkAgentRebateValues();