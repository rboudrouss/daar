import Filters from "@/components/Filters";
import SearchBar from "@/components/SearchBar";
import { filterBooks, type Book } from "@/utils";
import { createFileRoute } from "@tanstack/react-router";
import { useState, useTransition, useEffect, useMemo } from "react";

import DB from "../utils/db.json";
import BookCard from "@/components/BookCard";

export const Route = createFileRoute("/")({
  component: App,
});

let db: Book[] = DB;

function App() {
  const [isInteracted, setIsInteracted] = useState(false);
  const [showFilters, setShowFilters] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [, startTransition] = useTransition();

  let books = useMemo(() => filterBooks(db, searchQuery), [db, searchQuery]);

  useEffect(() => {}, []);

  function handleChange(value: string) {
    if (!isInteracted) setIsInteracted(true);
    startTransition(() => {
      setSearchQuery(value);
    });
  }

  return (
    <div>
      <SearchBar
        onChange={handleChange}
        toggleFilters={() => setShowFilters((prev) => !prev)}
      />
      <div>
        {showFilters && <Filters />}
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(300px, 1fr))",
            gap: "16px",
            padding: "16px",
            justifyItems: "center",
          }}
        >
          {books.length !== 0 ? (
            books.map((book, index) => <BookCard key={index} book={book} />)
          ) : (
            <p>No books found</p>
          )}
        </div>
      </div>
    </div>
  );
}
