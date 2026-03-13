// Mock data for BLE Crowd Sensing Dashboard
// Swap to real API when backend is ready

const ROOMS = [
  { id: "main-hall", name: "Main Hall" },
  { id: "room-101", name: "Room 101" },
  { id: "room-102", name: "Room 102" },
  { id: "room-201", name: "Room 201" },
  { id: "room-202", name: "Room 202" },
];

const DENSITY_LEVELS = ["low", "medium", "high"];

function randomFrom(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function randomInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}

export function getLiveData() {
  const now = new Date();
  return ROOMS.map((room) => ({
    roomId: room.id,
    roomName: room.name,
    currentOccupancy: randomInt(5, 85),
    densityLevel: randomFrom(DENSITY_LEVELS),
    lastUpdated: now.toISOString(),
  }));
}

export function getPeakHours() {
  return Array.from({ length: 24 }, (_, i) => ({
    hour: `${i.toString().padStart(2, "0")}:00`,
    hourNum: i,
    count: Math.round(
      20 + 30 * Math.sin((i - 9) * 0.3) + 15 * Math.sin((i - 14) * 0.5)
    ),
  })).map((d) => ({ ...d, count: Math.max(0, d.count) }));
}

export function getWeeklyPatterns() {
  const days = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"];
  return days.map((day, i) => ({
    day,
    count: randomInt(40, 120),
    avgOccupancy: randomInt(35, 95),
  }));
}

export function getUnderusedSpaces() {
  return [
    { roomName: "Room 202", avgOccupancy: 12, utilizationPercent: 15 },
    { roomName: "Room 201", avgOccupancy: 18, utilizationPercent: 22 },
    { roomName: "Room 102", avgOccupancy: 25, utilizationPercent: 31 },
    { roomName: "Room 101", avgOccupancy: 42, utilizationPercent: 52 },
    { roomName: "Main Hall", avgOccupancy: 65, utilizationPercent: 81 },
  ];
}

export function getPredictions() {
  return ROOMS.map((room) => ({
    roomId: room.id,
    roomName: room.name,
    expectedNextHour: randomInt(10, 90),
    isOvercrowding: Math.random() > 0.7,
  }));
}

export function getOvercrowdingAlerts() {
  const live = getLiveData();
  return live
    .filter((r) => r.densityLevel === "high" || r.currentOccupancy > 75)
    .map((r) => ({
      roomId: r.roomId,
      roomName: r.roomName,
      currentOccupancy: r.currentOccupancy,
      densityLevel: r.densityLevel,
      threshold: 75,
    }));
}

export function getSystemStatus() {
  return {
    hubsActive: 5,
    roomsMonitored: ROOMS.length,
    lastUpdated: new Date().toISOString(),
  };
}
