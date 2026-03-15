import { useState, useMemo, useEffect } from "react";
import { MapContainer, TileLayer, CircleMarker, Tooltip, useMap } from "react-leaflet";
import { motion, AnimatePresence } from "framer-motion";
import { MapPin, Users, IndianRupee, TrendingUp, Zap, ChevronRight, X, ArrowUpRight } from "lucide-react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";

// Fix Leaflet default icon in Vite
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png",
  iconUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png",
  shadowUrl: "https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png",
});

// ─── City Coordinates ──────────────────────────────────────────────────────
const CITY_COORDS: Record<string, [number, number]> = {
  "New Delhi": [28.6139, 77.209], "Delhi": [28.6139, 77.209],
  "Mumbai": [19.076, 72.8777], "Bengaluru": [12.9716, 77.5946], "Bangalore": [12.9716, 77.5946],
  "Chennai": [13.0827, 80.2707], "Kolkata": [22.5726, 88.3639], "Hyderabad": [17.385, 78.4867],
  "Pune": [18.5204, 73.8567], "Ahmedabad": [23.0225, 72.5714], "Surat": [21.1702, 72.8311],
  "Jaipur": [26.9124, 75.7873], "Lucknow": [26.8467, 80.9462], "Kanpur": [26.4499, 80.3318],
  "Nagpur": [21.1458, 79.0882], "Indore": [22.7196, 75.8577], "Bhopal": [23.2599, 77.4126],
  "Visakhapatnam": [17.6868, 83.3196], "Patna": [25.5941, 85.1376], "Vadodara": [22.3072, 73.1812],
  "Ghaziabad": [28.6692, 77.4538], "Ludhiana": [30.9010, 75.8573], "Agra": [27.1767, 78.0081],
  "Nashik": [19.9975, 73.7898], "Faridabad": [28.4089, 77.3178], "Meerut": [28.9845, 77.7064],
  "Rajkot": [22.3039, 70.8022], "Varanasi": [25.3176, 82.9739], "Srinagar": [34.0837, 74.7973],
  "Aurangabad": [19.8762, 75.3433], "Amritsar": [31.634, 74.8723], "Jabalpur": [23.1815, 79.9864],
  "Coimbatore": [11.0168, 76.9558], "Noida": [28.5355, 77.391], "Gurgaon": [28.4595, 77.0266],
  "Gurugram": [28.4595, 77.0266], "Chandigarh": [30.7333, 76.7794], "Mohali": [30.6942, 76.6953],
  "Guwahati": [26.1445, 91.7362], "Kochi": [9.9312, 76.2673], "Thiruvananthapuram": [8.5241, 76.9366],
  "Mysuru": [12.2958, 76.6394], "Mysore": [12.2958, 76.6394], "Mangaluru": [12.9141, 74.856],
  "Hubli": [15.3647, 75.1240], "Belagavi": [15.8497, 74.4977],
  "Karnāl": [29.6857, 76.9905], "Karnal": [29.6857, 76.9905],
  "Bathinda": [30.2110, 74.9490], "Kopargaon": [19.8833, 74.4800],
  "Rohtak": [28.8955, 76.5749], "Hisar": [29.1492, 75.7218], "Panipat": [29.3909, 76.9635],
  "Jammu": [32.7266, 74.8570], "Shimla": [31.1048, 77.1734], "Dehradun": [30.3165, 78.0322],
  "Allahabad": [25.4358, 81.8463], "Prayagraj": [25.4358, 81.8463], "Gorakhpur": [26.7606, 83.3732],
  "Bareilly": [28.367, 79.4304], "Gwalior": [26.2183, 78.1828], "Raipur": [21.2514, 81.6296],
  "Ranchi": [23.3441, 85.3096], "Bhubaneswar": [20.2961, 85.8245], "Vijayawada": [16.5062, 80.6480],
  "Guntur": [16.3067, 80.4365], "Tirupati": [13.6288, 79.4192], "Madurai": [9.9252, 78.1198],
  "Salem": [11.6643, 78.1460], "Kolhapur": [16.705, 74.2433], "Solapur": [17.6805, 75.9064],
  "Jalandhar": [31.3260, 75.5762], "Patiala": [30.3398, 76.3869], "Jodhpur": [26.2389, 73.0243],
  "Kota": [25.2138, 75.8648], "Udaipur": [24.5854, 73.7125], "Dhanbad": [23.7957, 86.4304],
  "Siliguri": [26.7271, 88.4315], "Howrah": [22.5958, 88.3297], "Durgapur": [23.5204, 87.3119],
};

