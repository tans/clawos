import type {
  CreateOwnedCompanyInput,
  GatewayAgent,
  LoginAdminInput,
  RegisterAdminInput,
  TeamAttachment,
  TeamAppCompanySummary,
  TeamAppSessionSummary,
  TeamConversation,
  TeamConversationDetail,
  TeamInvite,
  TeamMessage,
  TeamSession,
  TeamSummary,
} from "../types";

export type ApiClientOptions = {
  baseUrl?: string;
  headers?: HeadersInit;
};

export class ApiError extends Error {
  readonly status: number;

  constructor(status: number, message: string) {
    super(message);
    this.name = "ApiError";
    this.status = status;
  }
}

export class ApiClient {
  private readonly baseUrl: string;
  private readonly headers: HeadersInit;

  constructor(options: ApiClientOptions = {}) {
    this.baseUrl = options.baseUrl ?? "";
    this.headers = options.headers ?? {};
  }

  async get<T>(path: string, headers?: HeadersInit): Promise<T> {
    return this.request<T>("GET", path, { headers });
  }

  async post<T>(path: string, body?: unknown, headers?: HeadersInit): Promise<T> {
    return this.request<T>("POST", path, { body, headers });
  }

  async put<T>(path: string, body?: unknown, headers?: HeadersInit): Promise<T> {
    return this.request<T>("PUT", path, { body, headers });
  }

  async postForm<T>(path: string, formData: FormData, headers?: HeadersInit): Promise<T> {
    return this.request<T>("POST", path, { formData, headers });
  }

  private async request<T>(
    method: string,
    path: string,
    options: {
      body?: unknown;
      formData?: FormData;
      headers?: HeadersInit;
    } = {}
  ): Promise<T> {
    const requestHeaders = new Headers(this.headers);
    if (options.headers) {
      new Headers(options.headers).forEach((value, key) => {
        requestHeaders.set(key, value);
      });
    }

    const init: RequestInit = {
      method,
      credentials: "include",
      headers: requestHeaders,
    };

    if (options.formData) {
      init.body = options.formData;
      requestHeaders.delete("content-type");
    } else if (options.body !== undefined) {
      requestHeaders.set("content-type", "application/json");
      init.body = JSON.stringify(options.body);
    }

    const response = await fetch(`${this.baseUrl}${path}`, init);

    if (!response.ok) {
      let message = `Request failed for ${path}`;
      try {
        const payload = (await response.json()) as { error?: string; message?: string };
        message = payload.message ?? payload.error ?? message;
      } catch {
        // Ignore secondary parse failures and use the fallback message.
      }
      throw new ApiError(response.status, message);
    }

    return (await response.json()) as T;
  }
}

export const apiClient = new ApiClient();

export interface TeamFrontendApi {
  getAppSession(): Promise<TeamAppSessionSummary>;
  registerAdmin(input: RegisterAdminInput): Promise<TeamAppSessionSummary>;
  loginAdmin(input: LoginAdminInput): Promise<TeamAppSessionSummary>;
  createOwnedCompany(input: CreateOwnedCompanyInput): Promise<TeamAppCompanySummary>;
  joinInvite(input: { token: string; displayName: string }): Promise<TeamSession>;
  listConversations(sessionToken: string): Promise<TeamConversation[]>;
  createConversation(sessionToken: string, input: { teamId: string; title: string }): Promise<TeamConversation>;
  getConversationDetail(sessionToken: string, conversationId: string): Promise<TeamConversationDetail>;
  sendMessage(
    sessionToken: string,
    conversationId: string,
    input: { body: string }
  ): Promise<{ memberMessage: TeamMessage; agentMessage: TeamMessage; deltas: string[] }>;
  uploadAttachment(
    sessionToken: string,
    conversationId: string,
    file: File
  ): Promise<{ attachment: TeamAttachment; message: TeamMessage }>;
  saveBrand(
    companyId: string,
    input: { brandName: string; logoUrl?: string | null; themeColor: string; welcomeText: string }
  ): Promise<{ ok: boolean }>;
  testGateway(companyId: string, input: { baseUrl: string; apiKey?: string }): Promise<{ ok: boolean; message?: string }>;
  syncGatewayAgents(companyId: string): Promise<GatewayAgent[]>;
  createTeam(
    companyId: string,
    input: { name: string; description?: string | null; primaryAgentId: string }
  ): Promise<TeamSummary>;
  createInvite(companyId: string, input: { expiresInHours: number; usageLimit?: number | null }): Promise<TeamInvite>;
}

