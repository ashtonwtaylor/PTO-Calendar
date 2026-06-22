// Get current date
let current = new Date();

// Define structure of user data to be exported in JSON:
let state = {
  // Default to 8-hour workday (users may change this):
  hoursPerDay: 8,
  available: {
    pto: { hours: 0 },
    sick: { hours: 0 }
  },
  // The values for days will be in the format "YYYY-MM-DD": "day type":
  days: {}
};

// Loading/saving user data from local storage:
function saveState() {
  localStorage.setItem('ptoData', JSON.stringify(state));
}

function loadState() {
  const saved = localStorage.getItem('ptoData');
  if (saved) {
    Object.assign(state, JSON.parse(saved));
  }
}


// Read available time and hours per day from user:
function initSettings() {
  const hoursPerDay = document.getElementById('hours-per-day');
  const ptoHours = document.getElementById('pto-hours');
  const ptoDays = document.getElementById('pto-days');
  const sickHours = document.getElementById('sick-hours');
  const sickDays = document.getElementById('sick-days');

  hoursPerDay.value = state.hoursPerDay;
  ptoHours.value = state.available.pto.hours;
  ptoDays.value = Math.floor(state.available.pto.hours / state.hoursPerDay);
  sickHours.value = state.available.sick.hours;
  sickDays.value = Math.floor(state.available.sick.hours / state.hoursPerDay);

  hoursPerDay.addEventListener('input', () => {
    // Use 1 in the fallback case to prevent NaN calculations (zero division)
    // while the user is editing the text box:
    state.hoursPerDay = parseInt(hoursPerDay.value) || 1;

    // Refresh pto days and sick days using the new hoursPerDay value:
    ptoDays.value = Math.floor(state.available.pto.hours / state.hoursPerDay);
    sickDays.value = Math.floor(state.available.sick.hours / state.hoursPerDay);
    saveState();
    updateSummary();
  });

  ptoHours.addEventListener('input', () => {
    state.available.pto.hours = parseInt(ptoHours.value) || 0;
    ptoDays.value = Math.floor(state.available.pto.hours / state.hoursPerDay);
    saveState();
    updateSummary();
  });

  ptoDays.addEventListener('input', () => {
    state.available.pto.hours = (parseInt(ptoDays.value) || 0) * state.hoursPerDay;
    ptoHours.value = state.available.pto.hours;
    saveState();
    updateSummary();
  });

  sickHours.addEventListener('input', () => {
    state.available.sick.hours = parseInt(sickHours.value) || 0;
    sickDays.value = Math.floor(state.available.sick.hours / state.hoursPerDay);
    saveState();
    updateSummary();
  });

  sickDays.addEventListener('input', () => {
    state.available.sick.hours = (parseInt(sickDays.value) || 0) * state.hoursPerDay;
    sickHours.value = state.available.sick.hours;
    saveState();
    updateSummary();
  });
}


// Use popup menu for users to mark days as PTO, Free PTO, or Sick:
function openPopup(key, anchorE1) {
  // key = date, anchorE1 = the day cell element to display the popup next to

  // Remove existing popup:
  closePopup();

  const popup = document.createElement('div');
  popup.id = 'day-popup';

  // Define popup options. These will be stored as values in user JSON data,
  // and will also be the CSS class names used to highlight calendar days.
  // If the day has already been marked, push clear as an option:
  const options = ['pto', 'free', 'sick'];
  if (state.days[key]) {
    options.push('clear');
  }

  // Define popup labels:
  const labels = {
    pto: 'PTO',
    free: 'Free PTO',
    sick: 'Sick',
    clear: 'Clear'
  };

  options.forEach(option => {
    const btn = document.createElement('button');
    btn.textContent = labels[option];
    
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (option === 'clear') {
        delete state.days[key];
      } else {
        state.days[key] = option;
      }
      saveState();
      renderCalendar();
      closePopup();
    });
    popup.appendChild(btn);
  });

  // Position the popup by the clicked day cell by dynamically using CSS
  // to style it depending on where the user clicks:
  const rect = anchorE1.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.top = Math.min(rect.bottom + 4, window.innerHeight - 120) + 'px';
  popup.style.left = Math.min(rect.left, window.innerWidth - 120) + 'px';

  document.body.appendChild(popup);

  // Close popup when clicking outside of it:
  setTimeout(() => {
    document.addEventListener('click', closePopup, { once: true });
  }, 0);
}

function closePopup() {
  const existing = document.getElementById('day-popup');
  if (existing) existing.remove();
}


function updateSummary() {
  const ptoUsedHours = Object.values(state.days).filter(t => t === 'pto').length * state.hoursPerDay;
  const sickUsedHours = Object.values(state.days).filter(t => t === 'sick').length * state.hoursPerDay;

  document.getElementById('pto-used-hours').textContent = ptoUsedHours;
  document.getElementById('pto-avail-hours').textContent = state.available.pto.hours;
  document.getElementById('pto-used-days').textContent = Math.floor(ptoUsedHours / state.hoursPerDay);
  document.getElementById('pto-avail-days').textContent = Math.floor(state.available.pto.hours / state.hoursPerDay);

  document.getElementById('sick-used-hours').textContent = sickUsedHours;
  document.getElementById('sick-avail-hours').textContent = state.available.sick.hours;
  document.getElementById('sick-used-days').textContent = Math.floor(sickUsedHours / state.hoursPerDay);
  document.getElementById('sick-avail-days').textContent = Math.floor(state.available.sick.hours / state.hoursPerDay);
}


function renderCalendar() {
  const calendar = document.getElementById('calendar');
  const label = document.getElementById('month-label');
  calendar.innerHTML = '';

  const year = current.getFullYear();
  const month = current.getMonth();

  label.textContent = new Date(year, month).toLocaleString('default', {
    month: 'long', year: 'numeric'
  });


  // Day-of-week headers:
  ['Su','Mo','Tu','We','Th','Fr','Sa'].forEach(d => {
    const el = document.createElement('div');
    el.className = 'day';
    el.textContent = d;
    el.style.fontWeight = 'bold';
    calendar.appendChild(el);
  });


  // Empty cells before the 1st:
  const firstDay = new Date(year, month, 1).getDay();
  for (let i = 0; i < firstDay; i++) {
    const el = document.createElement('div');
    el.className = 'day empty';
    calendar.appendChild(el);
  }


  // Day cells:
  // Works by getting the last day of the month previous to month plus 1,
  // which gives the number of days in month + 0:
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  // Create elements for each day of the month:
  for (let d = 1; d <= daysInMonth; d++) {
    const key = `${year}-${month}-${d}`;
    const el = document.createElement('div');

    // Append the day type to the class name, if a type exists for that day:
    el.className = 'day' + (state.days[key] ? ' ' + state.days[key]: '');

    el.textContent = d;
    el.addEventListener('click', (e) => {
      e.stopPropagation();
      openPopup(key, el);
    });
    calendar.appendChild(el);
  }

  updateSummary();
}


document.getElementById('prev').addEventListener('click', () => {
  current.setMonth(current.getMonth() - 1);
  renderCalendar();
});


document.getElementById('next').addEventListener('click', () => {
  current.setMonth(current.getMonth() + 1);
  renderCalendar();
});

loadState();
initSettings();
renderCalendar();