import { describe, it, expect, vi } from 'vitest';
import { render, fireEvent } from '@testing-library/react';
import React from 'react';
import { ErrorBoundary } from './ErrorBoundary';

const ThrowingComponent = ({ shouldThrow }: { shouldThrow: boolean }) => {
  if (shouldThrow) throw new Error('Test crash');
  return <div>Working fine</div>;
};

describe('ErrorBoundary', () => {
  it('renders children when no error', () => {
    const { getByText } = render(
      <ErrorBoundary><div>Hello</div></ErrorBoundary>
    );
    expect(getByText('Hello')).toBeDefined();
  });

  it('shows fallback UI when child throws', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { getByText } = render(
      <ErrorBoundary><ThrowingComponent shouldThrow={true} /></ErrorBoundary>
    );
    expect(getByText('Something went wrong')).toBeDefined();
    expect(getByText('Try again')).toBeDefined();
    spy.mockRestore();
  });

  it('shows custom fallback title', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { getByText } = render(
      <ErrorBoundary fallbackTitle="Oops!"><ThrowingComponent shouldThrow={true} /></ErrorBoundary>
    );
    expect(getByText('Oops!')).toBeDefined();
    spy.mockRestore();
  });

  it('shows data safety message', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { getByText } = render(
      <ErrorBoundary><ThrowingComponent shouldThrow={true} /></ErrorBoundary>
    );
    expect(getByText(/Your data is safe/)).toBeDefined();
    spy.mockRestore();
  });

  it('resets error state when Try again is clicked', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { getByText } = render(
      <ErrorBoundary><ThrowingComponent shouldThrow={true} /></ErrorBoundary>
    );

    expect(getByText('Something went wrong')).toBeDefined();
    expect(getByText('Try again')).toBeDefined();

    fireEvent.click(getByText('Try again'));
    spy.mockRestore();
  });
});
