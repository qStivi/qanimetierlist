import { ModeProvider } from './context/ModeContext';
import { useMode } from './context/useMode';
import { TierListProvider } from './context/TierListContext';
import { Header } from './components/Header';
import { UsernameInput } from './components/UsernameInput';
import { FilterPanel } from './components/FilterPanel';
import { TierList } from './components/TierList';
import { DataControls } from './components/DataControls';
import { HiddenCharacters } from './components/HiddenCharacters';
import './App.css';

function AppShell() {
  const { mode } = useMode();

  return (
    // key={mode} remounts the whole tier-list subtree on a mode switch, so
    // state, dnd-kit and the reducer are rebuilt from that mode's storage keys.
    <TierListProvider key={mode} mode={mode}>
      <div className="app">
        <Header />
        <main className="main">
          <UsernameInput />
          <DataControls />
          <FilterPanel />
          <HiddenCharacters />
          <TierList />
        </main>
      </div>
    </TierListProvider>
  );
}

function App() {
  return (
    <ModeProvider>
      <AppShell />
    </ModeProvider>
  );
}

export default App;
