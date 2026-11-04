import { cleanup, fireEvent, render, waitFor } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import { Backtest } from '@/components/backtest';
import { TradeDialog } from '@/components/trade-dialog';

vi.mock('@tanstack/react-query', () => ({
  useQuery: () => ({ data: [] }),
  useQueryClient: () => ({ invalidateQueries: vi.fn() }),
  useMutation: () => ({ mutate: vi.fn(), isPending: false }),
}));
vi.mock('@/integrations/supabase/client', () => ({ supabase: {} }));
vi.mock('@/integrations/lovable', () => ({ lovable: {} }));
vi.mock('@/components/strategy-picker', () => ({ StrategyPicker: () => null }));
vi.mock('@/components/ui/dialog', () => ({
  Dialog: ({ children }: { children: React.ReactNode }) => children,
  DialogContent: ({ children }: { children: React.ReactNode }) => <div>{children}</div>,
  DialogTitle: ({ children }: { children: React.ReactNode }) => <h2>{children}</h2>,
  DialogDescription: ({ children }: { children: React.ReactNode }) => <p>{children}</p>,
}));

afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('Attachment-only screenshot uploads', () => {
  it('does not analyze a trade screenshot or overwrite manual trade fields', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const { container, getByLabelText, getByAltText } = render(<TradeDialog open onClose={() => {}} trade={null} userId="operator" />);
    const symbol = getByLabelText('Symbol');
    fireEvent.change(symbol, { target: { value: 'BTC/USDT' } });
    const upload = container.querySelector('input[type="file"]');
    if (!upload) throw new Error('Missing screenshot input');
    fireEvent.change(upload, { target: { files: [new File(['image'], 'chart.png', { type: 'image/png' })] } });
    await waitFor(() => expect(getByAltText('Trade screenshot').getAttribute('src')).toMatch(/^data:image\/png/));
    expect(symbol).toHaveValue('BTC/USDT');
    expect(getByLabelText('Entry price')).toHaveValue(null);
    expect(fetch).not.toHaveBeenCalled();
  });

  it('does not analyze a backtest screenshot or overwrite manual backtest fields', async () => {
    const fetch = vi.fn(); vi.stubGlobal('fetch', fetch);
    const { container, getByLabelText, getByAltText } = render(<Backtest userId="operator" onSignIn={() => {}} />);
    fireEvent.change(getByLabelText('Target (%)'), { target: { value: '3' } });
    fireEvent.change(getByLabelText('Stop loss (%)'), { target: { value: '1' } });
    fireEvent.change(getByLabelText('Result'), { target: { value: 'Loss' } });
    const upload = container.querySelector('input[type="file"]');
    if (!upload) throw new Error('Missing screenshot input');
    fireEvent.change(upload, { target: { files: [new File(['image'], 'chart.png', { type: 'image/png' })] } });
    await waitFor(() => expect(getByAltText('Backtest screenshot preview').getAttribute('src')).toMatch(/^data:image\/png/));
    expect(getByLabelText('Target (%)')).toHaveValue(3);
    expect(getByLabelText('Stop loss (%)')).toHaveValue(1);
    expect(getByLabelText('Result')).toHaveValue('Loss');
    expect(fetch).not.toHaveBeenCalled();
  });
});