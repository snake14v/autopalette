import { useState } from 'react';
import { useCanInstall, promptInstall } from '../lib/pwa';
import { Button } from './Button';
import { InstallIcon } from './icons';

/** Renders an "Add to Home Screen" button only when the browser has offered an install
 *  prompt (captured at startup in lib/pwa.ts). Silent when unavailable. */
export function InstallButton({ full = false }: { full?: boolean }) {
  const canInstall = useCanInstall();
  const [busy, setBusy] = useState(false);
  if (!canInstall) return null;

  return (
    <Button
      variant="secondary"
      full={full}
      loading={busy}
      onClick={async () => {
        setBusy(true);
        try {
          await promptInstall();
        } finally {
          setBusy(false);
        }
      }}
    >
      <InstallIcon width={18} height={18} />
      Add to Home Screen
    </Button>
  );
}
