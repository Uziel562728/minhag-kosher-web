import React, { useState, useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { supabase } from '../../supabaseClient';

export default function AdminLogin() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');
  const navigate = useNavigate();

  useEffect(() => {
    // If session already exists, skip login and redirect to admin
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) {
        navigate('/admin', { replace: true });
      }
    });
  }, [navigate]);

  const handleLogin = async (e) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg('');

    try {
      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        throw error;
      }

      navigate('/admin', { replace: true });
    } catch (err) {
      console.error('Error de autenticación en Supabase:', {
        message: err.message || err,
        code: err.code || 'N/A',
        details: err.details || 'N/A',
        hint: err.hint || 'N/A',
        stack: err.stack
      });
      setErrorMsg(err.message === 'Invalid login credentials' 
        ? 'Correo o contraseña incorrectos.' 
        : err.message || 'Error de conexión.'
      );
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="admin-login-page">
      <div className="admin-login-card">
        <div className="login-logo-container">
          <h2>SUPER MARKET KOSHER</h2>
          <span>Panel de Control Privado</span>
        </div>

        {errorMsg && <div className="login-error-alert">{errorMsg}</div>}

        <form onSubmit={handleLogin} className="login-form">
          <div className="form-group">
            <label htmlFor="email">Correo Electrónico</label>
            <input
              type="email"
              id="email"
              placeholder="admin@supermarketkosher.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
              disabled={loading}
              autoComplete="username"
            />
          </div>

          <div className="form-group">
            <label htmlFor="password">Contraseña</label>
            <input
              type="password"
              id="password"
              placeholder="••••••••"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              disabled={loading}
              autoComplete="current-password"
            />
          </div>

          <button type="submit" className="btn btn-primary login-btn" disabled={loading}>
            {loading ? 'Iniciando Sesión...' : 'Entrar al Panel'}
          </button>
        </form>

        <div className="login-footer">
          <button onClick={() => navigate('/')} className="back-to-catalog-btn">
            ← Volver al Catálogo Público
          </button>
        </div>
      </div>
    </div>
  );
}
