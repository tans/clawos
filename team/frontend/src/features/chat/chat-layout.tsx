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

const DEFAULT_TEAMS: TeamSummary[] = [{ id: "team_general", name: "General", primaryAgentName: "Company Assistant" }];

const DEFAULT_CONVERSATIONS: TeamConversation[] = [
  {
    id: "conv_welcome",
    companyId: "company_demo",
    teamId: "team_general",
    memberId: "member_demo",
    title: "Welcome thread",
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
            <p className="eyebrow">Teams</p>
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
            <p className="eyebrow">Recent conversations</p>
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
                <p className="eyebrow">New conversation</p>
                <h2>Create a conversation</h2>
                <div className="admin-grid">
                  <label className="field-stack">
                    <span>Team ID</span>
                    <input
                      className="text-input"
                      aria-label="Team ID"
                      value={createTeamId}
                      onChange={(event) => onCreateTeamIdChange?.(event.target.value)}
                      placeholder="team_sales"
                    />
                  </label>
                  <label className="field-stack">
                    <span>Conversation title</span>
                    <input
                      className="text-input"
                      aria-label="Conversation title"
                      value={createTitle}
                      onChange={(event) => onCreateTitleChange?.(event.target.value)}
                      placeholder="Lead follow-up"
                    />
                  </label>
                </div>
                <button className="primary-button" type="button" onClick={onCreateConversation} disabled={pending}>
                  Create conversation
                </button>
              </section>
            </>
          )}
          {session ? (
            <div className="info-row">
              <span>Session</span>
              <strong>{session.displayName}</strong>
            </div>
          ) : null}
        </div>
      </section>
    </main>
  );
}
