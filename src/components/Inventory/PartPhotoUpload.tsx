import React, { useRef, useState } from 'react';
import { Camera, Upload, X, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface PartPhotoUploadProps {
  currentUrl: string | null;
  onUploaded: (url: string | null) => void;
  onUploadingChange?: (uploading: boolean) => void;
}

export const PartPhotoUpload: React.FC<PartPhotoUploadProps> = ({ currentUrl, onUploaded, onUploadingChange }) => {
  const inputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [preview, setPreview] = useState<string | null>(currentUrl);
  const [error, setError] = useState<string | null>(null);

  const handleFile = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      setError('Please select an image file.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setError('Image must be under 5 MB.');
      return;
    }
    setError(null);
    setUploading(true);
    onUploadingChange?.(true);

    const ext = file.name.split('.').pop() || 'jpg';
    const path = `inventory-photos/${Date.now()}-${Math.random().toString(36).slice(2)}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from('vessel-photos')
      .upload(path, file, { upsert: false });

    if (uploadError) {
      setError('Upload failed. Please try again.');
      setUploading(false);
      onUploadingChange?.(false);
      return;
    }

    const { data } = supabase.storage.from('vessel-photos').getPublicUrl(path);
    const url = data.publicUrl;
    setPreview(url);
    onUploaded(url);
    setUploading(false);
    onUploadingChange?.(false);
  };

  const handleRemove = () => {
    setPreview(null);
    onUploaded(null);
    if (inputRef.current) inputRef.current.value = '';
  };

  return (
    <div>
      <label className="block text-sm font-medium text-gray-700 mb-2">
        Part Photo <span className="text-gray-400 font-normal">(optional)</span>
      </label>

      {preview ? (
        <div className="relative w-full">
          <div className="w-full h-52 rounded-xl border border-gray-200 overflow-hidden bg-gray-50">
            <img
              src={preview}
              alt="Part photo"
              className="w-full h-full object-cover"
              onError={(e) => {
                const img = e.target as HTMLImageElement;
                if (!img.src.includes('?t=')) {
                  img.src = `${preview}?t=${Date.now()}`;
                } else {
                  img.style.display = 'none';
                }
              }}
            />
          </div>
          <button
            type="button"
            onClick={handleRemove}
            className="absolute top-2 right-2 p-1.5 bg-white/90 hover:bg-white rounded-lg shadow-sm transition-colors"
          >
            <X className="w-4 h-4 text-gray-600" />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={uploading}
          className="w-full h-36 border-2 border-dashed border-gray-300 rounded-xl flex flex-col items-center justify-center gap-2 hover:border-blue-400 hover:bg-blue-50 transition-all group disabled:opacity-60"
        >
          {uploading ? (
            <>
              <Loader2 className="w-7 h-7 text-blue-500 animate-spin" />
              <span className="text-sm text-gray-500">Uploading...</span>
            </>
          ) : (
            <>
              <div className="p-2.5 bg-gray-100 group-hover:bg-blue-100 rounded-xl transition-colors">
                <Camera className="w-6 h-6 text-gray-400 group-hover:text-blue-500 transition-colors" />
              </div>
              <span className="text-sm text-gray-500 group-hover:text-blue-600 transition-colors">
                Click to upload part photo
              </span>
              <span className="text-xs text-gray-400">JPG, PNG, WEBP — max 5 MB</span>
            </>
          )}
        </button>
      )}

      {error && (
        <p className="mt-1.5 text-xs text-red-600">{error}</p>
      )}

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />
    </div>
  );
};
