import { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, useMap, useMapEvents } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Coloured circles instead of Leaflet's default image pins (cached so they are not rebuilt every render)
const iconCache = {};
function pinIcon(category, status, selected) {
  const key = `${category}-${status}-${selected}`;
  if (!iconCache[key]) {
    iconCache[key] = L.divIcon({
      className: 'pin-wrap',
      html: `<span class="pin c-${category} s-${status} ${selected ? 'sel' : ''}"></span>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13],
    });
  }
  return iconCache[key];
}

const pickedIcon = L.divIcon({
  className: 'pin-wrap',
  html: '<span class="pin picked"></span>',
  iconSize: [26, 26],
  iconAnchor: [13, 13],
});

function ClickToPick({ enabled, onPick }) {
  useMapEvents({
    click(e) {
      if (enabled) onPick(e.latlng.lat, e.latlng.lng);
    },
  });
  return null;
}

function FlyTo({ target }) {
  const map = useMap();
  useEffect(() => {
    if (target) map.flyTo([target.lat, target.lng], Math.max(map.getZoom(), 16));
  }, [target, map]);
  return null;
}

// Used when the community has no saved centre: zoom to wherever the reports are
function FitToReports({ reports, enabled }) {
  const map = useMap();
  useEffect(() => {
    if (!enabled || reports.length === 0) return;
    const bounds = L.latLngBounds(reports.map((r) => [Number(r.lat), Number(r.lng)]));
    map.fitBounds(bounds, { padding: [40, 40], maxZoom: 15 });
  }, [enabled, reports, map]);
  return null;
}

export default function MapView({
  reports, center, zoom, fit, picking, picked, onPick, selectedId, onSelect, focus,
}) {
  return (
    <div className={`map-box ${picking ? 'picking' : ''}`}>
      <MapContainer center={center} zoom={zoom} scrollWheelZoom style={{ height: '100%', width: '100%' }}>
        <TileLayer
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <ClickToPick enabled={picking} onPick={onPick} />
        <FlyTo target={focus} />
        <FitToReports reports={reports} enabled={fit} />

        {reports.map((r) => (
          <Marker
            key={`${r.id}-${picking}`}
            position={[Number(r.lat), Number(r.lng)]}
            icon={pinIcon(r.category, r.status, r.id === selectedId)}
            zIndexOffset={r.id === selectedId ? 1000 : 0}
            interactive={!picking}
            eventHandlers={{ click: () => onSelect(r.id) }}
          />
        ))}

        {picked && <Marker position={[picked.lat, picked.lng]} icon={pickedIcon} interactive={false} />}
      </MapContainer>
    </div>
  );
}