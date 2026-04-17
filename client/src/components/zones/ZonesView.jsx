import { useState, useEffect, useRef, useCallback } from "react";
import {
  MapContainer,
  TileLayer,
  useMap,
  useMapEvents,
  Polygon,
  Tooltip,
} from "react-leaflet";
import L from "leaflet";
import "@geoman-io/leaflet-geoman-free";
import "@geoman-io/leaflet-geoman-free/dist/leaflet-geoman.css";
import "leaflet/dist/leaflet.css";
import "./zones.css";
import { Search, Settings2, Trash2, Check, MapPin, Bell, Pencil, X } from "lucide-react";
import {
  getZones,
  saveMapConfig,
  createZone,
  updateZone,
  deleteZone,
  getLiveData,
} from "../../data/api";

// Fix Leaflet default icon paths broken by Vite's asset hashing
delete L.Icon.Default.prototype._getIconUrl;
L.Icon.Default.mergeOptions({
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  iconRetinaUrl:
    "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

const ZONE_COLORS = [
  "#3b82f6",
  "#06b6d4",
  "#8b5cf6",
  "#22c55e",
  "#ef4444",
  "#f97316",
  "#eab308",
  "#ec4899",
];

const DEFAULT_CENTER = [51.505, -0.09];
const DEFAULT_ZOOM = 13;

// ── Enable / disable map interaction ───────────────────────────────────────
function MapInteractivity({ interactive }) {
  const map = useMap();
  useEffect(() => {
    if (interactive) {
      map.dragging.enable();
      map.scrollWheelZoom.enable();
      map.doubleClickZoom.enable();
      map.touchZoom.enable();
    } else {
      map.dragging.disable();
      map.scrollWheelZoom.disable();
      map.doubleClickZoom.disable();
      map.touchZoom.disable();
    }
  }, [interactive, map]);
  return null;
}

// ── Fly to a location programmatically ─────────────────────────────────────
function MapController({ target, onMoveEnd }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.setView(target.center, target.zoom, { animate: true });
  }, [target, map]);
  useMapEvents({
    moveend: () => {
      const c = map.getCenter();
      onMoveEnd([c.lat, c.lng], map.getZoom());
    },
  });
  return null;
}

// ── Geoman drawing controls ─────────────────────────────────────────────────
function GeomanControls({ enabled, onCreated }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled) {
      try {
        map.pm.removeControls();
      } catch {}
      return;
    }
    map.pm.addControls({
      position: "topleft",
      drawCircle: false,
      drawCircleMarker: false,
      drawPolyline: false,
      drawMarker: false,
      drawText: false,
      drawPolygon: false,
      rotateMode: false,
      cutPolygon: false,
    });
    const handler = ({ layer }) => {
      const raw = layer.getLatLngs?.();
      if (raw) {
        const flat = Array.isArray(raw[0]) ? raw[0] : raw;
        onCreated(flat.map((ll) => [ll.lat, ll.lng]));
      }
      map.removeLayer(layer);
    };
    map.on("pm:create", handler);
    return () => {
      map.off("pm:create", handler);
      try {
        map.pm.removeControls();
      } catch {}
    };
  }, [map, enabled, onCreated]);
  return null;
}

