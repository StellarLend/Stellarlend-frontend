import { NextResponse } from 'next/server';
import { processAccountExport } from '../../../lib/account/export-bundle';

// Simple in-memory mock store tracking timestamps for the 24-hour rate limit throttle
const exportThrottleStore = new Map<string, number>();
const TWENTY_FOUR_HOURS_MS = 24 * 60 * 60 * 1000;

export async function POST(request: Request) {
  try {
    // Simulated authenticated context retrieval (normally parsed from session token)
    const userId = "user_test_9921"; 

    // 1. Throttle check: Enforce maximum 1 export per 24 hours per account
    const now = Date.now();
    const lastExportTime = exportThrottleStore.get(userId);

    if (lastExportTime && (now - lastExportTime < TWENTY_FOUR_HOURS_MS)) {
      const remainingMs = TWENTY_FOUR_HOURS_MS - (now - lastExportTime);
      const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));
      return NextResponse.json(
        { error: `DSAR export rate limit exceeded. Please wait ${remainingHours} hour(s) before requesting again.` },
        { status: 429 }
      );
    }

    // Mock payload aggregation from database services
    const mockUserPayload = {
      userId,
      profile: { email: "user@example.com", joinedAt: "2025-01-15" },
      preferences: { darkMode: true, emailNotifications: true },
      transactions: [{ id: "tx_01", asset: "XLM", amount: 500 }],
      notifications: [{ id: "notif_01", message: "Deposit confirmed" }]
    };

    // 2. Enqueue / Process the asynchronous archival export task
    const downloadUrl = await processAccountExport(mockUserPayload);

    // 3. Update the rate limit tracker timestamp upon successful execution/enqueuing
    exportThrottleStore.set(userId, now);

    // 4. Emit Audit Log Event tracking data privacy fulfillment access
    console.log(JSON.stringify({
      timestamp: new Date().toISOString(),
      level: "info",
      event: "AUDIT_GDPR_DSAR_EXPORT",
      userId,
      message: "User account archive compiled and short-lived signed access token generated successfully."
    }));

    return NextResponse.json({
      success: true,
      message: "Export compilation complete. Your secure download path has been provisioned.",
      downloadUrl,
      expiresInSeconds: 900
    }, { status: 202 });

  } catch (error: any) {
    return NextResponse.json({ error: error.message || "Internal Server Error" }, { status: 500 });
  }
}

// Helper utility exposed to clear mock states during testing execution runs
export function resetThrottleRegistry() {
  exportThrottleStore.clear();
}
