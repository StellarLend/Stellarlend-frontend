// @jest-environment jsdom
import React from 'react';
import { render, screen } from '@testing-library/react';
import DashboardLayout from '@/components/shared/layout/DashboardLayout';

// Helper component that throws on mount for error‑boundary tests
const ThrowOnMount = () => {
  React.useEffect(() => {
    throw new Error('Render error');
  }, []);
  return null;
};

describe('DashboardLayout', () => {
  it('renders children when valid', () => {
    render(
      <DashboardLayout>
        <div data-testid="child">Content</div>
      </DashboardLayout>,
    );
    expect(screen.getByTestId('child')).toBeInTheDocument();
  });

  it('throws when children is null', () => {
    // eslint-disable-next-line @typescript-eslint/no-empty-function
    const renderNull = () => render(<DashboardLayout>{null as any}</DashboardLayout>);
    expect(renderNull).toThrow('DashboardLayout requires a non-null children prop.');
  });

  it('shows fallback when SideNav throws', () => {
    // Replace SideNav with a throwing component via jest mock
    jest.mock('@/components/shared/layout/SideNav', () => ({
      __esModule: true,
      SideNav: () => <ThrowOnMount />,
    }));
    render(
      <DashboardLayout>
        <div />
      </DashboardLayout>,
    );
    expect(screen.getByTestId('sidenav-fallback')).toBeInTheDocument();
    // TopNav should still render (fallback not triggered)
    expect(screen.queryByTestId('topnav-fallback')).not.toBeInTheDocument();
  });

  it('shows fallback when TopNav throws', () => {
    jest.mock('@/components/shared/layout/TopNav', () => ({
      __esModule: true,
      default: () => <ThrowOnMount />,
    }));
    render(
      <DashboardLayout>
        <div />
      </DashboardLayout>,
    );
    expect(screen.getByTestId('topnav-fallback')).toBeInTheDocument();
    expect(screen.queryByTestId('sidenav-fallback')).not.toBeInTheDocument();
  });
});
