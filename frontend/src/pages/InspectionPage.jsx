import React, { useState, useEffect } from 'react';
import { Wrench, Calendar, Bell, AlertTriangle, CheckCircle, ExternalLink } from 'lucide-react';
import { carsAPI, invoicesAPI } from '../services/api';
import { useApp } from '../context/AppContext';

const InspectionPage = () => {
  const [inspectionDueCars, setInspectionDueCars] = useState([]);
  const [loading, setLoading] = useState(true);
  const { cars } = useApp();

  useEffect(() => {
    fetchInspectionDueCars();
  }, [cars]);

  const fetchInspectionDueCars = async () => {
    try {
      setLoading(true);
      const res = await carsAPI.getInspectionDue();
      setInspectionDueCars(res.data || []);
    } catch (err) {
      console.error('Failed to fetch inspection due cars:', err);
    } finally {
      setLoading(false);
    }
  };

  const getStatusColor = (daysUntil) => {
    if (daysUntil === 0) return 'bg-destructive/20 border-destructive text-destructive';
    if (daysUntil <= 7) return 'bg-orange-500/20 border-orange-500 text-orange-400';
    if (daysUntil <= 15) return 'bg-yellow-500/20 border-yellow-500 text-yellow-400';
    return 'bg-blue-500/20 border-blue-500 text-blue-400';
  };

  const getStatusIcon = (daysUntil) => {
    if (daysUntil === 0) return <AlertTriangle size={18} className="text-destructive" />;
    if (daysUntil <= 7) return <Bell size={18} className="text-orange-400" />;
    return <Calendar size={18} className="text-blue-400" />;
  };

  const getStatusText = (daysUntil) => {
    if (daysUntil === 0) return 'Bugün';
    if (daysUntil === 1) return '1 gün kaldı';
    return `${daysUntil} gün kaldı`;
  };

  const handleViewInvoice = (carId) => {
    window.open(`${process.env.REACT_APP_BACKEND_URL}/api/invoices/${carId}`, '_blank');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Wrench className="text-primary" size={28} />
            Muayene Takibi
          </h2>
          <p className="text-muted-foreground mt-1">
            Muayene tarihi yaklaşan {inspectionDueCars.length} araç
          </p>
        </div>
      </div>

      {/* Cars List */}
      {inspectionDueCars.length === 0 ? (
        <div className="text-center py-16 bg-card border border-border rounded-xl">
          <CheckCircle size={48} className="mx-auto text-success mb-4" />
          <h3 className="text-xl font-semibold mb-2">Tümü Tamam! 🎉</h3>
          <p className="text-muted-foreground">
            Yakın zamanda muayene tarihi yaklaşan araç bulunmuyor.
          </p>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
          {inspectionDueCars.map((car) => (
            <div
              key={car.id}
              className="bg-card border border-border rounded-xl p-5 hover:shadow-lg transition-shadow"
            >
              {/* Status Badge */}
              <div className={`inline-flex items-center gap-2 px-3 py-1.5 rounded-lg border mb-3 ${getStatusColor(car.days_until_inspection)}`}>
                {getStatusIcon(car.days_until_inspection)}
                <span className="font-semibold text-sm">
                  {getStatusText(car.days_until_inspection)}
                </span>
              </div>

              {/* Car Info */}
              <h3 className="text-lg font-bold mb-1">
                {car.brand} {car.model}
              </h3>
              <p className="text-sm text-muted-foreground mb-3">
                {car.plate?.toUpperCase()} • {car.year}
              </p>

              {/* Inspection Date */}
              <div className="flex items-center gap-2 text-sm mb-3">
                <Calendar size={16} className="text-muted-foreground" />
                <span>
                  Muayene: {new Date(car.inspection_date).toLocaleDateString('tr-TR')}
                </span>
              </div>

              {/* Notification Setting */}
              <div className="flex items-center gap-2 text-xs text-muted-foreground mb-4">
                <Bell size={14} />
                <span>Bildirim: {car.inspection_notification_days} gün önce</span>
              </div>

              {/* Actions */}
              <div className="flex items-center gap-2">
                {car.is_invoiced && (
                  <button
                    onClick={() => handleViewInvoice(car.id)}
                    className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors text-sm font-medium"
                  >
                    <ExternalLink size={14} />
                    Fatura Görüntüle
                  </button>
                )}
                
                {car.km && (
                  <div className="flex-1 text-center px-3 py-2 bg-muted/50 rounded-lg text-sm">
                    <span className="text-muted-foreground">{parseInt(car.km).toLocaleString('tr-TR')} km</span>
                  </div>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default InspectionPage;
