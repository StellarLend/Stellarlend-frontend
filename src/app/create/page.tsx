"use client";

import React, { useMemo } from "react";
import {
  assertAuthorizedDraftAccess,
  parseCreateRouteParams,
  type DraftRecord,
  type WalletIdentity,
  CreatePageValidationError,
  validateCreatePageRequest,
} from "@/src/lib/create-draft-validation";
import { ResumeDraftPrompt } from "@/components/create/ResumeDraftPrompt";

export type CreatePageProps = {
  searchParams?: Record<string, string | string[] | undefined>;
  params?: Record<string, string | string[] | undefined>;
  wallet?: WalletIdentity | null;
  draft?: DraftRecord | null;
  onResume?: () => void;
  onDiscard?: () => void;
};

export {
  assertAuthorizedDraftAccess,
  CreatePageValidationError,
  parseCreateRouteParams,
  validateCreatePageRequest,
};

export default function CreatePage({
  searchParams = {},
  params = {},
  wallet = null,
  draft = null,
  onResume,
  onDiscard,
}: CreatePageProps) {
  const request = useMemo(() => {
    const mergedQuery = { ...params, ...searchParams };
    const routeDraftId = mergedQuery.draftId ?? mergedQuery.draft_id ?? mergedQuery.id ?? mergedQuery.draft;
    const hasResumeIntent = Boolean(routeDraftId) || Boolean(draft);

    if (!hasResumeIntent) {
      return { route: { draftId: undefined, routeToken: undefined, network: undefined }, validation: null };
    }

    try {
      const route = parseCreateRouteParams(mergedQuery);
      const validation = validateCreatePageRequest({
        draftId: route.draftId,
        routeToken: route.routeToken,
        wallet,
        draft,
        networkOverride: route.network,
      });

      return { route, validation };
    } catch (error) {
      return {
        route: {
          draftId: routeDraftId ? String(routeDraftId).trim() : undefined,
          routeToken: mergedQuery.resumeToken ? String(mergedQuery.resumeToken).trim() : undefined,
          network: mergedQuery.network ? String(mergedQuery.network).trim() : undefined,
        },
        validation: error,
      };
    }
  }, [draft, params, searchParams, wallet]);

  return (
    <ResumeDraftPrompt
      draft={draft ?? null}
      wallet={wallet ?? { address: null, network: null, connected: false }}
      routeDraftId={request.route.draftId}
      routeToken={request.route.routeToken}
      onResume={onResume}
      onDiscard={onDiscard}
    />
  );
}
