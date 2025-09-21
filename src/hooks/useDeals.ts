import {useCallback, useEffect, useState} from 'react';
import {api} from '../services/api';

export type Deal = {
  id: string;
  title: string;
  description: string;
};

type FetchOptions = {
  skipInitialLoading?: boolean;
};

export const useDeals = () => {
  const [deals, setDeals] = useState<Deal[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const fetchDeals = useCallback(async (options?: FetchOptions) => {
    if (!options?.skipInitialLoading) {
      setLoading(true);
    }
    try {
      const response = await api.get<Deal[]>('/deals');
      setDeals(response.data);
    } catch (error) {
      setDeals([
        {
          id: '1',
          title: 'Welcome Offer',
          description: 'Get 20% off your first purchase with DealMaster.',
        },
        {
          id: '2',
          title: 'Loyalty Bonus',
          description: 'Earn double loyalty points on electronics this weekend only.',
        },
      ]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  const refresh = useCallback(() => {
    setRefreshing(true);
    fetchDeals({skipInitialLoading: true});
  }, [fetchDeals]);

  useEffect(() => {
    fetchDeals();
  }, [fetchDeals]);

  return {deals, loading, refreshing, refresh};
};
