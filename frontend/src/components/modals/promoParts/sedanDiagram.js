/**
 * Profesyonel SEDAN top-down diyagramı.
 *
 * Eski şematik dikdörtgenler yerine gerçek bir sedan silüeti içine
 * yerleştirilmiş 13 panel parçası üretir. Hem React preview'da
 * (dangerouslySetInnerHTML), hem PDF print HTML'inde ve hem de
 * future kullanımlar için tek doğruluk kaynağıdır.
 *
 * Parça id'leri (PromoCardModal ve ekspertiz şeması ile birebir uyumlu):
 *   arka_tampon, bagaj
 *   sol_arka_camurluk, sag_arka_camurluk
 *   sol_arka_kapi,     sag_arka_kapi
 *   tavan
 *   sol_on_kapi,       sag_on_kapi
 *   sol_on_camurluk,   sag_on_camurluk
 *   kaput, on_tampon
 *
 * Renk paleti (durum):
 *   orijinal → #22c55e
 *   boyali   → #eab308
 *   lokal    → #3b82f6
 *   degisen  → #ef4444
 */

const STATUS_COLORS = {
  orijinal: '#22c55e',
  boyali:   '#eab308',
  lokal:    '#3b82f6',
  degisen:  '#ef4444',
};

const STATUS_BORDERS = {
  orijinal: '#16a34a',
  boyali:   '#ca8a04',
  lokal:    '#2563eb',
  degisen:  '#dc2626',
};

const STATUS_LABELS = {
  orijinal: 'ORJ',
  boyali:   'BOY',
  lokal:    'LOK',
  degisen:  'DEĞ',
};

const fillFor    = (s) => STATUS_COLORS[s]  || STATUS_COLORS.orijinal;
const strokeFor  = (s) => STATUS_BORDERS[s] || STATUS_BORDERS.orijinal;
const labelFor   = (s) => STATUS_LABELS[s]  || STATUS_LABELS.orijinal;

/**
 * Yeni: gerçekçi sedan silueti. viewBox 240×480, dikey (alt = ön, üst = arka).
 *
 * @param {Object} expertise - { parts: { [partId]: 'orijinal'|'boyali'|'lokal'|'degisen' } }
 * @param {Object} options
 * @param {boolean} [options.includeLegend=true]
 * @param {boolean} [options.includeLabels=true] - parça etiketleri (ORJ/BOY/LOK/DEĞ)
 * @param {boolean} [options.withWrapper=true] - dış <svg> tagı dahil mi
 * @param {number}  [options.maxWidth=240]    - sadece withWrapper=true ile etkin
 */
