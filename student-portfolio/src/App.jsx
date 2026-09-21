import "./App.css";

import { Routes, Route } from "react-router-dom";
import { Suspense } from "react";

import NavBar from "./components/NavBar";
import PageLoader from "./components/PageLoader";
import { lazyWithDelay } from "./utils/lazyWithDelay";

// Route-based Code Splitting using React.lazy with delay helper
const Home = lazyWithDelay(() => import("./pages/Home"));
const Projects = lazyWithDelay(() => import("./pages/Projects"));
const Contact = lazyWithDelay(() => import("./pages/Contact"));
const NotFound = lazyWithDelay(() => import("./pages/NotFound"));

function App() {
  return (
    <div>
      <NavBar />

      <Suspense fallback={<PageLoader message="Loading page bundle..." />}>
        <Routes>
          <Route path="/" element={<Home />} />
          <Route path="/projects" element={<Projects />} />
          <Route path="/contact" element={<Contact />} />

          <Route path="*" element={<NotFound />} />
        </Routes>
      </Suspense>
    </div>
  );
}

export default App;