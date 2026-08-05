import React, { useState, useEffect, useMemo } from 'react';
import { supabase } from '../../supabaseClient';

export default function CampaignImageSelector({
  currentImageUrl,
  onImageSelected,        // Callback when a final URL/preview is ready: (url, fileObject, sourceMode)
  onImageCleared,         // Callback when cleared
}) {
  const [mode, setMode] = useState('upload'); // 'upload', 'library', 'external'
  
  // Local Upload State
  const [selectedFile, setSelectedFile] = useState(null);
  const [localPreview, setLocalPreview] = useState('');
  const [isDragActive, setIsDragActive] = useState(false);

  // Library State
  const [libraryCampaigns, setLibraryCampaigns] = useState([]);
  const [searchLibrary, setSearchLibrary] = useState('');
  const [loadingLibrary, setLoadingLibrary] = useState(false);
  const [libraryError, setLibraryError] = useState('');
  const [selectedLibraryUrl, setSelectedLibraryUrl] = useState('');

  // External URL State
  const [externalUrl, setExternalUrl] = useState('');

  // Fetch unique images from campaigns
  useEffect(() => {
    if (mode === 'library') {
      loadLibraryImages();
    }
  }, [mode]);

  const loadLibraryImages = async () => {
    setLoadingLibrary(true);
    setLibraryError('');
    try {
      // 1. Fetch campaigns directly from table without restrictions
      const { data, error } = await supabase
        .from('campaigns')
        .select('id, nombre, tipo, imagen_url, popup_imagen_url, fecha_actualizacion, fecha_creacion')
        .in('tipo', ['popup', 'promocion']);

      if (error) throw error;

      // 2. Sort by fecha_actualizacion desc, then fecha_creacion desc to prioritize most recent ones
      const sorted = (data || []).sort((a, b) => {
        const timeA_update = new Date(a.fecha_actualizacion || a.fecha_creacion || 0).getTime();
        const timeB_update = new Date(b.fecha_actualizacion || b.fecha_creacion || 0).getTime();
        if (timeB_update !== timeA_update) {
          return timeB_update - timeA_update;
        }
        const timeA_create = new Date(a.fecha_creacion || 0).getTime();
        const timeB_create = new Date(b.fecha_creacion || 0).getTime();
        return timeB_create - timeA_create;
      });

      // 3. Deduplicate by effective image URL
      const uniqueMap = new Map();
      sorted.forEach(c => {
        const effectiveUrl = (c.imagen_url || c.popup_imagen_url || '').trim();
        if (effectiveUrl && !uniqueMap.has(effectiveUrl)) {
          uniqueMap.set(effectiveUrl, {
            ...c,
            resolvedUrl: effectiveUrl
          });
        }
      });

      setLibraryCampaigns(Array.from(uniqueMap.values()));
    } catch (err) {
      console.error('Error loading library images:', err);
      setLibraryError(err.message || String(err));
    } finally {
      setLoadingLibrary(false);
    }
  };

  // Filter library campaigns by query (name, type, url)
  const filteredLibrary = useMemo(() => {
    const query = searchLibrary.toLowerCase().trim();
    if (!query) return libraryCampaigns;
    return libraryCampaigns.filter(c => {
      const matchNombre = c.nombre?.toLowerCase().includes(query);
      const matchTipo = (c.tipo === 'popup' ? 'popup' : 'promocion').includes(query) ||
                        (c.tipo === 'popup' ? 'flyer' : 'descuento').includes(query);
      const matchUrl = c.resolvedUrl?.toLowerCase().includes(query);
      return matchNombre || matchTipo || matchUrl;
    });
  }, [libraryCampaigns, searchLibrary]);

  // Format date helper (DD/MM/YYYY)
  const formatDateLabel = (dateString) => {
    if (!dateString) return 'S/F';
    const d = new Date(dateString);
    if (isNaN(d.getTime())) return 'S/F';
    const pad = (num) => String(num).padStart(2, '0');
    return `${pad(d.getDate())}/${pad(d.getMonth() + 1)}/${d.getFullYear()}`;
  };

  // Clean local URL preview on unmount/reselect
  useEffect(() => {
    return () => {
      if (localPreview && localPreview.startsWith('blob:')) {
        URL.revokeObjectURL(localPreview);
      }
    };
  }, [localPreview]);

  // Drag and drop handlers
  const handleDrag = (e) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === 'dragenter' || e.type === 'dragover') {
      setIsDragActive(true);
    } else if (e.type === 'dragleave') {
      setIsDragActive(false);
    }
  };

  const handleDrop = (e) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragActive(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      processFile(e.dataTransfer.files[0]);
    }
  };

  const handleFileChange = (e) => {
    if (e.target.files && e.target.files[0]) {
      processFile(e.target.files[0]);
    }
  };

  const processFile = (file) => {
    const MAX_SIZE = 10 * 1024 * 1024; // 10MB
    if (file.size > MAX_SIZE) {
      alert('La imagen seleccionada supera el límite máximo de 10 MB.');
      return;
    }

    const allowedTypes = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'];
    if (!allowedTypes.includes(file.type)) {
      alert('Solo se aceptan archivos JPG, PNG, WEBP y GIF.');
      return;
    }

    // Clean old preview
    if (localPreview && localPreview.startsWith('blob:')) {
      URL.revokeObjectURL(localPreview);
    }

    const previewUrl = URL.createObjectURL(file);
    setSelectedFile(file);
    setLocalPreview(previewUrl);
    
    // Notify parent of new file and local preview link
    onImageSelected(previewUrl, file, 'upload');
  };

  const handleClearImage = () => {
    setSelectedFile(null);
    if (localPreview && localPreview.startsWith('blob:')) {
      URL.revokeObjectURL(localPreview);
    }
    setLocalPreview('');
    setSelectedLibraryUrl('');
    setExternalUrl('');
    onImageCleared();
  };

  const handleSelectLibraryImage = (url) => {
    setSelectedLibraryUrl(url);
    onImageSelected(url, null, 'library');
  };

  const handleExternalUrlChange = (e) => {
    const val = e.target.value;
    setExternalUrl(val);
    if (val.trim()) {
      onImageSelected(val.trim(), null, 'external');
    } else {
      onImageCleared();
    }
  };

  const formatFileSize = (bytes) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const dm = 2;
    const sizes = ['Bytes', 'KB', 'MB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(dm)) + ' ' + sizes[i];
  };

  return (
    <div className="campaign-image-selector" style={{ border: '1px solid #475569', borderRadius: 'var(--radius-md)', padding: '15px', backgroundColor: '#1e293b', marginTop: '5px', color: '#fff' }}>
      
      {/* Selection Tabs */}
      <div className="selector-tabs" style={{ display: 'flex', gap: '8px', borderBottom: '1px solid #475569', paddingBottom: '10px', marginBottom: '15px' }}>
        <button
          type="button"
          onClick={() => { setMode('upload'); handleClearImage(); }}
          className={`btn ${mode === 'upload' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
        >
          📁 Subir archivo local
        </button>
        <button
          type="button"
          onClick={() => { setMode('library'); handleClearImage(); }}
          className={`btn ${mode === 'library' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
        >
          📚 De campañas anteriores
        </button>
        <button
          type="button"
          onClick={() => { setMode('external'); handleClearImage(); }}
          className={`btn ${mode === 'external' ? 'btn-primary' : 'btn-secondary'}`}
          style={{ padding: '6px 12px', fontSize: '0.8rem' }}
        >
          🔗 URL externa
        </button>
      </div>

      {/* Mode Views */}
      {mode === 'upload' && (
        <div 
          className={`drag-drop-zone ${isDragActive ? 'drag-active' : ''}`}
          onDragEnter={handleDrag}
          onDragOver={handleDrag}
          onDragLeave={handleDrag}
          onDrop={handleDrop}
          style={{
            border: isDragActive ? '2px dashed #38bdf8' : '2px dashed #475569',
            borderRadius: 'var(--radius-md)',
            padding: '25px 10px',
            textAlign: 'center',
            backgroundColor: isDragActive ? 'rgba(56, 189, 248, 0.08)' : '#0f172a',
            cursor: 'pointer',
            transition: 'all 0.2s ease',
            position: 'relative'
          }}
        >
          <input 
            type="file"
            id="file-upload-input"
            accept="image/jpeg,image/png,image/webp,image/gif"
            onChange={handleFileChange}
            style={{ display: 'none' }}
          />
          <label htmlFor="file-upload-input" style={{ cursor: 'pointer', width: '100%', display: 'block', margin: 0 }}>
            <span style={{ fontSize: '2rem', display: 'block', marginBottom: '8px' }}>📤</span>
            <span style={{ fontWeight: '600', fontSize: '0.85rem', color: '#fff' }}>
              Arrastrá tu imagen acá o hacé clic para seleccionar
            </span>
            <span style={{ display: 'block', fontSize: '0.75rem', color: '#cbd5e1', marginTop: '4px' }}>
              Formatos soportados: JPG, PNG, WEBP y GIF (Máx. 10 MB)
            </span>
          </label>
        </div>
      )}

      {mode === 'library' && (
        <div className="library-selector-view">
          <input
            type="text"
            placeholder="Buscar por nombre de campaña de origen..."
            value={searchLibrary}
            onChange={(e) => setSearchLibrary(e.target.value)}
            style={{ 
              width: '100%', 
              padding: '10px', 
              fontSize: '0.85rem', 
              borderRadius: 'var(--radius-sm)', 
              border: '1px solid #475569', 
              backgroundColor: '#0f172a',
              color: '#fff',
              marginBottom: '12px' 
            }}
          />

          {loadingLibrary ? (
            <div style={{ textAlign: 'center', padding: '25px', color: '#cbd5e1', fontSize: '0.85rem', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}>
              <div className="admin-spinner" style={{ width: '16px', height: '16px', border: '2px solid rgba(255,255,255,0.1)', borderTopColor: '#fff', borderRadius: '50%', animation: 'spin 1s linear infinite' }}></div>
              Cargando imágenes anteriores...
            </div>
          ) : libraryError ? (
            <div style={{ textAlign: 'center', padding: '15px', color: '#f87171', backgroundColor: 'rgba(239, 68, 68, 0.1)', border: '1px solid rgba(239, 68, 68, 0.2)', borderRadius: '6px', fontSize: '0.85rem', fontWeight: '500' }}>
              ⚠️ Error de Supabase al cargar biblioteca: {libraryError}
            </div>
          ) : filteredLibrary.length > 0 ? (
            <div 
              className="library-thumbnails-grid"
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fill, minmax(130px, 1fr))',
                gap: '12px',
                maxHeight: '260px',
                overflowY: 'auto',
                padding: '5px'
              }}
            >
              {filteredLibrary.map((c) => {
                const isSelected = selectedLibraryUrl === c.resolvedUrl;
                const formattedDate = formatDateLabel(c.fecha_actualizacion || c.fecha_creacion);
                const typeText = c.tipo === 'popup' ? 'Popup' : 'Promoción';

                return (
                  <div
                    key={c.id}
                    onClick={() => handleSelectLibraryImage(c.resolvedUrl)}
                    style={{
                      border: isSelected ? '2px solid #38bdf8' : '1px solid #475569',
                      borderRadius: '6px',
                      overflow: 'hidden',
                      cursor: 'pointer',
                      position: 'relative',
                      backgroundColor: '#0f172a',
                      display: 'flex',
                      flexDirection: 'column',
                      height: '140px',
                      boxSizing: 'border-box',
                      transition: 'border-color 0.2s'
                    }}
                  >
                    {/* Contenedor de Imagen Completa */}
                    <div 
                      style={{ 
                        flex: 1, 
                        position: 'relative', 
                        display: 'flex', 
                        alignItems: 'center', 
                        justifyContent: 'center', 
                        backgroundColor: '#0f172a', 
                        overflow: 'hidden' 
                      }}
                    >
                      <img
                        src={c.resolvedUrl}
                        alt={c.nombre}
                        loading="lazy"
                        style={{ 
                          width: '100%', 
                          height: '100%', 
                          objectFit: 'contain', 
                          backgroundColor: '#0f172a' 
                        }}
                        onError={(e) => {
                          e.target.onerror = null;
                          e.target.src = 'https://via.placeholder.com/130x90?text=Error+Img';
                        }}
                      />
                      {/* Check indicator if selected */}
                      {isSelected && (
                        <div 
                          style={{
                            position: 'absolute',
                            top: '4px',
                            right: '4px',
                            backgroundColor: '#38bdf8',
                            color: '#000',
                            borderRadius: '50%',
                            width: '18px',
                            height: '18px',
                            display: 'flex',
                            alignItems: 'center',
                            justifyContent: 'center',
                            fontSize: '0.7rem',
                            fontWeight: 'bold'
                          }}
                        >
                          ✓
                        </div>
                      )}
                    </div>

                    {/* Metadata Footer */}
                    <div 
                      style={{ 
                        fontSize: '0.68rem', 
                        padding: '6px', 
                        backgroundColor: isSelected ? 'rgba(56, 189, 248, 0.1)' : '#1e293b',
                        borderTop: '1px solid #475569',
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '2px',
                        overflow: 'hidden'
                      }}
                    >
                      <div 
                        style={{ 
                          fontWeight: 'bold', 
                          color: '#fff', 
                          whiteSpace: 'nowrap', 
                          overflow: 'hidden', 
                          textOverflow: 'ellipsis' 
                        }}
                        title={c.nombre}
                      >
                        {c.nombre}
                      </div>
                      <div style={{ display: 'flex', justifyContent: 'space-between', color: '#cbd5e1', fontSize: '0.62rem' }}>
                        <span>{typeText}</span>
                        <span>{formattedDate}</span>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <div style={{ textAlign: 'center', padding: '25px', color: '#cbd5e1', fontSize: '0.85rem', border: '1px dashed #475569', borderRadius: '6px' }}>
              No se encontraron imágenes en campañas anteriores.
            </div>
          )}
        </div>
      )}

      {mode === 'external' && (
        <div className="external-url-view">
          <label htmlFor="external-url-input" style={{ fontSize: '0.75rem', fontWeight: 'bold', color: '#cbd5e1' }}>Ingresar dirección URL de la imagen</label>
          <input
            id="external-url-input"
            type="text"
            placeholder="Ej: https://imagenes-externas.com/banner.png"
            value={externalUrl}
            onChange={handleExternalUrlChange}
            style={{ 
              width: '100%', 
              padding: '10px', 
              fontSize: '0.85rem', 
              borderRadius: 'var(--radius-md)', 
              border: '1px solid #475569', 
              backgroundColor: '#0f172a',
              color: '#fff',
              marginTop: '4px' 
            }}
          />
        </div>
      )}

      {/* Selected Image Detail and Clear Options */}
      {(selectedFile || selectedLibraryUrl || externalUrl || currentImageUrl) && (
        <div 
          className="selected-image-status" 
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginTop: '15px',
            padding: '10px',
            backgroundColor: '#0f172a',
            borderRadius: 'var(--radius-md)',
            border: '1px solid #475569'
          }}
        >
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px', overflow: 'hidden' }}>
            {selectedFile ? (
              <span style={{ fontSize: '1.2rem' }}>📄</span>
            ) : selectedLibraryUrl ? (
              <span style={{ fontSize: '1.2rem' }}>📚</span>
            ) : currentImageUrl ? (
              <span style={{ fontSize: '1.2rem' }}>🖼️</span>
            ) : (
              <span style={{ fontSize: '1.2rem' }}>🔗</span>
            )}
            <div style={{ overflow: 'hidden' }}>
              <div 
                style={{ fontSize: '0.8rem', fontWeight: '600', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', color: '#fff' }}
              >
                {selectedFile ? selectedFile.name : selectedLibraryUrl ? 'Elegida de biblioteca' : currentImageUrl ? 'Imagen activa guardada' : 'URL externa configurada'}
              </div>
              <div style={{ fontSize: '0.7rem', color: '#cbd5e1' }}>
                {selectedFile ? formatFileSize(selectedFile.size) : 'Enlace remoto asignado'}
              </div>
            </div>
          </div>
          <button
            type="button"
            onClick={handleClearImage}
            style={{
              border: 'none',
              backgroundColor: 'transparent',
              color: '#f87171',
              cursor: 'pointer',
              fontWeight: 'bold',
              fontSize: '0.8rem'
            }}
          >
            Quitar
          </button>
        </div>
      )}
    </div>
  );
}
