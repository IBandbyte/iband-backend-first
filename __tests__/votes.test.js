// __tests__/votes.test.js — e2e tests for Votes API
const express = require('express');
const request = require('supertest');

const votesRouter = require('../routes/votes');

const app = express();
app.use(express.json());
app.use('/api/votes', votesRouter);

describe('Votes API', () => {
  const A = 'artist-abc';
  const user1 = 'u1';
  const user2 = 'u2';

  test('GET returns 0 before any votes', async () => {
    const res = await request(app).get(`/api/votes/${A}`);
    expect(res.status).toBe(200);
    expect(res.body?.artistId).toBe(A);
    expect(res.body?.total).toBe(0);
  });

  test('POST increments total; soft throttle limits spam per user', async () => {
    // first vote by u1 -> total 1
    let res = await request(app).post(`/api/votes/${A}`).send({ userId: user1 });
    expect(res.status).toBe(201);
    expect(res.body?.success).toBe(true);
    expect(res.body?.total).toBe(1);

    // immediate second vote by same user is throttled -> total stays 1
    res = await request(app).post(`/api/votes/${A}`).send({ userId: user1 });
    expect(res.status).toBe(201);
    expect(res.body?.total).toBe(1);

    // different user can still vote -> total 2
    res = await request(app).post(`/api/votes/${A}`).send({ userId: user2 });
    expect(res.status).toBe(201);
    expect(res.body?.total).toBe(2);

    // GET reflects total
    const check = await request(app).get(`/api/votes/${A}`);
    expect(check.status).toBe(200);
    expect(check.body?.total).toBe(2);
  });
});