import { initializeApp } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-app.js";
import { getAuth, GoogleAuthProvider, signInWithPopup, signInAnonymously, linkWithPopup, signOut, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-auth.js";
import { initializeFirestore, persistentLocalCache, doc, getDoc, setDoc } from "https://www.gstatic.com/firebasejs/12.15.0/firebase-firestore.js";
import { firebaseConfig } from "./firebase-config.js";

const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
const db = initializeFirestore(app, {
  localCache: persistentLocalCache()
});


// Auth functions:

async function signInWithGoogle() {
  try {
    const provider = new GoogleAuthProvider();
    await signInWithPopup(auth, provider);
  } catch (err) {
    showAuthError('Google sign-in failed. Please try again.');
  }
}

async function signInAsGuest() {
  try {
    await signInAnonymously(auth);
  } catch (err) {
    showAuthError('Could not sign in. Please try again.');
  }
}

async function linkGoogleAccount() {
  try {
    const provider = new GoogleAuthProvider();
    await linkWithPopup(auth.currentUser, provider);
  } catch (err) {
    if (err.code === 'auth/credential-already-in-use') {
      showAuthError('This Google account has already been linked. Sign out and sign in with Google instead.');
    } else {
      showAuthError('Could not link account. Please try again.');
    }
  }
}

function showAuthError(message) {
  const el = document.getElementById('auth-error');
  el.textContent = message;
  el.style.display = '';
}

async function handleSignOut() {
  await signOut(auth);
}

function initAuth() {
  document.getElementById('google-signin-btn').addEventListener('click', signInWithGoogle);
  document.getElementById('anonymous-signin-btn').addEventListener('click', signInAsGuest);
  document.getElementById('link-account-btn').addEventListener('click', linkGoogleAccount);
  document.getElementById('signout-btn').addEventListener('click', handleSignOut);
}

function initControls() {
  const hoursPerDay = document.getElementById('hours-per-day');
  const ptoHours = document.getElementById('pto-hours');
  const ptoDays = document.getElementById('pto-days');
  const sickHours = document.getElementById('sick-hours');
  const sickDays = document.getElementById('sick-days');

  hoursPerDay.addEventListener('input', () => {
    // Use 1 in the fallback case to prevent NaN calculations (zero division)
    // while the user is editing the text box:
    state.hoursPerDay = parseInt(hoursPerDay.value) || 1;

    // Refresh pto days and sick days using the new hoursPerDay value:
    ptoDays.value = Math.floor(state.available.pto.hours / state.hoursPerDay);
    sickDays.value = Math.floor(state.available.sick.hours / state.hoursPerDay);
    saveStateToFirestore();
    updateSummary();
  });

  ptoHours.addEventListener('input', () => {
    state.available.pto.hours = parseInt(ptoHours.value) || 0;
    ptoDays.value = Math.floor(state.available.pto.hours / state.hoursPerDay);
    saveStateToFirestore();
    updateSummary();
  });

  ptoDays.addEventListener('input', () => {
    state.available.pto.hours = (parseInt(ptoDays.value) || 0) * state.hoursPerDay;
    ptoHours.value = state.available.pto.hours;
    saveStateToFirestore();
    updateSummary();
  });

  sickHours.addEventListener('input', () => {
    state.available.sick.hours = parseInt(sickHours.value) || 0;
    sickDays.value = Math.floor(state.available.sick.hours / state.hoursPerDay);
    saveStateToFirestore();
    updateSummary();
  });

  sickDays.addEventListener('input', () => {
    state.available.sick.hours = (parseInt(sickDays.value) || 0) * state.hoursPerDay;
    sickHours.value = state.available.sick.hours;
    saveStateToFirestore();
    updateSummary();
  });

  document.getElementById('toggle-view').addEventListener('click', () => {
    toggleView();
  });

  document.getElementById('export-btn').addEventListener('click', exportData);

  document.getElementById('import-input').addEventListener('change', (e) => {
    if (e.target.files[0]) importData(e.target.files[0]);
  });

  document.getElementById('clear-btn').addEventListener('click', clearData);
}

function onUserSignedIn(user) {
  document.getElementById('auth-overlay').style.display = 'none';
  document.getElementById('main-content').style.display = '';
  document.getElementById('user-label').textContent = user.isAnonymous ? 'Guest' : user.email;
  document.getElementById('link-account-btn').style.display = user.isAnonymous ? '' : 'none';
}

function onUserSignedOut() {
  state.hoursPerDay = 8;
  state.viewMode = 'days';
  state.available.pto.hours = 0;
  state.available.sick.hours = 0;
  state.days = {};
  document.getElementById('auth-overlay').style.display = 'flex';
  document.getElementById('main-content').style.display = 'none';
}

// Firebase listener, fires automatically whenever auth state changes
onAuthStateChanged(auth, async (user) => {
  if (user) {
    onUserSignedIn(user);
    await loadStateFromFirestore(user.uid);
    initSettings();
    applyView();
    renderCalendar();
  } else {
    onUserSignedOut();
  }
});


// Get current year
let currentYear = new Date().getFullYear();

// Define structure of user data:
let state = {
  // Default to 8-hour workday (users may change this):
  hoursPerDay: 8,
  viewMode: 'days',
  available: {
    pto: { hours: 0 },
    sick: { hours: 0 }
  },
  // The values for days will be in the format "YYYY-MM-DD": "day type":
  days: {}
};


// Loading/saving user data with Firestore:
async function loadStateFromFirestore(uid) {
  // Handle for user data in Firestore:
  const docRef = doc(db, 'users', uid);
  // Fetch user data from Firestore using handle:
  const docSnap = await getDoc(docRef);

  if (docSnap.exists()) {
    Object.assign(state, docSnap.data());
  }
}

async function saveStateToFirestore() {
  const user = auth.currentUser;
  if (!user) return;
  const docRef = doc(db, 'users', user.uid);
  await setDoc(docRef, state);
}


function initSettings() {
  document.getElementById('hours-per-day').value = state.hoursPerDay;
  document.getElementById('pto-hours').value = state.available.pto.hours;
  document.getElementById('pto-days').value = Math.floor(state.available.pto.hours / state.hoursPerDay);
  document.getElementById('sick-hours').value = state.available.sick.hours;
  document.getElementById('sick-days').value = Math.floor(state.available.sick.hours / state.hoursPerDay);
}


function toggleView() {
  state.viewMode = state.viewMode === 'hours' ? 'days' : 'hours';
  saveStateToFirestore();
  applyView();
}

function applyView() {
  const isHours = state.viewMode === 'hours';

  document.getElementById('toggle-view').textContent = isHours ? 'Switch to Days View' : 'Switch to Hours View';

  // Show/hide settings inputs depending on view:
  document.getElementById('pto-hours').parentElement.style.display = isHours ? '' : 'none';
  document.getElementById('pto-days').parentElement.style.display = isHours ? 'none' : '';
  document.getElementById('sick-hours').parentElement.style.display = isHours ? '' : 'none';
  document.getElementById('sick-days').parentElement.style.display = isHours ? 'none' : '';

  updateSummary();
}


// Saving/loading with JSON:
function exportData() {
  const json = JSON.stringify(state, null, 2);
  const blob = new Blob([json], { type: 'application/json'});
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'pto-data.json';
  a.click();
  URL.revokeObjectURL(url);
}

function importData(file) {
  const reader = new FileReader();
  reader.onload = (e) => {
    Object.assign(state, JSON.parse(e.target.result));
    saveStateToFirestore();
    initSettings();
    applyView();
    renderCalendar();
  };
  reader.readAsText(file);
}

function clearData() {
  if (!confirm('Are you sure you want to clear all data? This cannot be undone.')) return;
  state.hoursPerDay = 8;
  state.viewMode = 'days';
  state.available.pto.hours = 0;
  state.available.sick.hours = 0;
  state.days = {};
  saveStateToFirestore();
  initSettings();
  applyView();
  renderCalendar();
}


// Use popup menu for users to mark days as PTO, Free PTO, or Sick:
function openPopup(key, anchorE1) {
  // key = date, anchorE1 = the day cell element to display the popup next to

  // Remove existing popup:
  closePopup();

  const popup = document.createElement('div');
  popup.id = 'day-popup';

  // Partial time entries will be stored as an object (a pair, day type: hours
  // as a float) with the date as a key, unlike regular whole days, which are
  // just stored as a string value. Detect whether the day is full or partial:
  const currentDay = state.days[key];
  const currentType = typeof currentDay === 'object' ? currentDay.type : currentDay;

  // Define popup options. These will be stored as values in user JSON data,
  // and will also be the CSS class names used to highlight calendar days.
  // If the day has already been marked, push clear as an option:
  const options = ['pto', 'free', 'sick'];
  if (currentDay) { options.push('clear'); }

  // If a pto or sick day is clicked, allow custom hour entry:
  if (currentType === 'pto' || currentType === 'sick') { options.push('custom'); }

  // Define popup labels:
  const labels = {
    pto: 'PTO',
    free: 'Free PTO',
    sick: 'Sick',
    clear: 'Clear',
    custom: 'Custom hours'
  };

  options.forEach(option => {
    const btn = document.createElement('button');
    btn.textContent = labels[option];
    
    btn.addEventListener('click', (e) => {
      e.stopPropagation();
      if (option === 'clear') {
        delete state.days[key];
        saveStateToFirestore();
        renderCalendar();
        closePopup();
      } else if (option === 'custom') {
        closePopup();
        openCustomHoursPopup(key, anchorE1, currentType);
      } else {
        state.days[key] = option;
        saveStateToFirestore();
        renderCalendar();
        closePopup();
      }
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

function openCustomHoursPopup(key, anchorE1, type) {
  const popup = document.createElement('div');
  popup.id = 'day-popup';

  const input = document.createElement('input');
  input.type = 'number';
  input.min = '0.01';
  input.max = state.hoursPerDay;
  input.step = '1';
  const currentDay = state.days[key];
  input.value = typeof currentDay === 'object' ? currentDay.hours : state.hoursPerDay;
  input.style.width = '60px';

  const confirm = document.createElement('button');
  confirm.textContent = 'Confirm';
  confirm.addEventListener('click', (e) => {
    e.stopPropagation();
    // Only allow up to two decimal places:
    const hours = Math.round(parseFloat(input.value) * 100) / 100;
    if (hours > 0) {
      state.days[key] = { type, hours };
      saveStateToFirestore();
      renderCalendar();
    }
    closePopup();
  });

  popup.appendChild(input);
  popup.appendChild(confirm);

  const rect = anchorE1.getBoundingClientRect();
  popup.style.position = 'fixed';
  popup.style.top = Math.min(rect.bottom + 4, window.innerHeight - 120) + 'px';
  popup.style.left = Math.min(rect.left, window.innerWidth - 120) + 'px';

  document.body.appendChild(popup);
}

function closePopup() {
  const existing = document.getElementById('day-popup');
  if (existing) existing.remove();
}


function updateSummary() {
  const isHours = state.viewMode === 'hours';
  
  // Sum hours accordingly for whole vs. partial entries:
  let ptoUsedHours = 0;
  let sickUsedHours = 0;
  for (const v of Object.values(state.days)) {
    if (typeof v === 'object') {
      if (v.type === 'pto') { ptoUsedHours += v.hours; }
      if (v.type === 'sick') { sickUsedHours += v.hours; }
    } else {
      if (v === 'pto') { ptoUsedHours += state.hoursPerDay; }
      if (v === 'sick') { sickUsedHours += state.hoursPerDay; }
    }
  }

  document.getElementById('pto-used-hours').textContent = ptoUsedHours;
  document.getElementById('pto-avail-hours').textContent = state.available.pto.hours;
  document.getElementById('pto-used-days').textContent = Math.floor(ptoUsedHours / state.hoursPerDay);
  document.getElementById('pto-avail-days').textContent = Math.floor(state.available.pto.hours / state.hoursPerDay);

  document.getElementById('sick-used-hours').textContent = sickUsedHours;
  document.getElementById('sick-avail-hours').textContent = state.available.sick.hours;
  document.getElementById('sick-used-days').textContent = Math.floor(sickUsedHours / state.hoursPerDay);
  document.getElementById('sick-avail-days').textContent = Math.floor(state.available.sick.hours / state.hoursPerDay);

  document.getElementById('pto-summary-hours').style.display = isHours ? '' : 'none';
  document.getElementById('pto-summary-days').style.display = isHours ? 'none' : '';
  document.getElementById('sick-summary-hours').style.display = isHours ? '' : 'none';
  document.getElementById('sick-summary-days').style.display = isHours ? 'none' : '';

  document.getElementById('pto-summary-hours').classList.toggle('exceeded', ptoUsedHours > state.available.pto.hours);
  document.getElementById('pto-summary-days').classList.toggle('exceeded', ptoUsedHours > state.available.pto.hours);
  document.getElementById('sick-summary-hours').classList.toggle('exceeded', sickUsedHours > state.available.sick.hours);
  document.getElementById('sick-summary-days').classList.toggle('exceeded', sickUsedHours > state.available.sick.hours);

}


function renderCalendar() {
  const container = document.getElementById('calendar');
  container.innerHTML = '';

  document.getElementById('year-label').textContent = currentYear;

  for (let month = 0; month < 12; month++) {
    const monthWrapper = document.createElement('div');
    monthWrapper.className = 'month';

    const monthLabel = document.createElement('div');
    monthLabel.className = 'month-label';
    monthLabel.textContent = new Date(currentYear, month).toLocaleString('default', { month: 'long' });
    monthWrapper.appendChild(monthLabel);

    const grid = document.createElement('div');
    grid.className = 'month-grid';


    // Day-of-week headers:
    ['Su', 'Mo', 'Tu', 'We', 'Th', 'Fr', 'Sa'].forEach(d => {
      const el = document.createElement('div');
      el.className = 'day-header';
      el.textContent = d;
      grid.appendChild(el);
    });


    // Empty cells before the 1st:
    const firstDay = new Date(currentYear, month, 1).getDay();
    for (let i = 0; i < firstDay; i++) {
      const el = document.createElement('div');
      el.className = 'day empty';
      grid.appendChild(el);
    }


    // Day cells:
    // Works by getting the last day of the month previous to month plus 1,
    // which gives the number of days in month + 0:
    const daysInMonth = new Date(currentYear, month + 1, 0).getDate();

    // Create elements for each day of the month:
    for (let d = 1; d <= daysInMonth; d++) {
      const key = `${currentYear}-${month}-${d}`;
      const el = document.createElement('div');

      // Append the day type to the class name, if a type exists for that day.
      // Also, check for values with partial entries (objects):
      const dayValue = state.days[key];
      const dayType = typeof dayValue === 'object' ? dayValue.type : dayValue;
      el.className = 'day' + (dayType ? ' ' + dayType : '');

      el.textContent = d;
      if (typeof dayValue === 'object') {
        const hoursLabel = document.createElement('div');
        hoursLabel.className = 'day-hours';
        hoursLabel.textContent = dayValue.hours + 'hrs';
        el.appendChild(hoursLabel);
      }

      el.addEventListener('click', (e) => {
        e.stopPropagation();
        openPopup(key, el);
      });
      grid.appendChild(el);
    }

    monthWrapper.appendChild(grid);
    container.appendChild(monthWrapper);
  }

  updateSummary();
}


document.getElementById('prev').addEventListener('click', () => {
  currentYear--;
  renderCalendar();
});


document.getElementById('next').addEventListener('click', () => {
  currentYear++;
  renderCalendar();
});

initAuth();
initControls();