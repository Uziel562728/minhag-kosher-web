import React from 'react';

export default function ProductFilters({
  categories,
  selectedCategory,
  onSelectCategory,
  onlyOffers,
  onToggleOffers,
  sortBy,
  onSortChange
}) {
  return (
    <div className="filters-container">
      {/* Category Filter Pills */}
      <div className="category-pills-wrapper">
        <div className="pills-label">Categorías:</div>
        <div className="category-pills">
          <button
            className={`pill-btn ${selectedCategory === 'all' ? 'active' : ''}`}
            onClick={() => onSelectCategory('all')}
          >
            📦 Todos
          </button>
          {categories.map((cat) => (
            <button
              key={cat.id}
              className={`pill-btn ${selectedCategory === cat.id ? 'active' : ''}`}
              onClick={() => onSelectCategory(cat.id)}
            >
              {cat.nombre}
            </button>
          ))}
        </div>
      </div>

      {/* Extra Filters (Offers, Sorting) */}
      <div className="extra-filters">
        <div className="offers-toggle-wrapper">
          <label className="toggle-label">
            <input
              type="checkbox"
              checked={onlyOffers}
              onChange={(e) => onToggleOffers(e.target.checked)}
              className="toggle-checkbox"
            />
            <span className="toggle-custom"></span>
            <span className="toggle-text">🔥 Solo Ofertas</span>
          </label>
        </div>

        <div className="sort-wrapper">
          <label htmlFor="sort-select" className="sort-label">Ordenar:</label>
          <select
            id="sort-select"
            className="sort-select"
            value={sortBy}
            onChange={(e) => onSortChange(e.target.value)}
          >
            <option value="default">Recomendados</option>
            <option value="price-asc">Menor Precio</option>
            <option value="price-desc">Mayor Precio</option>
            <option value="name-asc">Nombre A-Z</option>
          </select>
        </div>
      </div>
    </div>
  );
}
