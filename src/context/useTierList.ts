import { useContext } from 'react';
import { TierListContext } from './tierListStore';

export function useTierList() {
  const context = useContext(TierListContext);
  if (!context) {
    throw new Error('useTierList must be used within a TierListProvider');
  }
  return context;
}
