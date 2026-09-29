// =========================================================
// app.js — основной модуль UI
// =========================================================

/* ---------------------- STORAGE ---------------------- */
const Storage = (() => {
    const KEY = 'travel_diary_trips';

    function allTrips() {
        try { return JSON.parse(localStorage.getItem(KEY)) || []; }
        catch { return []; }
    }
    function saveAll(trips) { localStorage.setItem(KEY, JSON.stringify(trips)); }

    function getAll() {
        const u = Auth.currentUser();
        if (!u) return [];
        return allTrips().filter(t => t.userId === u.id);
    }

    function add(trip) {
        const u = Auth.currentUser();
        if (!u) throw new Error('Не авторизован');
        const trips = allTrips();
        trip.id = Date.now().toString() + '_' + Math.random().toString(36).slice(2, 6);
        trip.userId = u.id;
        trip.createdAt = new Date().toISOString();
        trips.push(trip);
        saveAll(trips);
        return trip;
    }

    function update(id, updated) {
        const u = Auth.currentUser();
        if (!u) throw new Error('Не авторизован');
        const trips = allTrips();
        const i = trips.findIndex(t => t.id === id && t.userId === u.id);
        if (i === -1) return null;
        trips[i] = { ...trips[i], ...updated, id, userId: u.id };
        saveAll(trips);
        return trips[i];
    }

    function remove(id) {
        const u = Auth.currentUser();
        if (!u) throw new Error('Не авторизован');
        saveAll(allTrips().filter(t => !(t.id === id && t.userId === u.id)));
    }

    function getById(id) {
        return getAll().find(t => t.id === id) || null;
    }

    function replaceMine(newTrips) {
        const u = Auth.currentUser();
        if (!u) throw new Error('Не авторизован');
        const others = allTrips().filter(t => t.userId !== u.id);
        const mine = newTrips.map(t => ({ ...t, userId: u.id }));
        saveAll(others.concat(mine));
    }

    return { getAll, add, update, remove, getById, replaceMine };
})();


