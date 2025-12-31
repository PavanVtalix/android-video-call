export default function Controls({ onChat, onEnd }) {
  return (
    <div className="mobile-controls">
      <button>Mute</button>
      <button>Video</button>
      <button className="end" onClick={onEnd}>End</button>
      <button onClick={onChat}>Chat</button>
    </div>
  );
}
