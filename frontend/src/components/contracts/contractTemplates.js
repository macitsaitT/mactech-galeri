// ✅ Sözleşme HTML şablonları — A4 print-ready (yazdırılabilir / PDF olarak kaydedilebilir)
// Tüm değerler tek bir context objesinden gelir; imzalar data URL olarak inline gömülür.

const baseStyles = `
@page { size: A4; margin: 18mm 16mm; }
* { box-sizing: border-box; }
body { font-family: 'Segoe UI', Arial, sans-serif; margin: 0; padding: 0; color: #1a1a1a; font-size: 12.5px; line-height: 1.55; }
.header { display: flex; justify-content: space-between; align-items: flex-start; padding-bottom: 14px; border-bottom: 2px solid #1a1a1a; margin-bottom: 18px; }
.header-left h1 { margin: 0; font-size: 20px; font-weight: 800; letter-spacing: 0.3px; }
.header-left .sub { margin: 4px 0 0; font-size: 12px; color: #555; }
.header-right { text-align: right; font-size: 11px; color: #444; }
.header-right .company { font-size: 14px; font-weight: 700; color: #1a1a1a; }
.section { margin: 14px 0; }
.section-title { font-size: 13px; font-weight: 700; padding: 6px 8px; background: #f1efe7; border-left: 4px solid #b59030; margin-bottom: 8px; }
.kv-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 6px 16px; }
.kv { display: flex; justify-content: space-between; padding: 4px 0; border-bottom: 1px dotted #d6d3c4; font-size: 12px; }
.kv .k { color: #6c6a5e; }
.kv .v { font-weight: 600; }
.full { grid-column: 1 / -1; }
.terms ol { margin: 0; padding-left: 20px; }
.terms li { margin-bottom: 6px; text-align: justify; }
.amount-box { display: flex; justify-content: space-between; align-items: center; padding: 10px 14px; border: 1.5px solid #1a1a1a; border-radius: 6px; margin: 10px 0; }
.amount-box .label { font-weight: 700; font-size: 13px; }
.amount-box .value { font-size: 20px; font-weight: 800; color: #b59030; }
.signatures { display: grid; grid-template-columns: 1fr 1fr; gap: 28px; margin-top: 32px; page-break-inside: avoid; }
.sig-block { text-align: center; }
.sig-block .role { font-size: 11px; font-weight: 700; color: #6c6a5e; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
.sig-block .name { font-size: 13px; font-weight: 700; margin-top: 4px; }
.sig-block .ident { font-size: 11px; color: #555; margin-top: 2px; }
.sig-img { display: block; max-width: 220px; max-height: 90px; margin: 0 auto; }
.sig-line { border-top: 1.5px solid #1a1a1a; padding-top: 6px; margin-top: 70px; }
.footer { margin-top: 28px; padding-top: 10px; border-top: 1px solid #ccc; font-size: 10px; color: #888; text-align: center; }
`;

const fmtTL = (n) => `${Number(n || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
const fmtDate = (d) => {
  if (!d) return new Date().toLocaleDateString('tr-TR');
  try { return new Date(d).toLocaleDateString('tr-TR'); } catch { return d; }
};
const esc = (s) => String(s == null ? '' : s)
  .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

const renderHeader = ({ title, sub, company, phone, contractNo, date }) => `
  <div class="header">
    <div class="header-left">
      <h1>${esc(title)}</h1>
      <p class="sub">${esc(sub)} — Tarih: ${esc(fmtDate(date))} · No: ${esc(contractNo)}</p>
    </div>
    <div class="header-right">
      <div class="company">${esc(company || 'MACTech Galeri')}</div>
      <div>${esc(phone || '')}</div>
    </div>
  </div>
`;

const renderCarSection = (car) => `
  <div class="section">
    <div class="section-title">ARAÇ BİLGİLERİ</div>
    <div class="kv-grid">
      <div class="kv"><span class="k">Plaka</span><span class="v">${esc((car.plate || '').toUpperCase())}</span></div>
      <div class="kv"><span class="k">Marka / Model</span><span class="v">${esc(car.brand || '')} ${esc(car.model || '')}</span></div>
      <div class="kv"><span class="k">Model Yılı</span><span class="v">${esc(car.year || '')}</span></div>
      <div class="kv"><span class="k">Renk</span><span class="v">${esc(car.color || '-')}</span></div>
      <div class="kv"><span class="k">KM</span><span class="v">${Number(car.km || 0).toLocaleString('tr-TR')}</span></div>
      <div class="kv"><span class="k">Yakıt / Vites</span><span class="v">${esc(car.fuel_type || '-')} / ${esc(car.gear || '-')}</span></div>
      <div class="kv"><span class="k">Motor No</span><span class="v">${esc(car.motor_no || '-')}</span></div>
      <div class="kv"><span class="k">Şasi No</span><span class="v">${esc(car.sasi_no || '-')}</span></div>
    </div>
  </div>
