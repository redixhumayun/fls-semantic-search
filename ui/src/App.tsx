import { BrowserRouter, Routes, Route } from 'react-router-dom'
import { IndexProvider } from './context/IndexContext'
import Layout from './components/layout/Layout'
import Dashboard from './pages/Dashboard'
import SearchResults from './pages/SearchResults'
import ExperimentDetail from './pages/ExperimentDetail'

export default function App() {
  return (
    <IndexProvider>
      <BrowserRouter>
        <Routes>
          <Route element={<Layout />}>
            <Route index element={<Dashboard />} />
            <Route path="search" element={<SearchResults />} />
            <Route path="experiment/*" element={<ExperimentDetail />} />
            <Route path="experiments" element={<SearchResults />} />
            <Route path="settings" element={<div className="p-10 text-slate-400">Settings coming soon</div>} />
          </Route>
        </Routes>
      </BrowserRouter>
    </IndexProvider>
  )
}
