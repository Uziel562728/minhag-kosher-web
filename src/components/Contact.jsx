import React from 'react';
import { contactConfig, getWhatsAppLink } from '../data/contactConfig';
import { branches, isKosherClosedForShabat } from '../data/branches';
import BranchMap from './BranchMap';

const WhatsAppIcon = () => (
  <svg 
    viewBox="0 0 448 512" 
    fill="currentColor"
    style={{ width: '1.2em', height: '1.2em', display: 'inline-block', verticalAlign: 'middle' }}
  >
    <path d="M380.9 97.1C339 55.1 283.2 32 223.9 32c-122.4 0-222 99.6-222 222 0 39.1 10.2 77.3 29.6 111L3 480l117.7-30.9c32.4 17.7 68.9 27 106.1 27h.1c122.3 0 224.1-99.6 224.1-222 0-59.3-25.2-115-67.1-157zm-157 341.6c-33.2 0-65.7-8.9-94-25.7l-6.7-4-69.8 18.3L72 359.2l-4.4-7c-18.5-29.4-28.2-63.3-28.2-98.2 0-101.7 82.8-184.5 184.6-184.5 49.3 0 95.6 19.2 130.4 54.1 34.8 34.9 56.2 81.2 56.1 130.5 0 101.8-84.9 184.6-186.6 184.6zm101.2-138.2c-5.5-2.8-32.8-16.2-37.9-18-5.1-1.9-8.8-2.8-12.5 2.8-3.7 5.6-14.3 18-17.6 21.8-3.2 3.7-6.5 4.2-12 1.4-32.6-16.3-54-29.1-75.5-66-5.7-9.8 5.7-9.1 16.3-30.3 1.8-3.7 .9-6.9-.5-9.7-1.4-2.8-12.5-30.1-17.1-41.2-4.5-10.8-9.1-9.3-12.5-9.5-3.2-.2-6.9-.2-10.6-.2-3.7 0-9.7 1.4-14.8 6.9-5.1 5.6-19.4 19-19.4 46.3 0 27.3 19.9 53.7 22.6 57.4 2.8 3.7 39.1 59.7 94.8 83.8 35.2 15.2 49 16.5 66.6 13.9 10.7-1.6 32.8-13.4 37.4-26.4 4.6-13 4.6-24.1 3.2-26.4-1.3-2.5-5-3.9-10.5-6.6z"/>
  </svg>
);

