import React, { useState, useEffect, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import logoImg from '../images/minhag-logo-original.jpg';

export default function Header() {
  const navigate = useNavigate();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [scrolled, setScrolled] = useState(false);
  const mobileMenuRef = useRef(null);
  const mobileMenuButtonRef = useRef(null);

  useEffect(() => {
    const handleScroll = () => {
      setScrolled(window.scrollY > 50);
    };

    handleScroll();
    window.addEventListener('scroll', handleScroll, { passive: true });
    return () => window.removeEventListener('scroll', handleScroll);
  }, []);

  useEffect(() => {
    if (!mobileMenuOpen) return undefined;

    const handlePointerDown = (event) => {
      const clickedInsideMenu = mobileMenuRef.current?.contains(event.target);
      const clickedMenuButton = mobileMenuButtonRef.current?.contains(event.target);

      if (!clickedInsideMenu && !clickedMenuButton) {
        setMobileMenuOpen(false);
      }
    };

    const handleEscape = (event) => {
      if (event.key === 'Escape') {
        setMobileMenuOpen(false);
        mobileMenuButtonRef.current?.focus();
      }
    };

    document.addEventListener('pointerdown', handlePointerDown);
    document.addEventListener('keydown', handleEscape);

    return () => {
      document.removeEventListener('pointerdown', handlePointerDown);
      document.removeEventListener('keydown', handleEscape);
    };
  }, [mobileMenuOpen]);

  const scrollToSection = (id) => {
    setMobileMenuOpen(false);
    const element = document.getElementById(id);
    if (element) {
      const headerOffset = 80;
      const elementPosition = element.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    } else {
      navigate(`/?section=${id}`);
    }
  };

  return (
    <header className={`header ${scrolled ? 'header-scrolled' : ''}`}>
      <div className="header-container">
        <a href="#" className="logo-container" onClick={(e) => { e.preventDefault(); scrollToSection('home'); }}>
          <img src={logoImg} alt="Minhag Kosher" className="logo-img-nav" />
        </a>

        {/* Desktop Nav */}
        <nav className="desktop-nav">
          <button onClick={() => scrollToSection('home')} className="nav-link">Inicio</button>
          <button onClick={() => scrollToSection('catalog')} className="nav-link">Productos</button>
          <button onClick={() => scrollToSection('contact')} className="nav-link">Sucursal</button>
          <button onClick={() => scrollToSection('contact')} className="nav-link">Contacto</button>
        </nav>


        {/* Mobile Hamburger Toggle */}
        <button 
          ref={mobileMenuButtonRef}
          className={`hamburger-toggle ${mobileMenuOpen ? 'open' : ''}`} 
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          aria-label={mobileMenuOpen ? 'Cerrar menú' : 'Abrir menú'}
          aria-expanded={mobileMenuOpen}
          aria-controls="mobile-navigation-menu"
        >
          <span></span>
          <span></span>
          <span></span>
        </button>
      </div>

      {/* Mobile Menu Backdrop & Overlay */}
      <div className={`mobile-menu-overlay ${mobileMenuOpen ? 'active' : ''}`} onClick={() => setMobileMenuOpen(false)}></div>
      <nav
        id="mobile-navigation-menu"
        ref={mobileMenuRef}
        className={`mobile-menu ${mobileMenuOpen ? 'open' : ''}`}
      >
        <div className="mobile-menu-links">
          <button onClick={() => scrollToSection('home')} className="mobile-nav-link">Inicio</button>
          <button onClick={() => scrollToSection('catalog')} className="mobile-nav-link">Productos</button>
          <button onClick={() => scrollToSection('contact')} className="mobile-nav-link">Sucursal</button>
          <button onClick={() => scrollToSection('contact')} className="mobile-nav-link">Contacto</button>
        </div>
      </nav>
    </header>
  );
}
