import { AppShell } from "@ai-art-platform/ui";
import { BrowserRouter, Route, Routes } from "react-router-dom";

import { HomePage } from "./routes/HomePage.js";
import { NotFoundPage } from "./routes/NotFoundPage.js";

export function App() {
  return (
    <BrowserRouter>
      <AppShell title="AI Art Platform — Admin">
        <Routes>
          <Route path="/" element={<HomePage />} />
          <Route path="*" element={<NotFoundPage />} />
        </Routes>
      </AppShell>
    </BrowserRouter>
  );
}
