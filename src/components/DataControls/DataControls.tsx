import { useRef, useState } from 'react';
import { useTierList } from '../../context/useTierList';
import { useMode } from '../../context/useMode';
import { buildExportBundle, parseImportBundle, applyImportBundle, ImportValidationError } from '../../context/tierListStore';
import styles from './DataControls.module.css';

export function DataControls() {
  const { state, dispatch } = useTierList();
  const { mode, setMode } = useMode();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function handleExport() {
    const bundle = buildExportBundle(state);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `qanimetierlist-${state.mode}-export-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();

    URL.revokeObjectURL(url);
  }

  async function handleImportFile(file: File) {
    setImportError(null);

    let bundle;
    try {
      bundle = parseImportBundle(JSON.parse(await file.text()));
    } catch (err) {
      setImportError(
        err instanceof ImportValidationError || err instanceof SyntaxError
          ? err.message
          : 'Failed to read that file.'
      );
      return;
    }

    const confirmed = window.confirm(
      `Importing will replace your current ${bundle.mode} tier list, filters, usernames, and hidden entries with the contents of this file. Continue?`
    );
    if (!confirmed) return;

    const newState = applyImportBundle(bundle);
    if (bundle.mode === mode) {
      // Same mode: the provider isn't remounted, so swap the live state directly.
      dispatch({ type: 'REPLACE_STATE', state: newState });
    } else {
      // Different mode: applyImportBundle already wrote that mode's storage
      // keys; switching mode remounts the provider, which loads them.
      setMode(bundle.mode);
    }
  }

  return (
    <div className={styles.panel}>
      <button type="button" className={styles.btn} onClick={handleExport}>
        Export
      </button>
      <button type="button" className={styles.btn} onClick={() => fileInputRef.current?.click()}>
        Import
      </button>
      <input
        ref={fileInputRef}
        type="file"
        accept="application/json"
        hidden
        onChange={e => {
          const file = e.target.files?.[0];
          e.target.value = '';
          if (file) void handleImportFile(file);
        }}
      />
      {importError && <p className={styles.error}>{importError}</p>}
    </div>
  );
}
