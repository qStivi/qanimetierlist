import { TierListProvider } from './context/TierListContext';
import { Header } from './components/Header';
import { UsernameInput } from './components/UsernameInput';
import { FilterPanel } from './components/FilterPanel';
import { TierList } from './components/TierList';
import './App.css';

function App() {
  return (
    <TierListProvider>
      <div className="app">
        <Header />
        <main className="main">
          <UsernameInput />
          <FilterPanel />
          <TierList />
        </main>
      </div>
    </TierListProvider>
  );
}

export default App;
