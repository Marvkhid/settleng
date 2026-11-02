import { readFileSync, writeFileSync } from 'node:fs';

const file = 'api/src/debts/debts.service.ts';
let s = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');

const anchor = '        const newBalance = balance.minus(amount);\n';
const insert =
  anchor +
  [
    '        // The moment a debt is settled, its automatic reminders stop for good: no future email',
    '        // can be sitting in the queue for money that has already been paid.',
    '        if (newBalance.lte(0))',
    '          await tx.debtReminder.updateMany({',
    '            where: { debtId },',
    "            data: { enabled: false, paused: false, nextRunAt: null, lastError: 'debt_settled' },",
    '          });',
  ].join('\n') +
  '\n';

if (!s.includes(anchor)) {
  console.error('ANCHOR MISSING');
  process.exit(1);
}
s = s.replace(anchor, insert);
writeFileSync(file, s);
console.log('settled hook added');
