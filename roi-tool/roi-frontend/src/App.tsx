import { Route, Routes, Navigate } from "react-router-dom";
import Dashboard from "./pages/dashboard/Dashboard";

export default function App() {
  return (
    <div className="pt-[48px] pl-[56px] flex-1 overflow-y-auto pb-[80px]">
      <main className="w-full">
        <Routes>
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          <Route path="/dashboard" element={<Dashboard />} />
        </Routes>
      </main>
    </div>
  );
}
