function setScore(btn) {
  const value = parseInt(btn.dataset.value);
  const container = btn.parentElement;
  const name = container.dataset.name;
  const hiddenInput = container.parentElement.querySelector(`input[name="${name}"]`);

  if (hiddenInput) hiddenInput.value = value;

  container.querySelectorAll('.burger-btn').forEach((b, idx) => {
    if (idx < value) {
      b.classList.add('active');
    } else {
      b.classList.remove('active');
    }
  });
}

function toggleCollapsible(toggle) {
  const content = toggle.nextElementSibling;
  content.classList.toggle('open');
  const arrow = toggle.querySelector('span:last-child');
  arrow.textContent = content.classList.contains('open') ? '▲' : '▼';
}

function openLightbox(src) {
  const lightbox = document.getElementById('lightbox');
  const img = document.getElementById('lightbox-img');
  img.src = src;
  lightbox.classList.add('active');
}

function closeLightbox() {
  document.getElementById('lightbox').classList.remove('active');
}

document.addEventListener('keydown', (e) => {
  if (e.key === 'Escape') closeLightbox();
});

document.addEventListener('DOMContentLoaded', () => {
  document.querySelectorAll('.score-input-burgers').forEach(container => {
    const name = container.dataset.name;
    const hiddenInput = container.parentElement.querySelector(`input[name="${name}"]`);
    const defaultValue = hiddenInput ? parseInt(hiddenInput.value) : 3;

    container.querySelectorAll('.burger-btn').forEach((btn, idx) => {
      if (idx < defaultValue) btn.classList.add('active');
    });
  });

  document.querySelectorAll('.file-upload').forEach(upload => {
    const input = upload.querySelector('input[type="file"]');
    const textEl = upload.querySelector('.file-upload-text');

    if (input && textEl) {
      input.addEventListener('change', () => {
        const count = input.files.length;
        if (count > 0) {
          textEl.innerHTML = `<strong>${count} file${count > 1 ? 's' : ''}</strong> selected`;
          upload.style.borderColor = 'var(--teal)';
          upload.style.background = 'rgba(42,157,143,0.05)';
        }
      });
    }
  });

  const toast = document.querySelector('.toast');
  if (toast) {
    setTimeout(() => toast.remove(), 4000);
  }

  initRestaurantSearch();
  initPlaceAutocomplete();
  initDetailMap();
});

/* ─── Restaurant Search ──────────────────────────── */
function initRestaurantSearch() {
  const input = document.getElementById('restaurant-search');
  if (!input) return;

  const grid = document.getElementById('restaurant-grid');
  const noResults = document.getElementById('no-results');
  const recommendBtn = document.getElementById('recommend-btn');
  if (!grid) return;

  const cards = Array.from(grid.querySelectorAll('.restaurant-card'));

  input.addEventListener('input', () => {
    const query = input.value.trim().toLowerCase();

    if (!query) {
      cards.forEach(card => { card.style.display = ''; });
      if (noResults) noResults.style.display = 'none';
      return;
    }

    let visibleCount = 0;
    cards.forEach(card => {
      const name = card.dataset.name || '';
      const location = card.dataset.location || '';
      const match = name.includes(query) || location.includes(query);
      card.style.display = match ? '' : 'none';
      if (match) visibleCount++;
    });

    if (noResults) {
      noResults.style.display = visibleCount === 0 ? 'block' : 'none';
    }

    if (recommendBtn && visibleCount === 0) {
      const encoded = encodeURIComponent(input.value.trim());
      recommendBtn.href = `/submit?recommend=${encoded}`;
    }
  });
}

/* ─── Review Sections Toggle ─────────────────────── */
function toggleReviewSections(reviewId, btn) {
  const container = document.getElementById('sections-' + reviewId);
  if (!container) return;
  const isHidden = container.style.display === 'none';
  container.style.display = isHidden ? 'block' : 'none';
  btn.textContent = isHidden ? 'Show less ▲' : btn.textContent.replace('▲', '▼');
  if (!isHidden) {
    const match = btn.dataset.originalText;
    if (match) btn.textContent = match;
  }
  if (isHidden && !btn.dataset.originalText) {
    btn.dataset.originalText = btn.textContent.replace('Show less ▲', '').trim();
    btn.textContent = 'Show less ▲';
  }
}

/* ─── Google Places Autocomplete ─────────────────── */
let placeDebounceTimer = null;

