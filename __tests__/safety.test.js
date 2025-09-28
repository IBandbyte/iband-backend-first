// __tests__/safety.test.js — end-to-end tests for Safety API
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
    expect(res.body?.success).toBe(true);
    expect(res.body?.case?.id).toBeDefined();
    expect(res.body.case.status).toBe("open");
    createdId = res.body.case.id;
  });

  test("GET /cases → lists cases and includes the created one", async () => {
    const res = await request(app).get("/api/safety/cases");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
    const found = res.body.find((c) => c.id === createdId);
    expect(found).toBeDefined();
    expect(found.status).toBe("open");
  });

  test("GET /cases/:id → fetches the specific case", async () => {
    const res = await request(app).get(`/api/safety/cases/${createdId}`);
    expect(res.status).toBe(200);
    expect(res.body?.id).toBe(createdId);
  });

  test("POST /ack → acknowledges a case", async () => {
    const res = await request(app)
      .post("/api/safety/ack")
      .send({ id: createdId, by: "mod1" });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.case?.status).toBe("ack");
    expect(res.body.case.ackBy).toBe("mod1");
  });

  test("POST /resolve → resolves a case", async () => {
    const res = await request(app)
      .post("/api/safety/resolve")
      .send({ id: createdId, by: "mod1", note: "validated and closed" });
    expect(res.status).toBe(200);
    expect(res.body?.success).toBe(true);
    expect(res.body?.case?.status).toBe("resolved");
    expect(res.body.case.resolveBy).toBe("mod1");
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