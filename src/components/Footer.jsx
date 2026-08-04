import React from 'react';
import { contactConfig, getWhatsAppLink } from '../data/contactConfig';
import logoImg from '../images/logo supermarket.webp';

const WhatsAppIcon = () => (
  <svg 
    viewBox="0 0 448 512" 
    fill="currentColor"
    style={{ width: '1.2em', height: '1.2em', display: 'inline-block', verticalAlign: 'middle', marginRight: '6px' }}
  >
    <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L3 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
  </svg>
);

export default function Footer() {
  const defaultWhatsApp = contactConfig.whatsAppNumbers.find(w => w.isDefault) || contactConfig.whatsAppNumbers[0];
  const whatsappUrl = getWhatsAppLink(defaultWhatsApp.numberApi, defaultWhatsApp.defaultMessage);

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
    <footer className="footer">
      <div className="footer-container">
        {/* Brand Info */}
        <div className="footer-brand">
          <div className="footer-logo">
            <img src={logoImg} alt="Super Market Kosher" className="logo-img-footer" />
          </div>
          <p className="footer-tagline">
            Tu supermercado de confianza en la Ciudad Autónoma de Buenos Aires. Variedad, calidad y las mejores ofertas cerca tuyo.
          </p>

        </div>

        {/* Quick Links */}
        <div className="footer-links-group">
          <h4>Enlaces Rápidos</h4>
          <ul>
            <li><button onClick={() => scrollToSection('home')} className="footer-link">Inicio</button></li>
            <li><button onClick={() => scrollToSection('catalog')} className="footer-link">Catálogo de Productos</button></li>
            <li><button onClick={() => scrollToSection('contact')} className="footer-link">Nuestra Sucursal</button></li>
            <li><button onClick={() => scrollToSection('contact')} className="footer-link">Contacto</button></li>
          </ul>
        </div>

        {/* Support & Legal */}
        <div className="footer-links-group">
          <h4>Contacto</h4>
          <ul>
            <li>
              <a 
                href={whatsappUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="footer-link ws-footer-link"
                style={{ display: 'inline-flex', alignItems: 'center' }}
              >
                <WhatsAppIcon /> WhatsApp Ventas
              </a>
            </li>
            {contactConfig.socialMedia.instagrams && contactConfig.socialMedia.instagrams.map((ig) => (
              <li key={ig.id}>
                <a href={ig.url} target="_blank" rel="noopener noreferrer" className="footer-link ig-footer-link">
                  📸 Instagram {ig.label}
                </a>
              </li>
            ))}
            <li className="footer-text-muted">📍 Sucursal en Flores, CABA</li>
          </ul>
        </div>
      </div>

      <div className="footer-bottom">
        <p>&copy; {new Date().getFullYear()} Super Market Kosher. Todos los derechos reservados.</p>
      </div>
    </footer>
  );
}
