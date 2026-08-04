import React from 'react';
import { categories } from '../data/categories';

export default function Categories({ selectedCategory, onSelectCategory }) {
  
  const handleCategoryClick = (categoryId) => {
    onSelectCategory(categoryId);
    // Smooth scroll to catalog to see filtered products immediately
    const catalogElement = document.getElementById('catalog');
    if (catalogElement) {
      const headerOffset = 80;
      const elementPosition = catalogElement.getBoundingClientRect().top;
      const offsetPosition = elementPosition + window.pageYOffset - headerOffset;

      window.scrollTo({
        top: offsetPosition,
        behavior: 'smooth'
      });
    }
  };

  return (
    <section id="categories" className="categories-section">
      <div className="section-header">
        <span className="section-subtitle">Explorá por sectores</span>
        <h2 className="section-title">Nuestras Categorías</h2>
        <div className="section-divider"></div>
      </div>
      
      <div className="categories-grid">
        {/* Card for "All Products" */}
        <div 
          className={`category-card ${selectedCategory === 'all' ? 'active' : ''}`}
          onClick={() => handleCategoryClick('all')}
        >
          <div className="category-icon-wrapper">
            <span className="category-icon">🛍️</span>
          </div>
          <span className="category-name">Ver Todos</span>
        </div>

        {categories.map((cat) => (
          <div 
            key={cat.id}
            className={`category-card ${selectedCategory === cat.id ? 'active' : ''}`}
            onClick={() => handleCategoryClick(cat.id)}
          >
            <div className="category-icon-wrapper">
              <span className="category-icon">{cat.icon}</span>
            </div>
            <span className="category-name">{cat.name}</span>
          </div>
        ))}
      </div>
    </section>
  );
}
