/**
 * Vadeli Satış (Borç Senedi / Ekstre) PDF üretici
 * jsPDF kullanır, Türkçe karakter desteği için font otomatik yüklenir.
 */
import { jsPDF } from 'jspdf';

const formatTRY = (n) => `${(Number(n) || 0).toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })} TL`;

const formatDate = (d) => {
  if (!d) return '-';
  const dt = new Date(d);
  if (isNaN(dt)) return d;
  return dt.toLocaleDateString('tr-TR');
};

export const generateInstallmentPDF = ({ installment, customer, car, company }) => {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const pageW = doc.internal.pageSize.getWidth();
  let y = 20;

  // Helvetica PDF default'tur ama Türkçe karakterler için unicode'a izin verir
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(18);
  doc.text(company?.name || 'MACTech Galeri', pageW / 2, y, { align: 'center' });
  y += 7;

  doc.setFontSize(11);
  doc.setFont('helvetica', 'normal');
  doc.text('VADELİ SATIŞ EKSTRESİ / BORÇ SENEDİ', pageW / 2, y, { align: 'center' });
  y += 10;

  doc.setDrawColor(180);
  doc.line(15, y, pageW - 15, y);
  y += 8;

  // Müşteri ve araç bilgileri
  doc.setFontSize(10);
  doc.setFont('helvetica', 'bold');
  doc.text('MÜŞTERİ', 15, y);
  doc.setFont('helvetica', 'normal');
  doc.text(customer?.name || '-', 50, y);
  y += 5;

  if (customer?.phone) {
    doc.setFont('helvetica', 'bold');
    doc.text('TELEFON', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(customer.phone, 50, y);
    y += 5;
  }
  if (customer?.tc_no) {
    doc.setFont('helvetica', 'bold');
    doc.text('TC NO', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(customer.tc_no, 50, y);
    y += 5;
  }
  if (car) {
    doc.setFont('helvetica', 'bold');
    doc.text('ARAÇ', 15, y);
    doc.setFont('helvetica', 'normal');
    doc.text(`${car.brand || ''} ${car.model || ''} - ${(car.plate || '').toUpperCase()}`, 50, y);
    y += 5;
  }

  y += 4;
  doc.setDrawColor(180);
  doc.line(15, y, pageW - 15, y);
  y += 8;

  // Borç Özeti
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('BORÇ ÖZETİ', 15, y);
  y += 7;

  doc.setFontSize(10);
  const totalAmount = Number(installment.total_amount || 0);
  const downPayment = Number(installment.down_payment || 0);
  const paidAmount = Number(installment.paid_amount || 0);
  const remaining = Number(installment.remaining_amount || 0);

  const rows = [
    ['Sözleşme Tarihi', formatDate(installment.start_date || installment.created_at)],
    ['Toplam Tutar', formatTRY(totalAmount)],
    ['Peşinat', formatTRY(downPayment)],
    ['Vade Sayısı', `${installment.term_count || 1} ay`],
    ['Ödenen', formatTRY(paidAmount)],
    ['Kalan Borç', formatTRY(remaining)],
  ];
  rows.forEach(([k, v]) => {
    doc.setFont('helvetica', 'normal');
    doc.text(k, 15, y);
    doc.setFont('helvetica', 'bold');
    doc.text(v, pageW - 15, y, { align: 'right' });
    y += 6;
  });

  if (installment.description) {
    y += 2;
    doc.setFont('helvetica', 'normal');
    doc.text(`Açıklama: ${installment.description}`, 15, y);
    y += 6;
  }

  // Ödemeler Tablosu
  y += 4;
  doc.setDrawColor(180);
  doc.line(15, y, pageW - 15, y);
  y += 8;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.text('ÖDEMELER', 15, y);
  y += 7;

  doc.setFontSize(9);
  doc.setFillColor(240);
  doc.rect(15, y - 5, pageW - 30, 7, 'F');
  doc.text('#', 18, y);
  doc.text('TARİH', 35, y);
  doc.text('TUTAR', 75, y);
  doc.text('AÇIKLAMA', 110, y);
  y += 6;

  doc.setFont('helvetica', 'normal');
  const payments = installment.payments || [];
  if (payments.length === 0) {
    doc.text('Henüz ödeme kaydı bulunmamaktadır.', 18, y);
    y += 6;
  } else {
    payments.forEach((p, i) => {
      if (y > 270) {
        doc.addPage();
        y = 20;
      }
      doc.text(String(i + 1), 18, y);
      doc.text(formatDate(p.date), 35, y);
      doc.text(formatTRY(p.amount), 75, y);
      const desc = (p.description || '').substring(0, 50);
      doc.text(desc, 110, y);
      y += 6;
    });
  }

  // İmza alanı
  y = Math.max(y + 20, 240);
  doc.setDrawColor(0);
  doc.line(25, y, 80, y);
  doc.line(pageW - 80, y, pageW - 25, y);
  y += 5;
  doc.setFontSize(9);
  doc.text('Müşteri İmza', 35, y);
  doc.text('Galeri Yetkilisi', pageW - 65, y);

  doc.save(`vadeli-satis-${customer?.name?.replace(/\s/g, '_') || 'musteri'}-${installment.id?.slice(0, 8)}.pdf`);
};
