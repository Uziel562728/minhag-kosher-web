import { useEffect, useRef } from 'react';
import { preloadProduct } from './productCache';

// Singleton IntersectionObserver for high performance across all product cards
let sharedObserver = null;
const observedElements = new Map(); // element -> { product, categories }

function getSharedObserver() {
  if (typeof window === 'undefined' || !('IntersectionObserver' in window)) {
    return null;
  }

  if (!sharedObserver) {
    // rootMargin between 300px and 500px (400px top/bottom) for proactive preloading
    sharedObserver = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            const data = observedElements.get(entry.target);
            if (data) {
              const { product, categories } = data;
              // Preload product data + primary and secondary images
              preloadProduct(product, { categories });
              // Unobserve to avoid redundant work
              sharedObserver.unobserve(entry.target);
              observedElements.delete(entry.target);
            }
          }
        });
      },
      {
        root: null,
        rootMargin: '400px 0px', // Proactively preloads cards 400px before appearing
        threshold: 0.01
      }
    );
  }

  return sharedObserver;
}

/**
 * Custom React hook to register a product card with the shared IntersectionObserver
 * and handle mouseenter / touchstart / pointerdown preloading.
 */
export function useProductCardPreload(product, categories) {
  const cardRef = useRef(null);

  useEffect(() => {
    const el = cardRef.current;
    if (!el || !product) return;

    const observer = getSharedObserver();
    if (observer) {
      observedElements.set(el, { product, categories });
      observer.observe(el);
    } else {
      // Fallback if IntersectionObserver is unavailable
      preloadProduct(product, { categories });
    }

    return () => {
      if (observer && el) {
        observer.unobserve(el);
        observedElements.delete(el);
      }
    };
  }, [product, categories]);

  // High-priority trigger for desktop hover
  const handleMouseEnter = () => {
    if (product) {
      preloadProduct(product, { categories });
    }
  };

  // High-priority trigger for mobile touch / pointer interaction before navigation completes
  const handlePointerDown = () => {
    if (product) {
      preloadProduct(product, { categories });
    }
  };

  return {
    cardRef,
    handleMouseEnter,
    handlePointerDown
  };
}
