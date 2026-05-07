import React, { useState } from 'react';
import { Upload, FileText, Camera, Trash2 } from 'lucide-react';
import { fileAPI } from '../../../services/api';

const DocumentCategory = ({ doc, docs, formData, handleChange }) => {
  const [uploading, setUploading] = useState(false);

  const handleDocUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      const newDocs = [...docs];
      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // 50MB limit
        if (file.size > 50 * 1024 * 1024) {
          alert(`${file.name} çok büyük (max 50MB)`);
          continue;
        }

        try {
          const res = await fileAPI.smartUpload(file);
          newDocs.push({
            path: res.data.path,
            name: file.name,
            uploadedAt: new Date().toISOString()
          });
        } catch (err) {
          console.error('Upload failed:', err);
          alert(`"${file.name}" yüklenemedi.`);
        }
      }
      handleChange('documents', {
        ...formData.documents,
        [doc.id]: newDocs
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDocDelete = (index) => {
    const newDocs = docs.filter((_, i) => i !== index);
    handleChange('documents', {
      ...formData.documents,
      [doc.id]: newDocs
    });
  };

  return (
    <div className="p-4 bg-muted/30 border border-border rounded-xl">
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-2xl">{doc.icon}</span>
          <h5 className="font-semibold text-sm">{doc.label}</h5>
          {docs.length > 0 && (
            <span className="text-xs bg-primary/20 text-primary px-2 py-0.5 rounded-full">
              {docs.length} dosya
            </span>
          )}
        </div>
        <label className="cursor-pointer px-3 py-1.5 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg text-xs font-medium transition-colors flex items-center gap-1.5">
          <Upload size={14} />
          {uploading ? 'Yükleniyor...' : 'Yükle'}
          <input
            type="file"
            multiple
            accept="image/*,.pdf"
            className="hidden"
            onChange={(e) => handleDocUpload(e.target.files)}
            disabled={uploading}
          />
        </label>
      </div>

      {docs.length > 0 && (
        <div className="space-y-2">
          {docs.map((docFile, index) => (
            <div
              key={index}
              className="flex items-center justify-between p-2 bg-background/50 rounded-lg border border-border/50 group hover:border-primary/30 transition-colors"
            >
              <div className="flex items-center gap-2 flex-1 min-w-0">
                <FileText size={16} className="text-muted-foreground flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-xs font-medium truncate">{docFile.name}</p>
                  <p className="text-[10px] text-muted-foreground">
                    {new Date(docFile.uploadedAt).toLocaleDateString('tr-TR')}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-1">
                <a
                  href={docFile.path.startsWith('http') ? docFile.path : fileAPI.getUrl(docFile.path)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-1.5 text-primary hover:bg-primary/10 rounded transition-colors"
                  title="Görüntüle"
                >
                  <Camera size={14} />
                </a>
                <button
                  type="button"
                  onClick={() => handleDocDelete(index)}
                  className="p-1.5 text-destructive hover:bg-destructive/10 rounded transition-colors"
                  title="Sil"
                >
                  <Trash2 size={14} />
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {docs.length === 0 && (
        <p className="text-xs text-muted-foreground text-center py-2">
          Henüz belge yüklenmedi
        </p>
      )}
    </div>
  );
};

export default DocumentCategory;
