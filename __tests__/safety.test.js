// __tests__/safety.test.js — backend panic/safety API
const request = require("supertest");
const express = require("express");

const safetyRoutes = require("../routes/safety");

const app = express();
app.use(express.json());
app.use("/api/safety", safetyRoutes);

describe("Safety API", () => {
  it("creates a panic case", async () => {
    const res = await request(app)
      .post("/api/safety/panic")
      .send({
        userId: "tester1",
        category: "abuse",
        message: "panic triggered",
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.case).toBeDefined();
  });

  it("lists panic cases", async () => {
    const res = await request(app).get("/api/safety/cases");
    expect(res.status).toBe(200);
    expect(Array.isArray(res.body)).toBe(true);
  });
});