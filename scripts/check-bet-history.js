import db from '../db/config.js';

async function checkBetHistory() {
    try {
        console.log('Checking bet_history table...\n');

        // Get total count
        const totalBets = await db.one('SELECT COUNT(*) FROM bet_history');
        const count = totalBets.count;
        console.log(`Total bets in history: ${count}`);

        if (count === '0') {
            console.log('\nNo bets found in bet_history table.');
            return;
        }

        // Get date range
        const dateRange = await db.one(`
            SELECT 
                MIN(created_at) as earliest_bet,
                MAX(created_at) as latest_bet,
                MIN(created_at)::date as earliest_date,
                MAX(created_at)::date as latest_date
            FROM bet_history
        `);
        console.log(`\nDate Range:`);
        console.log(`  Earliest bet: ${dateRange.earliest_bet}`);
        console.log(`  Latest bet: ${dateRange.latest_bet}`);
        console.log(`  Date span: ${dateRange.earliest_date} to ${dateRange.latest_date}`);

        // Get users who have placed bets
        const users = await db.any(`
            SELECT 
                username,
                COUNT(*) as bet_count,
                SUM(amount) as total_wagered,
                SUM(win_amount) as total_won,
                SUM(win_amount) - SUM(amount) as net_profit,
                MIN(created_at) as first_bet,
                MAX(created_at) as last_bet
            FROM bet_history
            GROUP BY username
            ORDER BY bet_count DESC
        `);

        console.log(`\nUsers who have placed bets (${users.length} total):`);
        console.log('─'.repeat(100));
        console.log('Username | Bets | Total Wagered | Total Won | Net Profit | First Bet | Last Bet');
        console.log('─'.repeat(100));

        users.forEach(user => {
            console.log(
                `${user.username.padEnd(8)} | ` +
                `${user.bet_count.toString().padEnd(5)} | ` +
                `$${parseFloat(user.total_wagered).toFixed(2).padEnd(13)} | ` +
                `$${parseFloat(user.total_won).toFixed(2).padEnd(9)} | ` +
                `$${parseFloat(user.net_profit).toFixed(2).padEnd(10)} | ` +
                `${new Date(user.first_bet).toISOString().split('T')[0]} | ` +
                `${new Date(user.last_bet).toISOString().split('T')[0]}`
            );
        });

        // Get bet distribution by date
        const dailyBets = await db.any(`
            SELECT 
                DATE(created_at) as bet_date,
                COUNT(*) as bet_count,
                COUNT(DISTINCT username) as unique_users,
                SUM(amount) as total_wagered,
                SUM(win_amount) as total_won
            FROM bet_history
            GROUP BY DATE(created_at)
            ORDER BY bet_date DESC
            LIMIT 20
        `);

        console.log(`\n\nDaily bet summary (last 30 days with data):`);
        console.log('─'.repeat(80));
        console.log('Date       | Bets | Users | Total Wagered | Total Won | House Edge');
        console.log('─'.repeat(80));

        dailyBets.forEach(day => {
            const houseEdge = ((parseFloat(day.total_wagered) - parseFloat(day.total_won)) / parseFloat(day.total_wagered) * 100).toFixed(2);
            console.log(
                `${day.bet_date.toISOString().split('T')[0]} | ` +
                `${day.bet_count.toString().padEnd(5)} | ` +
                `${day.unique_users.toString().padEnd(6)} | ` +
                `$${parseFloat(day.total_wagered).toFixed(2).padEnd(13)} | ` +
                `$${parseFloat(day.total_won).toFixed(2).padEnd(9)} | ` +
                `${houseEdge}%`
            );
        });

        // Get bet type distribution
        const betTypes = await db.any(`
            SELECT 
                bet_type,
                COUNT(*) as bet_count,
                SUM(amount) as total_wagered,
                AVG(amount) as avg_bet_size
            FROM bet_history
            GROUP BY bet_type
            ORDER BY bet_count DESC
        `);

        console.log(`\n\nBet type distribution:`);
        console.log('─'.repeat(70));
        console.log('Bet Type | Count | Total Wagered | Average Bet Size');
        console.log('─'.repeat(70));

        betTypes.forEach(type => {
            console.log(
                `${(type.bet_type || 'Unknown').padEnd(9)} | ` +
                `${type.bet_count.toString().padEnd(6)} | ` +
                `$${parseFloat(type.total_wagered).toFixed(2).padEnd(13)} | ` +
                `$${parseFloat(type.avg_bet_size).toFixed(2)}`
            );
        });

    } catch (error) {
        console.error('Error checking bet history:', error);
    } finally {
        // pg-promise handles connection pooling automatically
    }
}

// Run the check
checkBetHistory();