export type ConsoleUser = {
  id: number;
  mobile: string;
  walletAddress: string;
};

export type HostRow = {
  hostId: string;
  name: string;
  agentToken: string;
  controllerAddress: string;
  status: string;
  platform: string | null;
  wslDistro: string | null;
  clawosVersion: string | null;
  wslReady: number;
  gatewayReady: number;
  lastSeenMs: number | null;
  createdAt: number;
  updatedAt: number;
};

export type HostCommandRow = {
  id: string;
  kind: string;
  payload: string;
  status: string;
  dedupeKey: string | null;
  startedAt: number | null;
  finishedAt: number | null;
  expiresAt: number | null;
  result: string | null;
  createdAt: number;
  updatedAt: number;
};

export type PendingCommandRow = {
  id: string;
  kind: string;
  payload: string;
  createdAt: number;
};

export type TokenUsageSampleRow = {
  id: string;
  hostId: string;
  tokens: number | null;
  rawJson: string | null;
  createdAt: number;
};

export type ConsoleCredentialRow = {
  id: number;
  mobile: string;
  passwordHash: string;
  walletAddress: string;
};

export type TeamAppAdminUserRow = {
  id: number;
  email: string;
  legacyConsoleUserId: number;
  createdAt: number;
};

export type TeamAppAdminCredentialRow = {
  id: number;
  email: string;
  passwordHash: string;
  legacyConsoleUserId: number;
};

export type TeamAppAdminSessionRow = {
  token: string;
  userId: number;
  expiresAt: number;
  createdAt: number;
};

export type TeamAppCompanyMembershipRow = {
  companyId: string;
  teamAdminUserId: number;
  role: string;
  createdAt: number;
};

export type CompanyRow = {
  id: string;
  ownerUserId: number;
  name: string;
  slug: string;
  mode: string;
  createdAt: number;
  updatedAt: number;
};

export type AuditLogRow = {
  id: number;
  actor: string;
  action: string;
  deviceId: string | null;
  controllerAddress: string | null;
  detail: string | null;
  createdAt: number;
};

export type AgentEventRow = {
  id: string;
  hostId: string;
  eventType: string;
  severity: "info" | "warning" | "error";
  title: string | null;
  payload: string | null;
  createdAt: number;
};

export type HostInsightRow = {
  hostId: string;
  hostName: string;
  status: string;
  lastSeenMs: number | null;
  totalEvents: number;
  warningEvents: number;
  errorEvents: number;
  lastEventAt: number | null;
};

export type TeamBrandProfileRow = {
  companyId: string;
  brandName: string;
  logoUrl: string | null;
  themeColor: string;
  welcomeText: string;
  createdAt: number;
  updatedAt: number;
};

export type TeamGatewayAgentRow = {
  id: string;
  companyId: string;
  externalAgentId: string;
  name: string;
  description: string | null;
  status: string;
  isEnabled: number;
  createdAt: number;
  updatedAt: number;
};

export type TeamGatewayConfigRow = {
  companyId: string;
  baseUrl: string;
  apiKey: string | null;
  createdAt: number;
  updatedAt: number;
};

export type TeamProfileRow = {
  id: string;
  companyId: string;
  name: string;
  description: string | null;
  primaryAgentId: string;
  createdAt: number;
  updatedAt: number;
};

export type TeamInviteRow = {
  id: string;
  companyId: string;
  token: string;
  status: string;
  expiresAt: number | null;
  usageLimit: number | null;
  usageCount: number;
  createdBy: string;
  createdAt: number;
  updatedAt: number;
};

export type TeamMemberSessionRow = {
  id: string;
  companyId: string;
  inviteId: string;
  displayName: string;
  sessionToken: string;
  lastSeenAt: number;
  createdAt: number;
};

export type TeamConversationRow = {
  id: string;
  companyId: string;
  teamId: string;
  memberId: string;
  title: string;
  status: string;
  lastMessageAt: number;
  createdAt: number;
  updatedAt: number;
};

export type TeamMessageRow = {
  id: string;
  companyId: string;
  conversationId: string;
  senderType: string;
  senderId: string | null;
  messageType: string;
  body: string;
  streamStatus: string;
  createdAt: number;
};

export type TeamAttachmentRow = {
  id: string;
  companyId: string;
  conversationId: string;
  memberId: string;
  messageId: string;
  kind: string;
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: number;
};

export type TeamConversationDetail = {
  brand: TeamBrandProfileRow | null;
  conversation: TeamConversationRow;
  messages: TeamMessageRow[];
  attachments: TeamAttachmentRow[];
};

export type AppVariables = {
  consoleUser: ConsoleUser;
  teamMemberSession: TeamMemberSessionRow;
  teamAdminUser: TeamAppAdminUserRow;
};

export type AppEnv = {
  Variables: AppVariables;
};
