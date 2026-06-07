import { NextResponse } from 'next/server';
import { calculateProtocolFee, ActionType } from '@/lib/billing/fee-calculator';

/**
 * @swagger
 * /api/quote:
 *   get:
 *     summary: Get quote for lend/borrow/repay action
 *     description: Returns interest math and computed protocol fees for the specified action. Note - Protocol fees take precedence over interest calculations during settlement.
 *     parameters:
 *       - in: query
 *         name: marketId
 *         required: true
 *         schema:
 *           type: string
 *       - in: query
 *         name: action
 *         required: true
 *         schema:
 *           type: string
 *           enum: [lend, borrow, repay]
 *       - in: query
 *         name: amount
 *         required: true
 *         schema:
 *           type: number
 *     responses:
 *       200:
 *         description: Quote derived successfully
 *       400:
 *         description: Invalid parameters
 */
export async function GET(request: Request) {
  try {
    const { searchParams } = new URL(request.url);
    const marketId = searchParams.get('marketId');
    const action = searchParams.get('action') as ActionType;
    const amount = parseFloat(searchParams.get('amount') || '');

    if (!marketId || !action || isNaN(amount) || amount < 0 || !['lend', 'borrow', 'repay'].includes(action)) {
      return NextResponse.json({ error: 'Invalid or missing parameters' }, { status: 400 });
    }

    const interestRateBps = action === 'lend' ? 300 : 500;

    return NextResponse.json({
      quote: {
        estimatedInterestPerYear: (amount * interestRateBps) / 10000,
        protocolFee: calculateProtocolFee(marketId, action, amount),
        note: 'Protocol fees take precedence over interest calculations during settlement.'
      }
    }, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: error.message.includes('Market not found') ? 404 : 500 });
  }
}