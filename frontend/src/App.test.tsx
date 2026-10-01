import { render, screen } from '@testing-library/react';
import { describe, expect, it, vi } from 'vitest';
import { App } from './App';

describe('App skeleton', () => {
  it('renders the title', () => {
    vi.stubGlobal(
      'fetch',
      vi.fn(() => Promise.resolve(new Response('{}', { status: 200 }))),
    );
    render(<App />);
    expect(screen.getByText('Meowgul')).toBeTruthy();
  });
});
