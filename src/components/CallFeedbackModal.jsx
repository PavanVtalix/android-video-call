import React, { useEffect, useState } from "react";

export default function CallFeedbackModal({
  open,
  title,
  description,
  submitLabel = "Submit feedback",
  onSubmit,
  onSkip,
  disabled = false,
}) {
  const [rating, setRating] = useState(0);
  const [heading, setHeading] = useState("");
  const [details, setDetails] = useState("");

  useEffect(() => {
    if (!open) {
      setRating(0);
      setHeading("");
      setDetails("");
    }
  }, [open]);

  if (!open) {
    return null;
  }

  const handleSubmit = async () => {
    if (!rating || disabled) {
      return;
    }

    await onSubmit?.({
      rating,
      heading: heading.trim(),
      description: details.trim(),
    });
  };

  return (
    <div className="call-sheet-backdrop">
      <div className="call-sheet">
        <div className="call-sheet__header">
          <div className="call-sheet__eyebrow">Call feedback</div>
          <h3 className="call-sheet__title">{title}</h3>
          <p className="call-sheet__description">{description}</p>
        </div>

        <div className="call-sheet__rating">
          {[1, 2, 3, 4, 5].map((value) => (
            <button
              key={value}
              type="button"
              className={`call-sheet__star ${value <= rating ? "active" : ""}`}
              onClick={() => setRating(value)}
            >
              {value <= rating ? "★" : "☆"}
            </button>
          ))}
        </div>

        <div className="call-sheet__body">
          {/* <input
            value={heading}
            onChange={(event) => setHeading(event.target.value)}
            placeholder="Feedback title"
          /> */}
          <textarea
            value={details}
            onChange={(event) => setDetails(event.target.value)}
            placeholder="Tell us about the call"
            rows="4"
          />
        </div>

        <div className="call-sheet__actions">
          <button type="button" className="call-sheet__ghost" onClick={onSkip}>
            Skip
          </button>
          <button
            type="button"
            className="call-sheet__primary"
            disabled={!rating || disabled}
            onClick={handleSubmit}
          >
            {submitLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
