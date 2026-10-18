import { isDesktopApp } from './platform';
import {
  ensureNativeNotificationPermission,
  isAppWindowFocused,
  sendNativeNotificationForced,
  sendNativeNotificationIfBackground,
} from './nativeNotifications';

/** Dev-only helpers for manual notification QA (see main.tsx). */
export function installNotificationDevHarness(): void {
  if (!import.meta.env.DEV) return;

  const w = window as typeof window & {
    blueprintNotifyTest?: (mode?: 'auto' | 'force-native' | 'focus-check') => void;
  };

  w.blueprintNotifyTest = async (mode: 'auto' | 'force-native' | 'focus-check' | 'permission' = 'auto') => {
    if (mode === 'permission') {
      const granted = await ensureNativeNotificationPermission();
      // eslint-disable-next-line no-console
      console.info('[blueprintNotifyTest] permission granted:', granted);
      return;
    }
    const focused = await isAppWindowFocused();
    // eslint-disable-next-line no-console
    console.info('[blueprintNotifyTest]', { mode, focused, desktop: isDesktopApp() });

    if (mode === 'focus-check') return;

    if (mode === 'force-native') {
      const ok = await sendNativeNotificationForced({
        title: 'blueprint studio',
        body: 'Forced native test — should appear in the OS notification center.',
      });
      // eslint-disable-next-line no-console
      console.info('[blueprintNotifyTest] force-native sent:', ok);
      return;
    }

    await sendNativeNotificationIfBackground({
      title: focused ? 'Should not show natively' : 'blueprint studio',
      body: focused
        ? 'Window is focused — expect in-app toast only (trigger via UI).'
        : 'Background native test — you should see an OS banner.',
    });
  };
}
