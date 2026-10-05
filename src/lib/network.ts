// Compatible with iOS 17 WKWebView; no dependency on AbortSignal.any.
export async function timeoutFetch(
  input: RequestInfo | URL,
  init: RequestInit = {},
  timeoutMs = 45000,
) {
  const controller = new AbortController();
  const parent =
    init.signal ?? (input instanceof Request ? input.signal : null);
  const abort = () => controller.abort(parent?.reason);
  if (parent?.aborted) abort();
  else parent?.addEventListener("abort", abort, { once: true });
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);
  try {
    return await fetch(input, { ...init, signal: controller.signal });
  } catch (error) {
    if (timedOut)
      throw new Error(
        "Request timed out. Your local draft is preserved; retry when connected.",
      );
    throw error;
  } finally {
    clearTimeout(timer);
    parent?.removeEventListener("abort", abort);
  }
}
