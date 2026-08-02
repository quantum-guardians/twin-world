import { useState } from "react";
import type { Venue } from "./domain/types";
import { createBusanFestivalStreetPreset } from "./domain/busanPreset";
import { VenuePicker } from "./components/graph/VenuePicker";
import { VenueGraphEditor } from "./components/graph/VenueGraphEditor";

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

  return (
    <div className="app-shell">
      <header className="app-header">
        <h1>Twin World</h1>
        <p>다중밀집 사고 시뮬레이션 MVP</p>
      </header>
      <main className="app-main">
        {!venue && (
          <VenuePicker
            onSelectPreset={() => setVenue(createBusanFestivalStreetPreset())}
            onStartBlank={() => setVenue(emptyVenue())}
          />
        )}
        {venue && (
          <VenueGraphEditor venue={venue} onChange={setVenue} onExport={() => downloadJson(venue)} />
        )}
      </main>
    </div>
  );
}

export default App;