function getCityCoords(city: string): [number, number] | null {
  const t = city?.trim();
  if (!t) return null;
  if (CITY_COORDS[t]) return CITY_COORDS[t];
  const lc = t.toLowerCase();
  for (const [k, v] of Object.entries(CITY_COORDS))
    if (k.toLowerCase() === lc) return v;
  return null;
}

interface CityData {
  city: string; visitors: number; purchases: number; revenue: number;
  convRate: number; coords: [number, number];
  contacts: Array<{ name: string; email: string; phone?: string; amount?: number }>;
}

interface Props {
  visitors: Array<{
    city?: string; payment_status?: string; amount?: number;
    customer_name?: string; customer_email?: string; customer_phone?: string;
  }>;
}

// Fix leaflet icon issue
function LeafletFix() {
  const map = useMap();
  useEffect(() => {
    map.invalidateSize();
  }, [map]);
  return null;
}

// ─── City Detail Panel ────────────────────────────────────────────────────
function CityPanel({ city, onClose }: { city: CityData; onClose: () => void }) {
  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ type: "spring", stiffness: 300, damping: 25 }}
      className="absolute top-0 right-0 bottom-0 w-72 bg-background/95 backdrop-blur-xl border-l border-border/30 z-[1000] flex flex-col overflow-hidden"
    >
      {/* Top accent line */}
      <div className="h-px bg-gradient-to-r from-transparent via-primary/60 to-transparent" />

      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/20">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 rounded-lg bg-primary/15 flex items-center justify-center">
            <MapPin className="w-3.5 h-3.5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-bold text-foreground">{city.city}</p>
            <p className="text-[11px] text-muted-foreground">{city.visitors} visitors · {city.purchases} buyers</p>
          </div>
        </div>
        <button onClick={onClose} className="w-6 h-6 rounded-md hover:bg-muted/50 flex items-center justify-center text-muted-foreground hover:text-foreground transition-colors">
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Stats row */}
      <div className="grid grid-cols-3 border-b border-border/20">
        {[
          { label: "Visitors", value: city.visitors, color: "text-blue-400" },
          { label: "Buyers", value: city.purchases, color: "text-primary" },
          { label: "Revenue", value: city.revenue > 0 ? `₹${(city.revenue/1000).toFixed(1)}K` : "₹0", color: "text-emerald-400" },
        ].map(s => (
          <div key={s.label} className="flex flex-col items-center py-3 border-r border-border/20 last:border-0">
            <p className={`text-lg font-black ${s.color}`}>{s.value}</p>
            <p className="text-[11px] text-muted-foreground">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Conversion bar */}
      <div className="px-4 py-3 border-b border-border/20">
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-xs text-muted-foreground">Conversion rate</span>
          <span className="text-xs font-bold text-foreground">{city.convRate.toFixed(1)}%</span>
        </div>
        <div className="h-1.5 bg-muted/20 rounded-full overflow-hidden">
          <motion.div
            className="h-full rounded-full bg-gradient-to-r from-primary/80 to-primary"
            initial={{ width: 0 }}
            animate={{ width: `${Math.min(city.convRate * 8, 100)}%` }}
            transition={{ delay: 0.2, duration: 0.6, ease: "easeOut" }}
          />
        </div>
      </div>

      {/* Contacts list */}
      <div className="flex-1 overflow-y-auto">
        <div className="px-4 py-2.5 border-b border-border/10">
          <p className="text-[11px] font-bold text-muted-foreground uppercase tracking-wider">People from {city.city}</p>
        </div>
        <div className="divide-y divide-border/10">
          {city.contacts.slice(0, 20).map((c, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 4 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.03 }}
              className="flex items-center gap-2.5 px-4 py-2.5 hover:bg-muted/20 transition-colors"
            >
              <div className={`w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold flex-shrink-0 ${c.amount ? "bg-primary/20 text-primary" : "bg-muted/30 text-muted-foreground"}`}>
                {(c.name || c.email)?.[0]?.toUpperCase() || "?"}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-foreground truncate">{c.name || "Anonymous"}</p>
                <p className="text-[11px] text-muted-foreground truncate">{c.email || "—"}</p>
              </div>
              {c.amount ? (
                <div className="flex items-center gap-1 flex-shrink-0">
                  <span className="text-[11px] font-bold text-primary">₹{c.amount}</span>
                  <ArrowUpRight className="w-3 h-3 text-primary" />
                </div>
              ) : (
                <span className="text-[11px] text-muted-foreground/40 flex-shrink-0">—</span>
              )}
            </motion.div>
          ))}
          {city.contacts.length === 0 && (
            <div className="px-4 py-6 text-center">
              <p className="text-xs text-muted-foreground">No named contacts from this city yet</p>
            </div>
          )}
        </div>
      </div>
    </motion.div>
  );
}

