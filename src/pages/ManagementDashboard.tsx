import React, { useState, useRef, useEffect, useMemo } from 'react';
import { Outlet, useNavigate } from 'react-router-dom';
import Map, { Marker, Source, Layer } from 'react-map-gl/mapbox';
import type { MapRef, LayerProps } from 'react-map-gl/mapbox';
import type { Geometry, Feature, FeatureCollection } from 'geojson';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Bell, Settings, User, Menu, Plus, Minus, Wrench, Calendar, AlertCircle, Sparkles, ArrowLeft, ClipboardList, Building2, FileBarChart } from 'lucide-react';
import 'mapbox-gl/dist/mapbox-gl.css';
import AppleGlassCard from '../components/AppleGlassCard';
import { SecureMedia } from '../components/SecureMedia';
import { fetchApi } from '../services/api';
import { clearAuthSession } from '../services/authStorage';
import { getStoredUser, isManagementRole } from '../config/roles';
import { mapboxAccessToken } from '../services/config';

// ==========================================
// 1. TYPES & INTERFACES (From PRISM API Docs)
// ==========================================
interface RegionSummary {
  id: string;
  name: string;
  status: string;
  center_lat: number | string;
  center_lng: number | string;
  boundary_geojson: Geometry | Feature | FeatureCollection | string;
}

interface SiteMacro {
  id: string;
  code: string;
  name: string;
  address: string;
  lat: number | string;
  lng: number | string;
  status: 'PENDING' | 'CLEAR' | string;
}

interface MacroResponse {
  region: {
    id: string;
    name: string;
    status: string;
    center: { lat: number | string; lng: number | string };
    boundary: Geometry | Feature | FeatureCollection | string;
  };
  sites: SiteMacro[];
}

interface AssetMicro {
  id: string;
  name: string;
  category: string;
  material: string;
  surface: string;
  lat: number | string;
  lng: number | string;
  status: 'CLEAR' | 'MAINTENANCE PENDING' | 'UNDER_REPAIR' | string;
  imageUrl: string | null;
}

interface MicroResponse {
  siteId: string;
  assets: AssetMicro[];
}

interface Ticket {
  id: string;
  ticket_number: string;
  category: string;
  priority: string;
  status: string;
  description: string;
  created_at: string;
  updated_at: string;
}

interface AssetTicketsResponse {
  count: number;
  tickets: Ticket[];
}

// ==========================================
// 2. CONFIGURATION & API HELPERS
// ==========================================
const isClearStatus = (status: string) => status?.toUpperCase() === 'CLEAR';

// Helper to parse GeoJSON safely if Postgres returns it as a string or raw geometry
const parseGeoJSON = (
  raw: Geometry | Feature | FeatureCollection | string | null | undefined
): Feature | FeatureCollection | null => {
  if (!raw) return null;
  let parsed = raw;
  if (typeof raw === 'string') {
    try {
      parsed = JSON.parse(raw);
    } catch {
      return null;
    }
  }
  if (!parsed || typeof parsed !== 'object') return null;
  if ((parsed as Feature).type === 'Feature' || (parsed as FeatureCollection).type === 'FeatureCollection') {
    return parsed as Feature | FeatureCollection;
  }
  return {
    type: 'Feature',
    properties: {},
    geometry: parsed as Geometry,
  };
};

