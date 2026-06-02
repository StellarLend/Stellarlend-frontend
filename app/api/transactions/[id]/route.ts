import { NextRequest, NextResponse } from 'next/server';
import { getTransactionDetail } from '@/lib/transactions/repository';
import { transactionIdSchema } from '@/lib/validation/schemas/transactions';
import { withRequestLogging } from '@/lib/api/handler';

export const runtime = 'nodejs';

/** GET /api/transactions/[id]
 *
 *  Fetches a single transaction details by its ID (mock ID or 64-character hex hash).
 *  Validates dynamic ID shape via the validation schema layer.
 *  Returns embedded operation lists, transaction fees, and Stellar Expert URLs.
 *
 *  Errors:
 *    400 – Invalid transaction ID shape
 *    404 – Transaction not found
 */
async function handleGetTransactionDetail(
  _req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params;

  // Validate the ID shape via the Zod schema validation layer
  const validationResult = transactionIdSchema.safeParse(id);
  if (!validationResult.success) {
    return NextResponse.json(
      {
        error: 'Invalid transaction ID format',
        details: validationResult.error.errors[0].message,
      },
      { status: 400 }
    );
  }

  // Retrieve detailed normalized transaction record
  const transaction = await getTransactionDetail(id);
  if (!transaction) {
    return NextResponse.json(
      { error: 'Transaction not found' },
      { status: 404 }
    );
  }

  return NextResponse.json({ transaction });
}

export const GET = withRequestLogging('/api/transactions/[id]', handleGetTransactionDetail);
