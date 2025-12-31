export default function ChatDrawer({ open, onClose }) {
  if (!open) return null;

  return (
    <div className="chat-drawer">
      <div className="header">
        Chat
        <button onClick={onClose}>✕</button>
      </div>
      <div className="body">Messages here</div>
      <input placeholder="Type message..." />
    </div>
  );
}
