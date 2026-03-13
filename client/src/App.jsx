import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { LiveDataView } from "@/components/live/LiveDataView";
import { HistoricalView } from "@/components/historical/HistoricalView";
import { PredictionsView } from "@/components/predictions/PredictionsView";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LiveDataView />} />
          <Route path="historical" element={<HistoricalView />} />
          <Route path="predictions" element={<PredictionsView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
