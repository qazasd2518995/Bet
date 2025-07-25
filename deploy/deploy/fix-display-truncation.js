#!/usr/bin/env node

/**
 * Fix for Frontend Display Truncation Issue
 * This script patches the vue-app.js to ensure all 10 results are displayed
 */

const fs = require('fs');
const path = require('path');

const vueAppPath = path.join(__dirname, 'frontend/src/scripts/vue-app.js');

console.log('🔧 Fixing display truncation issue...\n');

// Read the current file
let content = fs.readFileSync(vueAppPath, 'utf8');

// Check if there's any array slicing happening
const slicePatterns = [
    /lastResults\.slice\(0,\s*4\)/g,
    /lastResult\.slice\(0,\s*4\)/g,
    /\.slice\(0,\s*4\)/g
];

let found = false;
slicePatterns.forEach(pattern => {
    if (pattern.test(content)) {
        console.log('❌ Found array slicing that limits to 4 items!');
        found = true;
        content = content.replace(pattern, match => {
            const fixed = match.replace(/4/, '10');
            console.log(`  Fixing: ${match} -> ${fixed}`);
            return fixed;
        });
    }
});

// Add debugging to updateGameData method
const updateGameDataPattern = /if \(data\.gameData\.lastResult && data\.gameData\.lastResult\.length > 0\) \{/;
if (updateGameDataPattern.test(content)) {
    content = content.replace(updateGameDataPattern, match => {
        return match + '\n                                console.log("🎲 Received lastResult from API:", data.gameData.lastResult, "Length:", data.gameData.lastResult.length);';
    });
    console.log('✅ Added debugging to updateGameData method');
}

// Add debugging to the template rendering
const checkPattern = /this\.lastResults = data\.gameData\.lastResult;/g;
if (checkPattern.test(content)) {
    content = content.replace(checkPattern, match => {
        return match + '\n                                    console.log("🎯 Setting lastResults to:", this.lastResults, "Length:", this.lastResults.length);';
    });
    console.log('✅ Added debugging for lastResults assignment');
}

// Ensure lastResults is never truncated
const ensureFullResults = `
            // Ensure full results are always displayed
            ensureFullResults() {
                if (this.lastResults && this.lastResults.length < 10 && this.lastResult && this.lastResult.length === 10) {
                    console.warn('⚠️ lastResults truncated, restoring from lastResult');
                    this.lastResults = [...this.lastResult];
                }
            },`;

// Add the method if it doesn't exist
if (!content.includes('ensureFullResults')) {
    const methodsPattern = /methods:\s*\{/;
    content = content.replace(methodsPattern, match => {
        return match + ensureFullResults;
    });
    console.log('✅ Added ensureFullResults method');
}

// Call ensureFullResults in mounted hook
const mountedPattern = /mounted\(\)\s*\{/;
if (mountedPattern.test(content) && !content.includes('this.ensureFullResults()')) {
    content = content.replace(mountedPattern, match => {
        return match + '\n            // Ensure full results on mount\n            this.ensureFullResults();';
    });
    console.log('✅ Added ensureFullResults call to mounted hook');
}

// Save the patched file
fs.writeFileSync(vueAppPath, content);

console.log('\n✅ Patch applied successfully!');
console.log('\n📝 Additional manual checks:');
console.log('1. Check the HTML template for v-for loops that might limit iterations');
console.log('2. Look for CSS that might hide elements after position 4');
console.log('3. Verify that the backend is sending all 10 numbers');
console.log('\n🔄 Please refresh the browser to see the changes.');

// Also create a browser console patch
const browserPatch = `
// Browser Console Patch - Run this directly in console
(function() {
    const app = document.querySelector('#app').__vue__;
    
    // Override the lastResults setter to log changes
    const originalData = app.$data;
    Object.defineProperty(app, 'lastResults', {
        get() { return originalData.lastResults; },
        set(value) {
            console.log('🎯 lastResults being set to:', value, 'Length:', value?.length);
            if (value && value.length < 10) {
                console.error('⚠️ WARNING: Attempting to set incomplete results!');
                console.trace();
            }
            originalData.lastResults = value;
        }
    });
    
    console.log('✅ Display monitoring patch applied');
})();
`;

fs.writeFileSync(path.join(__dirname, 'browser-display-patch.js'), browserPatch);
console.log('\n💡 Browser patch saved to browser-display-patch.js');
console.log('   Copy and run it in the browser console for real-time monitoring.');