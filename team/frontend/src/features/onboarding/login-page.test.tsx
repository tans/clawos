import { render, screen } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, test, vi } from "vitest";
import { AppShell } from "../../app-shell";

const domTest = typeof document === "undefined" ? test.skip : test;

function createMemoryStorage(): Storage {
  const store = new Map<string, string>();

  return {
    get length() {
      return store.size;
    },
    clear() {
      store.clear();
    },
    getItem(key: string) {
      return store.get(key) ?? null;
    },
    key(index: number) {
      return Array.from(store.keys())[index] ?? null;
    },
    removeItem(key: string) {
      store.delete(key);
    },
    setItem(key: string, value: string) {
      store.set(key, value);
    },
  };
}

describe("Login onboarding", () => {
  domTest("shows login instead of admin shell for unauthenticated /app/admin routes", async () => {
    const api = {
      getAppSession: vi.fn().mockResolvedValue({
        authenticated: false,
        user: null,
        companies: [],
      }),
    };

    render(<AppShell initialRoute="/app/admin/company_alpha" api={api as never} storage={createMemoryStorage()} />);

    expect(await screen.findByRole("heading", { name: "登录管理员账号" })).toBeInTheDocument();
  });

  domTest("shows the login screen for /app/login when no admin session exists", async () => {
    const api = {
      getAppSession: vi.fn().mockResolvedValue({
        authenticated: false,
        user: null,
        companies: [],
      }),
    };

    render(<AppShell initialRoute="/app/login" api={api as never} storage={createMemoryStorage()} />);

    expect(await screen.findByRole("heading", { name: "登录管理员账号" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "登录并继续" })).toBeInTheDocument();
  });

  domTest("routes directly to the admin workspace from /app when the admin owns one company", async () => {
    const api = {
      getAppSession: vi.fn().mockResolvedValue({
        authenticated: true,
        user: {
          id: 1,
          email: "owner@example.com",
        },
        companies: [
          {
            id: "company_alpha",
            name: "Alpha Ops",
            slug: "alpha-ops",
            mode: "unmanned",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    };

    render(<AppShell initialRoute="/app" api={api as never} storage={createMemoryStorage()} />);

    expect(await screen.findByRole("heading", { name: /company profile/i })).toBeInTheDocument();
  });

  domTest("logs in and routes into the admin workspace when the admin already owns one company", async () => {
    const api = {
      getAppSession: vi.fn().mockResolvedValue({
        authenticated: false,
        user: null,
        companies: [],
      }),
      loginAdmin: vi.fn().mockResolvedValue({
        authenticated: true,
        user: {
          id: 1,
          email: "owner@example.com",
        },
        companies: [
          {
            id: "company_alpha",
            name: "Alpha Ops",
            slug: "alpha-ops",
            mode: "unmanned",
            createdAt: 1,
            updatedAt: 1,
          },
        ],
      }),
    };

    render(<AppShell initialRoute="/app/login" api={api as never} storage={createMemoryStorage()} />);

    await screen.findByRole("heading", { name: "登录管理员账号" });
    await userEvent.type(screen.getByLabelText("邮箱"), "owner@example.com");
    await userEvent.type(screen.getByLabelText("密码"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "登录并继续" }));

    expect(api.loginAdmin).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "password123",
    });
    expect(await screen.findByRole("heading", { name: /company profile/i })).toBeInTheDocument();
  });
});
