/**
 * Typed messaging helpers between popup, sidepanel, content, background.
 */

import type { MessageResponse, MessageType } from "./types";

export interface SendOptions {
  /**
   * Fail the UI wait if the service worker never responds (SW death, hung fetch).
   * Default: no client-side timeout (background still has API AbortControllers).
   */
  timeoutMs?: number;
}

export async function sendToBackground<T = unknown>(
  message: MessageType,
  opts?: SendOptions
): Promise<MessageResponse<T>> {
  try {
    const timeoutMs = opts?.timeoutMs;
    if (!timeoutMs || timeoutMs <= 0) {
      const res = await chrome.runtime.sendMessage(message);
      if (res === undefined) {
        return {
          ok: false,
          error:
            "No response from extension background. Try reloading the extension on chrome://extensions.",
        };
      }
      return res as MessageResponse<T>;
    }

    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const res = await Promise.race([
        chrome.runtime.sendMessage(message),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            reject(
              new Error(
                `Request timed out after ${Math.round(timeoutMs / 1000)}s. Check your API key, credits, and network — then try again.`
              )
            );
          }, timeoutMs);
        }),
      ]);
      if (res === undefined) {
        return {
          ok: false,
          error:
            "No response from extension background. Try reloading the extension on chrome://extensions.",
        };
      }
      return res as MessageResponse<T>;
    } finally {
      if (timer) clearTimeout(timer);
    }
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function sendToTab<T = unknown>(
  tabId: number,
  message: MessageType
): Promise<MessageResponse<T>> {
  try {
    const res = await chrome.tabs.sendMessage(tabId, message);
    return res as MessageResponse<T>;
  } catch (e) {
    return {
      ok: false,
      error: e instanceof Error ? e.message : String(e),
    };
  }
}

export async function getActiveTab(): Promise<chrome.tabs.Tab | null> {
  const [focused] = await chrome.tabs.query({
    active: true,
    lastFocusedWindow: true,
  });
  if (focused?.id != null && /^https?:/i.test(focused.url || "")) {
    return focused;
  }
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  return tab ?? focused ?? null;
}
