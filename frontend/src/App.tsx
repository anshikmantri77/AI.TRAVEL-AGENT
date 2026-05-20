import { Routes, Route, Navigate } from "react-router-dom";
import PlanPage from "./pages/PlanPage";
import ReviewPage from "./pages/ReviewPage";
import FinalPage from "./pages/FinalPage";

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Navigate to="/plan" replace />} />
      <Route path="/plan" element={<PlanPage />} />
      <Route path="/plan/:id/review" element={<ReviewPage />} />
      <Route path="/plan/:id/final" element={<FinalPage />} />
    </Routes>
  );
}
