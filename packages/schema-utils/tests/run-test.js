#!/usr/bin/env node

// Simple script to run our TypeScript test file
const { execSync } = require('node:child_process');
const path = require('node:path');

try {
  // Compile the test file with ts-node
  console.log('Running convert.test.ts...');
  execSync('npx ts-node tests/convert.test.ts', {
    cwd: path.resolve(__dirname, '..'),
    stdio: 'inherit',
  });

  console.log('\nTest completed successfully!');
} catch (error) {
  console.error('\nTest failed:', error.message);
  process.exit(1);
}
