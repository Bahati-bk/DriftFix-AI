import fs from 'fs';

const file = '/home/z/my-project/src/components/dashboard/ComplianceView.tsx';
const content = fs.readFileSync(file, 'utf-8');
const lines = content.split('\n');

// Line 71 is 0-indexed
const line = lines[71];
const before = line.substring(0, line.indexOf('<defs>'));
const after = line.substring(line.indexOf('>') + 1);
console.log('before:', JSON.stringify(before).slice(0, 50));
console.log('after:', JSON.stringify(after).slice(0, 50));

// Replace
const newLine = '<' + '\n                  <linearGradient id="cGrad" x1="0" y1="0" x2="0" y2="1">' + '\n                    <stop offset="5%" stopColor="#a78bfa" stopOpacity={{0.3}} />' + '\n                    <stop offset="95%" stopColor="#a78bfa" stopOpacity={{0}} />' + '\n                  </linearGradient>' + '\n                </defs>';

const newContent = before + '\n' + newLine + after + '\n';

fs.writeFileSync(file, newContent, 'utf-8');
console.log('Done');
