'use strict';

// prettier-ignore
const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
const form = document.querySelector('.form');
const containerWorkouts = document.querySelector('.workouts');
const inputType = document.querySelector('.form__input--type');
const inputDistance = document.querySelector('.form__input--distance');
const inputDuration = document.querySelector('.form__input--duration');
const inputCadence = document.querySelector('.form__input--cadence');
const inputElevation = document.querySelector('.form__input--elevation');

class Workout {
  date = new Date();
  id = (Date.now() + '').slice(-10);
  clicks = 0;

  constructor (coords, distance, duration) {
    this.coords = coords; // [lat, long]
    this.distance = distance; // in km
    this.duration = duration; // in minutes
  }

  _setDescription() {
    const month = this.date.toLocaleString('default', { month: 'long' });
    this.description = `${this.type[0].toUpperCase() + this.type.slice(1)} on ${month} ${this.date.getDay()}`
  }

  click() {
    this.clicks++;
  }
}

class Running extends Workout {
  type = 'running';
  constructor (coords, distance, duration, cadence) {
    super(coords, distance, duration);
    this.cadence = cadence;
    this.calcPace();
    this._setDescription();
  }

  calcPace() {
    this.pace = this.duration / this.distance;
    return this.pace;
  }
}

class Cycling extends Workout {
  type = 'cycling'
  constructor (coords, distance, duration, elevationGain) {
    super(coords, distance, duration);
    this.elevationGain = elevationGain;
    this.calcSpeed();
    this._setDescription();
  }

  calcSpeed() {
    this.speed = this.distance / this.duration;
    return this.speed;
  }
}

// Application Architecture
class App {
  #map;
  #mapEvent;
  #mapZoomLevel = 13;
  #workouts = [];
  #markers = {};

  constructor() {
    this._getPosition();
    // Get data from local storage
    this._getLocalStorage();
    form.addEventListener('submit', this._submitWorkout.bind(this));
    inputType.addEventListener('change', this._toggleElevationField);
    containerWorkouts.addEventListener('click', this._moveToPopUp.bind(this));
    document.addEventListener('click', this._deleteWorkout.bind(this));
    document.addEventListener('click', this._openEditWorkoutForm.bind(this));
  }

