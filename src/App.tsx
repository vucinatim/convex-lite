import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import { useQuery, useMutation } from "./hooks/use-convex-lite";
import { api } from "convex/_generated/api";

function App() {
  const { mutate: createCounter } = useMutation(api.counter.createCounter);

  const {
    data: counterData,
    isLoading: isLoadingCounter,
    error: counterError,
  } = useQuery(api.counter.getCounter);

  const {
    mutate: incrementCounter,
    isLoading: isIncrementing,
    error: incrementError,
  } = useMutation(api.counter.incrementCounter);

  const handleIncrement = async () => {
    try {
      await incrementCounter();
    } catch (err) {
      console.error("Failed to increment counter:", err);
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
          <button
            onClick={() => {
              createCounter();
              alert("New counter created");
            }}
            className="btn bg-blue-500 hover:bg-blue-600 text-white font-bold py-2 px-4 rounded transition duration-150 ease-in-out w-full"
          >
            Create Counter
          </button>
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
