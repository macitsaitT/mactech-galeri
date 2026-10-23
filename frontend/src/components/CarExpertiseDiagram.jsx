import React, { useState, useMemo } from 'react';

// ✅ Otomologs tarzı renk paleti (Orijinal: gri, Lokal: turuncu, Boyalı: mavi, Değişen: mor)
const statusConfig = {
  orijinal: { label: 'O',  bg: '#d1d5db', text: '#0b0b0c', name: 'Orijinal' },
  lokal:    { label: 'L',  bg: '#f59e0b', text: '#0b0b0c', name: 'Lokal Boyalı' },
  boyali:   { label: 'B',  bg: '#3b82f6', text: '#fff',    name: 'Boyalı' },
  degisen:  { label: 'D',  bg: '#a855f7', text: '#fff',    name: 'Değişen' },
};

const statusOrder = ['orijinal', 'lokal', 'boyali', 'degisen'];

// Top-down araç şeması — yüzde bazlı (320×420 sanal alan)
const carParts = [
  { id: 'on_tampon',         name: 'Ön Tampon',          top: 1,  left: 28, w: 44, h: 5,  group: 'tampon' },
  { id: 'kaput',             name: 'Kaput',              top: 7,  left: 22, w: 56, h: 13, group: 'on' },
  { id: 'sol_on_camurluk',   name: 'Sol Ön Çamurluk',    top: 7,  left: 8,  w: 12, h: 13, group: 'camurluk' },
  { id: 'sag_on_camurluk',   name: 'Sağ Ön Çamurluk',    top: 7,  left: 80, w: 12, h: 13, group: 'camurluk' },
  { id: 'sol_on_kapi',       name: 'Sol Ön Kapı',        top: 22, left: 8,  w: 12, h: 18, group: 'kapi' },
  { id: 'sag_on_kapi',       name: 'Sağ Ön Kapı',        top: 22, left: 80, w: 12, h: 18, group: 'kapi' },
  { id: 'tavan',             name: 'Tavan',              top: 22, left: 22, w: 56, h: 36, group: 'tavan' },
  { id: 'sol_arka_kapi',     name: 'Sol Arka Kapı',      top: 42, left: 8,  w: 12, h: 18, group: 'kapi' },
  { id: 'sag_arka_kapi',     name: 'Sağ Arka Kapı',      top: 42, left: 80, w: 12, h: 18, group: 'kapi' },
  { id: 'sol_arka_camurluk', name: 'Sol Arka Çamurluk',  top: 62, left: 8,  w: 12, h: 13, group: 'camurluk' },
  { id: 'sag_arka_camurluk', name: 'Sağ Arka Çamurluk',  top: 62, left: 80, w: 12, h: 13, group: 'camurluk' },
  { id: 'bagaj',             name: 'Bagaj',              top: 62, left: 22, w: 56, h: 13, group: 'arka' },
  { id: 'arka_tampon',       name: 'Arka Tampon',        top: 76, left: 28, w: 44, h: 5,  group: 'tampon' },
];

const PART_BY_ID = Object.fromEntries(carParts.map(p => [p.id, p]));

