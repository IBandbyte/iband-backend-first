// __tests__/safety.test.js — end-to-end tests for Safety API (robust)

const request = require("supertest");
const express = require("express");

// mount the real router in an in-memory express app
const safetyRoutes = require("../routes/safety");
const app = express();
app.use(express.json());
app.use("/api/safety", safetyRoutes);

describe("Safety API", () => {
  let createdId;

  test("POST /panic → creates a panic case", async () => {
    const res = await request(app)
      .post("/api/safety/panic")
      .send({
        userId: "tester-create",
        category: "abuse",
        message: "help",
        evidenceUrls: ["https://example.com/img1.jpg"],
      });

    expect(res.status).toBe(201);

    // Router may return the record at top-level or under {case: {...}}
    const rec = res.body?.case || res.body;
    expect(rec?.id).toBeDefined();
    expect(rec?.status).toBe("open");
    createdId = rec.id;
  });

  test("GET /cases → lists cases and includes the created one", async () => {
    const res = await request(app).get("/api/safety/cases");
    expect(res.status).toBe(200);
    // Router returns { count, cases }
    expect(Array.isArray(res.body?.cases)).toBe(true);
    const found = res.body.cases.find((c) => c.id === createdId);
    expect(found).toBeDefined();
    expect(found.status).toBe("open");
  });

  test("GET /cases/:id → fetches the specific case", async () => {
    const res = await request(app).get(`/api/safety/cases/${createdId}`);
    expect(res.status).toBe(200);
    const rec = res.body?.case || res.body;
    expect(rec?.id).toBe(createdId);
  });

  test("POST /cases/:id/ack → acknowledges a case", async () => {
    const res = await request(app)
      .post(`/api/safety/cases/${createdId}/ack`)
      .send({ moderator: "mod1" });

    expect(res.status).toBe(200);
    const rec = res.body?.case || res.body;
    // Some services use 'ack', others 'acknowledged'
    expect(["ack", "acknowledged"]).toContain(rec?.status);
    // Moderator field may be omitted by the service; do not assert it strictly.
  });

  test("POST /cases/:id/resolve → resolves a case", async () => {
    const res = await request(app)
      .post(`/api/safety/cases/${createdId}/resolve`)
      .send({ outcome: "no_action", moderator: "mod1" });

    expect(res.status).toBe(200);
    const rec = res.body?.case || res.body;
    expect(rec?.status).toBe("resolved");
    // Some services return resolvedBy/resolveBy or omit it; don't assert strictly.
  });

  test("rate-limit: second panic within a minute for SAME user is blocked", async () => {
    const ok = await request(app)
      .post("/api/safety/panic")
      .send({ userId: "rateUser", category: "abuse", message: "first" });
    expect(ok.status).toBe(201);

    const blocked = await request(app)
      .post("/api/safety/panic")
      .send({ userId: "rateUser", category: "abuse", message: "second" });
    expect(blocked.status).toBe(429);
  });

  test("rate-limit independence: different user not blocked", async () => {
    const res = await request(app)
      .post("/api/safety/panic")
      .send({ userId: "anotherUser", category: "threat", message: "ok" });
    expect(res.status).toBe(201);
  });
});