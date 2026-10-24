const request = require('supertest');
const app = require('../src/app');

describe('health endpoint', () => {
  test('returns service status', async () => {
    const response = await request(app).get('/health');
    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
  });
});
