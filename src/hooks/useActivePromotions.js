import { useState, useEffect } from 'react';
import { fetchActivePromotions } from '../services/promotionService';

export function useActivePromotions() {
  const [promotions, setPromotions] = useState([]);
  const [relations, setRelations] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    async function load() {
      setLoading(true);
      const data = await fetchActivePromotions();
      if (active) {
        setPromotions(data.promotions);
        setRelations(data.relations);
        setLoading(false);
      }
    }
    load();
    return () => {
      active = false;
    };
  }, []);

  const refresh = async () => {
    setLoading(true);
    const data = await fetchActivePromotions(true);
    setPromotions(data.promotions);
    setRelations(data.relations);
    setLoading(false);
  };

  return { promotions, relations, loading, refresh };
}
