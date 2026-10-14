import { useState } from 'react';
import { render } from 'vitest-browser-react';
import { expect, test } from 'vitest';

function Counter() {
  const [count, setCount] = useState(0);
  return <button onClick={() => setCount(count + 1)}>Kliknięto {count}</button>;
}

test('React components render and react to clicks in browser tests', async () => {
  const screen = render(<Counter />);
  await screen.getByRole('button').click();
  await expect.element(screen.getByText('Kliknięto 1')).toBeVisible();
});
