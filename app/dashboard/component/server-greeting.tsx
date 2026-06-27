import { getUser } from "@/lib/auth";
import { preferencesRepository } from "@/lib/account/preferences-repository";

function formatExample(locale: string, currency: string): string {
  try {
    return new Intl.NumberFormat(locale, {
      style: "currency",
      currency,
    }).format(1234.56);
  } catch {
    return `¤1,234.56 ${currency}`;
  }
}

export async function ServerGreeting() {
  const user = await getUser();

  if (!user) {
    return (
      <div className="text-gray-500">
        <p>Welcome to Stellarlend</p>
      </div>
    );
  }

  const prefs = await preferencesRepository.getByUserId(user.id);
  const locale = prefs?.locale ?? "en-US";
  const displayCurrency = prefs?.displayCurrency ?? "USD";
  const example = formatExample(locale, displayCurrency);

  return (
    <div>
      <h1 className="text-2xl font-bold">Hello, {user.name}!</h1>
      <p className="text-gray-600">
        {user.email}
        {user.walletAddress && <span> • {user.walletAddress}</span>}
      </p>
      <p className="text-sm text-gray-500">
        Display currency: {displayCurrency} ({example})
      </p>
    </div>
  );
}
