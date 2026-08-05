import React, { useEffect, useState, useCallback, useRef, useMemo } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { supabase } from '../supabaseClient';
import { useCart } from '../context/CartContext';

async function recordInteraction(campaignId, interactionType) {
  try {
    const payload = {
      campaign_id: campaignId,
      tipo: interactionType,
      fecha: new Date().toISOString()
    };
    
    const { error } = await supabase
      .from('popup_interactions')
      .insert([payload]);

    if (error) {
      await supabase
        .from('popup_interactions')
        .insert([{
          popup_id: campaignId,
          interaction_type: interactionType,
          tipo_interaccion: interactionType,
          created_at: new Date().toISOString()
        }]);
    }
  } catch (err) {
    if (import.meta.env.DEV) {
      console.debug('Safe interaction recording skipped:', err);
    }
  }
}

export default function CampaignFlyerPopup() {
  const location = useLocation();
  const navigate = useNavigate();
  const { campaigns, promotionsLoading } = useCart();

  const [activeFlyer, setActiveFlyer] = useState(null);
  const [isVisible, setIsVisible] = useState(false);

  const timerRef = useRef(null);

  const [isMobile, setIsMobile] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.innerWidth <= 768;
  });

  useEffect(() => {
    const handleResize = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const isAdminRoute = location.pathname.startsWith('/admin');

  const getLocalDateString = () => {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  };

  const checkIsAlreadySeen = useCallback((c) => {
    const freq = c.popup_frecuencia || 'una_vez_sesion';
    
    if (freq === 'siempre') return false;

    if (freq === 'una_vez_sesion') {
      const key = `campaign_seen_session_${c.id}`;
      return !!sessionStorage.getItem(key);
    }

    if (freq === 'una_vez_dia') {
      const key = `campaign_seen_day_${c.id}`;
      const seenDay = localStorage.getItem(key);
      return seenDay === getLocalDateString();
    }

    if (freq === 'una_vez_total') {
      const key = `campaign_seen_ever_${c.id}`;
      return !!localStorage.getItem(key);
    }

    return false;
  }, []);

  // Filter candidates from global campaigns context
  const eligibleCandidates = useMemo(() => {
    if (promotionsLoading || !campaigns || campaigns.length === 0) return [];
    
    return campaigns
      .map(c => {
        const img = c.imagen_url || c.popup_imagen_url;
        const destType = c.destino_tipo || c.popup_destino_tipo || 'ninguno';
        const destVal = c.destino_valor || c.popup_destino_valor || '';
        return {
          ...c,
          effective_image_url: img,
          effective_destino_tipo: destType,
          effective_destino_valor: destVal,
        };
      })
      .filter(c => c.effective_image_url && c.mostrar_imagen);
  }, [campaigns, promotionsLoading]);

  // Handle route navigation changes (resets current flyer state for new checks)
  useEffect(() => {
    setIsVisible(false);
    setActiveFlyer(null);
    if (timerRef.current) clearTimeout(timerRef.current);
  }, [location.pathname]);

  // Reactive effect for flyer display and lifecycle management
  useEffect(() => {
    if (isAdminRoute) return;
    if (promotionsLoading) return;

    // 1. If no campaigns are currently eligible
    if (eligibleCandidates.length === 0) {
      // Close open flyer immediately without saving interaction to avoid manual records
      setIsVisible(false);
      setActiveFlyer(null);
      if (timerRef.current) clearTimeout(timerRef.current);
      return;
    }

    // 2. If a flyer is already active/planned, make sure it is still in the active list
    if (activeFlyer) {
      const stillActive = eligibleCandidates.some(c => c.id === activeFlyer.id);
      if (!stillActive) {
        setIsVisible(false);
        setActiveFlyer(null);
        if (timerRef.current) clearTimeout(timerRef.current);
      }
      return;
    }

    // 3. Filter candidates by device constraints and frequency
    const deviceAndFreqFiltered = eligibleCandidates.filter(c => {
      const device = c.popup_dispositivo || 'todos';
      if (device === 'movil' && !isMobile) return false;
      if (device === 'escritorio' && isMobile) return false;
      if (checkIsAlreadySeen(c)) return false;
      return true;
    });

    if (deviceAndFreqFiltered.length === 0) return;

    // 4. Sort eligible candidates by priority desc, updated_at desc
    deviceAndFreqFiltered.sort((a, b) => {
      if (b.prioridad !== a.prioridad) {
        return b.prioridad - a.prioridad;
      }
      const timeA = new Date(a.fecha_actualizacion || a.fecha_creacion || 0).getTime();
      const timeB = new Date(b.fecha_actualizacion || b.fecha_creacion || 0).getTime();
      return timeB - timeA;
    });

    const chosen = deviceAndFreqFiltered[0];
    setActiveFlyer(chosen);

    // 5. Schedule delayed show
    const delaySec = chosen.popup_retraso_segundos || 0;
    timerRef.current = setTimeout(() => {
      setIsVisible(true);

      const freq = chosen.popup_frecuencia || 'una_vez_sesion';
      if (freq === 'una_vez_sesion') {
        sessionStorage.setItem(`campaign_seen_session_${chosen.id}`, 'true');
      } else if (freq === 'una_vez_dia') {
        localStorage.setItem(`campaign_seen_day_${chosen.id}`, getLocalDateString());
      } else if (freq === 'una_vez_total') {
        localStorage.setItem(`campaign_seen_ever_${chosen.id}`, 'true');
      }

      recordInteraction(chosen.id, 'vista');
    }, delaySec * 1000);

    return () => {
      if (timerRef.current) clearTimeout(timerRef.current);
    };
  }, [eligibleCandidates, promotionsLoading, isMobile, checkIsAlreadySeen, isAdminRoute, activeFlyer]);

  const handleClose = (e) => {
    if (e) e.stopPropagation();
    setIsVisible(false);
    if (activeFlyer) {
      recordInteraction(activeFlyer.id, 'cerrado');
    }
  };

  const handleFlyerClick = async () => {
    if (!activeFlyer) return;
    
    const type = activeFlyer.effective_destino_tipo;
    const value = activeFlyer.effective_destino_valor;

    if (!type || type === 'ninguno') return;

    setIsVisible(false);
    recordInteraction(activeFlyer.id, 'clic');

    switch (type) {
      case 'producto':
        if (value) {
          navigate(value);
        }
        break;

      case 'categoria':
        if (value) {
          if (location.pathname !== '/') {
            navigate('/', { replace: true });
          }
          const selectCatTimer = setTimeout(() => {
            window.dispatchEvent(new CustomEvent('minhag-select-category', { detail: value }));
            const catalogElem = document.getElementById('catalog');
            if (catalogElem) {
              catalogElem.scrollIntoView({ behavior: 'smooth' });
            }
          }, 150);
          return () => clearTimeout(selectCatTimer);
        }
        break;

      case 'seccion':
        if (value) {
          if (location.pathname !== '/') {
            navigate('/', { replace: true });
          }
          const selectSecTimer = setTimeout(() => {
            window.dispatchEvent(new CustomEvent('minhag-select-section', { detail: value }));
            const catalogElem = document.getElementById('catalog');
            if (catalogElem) {
              catalogElem.scrollIntoView({ behavior: 'smooth' });
            }
          }, 150);
          return () => clearTimeout(selectSecTimer);
        }
        break;

      case 'ruta_interna':
        if (value && value.startsWith('/')) {
          navigate(value);
        }
        break;

      case 'url_externa':
        if (value && (value.startsWith('http://') || value.startsWith('https://'))) {
          window.open(value, '_blank', 'noopener,noreferrer');
        }
        break;

      default:
        break;
    }
  };

  if (isAdminRoute || !activeFlyer || !isVisible) {
    return null;
  }

  const canClose = activeFlyer.popup_se_puede_cerrar !== false;

  return (
    <div 
      className="campaign-flyer-popup-overlay active"
      onClick={canClose ? () => handleClose() : undefined}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        bottom: 0,
        backgroundColor: 'rgba(0, 0, 0, 0.72)',
        backdropFilter: 'blur(4px)',
        zIndex: 999999,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: isMobile ? '12px' : '24px',
        boxSizing: 'border-box'
      }}
    >
      <div 
        className="campaign-flyer-popup-content"
        onClick={(e) => e.stopPropagation()}
        style={{
          position: 'relative',
          maxWidth: '540px',
          width: '100%',
          maxHeight: '90vh',
          display: 'flex',
          flexDirection: 'column',
          backgroundColor: '#0f172a',
          borderRadius: '12px',
          border: '1px solid #334155',
          overflow: 'hidden',
          boxShadow: '0 20px 25px -5px rgba(0,0,0,0.5), 0 10px 10px -5px rgba(0,0,0,0.5)'
        }}
      >
        {/* Render only image (flyer) with object-fit: contain */}
        <div 
          onClick={handleFlyerClick}
          style={{
            position: 'relative',
            cursor: activeFlyer.effective_destino_tipo !== 'ninguno' ? 'pointer' : 'default',
            width: '100%',
            backgroundColor: '#000',
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            overflow: 'hidden'
          }}
        >
          <img 
            src={activeFlyer.effective_image_url} 
            alt={activeFlyer.nombre}
            style={{
              width: '100%',
              height: 'auto',
              maxHeight: '75vh',
              objectFit: 'contain',
              display: 'block'
            }}
          />
        </div>

        {/* Close button inside popup overlay */}
        {canClose && (
          <button
            type="button"
            onClick={(e) => handleClose(e)}
            style={{
              position: 'absolute',
              top: '12px',
              right: '12px',
              width: '32px',
              height: '32px',
              borderRadius: '50%',
              backgroundColor: 'rgba(15, 23, 42, 0.85)',
              border: '1px solid rgba(255, 255, 255, 0.2)',
              color: '#ffffff',
              fontSize: '1.25rem',
              fontWeight: 'bold',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
              transition: 'background-color 0.2s, border-color 0.2s',
              zIndex: 10,
              padding: 0
            }}
            onMouseEnter={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 1)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.4)';
            }}
            onMouseLeave={(e) => {
              e.currentTarget.style.backgroundColor = 'rgba(15, 23, 42, 0.85)';
              e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.2)';
            }}
            aria-label="Cerrar flyer promocional"
          >
            &times;
          </button>
        )}
      </div>
    </div>
  );
}
