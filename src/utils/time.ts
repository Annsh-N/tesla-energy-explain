const MINUTES_PER_DAY = 24 * 60;

function normalizeMinute(minute: number): number {
  const wrapped = minute % MINUTES_PER_DAY;
  return wrapped < 0 ? wrapped + MINUTES_PER_DAY : wrapped;
}

export function clampToStep(minute: number, step = 5): number {
  if (step <= 0) {
    return minute;
  }
  return Math.round(minute / step) * step;
}

export function minutesToLabel(minute: number): string {
  const normalized = normalizeMinute(minute);
  const hours24 = Math.floor(normalized / 60);
  const mins = normalized % 60;
  const meridiem = hours24 >= 12 ? "PM" : "AM";
  const hours12 = hours24 % 12 === 0 ? 12 : hours24 % 12;
  const minsLabel = mins.toString().padStart(2, "0");
  return `${hours12}:${minsLabel} ${meridiem}`;
}

function splitLabel(label: string): { time: string; meridiem: "AM" | "PM" } {
  const [time, meridiem] = label.split(" ");
  return { time, meridiem: meridiem as "AM" | "PM" };
}

export function formatWindow(startMin: number, endMin: number): string {
  const start = splitLabel(minutesToLabel(startMin));
  const end = splitLabel(minutesToLabel(endMin));

  if (start.meridiem === end.meridiem) {
    return `${start.time}\u2013${end.time} ${end.meridiem}`;
  }

  return `${start.time} ${start.meridiem}\u2013${end.time} ${end.meridiem}`;
}
