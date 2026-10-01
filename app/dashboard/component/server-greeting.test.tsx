import { render, screen } from '@testing-library/react';
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { ServerGreeting } from './server-greeting';
import { getUser } from '@/lib/auth';
import { preferencesRepository } from '@/lib/account/preferences-repository';

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  getUser: vi.fn(),
}));

vi.mock('@/lib/account/preferences-repository', () => ({
  preferencesRepository: {
    getByUserId: vi.fn(),
  },
}));

// Suppress console.error in tests for expected errors
const originalConsoleError = console.error;
beforeEach(() => {
  console.error = vi.fn();
  vi.clearAllMocks();
});
afterEach(() => {
  console.error = originalConsoleError;
});

describe('ServerGreeting', () => {
  it('renders guest view when user is not authenticated', async () => {
    vi.mocked(getUser).mockResolvedValueOnce(null);

    const ui = await ServerGreeting();
    render(ui);

    expect(screen.getByText('Welcome to Stellarlend')).toBeInTheDocument();
  });

  it('renders guest view when getUser throws an error (failure path)', async () => {
    vi.mocked(getUser).mockRejectedValueOnce(new Error('Auth service down'));

    const ui = await ServerGreeting();
    render(ui);

    expect(screen.getByText('Welcome to Stellarlend')).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith('Failed to fetch user in ServerGreeting:', expect.any(Error));
  });

  it('renders personalized view with user details and default preferences', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({
      id: 'user-1',
      name: 'Alice',
      email: 'alice@example.com',
    });
    vi.mocked(preferencesRepository.getByUserId).mockResolvedValueOnce(null);

    const ui = await ServerGreeting();
    render(ui);

    expect(screen.getByText('Hello, Alice!')).toBeInTheDocument();
    expect(screen.getByText('alice@example.com')).toBeInTheDocument();
    expect(screen.getByText(/Display currency: USD/)).toBeInTheDocument();
  });

  it('renders personalized view with user details and wallet address', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({
      id: 'user-2',
      name: 'Bob',
      email: 'bob@example.com',
      walletAddress: '0x123',
    });
    vi.mocked(preferencesRepository.getByUserId).mockResolvedValueOnce(null);

    const ui = await ServerGreeting();
    render(ui);

    expect(screen.getByText('Hello, Bob!')).toBeInTheDocument();
    expect(screen.getByText(/bob@example.com/)).toBeInTheDocument();
    expect(screen.getByText(/0x123/)).toBeInTheDocument();
  });

  it('uses custom user preferences for currency and locale', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({
      id: 'user-3',
      name: 'Charlie',
      email: 'charlie@example.com',
    });
    vi.mocked(preferencesRepository.getByUserId).mockResolvedValueOnce({
      locale: 'de-DE',
      displayCurrency: 'EUR',
    });

    const ui = await ServerGreeting();
    render(ui);

    expect(screen.getByText(/Display currency: EUR/)).toBeInTheDocument();
    // 1.234,56 € for de-DE EUR, format may slightly vary by env but it will contain €
    expect(screen.getByText(/€/)).toBeInTheDocument();
  });

  it('falls back to default preferences when preferencesRepository throws an error (failure path)', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({
      id: 'user-4',
      name: 'Dave',
      email: 'dave@example.com',
    });
    vi.mocked(preferencesRepository.getByUserId).mockRejectedValueOnce(new Error('DB connection failed'));

    const ui = await ServerGreeting();
    render(ui);

    expect(screen.getByText('Hello, Dave!')).toBeInTheDocument();
    expect(screen.getByText(/Display currency: USD/)).toBeInTheDocument();
    expect(console.error).toHaveBeenCalledWith('Failed to fetch preferences for user user-4:', expect.any(Error));
  });

  it('falls back to raw currency when locale is invalid (boundary case)', async () => {
    vi.mocked(getUser).mockResolvedValueOnce({
      id: 'user-5',
      name: 'Eve',
      email: 'eve@example.com',
    });
    vi.mocked(preferencesRepository.getByUserId).mockResolvedValueOnce({
      locale: 'invalid-locale',
      displayCurrency: 'GBP',
    });

    const ui = await ServerGreeting();
    render(ui);

    expect(console.error).toHaveBeenCalledWith('Error formatting example currency for locale: invalid-locale, currency: GBP', expect.any(Error));
    // The fallback string contains the currency 'GBP'
    expect(screen.getByText(/1,234\.56 GBP/)).toBeInTheDocument();
  });
});
