"use client";

import React from "react";
import {
  assertAuthorizedDraftAccess,
  type DraftRecord,
  type WalletIdentity,
  CreatePageValidationError,
  parseCreateRouteParams,
} from "@/src/lib/create-draft-validation";

export {
  assertAuthorizedDraftAccess,
  CreatePageValidationError,
  parseCreateRouteParams,
};

export type ResumeDraftPromptProps = {
  draft: DraftRecord | null;
  wallet: WalletIdentity | null;
  routeDraftId?: string | null;
  routeToken?: string | null;
  onResume?: () => void;
  onDiscard?: () => void;
  onCancel?: () => void;
};

export const getResumeDraftAccessError = (
  draft: DraftRecord | null,
  wallet: WalletIdentity | null,
  routeDraftId?: string | null,
  routeToken?: string | null,
) => {
  try {
    assertAuthorizedDraftAccess({
      draftId: routeDraftId,
      routeToken,
      wallet,
      draft,
    });
    return null;
  } catch (error) {
    if (error instanceof CreatePageValidationError) {
      return error;
    }
    return new CreatePageValidationError("malformed_response", "Unable to validate draft access", "request");
  }
};

export function ResumeDraftPrompt({
  draft,
  wallet,
  routeDraftId,
  routeToken,
  onResume,
  onDiscard,
  onCancel,
}: ResumeDraftPromptProps) {
  const hasResumeIntent = Boolean(routeDraftId) || Boolean(routeToken) || Boolean(draft);
  if (!hasResumeIntent) {
    return null;
  }

  const accessError = draft
    ? getResumeDraftAccessError(draft, wallet, routeDraftId, routeToken)
    : new CreatePageValidationError("malformed_response", "Draft data is missing or incomplete", "draft");
  const canResume = !accessError;

  return (
    <section aria-live="polite" aria-invalid={Boolean(accessError)}>
      {accessError ? (
        <div role="alert" data-testid="resume-draft-error">
          {accessError.message}
        </div>
      ) : (
        <div data-testid="resume-draft-ok">Resume your saved draft</div>
      )}

      <button
        type="button"
        onClick={onResume}
        disabled={!canResume || !onResume}
        aria-disabled={!canResume}
      >
        Resume draft
      </button>

      <button
        type="button"
        onClick={onDiscard}
        disabled={!canResume || !onDiscard}
        aria-disabled={!canResume}
      >
        Discard draft
      </button>

      <button type="button" onClick={onCancel} aria-label="Cancel resume flow">
        Cancel
      </button>
    </section>
  );
}

export default ResumeDraftPrompt;
