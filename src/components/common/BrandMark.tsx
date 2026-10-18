import { useTheme } from '../../context/ThemeContext';
import { brandAppIconSrc, brandLogoMarkSrc } from '../../constants/brandAssets';

type BrandMarkProps = {
  className?: string;
  variant?: 'app' | 'mark';
};

export function BrandMark({ className = 'h-6 w-6 shrink-0', variant = 'mark' }: BrandMarkProps) {
  const { isDark } = useTheme();
  const src = variant === 'app' ? brandAppIconSrc(isDark) : brandLogoMarkSrc(isDark);

  return <img src={src} alt="" aria-hidden="true" className={className} draggable={false} />;
}
