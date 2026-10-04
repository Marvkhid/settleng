import { HealthController } from './health.controller';

describe('HealthController', () => {
  it('reports ok', () => {
    const res = new HealthController().check();
    expect(res.status).toBe('ok');
    expect(res.service).toBe('settleng-api');
  });
});
