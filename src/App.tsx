import { useState } from "react";
import type { Venue } from "./domain/types";
import { createBusanFestivalStreetPreset } from "./domain/busanPreset";
import { VenuePicker } from "./components/graph/VenuePicker";
import { VenueGraphEditor } from "./components/graph/VenueGraphEditor";
import { VenueSimulationView } from "./components/simulation/VenueSimulationView";

type ViewMode = "edit" | "3d";

function emptyVenue(): Venue {
  return {
    id: `venue-${Date.now().toString(36)}`,
    name: "새 그래프",
    region: "",
    scaleMetersPerUnit: 1,
    isSyntheticLayout: true,
    nodes: [],
    edges: [],
  };
}

function downloadJson(venue: Venue) {
  const blob = new Blob([JSON.stringify(venue, null, 2)], { type: "application/json" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = `${venue.id}.json`;
  a.click();
  URL.revokeObjectURL(url);
}

function App() {
  const [venue, setVenue] = useState<Venue | null>(null);
  const [view, setView] = useState<ViewMode>("edit");

  return (
    <div className="app-shell">
      <header className="app-header">
        <div>
          <h1>Twin World</h1>
          <p>다중밀집 사고 시뮬레이션 MVP</p>
        </div>
        {venue && (
          <nav className="view-switch">
            <button
              type="button"
              className={view === "edit" ? "toggle-button active" : "toggle-button"}
              onClick={() => setView("edit")}
            >
              그래프 편집
            </button>
            <button
              type="button"
              className={view === "3d" ? "toggle-button active" : "toggle-button"}
              onClick={() => setView("3d")}
            >
              3D 시뮬레이션
            </button>
          </nav>
        )}
      </header>
      <main className="app-main">
        {!venue && (
          <VenuePicker
            onSelectPreset={() => setVenue(createBusanFestivalStreetPreset())}
            onStartBlank={() => setVenue(emptyVenue())}
          />
        )}
        {venue && view === "edit" && (
          <VenueGraphEditor venue={venue} onChange={setVenue} onExport={() => downloadJson(venue)} />
        )}
        {venue && view === "3d" && <VenueSimulationView venue={venue} />}
      </main>
    </div>
  );
}

export default App;
