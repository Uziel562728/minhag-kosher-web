import React from 'react';

const fallbackStyle = {
  minHeight: '100vh',
  display: 'grid',
  placeItems: 'center',
  padding: '24px',
  background: '#faf7ff',
  color: '#281638',
  textAlign: 'center',
};

const cardStyle = {
  width: 'min(460px, 100%)',
  padding: '28px',
  border: '1px solid rgba(94, 30, 170, 0.14)',
  borderRadius: '18px',
  background: '#ffffff',
  boxShadow: '0 16px 42px rgba(35, 12, 67, 0.1)',
};

export function ApplicationErrorFallback({ message }) {
  return (
    <main style={fallbackStyle} role="alert">
      <section style={cardStyle}>
        <h1 style={{ margin: '0 0 12px', color: '#5e1eaa', fontSize: '1.35rem' }}>
          Minhag Kosher
        </h1>
        <p style={{ margin: 0, lineHeight: 1.55 }}>
          {message}
        </p>
      </section>
    </main>
  );
}

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError() {
    return { hasError: true };
  }

  componentDidCatch(error, errorInfo) {
    console.error('Error inesperado al renderizar la aplicación:', error, errorInfo);
  }

  render() {
    if (this.state.hasError) {
      return <ApplicationErrorFallback message="No se pudo cargar el catálogo. Intentá nuevamente más tarde." />;
    }

    return this.props.children;
  }
}
