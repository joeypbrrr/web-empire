/** Desk colors for the six documented agents. Presentation only. */
export const ACCENTS = {
  "room-builder-1": "#3ee0c5",
  "room-builder-2": "#8eb6ff",
  "room-builder-3": "#d2ee70",
  "lead-gen-1": "#ff4d8d",
  "lead-gen-2": "#ffb020",
  "lead-gen-3": "#d39bff",
};

export function accentFor(id) {
  return ACCENTS[id] || "#c9bfd2";
}

export function kindLabel(kind) {
  if (kind === "room") return "Room builder";
  if (kind === "lead") return "Lead gen";
  return "Agent";
}
