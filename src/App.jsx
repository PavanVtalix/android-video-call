import React from "react";
import { BrowserRouter, Routes, Route } from "react-router-dom";
import JoinRoom from "./pages/JoinRoom";
import MobileCall from "./pages/MobileCall";
// import { isMobile } from "./utils/isMobile";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        {/* Join page for manual room entry */}
        <Route path="/" element={<JoinRoom />} />

        {/* Video call */}
        <Route path="/call/:roomId" element={<MobileCall />} />
      </Routes>
    </BrowserRouter>
  );
}
