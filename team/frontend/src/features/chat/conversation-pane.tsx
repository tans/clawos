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
        <p className="eyebrow">Conversation</p>
        <h2>Start your first conversation</h2>
        <p className="lead">Create a thread for one team and then continue the discussion with your company assistant.</p>
      </section>
    );
  }

  return (
    <section className="conversation-pane">
      <p className="eyebrow">Active conversation</p>
      <h2>{conversation.title}</h2>
      <p className="lead">
        {brand?.welcomeText ?? "Continue the thread and keep the company agent aligned with the latest context."}
      </p>
      <div className="message-stack">
        {messages.map((message) => (
          <article key={message.id} className={`message-bubble message-${message.senderType}`}>
            <span className="message-meta">{message.senderType}</span>
            <p>{message.body}</p>
          </article>
        ))}
      </div>
      {attachments.length ? (
        <div className="attachment-list">
          <span>Attachments</span>
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
