import React, { useEffect, useMemo } from 'react';
import { Code2, X } from 'lucide-react';
import { Dropdown } from '../common/Dropdown';
import { useTheme } from '../../context/ThemeContext';
import { useSystemSettings } from '../../context/SystemSettingsContext';
import { SUPPORTED_IDES } from '../../constants/supportedIdes';
import { overviewBorderClass, overviewPanelClass } from '../project/overviewUi';
import { openNotificationSystemSettings } from '../../utils/openSystemSettings';
import { isDesktopApp } from '../../utils/platform';

function SettingToggle({
  label,
  description,
  checked,
  onChange,
  isDark,
}: {
  label: string;
  description?: string;
  checked: boolean;
  onChange: (next: boolean) => void;
  isDark: boolean;
}) {
  const labelClass = isDark ? 'text-slate-100' : 'text-slate-900';
  const hintClass = isDark ? 'text-slate-500' : 'text-slate-500';

  return (
    <div className="flex items-center justify-between gap-4 py-2.5 first:pt-0 last:pb-0">
      <div className="min-w-0">
        <p className={`text-[13px] font-medium leading-snug ${labelClass}`}>{label}</p>
        {description ? <p className={`mt-0.5 text-xs leading-relaxed ${hintClass}`}>{description}</p> : null}
      </div>
      <button
        type="button"
        role="switch"
        aria-checked={checked}
        onClick={() => onChange(!checked)}
        className={`relative h-6 w-10 shrink-0 rounded-full transition-colors ${
          checked ? 'bg-blue-500' : isDark ? 'bg-white/15' : 'bg-slate-200'
        }`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform ${
            checked ? 'translate-x-4' : 'translate-x-0'
          }`}
        />
      </button>
    </div>
  );
}

function SettingsSection({
  title,
  children,
  isDark,
}: {
  title: string;
  children: React.ReactNode;
  isDark: boolean;
}) {
  return (
    <section>
      <h3 className={`text-[13px] font-medium ${isDark ? 'text-slate-100' : 'text-slate-900'}`}>{title}</h3>
      <div className="mt-3">{children}</div>
    </section>
  );
}

function FieldLabel({ children, isDark }: { children: React.ReactNode; isDark: boolean }) {
  return (
    <p className={`mb-2 text-xs font-medium ${isDark ? 'text-slate-400' : 'text-slate-600'}`}>{children}</p>
  );
}

function InsetSettingsCard({
  children,
  insetPanel,
  className = '',
}: {
  children: React.ReactNode;
  insetPanel: string;
  className?: string;
}) {
  return <div className={`px-4 py-3 ${insetPanel} ${className}`}>{children}</div>;
}

export const SystemSettingsModal: React.FC = () => {
  const {
    isDark,
    themePreference,
    setThemePreference,
    isSystemSettingsOpen,
    setIsSystemSettingsOpen,
  } = useTheme();
  const { preferences, setPreference } = useSystemSettings();
  const ideOptions = useMemo(
    () =>
      SUPPORTED_IDES.map(ide => ({
        value: ide.id,
        label: ide.name,
        description: ide.shortName,
        icon: <Code2 className="h-3.5 w-3.5" />,
      })),
    [],
  );

  useEffect(() => {
    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape' && isSystemSettingsOpen) setIsSystemSettingsOpen(false);
    };
    window.addEventListener('keydown', handleEscape);
    return () => window.removeEventListener('keydown', handleEscape);
  }, [isSystemSettingsOpen, setIsSystemSettingsOpen]);

  if (!isSystemSettingsOpen) return null;

  const border = overviewBorderClass(isDark);
  const panel = overviewPanelClass(isDark);
  const muted = isDark ? 'text-slate-500' : 'text-slate-500';
  const titleText = isDark ? 'text-slate-100' : 'text-slate-900';
  const desktop = isDesktopApp();
  const insetPanel = `rounded-xl border ${border} ${isDark ? 'bg-white/[0.02]' : 'bg-slate-50/80'}`;
  const divideClass = isDark ? 'divide-white/[0.06]' : 'divide-slate-200/80';
  const toggleRows = '[&>div]:py-3.5 [&>div:first-child]:pt-1 [&>div:last-child]:pb-1';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/55 p-4 backdrop-blur-sm sm:p-6"
      onMouseDown={event => {
        if (event.target === event.currentTarget) setIsSystemSettingsOpen(false);
      }}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="system-settings-title"
        className={`flex w-full max-w-md flex-col overflow-hidden rounded-2xl border shadow-2xl ${panel}`}
      >
        <header className={`shrink-0 border-b px-5 py-4 ${border}`}>
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <h2 id="system-settings-title" className={`text-[15px] font-semibold tracking-tight ${titleText}`}>
                System settings
              </h2>
              <p className={`mt-1 text-xs ${muted}`}>Stored on this device only.</p>
            </div>
            <button
              type="button"
              onClick={() => setIsSystemSettingsOpen(false)}
              className={`shrink-0 rounded-lg p-2 ${isDark ? 'text-slate-500 hover:bg-white/[0.06]' : 'text-slate-400 hover:bg-slate-100'}`}
              title="Close (Esc)"
            >
              <X className="h-4 w-4" />
            </button>
          </div>
        </header>

        <div className="space-y-7 px-5 py-5">
          <SettingsSection title="Appearance" isDark={isDark}>
            <InsetSettingsCard insetPanel={insetPanel}>
              <FieldLabel isDark={isDark}>Theme</FieldLabel>
              <div
                className={`grid grid-cols-3 gap-0.5 rounded-lg border p-1 ${border} ${isDark ? 'bg-black/25' : 'bg-slate-100/90'}`}
                role="radiogroup"
                aria-label="Theme"
              >
                {(['system', 'light', 'dark'] as const).map(option => (
                  <button
                    key={option}
                    type="button"
                    role="radio"
                    aria-checked={themePreference === option}
                    onClick={() => setThemePreference(option)}
                    className={`rounded-md py-2.5 text-xs font-medium capitalize transition-colors ${
                      themePreference === option
                        ? isDark
                          ? 'bg-white/10 text-white shadow-sm'
                          : 'bg-white text-slate-900 shadow-sm'
                        : isDark
                          ? 'text-slate-500 hover:text-slate-300'
                          : 'text-slate-600 hover:text-slate-900'
                    }`}
                  >
                    {option}
                  </button>
                ))}
              </div>
            </InsetSettingsCard>
          </SettingsSection>

          <SettingsSection title="Notifications" isDark={isDark}>
            <InsetSettingsCard insetPanel={insetPanel} className={`divide-y ${divideClass} ${toggleRows}`}>
              <SettingToggle
                label="Sounds"
                description="When this window is focused"
                checked={preferences.notificationSoundEnabled}
                onChange={value => setPreference('notificationSoundEnabled', value)}
                isDark={isDark}
              />
              {desktop ? (
                <SettingToggle
                  label="System alerts"
                  description="Errors and warnings in Notification Center"
                  checked={preferences.osNotificationsEnabled}
                  onChange={value => setPreference('osNotificationsEnabled', value)}
                  isDark={isDark}
                />
              ) : null}
            </InsetSettingsCard>
            {desktop ? (
              <button
                type="button"
                onClick={() => void openNotificationSystemSettings()}
                className={`mt-2.5 text-xs ${isDark ? 'text-slate-500 hover:text-slate-300' : 'text-slate-500 hover:text-slate-700'}`}
              >
                Open notification settings…
              </button>
            ) : null}
          </SettingsSection>

          <SettingsSection title="Workspace" isDark={isDark}>
            <InsetSettingsCard insetPanel={insetPanel} className="space-y-0">
              <div className="pb-4">
                <FieldLabel isDark={isDark}>Preferred editor</FieldLabel>
                <Dropdown
                  options={ideOptions}
                  value={preferences.preferredIdeId}
                  onChange={id => setPreference('preferredIdeId', id)}
                  variant="subtle"
                  size="sm"
                  fullWidth
                  placement="auto"
                  triggerClassName="!rounded-lg !py-2.5"
                  menuClassName="!rounded-xl"
                />
                <p className={`mt-2 text-[11px] leading-snug ${isDark ? 'text-slate-500' : 'text-slate-500'}`}>
                  Open in editor uses the IDE shell command. If opens fail, install it from the editor Command Palette
                  (e.g. Install &apos;cursor&apos; command in PATH).
                </p>
              </div>
              <div className={`border-t pt-1 ${border} ${toggleRows}`}>
                <SettingToggle
                  label="Resume last session"
                  description="Off always opens the home screen"
                  checked={preferences.resumeWhereLeftOff}
                  onChange={value => setPreference('resumeWhereLeftOff', value)}
                  isDark={isDark}
                />
              </div>
            </InsetSettingsCard>
          </SettingsSection>
        </div>
      </div>
    </div>
  );
};
