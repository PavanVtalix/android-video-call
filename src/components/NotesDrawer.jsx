import { useEffect, useState } from "react";

export default function NotesDrawer({ open, onClose, onSave }) {
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    return () => {
      onSave?.(notes);
    };
  }, [open, notes, onSave]);

  if (!open) return null;

  return (
    <div className="notes-drawer">
      <div className="notes-header">
        <span>Doctor Notes</span>
        <button onClick={onClose}>✕</button>
      </div>

      <textarea
        placeholder="Write private consultation notes..."
        value={notes}
        onChange={(e) => setNotes(e.target.value)}
      />
    </div>
  );
}
