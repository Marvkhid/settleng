import { readFileSync, writeFileSync } from 'node:fs';

const file = 'api/test/api.int-spec.ts';
let s = readFileSync(file, 'utf8');
const before = s;

// ownerId is indexed, not unique, so findUnique is both a type error and an invalid Prisma call.
s = s.split('business.findUniqueOrThrow(').join('business.findFirstOrThrow(');

writeFileSync(file, s);
console.log(before === s ? 'NO_CHANGE' : 'FIXED');
