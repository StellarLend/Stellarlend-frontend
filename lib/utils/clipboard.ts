import { isAccountId } from "@/lib/validation/stellar";

export type CopyFailureReason = "invalid_address" | "clipboard_error";

export interface CopyResult {
  success: boolean;
  reason?: CopyFailureReason;
}

function execCommandFallback(text: string): boolean {
  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "");
  textarea.style.position = "fixed";
  textarea.style.left = "-9999px";
  document.body.appendChild(textarea);

  const range = document.getSelection()?.rangeCount
    ? document.getSelection()?.getRangeAt(0)
    : undefined;

  textarea.select();
  textarea.setSelectionRange(0, 99999);

  const ok = document.execCommand("copy");
  document.body.removeChild(textarea);

  if (range) {
    const sel = document.getSelection();
    sel?.removeAllRanges();
    sel?.addRange(range);
  }

  return ok;
}

export async function copyToClipboard(
  text: string,
  validateAsAddress = false,
): Promise<CopyResult> {
  if (validateAsAddress && !isAccountId(text)) {
    return { success: false, reason: "invalid_address" };
  }

  try {
    if (navigator?.clipboard && window?.isSecureContext) {
      await navigator.clipboard.writeText(text);
      return { success: true };
    }
  } catch {
    // async clipboard unavailable or rejected, try fallback
  }

  const fallbackOk = execCommandFallback(text);

  return fallbackOk
    ? { success: true }
    : { success: false, reason: "clipboard_error" };
}
