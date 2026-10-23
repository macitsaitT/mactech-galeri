/**
 * Yaklaşan/Geciken vade taksitlerini tespit eder.
 * Algoritma:
 * - Her aktif vadeli satış için: ödenmemiş kalan ay sayısı kadar "beklenen taksit" listele
 * - Her taksit tarihi = start_date + (i ay) — ödenmiş tutar bu taksite mahsup edilir
 * - "yaklaşan" (3 gün içinde) ve "geciken" (vade geçmiş) taksitleri döner
 */
export const computeUpcomingPayments = (installments = [], { daysAhead = 7 } = {}) => {
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const horizon = new Date(now);
  horizon.setDate(horizon.getDate() + daysAhead);

  const result = [];
  installments.forEach(inst => {
    if (inst.deleted || inst.is_settled) return;
    const total = Number(inst.total_amount || 0);
    const down = Number(inst.down_payment_amount || 0);
    const paid = Number(inst.paid_amount || 0);
    const termCount = Number(inst.term_count || 1);
    if (termCount <= 0) return;
    const monthly = (total - down) / termCount;
    if (monthly <= 0) return;

    // Hangi taksitler ödendi (kabaca: ödenen / aylık)
    const paidTerms = Math.floor(paid / monthly + 1e-9);
    const start = inst.start_date ? new Date(inst.start_date) : null;
    if (!start || isNaN(start)) return;

    for (let i = paidTerms; i < termCount; i++) {
      const due = new Date(start);
      due.setMonth(start.getMonth() + i);
      due.setHours(0, 0, 0, 0);
      const isOverdue = due < now;
      const isUpcoming = due >= now && due <= horizon;
      if (isOverdue || isUpcoming) {
        result.push({
          installment_id: inst.id,
          customer_id: inst.customer_id,
          customer_name: inst.customer_name,
          term_index: i + 1,
          due_date: due.toISOString().split('T')[0],
          amount: monthly,
          status: isOverdue ? 'overdue' : 'upcoming',
          days_diff: Math.ceil((due - now) / (1000 * 60 * 60 * 24)), // negatif = gecikme
        });
        // İlk ödenmemişi listeye ekle, döngüyü kır (her vadeli için tek bildirim)
        break;
      }
    }
  });
  // Geciken üstte
  return result.sort((a, b) => a.days_diff - b.days_diff);
};

export const buildPaymentReminderText = (item, customerPhone) => {
  const dateText = new Date(item.due_date).toLocaleDateString('tr-TR');
  const amountText = `₺${item.amount.toLocaleString('tr-TR', { maximumFractionDigits: 0 })}`;
  if (item.status === 'overdue') {
    const days = Math.abs(item.days_diff);
    return `Sayın ${item.customer_name},\n\n${item.term_index}. taksitinizin ödeme tarihi (${dateText}) ${days} gün önce geçmiştir. Tutar: ${amountText}\n\nLütfen en kısa sürede ödemenizi yapınız.`;
  }
  return `Sayın ${item.customer_name},\n\n${item.term_index}. taksit ödemenizin vadesi yaklaşıyor. Tarih: ${dateText} (${item.days_diff} gün sonra)\nTutar: ${amountText}\n\nÖdemenizi vaktinde yapmanız ricasıyla.`;
};
