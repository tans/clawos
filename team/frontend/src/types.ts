export type TeamBrand = {
  companyId: string;
  brandName: string;
  themeColor: string;
  welcomeText: string;
  logoUrl?: string | null;
};

export type TeamAppAdminUser = {
  id: number;
  email: string;
};

export type TeamAppCompanyMode = "unmanned" | "standard";

export type TeamAppCompanySummary = {
  id: string;
  name: string;
  slug: string;
  mode: TeamAppCompanyMode;
  createdAt: number;
  updatedAt: number;
};

export type TeamAppSessionSummary = {
  authenticated: boolean;
  user: TeamAppAdminUser | null;
  companies: TeamAppCompanySummary[];
};

export type RegisterAdminInput = {
  email: string;
  password: string;
  confirmPassword: string;
};

export type LoginAdminInput = {
  email: string;
  password: string;
};

export type CreateOwnedCompanyInput = {
  name: string;
  slug: string;
  mode: TeamAppCompanyMode;
};

export type TeamSession = {
  companyId: string;
  sessionToken: string;
  memberId: string;
  displayName: string;
};

export type TeamConversation = {
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

export type TeamSummary = {
  id: string;
  name: string;
  primaryAgentName?: string;
};

export type TeamMessage = {
  id: string;
  companyId?: string;
  conversationId: string;
  senderType: "member" | "agent" | "system";
  senderId?: string | null;
  messageType?: string;
  body: string;
  streamStatus?: string;
  createdAt: number;
};

export type TeamAttachment = {
  id: string;
  companyId: string;
  conversationId: string;
  memberId: string;
  messageId: string;
  kind: "image" | "file";
  originalName: string;
  storedName: string;
  mimeType: string;
  sizeBytes: number;
  storagePath: string;
  createdAt: number;
};

export type TeamConversationDetail = {
  brand: TeamBrand | null;
  conversation: TeamConversation;
  messages: TeamMessage[];
  attachments: TeamAttachment[];
};

export type GatewayAgent = {
  id: string;
  companyId: string;
  externalAgentId: string;
  name: string;
  description: string | null;
  status: string;
  isEnabled: boolean;
};

export type TeamInvite = {
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
