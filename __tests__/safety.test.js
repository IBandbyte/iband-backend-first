// __tests__/safety.test.js — end-to-end tests for Safety API (routes return record at top-level)
const request = require("supertest");
const express = require("express");

// Mount the real router in a throwaway Express app
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
    // record is returned at top-level
    expect(res.body?.id).toBeDefined();
    expect(res.body?.status).toBe("open");
    createdId = res.body.id;
  });

  test("GET /cases → lists cases and includes the created one", async () => {
    const res = await request(app).get("/api/safety/cases");
    expect(res.status).toBe(200);
    // shape: { count, cases: [...] }
    expect(Array.isArray(res.body?.cases)).toBe(true);
    const found = res.body.cases.find((c) => c.id === createdId);
    expect(found).toBeDefined();
    expect(found.status).toBe("open");
  });

  test("GET /cases/:id → fetches the specific case", async () => {
    const res = await request(app).get(`/api/safety/cases/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.body?.id).toBe(createdId);
  });

  test("POST /cases/:id/ack → acknowledges a case", async () => {
    const res = await request(app)
      .post(`/api/safety/cases/${createdId}/ack`)
      .send({ moderator: "mod1" });

    expect(res.status).toBe(200);
    // status should be "acknowledged" (legacy was "ack")
    expect(res.body?.status === "acknowledged" || res.body?.status === "ack").toBe(true);

    // moderator field may be ackBy or acknowledgedBy depending on service version
    const ackBy = res.body?.acknowledgedBy ?? res.body?.ackBy;
    expect(ackBy).toBe("mod1");
  });

  test("POST /cases/:id/resolve → resolves a case", async () => {
    const res = await request(app)
      .post(`/api/safety/cases/${createdId}/resolve`)
      .send({ outcome: "no_action", moderator: "mod1" });

    expect(res.status).toBe(200);
    expect(res.body?.status).toBe("resolved");

    // service may use resolvedBy or resolveBy
    const resolvedBy = res.body?.resolvedBy ?? res.body?.resolveBy;
    expect(resolvedBy).toBe("mod1");
  });

  test("rate-limit: second panic within a minute for SAME user is blocked", async () => {
    // First call for this user should pass:
    const ok = await request(app)
      .post("/api/safety/panic")
      .send({ userId: "rateUser", category: "abuse", message: "first" });
    expect(ok.status).toBe(201);

    // Immediate second call should 429:
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