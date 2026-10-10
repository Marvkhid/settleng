const {vi} = require('vitest/node');
const fs = require('fs');
const path = require('path');

// Minimal: just evaluate the test file through vitest's transformer so we catch import-time errors.
const entrypoint = path.resolve(__dirname, './test/auth-pages.test.tsx');
function reporter(_config) {
  return {
    onInit() {},
    onTestBegin(_ctx, test) { console.log('TEST BEGIN', test.fullName); },
    onTestCaseFinish(_ctx, test, {state, duration, errors}) {
      console.log('TEST DONE', test.fullName, state, errors?.map(e=>e.message).join(' | '));
    },
    onRunEnd(_ctx, {tests, failures}) {
      console.log('RUN END', tests.length, 'tests', failures.length, 'failures');
    },
  };
}

const {default: Vitest} = require('vitest/node');
const v = new Vitest({
  root: __dirname,
  config: {
    test: {
      environment: 'jsdom',
      setupFiles: ['./test/setup.ts'],
      globals: true,
      alias: {'@': path.resolve(__dirname, '.')},
    },
  },
  reporters: [reporter],
  cache: false,
});
v.runT consequential = async () => {
  // Only run the describe blocks we care about by filtering via grep.
  await v.run();
};
v.runT consequential().then(() => process.exit(0)).catch(e => { console.error(e); process.exit(1); });
