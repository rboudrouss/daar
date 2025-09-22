import Filters from "@/components/Filters";
import SearchBar from "@/components/SearchBar";
import { createFileRoute } from "@tanstack/react-router";
import React, { useState, useTransition, useEffect } from "react";

export const Route = createFileRoute()({
  component: App,
});

let db = [];

function App() {
  const [isInteracted, setIsInteracted] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");

  useEffect(() => {
    
  });


  function handleChange(value: string) {
    if (!isInteracted) setIsInteracted(true);
    setSearchQuery(value);
  }

  return (
    <div>
      <SearchBar
        onChange={handleChange}
        toggleFilters={() => setShowFilters((prev) => !prev)}
      />
      <div>
        {showFilters && <Filters />}
        <div></div>
      </div>
    </div>
  );
}
