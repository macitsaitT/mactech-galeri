// ✅ Yazdırılabilir rapor HTML üreteci — ReportModal.jsx'ten ayrıldı (refactor)
// Pure function: state-less, side-effect-less. Test edilebilir.

export const buildPrintHTML = ({
  title,
  dateRange,
  companyName,
  phone,
  logoDataUrl,
  totals,
  profitMargin,
  displayTransactions,
  formatCurrency,
  formatDate,
  reportType,
  carSoldByMap,
}) => {
  const isSold = reportType === 'sold';
  const colSpan = isSold ? 6 : 5;
  const txRows = displayTransactions.length === 0
    ? `<tr><td colspan="${colSpan}" style="text-align:center;padding:24px;color:#999;">Bu tarih aralığında işlem bulunamadı.</td></tr>`
    : displayTransactions.map(tx => `
      <tr>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;">${formatDate(tx.date)}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:${tx.type === 'income' ? '#16a34a' : '#dc2626'}">${tx.type === 'income' ? 'Gelir' : 'Gider'}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;">${tx.category}</td>
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;color:#666;">${tx.description || '-'}</td>
        ${isSold ? `<td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;">${(carSoldByMap && carSoldByMap[tx.car_id]) || '-'}</td>` : ''}
        <td style="padding:8px 10px;border-bottom:1px solid #eee;font-size:13px;text-align:right;font-weight:600;color:${tx.type === 'income' ? '#16a34a' : '#dc2626'}">${tx.type === 'income' ? '+' : '-'}${formatCurrency(tx.amount)}</td>
      </tr>
    `).join('');

  const watermarkCSS = logoDataUrl ? `
    .watermark {
      position: fixed;
      top: 50%;
      left: 50%;
      transform: translate(-50%, -50%);
      opacity: 0.06;
      z-index: 0;
      pointer-events: none;
    }
    .watermark img {
      width: 400px;
      height: auto;
    }
  ` : '';

  const watermarkHTML = logoDataUrl
    ? `<div class="watermark"><img src="${logoDataUrl}" /></div>`
    : '';

  return `<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <title>${title} - ${companyName}</title>
  <style>
    @page { margin: 20mm 15mm 20mm 15mm; }
    * { box-sizing: border-box; }
    body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; color: #222; position: relative; }
    ${watermarkCSS}
    .content { position: relative; z-index: 1; padding: 0; }
    .page-header { text-align: center; font-size: 11px; color: #666; padding-bottom: 12px; border-bottom: 2px solid #222; margin-bottom: 20px; display: flex; justify-content: space-between; align-items: center; }
    .company-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 24px; }
    .company-right { display: flex; align-items: center; text-align: right; }
    .company-right h2 { margin: 0; font-size: 22px; font-weight: 800; letter-spacing: 0.5px; }
    .company-right p { margin: 2px 0 0; font-size: 12px; color: #555; }
    .report-title { margin: 0; font-size: 18px; font-weight: 700; }
    .report-date { margin: 4px 0 0; font-size: 12px; color: #16a34a; }
    .stats-row { display: flex; gap: 16px; margin-bottom: 28px; }
    .stat-card { flex: 1; border: 1.5px solid #ddd; border-radius: 8px; padding: 16px; text-align: center; }
    .stat-card .label { font-size: 10px; text-transform: uppercase; letter-spacing: 1px; color: #888; margin-bottom: 6px; }
    .stat-card .value { font-size: 22px; font-weight: 700; }
    .stat-card .value.green { color: #16a34a; }
    .stat-card .value.red { color: #dc2626; }
    .stat-card .pct { font-size: 12px; color: #16a34a; }
    table { width: 100%; border-collapse: collapse; margin-bottom: 20px; }
    th { text-align: left; padding: 10px; font-size: 12px; font-weight: 600; color: #555; border-bottom: 2px solid #333; }
    th:last-child { text-align: right; }
    .summary-block { display: flex; justify-content: flex-end; margin-bottom: 40px; }
    .summary-table { width: 260px; }
    .summary-table .row { display: flex; justify-content: space-between; padding: 6px 0; border-bottom: 1px solid #eee; font-size: 13px; }
    .summary-table .row.total { border-bottom: none; font-weight: 700; font-size: 14px; padding-top: 10px; }
    .signatures { display: flex; justify-content: space-between; padding-top: 40px; border-top: 1px solid #ddd; margin-top: 40px; }
    .sig-block { text-align: center; }
    .sig-block .title { font-weight: 600; font-size: 13px; margin-bottom: 50px; }
    .sig-line { width: 180px; border-top: 1.5px solid #222; padding-top: 8px; }
    .sig-line p { font-size: 11px; color: #888; margin: 0; }
    .section-title { font-size: 15px; font-weight: 700; margin-bottom: 10px; padding-bottom: 6px; border-bottom: 1.5px solid #eee; }
  </style>
</head>
<body>
  ${watermarkHTML}
  <div class="content">
    <div class="page-header">
      <span>${new Date().toLocaleDateString('tr-TR')} ${new Date().toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</span>
      <span style="font-weight:600;">${title} - ${companyName}</span>
      <span></span>
    </div>

    <div class="company-header">
      <div>
        <h3 class="report-title">${title}</h3>
        <p class="report-date">${dateRange}</p>
      </div>
      <div class="company-right">
        ${logoDataUrl
          ? `<img src="${logoDataUrl}" style="height:56px;width:auto;object-fit:contain;" />`
          : `<div><h2>${companyName}</h2><p>${phone}</p></div>`
        }
      </div>
    </div>

    <div class="stats-row">
      <div class="stat-card">
        <div class="label">Toplam Gelir</div>
        <div class="value green">${formatCurrency(totals.income)}</div>
      </div>
      <div class="stat-card">
        <div class="label">Toplam Gider</div>
        <div class="value red">${formatCurrency(totals.expense)}</div>
      </div>
      <div class="stat-card">
        <div class="label">Net K&acirc;r</div>
        <div class="value">${formatCurrency(totals.net)}</div>
        <div class="pct">%${profitMargin}</div>
      </div>
    </div>

    <div class="section-title">İşlem Dökümü</div>
    <table>
      <thead>
        <tr>
          <th>Tarih</th>
          <th>Tür</th>
          <th>Kategori</th>
          <th>Açıklama</th>
          ${isSold ? '<th>Satış Elemanı</th>' : ''}
          <th style="text-align:right">Tutar</th>
        </tr>
      </thead>
      <tbody>
        ${txRows}
      </tbody>
    </table>

    <div class="summary-block">
      <div class="summary-table">
        <div class="row"><span>Toplam Gelir:</span><span style="color:#16a34a;font-weight:600;">${formatCurrency(totals.income)}</span></div>
        <div class="row"><span>Toplam Gider:</span><span style="color:#dc2626;font-weight:600;">-${formatCurrency(totals.expense)}</span></div>
        <div class="row total"><span>NET SONUÇ:</span><span>${formatCurrency(totals.net)} (%${profitMargin})</span></div>
      </div>
    </div>

    <div class="signatures">
      <div class="sig-block">
        <div class="title">Muhasebe / Onay</div>
        <div class="sig-line"><p>İmza / Kaşe</p></div>
      </div>
      <div class="sig-block">
        <div class="title">${companyName} Yetkilisi</div>
        <div class="sig-line"><p>İmza</p></div>
      </div>
    </div>
  </div>
</body>
</html>`;
};
