import React, { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';
import {
  isPushSupported,
  getNotificationPermissionStatus,
  subscribeToPush,
  unsubscribeFromPush,
  listenForForegroundMessages
} from '../../lib/firebaseMessaging';

export default function AdminNotificationSettings() {
  const navigate = useNavigate();
  const [supported, setSupported] = useState(false);
  const [permission, setPermission] = useState('default');
  const [subscribed, setSubscribed] = useState(false);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState('');
  const [successMessage, setSuccessMessage] = useState('');
  const [user, setUser] = useState(null);
  const [foregroundMessage, setForegroundMessage] = useState(null);

  useEffect(() => {
    const checkStatus = async () => {
      setLoading(true);
      setErrorMessage('');
      try {
        const isSupported = await isPushSupported();
        setSupported(isSupported);
        
        const permissionStatus = getNotificationPermissionStatus();
        setPermission(permissionStatus);

        const { data: { user: currentUser } } = await supabase.auth.getUser();
        setUser(currentUser);

        if (currentUser && isSupported) {
          const localToken = localStorage.getItem('fcm_token');
          if (localToken) {
            // Verify with DB
            const { data, error } = await supabase
              .from('push_subscriptions')
              .select('enabled')
              .eq('token', localToken)
              .eq('user_id', currentUser.id)
              .maybeSingle();

            if (!error && data && data.enabled) {
              setSubscribed(true);
            } else {
              setSubscribed(false);
              localStorage.removeItem('fcm_token');
            }
          }
        }
      } catch (err) {
        console.error("Error checking notification setup:", err);
        setErrorMessage("Error al verificar el estado de las notificaciones.");
      } finally {
        setLoading(false);
      }
    };

    checkStatus();

    // Listen for foreground push notifications when tab is active
    let unsubscribeForeground = null;
    isPushSupported().then((supported) => {
      if (supported) {
        listenForForegroundMessages((payload) => {
          setForegroundMessage(payload);
        }).then((unsub) => {
          unsubscribeForeground = unsub;
        });
      }
    });

    return () => {
      if (unsubscribeForeground) unsubscribeForeground();
    };
  }, []);

  const handleSubscribe = async () => {
    if (!user) {
      setErrorMessage("Debes estar autenticado para activar las notificaciones.");
      return;
    }
    setActionLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await subscribeToPush(user.id);
      setSubscribed(true);
      setPermission(getNotificationPermissionStatus());
      setSuccessMessage("¡Notificaciones activadas con éxito en este dispositivo!");
    } catch (err) {
      console.error("Error subscribing device:", err);
      setErrorMessage(err.message || "Ocurrió un error al activar las notificaciones.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleUnsubscribe = async () => {
    if (!user) return;
    setActionLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      await unsubscribeFromPush(user.id);
      setSubscribed(false);
      setPermission(getNotificationPermissionStatus());
      setSuccessMessage("Suscripción desactivada. Ya no recibirás notificaciones en este navegador.");
    } catch (err) {
      console.error("Error unsubscribing device:", err);
      setErrorMessage(err.message || "Ocurrió un error al desactivar las suscripciones.");
    } finally {
      setActionLoading(false);
    }
  };

  const handleSendTestNotification = async () => {
    setActionLoading(true);
    setErrorMessage('');
    setSuccessMessage('');
    try {
      const { data, error } = await supabase.functions.invoke('send-test-notification');
      
      if (error) {
        let errorMsg = error.message;
        // Check if there is an error body returned by the edge function
        if (error.context) {
          try {
            const errorBody = await error.context.json();
            errorMsg = errorBody.error || errorBody.message || errorMsg;
          } catch (_) {}
        }
        throw new Error(errorMsg);
      }

      if (data && data.ok) {
        setSuccessMessage("Notificación de prueba enviada con éxito. Deberías recibirla en instantes.");
      } else {
        throw new Error(data?.error || "Error al procesar la notificación de prueba.");
      }
    } catch (err) {
      console.error("Error sending test push:", err);
      setErrorMessage(err.message || "No se pudo enviar la notificación de prueba.");
    } finally {
      setActionLoading(false);
    }
  };

  const getPermissionLabel = (p) => {
    switch (p) {
      case 'granted': return 'Permitido ✅';
      case 'denied': return 'Bloqueado ❌';
      default: return 'No solicitado o predeterminado ⏳';
    }
  };

  if (loading) {
    return (
      <div className="admin-loading-spinner-container">
        <div className="admin-spinner"></div>
        <p>Cargando configuración de notificaciones...</p>
      </div>
    );
  }

  const handleToastClick = (e, url) => {
    e.preventDefault();
    setForegroundMessage(null);
    if (!url) return;
    try {
      const adminPath = '/admin/orders';
      const orderIndex = url.indexOf(adminPath);
      if (orderIndex !== -1) {
        const subRoute = url.substring(orderIndex);
        navigate(subRoute);
      } else {
        window.location.href = url;
      }
    } catch (_) {
      window.location.href = url;
    }
  };

  return (
    <div className="admin-notification-settings-wrapper">
      {/* Toast Alert for Foreground Messages */}
      {foregroundMessage && (
        <div className="admin-foreground-alert-toast">
          <div className="toast-header">
            <span className="toast-icon">🔔</span>
            <strong>{foregroundMessage.data?.title || foregroundMessage.notification?.title || 'Nuevo Mensaje'}</strong>
            <button className="toast-close" onClick={() => setForegroundMessage(null)}>&times;</button>
          </div>
          <div className="toast-body">
            <p>{foregroundMessage.data?.body || foregroundMessage.notification?.body || ''}</p>
            {foregroundMessage.data?.url && (
              <a 
                href={foregroundMessage.data.url} 
                className="btn-view-orders-toast" 
                onClick={(e) => handleToastClick(e, foregroundMessage.data.url)}
              >
                Ver pedido
              </a>
            )}
          </div>
        </div>
      )}

      <div className="settings-card">
        <div className="settings-card-header">
          <h3>Configuración de Notificaciones Push</h3>
          <p className="card-subtitle">Recibí notificaciones en tiempo real al ingresar un nuevo pedido.</p>
        </div>

        <div className="settings-card-body">
          {errorMessage && <div className="checkout-error-message">{errorMessage}</div>}
          {successMessage && <div className="admin-success-alert">{successMessage}</div>}

          <div className="settings-status-list">
            <div className="status-item">
              <span className="status-label">Soporte del Navegador:</span>
              <span className={`status-value ${supported ? 'text-success' : 'text-danger'}`}>
                {supported ? 'Compatible' : 'No compatible'}
              </span>
            </div>

            <div className="status-item">
              <span className="status-label">Permiso de Notificación:</span>
              <span className="status-value">{getPermissionLabel(permission)}</span>
            </div>

            <div className="status-item">
              <span className="status-label">Estado de Suscripción:</span>
              <span className={`status-value ${subscribed ? 'text-success' : 'text-muted'}`}>
                {subscribed ? 'Activo en este dispositivo' : 'Inactivo'}
              </span>
            </div>
          </div>

          {!supported ? (
            <div className="alert-warning-box">
              Este navegador o dispositivo no soporta notificaciones push. Para recibir notificaciones en iOS (iPhone/iPad), asegúrate de guardar este sitio web en tu pantalla de inicio como PWA.
            </div>
          ) : (
            <div className="settings-actions-panel">
              {!subscribed ? (
                <button
                  type="button"
                  className="btn btn-primary btn-action-push"
                  onClick={handleSubscribe}
                  disabled={actionLoading}
                >
                  {actionLoading ? 'Procesando...' : '🔔 Activar notificaciones en este navegador'}
                </button>
              ) : (
                <div className="actions-vertical-group">
                  <button
                    type="button"
                    className="btn btn-secondary btn-action-push"
                    onClick={handleUnsubscribe}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Procesando...' : '🔕 Desactivar notificaciones'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-outline btn-action-push"
                    onClick={handleSendTestNotification}
                    disabled={actionLoading}
                  >
                    {actionLoading ? 'Enviando...' : '🧪 Enviar notificación de prueba'}
                  </button>
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