// ==========================================
// 3. MAIN COMPONENT
// ==========================================
export default function ManagementDashboard() {
  const mapRef = useRef<MapRef | null>(null);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  // View State: 'MACRO' (Region level) vs 'MICRO' (Site/Playground level)
  const [viewMode, setViewMode] = useState<'MACRO' | 'MICRO'>('MACRO');
  // Start empty so it automatically picks the real region name from DB (e.g., "PutrajayaTest1")
  const [selectedRegionName, setSelectedRegionName] = useState<string>('');
  const [selectedSite, setSelectedSite] = useState<SiteMacro | null>(null);
  const [selectedAsset, setSelectedAsset] = useState<AssetMicro | null>(null);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [isMapLoaded, setIsMapLoaded] = useState(false);
  const [globeIntroComplete, setGlobeIntroComplete] = useState(false);
  const [showRegionLayers, setShowRegionLayers] = useState(false);
  const hasCompletedIntroFlight = useRef(false);

  // ------------------------------------------
  // TANSTACK QUERIES (Cached API Fetching)
  // ------------------------------------------

  // 1. Fetch all available regions on initial load
  const { data: regionsData } = useQuery<{ regions: RegionSummary[] }>({
    queryKey: ['regions'],
    queryFn: () => fetchApi('/api/sites/regions'),
    staleTime: 5 * 60 * 1000,
  });

  // Automatically select the first valid region from the DB (e.g., "PutrajayaTest1")
  useEffect(() => {
    if (regionsData?.regions?.length) {
      const exists = regionsData.regions.some((r) => r.name === selectedRegionName);
      if (!selectedRegionName || !exists) {
        setSelectedRegionName(regionsData.regions[0].name);
      }
    }
  }, [regionsData, selectedRegionName]);

  // 2. Fetch Macro Data for the active Region
  const { data: macroData } = useQuery<MacroResponse>({
    queryKey: ['macro', selectedRegionName],
    queryFn: () =>
      fetchApi(`/api/sites/macro?region=${encodeURIComponent(selectedRegionName)}`),
    enabled: !!selectedRegionName,
    staleTime: 2 * 60 * 1000,
  });

  // 3. Fetch Micro Data (Assets) when a Site Pin is clicked
  const { data: microData } = useQuery<MicroResponse>({
    queryKey: ['siteAssets', selectedSite?.id],
    queryFn: () => fetchApi(`/api/sites/${selectedSite!.id}/assets`),
    enabled: viewMode === 'MICRO' && !!selectedSite?.id,
    staleTime: 60 * 1000,
  });

  // 4. Fetch Asset Ticket History when an Asset Dot is clicked
  const { data: assetTickets } = useQuery<AssetTicketsResponse>({
    queryKey: ['assetTickets', selectedAsset?.id],
    queryFn: () => fetchApi(`/api/tickets/asset/${selectedAsset!.id}`),
    enabled: !!selectedAsset?.id,
    staleTime: 60 * 1000,
  });

  // Management-only pending-verification badge (D4: 60s polling).
  const canUseManagementQueue = isManagementRole(getStoredUser()?.role);
  const pendingVerificationQuery = useQuery<{ total: number }>({
    queryKey: ['managementQueueCount', 'PENDING_VERIFICATION'],
    queryFn: () => fetchApi('/api/tickets/queue?status=PENDING_VERIFICATION&limit=1'),
    enabled: canUseManagementQueue,
    refetchInterval: 60_000,
    staleTime: 15_000,
  });
  const pendingVerificationCount = pendingVerificationQuery.data?.total || 0;

  // ------------------------------------------
  // MAP CAMERA & INTERACTION HANDLERS
  // ------------------------------------------

  // Keep the opening globe visible briefly so region data can resolve without a camera jump
  useEffect(() => {
    if (!isMapLoaded) return;
    const timer = window.setTimeout(() => setGlobeIntroComplete(true), 1200);
    return () => window.clearTimeout(timer);
  }, [isMapLoaded]);

  // Fly to Region Center once the globe intro and macro data are both ready
  useEffect(() => {
    if (viewMode !== 'MACRO' || !isMapLoaded || !mapRef.current) return;

    const activeRegionSummary = regionsData?.regions?.find((r) => r.name === selectedRegionName);
    const isIntro = !hasCompletedIntroFlight.current;

    if (isIntro) {
      if (!globeIntroComplete) return;
      if (!macroData?.region?.center || macroData.region.name !== selectedRegionName) return;
    }

    const rawLng = macroData?.region?.center?.lng ?? activeRegionSummary?.center_lng;
    const rawLat = macroData?.region?.center?.lat ?? activeRegionSummary?.center_lat;

    const lng = Number(rawLng);
    const lat = Number(rawLat);

    if (!isNaN(lng) && !isNaN(lat) && lng !== 0 && lat !== 0) {
      hasCompletedIntroFlight.current = true;
      setShowRegionLayers(true);
      mapRef.current.flyTo({
        center: [lng, lat],
        zoom: 12.3,
        pitch: 0,
        bearing: 0,
        duration: isIntro ? 2600 : 1800,
        curve: isIntro ? 1.2 : 1.42,
        essential: true,
      });
    }
  }, [macroData, regionsData, selectedRegionName, viewMode, isMapLoaded, globeIntroComplete]);

  // Transition: Macro Site Pin Click -> Fly to Micro View
  const handleSitePinClick = (site: SiteMacro, e: MouseEvent) => {
    e.stopPropagation();
    setSelectedSite(site);
    setSelectedAsset(null);
    setViewMode('MICRO');

    const lng = Number(site.lng);
    const lat = Number(site.lat);
    if (!isNaN(lng) && !isNaN(lat)) {
      mapRef.current?.flyTo({
        center: [lng, lat],
        zoom: 18.2,
        pitch: 25,
        duration: 2200,
        essential: true,
      });
    }
  };

  // Return to the region overview without remounting or reloading the map
  const handleBackToMacro = () => {
    setViewMode('MACRO');
    setSelectedSite(null);
    setSelectedAsset(null);
  };

  // Handle Top Bar Dropdown Selection
  const handleDropdownChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;

    if (val === `REGION_${selectedRegionName}`) {
      setViewMode('MACRO');
      setSelectedSite(null);
      setSelectedAsset(null);
      return;
    }

    const matchedRegion = regionsData?.regions.find((r) => `REGION_${r.name}` === val);
    if (matchedRegion) {
      setSelectedRegionName(matchedRegion.name);
      setViewMode('MACRO');
      setSelectedSite(null);
      setSelectedAsset(null);
      return;
    }

    const matchedSite = macroData?.sites.find((s) => s.id === val);
    if (matchedSite) {
      setSelectedSite(matchedSite);
      setSelectedAsset(null);
      setViewMode('MICRO');
      mapRef.current?.flyTo({
        center: [Number(matchedSite.lng), Number(matchedSite.lat)],
        zoom: 18.2,
        pitch: 25,
        duration: 2000,
        essential: true,
      });
    }
  };

  // Search Bar Submit Handler
  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!searchQuery.trim()) return;
    const q = searchQuery.toLowerCase();

    if (viewMode === 'MACRO' && macroData?.sites) {
      const match = macroData.sites.find(
        (s) => s.name.toLowerCase().includes(q) || s.code.toLowerCase().includes(q)
      );
      if (match) {
        setSelectedSite(match);
        setViewMode('MICRO');
        mapRef.current?.flyTo({
          center: [Number(match.lng), Number(match.lat)],
          zoom: 18.2,
          pitch: 25,
          duration: 2000,
        });
      }
    } else if (viewMode === 'MICRO' && microData?.assets) {
      const match = microData.assets.find(
        (a) => a.name.toLowerCase().includes(q) || a.category.toLowerCase().includes(q)
      );
      if (match) {
        setSelectedAsset(match);
        mapRef.current?.flyTo({
          center: [Number(match.lng), Number(match.lat)],
          zoom: 19.5,
          duration: 1200,
        });
      }
    }
  };

  // ------------------------------------------
  // COMPUTED METRICS FOR TOP BANNER
  // ------------------------------------------
  const bannerMetrics = useMemo(() => {
    if (viewMode === 'MACRO') {
      const sites = macroData?.sites || [];
      const total = sites.length;
      const clearCount = sites.filter((s) => isClearStatus(s.status)).length;
      const pendingCount = total - clearCount;
      const clearRatio = total > 0 ? (clearCount / total) * 100 : 50;
      const rawTitle = macroData?.region?.name || selectedRegionName || 'PUTRAJAYA';
      return {
        title: rawTitle.toUpperCase(),
        ownedCount: total,
        clearRatio,
        hasPending: pendingCount > 0,
      };
    } else {
      const assets = microData?.assets || [];
      const total = assets.length;
      const clearCount = assets.filter((a) => isClearStatus(a.status)).length;
      const pendingCount = total - clearCount;
      const clearRatio = total > 0 ? (clearCount / total) * 100 : 100;
      return {
        title: selectedSite?.name || 'Site View',
        ownedCount: total,
        clearRatio,
        hasPending: pendingCount > 0,
      };
    }
  }, [viewMode, macroData, microData, selectedRegionName, selectedSite]);

  // Derived Asset Details from Ticket History
  const assetTicketMeta = useMemo(() => {
    if (!assetTickets?.tickets?.length) {
      return { lastMaintained: 'No maintenance history', knownIssue: null };
    }
    const openTicket = assetTickets.tickets.find(
      (t) => t.status !== 'APPROVED' && t.status !== 'CANCELLED'
    );
    const latestTicket = assetTickets.tickets[0];
    const diffDays = Math.max(
      1,
      Math.floor((Date.now() - new Date(latestTicket.updated_at).getTime()) / (1000 * 60 * 60 * 24))
    );
    const lastMaintainedStr =
      diffDays > 30 ? `${Math.floor(diffDays / 30)} months ago` : `${diffDays} days ago`;

    return {
      lastMaintained: lastMaintainedStr,
      knownIssue: openTicket?.description || openTicket?.category || null,
    };
  }, [assetTickets]);

  // ------------------------------------------
  // GEOJSON BOUNDARY LAYER STYLES (Soft Red)
  // ------------------------------------------
  const boundaryGeoJSON = useMemo(() => {
    const activeRegionSummary = regionsData?.regions?.find((r) => r.name === selectedRegionName);
    const raw = macroData?.region?.boundary ?? activeRegionSummary?.boundary_geojson;
    return parseGeoJSON(raw);
  }, [macroData, regionsData, selectedRegionName]);

  // Soft outer glow for the boundary line
  const boundaryGlowLayer: LayerProps = {
    id: 'region-boundary-glow',
    type: 'line',
    paint: {
      'line-color': '#fb7185',
      'line-width': 6,
      'line-blur': 4,
      'line-opacity': 0.28,
    },
  };

  // Crisp soft-red dashed border line matching your reference
  const boundaryLineLayer: LayerProps = {
    id: 'region-boundary-line',
    type: 'line',
    paint: {
      'line-color': '#f87171', // Soft rose-red
      'line-width': 2,
      'line-dasharray': [4, 2.5],
      'line-opacity': 0.78,
    },
  };

  const boundaryFillLayer: LayerProps = {
    id: 'region-boundary-fill',
    type: 'fill',
    paint: {
      'fill-color': '#f87171',
      'fill-opacity': viewMode === 'MACRO' ? 0.03 : 0.0,
    },
  };

  return (
    <div style={styles.pageContainer}>
      {/* ==========================================
          MAPBOX GL CANVAS (Navigation Night = Dark Navy Style)
         ========================================== */}
      <Map
        ref={mapRef}
        mapboxAccessToken={mapboxAccessToken}
        initialViewState={{
          longitude: 101.6964,
          latitude: 2.9264,
          zoom: 0.9,
          pitch: 0,
          bearing: 0,
        }}
        projection="globe"
        mapStyle="mapbox://styles/syizi/cm3mfhnyq00ox01sdet7sd02x"
        style={{ width: '100%', height: '100%' }}
        onLoad={() => {
          mapRef.current?.getMap().setProjection('globe');
          setIsMapLoaded(true);
        }}
        onClick={() => setSelectedAsset(null)}
      >
        {/* REGION BOUNDARY GEOJSON OVERLAY */}
        {showRegionLayers && boundaryGeoJSON && (
          <Source id="region-boundary" type="geojson" data={boundaryGeoJSON}>
            <Layer {...boundaryFillLayer} />
            <Layer {...boundaryGlowLayer} />
            <Layer {...boundaryLineLayer} />
          </Source>
        )}

        {/* MACRO VIEW: SITE TEARDROP PINS */}
        {viewMode === 'MACRO' &&
          showRegionLayers &&
          macroData?.sites?.map((site) => {
            const lng = Number(site.lng);
            const lat = Number(site.lat);
            if (isNaN(lng) || isNaN(lat)) return null;

            const isClear = isClearStatus(site.status);
            return (
              <Marker
                key={site.id}
                longitude={lng}
                latitude={lat}
                anchor="bottom"
                onClick={(e) => handleSitePinClick(site, e.originalEvent)}
              >
                <div
                  title={`${site.name} (${site.status})`}
                  style={styles.teardropPinWrapper}
                >
                  <div
                    style={{
                      ...styles.teardropPin,
                      backgroundColor: isClear ? '#22c55e' : '#dc2626',
                      boxShadow: isClear
                        ? '0 6px 16px rgba(34, 197, 94, 0.55)'
                        : '0 6px 16px rgba(220, 38, 38, 0.55)',
                    }}
                  >
                    <div style={styles.teardropInnerDot} />
                  </div>
                </div>
              </Marker>
            );
          })}

        {/* MICRO VIEW: ASSET CIRCLE MARKERS */}
        {viewMode === 'MICRO' &&
          microData?.assets?.map((asset) => {
            const lng = Number(asset.lng);
            const lat = Number(asset.lat);
            if (isNaN(lng) || isNaN(lat)) return null;

            const isClear = isClearStatus(asset.status);
            const isSelected = selectedAsset?.id === asset.id;
            return (
              <Marker
                key={asset.id}
                longitude={lng}
                latitude={lat}
                anchor="center"
                onClick={(e) => {
                  e.originalEvent.stopPropagation();
                  setSelectedAsset(asset);
                }}
              >
                <div
                  title={`${asset.name} (${asset.status})`}
                  style={{
                    ...styles.assetCircleMarker,
                    backgroundColor: isClear ? '#4ade80' : '#ef4444',
                    transform: isSelected ? 'scale(1.35)' : 'scale(1)',
                    boxShadow: isSelected
                      ? '0 0 0 4px rgba(255, 255, 255, 0.35), 0 4px 12px rgba(0,0,0,0.6)'
                      : '0 3px 8px rgba(0,0,0,0.5)',
                  }}
                />
              </Marker>
            );
          })}
      </Map>

      {/* ==========================================
          TOP-LEFT HAMBURGER MENU
         ========================================== */}
      <button style={styles.hamburgerBtn} aria-label="Menu">
        <Menu size={26} color="#f8fafc" />
      </button>

      {/* ==========================================
          TOP-CENTER GLASS HEADER CARD
         ========================================== */}
      <div style={styles.topHeaderWrapper}>
        <AppleGlassCard maxWidth="620px" style={{ padding: '14px 28px', borderRadius: '18px' }}>
          <div style={styles.headerTitleRow}>
            <div style={styles.headerTitleSide}>
              {viewMode === 'MICRO' && (
                <button
                  onClick={handleBackToMacro}
                  style={styles.backToMacroBtn}
                  aria-label="Back to region view"
                >
                  <ArrowLeft size={13} color="#cbd5e1" />
                  <span>Region</span>
                </button>
              )}
            </div>
            <h1 style={styles.headerTitle}>{bannerMetrics.title}</h1>
            <div style={styles.headerTitleSide} />
          </div>

          <div style={styles.headerMetricsRow}>
            {/* Owned Count */}
            <div style={styles.ownedBlock}>
              <span style={styles.metricLabel}>Owned :</span>
              <span style={styles.ownedValue}>{bannerMetrics.ownedCount}</span>
            </div>

            <div style={styles.verticalDivider} />

            {/* Ticket Status Bar */}
            <div style={styles.statusBlock}>
              <span style={styles.metricLabel}>Ticket Status :</span>
              <div style={styles.progressBarTrack}>
                <div
                  style={{
                    ...styles.progressBarClear,
                    width: `${bannerMetrics.clearRatio}%`,
                  }}
                />
                <div
                  style={{
                    ...styles.progressBarPending,
                    width: `${100 - bannerMetrics.clearRatio}%`,
                  }}
                />
              </div>
              <div style={styles.legendRow}>
                <span style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: '#4ade80' }} />
                  Clear
                </span>
                <span style={styles.legendItem}>
                  <span style={{ ...styles.legendDot, backgroundColor: '#f87171' }} />
                  Pending
                </span>
              </div>
            </div>

            <div style={styles.verticalDivider} />

            {/* Location Selector Dropdown */}
            <div style={styles.locationBlock}>
              <span style={styles.metricLabel}>Location :</span>
              <select
                value={
                  viewMode === 'MACRO'
                    ? `REGION_${selectedRegionName}`
                    : selectedSite?.id || `REGION_${selectedRegionName}`
                }
                onChange={handleDropdownChange}
                style={styles.locationSelect}
              >
                {regionsData?.regions?.length ? (
                  regionsData.regions.map((r) => (
                    <option key={r.id} value={`REGION_${r.name}`} style={{ color: '#0f172a' }}>
                      {r.name}
                    </option>
                  ))
                ) : (
                  <option value={`REGION_${selectedRegionName}`} style={{ color: '#0f172a' }}>
                    {selectedRegionName || 'Loading...'}
                  </option>
                )}

                {macroData?.sites?.map((site) => (
                  <option key={site.id} value={site.id} style={{ color: '#0f172a' }}>
                    {site.name}
                  </option>
                ))}
              </select>
            </div>
          </div>
        </AppleGlassCard>
      </div>

      {/* ==========================================
          TOP-RIGHT ACTION PILL (Bell, Gear, Profile)
         ========================================== */}
      <div style={styles.topRightWrapper}>
        <AppleGlassCard
          maxWidth="170px"
          style={{ padding: '10px 18px', borderRadius: '14px' }}
        >
          <div style={styles.actionIconsRow}>
            {canUseManagementQueue && (
              <button
                style={{ ...styles.iconBtn, position: 'relative' }}
                aria-label="Maintenance tickets"
                title="Maintenance tickets"
                onClick={() => navigate('/management/tickets')}
              >
                <ClipboardList size={19} color="#f8fafc" />
                {pendingVerificationCount > 0 && (
                  <span
                    style={{
                      position: 'absolute',
                      top: -4,
                      right: -4,
                      minWidth: 16,
                      height: 16,
                      borderRadius: 999,
                      background: '#ef4444',
                      color: '#fff',
                      fontSize: 10,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      padding: '0 4px',
                      fontWeight: 700
                    }}
                  >
                    {pendingVerificationCount}
                  </span>
                )}
              </button>
            )}
            {canUseManagementQueue && (
              <button
                style={styles.iconBtn}
                aria-label="Contracted groups"
                title="Contracted groups"
                onClick={() => navigate('/management/contractors')}
              >
                <Building2 size={19} color="#f8fafc" />
              </button>
            )}
            {canUseManagementQueue && (
              <button
                style={styles.iconBtn}
                aria-label="Reports"
                title="Reports"
                onClick={() => navigate('/reports')}
              >
                <FileBarChart size={19} color="#f8fafc" />
              </button>
            )}
            <button style={styles.iconBtn} aria-label="Notifications">
              <Bell size={19} color="#f8fafc" />
            </button>
            <button style={styles.iconBtn} aria-label="Settings">
              <Settings size={19} color="#f8fafc" />
            </button>
            <button
              style={styles.iconBtn}
              aria-label="Sign out"
              title="Sign out"
              onClick={async () => {
                try {
                  await fetchApi('/api/identity/logout', { method: 'POST' });
                } catch {
                  // Session may already be invalid.
                } finally {
                  clearAuthSession();
                  queryClient.clear();
                  navigate('/login', { replace: true });
                }
              }}
            >
              <User size={19} color="#f8fafc" />
            </button>
          </div>
        </AppleGlassCard>
      </div>

      {/* ==========================================
          RIGHT-SIDE ASSET DETAIL CARD (MICRO VIEW)
         ========================================== */}
      {viewMode === 'MICRO' && selectedAsset && (
        <div style={styles.rightAssetCardWrapper}>
          <AppleGlassCard
            maxWidth="280px"
            style={{ padding: '0px', borderRadius: '16px', overflow: 'hidden' }}
          >
            <div style={styles.assetImageContainer}>
              <SecureMedia
                path={selectedAsset.imageUrl}
                alt={selectedAsset.name}
                style={styles.assetImage}
                fallback={
                  <img
                    src="https://images.unsplash.com/photo-1596464716127-f2a82984de30?auto=format&fit=crop&w=600&q=80"
                    alt={selectedAsset.name}
                    style={styles.assetImage}
                  />
                }
              />
            </div>

            <div style={styles.assetCardBody}>
              <h3 style={styles.assetTitle}>{selectedAsset.name}</h3>

              <div style={styles.assetMetaList}>
                <div style={styles.assetMetaItem}>
                  <Sparkles size={13} color="#94a3b8" />
                  <span>
                    Tix Status :{' '}
                    <strong
                      style={{
                        color: isClearStatus(selectedAsset.status) ? '#4ade80' : '#f87171',
                        fontWeight: 600,
                      }}
                    >
                      {isClearStatus(selectedAsset.status) ? 'Clear' : 'Pending'}
                    </strong>
                  </span>
                </div>

                <div style={styles.assetMetaItem}>
                  <Wrench size={13} color="#94a3b8" />
                  <span>
                    Category : <strong style={{ color: '#f8fafc' }}>{selectedAsset.category}</strong>
                  </span>
                </div>

                <div style={styles.assetMetaItem}>
                  <Calendar size={13} color="#94a3b8" />
                  <span>
                    Last Activity :{' '}
                    <strong style={{ color: '#f8fafc' }}>{assetTicketMeta.lastMaintained}</strong>
                  </span>
                </div>

                {!isClearStatus(selectedAsset.status) && (
                  <div style={styles.assetMetaItem}>
                    <AlertCircle size={13} color="#94a3b8" />
                    <span>
                    Known Issue:{' '}
                    <strong style={{ color: '#f8fafc' }}>{assetTicketMeta.knownIssue || 'None reported'}</strong>
                    </span>
                  </div>
                )}
              </div>

              <button
                style={styles.openAssetBtn}
                onClick={() => navigate(`/management/dashboard/assets/${selectedAsset.id}/digital-twin`)}
              >
                Open Asset Details
              </button>
            </div>
          </AppleGlassCard>
        </div>
      )}

      {/* ==========================================
          BOTTOM-CENTER GLASS SEARCH BAR
         ========================================== */}
      <form onSubmit={handleSearchSubmit} style={styles.bottomSearchWrapper}>
        <AppleGlassCard
          maxWidth="440px"
          style={{ padding: '10px 22px', borderRadius: '999px' }}
        >
          <input
            type="text"
            placeholder="search"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={styles.searchInput}
          />
        </AppleGlassCard>
      </form>

      {/* ==========================================
          BOTTOM-RIGHT ZOOM CONTROLS
         ========================================== */}
      <div style={styles.zoomControlsWrapper}>
        <button
          style={styles.zoomBtn}
          onClick={() => mapRef.current?.zoomIn({ duration: 300 })}
          aria-label="Zoom In"
        >
          <Plus size={18} color="#f8fafc" />
        </button>
        <div style={styles.zoomDivider} />
        <button
          style={styles.zoomBtn}
          onClick={() => mapRef.current?.zoomOut({ duration: 300 })}
          aria-label="Zoom Out"
        >
          <Minus size={18} color="#f8fafc" />
        </button>
      </div>
      <Outlet />
    </div>
  );
}

