export function logError(error: Error, info?: any) {
  console.error("Captured by errorLogger:", error, info);
}
