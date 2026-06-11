/**
 * Profesyonel "Otomologs Tarzı" Hasar Diyagramı.
 *
 * Layout:
 *   - Ortada araç gövdesi (front view) — kaput / ön cam / tavan / arka cam / bagaj
 *     dekoratif amaçlı statik gri tonlarda çizilir (tıklanabilir parça değil)
 *   - Sol ve sağ yanda "kapılar/çamurluklar açılmış gibi" 4'er panel:
 *     sol_arka_camurluk, sol_arka_kapi, sol_on_kapi, sol_on_camurluk (sol grupta)
 *     ayna görüntüsü sağda
 *   - 4 büyük tekerlek köşelerde (dekoratif)
 *   - Üstte arka_tampon (yatay şerit + cam grupları)
 *   - Altta on_tampon (yatay şerit)
 *
 * Renk paleti (Otomologs tarzı):
 *   orijinal → açık gri (#d4d4d8)
 *   boyali   → mavi (#3b82f6)
 *   lokal    → turuncu (#f59e0b)
 *   degisen  → mor (#a855f7)
 *
 * Etiketler: tek harf (B/L/D), orijinal'de etiket yok
 *
 * Parça id'leri (eski sistemle uyumlu — 13 panel):
 *   arka_tampon, bagaj, sol_arka_camurluk, sag_arka_camurluk
 *   sol_arka_kapi, sag_arka_kapi, tavan
 *   sol_on_kapi, sag_on_kapi, sol_on_camurluk, sag_on_camurluk
 *   kaput, on_tampon
 *   (tavan, bagaj, kaput, on_tampon, arka_tampon → gövdede;
 *    yan 8 panel → kanat olarak yan tarafa açılır)
 */

const COLORS = {
  orijinal: '#d4d4d8',  // light grey
  boyali:   '#3b82f6',  // blue
  lokal:    '#f59e0b',  // orange
  degisen:  '#a855f7',  // purple
};

const BORDERS = {
  orijinal: '#71717a',
  boyali:   '#1d4ed8',
  lokal:    '#b45309',
  degisen:  '#7c3aed',
};

const LABELS = {
  orijinal: '',
  boyali:   'B',
  lokal:    'L',
  degisen:  'D',
};

const TR_NAMES = {
  arka_tampon:        'Arka Tampon',
  bagaj:              'Bagaj',
  sol_arka_camurluk:  'Sol Arka Çamurluk',
  sag_arka_camurluk:  'Sağ Arka Çamurluk',
  sol_arka_kapi:      'Sol Arka Kapı',
  sag_arka_kapi:      'Sağ Arka Kapı',
  tavan:              'Tavan',
  sol_on_kapi:        'Sol Ön Kapı',
  sag_on_kapi:        'Sağ Ön Kapı',
  sol_on_camurluk:    'Sol Ön Çamurluk',
  sag_on_camurluk:    'Sağ Ön Çamurluk',
  kaput:              'Kaput',
  on_tampon:          'Ön Tampon',
};

const fillFor   = (s) => COLORS[s]  || COLORS.orijinal;
const strokeFor = (s) => BORDERS[s] || BORDERS.orijinal;
const labelFor  = (s) => LABELS[s]  || '';

/**
 * Otomologs tarzı SVG üret.
 *
 * @param {Object} expertise - { parts: { [partId]: 'orijinal'|'boyali'|'lokal'|'degisen' } }
 * @param {Object} [options]
 * @param {boolean} [options.includeLegend=true]
 * @param {boolean} [options.includeSummaryList=true] - kategori bazlı hasar listesi (alt blok)
 * @param {boolean} [options.withWrapper=true]
 * @param {boolean} [options.darkBg=true]
 * @param {number}  [options.maxWidth=400]
 */
