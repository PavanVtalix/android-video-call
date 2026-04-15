import React from "react";

export default function CallNoticeModal({
  open,
  title,
  description,
  actionLabel = "Okay",
  onAction,
}) {
  if (!open) {
    return null;
  }

  return (
    <div className="call-sheet-backdrop">
      <div className="call-sheet call-sheet--notice">
        <div className="call-sheet__header">
          <div className="call-sheet__eyebrow">Session reminder</div>
          <h3 className="call-sheet__title">{title}</h3>
          <p className="call-sheet__description">{description}</p>
        </div>

        <div className="call-sheet__actions">
          <button type="button" className="call-sheet__primary" onClick={onAction}>
            {actionLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
