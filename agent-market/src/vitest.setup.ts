import { JSDOM } from "jsdom";

if (typeof globalThis.document === "undefined") {
  const dom = new JSDOM("<!doctype html><html><body></body></html>", {
    url: "http://localhost/",
  });

  globalThis.window = dom.window as unknown as Window & typeof globalThis;
  globalThis.document = dom.window.document;
  globalThis.navigator = dom.window.navigator;
}

await import("@testing-library/jest-dom/vitest");

const { cleanup } = await import("@testing-library/react");
const { afterEach } = await import("vitest");

afterEach(() => {
  cleanup();
});
