import { startTransition, useEffect, useState } from "react";
import { teamFrontendApi, type TeamFrontendApi } from "./api/client";
import { AdminLayout } from "./features/admin/admin-layout";
import { ChatLayout } from "./features/chat/chat-layout";
import { InvitePage } from "./features/invite/invite-page";
import { CreateCompanyPage } from "./features/onboarding/create-company-page";
import { LoginPage } from "./features/onboarding/login-page";
import { RegisterPage } from "./features/onboarding/register-page";
import type {
  CreateOwnedCompanyInput,
  LoginAdminInput,
  RegisterAdminInput,
  TeamAppSessionSummary,
  TeamConversation,
  TeamConversationDetail,
  TeamSession,
} from "./types";

type AppShellProps = {
  initialRoute?: string;
  api?: TeamFrontendApi;
  storage?: Storage | null;
};

const SESSION_STORAGE_KEY = "clawos-team-session";
const DEFAULT_TEAM_STORAGE_KEY = "clawos-team-default-team-id";

function normalizeRoute(route?: string): string {
  if (route && route.startsWith("/")) {
    return route;
  }

  if (typeof window !== "undefined") {
    return window.location.pathname || "/";
  }

  return "/";
}

function getInviteToken(route: string): string | null {
  const match = /^\/app\/invite\/([^/]+)$/.exec(route);
  return match?.[1] ?? null;
}

function getAdminCompanyId(route: string): string | null {
  const match = /^\/app\/admin\/([^/]+)$/.exec(route);
  return match?.[1] ?? null;
}

function isOnboardingRoute(route: string): boolean {
  return route === "/app" || route === "/app/register" || route === "/app/login" || route === "/app/company/new";
}

function getStorage(provided: Storage | null | undefined): Storage | null {
  if (provided !== undefined) {
    return provided;
  }

  if (typeof window !== "undefined") {
    return window.localStorage;
  }

  return null;
}

function readSession(storage: Storage | null): TeamSession | null {
  const raw = storage?.getItem(SESSION_STORAGE_KEY);
  if (!raw) {
    return null;
  }

  try {
    return JSON.parse(raw) as TeamSession;
  } catch {
    storage?.removeItem(SESSION_STORAGE_KEY);
    return null;
  }
}

function createUnauthenticatedAppSession(): TeamAppSessionSummary {
  return {
    authenticated: false,
    user: null,
    companies: [],
  };
}

function mapAppError(error: unknown): string {
  const code = error instanceof Error ? error.message : "";

  switch (code) {
    case "INVALID_EMAIL":
      return "请输入有效的邮箱地址。";
    case "INVALID_PASSWORD":
      return "密码至少需要 8 个字符。";
    case "PASSWORD_MISMATCH":
      return "两次输入的密码不一致。";
    case "EMAIL_EXISTS":
      return "该邮箱已注册，请直接登录。";
    case "INVALID_CREDENTIALS":
      return "邮箱或密码错误。";
    case "INVALID_COMPANY":
      return "请填写有效的公司名称和公司标识。";
    case "SLUG_EXISTS":
      return "公司标识已存在，请更换。";
    case "UNAUTHORIZED":
      return "登录状态已失效，请重新登录。";
    default:
      return error instanceof Error ? error.message : "请求失败，请稍后重试。";
  }
}

