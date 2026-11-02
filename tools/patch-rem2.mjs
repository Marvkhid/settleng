import { readFileSync, writeFileSync } from 'node:fs';

let bad = 0;
const edit = (file, pairs) => {
  let s = readFileSync(file, 'utf8').replace(/\r\n/g, '\n');
  for (const [a, b] of pairs) {
    if (!s.includes(a)) {
      console.error('MISSING in ' + file + ': ' + a.split('\n')[0].slice(0, 70));
      bad++;
      continue;
    }
    s = s.replace(a, b);
  }
  writeFileSync(file, s);
};

const FROM = [
  '      } catch {',
  '        // Unique window key: this window was already delivered by another run.',
  "        results.push({ windowKey, status: 'DUPLICATE_IGNORED', debtCount: g.debts.length });",
  '        continue;',
  '      }',
].join('\n');

const TO = [
  '      } catch (err) {',
  '        // Only a unique-window clash means "already delivered". Anything else is a real failure',
  '        // and must be reported as such, never silently swallowed as a duplicate.',
  "        if ((err as { code?: string }).code === 'P2002') {",
  "          results.push({ windowKey, status: 'DUPLICATE_IGNORED', debtCount: g.debts.length });",
  '          continue;',
  '        }',
  '        this.log.error("Could not record reminder delivery: " + String(err));',
  "        results.push({ windowKey, status: 'FAILED', debtCount: g.debts.length });",
  '        continue;',
  '      }',
].join('\n');

edit('api/src/debt-reminders/debt-reminders.service.ts', [[FROM, TO]]);
console.log(bad === 0 ? 'PATCH2_OK' : 'PATCH2_FAIL=' + bad);
