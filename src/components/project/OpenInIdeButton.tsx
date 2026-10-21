import React, { useCallback } from 'react';
import { resolveIdeOption } from '../../constants/supportedIdes';
import { useNotification } from '../../context/NotificationContext';
import { useSystemSettings } from '../../context/SystemSettingsContext';
import { useTheme } from '../../context/ThemeContext';
import { coerceFindingLine, openInPreferredIde } from '../../utils/openInIde';
import { resolveLineForIdeOpen } from '../../services/findingLineResolve';

interface OpenInIdeButtonProps {
  rootPath: string;
  relativePath: string;
  line?: number | string;
  focusLine?: number | string;
  evidence?: string[];
  title?: string;
  impact?: string;
  category?: string;
  sourceContents?: Record<string, string>;
  className?: string;
}

/** Opens a project-relative finding path in the preferred IDE (System Settings). */
export const OpenInIdeButton: React.FC<OpenInIdeButtonProps> = ({
  rootPath,
  relativePath,
  line,
  focusLine,
  evidence,
  title,
  impact,
  category,
  sourceContents,
  className,
}) => {
  const { isDark } = useTheme();
  const { notify } = useNotification();
  const { preferences } = useSystemSettings();
  const ide = resolveIdeOption(preferences.preferredIdeId);
  const openLine = coerceFindingLine(focusLine) || coerceFindingLine(line);

  const onClick = useCallback(() => {
    void (async () => {
      const resolvedLine =
        openLine ||
        (await resolveLineForIdeOpen({
          rootPath,
          relativePath,
          line,
          focusLine,
          evidence,
          title,
          impact,
          category,
          sourceContents,
        }));
      const result = await openInPreferredIde({
        rootPath,
        relativePath,
        line: resolvedLine,
        ideId: preferences.preferredIdeId,
      });
      if (!result.ok) {
        notify.error(result.message, { title: 'Could not open IDE' });
      }
    })();
  }, [
    rootPath,
    relativePath,
    openLine,
    line,
    focusLine,
    evidence,
    title,
    impact,
    category,
    sourceContents,
    preferences.preferredIdeId,
    notify,
  ]);

  const lineLabel = openLine ? ` at line ${openLine}` : '';

  return (
    <button
      type="button"
      onClick={onClick}
      title={`Open in ${ide.name}${lineLabel}`}
      className={
        className ||
        (isDark
          ? 'text-xs font-medium text-blue-400 transition-colors hover:text-blue-300'
          : 'text-xs font-medium text-blue-600 transition-colors hover:text-blue-800')
      }
    >
      Open in {ide.shortName}
    </button>
  );
};
