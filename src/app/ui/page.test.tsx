import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import Page from './page';

describe('/ui gallery', () => {
  it('renders without crashing', () => {
    render(<Page />);
    expect(screen.getByText(/buttons/i)).toBeInTheDocument();
  });

  it('renders badge section heading', () => {
    render(<Page />);
    expect(screen.getByText(/badges/i)).toBeInTheDocument();
  });

  it('renders simulation panel section heading', () => {
    render(<Page />);
    expect(screen.getByText(/simulation panel/i)).toBeInTheDocument();
  });

  it('renders toggle theme button', () => {
    render(<Page />);
    expect(screen.getByText(/toggle theme/i)).toBeInTheDocument();
  });
});