  _getPosition() {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition(
        this._loadMap.bind(this),
        function() {
          alert('Could not get your position');
        }
      )
    }
  }

  _loadMap(position) {
    const { latitude, longitude } = position.coords;

    // Add leaflet map
    this.#map = L.map('map').setView([latitude, longitude], 13);
    L.tileLayer('https://{s}.tile.openstreetmap.fr/hot/{z}/{x}/{y}.png', {
      maxZoom: 19,
      attribution: '&copy; <a href="http://www.openstreetmap.org/copyrights">OpenStreetMap</a>'
    }).addTo(this.#map);


    this.#map.on('click', this._showForm.bind(this));

    this.#workouts.forEach(workout => {
      this._renderWorkoutMarker(workout);
    });
  }

  _showForm(mapE) {
    this.#mapEvent = mapE;
    form.classList.remove('hidden');
    inputDistance.focus();
  }

  _hideForm() {
    inputDistance.value = inputDuration.value = inputCadence.value = inputElevation.value = '';
    form.style.display = 'none';
    form.classList.add('hidden');
    setTimeout(() => (form.style.display = 'grid'), 1000);
  }

  _toggleElevationField() {
    inputElevation.closest('.form__row').classList.toggle('form__row--hidden');
    inputCadence.closest('.form__row').classList.toggle('form__row--hidden');
  }

  _removeWorkoutList() {
    const workoutList = document.querySelectorAll('.workout');
    if (!workoutList) return;
    workoutList.forEach(workout => {
      workout.remove();
    });
  }

  _submitWorkout(e) {
    const validInputs = (...inputs) => {
      return inputs.every(input => Number.isFinite(input) && input >= 0);
    }

    e.preventDefault();

    // Common inputs
    const type = inputType.value;
    const distance = Number(inputDistance.value);
    const duration = Number(inputDuration.value);

    // If update
    if (form.dataset.type === 'update') {
      // If workout is running, create a running object
      const workoutID = form.dataset.id;
      const workoutIdx = this.#workouts.findIndex(workout => workout.id === workoutID);
      this.#workouts[workoutIdx]['type'] = type;
      this.#workouts[workoutIdx]['distance'] = distance;
      this.#workouts[workoutIdx]['duration'] = duration;

      if (type === 'running') {
        const cadence = Number(inputCadence.value);

        // Check if data is valid
        if (!validInputs(distance, duration, cadence))
          return alert('Inputs have to be positive numbers.');

        this.#workouts[workoutIdx]['cadence'] = cadence;
      }

      if (type === 'cycling') {
        const elevation = Number(inputElevation.value);

        // Check if data is valid
        if (!validInputs(distance, duration, elevation))
          return alert('Inputs have to be positive numbers.');

        this.#workouts[workoutIdx]['elevationGain'] = elevation;
      }

      // Remove current workout list
      this._removeWorkoutList();

      // Rerender workout list
      this.#workouts.forEach(workout => {
        this._renderWorkout(workout);
      });

    } else {
      const {lat, lng} = this.#mapEvent.latlng;
      let workout;

      // If workout is running, create a running object
      if (type === 'running') {
        const cadence = Number(inputCadence.value);

        // Check if data is valid
        if (!validInputs(distance, duration, cadence))
          return alert('Inputs have to be positive numbers.');

        workout = new Running([lat, lng], distance, duration, cadence);

      }

      // If workout is cycling, create cycling object
      if (type === 'cycling') {
        const elevation = Number(inputElevation.value);

        // Check if data is valid
        if (!validInputs(distance, duration, elevation))
          return alert('Inputs have to be positive numbers.');

        workout = new Cycling([lat, lng], distance, duration, elevation);
      }

      // Add new object to workout array
      this.#workouts.push(workout);
      console.log(this.#workouts);

      // Render workout marker on map
      this._renderWorkoutMarker(workout, type);

      // Render workout on list
      this._renderWorkout(workout);
    }

    // Clear input fields
    this._hideForm();

    // Set local storage
    this._setLocalStorage();
  }

  _renderWorkoutMarker(workout) {
    // Display marker
    const marker = L.marker(workout.coords).addTo(this.#map);
    marker.bindPopup(L.popup({
      maxWidth: 250,
      minWidth: 100,
      autoClose: false,
      closeOnClick: false,
      className: `${workout.type}-popup`
    })).setPopupContent(`${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'} ${workout.description}`).openPopup();

    // Add marker
    this.#markers[workout.id] = marker;
    // console.log("markers", this.#markers);
  }

  _renderWorkout(workout) {
    let html = `
      <li class="workout workout--${workout.type}" data-id="${workout.id}">
        <button class="edit-btn" data-id="${workout.id}">Edit</button>
        <button class="delete-btn" data-id="${workout.id}">Delete</button>
        <h2 class="workout__title">${workout.description}</h2>
        <div class="workout__details">
          <span class="workout__icon">${workout.type === 'running' ? '🏃‍♂️' : '🚴‍♀️'}</span>
          <span class="workout__value">${workout.distance}</span>
          <span class="workout__unit">km</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⏱</span>
          <span class="workout__value">${workout.duration}</span>
          <span class="workout__unit">min</span>
        </div>
    `;

    if (workout.type === 'running') {
      html += `
          <div class="workout__details">
            <span class="workout__icon">⚡️</span>
            <span class="workout__value">${workout.pace.toFixed(1)}</span>
            <span class="workout__unit">min/km</span>
          </div>
          <div class="workout__details">
            <span class="workout__icon">🦶🏼</span>
            <span class="workout__value">${workout.cadence}</span>
            <span class="workout__unit">spm</span>
          </div>
        </li>
      `
    }

    if (workout.type === 'cycling') {
      html += `
          <div class="workout__details">
          <span class="workout__icon">⚡️</span>
          <span class="workout__value">${workout.speed}</span>
          <span class="workout__unit">km/h</span>
        </div>
        <div class="workout__details">
          <span class="workout__icon">⛰</span>
          <span class="workout__value">${workout.elevationGain}</span>
          <span class="workout__unit">m</span>
        </div>
      </li>
      `
    }

    form.insertAdjacentHTML('afterend', html);
  }

  _moveToPopUp(e) {
    const workoutEl = e.target.closest('.workout');
    if (!workoutEl) return;

    const workout = this.#workouts.find(work => work.id === workoutEl.dataset.id);
    this.#map.setView(workout.coords, this.#mapZoomLevel, {
      animate: true,
      pan: {
        duration: 1
      }
    });
  }

  _setLocalStorage() {
    localStorage.setItem('workouts', JSON.stringify(this.#workouts));
  }

  _getLocalStorage() {
    const data = JSON.parse(localStorage.getItem('workouts'));

    if (!data) return;
    this.#workouts = data;

    this.#workouts.forEach(workout => {
      this._renderWorkout(workout);
    });
  }

  _removeWorkoutMarker(id) {
    // remove marker
    this.#map.removeLayer(this.#markers[id]);
  }

  _deleteWorkout(e) {
    // Guard clause that looks for specific button click
    let element = e.target;

    if (element.tagName === 'BUTTON' && element.classList.contains("delete-btn")) {
      // identify the workout by dataset id
      const workoutID = element.dataset.id;
      if (!workoutID) return;

      // Remove element
      const workoutEl = e.target.closest('.workout');
      workoutEl.remove();

      // Remove marker
      this._removeWorkoutMarker(workoutID);

      // remove workout from workouts list
      this.#workouts = this.#workouts.filter(work => work.id !== workoutID);
      this._setLocalStorage();
    }
  }

  _updateWorkout(e) {
    e.preventDefault();

    this.#workouts.forEach(workout => {
      this._renderWorkout(workout);
    });
  }

  _openEditWorkoutForm(e) {
    // Find element
    let element = e.target;
    if (element.tagName === 'BUTTON' && element.classList.contains("edit-btn")) {
      // identify the workout by dataset id
      const workoutID = element.dataset.id;
      if (!workoutID) return;

      // Populate inputs with existing data
      const workoutData =  this.#workouts.filter(work => work.id === workoutID)[0];
      const workoutEl = e.target.closest('.workout');
      console.log(workoutEl);

      if (workoutData.type === 'cycling') {
        inputElevation.closest('.form__row').classList.remove('form__row--hidden');
        inputCadence.closest('.form__row').classList.add('form__row--hidden');
        inputElevation.value = workoutData.elevationGain;
      }

      if (workoutData.type === 'running') {
        inputElevation.closest('.form__row').classList.add('form__row--hidden');
        inputCadence.closest('.form__row').classList.remove('form__row--hidden');
        inputCadence.value = workoutData.cadence;
      }

      inputDistance.value = workoutData.distance;
      inputDuration.value = workoutData.duration;
      inputType.value = workoutData.type;

      // set method to update
      form.dataset.type = 'update';
      form.dataset.id = workoutID;

      // Show form
      this._showForm(e);
    }




    // remove workout from workouts list
    // this.#workouts = this.#workouts.filter(work => work.id !== workoutID);
    // this._setLocalStorage();
    // Guard clause that looks for specific button click
  }

  reset() {
    localStorage.removeItem('workouts');
    location.reload();
  }
}

const app = new App();