export function AppShell({ initialRoute, api = teamFrontendApi, storage: providedStorage }: AppShellProps) {
  const [route, setRoute] = useState(() => normalizeRoute(initialRoute));
  const storage = getStorage(providedStorage);
  const [session, setSession] = useState<TeamSession | null>(() => readSession(storage));
  const [appSession, setAppSession] = useState<TeamAppSessionSummary | null>(null);
  const [appSessionLoaded, setAppSessionLoaded] = useState(false);
  const [appPending, setAppPending] = useState(false);
  const [appError, setAppError] = useState<string | null>(null);
  const [joinPending, setJoinPending] = useState(false);
  const [joinError, setJoinError] = useState<string | null>(null);
  const inviteToken = getInviteToken(route);
  const adminCompanyId = getAdminCompanyId(route);
  const onboardingRoute = isOnboardingRoute(route);
  const appManagedRoute = onboardingRoute || Boolean(adminCompanyId);

  useEffect(() => {
    setRoute(normalizeRoute(initialRoute));
  }, [initialRoute]);

  useEffect(() => {
    if (!appManagedRoute || appSessionLoaded) {
      return;
    }

    let alive = true;
    setAppPending(true);
    setAppError(null);

    void api
      .getAppSession()
      .then((summary) => {
        if (!alive) {
          return;
        }
        setAppSession(summary);
        setAppSessionLoaded(true);
      })
      .catch((error) => {
        if (!alive) {
          return;
        }
        setAppSession(createUnauthenticatedAppSession());
        setAppError(mapAppError(error));
        setAppSessionLoaded(true);
      })
      .finally(() => {
        if (alive) {
          setAppPending(false);
        }
      });

    return () => {
      alive = false;
    };
  }, [api, appManagedRoute, appSessionLoaded]);

  useEffect(() => {
    if (initialRoute !== undefined || typeof window === "undefined") {
      return;
    }

    function handlePopState() {
      setRoute(normalizeRoute());
    }

    window.addEventListener("popstate", handlePopState);
    return () => {
      window.removeEventListener("popstate", handlePopState);
    };
  }, [initialRoute]);

  function navigate(nextRoute: string) {
    if (typeof window !== "undefined" && initialRoute === undefined && window.location.pathname !== nextRoute) {
      window.history.pushState({}, "", nextRoute);
    }
    startTransition(() => {
      setRoute(nextRoute);
    });
  }

  function resolveOnboardingTarget(summary: TeamAppSessionSummary) {
    const companyId = summary.companies[0]?.id ?? null;
    if (companyId) {
      navigate(`/app/admin/${companyId}`);
      return;
    }
    navigate("/app/company/new");
  }

  async function handleRegister(input: RegisterAdminInput) {
    setAppPending(true);
    setAppError(null);
    try {
      const summary = await api.registerAdmin(input);
      setAppSession(summary);
      setAppSessionLoaded(true);
      resolveOnboardingTarget(summary);
    } catch (error) {
      setAppError(mapAppError(error));
    } finally {
      setAppPending(false);
    }
  }

  async function handleLogin(input: LoginAdminInput) {
    setAppPending(true);
    setAppError(null);
    try {
      const summary = await api.loginAdmin(input);
      setAppSession(summary);
      setAppSessionLoaded(true);
      resolveOnboardingTarget(summary);
    } catch (error) {
      setAppError(mapAppError(error));
    } finally {
      setAppPending(false);
    }
  }

  async function handleCreateCompany(input: CreateOwnedCompanyInput) {
    setAppPending(true);
    setAppError(null);
    try {
      const company = await api.createOwnedCompany(input);
      setAppSession((current) => ({
        authenticated: true,
        user: current?.user ?? null,
        companies: [company, ...(current?.companies ?? [])],
      }));
      setAppSessionLoaded(true);
      navigate(`/app/admin/${company.id}`);
    } catch (error) {
      setAppError(mapAppError(error));
    } finally {
      setAppPending(false);
    }
  }

  async function handleJoin(input: { token: string; displayName: string }) {
    setJoinPending(true);
    setJoinError(null);
    try {
      const nextSession = await api.joinInvite(input);
      storage?.setItem(SESSION_STORAGE_KEY, JSON.stringify(nextSession));
      startTransition(() => {
        setSession(nextSession);
      });
    } catch (error) {
      const message = error instanceof Error ? error.message : "加入工作台失败，请稍后重试。";
      setJoinError(message);
    } finally {
      setJoinPending(false);
    }
  }

  function handleTeamCreated(teamId: string) {
    storage?.setItem(DEFAULT_TEAM_STORAGE_KEY, teamId);
  }

  if (appManagedRoute) {
    if (!appSessionLoaded && appPending) {
      return (
        <main className="team-shell">
          <section className="invite-panel onboarding-panel">
            <p className="eyebrow">Team v1</p>
            <h1>正在准备管理台</h1>
            <p className="lead onboarding-copy">正在确认管理员登录状态，请稍候。</p>
          </section>
        </main>
      );
    }

    const resolvedAppSession = appSession ?? createUnauthenticatedAppSession();

    if (adminCompanyId) {
      if (!resolvedAppSession.authenticated) {
        return (
          <LoginPage
            pending={appPending}
            error={appError}
            onSubmit={handleLogin}
            onGoToRegister={() => navigate("/app/register")}
          />
        );
      }

      const resolvedCompanyId =
        resolvedAppSession.companies.find((company) => company.id === adminCompanyId)?.id ??
        resolvedAppSession.companies[0]?.id ??
        null;
      if (!resolvedCompanyId) {
        return <CreateCompanyPage pending={appPending} error={appError} onSubmit={handleCreateCompany} />;
      }

      return <AdminLayout companyId={resolvedCompanyId} api={api} onTeamCreated={handleTeamCreated} />;
    }

    if (resolvedAppSession.authenticated) {
      const companyId = resolvedAppSession.companies[0]?.id ?? null;
      if (companyId) {
        return <AdminLayout companyId={companyId} api={api} onTeamCreated={handleTeamCreated} />;
      }
      return <CreateCompanyPage pending={appPending} error={appError} onSubmit={handleCreateCompany} />;
    }

    if (route === "/app/login") {
      return (
        <LoginPage
          pending={appPending}
          error={appError}
          onSubmit={handleLogin}
          onGoToRegister={() => navigate("/app/register")}
        />
      );
    }

    return (
      <RegisterPage
        pending={appPending}
        error={appError}
        onSubmit={handleRegister}
        onGoToLogin={() => navigate("/app/login")}
      />
    );
  }

  if (inviteToken && !session) {
    return <InvitePage token={inviteToken} onJoin={handleJoin} pending={joinPending} error={joinError} />;
  }

  if (session) {
    return (
      <ConnectedChatScreen
        api={api}
        session={session}
        defaultTeamId={storage?.getItem(DEFAULT_TEAM_STORAGE_KEY) ?? ""}
      />
    );
  }

      return (
        <main className="team-shell">
          <section className="invite-panel">
            <p className="eyebrow">Team v1</p>
            <h1>打开邀请链接或管理入口</h1>
            <p className="lead">业务成员使用 `/app/invite/:token` 进入会话，管理员使用 `/app/admin/:companyId` 继续配置公司。</p>
          </section>
        </main>
      );
}

