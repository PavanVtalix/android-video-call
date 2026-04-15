import React, { useEffect, useRef, useState } from "react";

function formatMessageTime(value) {
  const date = value ? new Date(value) : new Date();

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return `${String(date.getHours()).padStart(2, "0")}:${String(date.getMinutes()).padStart(2, "0")}`;
}

export default function ChatDrawer({
  open,
  onClose,
  messages = [],
  onSend,
  participantName = "You",
}) {
  const [text, setText] = useState("");
  const listRef = useRef(null);

  useEffect(() => {
    if (listRef.current) {
      listRef.current.scrollTop = listRef.current.scrollHeight;
    }
  }, [messages, open]);

  if (!open) return null;

  const safeMessages = Array.isArray(messages) ? messages.filter(Boolean) : [];

  const handleSend = () => {
    const value = text.trim();
    if (!value) return;
    onSend?.(value);
    setText("");
  };

  return (
    <div className="chat-drawer">
      <div className="chat-drawer__header">
        <div>
          <div className="chat-drawer__eyebrow">In-call chat</div>
          <div className="chat-drawer__title">Messages</div>
        </div>
        <button type="button" className="chat-drawer__close" onClick={onClose}>
          x
        </button>
      </div>

      <div className="chat-drawer__body" ref={listRef}>
        {safeMessages.length === 0 ? (
          <div className="chat-drawer__empty">
            Start the conversation with {participantName === "You" ? "a message" : participantName}.
          </div>
        ) : (
          safeMessages.map((message, index) => {
            const isMine = message.isMine;

            return (
              <div
                key={`${message.timestamp || index}-${index}`}
                className={`chat-drawer__message ${isMine ? "mine" : "theirs"}`}
              >
                <div className="chat-drawer__bubble">{message.message}</div>
                <div className="chat-drawer__time">
                  {formatMessageTime(message.timestamp)}
                </div>
              </div>
            );
          })
        )}
      </div>

      <div className="chat-drawer__input">
        <input
          value={text}
          onChange={(event) => setText(event.target.value)}
          onKeyDown={(event) => event.key === "Enter" && handleSend()}
          placeholder="Type a message..."
        />
        <button type="button" onClick={handleSend}>Send</button>
      </div>
    </div>
  );
}
