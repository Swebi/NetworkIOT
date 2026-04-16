import { BrowserRouter, Routes, Route } from "react-router-dom";
import { Layout } from "@/components/layout/Layout";
import { LiveDataView } from "@/components/live/LiveDataView";
import { ZonesView } from "@/components/zones/ZonesView";
import { SettingsView } from "@/components/settings/SettingsView";

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<Layout />}>
          <Route index element={<LiveDataView />} />
          <Route path="zones" element={<ZonesView />} />
          <Route path="settings" element={<SettingsView />} />
        </Route>
      </Routes>
    </BrowserRouter>
  );
}

export default App;
