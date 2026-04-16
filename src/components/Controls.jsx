import React from "react";
import "../styles/controls.css";

import micOn from "../assets/Microphone on.svg";
import micOff from "../assets/Microphone off.svg";
import videoOn from "../assets/Video on.svg";
import videoOff from "../assets/Video off.svg";
import endCallIcon from "../assets/end call.svg";

export default function Controls({
  onChat,
  onEnd,
  onToggleMute,
  onToggleVideo,
  muted,
  videoEnabled,
  unreadChatCount = 0,
}) {
  return (
    <div className="controls">
      <button
        className={`control-btn ${muted ? "is-off" : "is-on"}`}
        type="button"
        onClick={onToggleMute}
        aria-pressed={muted}
        aria-label={muted ? "Unmute microphone" : "Mute microphone"}
      >
        <img
          src={muted ? micOff : micOn}
          alt="Mute"
        />
        <span>{muted ? "Unmute" : "Mute"}</span>
      </button>

      <button
        className={`control-btn ${videoEnabled ? "is-on" : "is-off"}`}
        type="button"
        onClick={onToggleVideo}
        aria-pressed={!videoEnabled}
        aria-label={videoEnabled ? "Turn camera off" : "Turn camera on"}
      >
        <img
          src={videoEnabled ? videoOn : videoOff}
          alt="Video"
        />
        <span>{videoEnabled ? "Stop" : "Start"}</span>
      </button>

      <button className="control-btn control-btn--chat" type="button" onClick={onChat} aria-label="Open chat">
        <span className="control-btn__chat-icon" aria-hidden="true">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round">
            <path d="M7 10h10" />
            <path d="M7 14h6" />
            <path d="M5 5h14a2 2 0 0 1 2 2v8a2 2 0 0 1-2 2h-7l-4 3v-3H5a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2Z" />
          </svg>
        </span>
        <span>Chat</span>
        {unreadChatCount > 0 && (
          <span className="control-btn__badge" aria-label={`${unreadChatCount} unread messages`}>
            {unreadChatCount > 9 ? "9+" : unreadChatCount}
          </span>
        )}
      </button>

      <button className="control-btn end" type="button" onClick={onEnd} aria-label="End call">
        <img src={endCallIcon} alt="End Call" />
        <span>End</span>
      </button>
    </div>
  );
}
