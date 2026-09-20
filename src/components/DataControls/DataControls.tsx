import { useRef, useState } from 'react';
import { useTierList } from '../../context/useTierList';
import { buildExportBundle, parseImportBundle, applyImportBundle, ImportValidationError } from '../../context/tierListStore';
import styles from './DataControls.module.css';

export function DataControls() {
  const { state, dispatch } = useTierList();
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [importError, setImportError] = useState<string | null>(null);

  function handleExport() {
    const bundle = buildExportBundle(state);
    const blob = new Blob([JSON.stringify(bundle, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);

    const a = document.createElement('a');
    a.href = url;
    a.download = `qanimetierlist-export-${new Date().toISOString().slice(0, 10)}.json`;
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
      'Importing will replace your current tier list, filters, usernames, and hidden characters with the contents of this file. Continue?'
    );
    if (!confirmed) return;

    const newState = applyImportBundle(bundle);
    dispatch({ type: 'REPLACE_STATE', state: newState });
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
