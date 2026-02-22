import { APP_VERSION } from '../config/version';

/**
 * Renders the application version string as small, muted monospace text.
 *
 * The version value is read from the Vite build constant `__APP_VERSION__`,
 * which is injected at build time from the root package.json. This means the
 * displayed version is always in sync with the monorepo version field without
 * any manual update.
 *
 * Styling follows the existing `gh-*` token palette used throughout the
 * sidebar footer, keeping the text unobtrusive in both light and dark modes.
 */
export function VersionDisplay() {
  return (
    <span className="text-[10px] font-mono tracking-wide text-slate-400 dark:text-slate-500">
      {APP_VERSION}
    </span>
  );
}
