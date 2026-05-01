import React, { useEffect, useState, useMemo } from 'react';
import { FileText, Trash2, RefreshCcw, Car, User, Filter } from 'lucide-react';
import { activityLogsAPI, usersAPI } from '../services/api';
import { formatCurrency, formatDateTime } from '../utils/helpers';
import { toast } from 'sonner';
import { useApp } from '../context/AppContext';

const ACTION_LABELS = {
  create: 'Oluşturma',
  update: 'Güncelleme',
  delete: 'Silme',
  permanent_delete: 'Kalıcı Silme',
  price_change: 'Fiyat Değişimi',
  status_change: 'Durum Değişimi',
  sale: 'Satış',
};

const ACTION_COLORS = {
  create: 'bg-success/15 text-success border-success/30',
  update: 'bg-amber-500/15 text-amber-600 border-amber-500/30',
  delete: 'bg-destructive/15 text-destructive border-destructive/30',
  permanent_delete: 'bg-destructive/25 text-destructive border-destructive/50',
  price_change: 'bg-primary/15 text-primary border-primary/30',
  status_change: 'bg-blue-500/15 text-blue-500 border-blue-500/30',
  sale: 'bg-green-500/15 text-green-600 border-green-500/30',
};

const ENTITY_LABELS = {
  car: 'Araç',
  user: 'Personel',
  transaction: 'İşlem',
  customer: 'Müşteri',
  capital: 'Kasa',
};

const ENTITY_ICONS = {
  car: Car,
  user: User,
};

const renderDetails = (log) => {
  const d = log.details || {};
  if (log.action === 'price_change' && d.field) {
    const fmt = (v) => (v == null ? '-' : formatCurrency(Number(v) || 0));
    return `${d.field_label || d.field}: ${fmt(d.old)} → ${fmt(d.new)}`;
  }
  if (log.action === 'status_change') {
    return `Durum: ${d.old || '-'} → ${d.new || '-'}`;
  }
  if (log.entity_type === 'user' && log.action === 'create') {
    return `${d.email || ''} (${d.role || ''})`;
  }
  if (log.entity_type === 'user' && log.action === 'update') {
    return `Güncellenen: ${(d.fields || []).join(', ')}`;
  }
  if (log.entity_type === 'car' && log.action === 'create') {
    return `${d.brand || ''} ${d.model || ''}`.trim() || '-';
  }
  if (log.entity_type === 'transaction') {
    if (log.action === 'create' || ['delete', 'permanent_delete'].includes(log.action)) {
      const tLabel = d.type === 'income' ? 'Gelir' : d.type === 'expense' ? 'Gider' : (d.type || '');
      const amtText = d.amount != null ? formatCurrency(Number(d.amount) || 0) : '';
      return [tLabel, amtText].filter(Boolean).join(' • ');
    }
    if (log.action === 'update' && d.changes) {
      return Object.entries(d.changes)
        .map(([k, v]) => `${k}: ${v.old ?? '-'} → ${v.new ?? '-'}`)
        .join(' | ');
    }
  }
  return d.description || '';
};

