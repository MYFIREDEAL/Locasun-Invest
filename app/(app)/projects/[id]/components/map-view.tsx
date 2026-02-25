"use client";

import { useEffect, useRef, useState, useCallback, useMemo } from "react";
import L from "leaflet";
import "leaflet/dist/leaflet.css";
import { saveBuildingLocation, saveParcelleData } from "@/lib/actions/building-configs";
import { saveEnedisContext } from "@/lib/actions/enedis";
import { getOwnedParcelles, addOwnedParcelle, removeOwnedParcelle } from "@/lib/actions/owned-parcelles";
import type { BuildingConfigRow } from "@/lib/types/building";
import { useEnedisNetwork } from "@/lib/hooks/use-enedis-network";
import {
  createEnedisLayerGroups,
  drawAllEnedisLayers,
  updateEnedisVisibility,
  type EnedisLayerGroups,
} from "./enedis-map-layers";
import { EnedisControlPanel, EnedisLegend } from "./enedis-control-panel";
import { useAnnotations } from "@/lib/hooks/use-annotations";
import { useParcelle } from "@/lib/hooks/use-parcelle";
import type { PointSubtype, GeoJSONPoint } from "@/lib/types/annotations";
import { getZoneLabel } from "@/lib/types/parcelle";
import type { CadastreProperties, ZoneUrbaProperties } from "@/lib/types/parcelle";
import {
  createAnnotationLayerGroups,
  drawAnnotations,
  drawLinePreview,
  clearLinePreview,
  findNearestSnapPoint,
  drawSnapIndicator,
  type AnnotationLayerGroup,
  type AnnotationCallbacks,
} from "./annotation-map-layers";
import { AnnotationPalette } from "./annotation-palette";
import { usePluAnalysis } from "@/lib/hooks/use-plu-analysis";
import { PluAnalysisPanel } from "./plu-analysis-panel";

import type { SaveRef } from "./building-config-form-advanced";

interface MapViewProps {
  projectId: string;
  buildingConfig: BuildingConfigRow | null;
  length: number;
  totalWidth: number;
  /** Ref pour que le wizard puisse déclencher le save depuis le header */
  saveRef?: SaveRef;
}

// Point-in-polygon test (ray casting)
function pointInPolygon(point: [number, number], polygon: [number, number][]): boolean {
  const [py, px] = point;
  let inside = false;
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const [iy, ix] = polygon[i]!;
    const [jy, jx] = polygon[j]!;
    if ((iy > py) !== (jy > py) && px < ((jx - ix) * (py - iy)) / (jy - iy) + ix) {
      inside = !inside;
    }
  }
  return inside;
}

