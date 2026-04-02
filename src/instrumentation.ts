export async function register() {
  // Run on server in both dev and production
  // In dev: NEXT_RUNTIME may not be set, so also check we're not in browser
  if (
    process.env.NEXT_RUNTIME === "nodejs" ||
    (typeof window === "undefined" && !process.env.NEXT_RUNTIME)
  ) {
    const { startScheduler } = await import("./lib/scheduler");
    startScheduler();
  }
}
