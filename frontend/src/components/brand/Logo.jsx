import React from 'react';
import { cn } from '../../lib/utils';

/**
 * Ti-Cari Otomotiv (Powered by MacTech) — Kurumsal Logo Bileşeni
 *
 * variant:
 *   - "full"  → Tam dikey logo (Ti-Cari Otomotiv + Powered by MacTech) — Auth/E-posta için
 *   - "mark"  → Sadece TC monogram — Sidebar daraltılmış / favicon için
 *   - "horizontal" → TC mark + "Ti-Cari Otomotiv" yatay metni — Sidebar genişletilmiş için
 *
 * sizes (height):
 *   - sm = 8 (32px) · md = 12 (48px) · lg = 20 (80px) · xl = 36 (144px) · 2xl = 48 (192px)
 */
const LOGO_FULL = '/assets/images/ti-cari-logo.png';
const LOGO_MARK = '/assets/images/ti-cari-logo-mark.png';

const sizeMap = {
  sm: 'h-8',
  md: 'h-12',
  lg: 'h-20',
  xl: 'h-36',
  '2xl': 'h-48',
};

export const Logo = ({
  variant = 'full',
  size = 'md',
  withTagline = false,
  className = '',
  'data-testid': dataTestId = 'ti-cari-logo',
}) => {
  const alt = 'Ti-Cari Otomotiv • Powered by MacTech';
  const heightClass = sizeMap[size] || sizeMap.md;

  if (variant === 'mark') {
    return (
      <img
        src={LOGO_MARK}
        alt={alt}
        className={cn(heightClass, 'w-auto object-contain select-none', className)}
        draggable={false}
        data-testid={dataTestId}
      />
    );
  }

  if (variant === 'horizontal') {
    return (
      <div className={cn('flex items-center gap-2.5 select-none', className)} data-testid={dataTestId}>
        <img
          src={LOGO_MARK}
          alt={alt}
          className={cn(heightClass, 'w-auto object-contain')}
          draggable={false}
        />
        <div className="flex flex-col leading-tight">
          <span className="font-heading text-white text-lg tracking-[0.18em] uppercase">
            Ti<span className="text-ti-gold">-</span>Cari
          </span>
          <span className="text-[9px] text-ti-gold tracking-[0.25em] uppercase font-semibold">
            Otomotiv
          </span>
        </div>
      </div>
    );
  }

  // full
  return (
    <div className={cn('inline-flex flex-col items-center', className)} data-testid={dataTestId}>
      <img
        src={LOGO_FULL}
        alt={alt}
        className={cn(heightClass, 'w-auto object-contain select-none')}
        draggable={false}
      />
      {withTagline && (
        <span className="mt-2 text-[10px] tracking-[0.3em] uppercase text-ti-gold font-semibold">
          Powered by MacTech
        </span>
      )}
    </div>
  );
};

export default Logo;
