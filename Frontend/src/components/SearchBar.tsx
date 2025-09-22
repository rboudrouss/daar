export default function SearchBar({
  defaultValue,
  onChange,
}: {
  defaultValue?: string;
  onChange?: (value: string) => void;
  toggleFilters?: () => void;
}) {
  return (
    <input
      type="text"
      placeholder="Search..."
      defaultValue={defaultValue}
      onChange={(e) => onChange?.(e.target.value)}
      style={{
        padding: "8px",
        fontSize: "16px",
        width: "100%",
        boxSizing: "border-box",
        marginBottom: "16px",
      }}
    />
  );
}