// ── Main view ───────────────────────────────────────────────────────────────
export function ZonesView() {
  // null | 'map-setup' | 'draw-zones'
  const [step, setStep] = useState(null);
  const [mapConfig, setMapConfig] = useState(null);
  const [zones, setZones] = useState([]);
  const [loading, setLoading] = useState(true);
  const [zoneOccupancy, setZoneOccupancy] = useState({});

  const [currentCenter, setCurrentCenter] = useState(DEFAULT_CENTER);
  const [currentZoom, setCurrentZoom] = useState(DEFAULT_ZOOM);
  const [targetView, setTargetView] = useState(null);

  const [searchQuery, setSearchQuery] = useState("");
  const [searchResults, setSearchResults] = useState([]);
  const [searching, setSearching] = useState(false);
  const searchTimer = useRef(null);

  const [pendingCoords, setPendingCoords] = useState(null);
  const [zoneName, setZoneName] = useState("");
  const [zoneScannerId, setZoneScannerId] = useState("pi");
  const [zoneThreshold, setZoneThreshold] = useState("");
  const zoneNameRef = useRef(null);

  // Inline edit state: { id, threshold, scanner_id }
  const [editingZone, setEditingZone] = useState(null);

  const startEdit = (z) => {
    setEditingZone({
      id: z.id,
      threshold: z.threshold != null ? String(z.threshold) : "",
      scanner_id: z.scanner_id ?? "pi",
    });
  };

  const saveEdit = async () => {
    if (!editingZone) return;
    const threshold =
      editingZone.threshold !== "" ? parseInt(editingZone.threshold, 10) : null;
    const updated = await updateZone(editingZone.id, {
      threshold: isNaN(threshold) ? null : threshold,
      scanner_id: editingZone.scanner_id.trim() || "pi",
    });
    setZones((prev) => prev.map((z) => (z.id === updated.id ? updated : z)));
    setEditingZone(null);
  };

  useEffect(() => {
    getZones()
      .then((data) => {
        setMapConfig(data.config ?? null);
        setZones(data.zones ?? []);
        if (data.config) {
          const c = [data.config.lat, data.config.lng];
          setCurrentCenter(c);
          setCurrentZoom(data.config.zoom);
          setTargetView({ center: c, zoom: data.config.zoom });
        }
      })
      .catch(() => {})
      .finally(() => setLoading(false));
  }, []);

  // Poll live data for per-zone occupancy
  useEffect(() => {
    const fetchOccupancy = () => {
      getLiveData()
        .then((d) => setZoneOccupancy(d.zone_occupancy ?? {}))
        .catch(() => {});
    };
    fetchOccupancy();
    const id = setInterval(fetchOccupancy, 7000);
    return () => clearInterval(id);
  }, []);

  useEffect(() => {
    if (pendingCoords) {
      setTimeout(() => zoneNameRef.current?.focus(), 50);
    }
  }, [pendingCoords]);

  const handleSearch = useCallback((q) => {
    setSearchQuery(q);
    clearTimeout(searchTimer.current);
    if (!q.trim()) {
      setSearchResults([]);
      return;
    }
    searchTimer.current = setTimeout(async () => {
      setSearching(true);
      try {
        const res = await fetch(
          `https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(q)}&limit=5`,
          { headers: { "Accept-Language": "en" } }
        );
        setSearchResults(await res.json());
      } catch {
        setSearchResults([]);
      } finally {
        setSearching(false);
      }
    }, 400);
  }, []);

  const pickResult = (r) => {
    const c = [parseFloat(r.lat), parseFloat(r.lon)];
    setTargetView({ center: c, zoom: 15 });
    setCurrentCenter(c);
    setCurrentZoom(15);
    setSearchResults([]);
    setSearchQuery(r.display_name.split(",")[0]);
  };

  const confirmMapView = async () => {
    const cfg = {
      lat: currentCenter[0],
      lng: currentCenter[1],
      zoom: currentZoom,
    };
    await saveMapConfig(cfg);
    setMapConfig(cfg);
    setStep("draw-zones");
  };

  const handleZoneCreated = useCallback((coords) => {
    setPendingCoords(coords);
    setZoneName("");
    setZoneScannerId("pi");
    setZoneThreshold("");
  }, []);

  const saveZone = async () => {
    if (!zoneName.trim() || !pendingCoords) return;
    const color = ZONE_COLORS[zones.length % ZONE_COLORS.length];
    const threshold = zoneThreshold !== "" ? parseInt(zoneThreshold, 10) : null;
    const zone = await createZone({
      name: zoneName.trim(),
      color,
      coordinates: pendingCoords,
      scanner_id: zoneScannerId.trim() || "pi",
      threshold: isNaN(threshold) ? null : threshold,
    });
    setZones((prev) => [...prev, zone]);
    setPendingCoords(null);
    setZoneName("");
    setZoneScannerId("pi");
    setZoneThreshold("");
  };

  const removeZone = async (id) => {
    await deleteZone(id);
    setZones((prev) => prev.filter((z) => z.id !== id));
  };

  const enterConfigure = () => {
    setStep("map-setup");
    if (mapConfig) {
      setTargetView({
        center: [mapConfig.lat, mapConfig.lng],
        zoom: mapConfig.zoom,
      });
    }
  };

  const initialCenter = mapConfig
    ? [mapConfig.lat, mapConfig.lng]
    : DEFAULT_CENTER;
  const initialZoom = mapConfig ? mapConfig.zoom : DEFAULT_ZOOM;
  const interactive = step === "map-setup" || step === "draw-zones";

  if (loading) {
    return (
      <div className="flex h-64 items-center justify-center text-sm text-muted-foreground">
        Loading…
      </div>
    );
  }

  return (
    <div className="flex flex-col" style={{ height: "calc(100vh - 80px)" }}>
      {/* ── Header ── */}
      <div className="flex items-center justify-between pb-4 shrink-0">
        <div>
          <h1 className="font-display text-3xl font-semibold text-foreground">
            Zones
          </h1>
          <p className="mt-1 text-sm text-muted-foreground">
            Group devices by physical area and monitor per-zone occupancy.
          </p>
        </div>
        {step === null && (
          <button
            onClick={enterConfigure}
            className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
          >
            <Settings2 size={15} />
            Configure
          </button>
        )}
        {step === "map-setup" && (
          <p className="text-sm text-muted-foreground">
            Step 1 of 2 — Set map location
          </p>
        )}
        {step === "draw-zones" && (
          <p className="text-sm text-muted-foreground">
            Step 2 of 2 — Draw zones
          </p>
        )}
      </div>

      {/* ── Body ── */}
      <div className="flex flex-1 gap-4 min-h-0">
        {/* Zone list */}
        <div className="w-56 shrink-0 flex flex-col gap-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Zones ({zones.length})
          </p>

          {zones.length === 0 ? (
            <div className="rounded-lg border border-dashed border-border p-4 text-center text-xs text-muted-foreground leading-relaxed">
              {step === "draw-zones"
                ? "Draw a shape on the map to create a zone"
                : "No zones configured yet"}
            </div>
          ) : (
            <div className="flex flex-col gap-2 overflow-y-auto">
              {zones.map((z) => {
                const count = zoneOccupancy[z.id] ?? null;
                const threshold = z.threshold ?? null;
                const overThreshold = threshold !== null && count !== null && count > threshold;
                const isEditing = editingZone?.id === z.id;
                return (
                  <div
                    key={z.id}
                    className={`flex flex-col gap-1.5 rounded-lg border bg-card px-3 py-2.5 ${
                      overThreshold ? "border-red-500/60" : "border-border"
                    }`}
                  >
                    <div className="flex items-center gap-2.5">
                      <span
                        className="h-2.5 w-2.5 rounded-full shrink-0"
                        style={{ backgroundColor: z.color }}
                      />
                      <span className="flex-1 truncate text-sm text-foreground">
                        {z.name}
                      </span>
                      {overThreshold && !isEditing && (
                        <Bell size={12} className="text-red-400 shrink-0" />
                      )}
                      {!isEditing && (
                        <button
                          onClick={() => startEdit(z)}
                          className="text-muted-foreground hover:text-foreground transition-colors shrink-0"
                        >
                          <Pencil size={12} />
                        </button>
                      )}
                      {step === "draw-zones" && !isEditing && (
                        <button
                          onClick={() => removeZone(z.id)}
                          className="text-muted-foreground hover:text-red-400 transition-colors shrink-0"
                        >
                          <Trash2 size={13} />
                        </button>
                      )}
                    </div>

                    {isEditing ? (
                      <div className="flex flex-col gap-2 pt-1">
                        <div>
                          <label className="mb-0.5 block text-xs text-muted-foreground">Threshold</label>
                          <input
                            type="number"
                            min={1}
                            autoFocus
                            value={editingZone.threshold}
                            onChange={(e) =>
                              setEditingZone((prev) => ({ ...prev, threshold: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") setEditingZone(null);
                            }}
                            placeholder="e.g. 10"
                            className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div>
                          <label className="mb-0.5 block text-xs text-muted-foreground">Scanner ID</label>
                          <input
                            type="text"
                            value={editingZone.scanner_id}
                            onChange={(e) =>
                              setEditingZone((prev) => ({ ...prev, scanner_id: e.target.value }))
                            }
                            onKeyDown={(e) => {
                              if (e.key === "Enter") saveEdit();
                              if (e.key === "Escape") setEditingZone(null);
                            }}
                            placeholder="pi"
                            className="w-full rounded border border-border bg-background px-2 py-1 text-xs text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                          />
                        </div>
                        <div className="flex gap-1.5">
                          <button
                            onClick={saveEdit}
                            className="flex-1 rounded bg-primary py-1 text-xs font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
                          >
                            Save
                          </button>
                          <button
                            onClick={() => setEditingZone(null)}
                            className="rounded border border-border px-2 py-1 text-muted-foreground hover:text-foreground transition-colors"
                          >
                            <X size={11} />
                          </button>
                        </div>
                      </div>
                    ) : (
                      <>
                        {(count !== null || threshold !== null) && (
                          <div className="flex items-center justify-between text-xs text-muted-foreground pl-5">
                            <span>{count !== null ? count : "—"} active</span>
                            {threshold !== null && (
                              <span className={overThreshold ? "text-red-400 font-medium" : ""}>
                                limit {threshold}
                              </span>
                            )}
                          </div>
                        )}
                        {z.scanner_id && z.scanner_id !== "pi" && (
                          <p className="text-xs text-muted-foreground/60 pl-5 truncate">
                            {z.scanner_id}
                          </p>
                        )}
                      </>
                    )}
                  </div>
                );
              })}
            </div>
          )}

          {step === "draw-zones" && (
            <button
              onClick={() => setStep(null)}
              className="mt-auto flex items-center justify-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
            >
              <Check size={15} />
              Done
            </button>
          )}
        </div>

        {/* ── Map ── */}
        <div className="relative flex-1 rounded-xl overflow-hidden border border-border">
          {/* Step 1: location search overlay */}
          {step === "map-setup" && (
            <div className="absolute top-4 left-1/2 -translate-x-1/2 z-1000 w-[400px] flex flex-col gap-2">
              <div className="relative">
                <Search
                  size={15}
                  className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground pointer-events-none"
                />
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => handleSearch(e.target.value)}
                  placeholder="Search a location…"
                  className="w-full rounded-lg border border-border bg-card/95 backdrop-blur-md pl-9 pr-9 py-2.5 text-sm text-foreground placeholder:text-muted-foreground shadow-xl focus:outline-none focus:ring-1 focus:ring-primary"
                />
                {searching && (
                  <span className="absolute right-3 top-1/2 -translate-y-1/2 h-3.5 w-3.5 animate-spin rounded-full border-2 border-primary border-t-transparent" />
                )}
              </div>

              {searchResults.length > 0 && (
                <div className="rounded-lg border border-border bg-card/95 backdrop-blur-md shadow-xl overflow-hidden">
                  {searchResults.map((r) => (
                    <button
                      key={r.place_id}
                      onClick={() => pickResult(r)}
                      className="w-full flex items-start gap-2.5 px-4 py-2.5 text-left hover:bg-muted transition-colors border-b border-border/40 last:border-0"
                    >
                      <MapPin
                        size={13}
                        className="text-muted-foreground shrink-0 mt-0.5"
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium text-foreground truncate">
                          {r.display_name.split(",")[0]}
                        </div>
                        <div className="text-xs text-muted-foreground truncate mt-0.5">
                          {r.display_name}
                        </div>
                      </div>
                    </button>
                  ))}
                </div>
              )}

              <div className="flex gap-2">
                <button
                  onClick={() => setStep(null)}
                  className="flex-1 rounded-lg border border-border bg-card/95 backdrop-blur-md py-2 text-sm text-foreground hover:bg-muted transition-colors shadow-lg"
                >
                  Cancel
                </button>
                <button
                  onClick={confirmMapView}
                  className="flex-1 rounded-lg bg-primary py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors shadow-lg"
                >
                  Set Location
                </button>
              </div>
            </div>
          )}

          {/* Hint pills */}
          {step === "map-setup" && searchResults.length === 0 && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-999 rounded-full border border-border/60 bg-black/60 backdrop-blur-sm px-4 py-1.5 text-xs text-muted-foreground pointer-events-none whitespace-nowrap">
              Drag &amp; zoom to position · then click Set Location
            </div>
          )}
          {step === "draw-zones" && !pendingCoords && (
            <div className="absolute bottom-4 left-1/2 -translate-x-1/2 z-999 rounded-full border border-border/60 bg-black/60 backdrop-blur-sm px-4 py-1.5 text-xs text-muted-foreground pointer-events-none whitespace-nowrap">
              Use the toolbar on the left to draw a rectangle zone
            </div>
          )}

          {/* Zone naming dialog */}
          {pendingCoords && (
            <div className="absolute inset-0 z-2000 flex items-center justify-center bg-black/50 backdrop-blur-sm">
              <div className="w-80 rounded-xl border border-border bg-card p-5 shadow-2xl">
                <p className="mb-1 text-sm font-semibold text-foreground">
                  Name this zone
                </p>
                <p className="mb-3 text-xs text-muted-foreground">
                  Configure the zone name, scanner, and alert threshold.
                </p>

                <div className="space-y-3 mb-4">
                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Zone name</label>
                    <input
                      ref={zoneNameRef}
                      type="text"
                      value={zoneName}
                      onChange={(e) => setZoneName(e.target.value)}
                      onKeyDown={(e) => e.key === "Enter" && saveZone()}
                      placeholder="e.g. Entrance Hall"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">Scanner ID</label>
                    <input
                      type="text"
                      value={zoneScannerId}
                      onChange={(e) => setZoneScannerId(e.target.value)}
                      placeholder="pi"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      Use the scanner_id set in Settings (default: pi)
                    </p>
                  </div>

                  <div>
                    <label className="mb-1 block text-xs text-muted-foreground">
                      Alert threshold
                      <span className="ml-1 text-muted-foreground/50">(optional)</span>
                    </label>
                    <input
                      type="number"
                      min={1}
                      value={zoneThreshold}
                      onChange={(e) => setZoneThreshold(e.target.value)}
                      placeholder="e.g. 10"
                      className="w-full rounded-lg border border-border bg-background px-3 py-2 text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-1 focus:ring-primary"
                    />
                    <p className="mt-1 text-xs text-muted-foreground/60">
                      Sends ntfy alert when active devices exceed this count
                    </p>
                  </div>
                </div>

                <div className="flex gap-2">
                  <button
                    onClick={() => setPendingCoords(null)}
                    className="flex-1 rounded-lg border border-border py-1.5 text-sm text-foreground hover:bg-muted transition-colors"
                  >
                    Discard
                  </button>
                  <button
                    onClick={saveZone}
                    disabled={!zoneName.trim()}
                    className="flex-1 rounded-lg bg-primary py-1.5 text-sm font-medium text-primary-foreground hover:bg-primary/90 disabled:opacity-40 transition-colors"
                  >
                    Save Zone
                  </button>
                </div>
              </div>
            </div>
          )}

          {/* Empty state: no config yet and not in setup mode */}
          {!mapConfig && step === null && (
            <div className="absolute inset-0 z-999 flex flex-col items-center justify-center gap-3 bg-black/40 backdrop-blur-sm">
              <p className="text-sm text-muted-foreground">
                No map location configured yet.
              </p>
              <button
                onClick={enterConfigure}
                className="flex items-center gap-2 rounded-lg bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
              >
                <Settings2 size={15} />
                Configure Map
              </button>
            </div>
          )}

          <MapContainer
            center={initialCenter}
            zoom={initialZoom}
            style={{ height: "100%", width: "100%" }}
            zoomControl={false}
          >
            <TileLayer
              url="https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}"
              attribution="Tiles &copy; Esri"
              maxZoom={19}
            />

            <MapInteractivity interactive={interactive} />
            <MapController
              target={targetView}
              onMoveEnd={(c, z) => {
                setCurrentCenter(c);
                setCurrentZoom(z);
              }}
            />

            {zones.map((z) => (
              <Polygon
                key={z.id}
                positions={z.coordinates}
                pathOptions={{
                  color: z.color,
                  fillColor: z.color,
                  fillOpacity: 0.2,
                  weight: 2,
                  dashArray: step === "draw-zones" ? "4 4" : undefined,
                }}
              >
                <Tooltip sticky>{z.name}</Tooltip>
              </Polygon>
            ))}

            <GeomanControls
              enabled={step === "draw-zones"}
              onCreated={handleZoneCreated}
            />
          </MapContainer>
        </div>
      </div>
    </div>
  );
}
