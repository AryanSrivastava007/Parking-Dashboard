document.addEventListener('DOMContentLoaded', () => {
  // --- Configuration ---
  // Set this to match your Django mount (e.g., /parkingapi or /api)
  const API_BASE_URL = 'http://127.0.0.1:8000/parkingapi';
  const apiBaseElement = document.getElementById('api-base');
  if (apiBaseElement) {
    apiBaseElement.textContent = API_BASE_URL;
  }

  // Toast notification helper
  function showMessage(message, type = 'success') {
    const toast = document.getElementById('toast');
    toast.textContent = message;

    if (type === 'error') {
      toast.className = 'fixed top-5 right-5 z-50 bg-red-500 text-white px-4 py-3 rounded shadow-md transition-opacity duration-300';
    } else if (type === 'info') {
      toast.className = 'fixed top-5 right-5 z-50 bg-blue-500 text-white px-4 py-3 rounded shadow-md transition-opacity duration-300';
    } else {
      toast.className = 'fixed top-5 right-5 z-50 bg-green-500 text-white px-4 py-3 rounded shadow-md transition-opacity duration-300';
    }

    toast.classList.remove('hidden');
    toast.style.opacity = '1';

    setTimeout(() => {
      toast.style.opacity = '0';
      setTimeout(() => toast.classList.add('hidden'), 300);
    }, 3000);
  }

  // --- Page Navigation ---
  const navTabs = document.getElementById('nav-tabs');
  const pages = document.querySelectorAll('.tab-content');

  navTabs.addEventListener('click', (e) => {
    const targetButton = e.target.closest('button.tab-button');
    if (!targetButton) return;

    navTabs.querySelector('.active').classList.remove('active');
    targetButton.classList.add('active');

    pages.forEach((page) => page.classList.remove('active'));
    document.getElementById(targetButton.dataset.page).classList.add('active');
  });

  // --- API Helpers ---
  function buildUrl(endpoint) {
    const base = API_BASE_URL.replace(/\/$/, '');
    const ep = String(endpoint || '').replace(/^\//, '');
    return `${base}/${ep}/`;
  }

  const api = {
    get: async (endpoint) => {
      const res = await fetch(buildUrl(endpoint));
      if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
      return await res.json();
    },
    post: async (endpoint, data) => {
      const res = await fetch(buildUrl(endpoint), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        try {
          console.error('POST Error:', await res.json());
        } catch (e) {}
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return await res.json();
    },
    put: async (endpoint, id, data) => {
      const res = await fetch(buildUrl(`${endpoint}/${id}`), {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) {
        try {
          console.error('PUT Error:', await res.json());
        } catch (e) {}
        if (endpoint === 'bookings' && res.status === 400) return null;
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      if (res.status === 204) return null;
      return await res.json();
    },
    del: async (endpoint, id) => {
      const res = await fetch(buildUrl(`${endpoint}/${id}`), {
        method: 'DELETE',
      });
      if (!res.ok && res.status !== 204) {
        throw new Error(`HTTP error! status: ${res.status}`);
      }
      return null;
    },
  };

  // --- UI References ---
  const lists = {
    companies: document.getElementById('list-companies'),
    lots: document.getElementById('list-lots'),
    slots: document.getElementById('list-slots'),
    vehicles: document.getElementById('list-vehicles'),
    bookings: document.getElementById('list-bookings'),
  };

  const forms = {
    company: document.getElementById('form-company'),
    lot: document.getElementById('form-lot'),
    slot: document.getElementById('form-slot'),
    vehicle: document.getElementById('form-vehicle'),
    booking: document.getElementById('form-booking'),
  };

  const selects = {
    lotCompany: document.getElementById('lot-company'),
    slotLot: document.getElementById('slot-lot'),
    bookingVehicle: document.getElementById('booking-vehicle'),
    bookingSlot: document.getElementById('booking-slot'),
  };

  const templates = {
    company: document.getElementById('template-company'),
    lot: document.getElementById('template-lot'),
    slot: document.getElementById('template-slot'),
    vehicle: document.getElementById('template-vehicle'),
    booking: document.getElementById('template-booking'),
  };

  // Simple in-memory state for cross-refresh logic
  const state = { slots: [], bookings: [] };

  // Cache vehicle plate by id for booking cards
  const vehicleById = new Map();

  // --- Generic Helpers ---
  function populateSelect(selectEl, items, textProp, valueProp) {
    selectEl.innerHTML = '<option value="">-- Select --</option>';
    items.forEach((item) => {
      const option = document.createElement('option');
      option.textContent = item[textProp];
      option.value = item[valueProp];
      selectEl.appendChild(option);
    });
  }

  function formatDT(isoString) {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleString(undefined, {
      dateStyle: 'medium',
      timeStyle: 'short',
    });
  }

  // --- Loaders ---
  async function loadCompanies() {
    try {
      const companies = await api.get('companies');
      lists.companies.innerHTML = '';
      companies.forEach((company) => {
        const clone = templates.company.content.cloneNode(true);
        clone.querySelector('[data-name]').textContent = company.name;

        clone.querySelector('.update-btn').addEventListener('click', () => {
          document.getElementById('company-name').value = company.name;
          document.getElementById('company-id').value = company.id;
          window.scrollTo(0, 0);
        });

        clone.querySelector('.delete-btn').addEventListener('click', async () => {
          if (confirm(`Are you sure you want to delete ${company.name}?`)) {
            await api.del('companies', company.id);
            showMessage('Company deleted successfully!');
            loadAllData();
          }
        });

        lists.companies.appendChild(clone);
      });
      populateSelect(selects.lotCompany, companies, 'name', 'id');
    } catch (e) {
      console.error('Failed to load companies:', e);
    }
  }

  async function loadParkingLots() {
    try {
      const lots = await api.get('lots');
      lists.lots.innerHTML = '';
      lots.forEach((lot) => {
        const clone = templates.lot.content.cloneNode(true);
        clone.querySelector('[data-name]').textContent = lot.name;
        lists.lots.appendChild(clone);
      });
      populateSelect(selects.slotLot, lots, 'name', 'id');
    } catch (e) {
      console.error('Failed to load lots:', e);
    }
  }

  async function loadParkingSlots() {
    try {
      const slots = await api.get('slots');
      state.slots = slots;
      lists.slots.innerHTML = '';
      slots.forEach((slot) => {
        const clone = templates.slot.content.cloneNode(true);
        clone.querySelector('[data-name]').textContent = slot.number || slot.name;

        const statusEl = clone.querySelector('[data-status]');
        if (slot.is_occupied) {
          statusEl.textContent = 'Occupied';
          statusEl.className = 'font-medium text-sm px-2 py-0.5 rounded-full bg-red-100 text-red-700';
        } else {
          statusEl.textContent = 'Available';
          statusEl.className = 'font-medium text-sm px-2 py-0.5 rounded-full bg-green-100 text-green-700';
        }

        lists.slots.appendChild(clone);
      });

      const availableSlots = slots.filter((s) => !s.is_occupied);
      populateSelect(selects.bookingSlot, availableSlots, 'number', 'id');
      refreshAvailableSlotDropdown();
    } catch (e) {
      console.error('Failed to load slots:', e);
    }
  }

  async function loadVehicles() {
    try {
      const vehicles = await api.get('vehicles');
      lists.vehicles.innerHTML = '';

      // Rebuild cache for quick lookup by booking.vehicle id
      vehicleById.clear();
      vehicles.forEach((vehicle) => {
        vehicleById.set(vehicle.id, vehicle.plate_number);
        const clone = templates.vehicle.content.cloneNode(true);
        clone.querySelector('[data-number]').textContent = vehicle.plate_number; // correct field
        lists.vehicles.appendChild(clone);
      });

      populateSelect(selects.bookingVehicle, vehicles, 'plate_number', 'id'); // correct field
    } catch (e) {
      console.error('Failed to load vehicles:', e);
    }
  }

  async function loadBookings() {
    try {
      const bookings = await api.get('bookings');
      state.bookings = bookings;
      lists.bookings.innerHTML = '';
      bookings.forEach((booking) => {
        const clone = templates.booking.content.cloneNode(true);
        const titleEl = clone.querySelector('[data-title]');
        if (titleEl) {
          const plate = vehicleById.get(booking.vehicle) || booking.vehicle_plate;
          titleEl.textContent = plate || 'Booking'; // show just the car number
        }
        clone.querySelector('[data-start]').textContent = formatDT(booking.start_time);
        clone.querySelector('[data-end]').textContent = formatDT(booking.end_time);

        const statusEl = clone.querySelector('[data-status]');
        statusEl.textContent = booking.status;
        if (booking.status === 'Completed') {
          statusEl.className = 'font-medium text-sm px-2 py-0.5 rounded-full bg-blue-100 text-blue-700';
        } else {
          statusEl.className = 'font-medium text-sm px-2 py-0.5 rounded-full bg-yellow-100 text-yellow-700';
        }

        const endBtn = clone.querySelector('.update-btn');
        if (booking.status === 'Completed') endBtn.style.display = 'none';

        endBtn.addEventListener('click', async () => {
          if (confirm(`Are you sure you want to end booking ${booking.id}?`)) {
            await api.put('bookings', booking.id, {}); // backend sets end_time/status
            showMessage('Booking ended successfully!');
            loadAllData();
          }
        });

        clone.querySelector('.delete-btn').addEventListener('click', async () => {
          if (confirm(`Are you sure you want to delete booking ${booking.id}?`)) {
            await api.del('bookings', booking.id);
            showMessage('Booking deleted successfully!');
            loadAllData();
          }
        });

        lists.bookings.appendChild(clone);
      });
      refreshAvailableSlotDropdown();
    } catch (e) {
      console.error('Failed to load bookings:', e);
    }
  }

  function refreshAvailableSlotDropdown() {
    // Build a set of occupied slot ids from ongoing bookings (no end_time or non-completed status)
    const occupied = new Set(
      (state.bookings || [])
        .filter(b => !b.end_time && String(b.status).toUpperCase() !== 'COMPLETED')
        .map(b => String(b.slot))
    );

    // Filter slots against occupied set
    const available = (state.slots || []).filter(s => !occupied.has(String(s.id)));

    // If slot objects use `number` field for display, fall back to `name` if needed
    populateSelect(selects.bookingSlot, available, 'number', 'id');
  }

  // --- Forms ---
  forms.company.addEventListener('submit', async (e) => {
    e.preventDefault();
    const id = document.getElementById('company-id').value;
    const name = document.getElementById('company-name').value;
    try {
      if (id) {
        await api.put('companies', id, { name });
        showMessage('Company updated successfully!');
      } else {
        await api.post('companies', { name });
        showMessage('Company added successfully!');
      }
      forms.company.reset();
      loadAllData();
    } catch (e) {
      console.error('Failed to save company:', e);
      showMessage('Failed to save company.', 'error');
    }
  });

  forms.lot.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      name: document.getElementById('lot-name').value,
      company: document.getElementById('lot-company').value,
    };
    try {
      await api.post('lots', data);
      showMessage('Parking lot added successfully!');
      forms.lot.reset();
      loadAllData();
    } catch (e) {
      console.error('Failed to save parking lot:', e);
      showMessage('Failed to save parking lot.', 'error');
    }
  });

  forms.slot.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      number: document.getElementById('slot-name').value,
      lot: document.getElementById('slot-lot').value,
    };
    try {
      await api.post('slots', data);
      showMessage('Slot added successfully!');
      forms.slot.reset();
      loadAllData();
    } catch (e) {
      console.error('Failed to save parking slot:', e);
      showMessage('Failed to save parking slot.', 'error');
    }
  });

  forms.vehicle.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      plate_number: document.getElementById('vehicle-number').value,
    };
    try {
      await api.post('vehicles', data);
      showMessage('Vehicle added successfully!');
      forms.vehicle.reset();
      loadAllData();
    } catch (e) {
      console.error('Failed to save vehicle:', e);
      showMessage('Failed to save vehicle.', 'error');
    }
  });

  forms.booking.addEventListener('submit', async (e) => {
    e.preventDefault();
    const data = {
      vehicle: document.getElementById('booking-vehicle').value,
      slot: document.getElementById('booking-slot').value,
    };
    if (!data.vehicle || !data.slot) {
      showMessage('Please select both a vehicle and a slot.', 'info');
      return;
    }
    // Prevent double-booking on the client (extra safety)
    const isOccupied = (state.bookings || []).some(b =>
      String(b.slot) === String(data.slot) &&
      !b.end_time &&
      String(b.status).toUpperCase() !== 'COMPLETED'
    );
    if (isOccupied) {
      showMessage('Slot already full', 'error');
      return;
    }
    try {
      await api.post('bookings', data);
      // Optimistically remove the chosen slot from the dropdown
      const opt = selects.bookingSlot.querySelector(`option[value="${data.slot}"]`);
      if (opt) opt.remove();
      showMessage('Booking created successfully!');
      forms.booking.reset();
      loadAllData();
    } catch (e) {
      console.error('Failed to create booking:', e);
      showMessage('Failed to create booking.', 'error');
    }
  });

  // --- Initial Load ---
  async function loadAllData() {
    await loadCompanies();
    await loadParkingLots();
    await loadParkingSlots();
    await loadVehicles();      // build vehicle cache first
    await loadBookings();      // then render bookings with plate numbers
  }

  loadAllData();
});
