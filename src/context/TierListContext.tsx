import { useReducer, type ReactNode } from 'react';
import { TierListContext, tierListReducer, initTierListState } from './tierListStore';

export function TierListProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(tierListReducer, undefined, initTierListState);

  return <TierListContext.Provider value={{ state, dispatch }}>{children}</TierListContext.Provider>;
}
