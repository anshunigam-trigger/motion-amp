import { useState, useCallback } from "react";

import "./index.css";

import LandingPage from "./components/LandingPage";
import UploadPage from "./components/UploadPage";
import ResultsPage from "./components/ResultsPage";

export default function App() {
  const [page, setPage] = useState("landing");

  const navigate = useCallback((destination) => {
    setPage(destination);

    window.scrollTo({
      top: 0,
      behavior: "smooth",
    });
  }, []);

  if (page === "upload") {
    return (
      <UploadPage
        onNavigate={navigate}
        onAnalysisComplete={() => navigate("results")}
      />
    );
  }

  if (page === "results") {
    return <ResultsPage onNavigate={navigate} />;
  }

  return <LandingPage onNavigate={navigate} />;
}