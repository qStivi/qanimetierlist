import { TierListProvider } from './context/TierListContext';
import { Header } from './components/Header';
import { UsernameInput } from './components/UsernameInput';
import { FilterPanel } from './components/FilterPanel';
import { TierList } from './components/TierList';
import { DataControls } from './components/DataControls';
import { HiddenCharacters } from './components/HiddenCharacters';
import './App.css';

function App() {
  return (
    <TierListProvider>
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

export default App;
