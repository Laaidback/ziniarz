/** "Schowaj" in a side column's header: hides the column like its toggle in the top bar. */
export function HideButton({ label, onClick }: { label: string; onClick(): void }) {
  return (
    <button type="button" className="column-hide" aria-label={label} title={label} onClick={onClick}>
      Schowaj
    </button>
  );
}