export function buildSedanDiagramSvg(expertise, options = {}) {
  const {
    includeLegend = true,
    includeLabels = true,
    withWrapper = true,
    maxWidth = 240,
  } = options;

  const status = (id) => expertise?.parts?.[id] || 'orijinal';

  // Path tabanlı sedan paneli helper — her panel kendi shape'ini taşır
  const panel = (id, d, labelText, labelX, labelY, fontSize = 9) => {
    const s = status(id);
    const fill = fillFor(s);
    const stroke = strokeFor(s);
    const lbl = labelFor(s);
    let html = `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="1.5" stroke-linejoin="round"/>`;
    if (includeLabels) {
      html += `<text x="${labelX}" y="${labelY}" text-anchor="middle" font-size="${fontSize}" font-weight="800" fill="#ffffff" style="paint-order:stroke;stroke:rgba(0,0,0,0.25);stroke-width:0.6;">${lbl}</text>`;
      if (labelText) {
        html += `<text x="${labelX}" y="${labelY + 9}" text-anchor="middle" font-size="6.5" font-weight="600" fill="#ffffff" opacity="0.85">${labelText}</text>`;
      }
    }
    return html;
  };

  // Body shadow (alt katman — sedan dış formunun gri gölgesi)
  const bodyShadow = `
    <defs>
      <linearGradient id="bodyGrad" x1="0" y1="0" x2="0" y2="1">
        <stop offset="0%" stop-color="#f4f4f5"/>
        <stop offset="100%" stop-color="#e5e7eb"/>
      </linearGradient>
      <filter id="softShadow" x="-10%" y="-10%" width="120%" height="120%">
        <feGaussianBlur in="SourceAlpha" stdDeviation="1.5"/>
        <feOffset dx="0" dy="1.5" result="off"/>
        <feComponentTransfer><feFuncA type="linear" slope="0.25"/></feComponentTransfer>
        <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
    </defs>
    <path d="M 35,55 Q 35,15 120,15 Q 205,15 205,55 L 212,200 L 212,360 L 205,425 Q 205,465 120,465 Q 35,465 35,425 L 28,360 L 28,200 Z"
          fill="url(#bodyGrad)" stroke="#9ca3af" stroke-width="1.8" filter="url(#softShadow)"/>
  `;

  // Üst (arka) tampon — yumuşak yarım hilal şekli
  const arkaTampon = panel(
    'arka_tampon',
    'M 45,35 Q 45,20 120,20 Q 195,20 195,35 Q 195,48 188,52 L 52,52 Q 45,48 45,35 Z',
    'A.Tampon', 120, 38, 8.5
  );

  // Bagaj kapağı — alt köşeleri yumuşak kavisli
  const bagaj = panel(
    'bagaj',
    'M 60,60 L 180,60 Q 184,60 184,64 L 184,124 Q 184,128 180,128 L 60,128 Q 56,128 56,124 L 56,64 Q 56,60 60,60 Z',
    'Bagaj', 120, 92, 10
  );

  // Sol arka çamurluk — kavisli yan
  const solArkaCamurluk = panel(
    'sol_arka_camurluk',
    'M 30,60 L 53,60 L 53,135 L 32,135 Q 28,135 28,131 L 30,60 Z',
    '', 41, 102, 7
  );
  // Sağ arka çamurluk — ayna görüntüsü
  const sagArkaCamurluk = panel(
    'sag_arka_camurluk',
    'M 187,60 L 210,60 L 212,131 Q 212,135 208,135 L 187,135 L 187,60 Z',
    '', 199, 102, 7
  );

  // Arka cam (dekoratif — parça değil, tavanın bir parçası ama görsel olarak ayrı çizilir)
  const arkaCam = `
    <path d="M 60,135 L 180,135 Q 184,135 183,139 L 175,168 Q 174,172 170,172 L 70,172 Q 66,172 65,168 L 57,139 Q 56,135 60,135 Z"
          fill="#a8d8ea" opacity="0.75" stroke="#7bb8d0" stroke-width="1"/>
  `;

  // Sol arka kapı
  const solArkaKapi = panel(
    'sol_arka_kapi',
    'M 30,140 L 53,140 L 53,205 L 30,205 Z',
    '', 41, 175, 7
  );
  // Sağ arka kapı
  const sagArkaKapi = panel(
    'sag_arka_kapi',
    'M 187,140 L 210,140 L 210,205 L 187,205 Z',
    '', 199, 175, 7
  );

  // Tavan — orta büyük panel (arka cam ile ön cam arası)
  const tavan = panel(
    'tavan',
    'M 60,178 L 180,178 Q 184,178 184,182 L 184,298 Q 184,302 180,302 L 60,302 Q 56,302 56,298 L 56,182 Q 56,178 60,178 Z',
    'Tavan', 120, 240, 12
  );

  // Sol ön kapı
  const solOnKapi = panel(
    'sol_on_kapi',
    'M 30,210 L 53,210 L 53,275 L 30,275 Z',
    '', 41, 245, 7
  );
  // Sağ ön kapı
  const sagOnKapi = panel(
    'sag_on_kapi',
    'M 187,210 L 210,210 L 210,275 L 187,275 Z',
    '', 199, 245, 7
  );

  // Ön cam (dekoratif)
  const onCam = `
    <path d="M 60,308 L 180,308 Q 184,308 183,312 L 175,341 Q 174,345 170,345 L 70,345 Q 66,345 65,341 L 57,312 Q 56,308 60,308 Z"
          fill="#a8d8ea" opacity="0.75" stroke="#7bb8d0" stroke-width="1"/>
  `;

  // Sol ön çamurluk
  const solOnCamurluk = panel(
    'sol_on_camurluk',
    'M 30,280 L 53,280 L 53,355 Q 53,360 49,361 L 32,360 Q 28,360 28,356 L 30,280 Z',
    '', 41, 320, 7
  );
  // Sağ ön çamurluk
  const sagOnCamurluk = panel(
    'sag_on_camurluk',
    'M 187,280 L 210,280 L 212,356 Q 212,360 208,360 L 191,361 Q 187,360 187,355 L 187,280 Z',
    '', 199, 320, 7
  );

  // Kaput — üst köşeleri belirgin trapez (önce daralan)
  const kaput = panel(
    'kaput',
    'M 65,355 L 175,355 Q 179,355 180,358 L 184,415 Q 184,420 180,420 L 60,420 Q 56,420 56,415 L 60,358 Q 61,355 65,355 Z',
    'Kaput', 120, 388, 11
  );

  // Ön tampon (alt — yumuşak yarım hilal)
  const onTampon = panel(
    'on_tampon',
    'M 52,425 L 188,425 Q 195,432 195,445 Q 195,460 120,460 Q 45,460 45,445 Q 45,432 52,425 Z',
    'Ö.Tampon', 120, 446, 8.5
  );

  // Yan aynalar — dekoratif (parça değil)
  const aynalar = `
    <ellipse cx="22" cy="225" rx="6" ry="9" fill="#333" stroke="#111" stroke-width="0.8"/>
    <ellipse cx="218" cy="225" rx="6" ry="9" fill="#333" stroke="#111" stroke-width="0.8"/>
  `;

  // Far ve stop lambası dekorları
  const lambalar = `
    <ellipse cx="75" cy="447" rx="9" ry="3" fill="#fef3c7" opacity="0.9" stroke="#fbbf24" stroke-width="0.5"/>
    <ellipse cx="165" cy="447" rx="9" ry="3" fill="#fef3c7" opacity="0.9" stroke="#fbbf24" stroke-width="0.5"/>
    <ellipse cx="75" cy="33" rx="9" ry="3" fill="#fecaca" opacity="0.9" stroke="#ef4444" stroke-width="0.5"/>
    <ellipse cx="165" cy="33" rx="9" ry="3" fill="#fecaca" opacity="0.9" stroke="#ef4444" stroke-width="0.5"/>
  `;

  // Legend (dipte yatay)
  const legend = includeLegend ? `
    <g transform="translate(28, 472)">
      <g><rect x="0" y="0" width="9" height="9" rx="2" fill="${STATUS_COLORS.orijinal}"/><text x="13" y="7.5" font-size="7" font-weight="600" fill="#555">Orijinal</text></g>
      <g transform="translate(50,0)"><rect x="0" y="0" width="9" height="9" rx="2" fill="${STATUS_COLORS.boyali}"/><text x="13" y="7.5" font-size="7" font-weight="600" fill="#555">Boyalı</text></g>
      <g transform="translate(98,0)"><rect x="0" y="0" width="9" height="9" rx="2" fill="${STATUS_COLORS.lokal}"/><text x="13" y="7.5" font-size="7" font-weight="600" fill="#555">Lokal</text></g>
      <g transform="translate(143,0)"><rect x="0" y="0" width="9" height="9" rx="2" fill="${STATUS_COLORS.degisen}"/><text x="13" y="7.5" font-size="7" font-weight="600" fill="#555">Değişen</text></g>
    </g>
  ` : '';

  const inner = `
    ${bodyShadow}
    ${aynalar}
    ${arkaTampon}
    ${bagaj}
    ${solArkaCamurluk}
    ${sagArkaCamurluk}
    ${arkaCam}
    ${solArkaKapi}
    ${sagArkaKapi}
    ${tavan}
    ${solOnKapi}
    ${sagOnKapi}
    ${onCam}
    ${solOnCamurluk}
    ${sagOnCamurluk}
    ${kaput}
    ${onTampon}
    ${lambalar}
    ${legend}
  `;

  const vbHeight = includeLegend ? 488 : 470;

  if (!withWrapper) return inner;

  return `<svg viewBox="0 0 240 ${vbHeight}" width="${maxWidth}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;">${inner}</svg>`;
}

export default buildSedanDiagramSvg;
