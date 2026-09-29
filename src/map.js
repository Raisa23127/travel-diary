// =========================================================
// map.js — модуль карты на Leaflet
// =========================================================

const TravelMap = (() => {
    let map = null;
    let markersLayer = null;
    let routeLine = null;
    let meMarker = null;
    let pickingMarker = null;
    let routeVisible = true;
    let labelsVisible = true;
    let tileLayer = null;
    let currentStyle = 'map';
    let onEditRequest = null;
    let onDeleteRequest = null;

    const DEFAULT_CENTER = [61.5240, 105.3188];
    const DEFAULT_ZOOM = 4;

    const STYLES = {
        map:    { l: 'map',     label: '🗺 Карта',   maxZoom: 19 },
        sat:    { l: 'sat',     label: '🛰 Спутник', maxZoom: 19 },
        hybrid: { l: 'sat,skl', label: '🌐 Гибрид',  maxZoom: 19 },
        skl:    { l: 'skl',     label: '📝 Схема',   maxZoom: 19 }
    };

    function makeTileUrl(styleKey) {
        const conf = STYLES[styleKey] || STYLES.map;
        return `https://core-renderer-tiles.maps.yandex.net/tiles?l=${conf.l}&x={x}&y={y}&z={z}&scale=1&lang=ru_RU&projection=web_mercator`;
    }

    function init(handlers = {}) {
        onEditRequest   = handlers.onEdit;
        onDeleteRequest = handlers.onDelete;

        map = L.map('map', {
            worldCopyJump: true, zoomControl: true, minZoom: 3,
            attributionControl: false
        }).setView(DEFAULT_CENTER, DEFAULT_ZOOM);

        setStyle(currentStyle);

        markersLayer = L.layerGroup().addTo(map);
        routeLine = L.polyline([], {
            color: '#4f46e5', weight: 4, opacity: 0.8, dashArray: '10, 8'
        }).addTo(map);

        map.on('click', e => {
            const { lat, lng } = e.latlng;
            setPickingMarker(lat, lng);
            if (window.__onMapClick) window.__onMapClick(lat, lng);
        });
    }

    function setPickingMarker(lat, lng) {
        if (pickingMarker) {
            pickingMarker.setLatLng([lat, lng]);
            pickingMarker.setPopupContent(
                `📌 <b>Точка поездки</b><br><small>${lat.toFixed(5)}, ${lng.toFixed(5)}</small>`
            );
            return;
        }
        const icon = L.divIcon({
            className: '',
            html: `<div style="background:#ef4444;width:32px;height:32px;border-radius:50%;
                border:5px solid #fff;box-shadow:0 3px 12px rgba(0,0,0,.6),0 0 0 4px #ef4444;"></div>`,
            iconSize: [32, 32], iconAnchor: [16, 16]
        });
        pickingMarker = L.marker([lat, lng], {
            icon, draggable: true, zIndexOffset: 1000
        }).addTo(map);
        pickingMarker.bindPopup(
            `📌 <b>Точка поездки</b><br><small>${lat.toFixed(5)}, ${lng.toFixed(5)}</small>`
        ).openPopup();
        pickingMarker.on('drag', ev => {
            const { lat: la, lng: ln } = ev.target.getLatLng();
            pickingMarker.setPopupContent(
                `📌 <b>Точка поездки</b><br><small>${la.toFixed(5)}, ${ln.toFixed(5)}</small>`
            );
            if (window.__onMapClick) window.__onMapClick(la, ln);
        });
        pickingMarker.on('dragend', ev => {
            const { lat: la, lng: ln } = ev.target.getLatLng();
            if (window.__onMapClick) window.__onMapClick(la, ln);
        });
    }

    function removePickingMarker() {
        if (pickingMarker) { map.removeLayer(pickingMarker); pickingMarker = null; }
    }

    function setStyle(styleKey) {
        const conf = STYLES[styleKey];
        if (!conf) return currentStyle;
        currentStyle = styleKey;
        if (tileLayer) map.removeLayer(tileLayer);
        tileLayer = L.tileLayer(makeTileUrl(styleKey), {
            attribution: '', maxZoom: conf.maxZoom, crossOrigin: true
        }).addTo(map);
        if (tileLayer.bringToBack) tileLayer.bringToBack();
        return conf.label;
    }

    function cycleStyle() {
        const keys = Object.keys(STYLES);
        const idx = keys.indexOf(currentStyle);
        return setStyle(keys[(idx + 1) % keys.length]);
    }

    function haversine(lat1, lng1, lat2, lng2) {
        const R = 6371;
        const toRad = d => d * Math.PI / 180;
        const dLat = toRad(lat2 - lat1);
        const dLng = toRad(lng2 - lng1);
        const a = Math.sin(dLat / 2) ** 2 +
                  Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) *
                  Math.sin(dLng / 2) ** 2;
        return 2 * R * Math.asin(Math.sqrt(a));
    }

    function totalDistance(trips) {
        if (trips.length < 2) return 0;
        const sorted = [...trips].sort((a, b) =>
            new Date(a.startDate) - new Date(b.startDate));
        let total = 0;
        for (let i = 1; i < sorted.length; i++) {
            total += haversine(sorted[i-1].lat, sorted[i-1].lng,
                              sorted[i].lat, sorted[i].lng);
        }
        return Math.round(total);
    }

    function markerColor(rating) {
        if (rating >= 5) return '#10b981';
        if (rating >= 4) return '#3b82f6';
        if (rating >= 3) return '#f59e0b';
        if (rating >= 1) return '#ef4444';
        return '#64748b';
    }

    function makeNumberedIcon(number, rating, city, isFirst) {
        const color = markerColor(rating);
        const labelClass = labelsVisible ? '' : 'hidden';
        const html = `
            <div class="num-marker ${isFirst ? 'first' : ''}">
                <svg viewBox="0 0 48 62" xmlns="http://www.w3.org/2000/svg">
                    <ellipse cx="24" cy="59" rx="8" ry="2.5" fill="rgba(0,0,0,.25)"/>
                    <path d="M24 2C13 2 4 11 4 22c0 15 20 38 20 38s20-23 20-38C44 11 35 2 24 2z"
                          fill="${color}" stroke="#ffffff" stroke-width="3"/>
                    <circle cx="24" cy="22" r="12" fill="#ffffff" opacity="0.95"/>
                </svg>
                <div class="circle">${number}</div>
                <div class="num-label ${labelClass}">${escapeHtml(city)}</div>
            </div>`;
        return L.divIcon({
            className: 'num-marker-wrap', html,
            iconSize: [48, 62], iconAnchor: [24, 62], popupAnchor: [0, -58]
        });
    }

    function render(trips) {
        markersLayer.clearLayers();
        if (!trips.length) { routeLine.setLatLngs([]); return; }

        const sorted = [...trips].sort((a, b) =>
            new Date(a.startDate) - new Date(b.startDate));
        const coords = [];

        sorted.forEach((trip, index) => {
            const number = index + 1;
            const isFirst = index === 0;
            const rating = '★'.repeat(trip.rating || 0);
            const photos = Array.isArray(trip.photos) ? trip.photos : [];

            const marker = L.marker([trip.lat, trip.lng], {
                icon: makeNumberedIcon(number, trip.rating || 0, trip.city || '—', isFirst),
                zIndexOffset: isFirst ? 500 : 0
            });

            const galleryHTML = photos.length
                ? `<div class="popup-gallery">
                       ${photos.slice(0, 4).map((p, i) => `
                           <img src="${p}" data-popup-photo="${i}" alt="Фото ${i + 1}" />
                       `).join('')}
                       ${photos.length > 4 ? `<span style="font-size:11px;color:#64748b;align-self:center;">+${photos.length - 4}</span>` : ''}
                   </div>`
                : '';

            marker.bindPopup(`
                <strong>№${number} · ${escapeHtml(trip.title)}</strong><br>
                📍 ${escapeHtml(trip.city)}, ${escapeHtml(trip.country)}<br>
                📅 ${formatDate(trip.startDate)} — ${formatDate(trip.endDate)}<br>
                ${rating ? `<span style="color:#f59e0b">${rating}</span><br>` : ''}
                ${galleryHTML}
                <div class="popup-actions">
                    <button class="popup-edit"   data-edit="${trip.id}">✏️ Изменить</button>
                    <button class="popup-delete" data-del="${trip.id}">🗑 Удалить</button>
                </div>
            `);
            marker.on('popupopen', e => {
                const el = e.popup.getElement();
                el.querySelector('[data-edit]')?.addEventListener('click', () =>
                    onEditRequest && onEditRequest(trip.id));
                el.querySelector('[data-del]')?.addEventListener('click', () =>
                    onDeleteRequest && onDeleteRequest(trip.id));

                el.querySelectorAll('[data-popup-photo]').forEach(img => {
                    img.addEventListener('click', () => {
                        const idx = parseInt(img.dataset.popupPhoto);
                        if (window.__openLightbox) window.__openLightbox(photos, idx);
                    });
                });
            });
            markersLayer.addLayer(marker);
            coords.push([trip.lat, trip.lng]);
        });

        routeLine.setLatLngs(coords);
        routeLine.setStyle({ opacity: routeVisible ? 0.8 : 0 });
        if (coords.length) fitAll();
    }

    function fitAll() {
        const points = [];
        markersLayer.eachLayer(l => {
            const ll = l.getLatLng();
            points.push([ll.lat, ll.lng]);
        });
        if (!points.length) return;
        if (points.length === 1) map.setView(points[0], 9);
        else map.fitBounds(L.latLngBounds(points), { padding: [60, 60], maxZoom: 10 });
    }

    function focusTrip(trip) {
        map.setView([trip.lat, trip.lng], 11, { animate: true });
    }

    function toggleRoute() {
        routeVisible = !routeVisible;
        routeLine.setStyle({ opacity: routeVisible ? 0.8 : 0 });
        return routeVisible;
    }

    function toggleLabels() {
        labelsVisible = !labelsVisible;
        document.querySelectorAll('.num-label').forEach(el => {
            el.classList.toggle('hidden', !labelsVisible);
        });
        return labelsVisible;
    }

    function resetView() {
        if (!markersLayer.getLayers().length) map.setView(DEFAULT_CENTER, DEFAULT_ZOOM);
        else fitAll();
    }

    function zoomIn()  { map.zoomIn(); }
    function zoomOut() { map.zoomOut(); }

    function showMyLocation() {
        if (!navigator.geolocation) { alert('Геолокация не поддерживается'); return; }
        navigator.geolocation.getCurrentPosition(
            pos => {
                const { latitude, longitude } = pos.coords;
                if (meMarker) map.removeLayer(meMarker);
                const icon = L.divIcon({
                    className: 'me-marker', iconSize: [20, 20], iconAnchor: [10, 10]
                });
                meMarker = L.marker([latitude, longitude], { icon })
                    .addTo(map)
                    .bindPopup('📍 Вы здесь').openPopup();
                map.setView([latitude, longitude], 13);
            },
            err => alert('Не удалось: ' + err.message),
            { enableHighAccuracy: true, timeout: 8000 }
        );
    }

    function invalidate() { setTimeout(() => map.invalidateSize(), 100); }

    function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({
            '&': '&amp;', '<': '&lt;', '>': '&gt;',
            '"': '&quot;', "'": '&#39;'
        }[c]));
    }
    function formatDate(iso) {
        if (!iso) return '';
        return new Date(iso).toLocaleDateString('ru-RU', {
            day: 'numeric', month: 'short', year: 'numeric'
        });
    }

    return {
        init, render, totalDistance, invalidate,
        fitAll, toggleRoute, toggleLabels, resetView, cycleStyle, setStyle,
        focusTrip, zoomIn, zoomOut, showMyLocation,
        setPickingMarker, removePickingMarker,
        getStyle: () => currentStyle
    };
})();