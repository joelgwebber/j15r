var parks = [
  { name: "Golden Gate Park", id: "goldengate" },
  { name: "Golden Gate Rain", id: "goldengaterain" },
  { name: "Grant Kohrs Ranch", id: "grantkohrs" },
  { name: "Grand Teton", id: "grandteton" },
  { name: "Kenai Fjords", id: "kenaifjords" },
  { name: "Sitka", id: "sitka" },
  { name: "Sitka Rain", id: "sitkarain" },
  { name: "Wrangell", id: "wrangell" },
  { name: "Hawai'i Volcanoes", id: "hawaii"},
  { name: "Fort Stevens Waves", id: "fortstevens"},
  { name: "Cape Disappointment", id: "capedisappointment"},
  { name: "Rocky Mountain Thunder", id: "rmnpthunder"},
  { name: "Rocky Mountain Stream", id: "rmnpstream"},
  { name: "Rockies Afternoon Storm", id: "rmnpafternoon"},
  { name: "Sun Valley Dawn Chorus", id: "sunvalleydawn"},
  { name: "Hollowell Storm Birds", id: "hollowellthunder"},
  { name: "Nighttime Elk", id: "elknight"},
  { name: "Yellowstone Mud Pots", id: "yellowmud" },
  { name: "Yellowstone Dawn Chorus", id: "yellowdawn"},
  { name: "Yellowstone Night Chorus", id: "yellownight"},
  { name: "Boundary Waters Campfire", id: "boundarycamp"},
  { name: "Boundary Waters Dawn Chorus", id: "boundarydawn"},
  { name: "Oyster Lake", id: "oysterlake"},
  { name: "Reservoir Ridge Birdsong", id: "reservoirridge"},
  { name: "Rainforest Dawn Chorus", id: "rainforestdawn"},
  { name: "Oregon Trail Wind", id: "oregonwind"},
  { name: "Cedar Breaks", id: "cedarbreaks" },
];

var states;
var playing = false;

restoreState();
var tmpl = document.getElementById("park-tmpl");
for (var i = 0; i < parks.length; i++) {
  initPark(parks[i]);
}

window.onbeforeunload = saveState;

var playPauseBtn = document.getElementById("playPause");
playPauseBtn.addEventListener("click", playPause);

var infoBtn = document.getElementById("info");
var infoBox = document.getElementById("info-box");
infoBtn.addEventListener("click", function(e) {
  infoBox.classList.add("visible");
  e.stopPropagation();
});
infoBox.addEventListener("click", function(e) {
  e.stopPropagation();
});
document.body.addEventListener("click", function(e) {
  infoBox.classList.remove("visible");
  e.stopPropagation();
});

function initPark(park) {
  park.root = tmpl.content.firstElementChild.cloneNode(true);
  park.audio = park.root.getElementsByTagName("audio")[0];
  park.slider = park.root.getElementsByClassName("slider")[0];

  var button = park.root.getElementsByClassName("button")[0];
  var name = park.root.getElementsByClassName("name")[0];

  name.textContent = park.name;
  park.audio.src = "https://storage.googleapis.com/j15rpersonal/" + park.id + ".mp3";
  button.style.backgroundImage = "url(" + park.id + ".jpg)";
  document.body.appendChild(park.root);

  var state = states[park.id];
  updateState(park, state);
  function update() {
    if (!playing) {
      playPause();
    }
    updateState(park, state);
    updatePlaying(park, state);
  }
  button.addEventListener("click", function() { state.playing = !state.playing; update() });
  park.slider.addEventListener("input", function() { state.volume = parseFloat(park.slider.value); update() });
}

function playPause() {
  playing = !playing;
  playPauseBtn.src = playing ? "pause.png" : "play.png";
  for (var i = 0; i < parks.length; i++) {
    updatePlaying(parks[i], states[parks[i].id]);
  }
}

function updateState(park, state) {
  park.slider.value = "" + state.volume;
  if (state.playing) {
    park.root.classList.add("playing");
  } else {
    park.root.classList.remove("playing");
  }
}

function updatePlaying(park, state) {
  park.audio.volume = state.volume;
  if (state.playing && playing) {
    park.audio.play();
  } else {
    park.audio.pause();
  }
}

function saveState() {
  sessionStorage.setItem("parks", JSON.stringify(states));
}

function restoreState() {
  if (stateIsSaved()) {
    states = JSON.parse(sessionStorage["parks"]);
  } else {
    states = {};
  }

  for (var i = 0; i < parks.length; i++) {
    if (!(parks[i].id in states)) {
      states[parks[i].id] = {playing: false, volume: 0.5};
    }
  }
}

function stateIsSaved() {
  return "parks" in sessionStorage;
}