export default function Contact() {
  const defaultWhatsApp = contactConfig.whatsAppNumbers.find(w => w.isDefault) || contactConfig.whatsAppNumbers[0];
  const whatsappUrl = getWhatsAppLink(defaultWhatsApp.numberApi, defaultWhatsApp.defaultMessage);
  const isShabat = isKosherClosedForShabat();
  const singleBranch = branches[0];

  return (
    <section id="contact" className="contact-section">
      <div className="section-header">
        <span className="section-subtitle">Ubicación, horarios y atención directa</span>
        <h2 className="section-title">Sucursal y Contacto</h2>
        <div className="section-divider"></div>
      </div>

      <div className="contact-container">
        {/* Left Column: Interactive Map & Address */}
        <div className="contact-info-card" id="branches">
          <h3 style={{ fontSize: '1.4rem', fontWeight: '700', marginBottom: '16px', color: 'var(--text-title)' }}>
            Nuestra Ubicación
          </h3>
          
          <div className="contact-map-wrapper" style={{ height: '320px', borderRadius: 'var(--radius-md)', overflow: 'hidden', border: '1px solid var(--border)', marginBottom: '20px' }}>
            <BranchMap activeBranchId={singleBranch.id} />
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
            <div style={{ display: 'flex', alignItems: 'flex-start', gap: '10px' }}>
              <span style={{ fontSize: '1.2rem', marginTop: '2px' }}>📍</span>
              <div>
                <strong style={{ fontSize: '1.05rem', color: 'var(--text-title)' }}>{singleBranch.nombre}</strong>
                <p style={{ margin: '4px 0 0 0', color: 'var(--text-muted)' }}>{singleBranch.direccion}</p>
              </div>
            </div>

            <div style={{ marginTop: '8px' }}>
              <a 
                href={singleBranch.googleMapsUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn btn-secondary btn-small"
                style={{ display: 'inline-flex', alignItems: 'center', gap: '8px' }}
              >
                🗺️ Ver en Google Maps
              </a>
            </div>
          </div>
        </div>

        {/* Right Column: Contact info & Hours */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
          
          {/* Vías de Contacto */}
          <div className="contact-info-card" style={{ padding: '30px' }}>
            <h3 style={{ fontSize: '1.3rem', fontWeight: '700', marginBottom: '20px', color: 'var(--text-title)' }}>
              Canales de Venta y Consultas
            </h3>

            <div className="contact-methods" style={{ marginBottom: '24px', gap: '16px' }}>
              {/* WhatsApp Method */}
              <div className="contact-method-item">
                <span className="method-icon ws-color" style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>
                  <WhatsAppIcon />
                </span>
                <div className="method-details">
                  <strong>WhatsApp Ventas / Consultas</strong>
                  <a href={whatsappUrl} target="_blank" rel="noopener noreferrer" className="method-link">
                    {defaultWhatsApp.numberDisplay}
                  </a>
                </div>
              </div>

              {/* Instagram Methods */}
              {contactConfig.socialMedia.instagrams && contactConfig.socialMedia.instagrams.map((ig) => (
                <div key={ig.id} className="contact-method-item">
                  <span className="method-icon ig-color">📸</span>
                  <div className="method-details">
                    <strong>Instagram {ig.label}</strong>
                    <a 
                      href={ig.url} 
                      target="_blank" 
                      rel="noopener noreferrer" 
                      className="method-link ig-link"
                    >
                      Ver perfil
                    </a>
                  </div>
                </div>
              ))}
            </div>

            <div className="contact-cta-wrapper">
              <a 
                href={whatsappUrl} 
                target="_blank" 
                rel="noopener noreferrer" 
                className="btn btn-whatsapp btn-large"
                style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', gap: '8px' }}
              >
                <WhatsAppIcon /> Enviar Mensaje de WhatsApp
              </a>
            </div>
          </div>

          {/* Horarios de Atención Card */}
          <div className="contact-hours-card" style={{ padding: '30px', flex: '1' }}>
            <h3 style={{ margin: '0 0 16px 0', fontSize: '1.3rem' }}>Horarios de Atención</h3>
            <div className="hours-list" style={{ display: 'flex', flexDirection: 'column', gap: '10px' }}>
              <div className="hours-item" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                <span>Lunes a Jueves:</span>
                <strong>08:00 a 19:30 hs</strong>
              </div>
              <div className={`hours-item ${isShabat ? 'active-shabat-hours' : ''}`} style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                <span>Viernes:</span>
                {isShabat ? (
                  <strong className="shabat-highlight">⚠️ 08:00 a 16:00 hs (Cerrado por Shabat)</strong>
                ) : (
                  <strong>08:00 a 16:00 hs</strong>
                )}
              </div>
              <div className="hours-item" style={{ display: 'flex', justifyContent: 'space-between', borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '8px' }}>
                <span>Sábados:</span>
                <strong className={isShabat ? 'shabat-highlight' : ''}>Cerrado por Shabat</strong>
              </div>
              <div className="hours-item" style={{ display: 'flex', justifyContent: 'space-between', paddingBottom: '4px' }}>
                <span>Domingos:</span>
                <strong>08:30 a 14:00 hs</strong>
              </div>
            </div>
            <div className="contact-promo-footer" style={{ marginTop: '16px', fontSize: '0.9rem', opacity: '0.9' }}>
              🏪 ¡Te esperamos en Flores!
            </div>
          </div>

        </div>
      </div>
    </section>
  );
}
