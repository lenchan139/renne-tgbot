const { execSync } = require('child_process');
const fs = require('fs');

try {
  execSync('./node_modules/.bin/tsc --noEmit 2>&1', {
    cwd: process.cwd(),
    encoding: 'utf-8',
    timeout: 60000,
    stdio: ['pipe', 'pipe', 'pipe'],
  });
  fs.writeFileSync('/tmp/tsc-final.txt', 'SUCCESS');
} catch (err) {
  fs.writeFileSync('/tmp/tsc-final.txt', 'ERROR\n' + (err.stdout || '') + '\n' + (err.stderr || ''));
}
