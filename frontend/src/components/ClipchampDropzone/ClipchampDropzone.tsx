import React, { useState, useRef } from 'react';
import { useEditor } from '../../context/EditorContext';
import { uploadMediaBackend } from '../../services/apiClient';
import styles from './ClipchampDropzone.module.css';

export const ClipchampDropzone: React.FC = () => {
  const { project, reloadAssets } = useEditor();
  const [isDragOver, setIsDragOver] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(true);
  };

  const handleDragLeave = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
  };

  const handleFiles = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    setIsUploading(true);
    try {
      for (let i = 0; i < files.length; i++) {
        await uploadMediaBackend(files[i], project?.id || 'default_project');
      }
      await reloadAssets();
    } catch (err) {
      console.error('B2 Upload failed', err);
      alert('Error uploading to Backblaze B2 storage.');
    } finally {
      setIsUploading(false);
    }
  };

  const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragOver(false);
    await handleFiles(e.dataTransfer.files);
  };

  return (
    <div
      className={`${styles.dropzone} ${isDragOver ? styles.dropzoneActive : ''}`}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => fileInputRef.current?.click()}
      title="Click or Drag & Drop Media Files"
    >
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept="video/*,image/*,audio/*"
        style={{ display: 'none' }}
        onChange={(e) => handleFiles(e.target.files)}
      />

      <div className={styles.iconWrapper}>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2">
          <path strokeLinecap="round" strokeLinejoin="round" d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
        </svg>
      </div>

      <span className={styles.textMain}>
        Drag & Drop media here <span className={styles.browseSpan}>or browse</span>
      </span>
      <span className={styles.textSub}>Supports MP4, PNG, JPG, WAV, MP3</span>

      <div className={styles.b2Badge}>
        <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5">
          <rect x="3" y="11" width="18" height="11" rx="2" ry="2" />
          <path d="M7 11V7a5 5 0 019.9-1" />
        </svg>
        <span>Backblaze B2 Object Lock</span>
      </div>

      {isUploading && (
        <div className={styles.uploadingOverlay}>
          <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="animate-spin">
            <path d="M12 2v4m0 12v4M4.93 4.93l2.83 2.83m8.48 8.48l2.83 2.83M2 12h4m12 0h4M4.93 19.07l2.83-2.83m8.48-8.48l2.83-2.83" />
          </svg>
          <span>Uploading & Registering SHA-256...</span>
        </div>
      )}
    </div>
  );
};
