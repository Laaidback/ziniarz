import { render } from 'vitest-browser-react';
import { expect, test, vi } from 'vitest';
import { ScreenBoundary } from './ScreenBoundary';

function Broken(): never {
  throw new Error('Failed to fetch dynamically imported module');
}

test('a screen whose code cannot be downloaded shows a way out instead of a blank page', async () => {
  const quiet = vi.spyOn(console, 'error').mockImplementation(() => {});
  try {
    const screen = render(
      <ScreenBoundary>
        <Broken />
      </ScreenBoundary>,
    );
    await expect.element(screen.getByText('Nie udało się wczytać tej części aplikacji. Sprawdź połączenie i odśwież stronę.')).toBeVisible();
    await expect.element(screen.getByRole('link', { name: 'Wróć do listy zinów' })).toHaveAttribute('href', '#/');
  } finally {
    quiet.mockRestore();
  }
});

test('while a screen is downloading, it says so', async () => {
  const never = new Promise<never>(() => {});
  function Waiting(): never {
    throw never;
  }
  const screen = render(
    <ScreenBoundary>
      <Waiting />
    </ScreenBoundary>,
  );
  await expect.element(screen.getByText('Wczytywanie…')).toBeVisible();
});
