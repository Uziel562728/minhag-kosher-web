import React, { useEffect, useState } from 'react';
import { Navigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

export default function ProtectedRoute({ children }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState(null);

  useEffect(() => {
    // 1. Get initial session
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setLoading(false);
    });

    // 2. Listen for auth changes
    const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setLoading(false);
    });

    return () => {
      subscription.unsubscribe();
    };
  }, []);

  if (loading) {
    return (
      <div className="admin-loading-container">
        <div className="admin-spinner"></div>
        <p>Verificando credenciales...</p>
      </div>
    );
  }

  if (!session) {
    return <Navigate to="/admin/login" replace />;
  }

  if (session.user?.app_metadata?.role !== 'admin') {
    return (
      <div className="admin-loading-container" style={{ textAlign: 'center', padding: '2rem' }}>
        <h2 style={{ color: 'var(--text-danger)', marginBottom: '1rem' }}>Acceso No Autorizado</h2>
        <p style={{ marginBottom: '1.5rem' }}>Tu cuenta no tiene privilegios de administrador para acceder a este panel.</p>
        <button 
          onClick={async () => {
            await supabase.auth.signOut();
          }} 
          className="btn btn-primary"
        >
          Cerrar Sesión
        </button>
      </div>
    );
  }

  return children;
}
