import { useEffect, useState, useRef } from "react";
import { io, Socket } from "socket.io-client";
import {
  FaFootballBall,
  FaBasketballBall,
  FaTableTennis,
  FaTrophy,
  FaWifi,
  FaClock,
  FaChartBar,
  FaArrowUp,
  FaArrowDown,
} from "react-icons/fa";
import { FiWifiOff } from "react-icons/fi";
import "./App.css";

type MatchOdds = {
  id: string;
  sport: "football" | "basketball" | "tennis";
  home: string;
  away: string;
  startTime: string;
  odds: { home: number; draw?: number; away: number };
  status: "pre" | "live" | "finished";
};

// Automatically determine backend URL based on environment
const getBackendUrl = () => {
  const envVar = import.meta.env.VITE_BACKEND_WS;
  const isDev = import.meta.env.DEV;
  const hostname =
    typeof window !== "undefined" ? window.location.hostname : "";
  const isLocalhost = hostname === "localhost" || hostname === "127.0.0.1";
  const isVercel = hostname.includes("vercel.app");

  // Debug logging
  console.log("🔍 Debug info:", {
    envVar,
    isDev,
    hostname,
    isLocalhost,
    isVercel,
    mode: import.meta.env.MODE,
  });

  // If environment variable is explicitly set AND not localhost, use it
  if (envVar && envVar !== "http://localhost:4000") {
    console.log("✅ Using explicit env var:", envVar);
    return envVar;
  }

  // If running on localhost (development), use local backend
  if (isDev || isLocalhost) {
    console.log("🏠 Using localhost backend (development)");
    return "http://localhost:4000";
  }

  // Otherwise (production/Vercel), use Render backend
  console.log("🚀 Using production Render backend");
  return "https://duelbits-backend.onrender.com";
};

const BACKEND_WS = getBackendUrl();

// Log the backend URL being used
console.log("🔗 Backend URL configured:", BACKEND_WS);
console.log(
  "🌍 Environment:",
  import.meta.env.DEV ? "Development" : "Production"
);
console.log(
  "🔍 Environment variable VITE_BACKEND_WS:",
  import.meta.env.VITE_BACKEND_WS || "NOT SET (auto-detected)"
);

let socket: Socket;

type OddsChange = {
  home?: "up" | "down" | null;
  draw?: "up" | "down" | null;
  away?: "up" | "down" | null;
};

