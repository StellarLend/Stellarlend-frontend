import { useState } from "react"
import { Copy } from "lucide-react"

interface MetricCardProps {
  icon: React.ReactNode
  label: string
  value: string
  subLabel?: string
  subValue?: string
  copyValue?: string
  isPrimary?: boolean
}

const MetricCard: React.FC<MetricCardProps> = ({
  icon,
  label,
  value,
  subLabel,
  subValue,
  copyValue,
  isPrimary = false,
}) => {
  const [isCopied, setIsCopied] = useState(false)

  const handleCopy = () => {
    if (copyValue) {
      navigator.clipboard.writeText(copyValue)
      setIsCopied(true)
      setTimeout(() => setIsCopied(false), 2000)
    }
  }

  // Adjusted green tones to match the screenshot
  const cardBg = isPrimary ? "bg-[#0A3D1E]" : "bg-[#097C4C]"
  const subBg = isPrimary ? "bg-[#072815]" : "bg-[#06613D]"
  const textColor = "text-white"
  const subLabelColor = isPrimary ? "text-[#AAABAB]" : "text-[#D4F3E6]"

  return (
    <div className={`${cardBg} rounded-xl overflow-hidden`}>
      <div className="p-5 pb-4">
        <div className="flex items-center gap-2 mb-4">
          <div className=" bg-opacity-20 p-1.5 rounded-md flex items-center justify-center">
            {icon}
          </div>
          <span className={`${textColor} text-base font-medium`}>{label}</span>
        </div>
        <h3 className={`${textColor} text-[32px] font-bold mb-4`}>{value}</h3>
      </div>

      {(subLabel || copyValue) && (
        <div className={`${subBg} p-4 flex items-center justify-between`}>
          {subLabel && subValue ? (
            <div className="flex items-center justify-between w-full">
              <span className={`${subLabelColor} text-sm`}>{subLabel}</span>
              <span className={`${textColor} text-sm font-medium`}>{subValue}</span>
            </div>
          ) : copyValue ? (
            <div className="flex items-center justify-between w-full">
              <span className={`${subLabelColor} text-sm`}>Copy Address</span>
              <div className="flex items-center gap-2">
                <span className={`${textColor} text-sm font-medium`}>{copyValue}</span>
                <button
                  onClick={handleCopy}
                  className={`${subLabelColor} hover:text-white transition-colors`}
                  aria-label="Copy address to clipboard"
                >
                  <Copy size={16} />
                </button>
              </div>
            </div>
          ) : null}
        </div>
      )}
    </div>
  )
}

export default function MetricsCards() {
  return (
    <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
      <MetricCard
        isPrimary={true}
        icon={<img src="/icons/icon.svg" alt="Wallet Icon" className="w-5 h-5" />}
        label="Available Balance"
        value="$3,750.00 XLM"
        copyValue="BaDE1b2U45...670UzZ"
      />

      <MetricCard
        icon={<img src="/icons/icon-11.svg" alt="Dollar Icon" className="w-5 h-5" />}
        label="Total Borrowed Amount"
        value="$1,500.00 XLM"
        subLabel="Next Due Payment"
        subValue="$250.00 in 4 days"
      />

      <MetricCard
        icon={<img src="/icons/icon-11.svg" alt="Dollar Icon" className="w-5 h-5" />}
        label="Total Supplied Funds"
        value="$5,000.00 XLM"
        subLabel="Earnings from Lending"
        subValue="$95.00 XLM"
      />
    </div>
  )
}
