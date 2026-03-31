import { Composer, ComposerSubmitInput } from "./composer";
import { ConversationPane } from "./conversation-pane";
import { TeamConversation, TeamConversationDetail, TeamSession, TeamSummary } from "../../types";

type ChatLayoutProps = {
  session?: TeamSession;
  teams?: TeamSummary[];
  conversations?: TeamConversation[];
  activeConversationId?: string | null;
  detail?: TeamConversationDetail | null;
  pending?: boolean;
  error?: string | null;
  createTeamId?: string;
  createTitle?: string;
  onCreateTeamIdChange?: (value: string) => void;
  onCreateTitleChange?: (value: string) => void;
  onCreateConversation?: () => void;
  onSelectConversation?: (conversationId: string) => void;
  onSend?: (input: ComposerSubmitInput) => void;
};

const DEFAULT_TEAMS: TeamSummary[] = [{ id: "team_general", name: "通用团队", primaryAgentName: "公司助理 Agent" }];

const DEFAULT_CONVERSATIONS: TeamConversation[] = [
  {
    id: "conv_welcome",
    companyId: "company_demo",
    teamId: "team_general",
    memberId: "member_demo",
    title: "欢迎会话",
    status: "open",
    lastMessageAt: 0,
    createdAt: 0,
    updatedAt: 0,
  },
];

export function ChatLayout({
  session,
  teams = DEFAULT_TEAMS,
  conversations = DEFAULT_CONVERSATIONS,
  activeConversationId,
  detail,
  pending = false,
  error,
  createTeamId = "",
  createTitle = "",
  onCreateTeamIdChange,
  onCreateTitleChange,
  onCreateConversation,
  onSelectConversation,
  onSend,
}: ChatLayoutProps) {
  const activeConversation =
    conversations.find((conversation) => conversation.id === activeConversationId) ?? conversations[0];

  return (
    <main className="team-shell">
      <section className="chat-workspace">
        <aside className="chat-sidebar">
          <div className="sidebar-block">
            <p className="eyebrow">团队</p>
            <ul className="sidebar-list">
              {teams.map((team) => (
                <li key={team.id}>
                  <strong>{team.name}</strong>
                  <span>{team.primaryAgentName}</span>
                </li>
              ))}
            </ul>
          </div>
          <div className="sidebar-block">
            <p className="eyebrow">最近会话</p>
            <ul className="sidebar-list">
              {conversations.map((conversation) => (
                <li key={conversation.id} className={conversation.id === activeConversation?.id ? "active" : undefined}>
                  <button className="sidebar-button" type="button" onClick={() => onSelectConversation?.(conversation.id)}>
                    <strong>{conversation.title}</strong>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        </aside>
        <div className="chat-main">
          {error ? <div className="status-banner status-error">{error}</div> : null}
          {activeConversation ? (
            <>
              <ConversationPane
                brand={detail?.brand}
                conversation={detail?.conversation ?? activeConversation}
                messages={detail?.messages}
                attachments={detail?.attachments}
              />
              <Composer onSend={onSend} disabled={pending} />
            </>
          ) : (
            <>
              <ConversationPane />
              <section className="admin-card">
                <p className="eyebrow">新建会话</p>
                <h2>创建会话</h2>
                <div className="admin-grid">
                  <label className="field-stack">
                    <span>团队 ID</span>
                    <input
                      className="text-input"
                      aria-label="团队 ID"
                      value={createTeamId}
                      onChange={(event) => onCreateTeamIdChange?.(event.target.value)}
                      placeholder="team_sales"
                    />
                  </label>
                  <label className="field-stack">
                    <span>会话标题</span>
                    <input
                      className="text-input"
                      aria-label="会话标题"
                      value={createTitle}
                      onChange={(event) => onCreateTitleChange?.(event.target.value)}
                      placeholder="销售线索跟进"
                    />
                  </label>
                </div>
                <button className="primary-button" type="button" onClick={onCreateConversation} disabled={pending}>
                  创建会话
                </button>
              </section>
            </>
          )}
          {session ? (
            <div className="info-row">
              <span>当前身份</span>
              <strong>{session.displayName}</strong>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
