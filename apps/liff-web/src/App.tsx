import { AppShell } from "@ai-art-platform/ui";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { AuthCallbackPage } from "./routes/AuthCallbackPage.js";
import { HomePage } from "./routes/HomePage.js";
import { MaintenancePage } from "./routes/MaintenancePage.js";

export function App() {
  return (
    <BrowserRouter>
      <AppShell title="AI Art Platform — LIFF">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="/auth/callback" element={<AuthCallbackPage />} />
          <Route path="/maintenance" element={<MaintenancePage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
