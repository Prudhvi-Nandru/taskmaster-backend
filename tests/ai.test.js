const request = require('supertest');

jest.mock('../src/config/db', () => ({}));
jest.mock('../src/middleware/auth', () => ({
  authenticate: (_req, _res, next) => next(),
}));

const app = require('../src/app');

describe('task description drafting', () => {
  afterEach(() => {
    delete process.env.OPENAI_API_KEY;
    delete process.env.OPENAI_MODEL;
    jest.restoreAllMocks();
  });

  test('returns a local template when no provider key is configured', async () => {
    const response = await request(app)
      .post('/api/ai/task-description')
      .send({ title: 'Write release notes', notes: 'Cover new features' });

    expect(response.status).toBe(200);
    expect(response.body.generatedBy).toBe('local-template');
    expect(response.body.description).toContain('\n\nContext: Cover new features');
  });

  test('uses the OpenAI Responses API when configured', async () => {
    process.env.OPENAI_API_KEY = 'test-key';
    process.env.OPENAI_MODEL = 'test-model';
    const fetch = jest.spyOn(global, 'fetch').mockResolvedValue({
      ok: true,
      json: async () => ({
        output: [{ type: 'message', content: [{ type: 'output_text', text: 'Generated task description' }] }],
      }),
    });

    const response = await request(app)
      .post('/api/ai/task-description')
      .send({ title: 'Write release notes', notes: 'Cover new features' });

    expect(response.status).toBe(200);
    expect(response.body).toEqual({ description: 'Generated task description', generatedBy: 'openai' });
    expect(fetch).toHaveBeenCalledTimes(1);
    const [url, options] = fetch.mock.calls[0];
    expect(url).toBe('https://api.openai.com/v1/responses');
    expect(options.headers.Authorization).toBe('Bearer test-key');
    expect(JSON.parse(options.body)).toMatchObject({
      model: 'test-model',
      store: false,
      input: expect.stringContaining('Cover new features'),
    });
  });
});