`;

const renderPartiesSection = ({ seller, buyer }) => `
  <div class="section">
    <div class="section-title">TARAFLAR</div>
    <div class="kv-grid">
      <div class="kv"><span class="k">Satıcı</span><span class="v">${esc(seller.name || '')}</span></div>
      <div class="kv"><span class="k">Alıcı</span><span class="v">${esc(buyer.name || '')}</span></div>
      <div class="kv"><span class="k">Satıcı Tel</span><span class="v">${esc(seller.phone || '-')}</span></div>
      <div class="kv"><span class="k">Alıcı Tel</span><span class="v">${esc(buyer.phone || '-')}</span></div>
      ${buyer.tc ? `<div class="kv full"><span class="k">Alıcı TC</span><span class="v">${esc(buyer.tc)}</span></div>` : ''}
    </div>
  </div>
`;

const renderSignatures = ({ sellerName, buyerName, sellerSig, buyerSig }) => `
  <div class="signatures">
    <div class="sig-block">
      <div class="role">SATICI</div>
      ${sellerSig ? `<img class="sig-img" src="${sellerSig}" alt="satıcı imza"/>` : '<div style="height:70px"></div>'}
      <div class="sig-line">
        <div class="name">${esc(sellerName || '-')}</div>
        <div class="ident">İmza / Tarih</div>
      </div>
    </div>
    <div class="sig-block">
      <div class="role">ALICI</div>
      ${buyerSig ? `<img class="sig-img" src="${buyerSig}" alt="alıcı imza"/>` : '<div style="height:70px"></div>'}
      <div class="sig-line">
        <div class="name">${esc(buyerName || '-')}</div>
        <div class="ident">İmza / Tarih</div>
      </div>
    </div>
  </div>
`;

const renderFooter = () => `
  <div class="footer">
    Bu sözleşme MACTech Oto Galeri Yönetim Sistemi tarafından otomatik oluşturulmuştur.
  </div>
