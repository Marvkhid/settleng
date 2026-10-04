module.exports = async () => {
  const child = globalThis.__PG_CHILD__;
  if (!child) return;
  await new Promise((resolve) => { child.once('exit', resolve); child.kill('SIGTERM'); setTimeout(resolve, 10_000); });
};
