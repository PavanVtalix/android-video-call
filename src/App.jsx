import React from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import MobileCall from "./pages/MobileCall";
// import { isMobile } from "./utils/isMobile";

export default function App() {
//   if (!isMobile()) {
//     return (
//       <div style={{ padding: 20, textAlign: "center" }}>
//         This video call works only on mobile devices.
//       </div>
//     );
//   }

  return (
    <BrowserRouter>
      <Routes>
        {/* Redirect root → info page */}
        <Route
          path="/"
          element={
            <div style={{ padding: 20, textAlign: "center" }}>
              Open a valid call link to join the video call.
            </div>
          }
        />

        {/* Actual video call */}
        <Route path="/call/:roomId" element={<MobileCall />} />

        {/* Catch-all fallback */}
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </BrowserRouter>
  );
}
