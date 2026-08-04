import React from 'react';
import logoImg from '../images/logo supermarket.webp';

export default function Hero() {
  const scrollToSection = (id) => {
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section id="home" className="hero-section">
      <div className="hero-glow"></div>
      
      {/* Animated diagonal red background lines */}
      <div className="hero-diagonal-lines">
        <div className="diagonal-line line-1"></div>
        <div className="diagonal-line line-2"></div>
        <div className="diagonal-line line-3"></div>
        <div className="diagonal-line line-4"></div>
        <div className="diagonal-line line-5"></div>
        <div className="diagonal-line line-6"></div>
      </div>

      <div className="hero-container">
        <div className="hero-content">
          <div className="hero-logo-slot">
            <div className="hero-logo-wrapper">
              <img src={logoImg} alt="Super Market Kosher" className="hero-logo-large" />
            </div>
          </div>
          <div className="hero-actions">
            <button onClick={() => scrollToSection('catalog')} className="btn btn-primary btn-large">
              Ver Productos
            </button>
            <button onClick={() => scrollToSection('contact')} className="btn btn-secondary btn-large">
              Ver Sucursal
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
