import { useState } from "react";
import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import { useQuery, useMutation } from "./hooks/use-convex-lite";
import type { countersTable, textEntriesTable } from "convex/schema";

function App() {
  // Counter Showcase
  const {
    data: counterData,
    isLoading: isLoadingCounter,
    error: counterError,
  } = useQuery<typeof countersTable.$inferSelect>("getCounter");

  const {
    mutate: incrementCounter,
    isLoading: isIncrementing,
    error: incrementError,
  } = useMutation<typeof countersTable.$inferSelect, void>("incrementCounter");

  const handleIncrement = async () => {
    try {
      await incrementCounter();
    } catch (err) {
      console.error("Failed to increment counter:", err);
    }
  };

  // Text Storage Showcase
  const [textInput, setTextInput] = useState("");
  const {
    data: textEntriesData,
    isLoading: isLoadingTextEntries,
    error: textEntriesError,
  } = useQuery<(typeof textEntriesTable.$inferSelect)[]>("getTextEntries");

  const {
    mutate: addTextEntry,
    isLoading: isAddingText,
    error: addTextError,
  } = useMutation<typeof textEntriesTable.$inferSelect, { content: string }>(
    "addTextEntry"
  );

  const handleAddText = async () => {
    if (!textInput.trim()) return; // Prevent empty submissions
    try {
      await addTextEntry({ content: textInput });
      setTextInput(""); // Clear input after successful submission
    } catch (err) {
      console.error("Failed to add text entry:", err);
    }
  };

  return (
    <div className="container mx-auto p-4">
      <header className="text-center mb-12">
        <div className="flex justify-center items-center space-x-4 mb-4">
          <a href="https://vite.dev" target="_blank">
            <img src={viteLogo} className="logo h-20 w-20" alt="Vite logo" />
          </a>
          <a href="https://react.dev" target="_blank">
            <img
              src={reactLogo}
              className="logo react h-20 w-20"
              alt="React logo"
            />
          </a>
        </div>
        <h1 className="text-4xl font-bold text-gray-800">
          Vite + React + Convex-Lite
        </h1>
        <p className="text-lg text-gray-600 mt-2">Mini Convex Showcase</p>
      </header>

      <div className="grid md:grid-cols-2 gap-8">
        {/* Counter Showcase Card */}
        <div className="card bg-white shadow-xl rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">
            Counter Showcase
          </h2>
          {isLoadingCounter && (
            <p className="text-gray-500">Loading counter...</p>
          )}
          {counterError && (
            <p className="text-red-500">
              Error loading counter: {counterError.message}
            </p>
          )}
          {counterData && (
            <button
              onClick={handleIncrement}
              disabled={isIncrementing}
              className="btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out w-full"
            >
              Count is {counterData.value}
              {isIncrementing && " (updating...)"}
            </button>
          )}
          {incrementError && (
            <p className="text-red-500 mt-2">
              Error incrementing: {incrementError.message}
            </p>
          )}
        </div>

        {/* Text Storage Showcase Card */}
        <div className="card bg-white shadow-xl rounded-lg p-6">
          <h2 className="text-2xl font-semibold text-gray-700 mb-4">
            Text Storage Showcase
          </h2>
          <div className="mb-4">
            <input
              type="text"
              value={textInput}
              onChange={(e) => setTextInput(e.target.value)}
              placeholder="Enter some text"
              className="input input-bordered w-full p-2 border border-gray-300 rounded mb-2"
              disabled={isAddingText}
            />
            <button
              onClick={handleAddText}
              disabled={isAddingText || !textInput.trim()}
              className="btn bg-green-500 hover:bg-green-600 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out w-full"
            >
              {isAddingText ? "Saving..." : "Save Text"}
            </button>
            {addTextError && (
              <p className="text-red-500 mt-2">
                Error saving text: {addTextError.message}
              </p>
            )}
          </div>

          <h3 className="text-xl font-semibold text-gray-700 mb-3">
            Saved Texts:
          </h3>
          {isLoadingTextEntries && (
            <p className="text-gray-500">Loading texts...</p>
          )}
          {textEntriesError && (
            <p className="text-red-500">
              Error loading texts: {textEntriesError.message}
            </p>
          )}
          {textEntriesData && textEntriesData.length > 0 ? (
            <ul className="list-disc list-inside bg-gray-50 p-3 rounded max-h-60 overflow-y-auto">
              {textEntriesData.map((entry) => (
                <li key={entry._id} className="text-gray-700 mb-1 truncate">
                  {entry.content}
                  <span className="text-xs text-gray-400 ml-2">
                    ({new Date(entry._createdAt).toLocaleTimeString()})
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            !isLoadingTextEntries && (
              <p className="text-gray-500">No texts saved yet.</p>
            )
          )}
        </div>
      </div>

      <footer className="text-center mt-12 py-6 border-t border-gray-200">
        <p className="text-gray-500">
          Edit <code>src/App.tsx</code> and save to test HMR.
        </p>
        <p className="text-gray-400 text-sm mt-1">
          Click on the Vite and React logos to learn more.
        </p>
      </footer>
    </div>
  );
}

export default App;
