// __tests__/safety.test.js — end-to-end tests for Safety API (tolerates both response shapes)
const request = require("supertest");
const express = require("express");

// Mount the real router in a throwaway Express app
const safetyRoutes = require("../routes/safety");
const app = express();
app.use(express.json());
app.use("/api/safety", safetyRoutes);

// Helper: read a case from either { success, case } or top-level record
const asRecord = (body) => (body && body.case) ? body.case : body;

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

    const rec = asRecord(res.body);
    expect(rec?.id).toBeDefined();
    expect(rec?.status).toBe("open");
    createdId = rec.id;
  });

  test("GET /cases → lists cases and includes the created one", async () => {
    const res = await request(app).get("/api/safety/cases");
    expect(res.status).toBe(200);

    // shape is { count, cases: [...] }
    const list = Array.isArray(res.body?.cases) ? res.body.cases : [];
    expect(Array.isArray(list)).toBe(true);

    const found = list.find((c) => c.id === createdId);
    expect(found).toBeDefined();
    expect(found.status).toBe("open");
  });

  test("GET /cases/:id → fetches the specific case", async () => {
    const res = await request(app).get(`/api/safety/cases/${createdId}`);
    expect(res.status).toBe(200);

    const rec = asRecord(res.body);
    expect(rec?.id).toBe(createdId);
  });

  test("POST /cases/:id/ack → acknowledges a case", async () => {
    const res = await request(app)
      .post(`/api/safety/cases/${createdId}/ack`)
      .send({ moderator: "mod1" });

    expect(res.status).toBe(200);

    const rec = asRecord(res.body);
    // status could be "acknowledged" (current) or "ack" (older)
    expect(rec?.status === "acknowledged" || rec?.status === "ack").toBe(true);

    // moderator field could be acknowledgedBy or ackBy
    const ackBy = rec?.acknowledgedBy ?? rec?.ackBy;
    expect(ackBy).toBe("mod1");
  });

  test("POST /cases/:id/resolve → resolves a case", async () => {
    const res = await request(app)
      .post(`/api/safety/cases/${createdId}/resolve`)
      .send({ outcome: "no_action", moderator: "mod1" });

    expect(res.status).toBe(200);

    const rec = asRecord(res.body);
    expect(rec?.status).toBe("resolved");

    // field could be resolvedBy (current) or resolveBy (older)
    const resolvedBy = rec?.resolvedBy ?? rec?.resolveBy;
    expect(resolvedBy).toBe("mod1");
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