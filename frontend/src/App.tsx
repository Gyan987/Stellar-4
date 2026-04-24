import { BrowserRouter, Route, Routes } from "react-router-dom";
import SubmissionMvp from "./pages/SubmissionMvp";
import NotFound from "./pages/NotFound";

const App = () => {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/" element={<SubmissionMvp />} />
        <Route path="*" element={<NotFound />} />
      </Routes>
    </BrowserRouter>
  );
};

export default App;