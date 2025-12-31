export default function Controls({ onChat, onEnd, onToggleMute, onToggleVideo, muted, videoEnabled }) {
  return (
    <div className="mobile-controls">
      <button type="button" onClick={onToggleMute} aria-pressed={muted}>
        {muted ? 'Unmute' : 'Mute'}
      </button>
      <button type="button" onClick={onToggleVideo} aria-pressed={!videoEnabled}>
        {videoEnabled ? 'Stop Video' : 'Start Video'}
      </button>
      <button type="button" className="end" onClick={onEnd}>End</button>
      <button type="button" onClick={onChat}>Chat</button>
    </div>
  );
}
