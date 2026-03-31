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

function createAuthenticatedNoCompanySession() {
  return {
    authenticated: true,
    user: {
      id: 1,
      email: "owner@example.com",
    },
    companies: [],
  };
}

describe("Create company onboarding", () => {
  domTest("routes /app into create-company when the admin session has no companies", async () => {
    const api = {
      getAppSession: vi.fn().mockResolvedValue(createAuthenticatedNoCompanySession()),
    };

    render(<AppShell initialRoute="/app" api={api as never} storage={createMemoryStorage()} />);

    expect(await screen.findByRole("heading", { name: "创建公司" })).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "创建公司并进入管理台" })).toBeInTheDocument();
  });

  domTest("validates company slug before calling create-company", async () => {
    const api = {
      getAppSession: vi.fn().mockResolvedValue(createAuthenticatedNoCompanySession()),
      createOwnedCompany: vi.fn(),
    };

    render(<AppShell initialRoute="/app/company/new" api={api as never} storage={createMemoryStorage()} />);

    await screen.findByRole("heading", { name: "创建公司" });
    await userEvent.type(screen.getByLabelText("公司名称"), "阿尔法科技");
    await userEvent.type(screen.getByLabelText("公司标识"), "x");
    await userEvent.click(screen.getByRole("button", { name: "创建公司并进入管理台" }));

    expect(await screen.findByText("公司标识至少需要 2 个字符。")).toBeInTheDocument();
    expect(api.createOwnedCompany).not.toHaveBeenCalled();
  });

  domTest("creates a company and routes into the admin workspace", async () => {
    const api = {
      getAppSession: vi.fn().mockResolvedValue(createAuthenticatedNoCompanySession()),
      createOwnedCompany: vi.fn().mockResolvedValue({
        id: "company_alpha",
        name: "阿尔法科技",
        slug: "alpha-ops",
        mode: "standard",
        createdAt: 1,
        updatedAt: 1,
      }),
    };

    render(<AppShell initialRoute="/app/company/new" api={api as never} storage={createMemoryStorage()} />);

    await screen.findByRole("heading", { name: "创建公司" });
    await userEvent.type(screen.getByLabelText("公司名称"), "阿尔法科技");
    await userEvent.type(screen.getByLabelText("公司标识"), "alpha-ops");
    await userEvent.selectOptions(screen.getByLabelText("公司模式"), "standard");
    await userEvent.click(screen.getByRole("button", { name: "创建公司并进入管理台" }));

    expect(api.createOwnedCompany).toHaveBeenCalledWith({
      name: "阿尔法科技",
      slug: "alpha-ops",
      mode: "standard",
    });
    expect(await screen.findByRole("heading", { name: "公司资料" })).toBeInTheDocument();
  });
});
