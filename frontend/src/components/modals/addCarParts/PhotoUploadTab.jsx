import React, { useState } from 'react';
import { Upload, Loader2, Trash2 } from 'lucide-react';
import { fileAPI } from '../../../services/api';

const PhotoUploadTab = ({ formData, handleChange }) => {
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);

  const handleFileUpload = async (files) => {
    if (!files || files.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    try {
      const newPhotos = [...(formData.photos || [])];
      const totalFiles = files.length;

      for (let i = 0; i < files.length; i++) {
        const file = files[i];
        // Limit: 50MB
        if (file.size > 50 * 1024 * 1024) {
          alert('Dosya çok büyük (max 50MB)');
          continue;
        }

        try {
          // Smart upload kullan - otomatik olarak en uygun yöntemi seçer
          const res = await fileAPI.smartUpload(file, (progress) => {
            // Her dosya için progress
            const overallProgress = Math.round(((i + progress / 100) / totalFiles) * 100);
            setUploadProgress(overallProgress);
          });
          newPhotos.push(res.data.path);
          setUploadProgress(Math.round(((i + 1) / totalFiles) * 100));
        } catch (uploadError) {
          console.error('Smart upload failed, trying fallback:', uploadError);
          // Fallback: Normal upload dene
          try {
            const fd = new FormData();
            fd.append('file', file);
            const res = await fileAPI.upload(fd);
            newPhotos.push(res.data.path);
          } catch (fallbackError) {
            console.error('All upload methods failed:', fallbackError);
            alert(`"${file.name}" yüklenemedi. Lütfen daha küçük bir dosya deneyin.`);
          }
        }
      }
      handleChange('photos', newPhotos);
    } catch (err) {
      console.error('Upload failed:', err);
      alert('Fotoğraf yüklenemedi: ' + (err.response?.data?.detail || err.message));
    } finally {
      setUploading(false);
      setUploadProgress(0);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    setDragOver(false);
    handleFileUpload(e.dataTransfer.files);
  };

  return (
    <div className="space-y-4 py-4">
      <div
        className={`text-center py-12 border-2 border-dashed rounded-xl transition-colors ${
          dragOver ? 'border-primary bg-primary/5' : 'border-border'
        }`}
        onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
        onDragLeave={() => setDragOver(false)}
        onDrop={handleDrop}
      >
        {uploading ? (
          <div className="flex flex-col items-center gap-3">
            <Loader2 size={48} className="animate-spin text-primary" />
            <p className="text-sm text-muted-foreground">Yükleniyor... %{uploadProgress}</p>
            <div className="w-48 h-2 bg-muted rounded-full overflow-hidden">
              <div
                className="h-full bg-primary transition-all duration-300"
                style={{ width: `${uploadProgress}%` }}
              />
            </div>
          </div>
        ) : (
          <>
            <Upload size={48} className="mx-auto text-muted-foreground mb-4" />
            <p className="text-muted-foreground mb-2">Fotoğraf yüklemek için tıklayın veya sürükleyin</p>
            <p className="text-xs text-muted-foreground">PNG, JPG, WebP, HEIC (max. 50MB)</p>
            <input
              type="file"
              accept="image/*"
              multiple
              className="hidden"
              id="photo-upload"
              data-testid="photo-upload-input"
              onChange={(e) => handleFileUpload(e.target.files)}
            />
            <label
              htmlFor="photo-upload"
              className="inline-flex items-center gap-2 mt-4 px-6 py-2.5 bg-primary text-primary-foreground rounded-lg cursor-pointer hover:bg-primary/90 transition-colors font-medium text-sm"
              data-testid="photo-upload-btn"
            >
              <Upload size={16} />
              Fotoğraf Seç
            </label>
          </>
        )}
      </div>

      {formData.photos && formData.photos.length > 0 && (
        <div className="grid grid-cols-3 gap-3">
          {formData.photos.map((photo, index) => (
            <div key={index} className="relative aspect-video rounded-lg overflow-hidden bg-muted group" data-testid={`photo-preview-${index}`}>
              <img
                src={photo.startsWith('http') ? photo : fileAPI.getUrl(photo)}
                alt={`Araç ${index + 1}`}
                className="w-full h-full object-cover"
                onError={(e) => { e.target.src = ''; e.target.className = 'hidden'; }}
              />
              <button
                type="button"
                onClick={() => {
                  const newPhotos = formData.photos.filter((_, i) => i !== index);
                  handleChange('photos', newPhotos);
                }}
                className="absolute top-2 right-2 p-1.5 bg-destructive text-destructive-foreground rounded-full opacity-0 group-hover:opacity-100 transition-opacity"
                data-testid={`remove-photo-${index}`}
              >
                <Trash2 size={14} />
              </button>
              <div className="absolute bottom-1 left-1 bg-black/50 text-white text-[10px] px-1.5 py-0.5 rounded">
                {index + 1}/{formData.photos.length}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default PhotoUploadTab;
