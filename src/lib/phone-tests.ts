/**
 * The 12-point test every phone goes through before it is listed.
 * Results are stored per listing as { key: true (passed) | false (failed) }.
 * A key that is missing means "not tested" (for example no fingerprint sensor).
 */
export const PHONE_TESTS = [
  "display",
  "touch",
  "front_camera",
  "back_camera",
  "speaker",
  "microphone",
  "charging",
  "wifi_bt",
  "network",
  "buttons",
  "biometric",
  "vibration",
] as const;

export type TestKey = (typeof PHONE_TESTS)[number];
export type TestResults = Partial<Record<TestKey, boolean>>;

export function allPassed(): TestResults {
  return Object.fromEntries(PHONE_TESTS.map((k) => [k, true])) as TestResults;
}

export function testSummary(results: TestResults | null | undefined) {
  const entries = Object.entries(results ?? {}) as [TestKey, boolean][];
  const tested = entries.length;
  const passed = entries.filter(([, ok]) => ok).length;
  const failed = entries.filter(([, ok]) => !ok).map(([k]) => k);
  return { tested, passed, failed };
}
