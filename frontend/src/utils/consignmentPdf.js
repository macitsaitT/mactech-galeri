/**
 * Konsinye (Emanet) Araç Sözleşmesi PDF üretici
 * jsPDF helvetica ile sade, profesyonel sözleşme.
 */
import { jsPDF } from 'jspdf';

const formatTRY = (n) => `${(Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;
const formatDate = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  return isNaN(dt) ? String(d) : dt.toLocaleDateString('tr-TR');
};

export const generateConsignmentPDF = ({ car, owner, gallery, commission = 0, agreedPrice, notes }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // Başlık
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(16);
  doc.text(gallery?.name || 'MACTech Galeri', pageW / 2, y, { align: 'center' });
  y += 6;
  doc.setFontSize(12);
  doc.text('KONSİNYE (EMANET) ARAÇ SÖZLEŞMESİ', pageW / 2, y, { align: 'center' });
  y += 10;

  doc.setDrawColor(120);
  doc.line(15, y, pageW - 15, y);
  y += 8;

  // Sözleşme metni
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(10);
  const intro =
    'Aşağıda kimlik bilgileri yer alan ARAÇ SAHİBİ, mülkiyeti kendisine ait olan ve detayları belirtilen aracını, ' +
    'satışının yapılması amacıyla GALERİ\'ye konsinye olarak teslim etmiştir. Taraflar aşağıdaki şartlar üzerinde mutabık kalmıştır.';
  const lines = doc.splitTextToSize(intro, pageW - 30);
  doc.text(lines, 15, y);
  y += lines.length * 5 + 3;

  // Bölüm 1: Taraflar
  const section = (title) => {
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.text(title, 15, y);
    y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
  };

  const row = (k, v) => {
    doc.setFont('helvetica', 'bold');
    doc.text(k, 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(String(v || '-'), 65, y);
    y += 5.5;
  };

  section('1. ARAÇ SAHİBİ');
  row('Ad Soyad', owner?.name);
  if (owner?.tc_no) row('TC Kimlik No', owner.tc_no);
  if (owner?.phone) row('Telefon', owner.phone);
  if (owner?.address) row('Adres', owner.address);
  y += 2;

  section('2. GALERİ');
  row('Unvan', gallery?.name || 'MACTech Galeri');
  if (gallery?.phone) row('Telefon', gallery.phone);
  if (gallery?.address) row('Adres', gallery.address);
  y += 2;

  section('3. ARAÇ BİLGİLERİ');
  row('Marka / Model', `${car.brand || ''} ${car.model || ''} ${car.year || ''}`.trim());
  if (car.plate) row('Plaka', (car.plate || '').toUpperCase());
  if (car.chassis_no) row('Şasi No', car.chassis_no);
  if (car.engine_no) row('Motor No', car.engine_no);
  if (car.km !== undefined && car.km !== null) row('Kilometre', `${Number(car.km).toLocaleString('tr-TR')} km`);
  if (car.color) row('Renk', car.color);
  if (car.fuel_type) row('Yakıt', car.fuel_type);
  if (car.gear) row('Vites', car.gear);
  y += 2;

  section('4. SATIŞ ŞARTLARI');
  if (agreedPrice) row('Anlaşılan Satış Fiyatı', formatTRY(agreedPrice));
  if (commission) row('Galeri Komisyonu', `${commission}%`);
  row('Sözleşme Tarihi', formatDate(new Date()));
  y += 4;

  // Hükümler
  if (y > 220) { doc.addPage(); y = 20; }
  section('5. HÜKÜMLER');
  const terms = [
    '1) Araç sahibi, aracın mülkiyetinin kendisine ait olduğunu ve üzerinde herhangi bir hukuki ihtilaf bulunmadığını beyan eder.',
    '2) Galeri, aracı satılana kadar gerekli özeni göstererek korumayı taahhüt eder. Doğal aşınma dışı zararlardan galeri sorumludur.',
    '3) Araç satışı gerçekleştiğinde, galeri komisyonu düşüldükten sonra kalan tutar araç sahibine en geç 3 iş günü içinde ödenir.',
    '4) Araç sahibi dilediği zaman, en az 24 saat önceden bildirmek koşulu ile aracı geri alabilir.',
    '5) Galeri, araç sahibinin onayı olmaksızın anlaşılan fiyatın altında satış yapamaz.',
    '6) Ekspertiz raporu ek olarak sözleşmeye iliştirilmiştir ve taraflar tarafından kabul edilmiştir.',
  ];
  terms.forEach(t => {
    if (y > 270) { doc.addPage(); y = 20; }
    const tl = doc.splitTextToSize(t, pageW - 30);
    doc.text(tl, 15, y);
    y += tl.length * 5 + 1.5;
  });

  if (notes) {
    y += 3;
    if (y > 250) { doc.addPage(); y = 20; }
    section('6. EK NOTLAR');
    const nl = doc.splitTextToSize(notes, pageW - 30);
    doc.text(nl, 15, y);
    y += nl.length * 5;
  }

  // İmza alanı
  if (y > 240) { doc.addPage(); y = 220; }
  y = Math.max(y + 18, 245);
  doc.setDrawColor(0);
  doc.line(25, y, 80, y);
  doc.line(pageW - 80, y, pageW - 25, y);
  y += 5;
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(10);
  doc.text('ARAÇ SAHİBİ', 35, y);
  doc.text('GALERİ YETKİLİSİ', pageW - 70, y);
  y += 4;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(8);
  doc.text(owner?.name || '', 35, y);
  doc.text(gallery?.name || 'MACTech Galeri', pageW - 70, y);

  doc.save(`konsinye-${(car.plate || car.id || 'arac').toString().replace(/\s+/g, '_')}.pdf`);
};
