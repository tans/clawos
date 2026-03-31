import { describe, expect, test } from "bun:test";
import { createApp } from "../../src/app";

describe("team legacy onboarding routes", () => {
  test("redirects legacy console login/register/company routes into the app onboarding flow", async () => {
    const app = createApp();

    const loginRes = await app.request("/console/login");
    expect(loginRes.status).toBe(302);
    expect(loginRes.headers.get("location")).toBe("/app/login");

    const registerRes = await app.request("/console/register");
    expect(registerRes.status).toBe(302);
    expect(registerRes.headers.get("location")).toBe("/app/register");

    const createCompanyRes = await app.request("/console/companies/new");
    expect(createCompanyRes.status).toBe(302);
    expect(createCompanyRes.headers.get("location")).toBe("/app/company/new");
  });
});