function App() {
  const [matches, setMatches] = useState<MatchOdds[]>([]);
  const previousOddsRef = useRef<Map<string, MatchOdds["odds"]>>(new Map());
  const [oddsChanges, setOddsChanges] = useState<Map<string, OddsChange>>(
    new Map()
  );
  const [sportFilter, setSportFilter] = useState<
    "all" | "football" | "basketball" | "tennis"
  >("all");
  const [isConnected, setIsConnected] = useState(false);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    console.log("🚀 Attempting to connect to:", BACKEND_WS);
    socket = io(BACKEND_WS, { transports: ["websocket"] });

    socket.on("connect", () => {
      console.log("✅ Connected to backend");
      console.log("📡 Socket ID:", socket.id);
      console.log("🌐 Connected to URL:", BACKEND_WS);
      setIsConnected(true);
    });

    socket.on("disconnect", () => {
      console.log("❌ Disconnected from backend");
      setIsConnected(false);
    });

    socket.on("connect_error", (error) => {
      console.error("❌ Connection error:", error);
      console.error("🔗 Failed to connect to:", BACKEND_WS);
    });

    socket.on("odds:update", (data: MatchOdds[]) => {
      // Mark as loaded when first data arrives
      if (isLoading) {
        setIsLoading(false);
      }

      // Calculate odds changes
      const newOddsChanges = new Map<string, OddsChange>();
      const prevOdds = previousOddsRef.current;

      data.forEach((match) => {
        const prevMatchOdds = prevOdds.get(match.id);
        const changes: OddsChange = {};

        if (prevMatchOdds) {
          // Compare home odds - use a small threshold to avoid floating point issues
          const homeDiff = match.odds.home - prevMatchOdds.home;
          if (Math.abs(homeDiff) > 0.001) {
            changes.home = homeDiff > 0 ? "up" : "down";
          }

          // Compare away odds
          const awayDiff = match.odds.away - prevMatchOdds.away;
          if (Math.abs(awayDiff) > 0.001) {
            changes.away = awayDiff > 0 ? "up" : "down";
          }

          // Compare draw odds if both exist
          if (match.odds.draw && prevMatchOdds.draw) {
            const drawDiff = match.odds.draw - prevMatchOdds.draw;
            if (Math.abs(drawDiff) > 0.001) {
              changes.draw = drawDiff > 0 ? "up" : "down";
            }
          }
        }

        if (Object.keys(changes).length > 0) {
          newOddsChanges.set(match.id, changes);
        }

        // Update previous odds in ref
        prevOdds.set(match.id, match.odds);
      });

      // Update state
      setOddsChanges(newOddsChanges);
      setMatches(data);

      // Clear changes after animation
      setTimeout(() => {
        setOddsChanges(new Map());
      }, 4000);
    });

    return () => {
      socket.disconnect();
    };
  }, []);

  const filtered =
    sportFilter === "all"
      ? matches
      : matches.filter((m) => m.sport === sportFilter);

  const getSportIcon = (sport: string) => {
    switch (sport) {
      case "football":
        return <FaFootballBall className="sport-icon" />;
      case "basketball":
        return <FaBasketballBall className="sport-icon" />;
      case "tennis":
        return <FaTableTennis className="sport-icon" />;
      default:
        return <FaTrophy className="sport-icon" />;
    }
  };

  const formatTime = (dateString: string) => {
    const date = new Date(dateString);
    const now = new Date();
    const diffMs = date.getTime() - now.getTime();
    const diffMins = Math.floor(diffMs / 60000);

    if (diffMins < 0) return "Started";
    if (diffMins < 60) return `in ${diffMins}m`;
    const hours = Math.floor(diffMins / 60);
    return `in ${hours}h`;
  };

  return (
    <div className="app">
      <header className="header">
        <div className="header-content">
          <div className="header-left">
            <img src="/Duelbits.jpeg" alt="Duelbits Logo" className="logo" />
            <div>
              <h1 className="title">Odds Dashboard</h1>
              <p className="subtitle">Real-time betting odds</p>
            </div>
          </div>
          <div className="connection-status">
            {isConnected ? (
              <FaWifi className="connection-icon connected" />
            ) : (
              <FiWifiOff className="connection-icon disconnected" />
            )}
            <span className="status-text">
              {isConnected ? "Live" : "Disconnected"}
            </span>
          </div>
        </div>
      </header>

      <main className="main-content">
        <div className="filter-section">
          <div className="filter-tabs">
            {(["all", "football", "basketball", "tennis"] as const).map(
              (sport) => (
                <button
                  key={sport}
                  className={`filter-tab ${
                    sportFilter === sport ? "active" : ""
                  }`}
                  onClick={() => setSportFilter(sport)}
                >
                  {sport === "all" ? (
                    <>
                      <FaTrophy className="sport-icon" /> All Sports
                    </>
                  ) : (
                    <>
                      {getSportIcon(sport)}{" "}
                      {sport.charAt(0).toUpperCase() + sport.slice(1)}
                    </>
                  )}
                </button>
              )
            )}
          </div>
        </div>

        <div className="matches-grid">
          {isLoading ? (
            // Skeleton loaders
            Array.from({ length: 3 }).map((_, index) => (
              <div
                key={`skeleton-${index}`}
                className="match-card skeleton-card"
              >
                <div className="skeleton-header">
                  <div className="skeleton-badge"></div>
                  <div className="skeleton-badge"></div>
                </div>

                <div className="skeleton-teams">
                  <div className="skeleton-team">
                    <div className="skeleton-text skeleton-team-name"></div>
                    <div className="skeleton-text skeleton-odds"></div>
                  </div>
                  <div className="skeleton-team">
                    <div className="skeleton-text skeleton-team-name"></div>
                    <div className="skeleton-text skeleton-odds"></div>
                  </div>
                </div>

                <div className="skeleton-footer">
                  <div className="skeleton-text skeleton-time"></div>
                  <div className="skeleton-text skeleton-date"></div>
                </div>
              </div>
            ))
          ) : filtered.length === 0 ? (
            <div className="empty-state">
              <FaChartBar className="empty-icon" />
              <p>No matches available</p>
            </div>
          ) : (
            filtered.map((m) => (
              <div key={m.id} className="match-card">
                <div className="match-header">
                  <div className="sport-badge">
                    {getSportIcon(m.sport)} {m.sport.toUpperCase()}
                  </div>
                  <div className={`status-badge status-${m.status}`}>
                    {m.status === "live" ? "● LIVE" : m.status.toUpperCase()}
                  </div>
                </div>

                <div className="match-teams">
                  <div className="team">
                    <div className="team-name">{m.home}</div>
                    <div
                      className={`team-odds ${
                        oddsChanges.get(m.id)?.home
                          ? `odds-${oddsChanges.get(m.id)?.home}`
                          : ""
                      }`}
                    >
                      {m.odds.home.toFixed(2)}
                      {oddsChanges.get(m.id)?.home === "up" && (
                        <FaArrowUp className="odds-indicator up" />
                      )}
                      {oddsChanges.get(m.id)?.home === "down" && (
                        <FaArrowDown className="odds-indicator down" />
                      )}
                    </div>
                  </div>

                  {m.odds.draw && (
                    <div className="match-draw">
                      <div className="draw-label">Draw</div>
                      <div
                        className={`draw-odds ${
                          oddsChanges.get(m.id)?.draw
                            ? `odds-${oddsChanges.get(m.id)?.draw}`
                            : ""
                        }`}
                      >
                        {m.odds.draw.toFixed(2)}
                        {oddsChanges.get(m.id)?.draw === "up" && (
                          <FaArrowUp className="odds-indicator up" />
                        )}
                        {oddsChanges.get(m.id)?.draw === "down" && (
                          <FaArrowDown className="odds-indicator down" />
                        )}
                      </div>
                    </div>
                  )}

                  <div className="team">
                    <div className="team-name">{m.away}</div>
                    <div
                      className={`team-odds ${
                        oddsChanges.get(m.id)?.away
                          ? `odds-${oddsChanges.get(m.id)?.away}`
                          : ""
                      }`}
                    >
                      {m.odds.away.toFixed(2)}
                      {oddsChanges.get(m.id)?.away === "up" && (
                        <FaArrowUp className="odds-indicator up" />
                      )}
                      {oddsChanges.get(m.id)?.away === "down" && (
                        <FaArrowDown className="odds-indicator down" />
                      )}
                    </div>
                  </div>
                </div>

                <div className="match-footer">
                  <span className="match-time">
                    <FaClock className="time-icon" />
                    {formatTime(m.startTime)}
                  </span>
                  <span className="match-date">
                    {new Date(m.startTime).toLocaleDateString()}
                  </span>
                </div>
              </div>
            ))
          )}
        </div>
      </main>

      <footer className="footer">
        <p>
          Updates every 10 seconds • {filtered.length} match
          {filtered.length !== 1 ? "es" : ""} shown
        </p>
      </footer>
    </div>
  );
}

export default App;