// ==========================================
// 4. STYLES
// ==========================================
const styles: Record<string, React.CSSProperties> = {
  // Using position: fixed + inset: 0 overrides Vite's #root max-width/margin and kills all scrollbars!
  pageContainer: {
    position: 'fixed',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100vw',
    height: '100vh',
    overflow: 'hidden',
    backgroundColor: '#0b1325',
    fontFamily: 'Inter, -apple-system, BlinkMacSystemFont, sans-serif',
    zIndex: 1,
  },
  hamburgerBtn: {
    position: 'absolute',
    top: '22px',
    left: '24px',
    zIndex: 20,
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '8px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  topHeaderWrapper: {
    position: 'absolute',
    top: '18px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '90%',
    maxWidth: '620px',
    zIndex: 20,
  },
  headerTitleRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
    marginBottom: '10px',
  },
  headerTitleSide: {
    width: '76px',
    flexShrink: 0,
    display: 'flex',
    alignItems: 'center',
  },
  backToMacroBtn: {
    display: 'flex',
    alignItems: 'center',
    gap: '5px',
    padding: '5px 9px',
    borderRadius: '6px',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    border: '1px solid rgba(255, 255, 255, 0.1)',
    color: '#e2e8f0',
    fontSize: '11px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  headerTitle: {
    flex: 1,
    minWidth: 0,
    margin: 0,
    textAlign: 'center',
    fontSize: '24px',
    fontWeight: 700,
    letterSpacing: '0.04em',
    color: '#ffffff',
  },
  headerMetricsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '16px',
    flexWrap: 'wrap',
  },
  ownedBlock: {
    display: 'flex',
    alignItems: 'baseline',
    gap: '8px',
  },
  metricLabel: {
    fontSize: '11px',
    fontWeight: 600,
    color: '#cbd5e1',
  },
  ownedValue: {
    fontSize: '20px',
    fontWeight: 700,
    color: '#ffffff',
  },
  verticalDivider: {
    width: '1px',
    height: '32px',
    backgroundColor: 'rgba(255, 255, 255, 0.2)',
  },
  statusBlock: {
    flex: 1,
    minWidth: '150px',
    display: 'flex',
    flexDirection: 'column',
    gap: '5px',
  },
  progressBarTrack: {
    width: '100%',
    height: '6px',
    borderRadius: '999px',
    overflow: 'hidden',
    display: 'flex',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
  progressBarClear: {
    height: '100%',
    backgroundColor: '#4ade80',
    transition: 'width 0.4s ease',
  },
  progressBarPending: {
    height: '100%',
    backgroundColor: '#f87171',
    transition: 'width 0.4s ease',
  },
  legendRow: {
    display: 'flex',
    alignItems: 'center',
    gap: '12px',
  },
  legendItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '4px',
    fontSize: '10px',
    color: '#cbd5e1',
  },
  legendDot: {
    width: '7px',
    height: '7px',
    borderRadius: '2px',
    display: 'inline-block',
  },
  locationBlock: {
    display: 'flex',
    alignItems: 'center',
    gap: '8px',
  },
  locationSelect: {
    backgroundColor: 'rgba(241, 245, 249, 0.92)',
    color: '#1e293b',
    border: 'none',
    borderRadius: '6px',
    padding: '5px 10px',
    fontSize: '12px',
    fontWeight: 500,
    minWidth: '145px',
    outline: 'none',
    cursor: 'pointer',
  },
  topRightWrapper: {
    position: 'absolute',
    top: '18px',
    right: '24px',
    zIndex: 20,
  },
  actionIconsRow: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: '18px',
  },
  iconBtn: {
    background: 'transparent',
    border: 'none',
    cursor: 'pointer',
    padding: '4px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  teardropPinWrapper: {
    cursor: 'pointer',
    paddingBottom: '4px',
    transition: 'transform 0.2s ease',
  },
  teardropPin: {
    width: '28px',
    height: '28px',
    borderRadius: '50% 50% 50% 0',
    transform: 'rotate(-45deg)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    border: '2px solid rgba(255, 255, 255, 0.85)',
  },
  teardropInnerDot: {
    width: '11px',
    height: '11px',
    borderRadius: '50%',
    backgroundColor: '#f8fafc',
    transform: 'rotate(45deg)',
  },
  assetCircleMarker: {
    width: '16px',
    height: '16px',
    borderRadius: '50%',
    border: '2.5px solid #ffffff',
    cursor: 'pointer',
    transition: 'transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1)',
  },
  rightAssetCardWrapper: {
    position: 'absolute',
    top: '52%',
    right: '24px',
    transform: 'translateY(-50%)',
    zIndex: 20,
    width: '265px',
  },
  assetImageContainer: {
    width: '100%',
    height: '175px',
    overflow: 'hidden',
    backgroundColor: '#1e293b',
  },
  assetImage: {
    width: '100%',
    height: '100%',
    objectFit: 'cover',
    display: 'block',
  },
  assetCardBody: {
    padding: '16px',
    display: 'flex',
    flexDirection: 'column',
    gap: '12px',
  },
  assetTitle: {
    margin: 0,
    fontSize: '15px',
    fontWeight: 700,
    color: '#ffffff',
  },
  assetMetaList: {
    display: 'flex',
    flexDirection: 'column',
    gap: '6px',
    fontSize: '11.5px',
    color: '#cbd5e1',
  },
  assetMetaItem: {
    display: 'flex',
    alignItems: 'center',
    gap: '7px',
  },
  openAssetBtn: {
    marginTop: '4px',
    width: '100%',
    padding: '10px 14px',
    backgroundColor: '#03204c',
    color: '#ffffff',
    border: '1px solid rgba(56, 189, 248, 0.25)',
    borderRadius: '8px',
    fontSize: '12px',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s ease',
  },
  bottomSearchWrapper: {
    position: 'absolute',
    bottom: '28px',
    left: '50%',
    transform: 'translateX(-50%)',
    width: '90%',
    maxWidth: '420px',
    zIndex: 20,
  },
  searchInput: {
    width: '100%',
    background: 'transparent',
    border: 'none',
    outline: 'none',
    color: '#f8fafc',
    fontSize: '13px',
    textAlign: 'center',
  },
  zoomControlsWrapper: {
    position: 'absolute',
    bottom: '28px',
    right: '24px',
    zIndex: 20,
    display: 'flex',
    flexDirection: 'column',
    borderRadius: '8px',
    overflow: 'hidden',
    backgroundColor: 'rgba(30, 41, 59, 0.65)',
    backdropFilter: 'blur(12px)',
    border: '1px solid rgba(255, 255, 255, 0.18)',
  },
  zoomBtn: {
    width: '34px',
    height: '34px',
    background: 'transparent',
    border: 'none',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    cursor: 'pointer',
  },
  zoomDivider: {
    width: '100%',
    height: '1px',
    backgroundColor: 'rgba(255, 255, 255, 0.15)',
  },
};