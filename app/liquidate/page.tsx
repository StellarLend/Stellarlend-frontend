import { Metadata } from 'next';
import LiquidateComponent from '@/components/liquidate';
import config from '@/lib/config';

export const metadata: Metadata = {
  title: 'Liquidate | Stellarlend',
  description: 'Inspect unhealthy borrower positions and execute liquidations to maintain protocol solvency.',
};

export default function LiquidatePage() {
  return (
    <LiquidateComponent contractId={config.stellar.sorobanContractId} />
  );
}
