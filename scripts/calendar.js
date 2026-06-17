// Get current date in YYYY-MM-DD format
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
    el.addEventListener('click', () => {
      // TODO: Open popup menu when user clicks on a day
    });
    calendar.appendChild(el);
  }
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
renderCalendar();