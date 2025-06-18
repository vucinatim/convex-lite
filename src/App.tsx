import reactLogo from "./assets/react.svg";
import viteLogo from "/vite.svg";
import "./App.css";
import { useQuery, useMutation } from "./hooks/use-convex-lite";

interface CounterData {
  value: number;
}

function App() {
  // Query to get the current counter value
  const {
    data: counterData,
    isLoading: isLoadingCounter,
    error: counterError,
  } = useQuery<CounterData>("getCounter");

  // Mutation to increment the counter
  const {
    mutate: incrementCounter,
    isLoading: isIncrementing,
    error: incrementError,
  } = useMutation<CounterData, void>("incrementCounter"); // Assuming mutation doesn't return specific data beyond new state from query

  const handleIncrement = async () => {
    try {
      await incrementCounter();
      // No need to manually update state, useQuery should pick up the change from the server
    } catch (err) {
      console.error("Failed to increment counter:", err);
      // Error is already handled by useMutation state
    }
  };

  return (
    <>
      <div>
        <a href="https://vite.dev" target="_blank">
          <img src={viteLogo} className="logo" alt="Vite logo" />
        </a>
        <a href="https://react.dev" target="_blank">
          <img src={reactLogo} className="logo react" alt="React logo" />
        </a>
      </div>
      <h1>Vite + React + Convex-Lite</h1>
      <div className="card">
        {isLoadingCounter && <p>Loading counter...</p>}
        {counterError && (
          <p style={{ color: "red" }}>
            Error loading counter: {counterError.message}
          </p>
        )}
        {counterData && (
          <button onClick={handleIncrement} disabled={isIncrementing}>
            count is {counterData.value}
            {isIncrementing && " (updating...)"}
          </button>
        )}
        {incrementError && (
          <p style={{ color: "red" }}>
            Error incrementing: {incrementError.message}
          </p>
        )}
        <p>
          Edit <code>src/App.tsx</code> and save to test HMR
        </p>
      </div>
      <p className="read-the-docs">
        Click on the Vite and React logos to learn more
      </p>
    </>
  );
}

export default App;
