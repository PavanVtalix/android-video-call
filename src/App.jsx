import React from "react";
import { Routes, Route, HashRouter } from "react-router-dom";
import MobileCall from "./pages/MobileCall";
import JoinRoom from "./pages/JoinRoom";

export default function App() {
  return (
    <HashRouter>
      <Routes>
        <Route path="/" element={<JoinRoom />} />
        {/* <Route path="/call/:roomId" element={<MobileCall />} /> */}
        <Route path="/call/:appointmentId/:roomId/:socketId" element={<MobileCall />} />
      </Routes>
    </HashRouter>
  );
}