`;

const buildHtml = ({ title, body, ctx }) => `<!DOCTYPE html>
<html lang="tr"><head><meta charset="utf-8"/><title>${esc(title)} - ${esc(ctx.contractNo)}</title>
<style>${baseStyles}</style></head>
<body>${body}<script>setTimeout(()=>window.print(),300);</script></body></html>`;

// ✅ Kapora Sözleşmesi
export const buildKaporaContract = (ctx) => {
  const body = `
    ${renderHeader({ title: 'KAPORA SÖZLEŞMESİ', sub: 'Araç Rezervasyon Bedeli', company: ctx.company, phone: ctx.phone, contractNo: ctx.contractNo, date: ctx.date })}
    ${renderCarSection(ctx.car)}
    ${renderPartiesSection({ seller: ctx.seller, buyer: ctx.buyer })}
    <div class="section">
      <div class="section-title">KAPORA BİLGİLERİ</div>
      <div class="amount-box"><span class="label">Kapora Tutarı</span><span class="value">${fmtTL(ctx.deposit_amount)}</span></div>
      <div class="kv"><span class="k">Mutabık Satış Bedeli</span><span class="v">${fmtTL(ctx.sale_price)}</span></div>
      <div class="kv"><span class="k">Bakiye</span><span class="v">${fmtTL(Math.max(0, Number(ctx.sale_price || 0) - Number(ctx.deposit_amount || 0)))}</span></div>
      <div class="kv"><span class="k">Son Ödeme Tarihi</span><span class="v">${esc(fmtDate(ctx.due_date))}</span></div>
    </div>
    <div class="section terms">
      <div class="section-title">ŞARTLAR</div>
      <ol>
        <li>Alıcı, yukarıda belirtilen aracı, kaparo bedeli karşılığında ${esc(fmtDate(ctx.due_date))} tarihine kadar satın alma taahhüdünde bulunur.</li>
        <li>Belirlenen tarihe kadar bakiyenin ödenmemesi durumunda kapora satıcı tarafından iade edilmez.</li>
        <li>Satıcı, aracı belirtilen süre boyunca üçüncü kişilere satmamayı, kapora bedeli karşılığında rezerve etmeyi kabul eder.</li>
        <li>Satıcının taahhüdünü yerine getirmemesi halinde, kapora bedeli alıcıya iki katı olarak iade edilir.</li>
        <li>Aracın tüm hasar/ekspertiz durumu alıcıya bildirilmiş ve alıcı tarafından kabul edilmiştir.</li>
      </ol>
    </div>
    ${renderSignatures({ sellerName: ctx.seller.name, buyerName: ctx.buyer.name, sellerSig: ctx.sellerSig, buyerSig: ctx.buyerSig })}
    ${renderFooter()}
  `;
  return buildHtml({ title: 'Kapora Sözleşmesi', body, ctx });
};

// ✅ Araç Teslim Tutanağı
export const buildDeliveryContract = (ctx) => {
  const body = `
    ${renderHeader({ title: 'ARAÇ TESLİM TUTANAĞI', sub: 'Aracın fiziki teslim/iade kaydı', company: ctx.company, phone: ctx.phone, contractNo: ctx.contractNo, date: ctx.date })}
    ${renderCarSection(ctx.car)}
    ${renderPartiesSection({ seller: ctx.seller, buyer: ctx.buyer })}
    <div class="section">
      <div class="section-title">TESLİM SIRASINDA DURUM</div>
      <div class="kv-grid">
        <div class="kv"><span class="k">Yakıt Seviyesi</span><span class="v">${esc(ctx.fuel_level || 'Belirtilmedi')}</span></div>
        <div class="kv"><span class="k">KM</span><span class="v">${Number(ctx.delivery_km || ctx.car.km || 0).toLocaleString('tr-TR')}</span></div>
        <div class="kv full"><span class="k">Genel Durum / Notlar</span><span class="v">${esc(ctx.notes || 'Sorunsuz teslim alındı')}</span></div>
        <div class="kv full"><span class="k">Eklenen Aksesuar / Belge</span><span class="v">${esc(ctx.accessories || 'Ruhsat, anahtar (2 adet), kullanma kılavuzu')}</span></div>
      </div>
    </div>
    <div class="section terms">
      <div class="section-title">BEYAN</div>
      <ol>
        <li>Yukarıdaki bilgiler doğrultusunda araç, alıcı tarafından eksiksiz teslim alınmıştır.</li>
        <li>Alıcı, aracı fiziki olarak incelemiş, beyan edilen tüm durumları kabul ederek imza atmıştır.</li>
        <li>Bu tutanak, teslim sonrası ileri sürülebilecek itirazlar bakımından delil niteliğindedir.</li>
      </ol>
    </div>
    ${renderSignatures({ sellerName: ctx.seller.name, buyerName: ctx.buyer.name, sellerSig: ctx.sellerSig, buyerSig: ctx.buyerSig })}
    ${renderFooter()}
  `;
  return buildHtml({ title: 'Araç Teslim Tutanağı', body, ctx });
};

// ✅ Satış Sözleşmesi
export const buildSaleContract = (ctx) => {
  const body = `
    ${renderHeader({ title: 'ARAÇ SATIŞ SÖZLEŞMESİ', sub: 'Taraflar arasında satış akdi', company: ctx.company, phone: ctx.phone, contractNo: ctx.contractNo, date: ctx.date })}
    ${renderCarSection(ctx.car)}
    ${renderPartiesSection({ seller: ctx.seller, buyer: ctx.buyer })}
    <div class="section">
      <div class="section-title">SATIŞ BİLGİLERİ</div>
      <div class="amount-box"><span class="label">Toplam Satış Bedeli</span><span class="value">${fmtTL(ctx.sale_price)}</span></div>
      <div class="kv-grid">
        <div class="kv"><span class="k">Ödeme Şekli</span><span class="v">${esc(ctx.payment_method || 'Nakit')}</span></div>
        <div class="kv"><span class="k">Önceden Yapılan Kapora</span><span class="v">${fmtTL(ctx.deposit_amount || 0)}</span></div>
        <div class="kv"><span class="k">Kalan Bakiye</span><span class="v">${fmtTL(Math.max(0, Number(ctx.sale_price || 0) - Number(ctx.deposit_amount || 0)))}</span></div>
        <div class="kv"><span class="k">Teslim Tarihi</span><span class="v">${esc(fmtDate(ctx.delivery_date || ctx.date))}</span></div>
      </div>
    </div>
    <div class="section terms">
      <div class="section-title">SÖZLEŞME ŞARTLARI</div>
      <ol>
        <li>Satıcı, yukarıda kimliği ve özellikleri belirtilen aracı, alıcıya satış bedeli karşılığında devretmeyi kabul eder.</li>
        <li>Alıcı, aracı tüm fiziki ve teknik durumuyla inceleyip kabul ederek satın aldığını beyan eder.</li>
        <li>Bu sözleşme tarihi itibariyle araca ait tüm haklar (kullanım, sahiplik, sorumluluk) alıcıya geçer.</li>
        <li>Trafik tescil işlemleri (noter satış vb.) tarafların mutabakatı ile en geç 7 (yedi) iş günü içinde tamamlanır.</li>
        <li>Satıcı, aracın geçmişine ilişkin (rehin, haciz, çalıntı vb.) hiçbir hukuki engel bulunmadığını taahhüt eder.</li>
        <li>Taraflar arasında çıkacak anlaşmazlıklarda satıcının bulunduğu il mahkemeleri ve icra daireleri yetkilidir.</li>
      </ol>
    </div>
    ${renderSignatures({ sellerName: ctx.seller.name, buyerName: ctx.buyer.name, sellerSig: ctx.sellerSig, buyerSig: ctx.buyerSig })}
    ${renderFooter()}
  `;
  return buildHtml({ title: 'Araç Satış Sözleşmesi', body, ctx });
};
