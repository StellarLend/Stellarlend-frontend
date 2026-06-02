'use client';

import { useEffect, useState } from 'react';
import type { LendingData, CalculationResult } from '@/lib/lending/types';
import { formatCurrency } from '@/lib/utils/format';

// ... (around line 74)
            <div>
              <span className="font-medium">Daily Earnings:</span> ${formatCurrency(calculation.dailyEarnings, 2)}
            </div>
            <div>
              <span className="font-medium">Total Earnings:</span> ${formatCurrency(calculation.totalEarnings, 2)}
            </div>
          </>
        ) : (
          <>
            <div>
              <span className="font-medium">Monthly Payment:</span> ${formatCurrency(calculation.monthlyPayment || 0, 2)}
            </div>
            <div>
              <span className="font-medium">Total Repayment:</span> ${formatCurrency(calculation.totalRepayment || 0, 2)}
            </div>
            <div>
              <span className="font-medium">Total Interest:</span> ${formatCurrency(calculation.totalEarnings, 2)}
            </div>
            <div>
              <span className="font-medium">Daily Interest:</span> ${formatCurrency(calculation.dailyEarnings, 2)}
            </div>
          </>
        )}

      </div>
    </div>
  );
}