const CarExpertiseDiagram = ({ expertiseParts = {}, onChange, readOnly = false }) => {
  const [hoveredPart, setHoveredPart] = useState(null);

  const getStatus = (partId) => expertiseParts[partId] || 'orijinal';

  const handleClick = (partId) => {
    if (readOnly) return;
    const current = getStatus(partId);
    const idx = statusOrder.indexOf(current);
    const next = statusOrder[(idx + 1) % statusOrder.length];
    onChange?.(partId, next);
  };

  // Status'a göre parçaları gruple (özet listesi için)
  const groupedByStatus = useMemo(() => {
    const out = { orijinal: [], lokal: [], boyali: [], degisen: [] };
    carParts.forEach(p => {
      const s = getStatus(p.id);
      out[s] = out[s] || [];
      out[s].push(p);
    });
    return out;
  }, [expertiseParts]); // eslint-disable-line react-hooks/exhaustive-deps

  return (
    <div className="flex flex-col items-center select-none w-full">
      {/* Başlık */}
      <div className="flex items-center gap-3 mb-4 w-full">
        <div className="h-px flex-1 bg-border" />
        <h4 className="font-heading font-bold text-xs uppercase tracking-[0.2em] text-muted-foreground">
          Hasar Durumu
        </h4>
        <div className="h-px flex-1 bg-border" />
      </div>

      {/* Legend (üstte) */}
      <div className="flex flex-wrap items-center justify-center gap-2 mb-4 w-full">
        {statusOrder.map((key) => (
          <div
            key={key}
            className="flex items-center gap-1.5 px-2.5 py-1 rounded-md bg-muted/40 border border-border"
            data-testid={`legend-${key}`}
          >
            <div
              className="w-3 h-3 rounded-sm shrink-0"
              style={{ backgroundColor: statusConfig[key].bg }}
            />
            <span className="text-[11px] font-semibold text-foreground/80">{statusConfig[key].name}</span>
          </div>
        ))}
      </div>

      {/* Araç şeması (top view) */}
      <div className="relative" style={{ width: 290, height: 360 }}>
        {/* Outer body & details */}
        <svg viewBox="0 0 100 90" className="absolute inset-0 w-full h-full" style={{ zIndex: 0 }}>
          {/* Tekerlekler — köşelerde, parçaların dışında */}
          <g fill="#1a1a1a" stroke="#3a3a3a" strokeWidth="0.4">
            <rect x="2" y="11" width="6" height="11" rx="1.5" />
            <rect x="92" y="11" width="6" height="11" rx="1.5" />
            <rect x="2" y="60" width="6" height="11" rx="1.5" />
            <rect x="92" y="60" width="6" height="11" rx="1.5" />
          </g>
          {/* Jantlar */}
          <g fill="#0b0b0c" stroke="#666" strokeWidth="0.3">
            <circle cx="5" cy="16.5" r="2.4" />
            <circle cx="95" cy="16.5" r="2.4" />
            <circle cx="5" cy="65.5" r="2.4" />
            <circle cx="95" cy="65.5" r="2.4" />
          </g>
          {/* Yan aynalar */}
          <g fill="rgba(255,255,255,0.1)" stroke="rgba(255,255,255,0.18)" strokeWidth="0.3">
            <ellipse cx="9" cy="23" rx="2.5" ry="1.5" />
            <ellipse cx="91" cy="23" rx="2.5" ry="1.5" />
          </g>
          {/* Cam çizgileri (görsel detay) */}
          <line x1="22" y1="21" x2="78" y2="21" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" strokeDasharray="2 1" />
          <line x1="22" y1="60" x2="78" y2="60" stroke="rgba(255,255,255,0.18)" strokeWidth="0.5" strokeDasharray="2 1" />
          {/* Farlar/stoplar */}
          <ellipse cx="35" cy="3" rx="3" ry="1" fill="rgba(212,160,48,0.35)" />
          <ellipse cx="65" cy="3" rx="3" ry="1" fill="rgba(212,160,48,0.35)" />
          <ellipse cx="35" cy="83" rx="3" ry="1" fill="rgba(239,68,68,0.4)" />
          <ellipse cx="65" cy="83" rx="3" ry="1" fill="rgba(239,68,68,0.4)" />
        </svg>

        {/* Tıklanabilir parçalar */}
        {carParts.map((part) => {
          const status = getStatus(part.id);
          const config = statusConfig[status];
          const isHovered = hoveredPart === part.id;

          // Parça başına özel border-radius (araç şekli hissi)
          let radius = '4px';
          if (part.id === 'on_tampon') radius = '12px 12px 4px 4px';
          if (part.id === 'arka_tampon') radius = '4px 4px 12px 12px';
          if (part.id === 'kaput') radius = '6px 6px 0 0';
          if (part.id === 'bagaj') radius = '0 0 6px 6px';
          if (part.id === 'sol_on_camurluk') radius = '10px 0 0 0';
          if (part.id === 'sag_on_camurluk') radius = '0 10px 0 0';
          if (part.id === 'sol_arka_camurluk') radius = '0 0 0 10px';
          if (part.id === 'sag_arka_camurluk') radius = '0 0 10px 0';

          return (
            <button
              key={part.id}
              type="button"
              onClick={() => handleClick(part.id)}
              onMouseEnter={() => setHoveredPart(part.id)}
              onMouseLeave={() => setHoveredPart(null)}
              disabled={readOnly}
              className="absolute flex items-center justify-center font-bold transition-all duration-150"
              style={{
                top: `${part.top}%`,
                left: `${part.left}%`,
                width: `${part.w}%`,
                height: `${part.h}%`,
                backgroundColor: config.bg,
                color: config.text,
                fontSize: part.id === 'tavan' ? 14 : 10,
                fontWeight: 800,
                borderRadius: radius,
                border: isHovered ? '2px solid #fff' : '1px solid rgba(0,0,0,0.3)',
                transform: isHovered ? 'scale(1.03)' : 'scale(1)',
                zIndex: isHovered ? 10 : 1,
                boxShadow: isHovered ? '0 0 14px rgba(255,255,255,0.25)' : 'inset 0 1px 0 rgba(255,255,255,0.15), 0 1px 3px rgba(0,0,0,0.4)',
                textShadow: status === 'orijinal' || status === 'lokal' ? 'none' : '0 1px 2px rgba(0,0,0,0.5)',
                cursor: readOnly ? 'default' : 'pointer',
              }}
              data-testid={`diagram-${part.id}`}
              title={`${part.name}: ${config.name}`}
            >
              {config.label}
              {isHovered && (
                <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-black border border-white/20 rounded px-2 py-0.5 text-[10px] font-medium whitespace-nowrap shadow-xl z-20 text-white">
                  {part.name}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {!readOnly && (
        <p className="text-[10px] text-muted-foreground/60 mt-3 text-center">
          Durumunu değiştirmek için ilgili parçaya tıklayın
        </p>
      )}

      {/* ✅ Özet Liste — durum bazlı gruplandırılmış (Otomologs benzeri) */}
      <div className="mt-5 w-full space-y-2">
        {statusOrder
          .filter(key => key !== 'orijinal' && groupedByStatus[key]?.length > 0)
          .map(key => {
            const cfg = statusConfig[key];
            const items = groupedByStatus[key] || [];
            return (
              <div key={key} className="rounded-lg border border-border overflow-hidden">
                <div
                  className="flex items-center justify-between px-3 py-2"
                  style={{ backgroundColor: `${cfg.bg}20` }}
                >
                  <div className="flex items-center gap-2">
                    <span className="w-3 h-3 rounded-sm" style={{ backgroundColor: cfg.bg }} />
                    <span className="text-sm font-bold" style={{ color: cfg.bg }}>{cfg.name}</span>
                  </div>
                  <span className="text-sm font-bold tabular-nums" style={{ color: cfg.bg }}>{items.length}</span>
                </div>
                <ul className="divide-y divide-border">
                  {items.map(p => (
                    <li
                      key={p.id}
                      className="px-3 py-2 text-xs text-foreground/85"
                      data-testid={`summary-${key}-${p.id}`}
                    >
                      {p.name}
                    </li>
                  ))}
                </ul>
              </div>
            );
          })}
        {/* Tümü orijinal ise positive mesaj */}
        {(groupedByStatus.lokal.length + groupedByStatus.boyali.length + groupedByStatus.degisen.length) === 0 && (
          <div className="rounded-lg border border-success/30 bg-success/10 p-3 text-center text-xs text-success font-semibold">
            ✓ Tüm parçalar orijinal — hasar kaydı yok
          </div>
        )}
      </div>
    </div>
  );
};

export { statusConfig, statusOrder, carParts, PART_BY_ID };
export default CarExpertiseDiagram;
