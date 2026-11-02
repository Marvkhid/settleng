import { readFileSync, writeFileSync } from 'node:fs';

const file = 'web/test/loading.test.ts';
let text = readFileSync(file, 'utf8');

text = text.replace(
  '  getLoadingSnapshot,\n  resetLoadingForTests,',
  '  getLoadingSnapshot,\n  isBlockingRequest,\n  resetLoadingForTests,',
);

if (!text.includes('request classification')) {
  text += `
describe("request classification", () => {
  it("blocks the screen for writes the user started", () => {
    for (const method of ["POST", "PATCH", "PUT", "DELETE", "post", "patch"]) {
      expect(isBlockingRequest(method)).toBe(true);
    }
  });

  it("stays silent for reads, refreshes and polls", () => {
    for (const method of [undefined, "GET", "get", "HEAD", "OPTIONS"]) {
      expect(isBlockingRequest(method)).toBe(false);
    }
  });
});
`;
}

writeFileSync(file, text);
console.log('TESTS_APPENDED');
