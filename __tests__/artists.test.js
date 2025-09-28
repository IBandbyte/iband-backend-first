// __tests__/artists.test.js — fast, DB-free tests for Artists API
const express = require('express');
const request = require('supertest');

// Mount the *fake* artists router to avoid DB in CI
const app = express();
app.use(express.json());
app.use('/artists', require('../routes/artists.fake'));

describe('Artists API', () => {
  // Increase timeout a bit to be safe on slow runners
  jest.setTimeout(15000);

  test('GET /artists returns an array (A→Z, deduped shape)', async () => {
    const res = await request(app).get('/artists');
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    // should be deduped and sorted by name
    const names = res.body.map((a) => a.name);
    const sorted = [...names].sort((a, b) => a.localeCompare(b));
    expect(names).toEqual(sorted);
    // unique ids/names
    const keys = new Set(res.body.map((a) => (a._id || a.name).toLowerCase()));
    expect(keys.size).toBe(res.body.length);
  });

  test('If list has at least one artist, vote and comments work on its :id', async () => {
    const list = await request(app).get('/artists');
    expect(list.status).toBe(200);
    const first = list.body[0];
    expect(first?._id).toBeDefined();

    // vote
    const vote = await request(app).post(`/artists/${first._id}/vote`).send({});
    expect(vote.status).toBe(200);
    expect(vote.body?.ok).toBe(true);
    expect(typeof vote.body?.votes).toBe('number');

    // comments
    const add = await request(app)
      .post(`/artists/${first._id}/comments`)
      .send({ text: 'Great performance!' });
    expect(add.status).toBe(201);
    expect(add.body?.text).toBe('Great performance!');

    const comments = await request(app).get(`/artists/${first._id}/comments`);
    expect(comments.status).toBe(200);
    expect(Array.isArray(comments.body)).toBe(true);
    expect(comments.body.some((c) => c.text === 'Great performance!')).toBe(true);
  });
});