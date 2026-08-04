import React from 'react';

export default function ProductSearch({ query, onSearchChange }) {
  return (
    <div className="search-container">
      <span className="search-icon">🔍</span>
      <input
        type="text"
        className="search-input"
        placeholder="Buscar productos..."
        value={query}
        onChange={(e) => onSearchChange(e.target.value)}
      />
      {query && (
        <button 
          className="search-clear-btn" 
          onClick={() => onSearchChange('')}
          aria-label="Limpiar búsqueda"
        >
          ×
        </button>
      )}
    </div>
  );
}