const ActivityLogsPage = () => {
  const { user } = useApp();
  const [logs, setLogs] = useState([]);
  const [loading, setLoading] = useState(false);
  const [employees, setEmployees] = useState([]);
  const [filters, setFilters] = useState({
    entity_type: '',
    action: '',
    user_id: '',
    start_date: '',
    end_date: '',
  });

  const isAdmin = (user?.role || 'admin') === 'admin';

  const loadLogs = async () => {
    setLoading(true);
    try {
      const params = {};
      if (filters.entity_type) params.entity_type = filters.entity_type;
      if (filters.action) params.action = filters.action;
      if (filters.user_id) params.user_id = filters.user_id;
      if (filters.start_date) params.start_date = filters.start_date;
      if (filters.end_date) params.end_date = filters.end_date;
      const res = await activityLogsAPI.list(params);
      setLogs(res.data?.logs || []);
    } catch {
      toast.error('İşlem geçmişi alınamadı');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => { loadLogs(); /* eslint-disable-next-line react-hooks/exhaustive-deps */ }, [filters]);
  useEffect(() => {
    usersAPI.getEmployees().then(r => setEmployees(r.data || [])).catch(() => {});
  }, []);

  const handleClear = async () => {
    if (!window.confirm('Tüm işlem geçmişi kalıcı olarak silinsin mi?')) return;
    try {
      await activityLogsAPI.clear();
      toast.success('İşlem geçmişi temizlendi');
      loadLogs();
    } catch {
      toast.error('Temizlenemedi');
    }
  };

  const actionsInUse = useMemo(() => {
    const set = new Set(logs.map(l => l.action));
    return Array.from(set);
  }, [logs]);

  return (
    <div className="space-y-6" data-testid="activity-logs-page">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-xl sm:text-2xl font-bold flex items-center gap-2">
            <FileText size={22} className="text-primary" />
            İşlem Geçmişi
          </h2>
          <p className="text-sm text-muted-foreground">
            Araç fiyat güncellemeleri, personel işlemleri ve kritik değişiklik kayıtları.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadLogs}
            className="h-10 px-3 bg-muted hover:bg-muted/80 rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
            data-testid="logs-refresh-btn"
          >
            <RefreshCcw size={16} /> Yenile
          </button>
          {isAdmin && logs.length > 0 && (
            <button
              onClick={handleClear}
              className="h-10 px-3 bg-destructive/90 hover:bg-destructive text-destructive-foreground rounded-lg text-sm font-medium flex items-center gap-2 transition-colors"
              data-testid="logs-clear-btn"
            >
              <Trash2 size={16} /> Tümünü Sil
            </button>
          )}
        </div>
      </div>

      {/* Filtreler */}
      <div className="flex flex-wrap items-end gap-3 p-4 bg-card border border-border rounded-xl">
        <div className="flex items-center gap-2 text-muted-foreground">
          <Filter size={16} />
          <span className="text-xs font-semibold uppercase tracking-wider">Filtreler</span>
        </div>
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1">Varlık</label>
          <select
            value={filters.entity_type}
            onChange={(e) => setFilters(f => ({ ...f, entity_type: e.target.value }))}
            className="h-9 px-3 bg-background border border-border rounded-lg text-sm min-w-[140px]"
            data-testid="logs-filter-entity"
          >
            <option value="">Tümü</option>
            <option value="car">Araç</option>
            <option value="user">Personel</option>
            <option value="transaction">İşlem</option>
            <option value="customer">Müşteri</option>
          </select>
        </div>
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1">Eylem</label>
          <select
            value={filters.action}
            onChange={(e) => setFilters(f => ({ ...f, action: e.target.value }))}
            className="h-9 px-3 bg-background border border-border rounded-lg text-sm min-w-[160px]"
            data-testid="logs-filter-action"
          >
            <option value="">Tümü</option>
            {Object.keys(ACTION_LABELS).map(k => (
              <option key={k} value={k}>{ACTION_LABELS[k]}</option>
            ))}
          </select>
        </div>
        {isAdmin && (
          <div>
            <label className="block text-[11px] text-muted-foreground mb-1">Personel</label>
            <select
              value={filters.user_id}
              onChange={(e) => setFilters(f => ({ ...f, user_id: e.target.value }))}
              className="h-9 px-3 bg-background border border-border rounded-lg text-sm min-w-[180px]"
              data-testid="logs-filter-user"
            >
              <option value="">Tüm Kullanıcılar</option>
              {employees.map(e => (
                <option key={e.id} value={e.id}>{e.name}</option>
              ))}
            </select>
          </div>
        )}
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1">Başlangıç</label>
          <input
            type="date"
            value={filters.start_date}
            onChange={(e) => setFilters(f => ({ ...f, start_date: e.target.value }))}
            className="h-9 px-3 bg-background border border-border rounded-lg text-sm"
            data-testid="logs-filter-start"
          />
        </div>
        <div>
          <label className="block text-[11px] text-muted-foreground mb-1">Bitiş</label>
          <input
            type="date"
            value={filters.end_date}
            onChange={(e) => setFilters(f => ({ ...f, end_date: e.target.value }))}
            className="h-9 px-3 bg-background border border-border rounded-lg text-sm"
            data-testid="logs-filter-end"
          />
        </div>
        {(filters.entity_type || filters.action || filters.user_id || filters.start_date || filters.end_date) && (
          <button
            onClick={() => setFilters({ entity_type: '', action: '', user_id: '', start_date: '', end_date: '' })}
            className="h-9 px-3 text-xs font-medium text-muted-foreground hover:text-foreground underline"
            data-testid="logs-filter-clear"
          >
            Filtreleri Temizle
          </button>
        )}
        <div className="ml-auto text-xs text-muted-foreground">
          <strong>{logs.length}</strong> kayıt
          {actionsInUse.length > 0 && ` • ${actionsInUse.length} farklı eylem`}
        </div>
      </div>

      {/* Tablo */}
      <div className="bg-card border border-border rounded-xl overflow-hidden">
        {loading ? (
          <div className="p-12 text-center text-muted-foreground">Yükleniyor…</div>
        ) : logs.length === 0 ? (
          <div className="p-12 text-center text-muted-foreground">
            Seçili filtrelere uygun kayıt yok.
          </div>
        ) : (
          <>
            {/* Mobile cards */}
            <div className="sm:hidden divide-y divide-border">
              {logs.map(log => {
                const EIcon = ENTITY_ICONS[log.entity_type] || FileText;
                return (
                  <div key={log.id} className="p-3" data-testid={`log-row-${log.id}`}>
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className={`text-[10px] px-2 py-0.5 rounded border ${ACTION_COLORS[log.action] || 'bg-muted'}`}>
                        {ACTION_LABELS[log.action] || log.action}
                      </span>
                      <span className="text-[10px] text-muted-foreground shrink-0">
                        {formatDateTime(log.created_at)}
                      </span>
                    </div>
                    <div className="text-sm font-medium flex items-center gap-1.5">
                      <EIcon size={14} className="text-muted-foreground" />
                      {ENTITY_LABELS[log.entity_type] || log.entity_type} • {log.entity_label || '-'}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {renderDetails(log)}
                    </div>
                    <div className="text-[11px] text-muted-foreground mt-1">
                      👤 {log.user_name || '-'}
                    </div>
                  </div>
                );
              })}
            </div>
            {/* Desktop table */}
            <div className="hidden sm:block overflow-x-auto">
              <table className="w-full border-collapse min-w-[800px]" data-testid="logs-table">
                <thead>
                  <tr className="border-b border-border bg-muted/30">
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Tarih</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Eylem</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Varlık</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Detay</th>
                    <th className="text-left p-3 text-xs font-semibold text-muted-foreground uppercase">Kullanıcı</th>
                  </tr>
                </thead>
                <tbody>
                  {logs.map(log => {
                    const EIcon = ENTITY_ICONS[log.entity_type] || FileText;
                    return (
                      <tr key={log.id} className="border-b border-border hover:bg-muted/20" data-testid={`log-row-${log.id}`}>
                        <td className="p-3 text-sm whitespace-nowrap tabular-nums text-muted-foreground">
                          {formatDateTime(log.created_at)}
                        </td>
                        <td className="p-3">
                          <span className={`text-[11px] px-2 py-1 rounded border font-medium ${ACTION_COLORS[log.action] || 'bg-muted'}`}>
                            {ACTION_LABELS[log.action] || log.action}
                          </span>
                        </td>
                        <td className="p-3 text-sm">
                          <div className="flex items-center gap-1.5">
                            <EIcon size={14} className="text-muted-foreground" />
                            <span className="text-muted-foreground">{ENTITY_LABELS[log.entity_type] || log.entity_type}</span>
                            <span className="font-semibold">{log.entity_label || '-'}</span>
                          </div>
                        </td>
                        <td className="p-3 text-sm text-muted-foreground max-w-md truncate" title={renderDetails(log)}>
                          {renderDetails(log)}
                        </td>
                        <td className="p-3 text-sm">
                          {log.user_name || '-'}
                          {log.user_role && (
                            <span className="ml-1 text-[10px] text-muted-foreground">({log.user_role})</span>
                          )}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default ActivityLogsPage;