type ConnectedChatScreenProps = {
  api: TeamFrontendApi;
  session: TeamSession;
  defaultTeamId: string;
};

function ConnectedChatScreen({ api, session, defaultTeamId }: ConnectedChatScreenProps) {
  const [conversations, setConversations] = useState<TeamConversation[]>([]);
  const [activeConversationId, setActiveConversationId] = useState<string | null>(null);
  const [detail, setDetail] = useState<TeamConversationDetail | null>(null);
  const [pending, setPending] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [createTeamId, setCreateTeamId] = useState(defaultTeamId);
  const [createTitle, setCreateTitle] = useState("");

  useEffect(() => {
    let alive = true;

    async function loadInitial() {
      setPending(true);
      setError(null);
      try {
        const nextConversations = await api.listConversations(session.sessionToken);
        if (!alive) {
          return;
        }
        setConversations(nextConversations);
        if (nextConversations[0]) {
          const nextDetail = await api.getConversationDetail(session.sessionToken, nextConversations[0].id);
          if (!alive) {
            return;
          }
          setActiveConversationId(nextConversations[0].id);
          setDetail(nextDetail);
        }
      } catch (loadError) {
        if (!alive) {
          return;
        }
        const message = loadError instanceof Error ? loadError.message : "加载会话失败，请稍后重试。";
        setError(message);
      } finally {
        if (alive) {
          setPending(false);
        }
      }
    }

    void loadInitial();
    return () => {
      alive = false;
    };
  }, [api, session.sessionToken]);

  async function reloadConversation(conversationId: string) {
    const nextDetail = await api.getConversationDetail(session.sessionToken, conversationId);
    const nextConversations = await api.listConversations(session.sessionToken);
    setActiveConversationId(conversationId);
    setDetail(nextDetail);
    setConversations(nextConversations);
  }

  async function handleCreateConversation() {
    const teamId = createTeamId.trim();
    const title = createTitle.trim();
    if (!teamId || !title) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      const conversation = await api.createConversation(session.sessionToken, { teamId, title });
      setCreateTitle("");
      await reloadConversation(conversation.id);
    } catch (createError) {
      const message = createError instanceof Error ? createError.message : "Unable to create the conversation.";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  async function handleSelectConversation(conversationId: string) {
    setPending(true);
    setError(null);
    try {
      await reloadConversation(conversationId);
    } catch (loadError) {
      const message = loadError instanceof Error ? loadError.message : "Unable to load the conversation.";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  async function handleSend(input: { body: string; files: File[] }) {
    if (!activeConversationId) {
      return;
    }

    setPending(true);
    setError(null);
    try {
      for (const file of input.files) {
        await api.uploadAttachment(session.sessionToken, activeConversationId, file);
      }
      if (input.body) {
        await api.sendMessage(session.sessionToken, activeConversationId, { body: input.body });
      }
      await reloadConversation(activeConversationId);
    } catch (sendError) {
      const message = sendError instanceof Error ? sendError.message : "Unable to send the message.";
      setError(message);
    } finally {
      setPending(false);
    }
  }

  return (
    <ChatLayout
      session={session}
      teams={
        createTeamId || defaultTeamId
          ? [{ id: createTeamId || defaultTeamId, name: createTeamId || defaultTeamId, primaryAgentName: "Primary agent" }]
          : []
      }
      conversations={conversations}
      activeConversationId={activeConversationId}
      detail={detail}
      pending={pending}
      error={error}
      createTeamId={createTeamId}
      createTitle={createTitle}
      onCreateTeamIdChange={setCreateTeamId}
      onCreateTitleChange={setCreateTitle}
      onCreateConversation={handleCreateConversation}
      onSelectConversation={handleSelectConversation}
      onSend={handleSend}
    />
  );
}
