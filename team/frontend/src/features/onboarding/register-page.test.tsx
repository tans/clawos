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

describe("Register onboarding", () => {
  domTest("does not let a stored member session hijack /app/register", async () => {
    const storage = createMemoryStorage();
    storage.setItem(
      "clawos-team-session",
      JSON.stringify({
        companyId: "company_alpha",
        sessionToken: "tsess_member",
        memberId: "member_1",
        displayName: "Iris",
      })
    );
    const api = {
      getAppSession: vi.fn().mockResolvedValue({
        authenticated: false,
        user: null,
        companies: [],
      }),
    };

    render(<AppShell initialRoute="/app/register" api={api as never} storage={storage} />);

    expect(await screen.findByRole("heading", { name: "注册管理员账号" })).toBeInTheDocument();
    expect(screen.queryByText("Iris")).not.toBeInTheDocument();
  });

  domTest("shows the register screen for /app when no admin session exists", async () => {
    const api = {
      getAppSession: vi.fn().mockResolvedValue({
        authenticated: false,
        user: null,
        companies: [],
      }),
    };

    render(<AppShell initialRoute="/app" api={api as never} storage={createMemoryStorage()} />);

    expect(await screen.findByRole("heading", { name: "注册管理员账号" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "注册并继续" })).toBeInTheDocument();
  });

  domTest("validates password confirmation before calling register", async () => {
    const api = {
      getAppSession: vi.fn().mockResolvedValue({
        authenticated: false,
        user: null,
        companies: [],
      }),
      registerAdmin: vi.fn(),
    };

    render(<AppShell initialRoute="/app/register" api={api as never} storage={createMemoryStorage()} />);

    await screen.findByRole("heading", { name: "注册管理员账号" });
    await userEvent.type(screen.getByLabelText("邮箱"), "owner@example.com");
    await userEvent.type(screen.getByLabelText("密码"), "password123");
    await userEvent.type(screen.getByLabelText("确认密码"), "password124");
    await userEvent.click(screen.getByRole("button", { name: "注册并继续" }));

    expect(await screen.findByText("两次输入的密码不一致。")).toBeInTheDocument();
    expect(api.registerAdmin).not.toHaveBeenCalled();
  });

  domTest("registers and routes into create-company when the new admin has no companies", async () => {
    const api = {
      getAppSession: vi.fn().mockResolvedValue({
        authenticated: false,
        user: null,
        companies: [],
      }),
      registerAdmin: vi.fn().mockResolvedValue({
        authenticated: true,
        user: {
          id: 1,
          email: "owner@example.com",
        },
        companies: [],
      }),
    };

    render(<AppShell initialRoute="/app/register" api={api as never} storage={createMemoryStorage()} />);

    await screen.findByRole("heading", { name: "注册管理员账号" });
    await userEvent.type(screen.getByLabelText("邮箱"), "owner@example.com");
    await userEvent.type(screen.getByLabelText("密码"), "password123");
    await userEvent.type(screen.getByLabelText("确认密码"), "password123");
    await userEvent.click(screen.getByRole("button", { name: "注册并继续" }));

    expect(api.registerAdmin).toHaveBeenCalledWith({
      email: "owner@example.com",
      password: "password123",
      confirmPassword: "password123",
    });
    expect(await screen.findByRole("heading", { name: "创建公司" })).toBeInTheDocument();
  });
});