/* ---------------------- UI ---------------------- */
(() => {
    let trips = [];
    let editingId = null;
    let currentRating = 0;
    let justSaved = false;
    let editingPhotos = [];
    let lightboxPhotos = [];
    let lightboxIndex = 0;

    const $ = id => document.getElementById(id);

    const els = {
        authScreen:   $('authScreen'),
        app:          $('app'),
        authTabs:     document.querySelectorAll('.auth-tab'),
        loginForm:    $('loginForm'),
        registerForm: $('registerForm'),
        loginEmail:   $('loginEmail'),
        loginPassword:$('loginPassword'),
        loginError:   $('loginError'),
        regName:      $('regName'),
        regEmail:     $('regEmail'),
        regPassword:  $('regPassword'),
        regPassword2: $('regPassword2'),
        registerError:$('registerError'),
        userNameChip: $('userNameChip'),
        logoutBtn:    $('logoutBtn'),
        tripsList:      $('tripsList'),
        emptyState:     $('emptyState'),
        searchInput:    $('searchInput'),
        sortSelect:     $('sortSelect'),
        ratingFilter:   $('ratingFilter'),
        countryFilter:  $('countryFilter'),
        resetFiltersBtn:$('resetFiltersBtn'),
        modal:          $('tripModal'),
        modalTitle:     $('modalTitle'),
        form:           $('tripForm'),
        addBtn:         $('addTripBtn'),
        closeBtn:       $('closeModal'),
        cancelBtn:      $('cancelBtn'),
        ratingStars:    $('ratingStars'),
        tripId:         $('tripId'),
        tripTitle:      $('tripTitle'),
        tripCountry:    $('tripCountry'),
        tripCity:       $('tripCity'),
        tripStart:      $('tripStart'),
        tripEnd:        $('tripEnd'),
        tripLat:        $('tripLat'),
        tripLng:        $('tripLng'),
        tripNotes:      $('tripNotes'),
        tripRating:     $('tripRating'),
        statTrips:      $('statTrips'),
        statCities:     $('statCities'),
        statCountries:  $('statCountries'),
        statDistance:   $('statDistance'),
        statDays:       $('statDays'),
        statPlaces:     $('statPlaces'),
        fitAllBtn:      $('fitAllBtn'),
        toggleRouteBtn: $('toggleRouteBtn'),
        toggleLabelsBtn:$('toggleLabelsBtn'),
        resetViewBtn:   $('resetViewBtn'),
        mapStyleBtn:    $('mapStyleBtn'),
        myLocationBtn:  $('myLocationBtn'),
        zoomInBtn:      $('zoomInBtn'),
        zoomOutBtn:     $('zoomOutBtn'),
        randomTripBtn:  $('randomTripBtn'),
        fullscreenBtn:  $('fullscreenBtn'),
        printBtn:       $('printBtn'),
        mapSection:     $('mapSection'),
        themeBtn:       $('themeBtn'),
        exportBtn:      $('exportBtn'),
        exportCsvBtn:   $('exportCsvBtn'),
        importInput:    $('importInput'),
        photoPreview:   $('photoPreview'),
        photoInput:     $('photoInput'),
        lightbox:       $('lightbox'),
        lightboxImg:    $('lightboxImg'),
        lightboxClose:  $('lightboxClose'),
        lightboxPrev:   $('lightboxPrev'),
        lightboxNext:   $('lightboxNext')
    };

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
    function daysBetween(start, end) {
        const ms = new Date(end) - new Date(start);
        return Math.max(1, Math.round(ms / (1000 * 60 * 60 * 24)) + 1);
    }
    function pluralDays(n) {
        const m10 = n % 10, m100 = n % 100;
        if (m10 === 1 && m100 !== 11) return 'день';
        if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'дня';
        return 'дней';
    }
    function buildNumberMap(list) {
        const sorted = [...list].sort((a, b) =>
            new Date(a.startDate) - new Date(b.startDate));
        const map = new Map();
        sorted.forEach((t, i) => map.set(t.id, i + 1));
        return map;
    }

    function bindAuthEvents() {
        els.authTabs.forEach(tab => {
            tab.addEventListener('click', () => {
                els.authTabs.forEach(t => t.classList.remove('active'));
                tab.classList.add('active');
                const name = tab.dataset.tab;
                if (name === 'login') {
                    els.loginForm.classList.remove('hidden');
                    els.registerForm.classList.add('hidden');
                } else {
                    els.loginForm.classList.add('hidden');
                    els.registerForm.classList.remove('hidden');
                }
                els.loginError.textContent = '';
                els.registerError.textContent = '';
            });
        });

        els.loginForm.addEventListener('submit', async e => {
            e.preventDefault();
            els.loginError.textContent = '';
            try {
                await Auth.login(els.loginEmail.value, els.loginPassword.value);
                els.loginForm.reset();
                enterApp();
            } catch (err) {
                els.loginError.textContent = err.message;
            }
        });

        els.registerForm.addEventListener('submit', async e => {
            e.preventDefault();
            els.registerError.textContent = '';
            if (els.regPassword.value !== els.regPassword2.value) {
                els.registerError.textContent = 'Пароли не совпадают';
                return;
            }
            try {
                await Auth.register(
                    els.regName.value,
                    els.regEmail.value,
                    els.regPassword.value
                );
                els.registerForm.reset();
                enterApp();
            } catch (err) {
                els.registerError.textContent = err.message;
            }
        });

        els.logoutBtn.addEventListener('click', () => {
            if (!confirm('Выйти из аккаунта?')) return;
            Auth.logout();
            exitApp();
        });
    }

    function enterApp() {
        const u = Auth.currentUser();
        if (!u) return;
        els.userNameChip.textContent = u.name;
        els.authScreen.classList.add('hidden');
        els.app.classList.remove('hidden');

        if (!window.__mapInited) {
            window.__mapInited = true;
            TravelMap.init({
                onEdit: id => {
                    const t = Storage.getById(id);
                    if (t) openModal(t);
                },
                onDelete: id => {
                    const t = Storage.getById(id);
                    if (!t) return;
                    if (confirm(`Удалить поездку «${t.title}»?`)) {
                        Storage.remove(id);
                        trips = Storage.getAll();
                        renderAll();
                    }
                }
            });
        }

        trips = Storage.getAll();
        renderAll();
        setTimeout(() => TravelMap.invalidate(), 200);
    }

    function exitApp() {
        trips = [];
        els.app.classList.add('hidden');
        els.authScreen.classList.remove('hidden');
        els.userNameChip.textContent = '—';
        if (window.__mapInited) {
            try { TravelMap.render([]); } catch (e) {}
        }
        els.loginEmail.value = '';
        els.loginPassword.value = '';
        els.loginError.textContent = '';
    }

    function bindAppEvents() {
        els.addBtn.addEventListener('click', () => openModal());
        els.closeBtn.addEventListener('click', closeModal);
        els.cancelBtn.addEventListener('click', closeModal);
        els.form.addEventListener('submit', handleSubmit);

        els.searchInput.addEventListener('input', renderTrips);
        els.sortSelect.addEventListener('change', renderTrips);
        els.ratingFilter.addEventListener('change', renderTrips);
        els.countryFilter.addEventListener('change', renderTrips);

        els.resetFiltersBtn.addEventListener('click', () => {
            els.searchInput.value = '';
            els.sortSelect.value = 'date-asc';
            els.ratingFilter.value = '0';
            els.countryFilter.value = '';
            renderTrips();
        });

        els.ratingStars.querySelectorAll('span').forEach(star => {
            star.addEventListener('click', () => {
                currentRating = parseInt(star.dataset.value);
                els.tripRating.value = currentRating;
                updateStars(currentRating);
            });
            star.addEventListener('mouseenter', () => {
                updateStars(parseInt(star.dataset.value));
            });
        });
        els.ratingStars.addEventListener('mouseleave', () => updateStars(currentRating));

        document.addEventListener('keydown', e => {
            if (e.key === 'Escape' && els.modal.classList.contains('active')) closeModal();
        });

        window.addEventListener('resize', () => TravelMap.invalidate());

        els.fitAllBtn.addEventListener('click', () => TravelMap.fitAll());
        els.toggleRouteBtn.addEventListener('click', () => {
            const v = TravelMap.toggleRoute();
            els.toggleRouteBtn.textContent = v ? '🛣 Скрыть маршрут' : '🛣 Показать маршрут';
        });
        els.toggleLabelsBtn.addEventListener('click', () => {
            const v = TravelMap.toggleLabels();
            els.toggleLabelsBtn.textContent = v ? '🏷 Скрыть подписи' : '🏷 Показать подписи';
        });
        els.resetViewBtn.addEventListener('click', () => TravelMap.resetView());
        els.mapStyleBtn.addEventListener('click', () => {
            els.mapStyleBtn.textContent = TravelMap.cycleStyle();
        });
        els.myLocationBtn.addEventListener('click', () => TravelMap.showMyLocation());
        els.zoomInBtn.addEventListener('click',  () => TravelMap.zoomIn());
        els.zoomOutBtn.addEventListener('click', () => TravelMap.zoomOut());
        els.randomTripBtn.addEventListener('click', openRandomTrip);
        els.fullscreenBtn.addEventListener('click', toggleFullscreen);
        els.printBtn.addEventListener('click', () => window.print());

        els.themeBtn.addEventListener('click', () => {
            document.body.classList.toggle('dark');
            localStorage.setItem('travel_theme',
                document.body.classList.contains('dark') ? 'dark' : 'light');
        });

        els.exportBtn.addEventListener('click', exportJson);
        els.exportCsvBtn.addEventListener('click', exportCsv);
        els.importInput.addEventListener('change', importData);

        els.photoInput.addEventListener('change', async e => {
            await handlePhotoUpload(e.target.files);
            e.target.value = '';
        });

        els.lightboxClose.addEventListener('click', closeLightbox);
        els.lightboxPrev.addEventListener('click', lightboxPrev);
        els.lightboxNext.addEventListener('click', lightboxNext);
        els.lightbox.addEventListener('click', e => {
            if (e.target === els.lightbox) closeLightbox();
        });
        document.addEventListener('keydown', e => {
            if (!els.lightbox.classList.contains('active')) return;
            if (e.key === 'Escape') closeLightbox();
            if (e.key === 'ArrowLeft')  lightboxPrev();
            if (e.key === 'ArrowRight') lightboxNext();
        });

        window.__openLightbox = openLightbox;
    }

    function updateStars(n) {
        els.ratingStars.querySelectorAll('span').forEach(s => {
            s.classList.toggle('active', parseInt(s.dataset.value) <= n);
        });
    }

    function renderPhotoPreview() {
        els.photoPreview.innerHTML = '';
        editingPhotos.forEach((dataUrl, index) => {
            const div = document.createElement('div');
            div.className = 'photo-thumb';
            div.innerHTML = `
                <img src="${dataUrl}" alt="Фото ${index + 1}" />
                <button class="photo-remove" type="button" title="Удалить">✕</button>
            `;
            div.querySelector('.photo-remove').addEventListener('click', () => {
                editingPhotos.splice(index, 1);
                renderPhotoPreview();
            });
            div.querySelector('img').addEventListener('click', () => {
                openLightbox(editingPhotos, index);
            });
            els.photoPreview.appendChild(div);
        });
    }

    async function handlePhotoUpload(files) {
        const arr = Array.from(files);
        if (!arr.length) return;

        for (const file of arr) {
            if (!file.type.startsWith('image/')) continue;
            try {
                const dataUrl = await PhotoUtils.compressImage(file);
                editingPhotos.push(dataUrl);
            } catch (e) {
                console.error('Ошибка обработки фото:', e);
            }
        }
        renderPhotoPreview();

        const totalKb = editingPhotos.reduce((sum, p) => sum + PhotoUtils.sizeKb(p), 0);
        if (totalKb > 3000) {
            alert(`Суммарный размер фото ${totalKb} КБ. Может не хватить места — лучше удалить часть.`);
        }
    }

    function openLightbox(photos, index = 0) {
        lightboxPhotos = photos.slice();
        lightboxIndex = Math.max(0, Math.min(index, photos.length - 1));
        updateLightbox();
        els.lightbox.classList.add('active');
    }
    function updateLightbox() {
        if (!lightboxPhotos.length) return;
        els.lightboxImg.src = lightboxPhotos[lightboxIndex];
        const multiple = lightboxPhotos.length > 1;
        els.lightboxPrev.style.display = multiple ? 'flex' : 'none';
        els.lightboxNext.style.display = multiple ? 'flex' : 'none';
    }
    function closeLightbox() {
        els.lightbox.classList.remove('active');
        els.lightboxImg.src = '';
        lightboxPhotos = [];
        lightboxIndex = 0;
    }
    function lightboxPrev() {
        if (lightboxPhotos.length < 2) return;
        lightboxIndex = (lightboxIndex - 1 + lightboxPhotos.length) % lightboxPhotos.length;
        updateLightbox();
    }
    function lightboxNext() {
        if (lightboxPhotos.length < 2) return;
        lightboxIndex = (lightboxIndex + 1) % lightboxPhotos.length;
        updateLightbox();
    }

    function openModal(trip = null) {
        els.form.reset();
        editingId = null;
        justSaved = false;
        editingPhotos = [];
        renderPhotoPreview();

        if (trip) {
            editingId = trip.id;
            els.modalTitle.textContent = 'Редактировать поездку';
            els.tripId.value = trip.id;
            els.tripTitle.value = trip.title;
            els.tripCountry.value = trip.country;
            els.tripCity.value = trip.city;
            els.tripStart.value = trip.startDate;
            els.tripEnd.value = trip.endDate;
            els.tripLat.value = trip.lat;
            els.tripLng.value = trip.lng;
            els.tripNotes.value = trip.notes || '';
            currentRating = trip.rating || 0;
            els.tripRating.value = currentRating;
            updateStars(currentRating);

            editingPhotos = Array.isArray(trip.photos) ? trip.photos.slice() : [];
            renderPhotoPreview();

            TravelMap.setPickingMarker(trip.lat, trip.lng);
            TravelMap.focusTrip(trip);
        } else {
            els.modalTitle.textContent = 'Новая поездка';
            currentRating = 0;
            els.tripRating.value = 0;
            updateStars(0);
        }

        els.modal.classList.add('active');
        setTimeout(() => {
            els.tripTitle.focus();
            TravelMap.invalidate();
        }, 100);
    }

    function closeModal() {
        els.modal.classList.remove('active');
        if (!justSaved) TravelMap.removePickingMarker();
        justSaved = false;
        els.form.reset();
        editingId = null;
        editingPhotos = [];
        renderPhotoPreview();
    }

    function handleSubmit(e) {
        e.preventDefault();

        const trip = {
            title: els.tripTitle.value.trim(),
            country: els.tripCountry.value.trim(),
            city: els.tripCity.value.trim(),
            startDate: els.tripStart.value,
            endDate: els.tripEnd.value,
            lat: parseFloat(els.tripLat.value),
            lng: parseFloat(els.tripLng.value),
            notes: els.tripNotes.value.trim(),
            rating: parseInt(els.tripRating.value) || 0,
            photos: editingPhotos.slice()
        };

        if (!trip.title || !trip.country || !trip.city || !trip.startDate || !trip.endDate) {
            alert('Заполните все обязательные поля');
            return;
        }
        if (new Date(trip.endDate) < new Date(trip.startDate)) {
            alert('Дата окончания не может быть раньше даты начала');
            return;
        }
        if (isNaN(trip.lat) || isNaN(trip.lng)) {
            alert('Кликните по карте, чтобы поставить точку');
            return;
        }

        justSaved = true;
        if (editingId) Storage.update(editingId, trip);
        else Storage.add(trip);

        TravelMap.removePickingMarker();
        trips = Storage.getAll();
        renderAll();
        closeModal();
        setTimeout(() => TravelMap.invalidate(), 150);
    }

    function renderAll() {
        renderCountryFilter();
        renderTrips();
        renderStats();
        TravelMap.render(trips);
    }

    function renderCountryFilter() {
        const current = els.countryFilter.value;
        const countries = [...new Set(trips.map(t => t.country))].sort((a, b) =>
            a.localeCompare(b, 'ru'));
        els.countryFilter.innerHTML = '<option value="">Все страны</option>';
        countries.forEach(c => {
            const opt = document.createElement('option');
            opt.value = c;
            opt.textContent = c;
            els.countryFilter.appendChild(opt);
        });
        if (countries.includes(current)) els.countryFilter.value = current;
    }

    function renderTrips() {
        const query = els.searchInput.value.trim().toLowerCase();
        const minRating = parseInt(els.ratingFilter.value) || 0;
        const country = els.countryFilter.value;

        let filtered = [...trips];
        if (query) {
            filtered = filtered.filter(t =>
                t.title.toLowerCase().includes(query) ||
                t.country.toLowerCase().includes(query) ||
                t.city.toLowerCase().includes(query));
        }
        if (minRating > 0) filtered = filtered.filter(t => (t.rating || 0) >= minRating);
        if (country) filtered = filtered.filter(t => t.country === country);

        const mode = els.sortSelect.value;
        filtered.sort((a, b) => {
            switch (mode) {
                case 'date-asc':      return new Date(a.startDate) - new Date(b.startDate);
                case 'date-desc':     return new Date(b.startDate) - new Date(a.startDate);
                case 'rating-desc':   return (b.rating || 0) - (a.rating || 0);
                case 'rating-asc':    return (a.rating || 0) - (b.rating || 0);
                case 'title-asc':     return a.title.localeCompare(b.title, 'ru');
                case 'country-asc':   return a.country.localeCompare(b.country, 'ru');
                case 'duration-desc': return daysBetween(b.startDate, b.endDate) - daysBetween(a.startDate, a.endDate);
                default:              return new Date(a.startDate) - new Date(b.startDate);
            }
        });

        els.tripsList.innerHTML = '';

        if (!filtered.length) {
            els.emptyState.classList.remove('hidden');
            els.emptyState.querySelector('p').textContent = trips.length
                ? '🔍 Ничего не найдено по вашим фильтрам.'
                : 'Пока нет ни одной поездки. Нажмите «+ Добавить», чтобы начать! 🚀';
            return;
        }

        els.emptyState.classList.add('hidden');
        const numberMap = buildNumberMap(trips);
        filtered.forEach(trip => {
            els.tripsList.appendChild(createTripCard(trip, numberMap.get(trip.id)));
        });
    }

    function createTripCard(trip, number) {
        const card = document.createElement('div');
        card.className = 'trip-card';
        card.dataset.id = trip.id;

        const days = daysBetween(trip.startDate, trip.endDate);
        const stars = '★'.repeat(trip.rating || 0) + '☆'.repeat(5 - (trip.rating || 0));
        const photos = Array.isArray(trip.photos) ? trip.photos : [];

        let galleryHTML = '';
        if (photos.length) {
            const shown = photos.slice(0, 3);
            const rest = photos.length - shown.length;
            galleryHTML = `
                <div class="trip-gallery">
                    ${shown.map((p, i) => `
                        <div class="gallery-item" data-photo-index="${i}">
                            <img src="${p}" alt="Фото ${i + 1}" />
                            ${i === 2 && rest > 0 ? `<div class="gallery-more">+${rest}</div>` : ''}
                        </div>
                    `).join('')}
                </div>`;
        }

        card.innerHTML = `
            <div class="trip-number" title="Порядковый номер">${number}</div>
            <h3>${escapeHtml(trip.title)}</h3>
            <div class="trip-location">📍 ${escapeHtml(trip.city)}, ${escapeHtml(trip.country)}</div>
            <div class="trip-dates">
                📅 ${formatDate(trip.startDate)} — ${formatDate(trip.endDate)}
                <span class="trip-duration">${days} ${pluralDays(days)}</span>
            </div>
            ${trip.rating ? `<div class="trip-rating">${stars}</div>` : ''}
            ${galleryHTML}
            ${trip.notes ? `<div class="trip-notes">${escapeHtml(trip.notes)}</div>` : ''}
            <div class="trip-actions">
                <button class="btn btn-edit"   data-action="focus">📍 На карте</button>
                <button class="btn btn-edit"   data-action="edit">✏️ Изменить</button>
                <button class="btn btn-danger" data-action="delete">🗑 Удалить</button>
            </div>
        `;

        card.querySelectorAll('.gallery-item').forEach(el => {
            el.addEventListener('click', () => {
                const idx = parseInt(el.dataset.photoIndex);
                openLightbox(photos, idx);
            });
        });

        card.querySelector('[data-action="focus"]').addEventListener('click', () => {
            TravelMap.focusTrip(trip);
            highlightCard(trip.id);
            els.mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
        card.querySelector('[data-action="edit"]').addEventListener('click', () => {
            const t = Storage.getById(trip.id);
            if (t) openModal(t);
        });
        card.querySelector('[data-action="delete"]').addEventListener('click', () => {
            if (confirm(`Удалить поездку «${trip.title}»?`)) {
                Storage.remove(trip.id);
                trips = Storage.getAll();
                renderAll();
            }
        });

        return card;
    }

    function highlightCard(id) {
        const card = els.tripsList.querySelector(`[data-id="${id}"]`);
        if (!card) return;
        card.classList.remove('highlight');
        void card.offsetWidth;
        card.classList.add('highlight');
        setTimeout(() => card.classList.remove('highlight'), 1600);
    }

    function renderStats() {
        els.statTrips.textContent = trips.length;
        els.statCities.textContent = new Set(trips.map(t => t.city.toLowerCase())).size;
        els.statCountries.textContent = new Set(trips.map(t => t.country.toLowerCase())).size;
        els.statPlaces.textContent = trips.length;
        els.statDistance.textContent = TravelMap.totalDistance(trips).toLocaleString('ru-RU');
        const totalDays = trips.reduce((sum, t) => sum + daysBetween(t.startDate, t.endDate), 0);
        els.statDays.textContent = totalDays;
    }

    function openRandomTrip() {
        if (!trips.length) { alert('Сначала добавьте поездку'); return; }
        const trip = trips[Math.floor(Math.random() * trips.length)];
        TravelMap.focusTrip(trip);
        highlightCard(trip.id);
        els.mapSection.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }

    function toggleFullscreen() {
        els.mapSection.classList.toggle('fullscreen');
        els.fullscreenBtn.textContent = els.mapSection.classList.contains('fullscreen')
            ? '⛶ Выйти' : '⛶ Экран';
        setTimeout(() => TravelMap.invalidate(), 150);
    }

    function exportJson() {
        if (!trips.length) return alert('Нет данных');
        const blob = new Blob([JSON.stringify(trips, null, 2)], { type: 'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `travel-diary-${new Date().toISOString().slice(0, 10)}.json`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function exportCsv() {
        if (!trips.length) return alert('Нет данных');
        const numberMap = buildNumberMap(trips);
        const headers = ['№','Название','Страна','Город','Дата начала','Дата окончания','Широта','Долгота','Оценка','Кол-во фото','Заметки'];
        const rows = [...trips]
            .sort((a, b) => new Date(a.startDate) - new Date(b.startDate))
            .map(t => [
                numberMap.get(t.id),
                t.title, t.country, t.city, t.startDate, t.endDate,
                t.lat, t.lng, t.rating || 0,
                Array.isArray(t.photos) ? t.photos.length : 0,
                t.notes || ''
            ]);
        const csv = [headers, ...rows]
            .map(row => row.map(v => `"${String(v).replace(/"/g, '""')}"`).join(';'))
            .join('\n');
        const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `travel-diary-${new Date().toISOString().slice(0, 10)}.csv`;
        a.click();
        URL.revokeObjectURL(url);
    }

    function importData(e) {
        const file = e.target.files[0];
        if (!file) return;
        const reader = new FileReader();
        reader.onload = ev => {
            try {
                const data = JSON.parse(ev.target.result);
                if (!Array.isArray(data)) throw new Error('Не массив');
                const mode = confirm('Импорт: ОК — добавить к текущим, Отмена — заменить свои поездки.');
                if (mode) {
                    const existing = Storage.getAll();
                    const merged = existing.concat(data.map(t => ({
                        ...t,
                        id: Date.now() + '_' + Math.random().toString(36).slice(2, 8),
                        photos: Array.isArray(t.photos) ? t.photos : []
                    })));
                    Storage.replaceMine(merged);
                } else {
                    Storage.replaceMine(data.map(t => ({
                        ...t,
                        photos: Array.isArray(t.photos) ? t.photos : []
                    })));
                }
                trips = Storage.getAll();
                renderAll();
                alert(`Импортировано поездок: ${data.length}`);
            } catch (err) {
                alert('Ошибка чтения файла: ' + err.message);
            } finally {
                e.target.value = '';
            }
        };
        reader.readAsText(file);
    }

    document.addEventListener('DOMContentLoaded', () => {
        if (localStorage.getItem('travel_theme') === 'dark') {
            document.body.classList.add('dark');
        }

        window.__onMapClick = (lat, lng) => {
            els.tripLat.value = lat.toFixed(6);
            els.tripLng.value = lng.toFixed(6);
            [els.tripLat, els.tripLng].forEach(inp => {
                inp.style.transition = 'box-shadow 0.2s';
                inp.style.boxShadow = '0 0 0 3px rgba(79,70,229,.35)';
                setTimeout(() => { inp.style.boxShadow = ''; }, 500);
            });
        };

        bindAuthEvents();
        bindAppEvents();

        if (Auth.isLoggedIn()) {
            enterApp();
        } else {
            els.authScreen.classList.remove('hidden');
            els.app.classList.add('hidden');
        }
    });
})();