export default function MapView({ projectId, buildingConfig, length, totalWidth, saveRef }: MapViewProps) {
  const mapRef = useRef<HTMLDivElement>(null);
  const leafletMap = useRef<L.Map | null>(null);
  const polygonGroup = useRef<L.LayerGroup | null>(null);
  const rotateMarker = useRef<L.Marker | null>(null);
  const enedisLayerGroupsRef = useRef<EnedisLayerGroups | null>(null);
  const annotationLayersRef = useRef<AnnotationLayerGroup | null>(null);
  
  // Building drag state
  const isDraggingBuilding = useRef(false);
  const dragOffset = useRef<{ dLat: number; dLng: number }>({ dLat: 0, dLng: 0 });
  const buildingCornersRef = useRef<[number, number][]>([]);
  const buildingExactCornersRef = useRef<[number, number][]>([]);
  const latRef = useRef(buildingConfig?.centroid_lat ?? 43.6047);
  const lngRef = useRef(buildingConfig?.centroid_lon ?? 1.4442);

  // Ref to annotation sync so we can call it from mouseUp closure
  const syncBuildingAnchorRef = useRef<((lat: number, lng: number) => Promise<void>) | null>(null);

  // Ref pour recharger parcelle + enedis après drag du bâtiment (closure-safe)
  const reloadLocationDataRef = useRef<((lat: number, lng: number) => void) | null>(null);

  // Line drawing cursor tracking
  const drawCursorRef = useRef<[number, number] | null>(null);

  // Ref for annotation callbacks so Leaflet markers always get the latest version
  const annotationCallbacksRef = useRef<AnnotationCallbacks | null>(null);

  // State
  const [lat, setLat] = useState(buildingConfig?.centroid_lat ?? 43.6047);
  const [lng, setLng] = useState(buildingConfig?.centroid_lon ?? 1.4442);
  const [rotation, setRotation] = useState(buildingConfig?.orientation_deg ?? 0);
  const [address, setAddress] = useState("");
  const [saving, setSaving] = useState(false);
  const [msg, setMsg] = useState("");

  // Keep refs in sync with state
  latRef.current = lat;
  lngRef.current = lng;

  // Enedis network hook
  const enedis = useEnedisNetwork();

  // Parcelle hook
  const parcelle = useParcelle();
  const parcelleLayerRef = useRef<L.LayerGroup | null>(null);
  const parcelleInfoRef = useRef(parcelle.info);
  parcelleInfoRef.current = parcelle.info;

  // Garder la ref à jour pour le rechargement après drag
  reloadLocationDataRef.current = (newLat: number, newLng: number) => {
    parcelle.loadParcelle(newLat, newLng, buildingExactCornersRef.current);
    enedis.loadNetwork(newLat, newLng);
  };

  // Couche cadastre WMS (parcelles IGN)
  const cadastreWmsRef = useRef<L.TileLayer.WMS | null>(null);
  const [showCadastre, setShowCadastre] = useState(true);

  // Couche routes / BD TOPO réseau routier (WMS IGN)
  const routesLayerRef = useRef<L.TileLayer.WMS | null>(null);
  const [showRoutes, setShowRoutes] = useState(true);

  // Annotations hook
  const anno = useAnnotations(projectId);
  syncBuildingAnchorRef.current = anno.syncBuildingAnchor;

  // Building corners state (for reactive PLU analysis)
  const [buildingCornersState, setBuildingCornersState] = useState<[number, number][]>([]);

  // Parcelles possédées par le client (IDU) — la parcelle principale est toujours considérée possédée
  const [ownedParcelleIdus, setOwnedParcelleIdus] = useState<Set<string>>(new Set());

  // Parcelles voisines ajoutées manuellement (clic sur la carte)
  interface ManualOwnedParcelle {
    cadastre: CadastreProperties;
    geometry: GeoJSON.MultiPolygon;
    zoneUrba: ZoneUrbaProperties | null;
    /** Point où l'utilisateur a déposé l'icône (pour positionner le badge) */
    dropLatLng?: [number, number];
  }
  const [manualOwnedParcelles, setManualOwnedParcelles] = useState<ManualOwnedParcelle[]>([]);
  const manualOwnedRef = useRef(manualOwnedParcelles);
  manualOwnedRef.current = manualOwnedParcelles;
  const ownedLoadedRef = useRef(false);

  // Charger les parcelles possédées depuis Supabase au mount
  useEffect(() => {
    if (ownedLoadedRef.current) return;
    ownedLoadedRef.current = true;
    (async () => {
      const res = await getOwnedParcelles(projectId);
      if (!res.success || res.data.length === 0) return;
      const idus = new Set<string>();
      const manuals: ManualOwnedParcelle[] = [];
      for (const row of res.data) {
        idus.add(row.idu);
        if (row.source === "manual" && row.geometry) {
          manuals.push({
            cadastre: row.cadastre_props,
            geometry: row.geometry,
            zoneUrba: row.zone_urba,
          });
        }
      }
      if (idus.size > 0) setOwnedParcelleIdus(idus);
      if (manuals.length > 0) setManualOwnedParcelles(manuals);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [projectId]);

  // Hauteurs bâtiment (depuis config)
  const heightSabliereM = buildingConfig?.params?.heightSabliereLeft ?? 5.5;
  const heightFaitageM = buildingConfig?.params?.heightFaitage ?? 7;

  // PLU Analysis hook — recalcule quand bâtiment bouge, hauteurs changent, ou parcelle chargée
  const manualOwnedGeometries = useMemo(
    () => manualOwnedParcelles.map(p => p.geometry),
    [manualOwnedParcelles],
  );
  const pluAnalysis = usePluAnalysis({
    parcelleInfo: parcelle.info,
    heightSabliereM,
    heightFaitageM,
    buildingCorners: buildingCornersState,
    ownedParcelleIdus,
    manualOwnedGeometries,
  });

  // Azimuts des faces des pans (perpendiculaires au faîtage)
  const azPanA = ((rotation + 90) % 360 + 360) % 360;
  const azPanB = ((rotation - 90) % 360 + 360) % 360;

  const cardinal = (a: number) => ["N","NE","E","SE","S","SW","W","NW"][Math.round(a/45)%8];

  // Dessiner bâtiment
  function draw() {
    if (!leafletMap.current || !polygonGroup.current) return;
    
    polygonGroup.current.clearLayers();
    
    // Conversion metres -> degres
    const mLat = 111320;
    const mLng = 111320 * Math.cos(lat * Math.PI / 180);
    
    const hL = length / 2;
    const hW = totalWidth / 2;
    const r = rotation * Math.PI / 180;
    
    // Coin: dL=along ridge, dW=perpendicular
    const pt = (dL: number, dW: number): [number, number] => [
      lat + (dL * Math.cos(r) - dW * Math.sin(r)) / mLat,
      lng + (dL * Math.sin(r) + dW * Math.cos(r)) / mLng
    ];
    
    // 4 coins
    const nw = pt(-hL, -hW);
    const ne = pt(hL, -hW);
    const se = pt(hL, hW);
    const sw = pt(-hL, hW);
    buildingExactCornersRef.current = [nw, ne, se, sw];
    // Sync corners state for PLU analysis (reactive recalc)
    setBuildingCornersState([nw, ne, se, sw]);
    
    // Store corners for hit-testing (include some margin)
    const margin = 3; // metres extra for easier grabbing
    const nwM = pt(-hL - margin, -hW - margin);
    const neM = pt(hL + margin, -hW - margin);
    const seM = pt(hL + margin, hW + margin);
    const swM = pt(-hL - margin, hW + margin);
    buildingCornersRef.current = [nwM, neM, seM, swM];
    
    // Faitage
    const fw = pt(-hL, 0);
    const fe = pt(hL, 0);
    
    // Pan A (bleu) - face vers rotation+90°
    L.polygon([fw, fe, se, sw], {
      color: "#2563eb",
      weight: 3,
      fillColor: "#3b82f6",
      fillOpacity: 0.4,
      interactive: false,
    }).bindTooltip(`Pan A (${cardinal(azPanA)})`, {permanent: false}).addTo(polygonGroup.current);
    
    // Pan B (orange) - face vers rotation-90°
    L.polygon([fw, fe, ne, nw], {
      color: "#f97316",
      weight: 3,
      fillColor: "#fb923c",
      fillOpacity: 0.4,
      interactive: false,
    }).bindTooltip(`Pan B (${cardinal(azPanB)})`, {permanent: false}).addTo(polygonGroup.current);
    
    // Faitage ligne
    L.polyline([fw, fe], {
      color: "#000",
      weight: 4,
      dashArray: "10,5",
      interactive: false,
    }).addTo(polygonGroup.current);
    
    // Update rotate marker + connection line
    if (rotateMarker.current) {
      const rPt = pt(hL + 10, 0);
      rotateMarker.current.setLatLng(rPt);
    }
    
    // Dashed line from ridge end to rotate handle
    const feExtend = pt(hL, 0);
    const rPtLine = pt(hL + 10, 0);
    L.polyline([feExtend, rPtLine], {
      color: "#f97316",
      weight: 2,
      dashArray: "4,4",
      opacity: 0.7,
      interactive: false,
    }).addTo(polygonGroup.current);
  }

  // Init map
  useEffect(() => {
    if (!mapRef.current || leafletMap.current) return;
    
    const map = L.map(mapRef.current).setView([lat, lng], 18);
    
    L.tileLayer("https://mt1.google.com/vt/lyrs=s&x={x}&y={y}&z={z}", {
      maxZoom: 21,
      attribution: "Google"
    }).addTo(map);

    // Couche cadastre IGN PCI Vecteur — contours orange + numéros de parcelles (style Géoportail)
    cadastreWmsRef.current = L.tileLayer.wms("https://data.geopf.fr/wms-v/ows", {
      layers: "CADASTRALPARCELS.PCI_VECTEUR",
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      crs: L.CRS.EPSG3857,
      maxZoom: 21,
      opacity: 0.85,
      attribution: "IGN Cadastre",
    } as L.WMSOptions).addTo(map);

    // Couche routes & chemins — BD TOPO réseau routier (WMS vectoriel, fond transparent)
    // On applique un filtre CSS pour rendre les routes blanches et bien visibles sur le satellite
    const routesWms = L.tileLayer.wms("https://data.geopf.fr/wms-v/ows", {
      layers: "BDTOPO-GEOPO-RESEAU_ROUTIER_WLD_WGS84G",
      format: "image/png",
      transparent: true,
      version: "1.3.0",
      crs: L.CRS.EPSG3857,
      maxZoom: 21,
      opacity: 1,
      attribution: "IGN Routes",
      className: "routes-layer-white",
    } as L.WMSOptions).addTo(map);
    routesLayerRef.current = routesWms;
    
    // Échelle
    L.control.scale({ metric: true, imperial: false, position: "bottomright" }).addTo(map);
    
    leafletMap.current = map;
    polygonGroup.current = L.layerGroup().addTo(map);
    
    // Enedis layer groups (ajoutées sous le polygon du bâtiment)
    enedisLayerGroupsRef.current = createEnedisLayerGroups();
    
    // Annotation layer groups
    annotationLayersRef.current = createAnnotationLayerGroups();
    
    // --- Building drag: mousedown on map, check if inside building polygon ---
    const mapContainer = map.getContainer();
    
    const onMouseDown = (e: MouseEvent) => {
      // Ignore right-click
      if (e.button !== 0) return;
      
      const latlng = map.containerPointToLatLng(L.point(e.clientX - mapContainer.getBoundingClientRect().left, e.clientY - mapContainer.getBoundingClientRect().top));
      const corners = buildingCornersRef.current;
      if (corners.length < 4) return;
      
      if (pointInPolygon([latlng.lat, latlng.lng], corners)) {
        e.stopPropagation();
        e.preventDefault();
        isDraggingBuilding.current = true;
        dragOffset.current = {
          dLat: latRef.current - latlng.lat,
          dLng: lngRef.current - latlng.lng,
        };
        map.dragging.disable();
        mapContainer.style.cursor = "grabbing";
      }
    };
    
    const onMouseMove = (e: MouseEvent) => {
      if (!isDraggingBuilding.current) {
        // Show grab cursor when hovering over building
        const latlng = map.containerPointToLatLng(L.point(e.clientX - mapContainer.getBoundingClientRect().left, e.clientY - mapContainer.getBoundingClientRect().top));
        const corners = buildingCornersRef.current;
        if (corners.length >= 4 && pointInPolygon([latlng.lat, latlng.lng], corners)) {
          mapContainer.style.cursor = "grab";
        } else {
          mapContainer.style.cursor = "";
        }
        return;
      }
      
      const latlng = map.containerPointToLatLng(L.point(e.clientX - mapContainer.getBoundingClientRect().left, e.clientY - mapContainer.getBoundingClientRect().top));
      setLat(latlng.lat + dragOffset.current.dLat);
      setLng(latlng.lng + dragOffset.current.dLng);
    };
    
    const onMouseUp = () => {
      if (isDraggingBuilding.current) {
        isDraggingBuilding.current = false;
        map.dragging.enable();
        mapContainer.style.cursor = "";
        // Sync building anchor to final position after drag
        syncBuildingAnchorRef.current?.(latRef.current, lngRef.current);
        // Recharger parcelle + Enedis pour la nouvelle position
        reloadLocationDataRef.current?.(latRef.current, lngRef.current);
      }
    };
    
    mapContainer.addEventListener("mousedown", onMouseDown);
    document.addEventListener("mousemove", onMouseMove);
    document.addEventListener("mouseup", onMouseUp);

    // --- Drag & drop annotations from palette onto map ---
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("application/annotation-subtype")) {
        e.preventDefault();
        e.dataTransfer.dropEffect = "copy";
      }
    };

    const onDrop = (e: DragEvent) => {
      const subtype = e.dataTransfer?.getData("application/annotation-subtype");
      if (!subtype) return;
      e.preventDefault();
      const rect = mapContainer.getBoundingClientRect();
      const point = L.point(e.clientX - rect.left, e.clientY - rect.top);
      const latlng = map.containerPointToLatLng(point);
      // Use a custom event to communicate back to React state
      const detail = { subtype, lat: latlng.lat, lng: latlng.lng };
      mapContainer.dispatchEvent(new CustomEvent("annotation-drop", { detail }));
    };

    mapContainer.addEventListener("dragover", onDragOver);
    mapContainer.addEventListener("drop", onDrop);
    
    // Rotate marker — rotation arrow icon
    const hL = length / 2;
    const r = rotation * Math.PI / 180;
    const mLat = 111320;
    const mLng = 111320 * Math.cos(lat * Math.PI / 180);
    const rX = lat + (hL + 10) * Math.cos(r) / mLat;
    const rY = lng + (hL + 10) * Math.sin(r) / mLng;
    
    rotateMarker.current = L.marker([rX, rY], {
      draggable: true,
      icon: L.divIcon({
        html: `<div style="
          width:28px;height:28px;
          display:flex;align-items:center;justify-content:center;
          background:rgba(249,115,22,0.9);
          border:2px solid #fff;
          border-radius:50%;
          cursor:grab;
          box-shadow:0 2px 6px rgba(0,0,0,0.4);
          font-size:16px;
          color:#fff;
        ">↻</div>`,
        iconSize: [28, 28],
        iconAnchor: [14, 14],
        className: "",
      })
    }).addTo(map);
    
    rotateMarker.current.on("drag", (e: L.LeafletEvent) => {
      const p = (e.target as L.Marker).getLatLng();
      const cLat = latRef.current;
      const cLng = lngRef.current;
      const dLat = p.lat - cLat;
      const dLng = (p.lng - cLng) * Math.cos(cLat * Math.PI / 180);
      let angle = Math.atan2(dLng, dLat) * 180 / Math.PI;
      angle = ((angle % 360) + 360) % 360;
      setRotation(angle);
    });
    
    draw();
    
    return () => {
      mapContainer.removeEventListener("mousedown", onMouseDown);
      document.removeEventListener("mousemove", onMouseMove);
      document.removeEventListener("mouseup", onMouseUp);
      mapContainer.removeEventListener("dragover", onDragOver);
      mapContainer.removeEventListener("drop", onDrop);
      map.remove();
      leafletMap.current = null;
      // Reset les layer groups qui dépendent de la map pour éviter les refs fantômes
      parcelleLayerRef.current = null;
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  
  // Redraw on state change
  useEffect(() => {
    draw();
    // Don't re-center map during building drag (would be jarring)
    if (leafletMap.current && !isDraggingBuilding.current) {
      leafletMap.current.setView([lat, lng], leafletMap.current.getZoom());
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps  
  }, [lat, lng, rotation, length, totalWidth]);

  // Toggle couche cadastre WMS
  useEffect(() => {
    if (!leafletMap.current || !cadastreWmsRef.current) return;
    if (showCadastre) {
      if (!leafletMap.current.hasLayer(cadastreWmsRef.current)) {
        cadastreWmsRef.current.addTo(leafletMap.current);
      }
    } else {
      leafletMap.current.removeLayer(cadastreWmsRef.current);
    }
  }, [showCadastre]);

  // Toggle couche routes Plan IGN
  useEffect(() => {
    if (!leafletMap.current || !routesLayerRef.current) return;
    if (showRoutes) {
      if (!leafletMap.current.hasLayer(routesLayerRef.current)) {
        routesLayerRef.current.addTo(leafletMap.current);
      }
    } else {
      leafletMap.current.removeLayer(routesLayerRef.current);
    }
  }, [showRoutes]);

  // Redraw Enedis layers when data or visibility changes
  useEffect(() => {
    if (!leafletMap.current || !enedisLayerGroupsRef.current) return;
    drawAllEnedisLayers(
      leafletMap.current,
      enedisLayerGroupsRef.current,
      enedis.postes,
      enedis.lignesBt,
      enedis.lignesHta,
      enedis.visibility
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enedis.postes, enedis.lignesBt, enedis.lignesHta]);

  // Update Enedis layer visibility only (no redraw)
  useEffect(() => {
    if (!leafletMap.current || !enedisLayerGroupsRef.current) return;
    updateEnedisVisibility(leafletMap.current, enedisLayerGroupsRef.current, enedis.visibility);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enedis.visibility]);

  // Handler: charge le réseau Enedis autour de la position actuelle
  const handleLoadEnedis = useCallback(() => {
    enedis.loadNetwork(lat, lng);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  // Auto-charger le réseau Enedis au mount (une seule fois)
  const enedisAutoLoadedRef = useRef(false);
  useEffect(() => {
    if (enedisAutoLoadedRef.current) return;
    if (!lat || !lng) return;
    enedisAutoLoadedRef.current = true;
    enedis.loadNetwork(lat, lng);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  // Auto-charger les données parcellaires au mount (une seule fois)
  const parcelleAutoLoadedRef = useRef(false);
  useEffect(() => {
    if (parcelleAutoLoadedRef.current) return;
    if (!lat || !lng) return;
    parcelleAutoLoadedRef.current = true;
    // Au mount, on passe les corners si déjà calculés (sinon chargement sans multi-parcelle)
    parcelle.loadParcelle(lat, lng, buildingExactCornersRef.current.length > 0 ? buildingExactCornersRef.current : undefined);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  // Dessiner le contour de la parcelle cadastrale sur la carte
  useEffect(() => {
    if (!leafletMap.current) return;
    // Initialiser le layer group si nécessaire
    if (!parcelleLayerRef.current) {
      parcelleLayerRef.current = L.layerGroup().addTo(leafletMap.current);
    }
    parcelleLayerRef.current.clearLayers();

    /** Normalise Polygon / MultiPolygon → tableau de polygones (ring[][]) */
    const toPolygons = (g: GeoJSON.Geometry): GeoJSON.Position[][][] => {
      if (g.type === "MultiPolygon") return (g as GeoJSON.MultiPolygon).coordinates;
      if (g.type === "Polygon") return [(g as GeoJSON.Polygon).coordinates];
      return [];
    };

    /** Badge rond style annotation (cercle + label en dessous) */
    const ownedBadgeIcon = L.divIcon({
      className: "",
      iconSize: [40, 46],
      iconAnchor: [20, 23],
      html: `<div style="display:flex;flex-direction:column;align-items:center;pointer-events:none;">
        <div style="width:30px;height:30px;display:flex;align-items:center;justify-content:center;background:rgba(39,174,96,0.95);border:2px solid #fff;border-radius:50%;box-shadow:0 2px 6px rgba(0,0,0,0.3);font-size:16px;">🔑</div>
        <div style="margin-top:2px;background:rgba(0,0,0,0.7);color:#fff;padding:1px 4px;border-radius:3px;font-size:9px;font-weight:600;white-space:nowrap;line-height:12px;">Proprio</div>
      </div>`,
    });

    const geom = parcelle.info?.cadastreGeometry;

    // Parcelle principale — contour orange pointillé
    if (geom) {
      for (const polygon of toPolygons(geom as GeoJSON.Geometry)) {
        const latLngs = polygon.map((ring) =>
          ring.map(([lngCoord, latCoord]) => [latCoord, lngCoord] as [number, number])
        );
        L.polygon(latLngs, {
          color: "#e67e22",
          weight: 2,
          dashArray: "6 4",
          fillColor: "#e67e22",
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(parcelleLayerRef.current!);
      }
    }

    // Parcelles secondaires — vert si possédée, rouge sinon
    for (const sec of parcelle.info?.parcellesSecondaires ?? []) {
      const isOwned = ownedParcelleIdus.has(sec.cadastre.idu);
      const color = isOwned ? "#27ae60" : "#e74c3c";
      for (const polygon of toPolygons(sec.geometry as GeoJSON.Geometry)) {
        const latLngs = polygon.map((ring) =>
          ring.map(([lngCoord, latCoord]) => [latCoord, lngCoord] as [number, number])
        );
        const poly = L.polygon(latLngs, {
          color,
          weight: 2,
          dashArray: isOwned ? "8 4" : "4 6",
          fillColor: color,
          fillOpacity: isOwned ? 0.08 : 0.06,
          interactive: false,
        }).addTo(parcelleLayerRef.current!);
        // Badge "🔑 Proprio" rond (même style que les annotations)
        if (isOwned) {
          const center = poly.getBounds().getCenter();
          L.marker(center, {
            interactive: false,
            icon: ownedBadgeIcon,
          }).addTo(parcelleLayerRef.current!);
        }
      }
    }

    // Parcelles voisines ajoutées manuellement — toujours en vert (possédées)
    for (const mp of manualOwnedParcelles) {
      let firstPoly: L.Polygon | null = null;
      for (const polygon of toPolygons(mp.geometry as GeoJSON.Geometry)) {
        const latLngs = polygon.map((ring) =>
          ring.map(([lngCoord, latCoord]) => [latCoord, lngCoord] as [number, number])
        );
        const poly = L.polygon(latLngs, {
          color: "#27ae60",
          weight: 2,
          dashArray: "8 4",
          fillColor: "#27ae60",
          fillOpacity: 0.08,
          interactive: false,
        }).addTo(parcelleLayerRef.current!);
        if (!firstPoly) firstPoly = poly;
      }
      // Badge "🔑 Proprio" rond — positionné au point de drop (ou centroïde si chargé depuis DB)
      const badgePos: L.LatLngExpression = mp.dropLatLng
        ? mp.dropLatLng
        : firstPoly
          ? firstPoly.getBounds().getCenter()
          : [0, 0];
      L.marker(badgePos, {
        interactive: false,
        icon: ownedBadgeIcon,
      }).addTo(parcelleLayerRef.current!);
    }

  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [parcelle.info?.cadastreGeometry, parcelle.info?.parcellesSecondaires, ownedParcelleIdus, manualOwnedParcelles]);

  // Sauvegarder le contexte Enedis en base quand les données changent
  useEffect(() => {
    const ctx = enedis.getContext();
    if (ctx && ctx.summary.postesCount + ctx.summary.lignesBtCount + ctx.summary.lignesHtaCount > 0) {
      saveEnedisContext(projectId, ctx).catch(() => {
        // Erreur de sauvegarde non bloquante
      });
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [enedis.timestamp, projectId]);

  // Search
  async function search() {
    if (!address) return;
    try {
      const res = await fetch(`https://nominatim.openstreetmap.org/search?format=json&q=${encodeURIComponent(address)}&limit=1`);
      const d = await res.json();
      if (d[0]) {
        const newLat = parseFloat(d[0].lat);
        const newLng = parseFloat(d[0].lon);
        setLat(newLat);
        setLng(newLng);
        // Calculer les coins du bâtiment pour la nouvelle position
        const mLat = 111320;
        const mLng = 111320 * Math.cos(newLat * Math.PI / 180);
        const hL = length / 2;
        const hW = totalWidth / 2;
        const r = rotation * Math.PI / 180;
        const pt = (dL: number, dW: number): [number, number] => [
          newLat + (dL * Math.cos(r) - dW * Math.sin(r)) / mLat,
          newLng + (dL * Math.sin(r) + dW * Math.cos(r)) / mLng,
        ];
        const corners: [number, number][] = [pt(-hL, -hW), pt(hL, -hW), pt(hL, hW), pt(-hL, hW)];
        // Recharger les données parcellaires et réseau Enedis pour la nouvelle position
        parcelle.loadParcelle(newLat, newLng, corners);
        enedis.loadNetwork(newLat, newLng);
      }
    } catch { /* ignore */ }
  }

  // Save
  async function save() {
    setSaving(true);
    setMsg("");
    try {
      const mLat = 111320;
      const mLng = 111320 * Math.cos(lat * Math.PI / 180);
      const hL = length / 2;
      const hW = totalWidth / 2;
      const r = rotation * Math.PI / 180;
      
      const pt = (dL: number, dW: number): [number, number] => [
        lng + (dL * Math.sin(r) + dW * Math.cos(r)) / mLng,
        lat + (dL * Math.cos(r) - dW * Math.sin(r)) / mLat
      ];
      
      const coords: [number, number][] = [
        pt(-hL, -hW), pt(hL, -hW), pt(hL, hW), pt(-hL, hW), pt(-hL, -hW)
      ];
      
      // Sauvegarder localisation + données parcellaires en parallèle
      const promises: Promise<unknown>[] = [
        saveBuildingLocation(projectId, {
          centroidLat: lat,
          centroidLon: lng,
          orientationDeg: rotation,
          azimuthPanADeg: azPanA,
          azimuthPanBDeg: azPanB,
          polygon: { type: "Polygon", coordinates: [coords] }
        }),
      ];

      // Sauvegarder aussi les données parcellaires en cache DB
      if (parcelle.info) {
        promises.push(saveParcelleData(projectId, parcelle.info));
      }

      const results = await Promise.all(promises);
      const locationRes = results[0] as { success: boolean };
      
      setMsg(locationRes.success ? "✓ OK" : "Erreur");
    } catch {
      setMsg("Erreur");
    }
    setSaving(false);
  }

  // Exposer save() au parent via ref (pour le bouton "Valider l'étape" du wizard)
  useEffect(() => {
    if (!saveRef) return;
    saveRef.current = async () => {
      try {
        await save();
        return true;
      } catch {
        return false;
      }
    };
    return () => { if (saveRef) saveRef.current = null; };
  });

  // ============================================================================
  // ANNOTATION CALLBACKS
  // ============================================================================

  // Current callbacks (recreated each render with fresh closures)
  const annotationCallbacksCurrent: AnnotationCallbacks = {
    onPointDragEnd: (id, newLat, newLng) => {
      anno.movePoint(id, newLat, newLng);
    },
    onAnnotationClick: (id) => {
      if (anno.toolMode.type === "draw-line") {
        const mode = anno.toolMode;
        if (mode.startId === "") {
          // Waiting for start point — set this annotation as start
          const target = anno.findById(id);
          if (!target) return;
          // For building anchor, snap to nearest edge
          let startLatLng: [number, number];
          if (target.type === "anchor" && target.subtype === "batiment" && buildingExactCornersRef.current.length >= 3 && drawCursorRef.current) {
            const snap = findNearestSnapPoint(
              leafletMap.current!,
              drawCursorRef.current,
              anno.annotations,
              "",
              buildingExactCornersRef.current
            );
            startLatLng = snap?.latLng ?? drawCursorRef.current;
          } else {
            const targetGeom = target.geometry as GeoJSONPoint;
            startLatLng = [targetGeom.coordinates[1], targetGeom.coordinates[0]];
          }
          anno.setToolMode({
            type: "draw-line",
            startId: id,
            vertices: [startLatLng],
          });
          return;
        }
        // Already drawing — finish the line to this endpoint
        if (id === mode.startId) return; // ignore click on start point
        const target = anno.findById(id);
        if (!target) return;
        // For building anchor, snap line endpoint to nearest edge
        let endLatLng: [number, number];
        if (target.type === "anchor" && target.subtype === "batiment" && buildingExactCornersRef.current.length >= 3 && drawCursorRef.current) {
          // Use the snap system to find edge point
          const snap = findNearestSnapPoint(
            leafletMap.current!,
            drawCursorRef.current,
            anno.annotations,
            mode.startId,
            buildingExactCornersRef.current
          );
          endLatLng = snap?.latLng ?? drawCursorRef.current;
        } else {
          const targetGeom = target.geometry as GeoJSONPoint;
          endLatLng = [targetGeom.coordinates[1], targetGeom.coordinates[0]];
        }
        
        const allVertices = [...mode.vertices, endLatLng];
        const geoCoords: [number, number][] = allVertices.map(
          (v) => [v[1], v[0]] as [number, number]
        );
        anno.addLine(geoCoords, mode.startId, id).then((result) => {
          if (!result) console.error("[Câble] Échec sauvegarde ligne");
          anno.setToolMode({ type: "idle" });
          if (annotationLayersRef.current) clearLinePreview(annotationLayersRef.current);
        });
      } else if (anno.toolMode.type === "idle") {
        // idle — no action, let popup open
      }
    },
    onDeletePoint: (id) => {
      anno.remove(id);
    },
    onUpdateNote: (id, note) => {
      anno.updateMeta(id, { note });
    },
    onLineVertexDrag: () => {
      // Visual-only during drag, handled by Leaflet marker drag
    },
    onLineVertexDragEnd: (lineId, newCoords) => {
      anno.updateLine(lineId, newCoords);
    },
    onDeleteLine: (id) => {
      anno.remove(id);
    },
  };

  // Keep ref in sync so Leaflet markers always call the latest callbacks
  annotationCallbacksRef.current = annotationCallbacksCurrent;

  // Stable proxy that delegates through the ref (never stale)
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const annotationCallbacks: AnnotationCallbacks = useMemo(() => ({
    onPointDragEnd: (id: string, lat: number, lng: number) =>
      annotationCallbacksRef.current?.onPointDragEnd(id, lat, lng),
    onAnnotationClick: (id: string) =>
      annotationCallbacksRef.current?.onAnnotationClick(id),
    onDeletePoint: (id: string) =>
      annotationCallbacksRef.current?.onDeletePoint(id),
    onUpdateNote: (id: string, note: string) =>
      annotationCallbacksRef.current?.onUpdateNote(id, note),
    onLineVertexDrag: (lineId: string, vertexIndex: number, lat: number, lng: number) =>
      annotationCallbacksRef.current?.onLineVertexDrag(lineId, vertexIndex, lat, lng),
    onLineVertexDragEnd: (lineId: string, newCoords: [number, number][]) =>
      annotationCallbacksRef.current?.onLineVertexDragEnd(lineId, newCoords),
    onDeleteLine: (id: string) =>
      annotationCallbacksRef.current?.onDeleteLine(id),
  }), []);

  // ============================================================================
  // ANNOTATION HANDLERS
  // ============================================================================

  const handleStartDrawLine = useCallback(() => {
    // Enter "waiting for start click" — we set draw-line with empty startId
    // The actual start will be set on first annotation click
    anno.setToolMode({ type: "idle" });
    // Use a temporary state: we'll set draw-line mode when user clicks on a point
    // For simplicity, enter draw mode immediately — user must click an object first
    anno.setToolMode({ type: "draw-line", startId: "", vertices: [] });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const handleCancelTool = useCallback(() => {
    anno.setToolMode({ type: "idle" });
    if (annotationLayersRef.current) clearLinePreview(annotationLayersRef.current);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ============================================================================
  // ANNOTATION EFFECTS
  // ============================================================================

  // Load annotations on mount
  useEffect(() => {
    anno.load();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Handle drag & drop from palette onto map
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    const container = map.getContainer();

    const onAnnotationDrop = (e: Event) => {
      const { subtype, lat: dropLat, lng: dropLng } = (e as CustomEvent).detail as {
        subtype: string;
        lat: number;
        lng: number;
      };

      // 🔑 Proprio — identifier la parcelle sous le drop et la marquer owned
      if (subtype === "proprio") {
        (async () => {
          try {
            const geom = encodeURIComponent(JSON.stringify({ type: "Point", coordinates: [dropLng, dropLat] }));
            const [cadRes, gpuRes] = await Promise.all([
              fetch(`https://apicarto.ign.fr/api/cadastre/parcelle?geom=${geom}`),
              fetch(`https://apicarto.ign.fr/api/gpu/zone-urba?geom=${geom}`),
            ]);
            const cadJson = await cadRes.json() as { features?: { geometry: GeoJSON.MultiPolygon; properties: CadastreProperties }[] };
            const gpuJson = await gpuRes.json() as { features?: { properties: ZoneUrbaProperties }[] };
            const feat = cadJson.features?.[0];
            if (!feat) return;
            const droppedIdu = feat.properties.idu;
            // Ne pas re-ajouter la parcelle principale (elle est toujours considérée proprio)
            const mainIdu = parcelleInfoRef.current?.cadastre?.idu;
            if (droppedIdu === mainIdu) return;
            // Déjà dans ownedParcelleIdus ? → rien à faire
            if (manualOwnedRef.current.some(p => p.cadastre.idu === droppedIdu)) return;
            const zoneUrba = gpuJson.features?.[0]?.properties ?? null;
            // Vérifier si c'est une parcelle secondaire déjà détectée
            const isSecondary = parcelleInfoRef.current?.parcellesSecondaires?.some(
              (s: { cadastre: CadastreProperties }) => s.cadastre.idu === droppedIdu
            );
            // Toujours ajouter dans le set ownedParcelleIdus
            setOwnedParcelleIdus(prev => {
              const next = new Set(prev);
              next.add(droppedIdu);
              return next;
            });
            // Source = "secondary" si c'est une parcelle secondaire déjà connue, sinon "manual"
            const source = isSecondary ? "secondary" : "manual";
            // N'ajouter dans manualOwnedParcelles QUE si c'est une parcelle "manual" (pas déjà secondaire)
            if (!isSecondary) {
              setManualOwnedParcelles(prev => [...prev, {
                cadastre: feat.properties,
                geometry: feat.geometry,
                zoneUrba,
                dropLatLng: [dropLat, dropLng],
              }]);
            }
            addOwnedParcelle(projectId, {
              idu: droppedIdu,
              source,
              cadastreProps: feat.properties,
              geometry: feat.geometry,
              zoneUrba,
            }).catch(() => { /* non bloquant */ });
          } catch (err) {
            console.warn("[proprio-drop] Erreur:", err);
          }
        })();
        return;
      }

      anno.addPoint(subtype as PointSubtype, dropLat, dropLng);
    };

    container.addEventListener("annotation-drop", onAnnotationDrop);
    return () => {
      container.removeEventListener("annotation-drop", onAnnotationDrop);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Sync building anchor when building position changes
  useEffect(() => {
    if (!isDraggingBuilding.current) {
      anno.syncBuildingAnchor(lat, lng);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lat, lng]);

  // Redraw annotations when they change
  useEffect(() => {
    if (!leafletMap.current || !annotationLayersRef.current) return;
    drawAnnotations(
      leafletMap.current,
      annotationLayersRef.current,
      anno.annotations,
      annotationCallbacks
    );
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno.annotations]);

  // Map click handler for placing points and drawing lines
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;

    const onMapClick = (e: L.LeafletMouseEvent) => {
      const { lat: clickLat, lng: clickLng } = e.latlng;

      if (anno.toolMode.type === "draw-line") {
        const mode = anno.toolMode;

        if (mode.startId === "") {
          // Waiting for first click — try to snap to a nearby point
          const snap = findNearestSnapPoint(map, [clickLat, clickLng], anno.annotations, undefined, buildingExactCornersRef.current);
          if (snap) {
            // Use the snap latLng (could be building edge, not center)
            const startLatLng: [number, number] = snap.latLng;
            anno.setToolMode({
              type: "draw-line",
              startId: snap.annotation.id,
              vertices: [startLatLng],
            });
          }
          // If no snap, ignore click (must click on/near a point)
          return;
        }

        // Already drawing — check if click is near an existing endpoint
        const snap = findNearestSnapPoint(
          map,
          [clickLat, clickLng],
          anno.annotations,
          mode.startId, // exclude the start point itself
          buildingExactCornersRef.current
        );

        if (snap) {
          // Snap to endpoint → finish the line automatically (use edge point, not center)
          const endLatLng: [number, number] = snap.latLng;
          const allVertices = [...mode.vertices, endLatLng];
          const geoCoords: [number, number][] = allVertices.map(
            (v) => [v[1], v[0]] as [number, number]
          );
          // Await save then clear preview
          anno.addLine(geoCoords, mode.startId, snap.annotation.id).then((result) => {
            if (!result) console.error("[Câble] Échec sauvegarde ligne");
            anno.setToolMode({ type: "idle" });
            if (annotationLayersRef.current) clearLinePreview(annotationLayersRef.current);
          });
        } else {
          // No snap — add intermediate vertex
          anno.setToolMode({
            ...mode,
            vertices: [...mode.vertices, [clickLat, clickLng]],
          });
        }
      }
    };

    const onMapDblClick = (e: L.LeafletMouseEvent) => {
      if (anno.toolMode.type === "draw-line" && anno.toolMode.startId !== "") {
        const mode = anno.toolMode;
        const allVertices = [...mode.vertices, [e.latlng.lat, e.latlng.lng] as [number, number]];
        const geoCoords: [number, number][] = allVertices.map(
          (v) => [v[1], v[0]] as [number, number]
        );
        anno.addLine(geoCoords, mode.startId, null).then((result) => {
          if (!result) console.error("[Câble] Échec sauvegarde ligne (dblclick)");
          anno.setToolMode({ type: "idle" });
          if (annotationLayersRef.current) clearLinePreview(annotationLayersRef.current);
        });
      }
    };

    map.on("click", onMapClick);
    map.on("dblclick", onMapDblClick);

    return () => {
      map.off("click", onMapClick);
      map.off("dblclick", onMapDblClick);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno.toolMode]);

  // Line drawing preview (follow cursor) + snap indicator
  useEffect(() => {
    const map = leafletMap.current;
    if (!map || !annotationLayersRef.current) return;
    if (anno.toolMode.type !== "draw-line") {
      clearLinePreview(annotationLayersRef.current);
      return;
    }

    const mode = anno.toolMode;

    const onMouseMove = (e: L.LeafletMouseEvent) => {
      if (!annotationLayersRef.current || anno.toolMode.type !== "draw-line") return;
      drawCursorRef.current = [e.latlng.lat, e.latlng.lng];

      const startId = anno.toolMode.startId || undefined;

      // Check for snap target near cursor
      const snap = findNearestSnapPoint(
        map,
        [e.latlng.lat, e.latlng.lng],
        anno.annotations,
        startId,
        buildingExactCornersRef.current
      );

      if (mode.vertices.length > 0) {
        // Already drawing — show preview line snapping to point if close
        const previewCursor: [number, number] = snap
          ? snap.latLng
          : drawCursorRef.current;

        drawLinePreview(
          annotationLayersRef.current,
          mode.vertices,
          previewCursor
        );
      } else {
        // Waiting for start point — just clear preview
        clearLinePreview(annotationLayersRef.current);
      }

      // Draw snap indicator halo (for both start and end)
      drawSnapIndicator(
        annotationLayersRef.current,
        snap ? snap.latLng : null
      );

      // Change cursor to indicate "connectable"
      map.getContainer().style.cursor = snap ? "pointer" : "crosshair";
    };

    map.on("mousemove", onMouseMove);
    return () => {
      map.off("mousemove", onMouseMove);
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno.toolMode]);

  // Escape key to cancel tool
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleCancelTool();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => document.removeEventListener("keydown", onKeyDown);
  }, [handleCancelTool]);

  // Update cursor based on tool mode
  useEffect(() => {
    const map = leafletMap.current;
    if (!map) return;
    const container = map.getContainer();
    if (anno.toolMode.type === "place") {
      container.style.cursor = "crosshair";
    } else if (anno.toolMode.type === "draw-line") {
      container.style.cursor = "crosshair";
    } else {
      container.style.cursor = "";
    }
    return () => {
      container.style.cursor = "";
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [anno.toolMode.type]);

  return (
    <div className="h-full flex flex-col">
      <div className="p-2 bg-white border-b flex gap-2 items-center">
        <input 
          className="flex-1 border px-2 py-1 rounded text-sm"
          placeholder="Adresse..."
          value={address}
          onChange={e => setAddress(e.target.value)}
          onKeyDown={e => e.key === "Enter" && search()}
        />
        <button onClick={search} className="px-2 py-1 border rounded">🔍</button>
        <button onClick={() => setRotation(0)} className="px-2 py-1 border rounded">↻</button>
        <button onClick={save} disabled={saving} className="px-3 py-1 bg-blue-600 text-white rounded">
          {saving ? "..." : "💾"}
        </button>
        {msg && <span className="text-sm">{msg}</span>}
      </div>
      
      <div className="flex-1 relative">
        <div ref={mapRef} className="absolute inset-0" />
        
        {/* Left panels stacked vertically */}
        <div className="absolute top-2 left-2 z-[1000] flex flex-col gap-2">
          {/* Enedis control panel */}
          <EnedisControlPanel
            visibility={enedis.visibility}
            onToggle={enedis.toggleLayer}
            loading={enedis.loading}
            error={enedis.error}
            onLoad={handleLoadEnedis}
            nearestPoste={enedis.nearestPoste}
            postesCount={enedis.postes.length}
            lignesBtCount={enedis.lignesBt.length}
            lignesHtaCount={enedis.lignesHta.length}
            timestamp={enedis.timestamp}
            warnings={enedis.warnings}
          />

          {/* Annotation palette */}
          <AnnotationPalette
            toolMode={anno.toolMode}
            onStartDrawLine={handleStartDrawLine}
            onCancel={handleCancelTool}
            annotations={anno.annotations}
            ownedParcelleCount={manualOwnedParcelles.length}
          />
        </div>

        <div data-map-overlay className="absolute top-2 right-2 bg-white/90 p-3 rounded shadow z-[1000] text-sm max-h-[calc(100%-1rem)] overflow-y-auto w-[280px]">
          <div className="font-bold mb-2">📍 Position</div>
          <div>Lat: {lat.toFixed(6)}°</div>
          <div>Lng: {lng.toFixed(6)}°</div>
          <div>Rotation: {rotation.toFixed(1)}° ({cardinal(rotation)})</div>
          <hr className="my-2"/>
          <div className="text-blue-600">🔵 Pan A: {azPanA.toFixed(0)}° ({cardinal(azPanA)})</div>
          <div className="text-orange-500">🟠 Pan B: {azPanB.toFixed(0)}° ({cardinal(azPanB)})</div>
          <hr className="my-2"/>
          <div className="text-gray-500 text-xs">{length}m × {totalWidth}m</div>

          {/* --- Parcelle / Cadastre --- */}
          <hr className="my-2"/>
          <div className="flex items-center justify-between mb-1 gap-1">
            <div className="font-bold">🗺️ Parcelle</div>
            <div className="flex gap-1">
              <button
                onClick={() => setShowRoutes(v => !v)}
                className={`text-xs px-2 py-0.5 rounded ${showRoutes ? "bg-blue-100 text-blue-700" : "bg-gray-100 text-gray-400"}`}
              >
                {showRoutes ? "🛤️ Routes ON" : "🛤️ Routes OFF"}
              </button>
              <button
                onClick={() => setShowCadastre(v => !v)}
                className={`text-xs px-2 py-0.5 rounded ${showCadastre ? "bg-orange-100 text-orange-700" : "bg-gray-100 text-gray-400"}`}
              >
                {showCadastre ? "📐 Cadastre ON" : "📐 Cadastre OFF"}
              </button>
            </div>
          </div>

          {/* Loading skeleton avec barre de progression */}
          {parcelle.loading && (
            <div className="space-y-2">
              {/* Barre de progression animée */}
              <div className="w-full bg-gray-200 rounded-full h-1.5 overflow-hidden relative">
                <div className="absolute h-full bg-gradient-to-r from-orange-400 via-orange-500 to-orange-400 rounded-full animate-[progress-slide_1.8s_ease-in-out_infinite]" />
              </div>
              <div className="text-xs text-gray-400 text-center animate-pulse">Analyse du site en cours…</div>

              {/* Skeleton — Cadastre */}
              <div className="space-y-1.5 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-3/4" />
                <div className="h-3 bg-gray-200 rounded w-1/2" />
                <div className="h-2.5 bg-gray-100 rounded w-5/6" />
              </div>

              {/* Skeleton — Environnement */}
              <hr className="my-2"/>
              <div className="space-y-1.5 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-1/3" />
                <div className="h-2.5 bg-gray-100 rounded w-3/5" />
                <div className="h-2.5 bg-gray-100 rounded w-1/2" />
                <div className="h-2.5 bg-gray-100 rounded w-3/5" />
              </div>

              {/* Skeleton — Risques (masqué pour gagner de la place, données toujours chargées) */}
              {/* <hr className="my-2"/>
              <div className="space-y-1.5 animate-pulse">
                <div className="h-3 bg-gray-200 rounded w-2/5" />
                <div className="h-2.5 bg-gray-100 rounded w-3/4" />
                <div className="h-2.5 bg-gray-100 rounded w-2/3" />
              </div> */}
            </div>
          )}

          {parcelle.error && (
            <div className="text-red-500 text-xs">{parcelle.error}</div>
          )}
          {parcelle.info?.cadastre && (
            <div className="space-y-0.5">
              <div className="text-xs flex items-center gap-1">
                📋 <span className="font-semibold">{parcelle.info.cadastre.section}-{parcelle.info.cadastre.numero}</span>
                <span className="text-gray-500">({parcelle.info.cadastre.contenance} m²)</span>
                <span className="ml-auto text-[10px] text-green-600 font-semibold">✅ Propriétaire</span>
              </div>
              <div className="text-xs text-gray-600">
                🏘️ {parcelle.info.cadastre.nom_com} ({parcelle.info.cadastre.code_dep})
              </div>
              <div className="text-xs text-gray-400">
                INSEE {parcelle.info.cadastre.code_insee} · IDU {parcelle.info.cadastre.idu}
              </div>
              {parcelle.info.adresseLabel && (
                <div className="text-xs mt-1">
                  📍 <span className="font-semibold">{parcelle.info.adresseLabel}</span>
                </div>
              )}
            </div>
          )}

          {/* Parcelles secondaires (bâtiment à cheval) — statut proprio automatique via 🔑 */}
          {parcelle.info && parcelle.info.parcellesSecondaires.length > 0 && (
            <div className="mt-1 space-y-1">
              <div className="text-[10px] text-orange-600 font-semibold">⚠️ Bâtiment à cheval sur {parcelle.info.parcellesSecondaires.length + 1} parcelles</div>
              {parcelle.info.parcellesSecondaires.map((p, i) => {
                const idu = p.cadastre.idu;
                const isOwned = ownedParcelleIdus.has(idu);
                return (
                  <div key={i} className={`text-xs pl-2 border-l-2 ${isOwned ? "border-green-400 bg-green-50" : "border-red-300 bg-red-50"} rounded-r`}>
                    <div className="flex items-center gap-1">
                      📋 <span className="font-semibold">{p.cadastre.section}-{p.cadastre.numero}</span>
                      <span className="text-gray-500">({p.cadastre.contenance} m²)</span>
                      {isOwned ? (
                        <button
                          onClick={() => {
                            setOwnedParcelleIdus(prev => {
                              const next = new Set(prev);
                              next.delete(idu);
                              return next;
                            });
                            removeOwnedParcelle(projectId, idu).catch(() => {});
                          }}
                          className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-green-100 text-green-700 hover:bg-red-100 hover:text-red-600 font-semibold"
                          title="Retirer le statut propriétaire"
                        >
                          ✅ Proprio ✕
                        </button>
                      ) : (
                        <span className="ml-auto text-[10px] font-semibold text-red-500">
                          ❌ Non proprio
                        </span>
                      )}
                    </div>
                    <div className="text-gray-400 text-[10px]">{p.cadastre.nom_com} · IDU {p.cadastre.idu}</div>
                    {!isOwned && (
                      <div className="text-[10px] text-red-500 mt-0.5">
                        ⚠ Glisser 🔑 Proprio sur cette parcelle pour la déclarer
                      </div>
                    )}
                  </div>
                );
              })}
              {ownedParcelleIdus.size > 0 && (
                <div className="text-[10px] text-green-600 mt-0.5">
                  ℹ️ Les limites entre parcelles du même propriétaire sont ignorées pour le calcul PLU
                </div>
              )}
            </div>
          )}

          {/* Parcelles voisines ajoutées manuellement comme possédées */}
          {manualOwnedParcelles.length > 0 && (
            <div className="mt-1 space-y-1">
              <div className="text-[10px] text-green-600 font-semibold">🔑 Parcelles propriétaire</div>
              {manualOwnedParcelles.map((mp, i) => (
                <div key={mp.cadastre.idu} className="text-xs pl-2 border-l-2 border-green-400 bg-green-50 rounded-r">
                  <div className="flex items-center gap-1">
                    📋 <span className="font-semibold">{mp.cadastre.section}-{mp.cadastre.numero}</span>
                    <span className="text-gray-500">({mp.cadastre.contenance} m²)</span>
                    <button
                      onClick={() => {
                        setManualOwnedParcelles(prev => prev.filter((_, idx) => idx !== i));
                        setOwnedParcelleIdus(prev => {
                          const next = new Set(prev);
                          next.delete(mp.cadastre.idu);
                          return next;
                        });
                        // Supprimer de la base
                        removeOwnedParcelle(projectId, mp.cadastre.idu).catch(() => { /* non bloquant */ });
                      }}
                      className="ml-auto text-[10px] px-1.5 py-0.5 rounded bg-red-100 text-red-600 hover:bg-red-200 font-semibold"
                      title="Retirer cette parcelle"
                    >
                      ✕ Retirer
                    </button>
                  </div>
                  <div className="text-gray-400 text-[10px]">{mp.cadastre.nom_com} · IDU {mp.cadastre.idu}</div>
                </div>
              ))}
            </div>
          )}



          {/* Natura 2000 — affiché uniquement si des sites sont détectés */}
          {parcelle.info && parcelle.info.natura2000.length > 0 && (
            <>
              <hr className="my-2"/>
              <div className="font-bold mb-1 text-xs">🦎 Natura 2000</div>
              {parcelle.info.natura2000.map((site, i) => (
                <div key={i} className="text-xs text-green-700">
                  {site.sitename} ({site.sitetype})
                </div>
              ))}
            </>
          )}

          {/* --- Analyse technique PLU --- */}
          <PluAnalysisPanel analysis={pluAnalysis} loading={parcelle.loading} />

          {/* --- Données environnementales (altitude, océan, vent) --- */}
          {parcelle.info && !parcelle.loading && (
            <>
              <hr className="my-2"/>
              <div className="font-bold mb-1 text-xs">🌍 Environnement</div>
              <div className="space-y-0.5">
                {/* Altitude */}
                <div className="text-xs">
                  🏔️ Altitude :{" "}
                  {parcelle.info.altitudeM !== null
                    ? <span className="font-semibold">{parcelle.info.altitudeM} m</span>
                    : <span className="text-gray-400">N/A</span>
                  }
                </div>

                {/* Distance océan */}
                <div className="text-xs">
                  🌊 Océan :{" "}
                  {parcelle.info.distanceOceanKm !== null ? (
                    <>
                      <span className={`font-semibold ${parcelle.info.isProximiteOcean ? "text-red-600" : ""}`}>
                        {parcelle.info.distanceOceanKm} km
                      </span>
                      {parcelle.info.isProximiteOcean && (
                        <span className="ml-1 text-red-600 font-bold">
                          ⚠️ &lt; 3km → +15€/m² galva
                        </span>
                      )}
                    </>
                  ) : (
                    <span className="text-gray-400">&gt; 100 km (non côtier)</span>
                  )}
                </div>

                {/* Vent — Zone Eurocode */}
                <div className="text-xs">
                  💨 Vent :{" "}
                  {parcelle.info.zoneVent !== null ? (
                    <span className={`font-semibold ${
                      parcelle.info.zoneVent === 1 ? "text-green-600" :
                      parcelle.info.zoneVent === 2 ? "text-blue-600" :
                      parcelle.info.zoneVent === 3 ? "text-orange-600" :
                      "text-red-600"
                    }`}>
                      Zone {parcelle.info.zoneVent} — {parcelle.info.ventVb0Ms} m/s ({parcelle.info.ventVb0Kmh} km/h)
                    </span>
                  ) : (
                    <span className="text-gray-400">N/A</span>
                  )}
                </div>
              </div>
            </>
          )}

          {/* Risques naturels — masqué pour gagner de la place (données toujours disponibles dans parcelle.info.risques) */}
          {/* {parcelle.info && parcelle.info.risques.length > 0 && (() => {
            const n = parcelle.info!.risques.length;
            const level = n <= 3 ? { label: "Faible", color: "text-green-600" }
              : n <= 5 ? { label: "Normal", color: "text-amber-600" }
              : n <= 7 ? { label: "Élevé", color: "text-orange-600" }
              : { label: "Critique", color: "text-red-600" };
            return (
            <>
              <hr className="my-2"/>
              <div className="font-bold mb-1 text-xs">
                ⚠️ Risques ({n}){" "}
                <span className={`font-semibold ${level.color}`}>— {level.label}</span>
              </div>
              <div className="space-y-0.5">
                {parcelle.info!.risques.map((r, i) => (
                  <div key={i} className="text-xs text-amber-700">
                    • {r.libelle_risque_long}
                  </div>
                ))}
              </div>
            </>
            );
          })()}
          {parcelle.info && parcelle.info.risques.length === 0 && !parcelle.loading && (
            <>
              <hr className="my-2"/>
              <div className="text-xs text-gray-400">⚠️ Aucun risque identifié</div>
            </>
          )} */}

        </div>

        {/* Légende Enedis + Routes — bandeau horizontal en bas */}
        <EnedisLegend visible={enedis.postes.length > 0 || enedis.lignesBt.length > 0 || enedis.lignesHta.length > 0} showRoutes={showRoutes} />
      </div>
    </div>
  );
}
