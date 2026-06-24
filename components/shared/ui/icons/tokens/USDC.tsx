export default function USDC({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 32 32" className={className ?? "w-6 h-6"} aria-label="USDC icon">
      <circle cx="16" cy="16" r="14" fill="#2775CA" />
      <text x="16" y="21" textAnchor="middle" fill="white" fontSize="10" fontWeight="bold">$</text>
    </svg>
  );
}