function initPlaceAutocomplete() {
  const input = document.getElementById('place-autocomplete');
  if (!input) return;
  if (typeof google === 'undefined' || !google.maps || !google.maps.places) return;

  const suggestionsContainer = document.getElementById('place-suggestions');
  const autocompleteService = new google.maps.places.AutocompleteService();

  input.addEventListener('input', () => {
    clearTimeout(placeDebounceTimer);
    const query = input.value.trim();
    if (query.length < 3) {
      suggestionsContainer.innerHTML = '';
      return;
    }

    placeDebounceTimer = setTimeout(() => {
      autocompleteService.getPlacePredictions(
        { input: query, types: ['establishment'] },
        (predictions, status) => {
          suggestionsContainer.innerHTML = '';
          if (status !== google.maps.places.PlacesServiceStatus.OK || !predictions) return;

          const list = document.createElement('div');
          list.className = 'place-suggestions-list';

          predictions.forEach(pred => {
            const item = document.createElement('div');
            item.className = 'place-suggestion-item';
            item.innerHTML = `
              <span class="place-suggestion-icon">📍</span>
              <div>
                <div class="place-suggestion-name">${pred.structured_formatting.main_text}</div>
                <div class="place-suggestion-address">${pred.structured_formatting.secondary_text || ''}</div>
              </div>
            `;
            item.addEventListener('click', () => selectPlace(pred));
            list.appendChild(item);
          });

          suggestionsContainer.appendChild(list);
        }
      );
    }, 300);
  });

  document.addEventListener('click', (e) => {
    if (!e.target.closest('#place-autocomplete') && !e.target.closest('#place-suggestions')) {
      suggestionsContainer.innerHTML = '';
    }
  });
}

async function selectPlace(prediction) {
  document.getElementById('place-suggestions').innerHTML = '';
  document.getElementById('place-autocomplete').value = '';

  const nameInput = document.getElementById('restaurant-name');
  const locationInput = document.getElementById('restaurant-location');
  if (nameInput) nameInput.value = prediction.structured_formatting.main_text;
  if (locationInput) locationInput.value = prediction.structured_formatting.secondary_text || '';

  document.getElementById('placeId').value = prediction.place_id;

  const selectedCard = document.getElementById('place-selected');
  document.getElementById('place-selected-name').textContent = prediction.structured_formatting.main_text;
  document.getElementById('place-selected-address').textContent = prediction.structured_formatting.secondary_text || '';
  selectedCard.style.display = 'block';

  try {
    const resp = await fetch(`/api/place-details?placeId=${encodeURIComponent(prediction.place_id)}`);
    const data = await resp.json();
    if (!data.error) {
      document.getElementById('formattedAddress').value = data.formattedAddress || '';
      document.getElementById('placePhone').value = data.phone || '';
      document.getElementById('placeWebsite').value = data.website || '';
      document.getElementById('placeLat').value = data.lat || '';
      document.getElementById('placeLng').value = data.lng || '';
      if (locationInput && data.formattedAddress) locationInput.value = data.formattedAddress;

      const logoInput = document.getElementById('placeLogo');
      if (logoInput && data.logo) {
        logoInput.value = data.logo;
        const preview = document.getElementById('logo-preview');
        if (preview) {
          preview.innerHTML = `<img src="/uploads/${data.logo}" alt="Logo" style="max-height: 80px; border-radius: 8px; object-fit: contain; image-rendering: auto;">
            <span style="font-size: 0.85rem; color: var(--teal); font-weight: 600;">Logo found!</span>`;
          preview.style.display = 'flex';
        }
      }
    }
  } catch (err) {
    // Place details fetch failed — fields stay empty, no big deal
  }
}

function clearPlaceSelection() {
  document.getElementById('place-selected').style.display = 'none';
  document.getElementById('placeId').value = '';
  document.getElementById('formattedAddress').value = '';
  document.getElementById('placePhone').value = '';
  document.getElementById('placeWebsite').value = '';
  document.getElementById('placeLat').value = '';
  document.getElementById('placeLng').value = '';
  const logoInput = document.getElementById('placeLogo');
  if (logoInput) logoInput.value = '';
  const preview = document.getElementById('logo-preview');
  if (preview) { preview.innerHTML = ''; preview.style.display = 'none'; }
}

/* ─── Detail Page Map ────────────────────────────── */
function initDetailMap() {
  const mapEl = document.getElementById('detail-map');
  if (!mapEl) return;
  if (typeof google === 'undefined' || !google.maps) return;

  const lat = parseFloat(mapEl.dataset.lat);
  const lng = parseFloat(mapEl.dataset.lng);
  const name = mapEl.dataset.name || 'Restaurant';

  if (isNaN(lat) || isNaN(lng)) return;

  const pos = { lat, lng };
  const map = new google.maps.Map(mapEl, {
    center: pos,
    zoom: 15,
    disableDefaultUI: true,
    zoomControl: true,
    styles: [
      { featureType: 'poi.business', stylers: [{ visibility: 'simplified' }] }
    ]
  });

  new google.maps.Marker({ position: pos, map, title: name });
}
