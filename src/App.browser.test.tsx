import { render } from 'vitest-browser-react';
import { afterEach, expect, test } from 'vitest';
import { App } from './App';
import { askConfirm } from './app/confirm';
import { ConfirmHost } from './app/ConfirmHost';
import { NoticeList } from './app/NoticeList';
import { notify } from './app/notices';

afterEach(() => {
  window.location.hash = '';
});

test('the print route opens the print screen, which reports a missing zine', async () => {
  window.location.hash = '#/zin/abc/druk';
  const screen = render(<App />);
  await expect.element(screen.getByText('Nie znaleziono tego zina. Może został usunięty.')).toBeVisible();
  await expect.element(screen.getByRole('link', { name: 'Wróć do listy zinów' })).toHaveAttribute('href', '#/');
});

test('askConfirm resolves with the button the user clicks', async () => {
  const screen = render(<ConfirmHost />);
  const answer = askConfirm('Usunąć zin „Lato”?');
  await screen.getByRole('button', { name: 'Usuń' }).click();
  expect(await answer).toBe(true);
  const second = askConfirm('Na pewno?', 'Tak');
  await screen.getByRole('button', { name: 'Anuluj' }).click();
  expect(await second).toBe(false);
  await expect.element(screen.getByRole('dialog')).not.toBeInTheDocument();
});

test('notices can be closed', async () => {
  const screen = render(<NoticeList />);
  notify('Brak miejsca w przeglądarce.');
  await expect.element(screen.getByRole('alert')).toHaveTextContent('Brak miejsca w przeglądarce.');
  await screen.getByRole('button', { name: 'Zamknij komunikat' }).click();
  await expect.element(screen.getByRole('alert')).not.toBeInTheDocument();
});