class BrowserTeamFrontendApi implements TeamFrontendApi {
  constructor(private readonly client: ApiClient) {}

  async getAppSession(): Promise<TeamAppSessionSummary> {
    return this.client.get<TeamAppSessionSummary>("/api/team/app/session");
  }

  async registerAdmin(input: RegisterAdminInput): Promise<TeamAppSessionSummary> {
    return this.client.post<TeamAppSessionSummary>("/api/team/app/register", input);
  }

  async loginAdmin(input: LoginAdminInput): Promise<TeamAppSessionSummary> {
    return this.client.post<TeamAppSessionSummary>("/api/team/app/login", input);
  }

  async createOwnedCompany(input: CreateOwnedCompanyInput): Promise<TeamAppCompanySummary> {
    const result = await this.client.post<{ company: TeamAppCompanySummary }>("/api/team/app/companies", input);
    return result.company;
  }

  async joinInvite(input: { token: string; displayName: string }): Promise<TeamSession> {
    return this.client.post<TeamSession>("/api/team/chat/invites/join", input);
  }

  async listConversations(sessionToken: string): Promise<TeamConversation[]> {
    const result = await this.client.get<{ conversations: TeamConversation[] }>("/api/team/chat/conversations", {
      "x-team-session": sessionToken,
    });
    return result.conversations;
  }

  async createConversation(sessionToken: string, input: { teamId: string; title: string }): Promise<TeamConversation> {
    const result = await this.client.post<{ conversation: TeamConversation }>(
      "/api/team/chat/conversations",
      input,
      { "x-team-session": sessionToken }
    );
    return result.conversation;
  }

  async getConversationDetail(sessionToken: string, conversationId: string): Promise<TeamConversationDetail> {
    return this.client.get<TeamConversationDetail>(`/api/team/chat/conversations/${conversationId}`, {
      "x-team-session": sessionToken,
    });
  }

  async sendMessage(
    sessionToken: string,
    conversationId: string,
    input: { body: string }
  ): Promise<{ memberMessage: TeamMessage; agentMessage: TeamMessage; deltas: string[] }> {
    return this.client.post(`/api/team/chat/conversations/${conversationId}/messages`, input, {
      "x-team-session": sessionToken,
    });
  }

  async uploadAttachment(
    sessionToken: string,
    conversationId: string,
    file: File
  ): Promise<{ attachment: TeamAttachment; message: TeamMessage }> {
    const formData = new FormData();
    formData.append("file", file);
    return this.client.postForm(`/api/team/chat/conversations/${conversationId}/attachments`, formData, {
      "x-team-session": sessionToken,
    });
  }

  async saveBrand(
    companyId: string,
    input: { brandName: string; logoUrl?: string | null; themeColor: string; welcomeText: string }
  ): Promise<{ ok: boolean }> {
    return this.client.put(`/api/team/admin/companies/${companyId}/brand`, input);
  }

  async testGateway(
    companyId: string,
    input: { baseUrl: string; apiKey?: string }
  ): Promise<{ ok: boolean; message?: string }> {
    return this.client.post(`/api/team/admin/companies/${companyId}/gateway/test`, input);
  }

  async syncGatewayAgents(companyId: string): Promise<GatewayAgent[]> {
    const result = await this.client.post<{ agents: GatewayAgent[] }>(
      `/api/team/admin/companies/${companyId}/gateway/agents/sync`,
      {}
    );
    return result.agents;
  }

  async createTeam(
    companyId: string,
    input: { name: string; description?: string | null; primaryAgentId: string }
  ): Promise<TeamSummary> {
    const result = await this.client.post<{ team: TeamSummary }>(`/api/team/admin/companies/${companyId}/teams`, input);
    return result.team;
  }

  async createInvite(
    companyId: string,
    input: { expiresInHours: number; usageLimit?: number | null }
  ): Promise<TeamInvite> {
    const result = await this.client.post<{ invite: TeamInvite }>(
      `/api/team/admin/companies/${companyId}/invites`,
      input
    );
    return result.invite;
  }
}

export const teamFrontendApi: TeamFrontendApi = new BrowserTeamFrontendApi(apiClient);