export default function IndiaMap({ visitors }: Props) {
  const [selectedCity, setSelectedCity] = useState<CityData | null>(null);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    setTimeout(() => setMapReady(true), 100);
  }, []);

  // Aggregate city data
  const cityData = useMemo<CityData[]>(() => {
    const map: Record<string, CityData> = {};
    // AUDIT FIX: Exclude hist_ records from visitor counts on map for consistency
    visitors.forEach(v => {
      const city = v.city?.trim() || "";
      const coords = getCityCoords(city);
      if (!city || !coords) return;
      const isHistorical = v.visitor_id?.startsWith("hist_");
      // Normalize city names
      const normalizedCity = city === "Bengaluru" ? "Bangalore" : city;
      if (!map[normalizedCity]) map[normalizedCity] = { city: normalizedCity, visitors: 0, purchases: 0, revenue: 0, convRate: 0, coords, contacts: [] };
      if (!isHistorical) {
        map[normalizedCity].visitors++;
      }
      if (v.payment_status === "captured" && !isHistorical) {
        map[normalizedCity].purchases++;
        map[normalizedCity].revenue += v.amount || 0;
      }
      if (v.customer_name || v.customer_email) {
        map[normalizedCity].contacts.push({
          name: v.customer_name || "",
          email: v.customer_email || "",
          phone: v.customer_phone,
          amount: v.payment_status === "captured" ? v.amount : undefined,
        });
      }
    });
    Object.values(map).forEach(d => {
      d.convRate = d.visitors > 0 ? Math.min((d.purchases / d.visitors) * 100, 100) : 0;
      // Sort contacts: buyers first
      d.contacts.sort((a, b) => (b.amount || 0) - (a.amount || 0));
    });
    return Object.values(map).sort((a, b) => b.visitors - a.visitors);
  }, [visitors]);

  const maxVisitors = Math.max(...cityData.map(d => d.visitors), 1);
  const maxRevenue = Math.max(...cityData.map(d => d.revenue), 1);

  function getRadius(visitors: number): number {
    return 6 + (Math.sqrt(visitors / maxVisitors) * 22);
  }

  function getColor(city: CityData): string {
    if (city.revenue > 0) return "#F5B000"; // Gold = has revenue
    if (city.purchases > 0) return "#22C55E"; // Green = has purchases
    return "#6478FF"; // Blue = visitors only
  }

  function getFillOpacity(visitors: number): number {
    return 0.35 + (visitors / maxVisitors) * 0.45;
  }

  const topByRevenue = [...cityData].filter(d => d.revenue > 0).sort((a, b) => b.revenue - a.revenue).slice(0, 5);
  const topByVisitors = [...cityData].sort((a, b) => b.visitors - a.visitors).slice(0, 6);
  const totalVisitors = cityData.reduce((s, d) => s + d.visitors, 0);
  const totalRevenue = cityData.reduce((s, d) => s + d.revenue, 0);
  const totalBuyers = cityData.reduce((s, d) => s + d.purchases, 0);
  const topCity = topByVisitors[0];

  if (cityData.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-48 gap-3 text-center bg-background">
        <MapPin className="w-8 h-8 text-muted-foreground/20" />
        <p className="text-sm text-muted-foreground">No city data yet</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col lg:flex-row lg:max-h-[480px]">

      {/* ─── MAP ─────────────────────────────────────────────────────── */}
      <div className="flex-1 relative" style={{ height: "min(65vw, 480px)", minHeight: "220px" }}>
        {mapReady && (
          <MapContainer
            center={[22, 82]}
            zoom={5}
            style={{ position: "absolute", inset: 0, width: "100%", height: "100%", background: "#060610" }}
            scrollWheelZoom
            zoomControl={false}
          >
            <LeafletFix />
            {/* Dark CartoDB tiles — optimized for fast load */}
            <TileLayer
              url="https://{s}.basemaps.cartocdn.com/dark_nolabels/{z}/{x}/{y}{r}.png"
              attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> &copy; <a href="https://carto.com/attributions">CARTO</a>'
              subdomains="abcd"
              maxZoom={19}
              keepBuffer={1}
              updateWhenIdle={true}
              updateWhenZooming={false}
              tileSize={256}
              crossOrigin="anonymous"
            />
            {/* City markers */}
            {cityData.map((city) => (
              <CircleMarker
                key={city.city}
                center={city.coords}
                radius={getRadius(city.visitors)}
                pathOptions={{
                  color: getColor(city),
                  fillColor: getColor(city),
                  fillOpacity: getFillOpacity(city.visitors),
                  weight: city.purchases > 0 ? 2 : 1.5,
                  opacity: 0.9,
                }}
                eventHandlers={{
                  click: () => setSelectedCity(city),
                  mouseover: (e) => { e.target.setStyle({ fillOpacity: 0.85, weight: 2.5 }); },
                  mouseout: (e) => { e.target.setStyle({ fillOpacity: getFillOpacity(city.visitors), weight: city.purchases > 0 ? 2 : 1.5 }); },
                }}
              >
                <Tooltip
                  direction="top"
                  offset={[0, -getRadius(city.visitors)]}
                  opacity={1}
                  className="leaflet-tooltip-custom"
                >
                  <div style={{
                    background: "rgba(9,9,20,0.95)",
                    border: "1px solid rgba(245,176,0,0.3)",
                    borderRadius: "12px",
                    padding: "10px 14px",
                    backdropFilter: "blur(12px)",
                    minWidth: 160,
                  }}>
                    <p style={{ fontWeight: 700, color: "#fff", marginBottom: 6, fontSize: 13 }}>📍 {city.city}</p>
                    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "4px 12px" }}>
                      <span style={{ color: "#9ca3af", fontSize: 11 }}>Visitors</span>
                      <span style={{ color: "#6478FF", fontWeight: 700, fontSize: 11 }}>{city.visitors}</span>
                      <span style={{ color: "#9ca3af", fontSize: 11 }}>Purchases</span>
                      <span style={{ color: city.purchases > 0 ? "#F5B000" : "#6b7280", fontWeight: 700, fontSize: 11 }}>{city.purchases}</span>
                      {city.revenue > 0 && <>
                        <span style={{ color: "#9ca3af", fontSize: 11 }}>Revenue</span>
                        <span style={{ color: "#22c55e", fontWeight: 700, fontSize: 11 }}>₹{city.revenue.toLocaleString("en-IN")}</span>
                      </>}
                      <span style={{ color: "#9ca3af", fontSize: 11 }}>Conv %</span>
                      <span style={{ color: "#fff", fontWeight: 700, fontSize: 11 }}>{city.convRate.toFixed(1)}%</span>
                    </div>
                    <p style={{ color: "#6b7280", fontSize: 10, marginTop: 6, textAlign: "center" }}>Click to see contacts →</p>
                  </div>
                </Tooltip>
              </CircleMarker>
            ))}
          </MapContainer>
        )}

        {/* Map overlay: Legend */}
        <div className="absolute bottom-4 left-4 z-[999] flex items-center gap-3 bg-black/70 backdrop-blur-md border border-white/8 rounded-full px-3.5 py-2">
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#F5B000]"/><span className="text-[11px] text-muted-foreground">Revenue</span></div>
          <div className="w-px h-3 bg-border/30"/>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#22C55E]"/><span className="text-[11px] text-muted-foreground">Paid</span></div>
          <div className="w-px h-3 bg-border/30"/>
          <div className="flex items-center gap-1.5"><div className="w-2.5 h-2.5 rounded-full bg-[#6478FF]"/><span className="text-[11px] text-muted-foreground">Visitors</span></div>
          <div className="w-px h-3 bg-border/30"/>
          <span className="hidden sm:inline text-[11px] text-muted-foreground">Click dot for contacts</span>
        </div>

        {/* Zoom hint */}
        <div className="absolute top-3 right-3 z-[999] text-[9px] text-white/20 font-medium tracking-widest uppercase">
          Scroll · Zoom · Click
        </div>

        {/* City panel overlay */}
        <AnimatePresence>
          {selectedCity && (
            <CityPanel city={selectedCity} onClose={() => setSelectedCity(null)} />
          )}
        </AnimatePresence>
      </div>

      {/* ─── RIGHT PANEL ──────────────────────────────────────────────── */}
      <div className="lg:w-64 xl:w-72 flex-shrink-0 border-t lg:border-t-0 lg:border-l border-border/20 bg-background flex flex-col overflow-y-auto">

        {/* Summary — visible on all screens */}
        <div className="p-3 lg:p-4 border-b border-border/20 space-y-2">
          <p className="text-[10px] font-bold text-muted-foreground/60 uppercase tracking-widest">Overview</p>
          <div className="grid grid-cols-4 lg:grid-cols-2 gap-1.5 lg:gap-2">
            {[
              { label: "Cities", value: cityData.length, icon: MapPin, color: "text-blue-400", bg: "bg-blue-500/10" },
              { label: "Visitors", value: totalVisitors, icon: Users, color: "text-blue-400", bg: "bg-blue-500/10" },
              { label: "Buyers", value: totalBuyers, icon: Zap, color: "text-primary", bg: "bg-primary/10" },
              { label: "Revenue", value: `₹${(totalRevenue/1000).toFixed(1)}K`, icon: IndianRupee, color: "text-emerald-400", bg: "bg-emerald-500/10" },
            ].map(s => (
              <div key={s.label} className={`${s.bg} rounded-xl p-2 lg:p-2.5 flex flex-col gap-0.5 lg:gap-1`}>
                <s.icon className={`w-3 h-3 lg:w-3.5 lg:h-3.5 ${s.color}`} />
                <p className={`text-base lg:text-lg font-black ${s.color} leading-none`}>{s.value}</p>
                <p className="text-[10px] lg:text-[11px] text-muted-foreground">{s.label}</p>
              </div>
            ))}
          </div>
        </div>

        {/* Top by Revenue — hidden on mobile */}
        {topByRevenue.length > 0 && (
          <div className="hidden lg:block p-4 border-b border-border/20">
            <div className="flex items-center gap-2 mb-3">
              <IndianRupee className="w-3.5 h-3.5 text-primary" />
              <p className="text-xs font-bold text-foreground">Top Revenue Cities</p>
            </div>
            <div className="space-y-2">
              {topByRevenue.map((c, i) => (
                <motion.button
                  key={c.city}
                  initial={{ opacity: 0, x: 8 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: i * 0.06 }}
                  onClick={() => setSelectedCity(c)}
                  className="w-full flex items-center gap-2.5 p-2 rounded-xl hover:bg-white/5 transition-colors group"
                >
                  <span className="text-[11px] font-black w-4 text-center text-muted-foreground/50">{i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : `#${i+1}`}</span>
                  <div className="flex-1 min-w-0 text-left">
                    <p className="text-xs font-semibold text-foreground truncate">{c.city}</p>
                    <p className="text-[11px] text-muted-foreground">{c.purchases} paid · {c.convRate.toFixed(1)}%</p>
                  </div>
                  <div className="text-right flex-shrink-0">
                    <p className="text-sm font-black text-primary">₹{c.revenue.toLocaleString("en-IN")}</p>
                  </div>
                  <ChevronRight className="w-3 h-3 text-muted-foreground/30 group-hover:text-muted-foreground transition-colors" />
                </motion.button>
              ))}
            </div>
          </div>
        )}

        {/* Top by Visitors — hidden on mobile */}
        <div className="hidden lg:block p-4 flex-1 overflow-y-auto">
          <div className="flex items-center gap-2 mb-3">
            <TrendingUp className="w-3.5 h-3.5 text-blue-400" />
            <p className="text-xs font-bold text-foreground">Most Visitors</p>
          </div>
          <div className="space-y-1">
            {topByVisitors.map((c, i) => (
              <motion.button
                key={c.city}
                initial={{ opacity: 0, x: 8 }}
                animate={{ opacity: 1, x: 0 }}
                transition={{ delay: 0.3 + i * 0.05 }}
                onClick={() => setSelectedCity(c)}
                className="w-full flex items-center gap-2 px-2 py-2 rounded-xl hover:bg-white/5 transition-colors group"
              >
                <span className="text-[11px] font-bold text-muted-foreground/40 w-4 text-center">{i + 1}</span>
                <div className="flex-1 min-w-0 text-left">
                  <div className="flex items-center gap-2">
                    <p className="text-xs font-medium text-foreground truncate">{c.city}</p>
                    {c.revenue > 0 && <span className="text-[9px] px-1.5 py-0.5 bg-primary/15 text-primary rounded-full font-bold">₹</span>}
                  </div>
                  {/* Mini bar */}
                  <div className="flex items-center gap-1.5 mt-1">
                    <div className="flex-1 h-1 bg-muted/20 rounded-full overflow-hidden">
                      <div
                        className="h-full rounded-full bg-blue-500/60"
                        style={{ width: `${(c.visitors / maxVisitors) * 100}%` }}
                      />
                    </div>
                    <span className="text-[11px] font-semibold text-blue-400 w-5 text-right">{c.visitors}</span>
                  </div>
                </div>
                <ChevronRight className="w-3 h-3 text-muted-foreground/20 group-hover:text-muted-foreground/60 transition-colors" />
              </motion.button>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
