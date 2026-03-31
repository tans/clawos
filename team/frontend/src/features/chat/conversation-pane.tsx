import { TeamAttachment, TeamBrand, TeamConversation, TeamMessage } from "../../types";

type ConversationPaneProps = {
  brand?: TeamBrand | null;
  conversation?: TeamConversation;
  messages?: TeamMessage[];
  attachments?: TeamAttachment[];
};

export function ConversationPane({ brand, conversation, messages = [], attachments = [] }: ConversationPaneProps) {
  if (!conversation) {
    return (
      <section className="conversation-pane empty-pane">
        <p className="eyebrow">会话</p>
        <h2>开始第一条会话</h2>
        <p className="lead">先为某个团队创建会话，再继续和公司的 Agent 协作推进任务。</p>
      </section>
    );
  }

  return (
    <section className="conversation-pane">
      <p className="eyebrow">当前会话</p>
      <h2>{conversation.title}</h2>
      <p className="lead">{brand?.welcomeText ?? "继续补充上下文，让公司的 Agent 始终保持最新协作信息。"}</p>
      <div className="message-stack">
        {messages.map((message) => (
          <article key={message.id} className={`message-bubble message-${message.senderType}`}>
            <span className="message-meta">{message.senderType === "member" ? "成员" : "Agent"}</span>
            <p>{message.body}</p>
          </article>
        ))}
      </div>
      {attachments.length ? (
        <div className="attachment-list">
          <span>附件</span>
          <ul>
            {attachments.map((attachment) => (
              <li key={attachment.id}>{attachment.originalName}</li>
            ))}
          </ul>
        </div>
      ) : null}
    </section>
  );
}