export function buildSedanDiagramSvg(expertise, options = {}) {
  const {
    includeLegend = true,
    includeSummaryList = true,
    withWrapper = true,
    darkBg = true,
    maxWidth = 400,
  } = options;

  const status = (id) => expertise?.parts?.[id] || 'orijinal';

  // Panel render helper — eşit margin'lerle parça çizer + tek harf etiket
  const panel = (id, d, lx, ly, fs = 11) => {
    const s = status(id);
    const fill = fillFor(s);
    const stroke = strokeFor(s);
    const lbl = labelFor(s);
    let html = `<path d="${d}" fill="${fill}" stroke="${stroke}" stroke-width="2" stroke-linejoin="round"/>`;
    if (lbl) {
      html += `<text x="${lx}" y="${ly}" text-anchor="middle" font-size="${fs}" font-weight="900" fill="#ffffff" style="paint-order:stroke;stroke:rgba(0,0,0,0.4);stroke-width:0.8;">${lbl}</text>`;
    }
    return html;
  };

  const bg = darkBg ? '#0a0a0a' : '#ffffff';
  const textPrimary = darkBg ? '#ffffff' : '#1f2937';
  const textSecondary = darkBg ? '#a3a3a3' : '#6b7280';
  const dividerColor = darkBg ? '#262626' : '#e5e7eb';

  // ============================================================
  // ÜST: Arka tampon (3 cam parçası gibi görünür)
  // ============================================================
  const arkaTamponX = 130;
  const arkaTampon = `
    ${panel('arka_tampon',
      `M ${arkaTamponX},10 L ${arkaTamponX+140},10 Q ${arkaTamponX+148},10 ${arkaTamponX+148},18 L ${arkaTamponX+148},38 Q ${arkaTamponX+148},46 ${arkaTamponX+140},46 L ${arkaTamponX},46 Q ${arkaTamponX-8},46 ${arkaTamponX-8},38 L ${arkaTamponX-8},18 Q ${arkaTamponX-8},10 ${arkaTamponX},10 Z`,
      arkaTamponX + 70, 31, 13)}
    <text x="${arkaTamponX + 70}" y="60" text-anchor="middle" font-size="9" font-weight="600" fill="${textSecondary}">A.Tampon</text>
  `;

  // ============================================================
  // GÖVDE: Araç front view (gri/dekoratif — tıklanabilir parça değil)
  // Layout: x=140-260 arası, y=70-440 arası
  // ============================================================
  const bodyX = 140, bodyY = 70, bodyW = 120, bodyH = 380;
  // Tavan, ön cam, arka cam, kaput, bagaj burada PANEL olarak çizilir
  // ama görsel sıralama otomologs gibi: aşağıdan yukarıya = ön cephe
  const bagajRect = panel('bagaj',
    `M ${bodyX+5},${bodyY+5} L ${bodyX+bodyW-5},${bodyY+5} Q ${bodyX+bodyW-2},${bodyY+5} ${bodyX+bodyW-2},${bodyY+9} L ${bodyX+bodyW-2},${bodyY+60} Q ${bodyX+bodyW-2},${bodyY+64} ${bodyX+bodyW-5},${bodyY+64} L ${bodyX+5},${bodyY+64} Q ${bodyX+2},${bodyY+64} ${bodyX+2},${bodyY+60} L ${bodyX+2},${bodyY+9} Q ${bodyX+2},${bodyY+5} ${bodyX+5},${bodyY+5} Z`,
    bodyX + bodyW/2, bodyY + 38, 14);

  // Arka cam (dekoratif)
  const arkaCam = `
    <path d="M ${bodyX+12},${bodyY+72} L ${bodyX+bodyW-12},${bodyY+72} L ${bodyX+bodyW-20},${bodyY+108} L ${bodyX+20},${bodyY+108} Z"
          fill="#3f3f46" opacity="0.85" stroke="#525252" stroke-width="1"/>
  `;

  const tavanRect = panel('tavan',
    `M ${bodyX+22},${bodyY+115} L ${bodyX+bodyW-22},${bodyY+115} L ${bodyX+bodyW-22},${bodyY+260} L ${bodyX+22},${bodyY+260} Z`,
    bodyX + bodyW/2, bodyY + 192, 16);

  // Ön cam (dekoratif)
  const onCam = `
    <path d="M ${bodyX+20},${bodyY+268} L ${bodyX+bodyW-20},${bodyY+268} L ${bodyX+bodyW-12},${bodyY+304} L ${bodyX+12},${bodyY+304} Z"
          fill="#3f3f46" opacity="0.85" stroke="#525252" stroke-width="1"/>
  `;

  const kaputRect = panel('kaput',
    `M ${bodyX+5},${bodyY+312} L ${bodyX+bodyW-5},${bodyY+312} Q ${bodyX+bodyW-2},${bodyY+312} ${bodyX+bodyW-2},${bodyY+316} L ${bodyX+bodyW-2},${bodyY+370} Q ${bodyX+bodyW-2},${bodyY+374} ${bodyX+bodyW-5},${bodyY+374} L ${bodyX+5},${bodyY+374} Q ${bodyX+2},${bodyY+374} ${bodyX+2},${bodyY+370} L ${bodyX+2},${bodyY+316} Q ${bodyX+2},${bodyY+312} ${bodyX+5},${bodyY+312} Z`,
    bodyX + bodyW/2, bodyY + 346, 14);

  // Gövde dış sınırı (yumuşak shadow)
  const bodyOutline = `
    <path d="M ${bodyX-2},${bodyY+8} Q ${bodyX-2},${bodyY+2} ${bodyX+4},${bodyY+2} L ${bodyX+bodyW-4},${bodyY+2} Q ${bodyX+bodyW+2},${bodyY+2} ${bodyX+bodyW+2},${bodyY+8} L ${bodyX+bodyW+2},${bodyY+bodyH-8} Q ${bodyX+bodyW+2},${bodyY+bodyH-2} ${bodyX+bodyW-4},${bodyY+bodyH-2} L ${bodyX+4},${bodyY+bodyH-2} Q ${bodyX-2},${bodyY+bodyH-2} ${bodyX-2},${bodyY+bodyH-8} Z"
          fill="none" stroke="#52525b" stroke-width="1.5"/>
  `;

  // ============================================================
  // SOL YAN PANELLER (kapılar açılmış gibi — gövdeden uzakta)
  // ============================================================
  const leftX = 35;     // sol panel'in başlangıç x'i
  const leftW = 80;     // panel genişliği
  // 4 panel dikey sıralı, üstten alta: sol_arka_camurluk → sol_arka_kapi → sol_on_kapi → sol_on_camurluk
  // y aralıkları: 70-160, 165-250, 255-340, 345-440
  const lp = (id, y, h, label) => {
    const fontSize = 14;
    return `
      ${panel(id, `M ${leftX},${y} L ${leftX+leftW},${y} L ${leftX+leftW},${y+h} L ${leftX},${y+h} Z`, leftX + leftW/2, y + h/2 + 5, fontSize)}
      <text x="${leftX + leftW/2}" y="${y + h - 6}" text-anchor="middle" font-size="7" font-weight="600" fill="${darkBg ? 'rgba(255,255,255,0.6)' : 'rgba(0,0,0,0.55)'}">${label}</text>
    `;
  };

  // Sol arka çamurluk — yamuk, dış kenar yumuşak
  const solArkaCamurluk = `
    ${panel('sol_arka_camurluk',
      `M ${leftX+10},80 L ${leftX+leftW},80 L ${leftX+leftW},155 L ${leftX+5},155 Q ${leftX-2},150 ${leftX+2},140 L ${leftX+10},80 Z`,
      leftX + leftW/2 + 3, 122, 14)}
    <text x="${leftX + leftW/2}" y="170" text-anchor="middle" font-size="7" font-weight="600" fill="${textSecondary}">Sol Arka Çam.</text>
  `;
  const solArkaKapi = `
    ${panel('sol_arka_kapi',
      `M ${leftX+2},178 L ${leftX+leftW},178 L ${leftX+leftW},253 L ${leftX+2},253 Z`,
      leftX + leftW/2 + 1, 220, 14)}
    <text x="${leftX + leftW/2}" y="268" text-anchor="middle" font-size="7" font-weight="600" fill="${textSecondary}">Sol Arka Kapı</text>
  `;
  const solOnKapi = `
    ${panel('sol_on_kapi',
      `M ${leftX+2},276 L ${leftX+leftW},276 L ${leftX+leftW},351 L ${leftX+2},351 Z`,
      leftX + leftW/2 + 1, 318, 14)}
    <text x="${leftX + leftW/2}" y="366" text-anchor="middle" font-size="7" font-weight="600" fill="${textSecondary}">Sol Ön Kapı</text>
  `;
  const solOnCamurluk = `
    ${panel('sol_on_camurluk',
      `M ${leftX+2},374 L ${leftX+leftW},374 L ${leftX+leftW},449 L ${leftX+10},449 Q ${leftX+2},444 ${leftX+5},435 L ${leftX+2},374 Z`,
      leftX + leftW/2 + 1, 416, 14)}
    <text x="${leftX + leftW/2}" y="464" text-anchor="middle" font-size="7" font-weight="600" fill="${textSecondary}">Sol Ön Çam.</text>
  `;

  // ============================================================
  // SAĞ YAN PANELLER (aynı, ayna görüntüsü)
  // ============================================================
  const rightX = 285;
  const rightW = 80;

  const sagArkaCamurluk = `
    ${panel('sag_arka_camurluk',
      `M ${rightX},80 L ${rightX+leftW-10},80 L ${rightX+leftW-2},140 Q ${rightX+leftW+2},150 ${rightX+leftW-5},155 L ${rightX},155 Z`,
      rightX + rightW/2 - 3, 122, 14)}
    <text x="${rightX + rightW/2}" y="170" text-anchor="middle" font-size="7" font-weight="600" fill="${textSecondary}">Sağ Arka Çam.</text>
  `;
  const sagArkaKapi = `
    ${panel('sag_arka_kapi',
      `M ${rightX},178 L ${rightX+rightW-2},178 L ${rightX+rightW-2},253 L ${rightX},253 Z`,
      rightX + rightW/2 - 1, 220, 14)}
    <text x="${rightX + rightW/2}" y="268" text-anchor="middle" font-size="7" font-weight="600" fill="${textSecondary}">Sağ Arka Kapı</text>
  `;
  const sagOnKapi = `
    ${panel('sag_on_kapi',
      `M ${rightX},276 L ${rightX+rightW-2},276 L ${rightX+rightW-2},351 L ${rightX},351 Z`,
      rightX + rightW/2 - 1, 318, 14)}
    <text x="${rightX + rightW/2}" y="366" text-anchor="middle" font-size="7" font-weight="600" fill="${textSecondary}">Sağ Ön Kapı</text>
  `;
  const sagOnCamurluk = `
    ${panel('sag_on_camurluk',
      `M ${rightX},374 L ${rightX+rightW-2},374 L ${rightX+rightW-5},435 Q ${rightX+rightW+2},444 ${rightX+rightW-10},449 L ${rightX},449 Z`,
      rightX + rightW/2 - 1, 416, 14)}
    <text x="${rightX + rightW/2}" y="464" text-anchor="middle" font-size="7" font-weight="600" fill="${textSecondary}">Sağ Ön Çam.</text>
  `;

  // ============================================================
  // 4 TEKERLEK (köşelerde, dekoratif)
  // ============================================================
  const wheel = (cx, cy, r = 22) => `
    <circle cx="${cx}" cy="${cy}" r="${r}" fill="#18181b" stroke="#a1a1aa" stroke-width="3"/>
    <circle cx="${cx}" cy="${cy}" r="${r-7}" fill="#27272a" stroke="#52525b" stroke-width="1.5"/>
    <circle cx="${cx}" cy="${cy}" r="4" fill="#52525b"/>
    ${[0, 60, 120, 180, 240, 300].map(ang => {
      const rad = (ang * Math.PI) / 180;
      const x1 = cx + Math.cos(rad) * 5;
      const y1 = cy + Math.sin(rad) * 5;
      const x2 = cx + Math.cos(rad) * (r - 9);
      const y2 = cy + Math.sin(rad) * (r - 9);
      return `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="#52525b" stroke-width="1.5"/>`;
    }).join('')}
  `;

  const wheels = `
    ${wheel(15, 115, 18)}  
    ${wheel(15, 410, 18)}
    ${wheel(385, 115, 18)}
    ${wheel(385, 410, 18)}
  `;

  // ============================================================
  // ALT: Ön tampon
  // ============================================================
  const onTamponX = 130;
  const onTampon = `
    <text x="${onTamponX + 70}" y="478" text-anchor="middle" font-size="9" font-weight="600" fill="${textSecondary}">Ön Tampon</text>
    ${panel('on_tampon',
      `M ${onTamponX},485 L ${onTamponX+140},485 Q ${onTamponX+148},485 ${onTamponX+148},493 L ${onTamponX+148},513 Q ${onTamponX+148},521 ${onTamponX+140},521 L ${onTamponX},521 Q ${onTamponX-8},521 ${onTamponX-8},513 L ${onTamponX-8},493 Q ${onTamponX-8},485 ${onTamponX},485 Z`,
      onTamponX + 70, 507, 13)}
  `;

  // ============================================================
  // LEGEND
  // ============================================================
  const legendY = 535;
  const legend = includeLegend ? `
    <g transform="translate(60, ${legendY})">
      <g><rect x="0" y="0" width="14" height="14" rx="3" fill="${COLORS.orijinal}" stroke="${BORDERS.orijinal}" stroke-width="1.2"/><text x="20" y="11" font-size="10" font-weight="600" fill="${textPrimary}">Orijinal</text></g>
      <g transform="translate(78,0)"><rect x="0" y="0" width="14" height="14" rx="3" fill="${COLORS.lokal}" stroke="${BORDERS.lokal}" stroke-width="1.2"/><text x="20" y="11" font-size="10" font-weight="600" fill="${textPrimary}">Lokal</text></g>
      <g transform="translate(144,0)"><rect x="0" y="0" width="14" height="14" rx="3" fill="${COLORS.boyali}" stroke="${BORDERS.boyali}" stroke-width="1.2"/><text x="20" y="11" font-size="10" font-weight="600" fill="${textPrimary}">Boyalı</text></g>
      <g transform="translate(214,0)"><rect x="0" y="0" width="14" height="14" rx="3" fill="${COLORS.degisen}" stroke="${BORDERS.degisen}" stroke-width="1.2"/><text x="20" y="11" font-size="10" font-weight="600" fill="${textPrimary}">Değişen</text></g>
    </g>
  ` : '';

  // ============================================================
  // SUMMARY LIST (alt — kategori bazlı hasar listesi)
  // ============================================================
  let summaryHtml = '';
  let summaryHeight = 0;
  if (includeSummaryList) {
    const partIds = ['arka_tampon','bagaj','sol_arka_camurluk','sag_arka_camurluk','sol_arka_kapi','sag_arka_kapi','tavan','sol_on_kapi','sag_on_kapi','sol_on_camurluk','sag_on_camurluk','kaput','on_tampon'];
    const groups = { boyali: [], lokal: [], degisen: [] };
    for (const pid of partIds) {
      const s = status(pid);
      if (s !== 'orijinal' && groups[s]) groups[s].push(TR_NAMES[pid]);
    }
    const order = ['lokal', 'boyali', 'degisen'];
    const titles = { lokal: 'Lokal', boyali: 'Boyalı', degisen: 'Değişen' };

    let yCursor = 575;
    const lines = [];
    for (const key of order) {
      if (groups[key].length === 0) continue;
      // group header
      lines.push(`
        <g transform="translate(20, ${yCursor})">
          <rect x="0" y="0" width="14" height="14" rx="3" fill="${COLORS[key]}" stroke="${BORDERS[key]}" stroke-width="1.2"/>
          <text x="22" y="12" font-size="13" font-weight="700" fill="${COLORS[key]}">${titles[key]}</text>
          <text x="360" y="12" text-anchor="end" font-size="13" font-weight="800" fill="${textPrimary}">${groups[key].length}</text>
        </g>
      `);
      yCursor += 22;
      for (const name of groups[key]) {
        lines.push(`
          <g transform="translate(28, ${yCursor})">
            <rect x="0" y="0" width="356" height="18" rx="3" fill="${darkBg ? '#171717' : '#f9fafb'}" stroke="${dividerColor}" stroke-width="0.8"/>
            <text x="8" y="13" font-size="11" font-weight="500" fill="${textPrimary}">${name}</text>
          </g>
        `);
        yCursor += 20;
      }
      yCursor += 6;
    }
    if (lines.length > 0) {
      summaryHtml = `
        <line x1="20" y1="558" x2="380" y2="558" stroke="${dividerColor}" stroke-width="0.8"/>
        ${lines.join('')}
      `;
      summaryHeight = yCursor - 575 + 10;
    }
  }

  const totalHeight = 555 + (includeLegend ? 20 : 0) + summaryHeight;

  const inner = `
    <rect x="0" y="0" width="400" height="${totalHeight}" fill="${bg}"/>
    ${arkaTampon}
    ${bodyOutline}
    ${bagajRect}
    ${arkaCam}
    ${tavanRect}
    ${onCam}
    ${kaputRect}
    ${solArkaCamurluk}
    ${solArkaKapi}
    ${solOnKapi}
    ${solOnCamurluk}
    ${sagArkaCamurluk}
    ${sagArkaKapi}
    ${sagOnKapi}
    ${sagOnCamurluk}
    ${wheels}
    ${onTampon}
    ${legend}
    ${summaryHtml}
  `;

  if (!withWrapper) return inner;
  return `<svg viewBox="0 0 400 ${totalHeight}" width="${maxWidth}" xmlns="http://www.w3.org/2000/svg" style="max-width:100%;height:auto;display:block;margin:0 auto;">${inner}</svg>`;
}

export default buildSedanDiagramSvg;
