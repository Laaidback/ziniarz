/**
 * Puts files into an <input type="file"> and fires `change`, as a user choosing them would.
 * (userEvent.upload in Vitest 3.2 sends binary files as text, which corrupts fonts and images.)
 */
export function chooseFiles(input: Element, files: File[]): void {
  const transfer = new DataTransfer();
  for (const file of files) transfer.items.add(file);
  const element = input as HTMLInputElement;
  element.files = transfer.files;
  element.dispatchEvent(new Event('change', { bubbles: true }));
}
