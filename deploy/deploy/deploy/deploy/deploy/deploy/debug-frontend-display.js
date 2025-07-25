#!/usr/bin/env node

/**
 * Debug Script for Frontend Display Issues
 * Purpose: Identify why main display shows only 4 numbers (3,9,1,7) instead of full 10 numbers
 * and why they differ from history (5,9,7,8,10,6,3,4,2,1)
 */

const http = require('http');
const { Pool } = require('pg');

// Database configuration
const pool = new Pool({
    host: 'dpg-cqbd4daju9rs73c395fg-a.oregon-postgres.render.com',
    port: 5432,
    database: 'bettinggame',
    user: 'bettinggame_user',
    password: 'z4pP0NzJ9CDCQIsN9x5EDGvVRFa2XONN',
    ssl: { rejectUnauthorized: false }
});

async function debugDisplayIssue() {
    console.log('🔍 Starting Frontend Display Debug...\n');
    
    try {
        // 1. Get current period from backend
        console.log('📋 Step 1: Checking backend game state...');
        const gameData = await new Promise((resolve, reject) => {
            http.get('http://localhost:3000/api/game-data', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
        
        console.log('Game Status:', gameData.gameStatus);
        console.log('Current Period:', gameData.currentPeriod);
        console.log('Time Remaining:', gameData.timeRemaining);
        console.log('Last Result from API:', gameData.lastResult);
        console.log('Last Result Length:', gameData.lastResult?.length);
        
        // 2. Check database for period 544
        console.log('\n📋 Step 2: Checking database for period 544...');
        const dbResult = await pool.query(
            'SELECT * FROM result_history WHERE period = $1',
            ['544']
        );
        
        if (dbResult.rows.length > 0) {
            const record = dbResult.rows[0];
            console.log('Period 544 in DB:');
            console.log('- Period:', record.period);
            console.log('- Result:', record.result);
            console.log('- Created at:', record.created_at);
            console.log('- Draw time:', record.draw_time);
        } else {
            console.log('❌ Period 544 not found in database');
        }
        
        // 3. Check the most recent results
        console.log('\n📋 Step 3: Checking recent results from database...');
        const recentResults = await pool.query(
            'SELECT * FROM result_history ORDER BY created_at DESC LIMIT 5'
        );
        
        console.log('Recent results:');
        recentResults.rows.forEach(row => {
            console.log(`- Period ${row.period}: ${row.result} (${row.created_at})`);
        });
        
        // 4. Check history API endpoint
        console.log('\n📋 Step 4: Checking history API endpoint...');
        const historyData = await new Promise((resolve, reject) => {
            http.get('http://localhost:3000/api/history?limit=5', (res) => {
                let data = '';
                res.on('data', chunk => data += chunk);
                res.on('end', () => {
                    try {
                        resolve(JSON.parse(data));
                    } catch (e) {
                        reject(e);
                    }
                });
            }).on('error', reject);
        });
        
        console.log('History API Response:');
        if (historyData.success && historyData.records) {
            historyData.records.forEach(record => {
                console.log(`- Period ${record.period}: ${record.result} (${record.draw_time})`);
            });
        }
        
        // 5. Frontend debugging suggestions
        console.log('\n📋 Step 5: Frontend Debugging Instructions:');
        console.log('1. Open browser console and run:');
        console.log('   - Check Vue data: app.$data.lastResults');
        console.log('   - Check current period: app.$data.currentPeriod');
        console.log('   - Check game status: app.$data.gameStatus');
        console.log('');
        console.log('2. Add console logging to frontend by editing vue-app.js:');
        console.log('   - In updateGameData() method after line 333:');
        console.log('     console.log("lastResults updated to:", this.lastResults);');
        console.log('   - In line 351 after historyRecords update:');
        console.log('     console.log("First history record:", this.historyRecords[0]);');
        console.log('');
        console.log('3. Check if the display is showing partial results due to:');
        console.log('   - Animation in progress (showWashingAnimation = true)');
        console.log('   - Race animation overlay blocking view');
        console.log('   - CSS hiding some numbers');
        console.log('');
        console.log('4. Potential issues to investigate:');
        console.log('   - The main display might be showing positions 1-4 instead of the full result');
        console.log('   - The v-for loop might be limited to 4 items');
        console.log('   - The lastResults array might be truncated somewhere');
        
        // 6. Check for data mismatch
        console.log('\n📋 Step 6: Data Analysis:');
        console.log('User reports:');
        console.log('- Main display: 3,9,1,7 (only 4 numbers)');
        console.log('- History shows: 5,9,7,8,10,6,3,4,2,1 (full 10 numbers for period 544)');
        console.log('');
        console.log('Possible explanations:');
        console.log('1. Main display is showing top 4 positions only');
        console.log('2. Main display is showing a different period than 544');
        console.log('3. There\'s a CSS issue hiding numbers 5-10');
        console.log('4. The Vue component is slicing the array to show only first 4');
        
    } catch (error) {
        console.error('❌ Error during debugging:', error);
    } finally {
        await pool.end();
    }
}

// Add frontend console debugging script
function generateFrontendDebugScript() {
    return `
// Run this in browser console to debug the display issue:
(function debugDisplay() {
    console.log('=== Frontend Display Debug ===');
    
    // Get Vue instance
    const app = document.querySelector('#app').__vue__;
    
    console.log('Current Period:', app.currentPeriod);
    console.log('Game Status:', app.gameStatus);
    console.log('Last Results:', app.lastResults);
    console.log('Last Results Length:', app.lastResults?.length);
    console.log('Last Result (cached):', app.lastResult);
    console.log('History Records First:', app.historyRecords[0]);
    
    // Check the actual DOM
    const resultBalls = document.querySelectorAll('.result-slot-new .number-ball');
    console.log('Number of result balls in DOM:', resultBalls.length);
    
    resultBalls.forEach((ball, index) => {
        console.log(\`Ball \${index + 1}: \${ball.textContent.trim()}\`);
    });
    
    // Check for any CSS that might hide elements
    const resultsContainer = document.querySelector('.results-container-new');
    if (resultsContainer) {
        const computedStyle = window.getComputedStyle(resultsContainer);
        console.log('Results container styles:');
        console.log('- Display:', computedStyle.display);
        console.log('- Max-width:', computedStyle.maxWidth);
        console.log('- Overflow:', computedStyle.overflow);
    }
    
    // Check if animation is running
    console.log('Washing Animation:', app.showWashingAnimation);
    console.log('Drawing in Progress:', app.isDrawingInProgress);
    
    // Force update display with full results
    if (app.historyRecords && app.historyRecords.length > 0) {
        console.log('\\nForcing display update with latest history result...');
        app.lastResults = app.historyRecords[0].result;
        app.$forceUpdate();
        console.log('Updated lastResults to:', app.lastResults);
    }
})();
`;
}

// Run the debug
console.log('Running backend debug...\n');
debugDisplayIssue().then(() => {
    console.log('\n\n📝 Frontend Debug Script:');
    console.log('Copy and paste this into your browser console:');
    console.log('=====================================');
    console.log(generateFrontendDebugScript());
    console.log('=====================================');
});