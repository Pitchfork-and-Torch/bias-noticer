/**
 * Typed messaging helpers between popup, sidepanel, content, background.
 */

import type { MessageResponse, MessageType } from "./types";

export async function sendToBackground<T = unknown>(
  message: MessageType
): Promise<MessageResponse<T>> {
  try {
    const res = await chrome.runtime.sendMessage(message);
    return res as MessageResponse<T>;
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
