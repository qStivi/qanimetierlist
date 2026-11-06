import { useContext } from 'react';
import { ModeContext } from './modeContext';

export function useMode() {
  const context = useContext(ModeContext);
  if (!context) {
    throw new Error('useMode must be used within a ModeProvider');
  }
  return context;
}
