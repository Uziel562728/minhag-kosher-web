import React from 'react';
import logoImg from '../images/minhag-logo-transparent.png';
import { motion } from 'motion/react';
import { business } from '../config/business';

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
      
      {/* Animated diagonal background lines */}
      <div className="hero-diagonal-lines">
        <div className="diagonal-line line-1"></div>
        <div className="diagonal-line line-2"></div>
        <div className="diagonal-line line-3"></div>
        <div className="diagonal-line line-4"></div>
        <div className="diagonal-line line-5"></div>
        <div className="diagonal-line line-6"></div>
      </div>

      <div className="hero-container">
        <motion.div 
          className="hero-content"
          initial={{ opacity: 0, y: 35 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: "easeOut" }}
        >
          <div className="hero-logo-slot">
            <motion.div 
              className="hero-logo-wrapper"
              initial={{ scale: 0.85, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, duration: 0.6, type: "spring" }}
            >
              <img src={logoImg} alt={business.name} className="hero-logo-large" />
            </motion.div>
          </div>
          
          <motion.h1 
            className="hero-title"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4, duration: 0.6 }}
          >
            <span className="highlight">{business.name}</span>
          </motion.h1>

          <motion.p 
            className="hero-subtitle"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.5, duration: 0.6 }}
          >
            {business.description}
          </motion.p>

          {business.supervision && (
            <motion.div 
              className="hero-supervision-badge"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.6, duration: 0.5 }}
              style={{
                display: 'inline-block',
                backgroundColor: 'rgba(94, 30, 170, 0.1)',
                color: 'var(--primary)',
                padding: '8px 16px',
                borderRadius: 'var(--radius-full)',
                fontWeight: '600',
                fontSize: '0.9rem',
                marginBottom: '24px',
                border: '1px solid rgba(94, 30, 170, 0.2)'
              }}
            >
              ✡️ Supervisión: {business.supervision}
            </motion.div>
          )}

          <motion.div 
            className="hero-actions"
            initial={{ opacity: 0, y: 15 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.7, duration: 0.5 }}
          >
            <button onClick={() => scrollToSection('catalog')} className="btn btn-primary btn-large">
              Ver Productos
            </button>
            <button onClick={() => scrollToSection('contact')} className="btn btn-secondary btn-large">
              Ver Sucursal
            </button>
          </motion.div>
        </motion.div>
      </div>
    </section>
  );
}
