/**
 * Aether 3D & 8D Music Player - Core Application Logic
 * Implements Web Audio API, 3D Spatial Panning, 8D Orbit Simulation,
 * 5-Band Equalizer, Canvas Visualizer, and IndexedDB Local Persistence.
 */

// --- Default Demo Tracks ---
const DEMO_TRACKS = [
    {
        id: "demo_1",
        title: "Synthwave Dream",
        artist: "Neon Skyline (Demo)",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-1.mp3",
        duration: "6:12",
        playlistId: "demo"
    },
    {
        id: "demo_2",
        title: "Acoustic Breeze",
        artist: "Lofi Meadows (Demo)",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-2.mp3",
        duration: "7:05",
        playlistId: "demo"
    },
    {
        id: "demo_3",
        title: "Chill Cosmic",
        artist: "Ether Lounge (Demo)",
        url: "https://www.soundhelix.com/examples/mp3/SoundHelix-Song-4.mp3",
        duration: "5:02",
        playlistId: "demo"
    }
];

// --- Application State ---
let db = null;
let playlists = [];
let songs = []; // Dynamic user uploaded songs loaded from IndexedDB
let currentPlaylistId = "demo"; // 'demo' or playlist UUID
let currentPlaylistSongs = [...DEMO_TRACKS];
let currentSongIndex = -1;
let isPlaying = false;
let isShuffle = false;
let isRepeat = false;

// --- Web Audio API Context & Nodes ---
let audioCtx = null;
let audioSource = null;
let audioElement = null;
let eqFilters = [];
let delayNode = null;
let feedbackGain = null;
let reverbWetGain = null;
let pannerNode = null;
let analyserNode = null;
let visualizerDataArray = [];

// --- 8D & 3D Spatial State ---
let is8DEnabled = false;
let orbitAngle = 0;
let orbitSpeed = 1.5; // Hz (rotations per second)
let orbitRadius = 80;  // Percentage of max radius
let reverbPercent = 30; // Spatial Reverb mix
let currentX = 0;      // 3D coordinates [-5, 5]
let currentZ = 0;
let currentY = 0;
let lastFrameTime = performance.now();
let orbitTimer = null; // Background orbit timer when screen is hidden

// --- Screen Wake Lock State ---
let wakeLock = null;
let isWakeLockActive = false;

// --- DJ Panel State ---
let isDjEnabled = false;
let djFilterNode = null;
let djFilterValue = 0; // [-100, 100]
let djSpeed = 1.0;     // [0.5, 2.0]

// --- 5.1 Virtual Surround State ---
let isSurroundMode = false;
let surroundNodes = []; // Array of { name, panner, gain, delay, x, z }
let lfeFilterNode = null;
let lfeGainNode = null;
let lfePannerNode = null;

// --- Voice Recorder State ---
let mediaRecorder = null;
let recordedChunks = [];
let isRecording = false;
let recorderInterval = null;
let recorderDuration = 0;

// --- Microphone Mixing State ---
let micStream = null;
let micSourceNode = null;
let micGainNode = null;
let isMicActive = false;

// --- DOM Elements ---
const elPlayPauseBtn = document.getElementById("btn-play-pause");
const elPrevBtn = document.getElementById("btn-prev");
const elNextBtn = document.getElementById("btn-next");
const elShuffleBtn = document.getElementById("btn-shuffle");
const elRepeatBtn = document.getElementById("btn-repeat");
const elVolumeSlider = document.getElementById("volume-slider");
const elProgressBarBg = document.getElementById("progress-bar-bg");
const elProgressBarFill = document.getElementById("progress-bar-fill");
const elProgressBarHandle = document.getElementById("progress-bar-handle");
const elTimeCurrent = document.getElementById("time-current");
const elTimeDuration = document.getElementById("time-duration");

const elTrackTitle = document.getElementById("track-title");
const elTrackArtist = document.getElementById("track-artist");
const elTrackBadge = document.getElementById("track-playlist-badge");
const elSongList = document.getElementById("song-list");
const elPlaylistTabs = document.getElementById("playlist-tabs");
const elBtnCreatePlaylist = document.getElementById("btn-create-playlist");

const elToggle8d = document.getElementById("toggle-8d");
const elSliderOrbitSpeed = document.getElementById("slider-orbit-speed");
const elSliderOrbitRadius = document.getElementById("slider-orbit-radius");
const elSliderReverb = document.getElementById("slider-reverb");
const elValOrbitSpeed = document.getElementById("val-orbit-speed");
const elValOrbitRadius = document.getElementById("val-orbit-radius");
const elValReverb = document.getElementById("val-reverb");

// DJ UI Elements
const elToggleDj = document.getElementById("toggle-dj");
const elDjControlsContent = document.getElementById("dj-controls-content");
const elSliderDjSpeed = document.getElementById("slider-dj-speed");
const elValDjSpeed = document.getElementById("val-dj-speed");
const elBtnResetDjSpeed = document.getElementById("btn-reset-dj-speed");
const elSliderDjFilter = document.getElementById("slider-dj-filter");
const elValDjFilter = document.getElementById("val-dj-filter");
const elBtnSfxAirhorn = document.getElementById("btn-sfx-airhorn");
const elBtnSfxSiren = document.getElementById("btn-sfx-siren");
const elBtnSfxScratch = document.getElementById("btn-sfx-scratch");
const elBtnSfxLaser = document.getElementById("btn-sfx-laser");

const elSpatialPad = document.getElementById("spatial-pad");
const elBtnResetSpatial = document.getElementById("btn-reset-spatial");
const elBtnToggleSurround = document.getElementById("btn-toggle-surround");
const elCoordinatesDisplay = document.getElementById("coordinates-display");
const elPresetSelector = document.getElementById("preset-selector");

// Video screen, Audio element, Wake Lock and Microphone elements
const elAudioScreen = document.getElementById("audio-screen");
const elVideoScreen = document.getElementById("video-screen");
const elWakeLockBtn = document.getElementById("btn-wake-lock");
const elBtnRecord = document.getElementById("btn-record");
const elRecorderTimer = document.getElementById("recorder-timer");
const elRecorderWave = document.getElementById("recorder-wave");
const elToggleMic = document.getElementById("toggle-mic");
const elSliderMicVolume = document.getElementById("slider-mic-volume");
const elValMicVolume = document.getElementById("val-mic-volume");

const elModalContainer = document.getElementById("modal-container");
const elPlaylistNameInput = document.getElementById("playlist-name-input");
const elModalCancel = document.getElementById("modal-cancel");
const elModalSubmit = document.getElementById("modal-submit");

const elUploadZone = document.getElementById("upload-zone");
const elFileInput = document.getElementById("file-input");

const elVisualizerCanvas = document.getElementById("visualizer-canvas");
let visualizerCtx = elVisualizerCanvas.getContext("2d");

const elSpatialPadCtx = elSpatialPad.getContext("2d");

// --- Initialize IndexedDB ---
function initDB() {
    return new Promise((resolve, reject) => {
        const request = indexedDB.open("AetherMusicPlayerDB", 2);
        
        request.onupgradeneeded = (e) => {
            const database = e.target.result;
            if (!database.objectStoreNames.contains("playlists")) {
                database.createObjectStore("playlists", { keyPath: "id" });
            }
            if (!database.objectStoreNames.contains("songs")) {
                database.createObjectStore("songs", { keyPath: "id" });
            }
        };
        
        request.onsuccess = (e) => {
            db = e.target.result;
            resolve();
        };
        
        request.onerror = (e) => reject(e.target.error);
    });
}

// --- Load Playlists and Songs from DB ---
async function loadDataFromDB() {
    if (!db) return;
    
    // Load Playlists
    playlists = await new Promise((resolve) => {
        const transaction = db.transaction("playlists", "readonly");
        const store = transaction.objectStore("playlists");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
    });

    // Ensure we have at least one custom playlist if none exist
    if (playlists.length === 0) {
        const defaultPlaylist = { id: "my_uploads", name: "My Uploads" };
        const transaction = db.transaction("playlists", "readwrite");
        transaction.objectStore("playlists").put(defaultPlaylist);
        playlists.push(defaultPlaylist);
    }
    
    // Load Songs
    songs = await new Promise((resolve) => {
        const transaction = db.transaction("songs", "readonly");
        const store = transaction.objectStore("songs");
        const req = store.getAll();
        req.onsuccess = () => resolve(req.result || []);
        req.onerror = () => resolve([]);
    });
    
    // Load active playlist from localStorage if exists
    const savedPlaylistId = localStorage.getItem("aether_current_playlist_id");
    if (savedPlaylistId) {
        currentPlaylistId = savedPlaylistId;
    }

    renderPlaylists();
    selectPlaylist(currentPlaylistId);
}

// --- Save Playlist to DB ---
function savePlaylistToDB(playlist) {
    if (!db) return;
    const transaction = db.transaction("playlists", "readwrite");
    transaction.objectStore("playlists").put(playlist);
}

// --- Delete Playlist from DB ---
function deletePlaylistFromDB(playlistId) {
    if (!db) return;
    const transaction = db.transaction(["playlists", "songs"], "readwrite");
    transaction.objectStore("playlists").delete(playlistId);
    
    // Also delete all songs associated with this playlist
    const songStore = transaction.objectStore("songs");
    const req = songStore.getAll();
    req.onsuccess = () => {
        const allSongs = req.result || [];
        allSongs.forEach(s => {
            if (s.playlistId === playlistId) {
                songStore.delete(s.id);
            }
        });
    };
}

// --- Save Song to DB ---
function saveSongToDB(song) {
    return new Promise((resolve, reject) => {
        if (!db) return reject("Database not initialized");
        const transaction = db.transaction("songs", "readwrite");
        const request = transaction.objectStore("songs").put(song);
        request.onsuccess = () => resolve();
        request.onerror = (e) => reject(e.target.error);
    });
}

// --- Delete Song from DB ---
function deleteSongFromDB(songId) {
    if (!db) return;
    const transaction = db.transaction("songs", "readwrite");
    transaction.objectStore("songs").delete(songId);
}

// --- Render Playlist Tabs ---
function renderPlaylists() {
    elPlaylistTabs.innerHTML = "";
    
    // Demo Playlist
    const demoLi = document.createElement("li");
    demoLi.textContent = "Demo Tracks";
    demoLi.className = currentPlaylistId === "demo" ? "active" : "";
    demoLi.addEventListener("click", () => selectPlaylist("demo"));
    elPlaylistTabs.appendChild(demoLi);
    
    // Custom Playlists
    playlists.forEach(playlist => {
        const li = document.createElement("li");
        li.className = currentPlaylistId === playlist.id ? "active" : "";
        
        const nameSpan = document.createElement("span");
        nameSpan.textContent = playlist.name;
        nameSpan.style.cursor = "pointer";
        nameSpan.addEventListener("click", () => selectPlaylist(playlist.id));
        li.appendChild(nameSpan);
        
        // Delete button for custom playlists
        const delBtn = document.createElement("button");
        delBtn.className = "delete-playlist-btn";
        delBtn.innerHTML = '<i class="fa-solid fa-trash-can"></i>';
        delBtn.title = "Delete Playlist";
        delBtn.addEventListener("click", (e) => {
            e.stopPropagation();
            if (confirm(`Are you sure you want to delete the playlist "${playlist.name}" and all its songs?`)) {
                deletePlaylist(playlist.id);
            }
        });
        li.appendChild(delBtn);
        
        elPlaylistTabs.appendChild(li);
    });
}

// --- Select Playlist ---
function selectPlaylist(playlistId) {
    currentPlaylistId = playlistId;
    
    // Save to localStorage for persistence across reloads
    localStorage.setItem("aether_current_playlist_id", playlistId);
    
    // Update active tab styling
    const tabs = elPlaylistTabs.querySelectorAll("li");
    tabs.forEach(tab => tab.classList.remove("active"));
    
    if (playlistId === "demo") {
        currentPlaylistSongs = [...DEMO_TRACKS];
        if (tabs[0]) tabs[0].classList.add("active");
    } else {
        currentPlaylistSongs = songs.filter(s => s.playlistId === playlistId);
        const activeIndex = playlists.findIndex(p => p.id === playlistId);
        if (activeIndex !== -1 && tabs[activeIndex + 1]) {
            tabs[activeIndex + 1].classList.add("active");
        }
    }
    
    renderSongList();
}

// --- Create Playlist ---
function createPlaylist(name) {
    if (!name.trim()) return;
    const newPlaylist = {
        id: "playlist_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
        name: name.trim()
    };
    playlists.push(newPlaylist);
    savePlaylistToDB(newPlaylist);
    renderPlaylists();
    selectPlaylist(newPlaylist.id);
}

// --- Delete Playlist ---
function deletePlaylist(playlistId) {
    playlists = playlists.filter(p => p.id !== playlistId);
    songs = songs.filter(s => s.playlistId !== playlistId);
    deletePlaylistFromDB(playlistId);
    
    if (currentPlaylistId === playlistId) {
        selectPlaylist("demo");
    } else {
        renderPlaylists();
    }
}

// --- Render Song List ---
function renderSongList() {
    elSongList.innerHTML = "";
    
    if (currentPlaylistSongs.length === 0) {
        const li = document.createElement("li");
        li.textContent = "No songs in this playlist. Upload some below!";
        li.style.color = "var(--text-secondary)";
        li.style.fontStyle = "italic";
        li.style.cursor = "default";
        elSongList.appendChild(li);
        return;
    }
    
    currentPlaylistSongs.forEach((song, index) => {
        const li = document.createElement("li");
        if (currentSongIndex === index && isPlaying) {
            li.className = "playing";
        }
        
        // Play indicator
        const playIcon = document.createElement("span");
        playIcon.className = "song-play-icon";
        if (currentSongIndex === index && isPlaying) {
            playIcon.innerHTML = '<i class="fa-solid fa-volume-high"></i>';
        } else {
            playIcon.innerHTML = '<i class="fa-solid fa-play"></i>';
        }
        li.appendChild(playIcon);
        
        // Title
        const titleSpan = document.createElement("span");
        titleSpan.className = "song-title";
        titleSpan.textContent = song.title;
        li.appendChild(titleSpan);
        
        // Duration
        const durSpan = document.createElement("span");
        durSpan.className = "song-dur";
        durSpan.textContent = song.duration || "0:00";
        li.appendChild(durSpan);
        
        // Delete button for user songs
        if (currentPlaylistId !== "demo") {
            const delBtn = document.createElement("button");
            delBtn.className = "delete-playlist-btn"; // reuse styles
            delBtn.innerHTML = '<i class="fa-solid fa-trash"></i>';
            delBtn.style.marginLeft = "10px";
            delBtn.style.background = "none";
            delBtn.style.border = "none";
            delBtn.addEventListener("click", (e) => {
                e.stopPropagation();
                if (confirm(`Remove "${song.title}" from this playlist?`)) {
                    removeSong(song.id);
                }
            });
            li.appendChild(delBtn);
        }
        
        li.addEventListener("click", () => playSongAtIndex(index));
        elSongList.appendChild(li);
    });
}

// --- Remove Song ---
function removeSong(songId) {
    songs = songs.filter(s => s.id !== songId);
    deleteSongFromDB(songId);
    
    // Update local state
    const playingSongId = currentPlaylistSongs[currentSongIndex]?.id;
    
    selectPlaylist(currentPlaylistId);
    
    // Restore playback highlight if currently playing track wasn't deleted
    if (playingSongId) {
        const newIndex = currentPlaylistSongs.findIndex(s => s.id === playingSongId);
        if (newIndex !== -1) {
            currentSongIndex = newIndex;
            renderSongList();
        } else {
            // Playing song was deleted
            audioElement.pause();
            isPlaying = false;
            currentSongIndex = -1;
            updatePlayPauseUI();
        }
    }
}

// --- Audio Engine Setup ---
function initAudioEngine() {
    if (audioCtx) return; // Already initialized
    
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtx = new AudioContextClass();
    
    // Auto-resume AudioContext whenever state turns to suspended while playing
    audioCtx.onstatechange = () => {
        if (audioCtx.state === "suspended" && isPlaying) {
            audioCtx.resume().catch(() => {});
        }
    };
    
    // Use dedicated HTML5 Audio element for maximum mobile OS background audio compatibility
    audioElement = elAudioScreen || elVideoScreen;
    audioElement.crossOrigin = "anonymous";
    
    // Hook audio events
    audioElement.addEventListener("ended", handleTrackEnded);
    audioElement.addEventListener("timeupdate", () => {
        updateProgressBar();
        updateMediaSessionState();
    });
    audioElement.addEventListener("loadedmetadata", () => {
        elTimeDuration.textContent = formatTime(audioElement.duration);
        updateMediaSessionState();
    });
    
    // Initialize Media Session API
    setupMediaSession();
    
    // Create source
    audioSource = audioCtx.createMediaElementSource(audioElement);
    
    // Create Equalizer Filters (5 Bands)
    // Band 0: Bass (60Hz, Low Shelf)
    // Band 1: Low-Mid (230Hz, Peaking)
    // Band 2: Mid (910Hz, Peaking)
    // Band 3: High-Mid (4kHz, Peaking)
    // Band 4: Treble (14kHz, High Shelf)
    const frequencies = [60, 230, 910, 4000, 14000];
    const types = ["lowshelf", "peaking", "peaking", "peaking", "highshelf"];
    
    let lastNode = audioSource;
    
    for (let i = 0; i < 5; i++) {
        const filter = audioCtx.createBiquadFilter();
        filter.frequency.value = frequencies[i];
        filter.type = types[i];
        filter.Q.value = 1.0;
        filter.gain.value = 0; // Flat initially
        
        eqFilters.push(filter);
        lastNode.connect(filter);
        lastNode = filter;
    }
    
    // --- Create DJ Filter Node ---
    djFilterNode = audioCtx.createBiquadFilter();
    updateDJFilter();
    
    // Connect EQ output to DJ Filter
    lastNode.connect(djFilterNode);
    
    // --- Create Spatial Reverb Node (Feedback Delay Network representation) ---
    // Create delay loop
    delayNode = audioCtx.createDelay(1.0);
    delayNode.delayTime.value = 0.045; // 45ms room size reflection delay
    
    feedbackGain = audioCtx.createGain();
    feedbackGain.gain.value = 0.45; // reflection decay rate
    
    reverbWetGain = audioCtx.createGain();
    updateReverbLevel();
    
    // Connect feedback loop
    djFilterNode.connect(delayNode);
    delayNode.connect(feedbackGain);
    feedbackGain.connect(delayNode); // loop
    
    // Wet path: delay -> wetGain -> destination
    delayNode.connect(reverbWetGain);
    
    // --- Create 3D Spatial Panner ---
    pannerNode = audioCtx.createPanner();
    pannerNode.panningModel = 'HRTF'; // Realistic spatial filter
    pannerNode.distanceModel = 'inverse';
    pannerNode.refDistance = 1;
    pannerNode.maxDistance = 10000;
    pannerNode.rolloffFactor = 1;
    pannerNode.coneInnerAngle = 360;
    pannerNode.coneOuterAngle = 360;
    
    // Listener is always at origin (0, 0, 0) looking down -Z axis
    if (audioCtx.listener.positionX) {
        audioCtx.listener.positionX.setValueAtTime(0, audioCtx.currentTime);
        audioCtx.listener.positionY.setValueAtTime(0, audioCtx.currentTime);
        audioCtx.listener.positionZ.setValueAtTime(0, audioCtx.currentTime);
        
        audioCtx.listener.forwardX.setValueAtTime(0, audioCtx.currentTime);
        audioCtx.listener.forwardY.setValueAtTime(0, audioCtx.currentTime);
        audioCtx.listener.forwardZ.setValueAtTime(-1, audioCtx.currentTime);
        audioCtx.listener.upX.setValueAtTime(0, audioCtx.currentTime);
        audioCtx.listener.upY.setValueAtTime(1, audioCtx.currentTime);
        audioCtx.listener.upZ.setValueAtTime(0, audioCtx.currentTime);
    } else {
        // Fallback for older browsers
        audioCtx.listener.setPosition(0, 0, 0);
        audioCtx.listener.setOrientation(0, 0, -1, 0, 1, 0);
    }
    
    // --- Create Analyser ---
    analyserNode = audioCtx.createAnalyser();
    analyserNode.fftSize = 256;
    const bufferLength = analyserNode.frequencyBinCount;
    visualizerDataArray = new Uint8Array(bufferLength);
    analyserNode.connect(audioCtx.destination);
    
    // Dynamically update audio connections (Surround mode / Single Panner mode)
    updateAudioConnections();
    
    // Initial 3D Position setup
    updateSpatialPosition(0, 0, 0); // front center
    
    // Apply current equalizer gains if they were modified before init
    applyEQSettings();
    
    // Trigger visualizer loop
    drawVisualizer();
}

// --- Media Session API (Background & Lock screen playback support) ---
function setupMediaSession() {
    if (!('mediaSession' in navigator)) return;

    try {
        navigator.mediaSession.setActionHandler('play', () => handlePlayPause());
        navigator.mediaSession.setActionHandler('pause', () => handlePlayPause());
        navigator.mediaSession.setActionHandler('previoustrack', () => handlePrev());
        navigator.mediaSession.setActionHandler('nexttrack', () => handleNext());
        
        try {
            navigator.mediaSession.setActionHandler('seekto', (details) => {
                if (audioElement && details.seekTime !== undefined) {
                    audioElement.currentTime = details.seekTime;
                    updateProgressBar();
                    updateMediaSessionState();
                }
            });
        } catch (e) {}

        try {
            navigator.mediaSession.setActionHandler('seekbackward', (details) => {
                if (audioElement) {
                    const skipTime = details.seekOffset || 10;
                    audioElement.currentTime = Math.max(audioElement.currentTime - skipTime, 0);
                    updateProgressBar();
                    updateMediaSessionState();
                }
            });
        } catch (e) {}

        try {
            navigator.mediaSession.setActionHandler('seekforward', (details) => {
                if (audioElement) {
                    const skipTime = details.seekOffset || 10;
                    audioElement.currentTime = Math.min(audioElement.currentTime + skipTime, audioElement.duration || 0);
                    updateProgressBar();
                    updateMediaSessionState();
                }
            });
        } catch (e) {}
    } catch (err) {
        console.warn("Media Session API setup error:", err);
    }
}

function updateMediaSessionMetadata(song) {
    if (!('mediaSession' in navigator) || !song) return;
    try {
        navigator.mediaSession.metadata = new MediaMetadata({
            title: song.title || "Unknown Track",
            artist: song.artist || "Aether Spatial Engine",
            album: "Aether 3D & 8D Player",
            artwork: [
                { src: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=192&h=192&fit=crop", sizes: "192x192", type: "image/jpeg" },
                { src: "https://images.unsplash.com/photo-1511671782779-c97d3d27a1d4?w=512&h=512&fit=crop", sizes: "512x512", type: "image/jpeg" }
            ]
        });
        updateMediaSessionState();
    } catch (err) {
        console.warn("Media Session Metadata update failed:", err);
    }
}

function updateMediaSessionState() {
    if (!('mediaSession' in navigator)) return;
    try {
        navigator.mediaSession.playbackState = isPlaying ? 'playing' : 'paused';
        if (audioElement && !isNaN(audioElement.duration) && audioElement.duration > 0) {
            navigator.mediaSession.setPositionState({
                duration: audioElement.duration,
                playbackRate: audioElement.playbackRate || 1.0,
                position: Math.min(audioElement.currentTime || 0, audioElement.duration)
            });
        }
    } catch (e) {}
}

// --- Screen Wake Lock API ---
async function requestWakeLock() {
    if ('wakeLock' in navigator) {
        try {
            wakeLock = await navigator.wakeLock.request('screen');
            isWakeLockActive = true;
            if (elWakeLockBtn) elWakeLockBtn.classList.add('active');
            wakeLock.addEventListener('release', () => {
                isWakeLockActive = false;
                if (elWakeLockBtn) elWakeLockBtn.classList.remove('active');
            });
        } catch (err) {
            console.warn("Screen Wake Lock failed:", err);
        }
    }
}

async function releaseWakeLock() {
    if (wakeLock) {
        try {
            await wakeLock.release();
            wakeLock = null;
        } catch (err) {}
    }
    isWakeLockActive = false;
    if (elWakeLockBtn) elWakeLockBtn.classList.remove('active');
}

function toggleWakeLock() {
    if (isWakeLockActive) {
        releaseWakeLock();
    } else {
        requestWakeLock();
    }
}

// --- Set Reverb Level ---
function updateReverbLevel() {
    if (!reverbWetGain) return;
    // Map slider 0-100% to gain 0-0.8 (too much reverb gets muddy)
    const gainValue = (reverbPercent / 100) * 0.75;
    reverbWetGain.gain.setValueAtTime(gainValue, audioCtx ? audioCtx.currentTime : 0);
}

// --- Format coordinates text ---
function updateCoordinatesBadge() {
    elCoordinatesDisplay.textContent = `X: ${currentX.toFixed(1)}, Z: ${currentZ.toFixed(1)}`;
}

// --- Update 3D Panner Position ---
function updateSpatialPosition(x, y, z) {
    currentX = x;
    currentY = y;
    currentZ = z;
    
    updateCoordinatesBadge();
    
    if (!pannerNode) return;
    
    // Coordinate mapping: 
    // Web Audio listener is at (0,0,0) facing (0,0,-1)
    // Left/Right: X axis
    // Front/Back: Z axis (facing negative Z, so FRONT is negative Z, BACK is positive Z)
    // Up/Down: Y axis (fixed at 0 or small offset)
    const time = audioCtx.currentTime;
    
    if (pannerNode.positionX) {
        pannerNode.positionX.setValueAtTime(x, time);
        pannerNode.positionY.setValueAtTime(y, time);
        pannerNode.positionZ.setValueAtTime(z, time);
    } else {
        pannerNode.setPosition(x, y, z);
    }
}

// --- Reset 3D Spatial Position ---
function resetSpatialPosition() {
    if (is8DEnabled) {
        is8DEnabled = false;
        elToggle8d.checked = false;
    }
    updateSpatialPosition(0, 0, 0);
    drawSpatialPad();
}

// --- Initialize Virtual 5.1 Surround Nodes ---
function initSurroundNodes() {
    if (!audioCtx || surroundNodes.length > 0) return;
    
    // Virtual 5.1 Speaker positions: [x, y, z, delaySeconds, gain]
    // Uses Haas precedence effect delays to simulate a wide, room-wrapping soundstage.
    const configs = [
        { name: "C", x: 0, y: 0, z: -2, delay: 0.0, gain: 0.8 },        // Center (direct sound)
        { name: "FL", x: -2.5, y: 0, z: -2.5, delay: 0.002, gain: 0.95 }, // Front Left
        { name: "FR", x: 2.5, y: 0, z: -2.5, delay: 0.0025, gain: 0.95 },// Front Right
        { name: "SL", x: -4.5, y: 0, z: 2.2, delay: 0.016, gain: 0.85 },  // Surround Left (delayed for rear width)
        { name: "SR", x: 4.5, y: 0, z: 2.2, delay: 0.019, gain: 0.85 }   // Surround Right (delayed for rear width)
    ];
    
    configs.forEach(cfg => {
        const panner = audioCtx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = 10000;
        panner.rolloffFactor = 1;
        panner.coneInnerAngle = 360;
        panner.coneOuterAngle = 360;
        
        const time = audioCtx.currentTime;
        if (panner.positionX) {
            panner.positionX.setValueAtTime(cfg.x, time);
            panner.positionY.setValueAtTime(cfg.y, time);
            panner.positionZ.setValueAtTime(cfg.z, time);
        } else {
            panner.setPosition(cfg.x, cfg.y, cfg.z);
        }
        
        const gain = audioCtx.createGain();
        gain.gain.value = cfg.gain;
        
        const delay = audioCtx.createDelay(1.0);
        delay.delayTime.value = cfg.delay;
        
        // Connect chain: input -> delay -> gain -> panner
        delay.connect(gain);
        gain.connect(panner);
        
        surroundNodes.push({ name: cfg.name, panner, gain, delay, x: cfg.x, z: cfg.z });
    });
    
    // Subwoofer / LFE (Low Frequency Effects) channel
    lfeFilterNode = audioCtx.createBiquadFilter();
    lfeFilterNode.type = "lowpass";
    lfeFilterNode.frequency.value = 120; // Cuts off mids/highs
    
    lfeGainNode = audioCtx.createGain();
    lfeGainNode.gain.value = 1.0;
    
    lfePannerNode = audioCtx.createPanner();
    lfePannerNode.panningModel = 'HRTF';
    lfePannerNode.setPosition(0, -1, 0); // Placed at center floor
    
    lfeFilterNode.connect(lfeGainNode);
    lfeGainNode.connect(lfePannerNode);
}

// --- Update Audio Connections ---
function updateAudioConnections() {
    if (!audioCtx || !djFilterNode) return;
    
    // Disconnect existing graph paths to prevent duplicates
    try {
        djFilterNode.disconnect();
        reverbWetGain.disconnect();
        pannerNode.disconnect();
        surroundNodes.forEach(node => {
            node.panner.disconnect();
        });
        if (lfePannerNode) {
            lfePannerNode.disconnect();
        }
    } catch (e) {
        // Safe check for nodes not connected yet
    }
    
    // Connect feedback reverb loop path
    djFilterNode.connect(delayNode);
    
    if (isSurroundMode) {
        // Initialize surround nodes if they haven't been created yet
        initSurroundNodes();
        
        // Connect dry path: DJ Filter -> each of the 5 delay lines -> analyser
        surroundNodes.forEach(node => {
            djFilterNode.connect(node.delay);
            node.panner.connect(analyserNode);
        });
        
        // Connect deep bass subwoofer path
        djFilterNode.connect(lfeFilterNode);
        lfePannerNode.connect(analyserNode);
        
        // Connect wet reverb to surround speakers for spatial diffuse decay
        surroundNodes.forEach(node => {
            reverbWetGain.connect(node.panner);
        });
    } else {
        // Standard interactive single source speaker
        djFilterNode.connect(pannerNode);
        reverbWetGain.connect(pannerNode);
        pannerNode.connect(analyserNode);
    }
}

// --- Update DJ Filter Node ---
function updateDJFilter() {
    if (!djFilterNode) return;
    
    const now = audioCtx ? audioCtx.currentTime : 0;
    
    if (djFilterValue === 0) {
        djFilterNode.type = "allpass";
        elValDjFilter.textContent = "Bypass";
    } else if (djFilterValue < 0) {
        djFilterNode.type = "lowpass";
        // Map -100 to 0 -> 200Hz to 20000Hz (exponential curve)
        const pct = (djFilterValue + 100) / 100;
        const freq = 200 + pct * pct * 19800;
        djFilterNode.frequency.setValueAtTime(freq, now);
        elValDjFilter.textContent = `LPF: ${Math.round(freq)}Hz`;
    } else {
        djFilterNode.type = "highpass";
        // Map 0 to 100 -> 10Hz to 5000Hz (exponential curve)
        const pct = djFilterValue / 100;
        const freq = 10 + pct * pct * 4990;
        djFilterNode.frequency.setValueAtTime(freq, now);
        elValDjFilter.textContent = `HPF: ${Math.round(freq)}Hz`;
    }
}

// --- DJ Synth Sound Effects ---
function playAirhornSFX() {
    if (!audioCtx) initAudioEngine();
    if (audioCtx.state === "suspended") audioCtx.resume();
    
    const now = audioCtx.currentTime;
    const duration = 1.2;
    const oscs = [];
    const gainNode = audioCtx.createGain();
    
    // Connect to analyser so it visualizes
    gainNode.connect(analyserNode || audioCtx.destination);
    
    const baseFreq = 170;
    // Harmonic frequencies that make the airhorn sound stack
    const harmonics = [1, 2, 2.5, 3, 4, 5];
    
    harmonics.forEach((h, idx) => {
        const osc = audioCtx.createOscillator();
        osc.type = "sawtooth";
        osc.frequency.setValueAtTime(baseFreq * h + (idx % 2 === 0 ? 1.5 : -1.5) * idx, now);
        osc.connect(gainNode);
        osc.start(now);
        osc.stop(now + duration);
        oscs.push(osc);
    });
    
    // Volume envelope
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.25, now + 0.05);
    gainNode.gain.setValueAtTime(0.25, now + 0.85);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
}

function playSirenSFX() {
    if (!audioCtx) initAudioEngine();
    if (audioCtx.state === "suspended") audioCtx.resume();
    
    const now = audioCtx.currentTime;
    const duration = 2.0;
    const osc = audioCtx.createOscillator();
    osc.type = "sine";
    
    // Siren frequency sweeps
    osc.frequency.setValueAtTime(450, now);
    osc.frequency.linearRampToValueAtTime(950, now + 0.5);
    osc.frequency.linearRampToValueAtTime(450, now + 1.0);
    osc.frequency.linearRampToValueAtTime(950, now + 1.5);
    osc.frequency.linearRampToValueAtTime(450, now + 2.0);
    
    const gainNode = audioCtx.createGain();
    gainNode.connect(analyserNode || audioCtx.destination);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.2, now + 0.1);
    gainNode.gain.setValueAtTime(0.2, now + 1.85);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    osc.connect(gainNode);
    osc.start(now);
    osc.stop(now + duration);
}

function playScratchSFX() {
    if (!audioCtx) initAudioEngine();
    if (audioCtx.state === "suspended") audioCtx.resume();
    
    const now = audioCtx.currentTime;
    const duration = 0.45;
    
    // Create random noise buffer
    const bufferSize = audioCtx.sampleRate * duration;
    const buffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
    const data = buffer.getChannelData(0);
    for (let i = 0; i < bufferSize; i++) {
        data[i] = Math.random() * 2 - 1;
    }
    
    const noise = audioCtx.createBufferSource();
    noise.buffer = buffer;
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = "bandpass";
    filter.Q.setValueAtTime(4.0, now);
    filter.frequency.setValueAtTime(600, now);
    filter.frequency.exponentialRampToValueAtTime(3200, now + 0.2);
    filter.frequency.exponentialRampToValueAtTime(800, now + 0.45);
    
    const gainNode = audioCtx.createGain();
    gainNode.connect(analyserNode || audioCtx.destination);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.3, now + 0.05);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    noise.connect(filter);
    filter.connect(gainNode);
    
    noise.start(now);
    noise.stop(now + duration);
}

function playLaserSFX() {
    if (!audioCtx) initAudioEngine();
    if (audioCtx.state === "suspended") audioCtx.resume();
    
    const now = audioCtx.currentTime;
    const duration = 0.55;
    const osc = audioCtx.createOscillator();
    osc.type = "sawtooth";
    
    // Laser sweep down
    osc.frequency.setValueAtTime(1400, now);
    osc.frequency.exponentialRampToValueAtTime(70, now + duration);
    
    const filter = audioCtx.createBiquadFilter();
    filter.type = "lowpass";
    filter.frequency.setValueAtTime(1800, now);
    
    const gainNode = audioCtx.createGain();
    gainNode.connect(analyserNode || audioCtx.destination);
    
    gainNode.gain.setValueAtTime(0, now);
    gainNode.gain.linearRampToValueAtTime(0.18, now + 0.02);
    gainNode.gain.exponentialRampToValueAtTime(0.01, now + duration);
    
    osc.connect(filter);
    filter.connect(gainNode);
    
    osc.start(now);
    osc.stop(now + duration);
}

// --- 8D Orbit Effect loop ---
function processOrbitEffect(time) {
    if (!is8DEnabled) {
        if (orbitTimer) {
            clearTimeout(orbitTimer);
            orbitTimer = null;
        }
        return;
    }
    
    const nowTime = time || performance.now();
    const delta = Math.min((nowTime - lastFrameTime) / 1000, 0.1);
    lastFrameTime = nowTime;
    
    orbitAngle += orbitSpeed * Math.PI * 2 * delta;
    if (orbitAngle > Math.PI * 2) {
        orbitAngle -= Math.PI * 2;
    }
    
    const radiusMeters = 1.0 + (orbitRadius / 100) * 5.0;
    const x = Math.sin(orbitAngle) * radiusMeters;
    const z = -Math.cos(orbitAngle) * radiusMeters;
    const y = Math.sin(orbitAngle * 0.5) * (radiusMeters * 0.2);
    
    updateSpatialPosition(x, y, z);
    
    if (!document.hidden) {
        drawSpatialPad();
    }
    
    if (is8DEnabled) {
        if (document.hidden) {
            // When screen/tab is hidden, requestAnimationFrame is suspended.
            // Fallback to setTimeout to keep 8D sound rotating in background!
            if (orbitTimer) clearTimeout(orbitTimer);
            orbitTimer = setTimeout(() => processOrbitEffect(performance.now()), 33);
        } else {
            requestAnimationFrame(processOrbitEffect);
        }
    }
}

// --- Equalizer Configuration ---
function applyEQSettings() {
    if (eqFilters.length === 0) return;
    for (let i = 0; i < 5; i++) {
        const slider = document.getElementById(`eq-band-${i}`);
        const gainVal = parseFloat(slider.value);
        eqFilters[i].gain.setValueAtTime(gainVal, audioCtx.currentTime);
        document.getElementById(`eq-val-${i}`).textContent = (gainVal > 0 ? "+" : "") + gainVal.toFixed(1) + "dB";
    }
}

// Preset Gains: [Bass, Low-Mid, Mid, High-Mid, Treble]
const EQ_PRESETS = {
    flat: [0, 0, 0, 0, 0],
    bassboost: [8, 4.5, 0.5, -1, -3.5],
    vocalboost: [-3, -1, 3.5, 5, 2],
    electronic: [6.5, 2.5, -1.5, 3, 5.5],
    acoustic: [3, 1.5, 1, 2, 2.5],
    cinematic: [5.5, 3, -2, 2.5, 4.5]
};

function applyPreset(presetName) {
    const gains = EQ_PRESETS[presetName] || EQ_PRESETS.flat;
    for (let i = 0; i < 5; i++) {
        const slider = document.getElementById(`eq-band-${i}`);
        slider.value = gains[i];
    }
    if (audioCtx) {
        applyEQSettings();
    } else {
        // Update label values manually if audio context not created yet
        for (let i = 0; i < 5; i++) {
            document.getElementById(`eq-val-${i}`).textContent = (gains[i] > 0 ? "+" : "") + gains[i].toFixed(1) + "dB";
        }
    }
}

// --- Player Audio Selection & Control ---
function playSongAtIndex(index) {
    if (index < 0 || index >= currentPlaylistSongs.length) return;
    
    // Initialize audio context on first play
    initAudioEngine();
    
    // Resume context if suspended (browser safety policy)
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    
    currentSongIndex = index;
    const song = currentPlaylistSongs[index];
    
    // Setup URL or Blob URL source
    if (song.audioBlob || song.audioData) {
        // Local file
        if (audioElement.src.startsWith("blob:")) {
            URL.revokeObjectURL(audioElement.src);
        }
        
        let blob;
        if (song.audioBlob) {
            blob = song.audioBlob;
        } else {
            blob = new Blob([song.audioData], { type: song.mimeType || 'audio/mpeg' });
        }
        
        audioElement.src = URL.createObjectURL(blob);
    } else {
        // Demo track stream URL
        audioElement.src = song.url;
    }
    
    // Update player UI metadata
    elTrackTitle.textContent = song.title;
    elTrackArtist.textContent = song.artist;
    
    if (currentPlaylistId === "demo") {
        elTrackBadge.textContent = "Demo Tracks";
        elTrackBadge.style.color = "var(--primary-neon)";
        elTrackBadge.style.borderColor = "rgba(0, 243, 255, 0.2)";
        elTrackBadge.style.background = "rgba(0, 243, 255, 0.05)";
    } else {
        const pl = playlists.find(p => p.id === currentPlaylistId);
        elTrackBadge.textContent = pl ? pl.name : "Custom Library";
        elTrackBadge.style.color = "var(--secondary-neon)";
        elTrackBadge.style.borderColor = "rgba(255, 0, 127, 0.2)";
        elTrackBadge.style.background = "rgba(255, 0, 127, 0.05)";
    }
    
    audioElement.play().then(() => {
        isPlaying = true;
        // Keep DJ speed if enabled, otherwise reset to normal speed
        audioElement.playbackRate = isDjEnabled ? djSpeed : 1.0;
        document.body.classList.add("is-playing");
        updatePlayPauseUI();
        renderSongList();
        updateMediaSessionMetadata(song);
    }).catch(err => {
        console.error("Audio playback error:", err);
        alert("Playback failed. Please select another song or try uploading a fresh copy.");
    });
}

function handlePlayPause() {
    if (currentSongIndex === -1) {
        // Nothing playing, start first song
        if (currentPlaylistSongs.length > 0) {
            playSongAtIndex(0);
        }
        return;
    }
    
    initAudioEngine();
    
    if (audioCtx.state === "suspended") {
        audioCtx.resume();
    }
    
    if (isPlaying) {
        audioElement.pause();
        isPlaying = false;
        document.body.classList.remove("is-playing");
    } else {
        audioElement.play();
        isPlaying = true;
        audioElement.playbackRate = isDjEnabled ? djSpeed : 1.0;
        document.body.classList.add("is-playing");
    }
    
    updatePlayPauseUI();
    renderSongList();
    updateMediaSessionState();
}

function handleNext() {
    if (currentPlaylistSongs.length === 0) return;
    
    let nextIndex = currentSongIndex + 1;
    
    if (isShuffle) {
        nextIndex = Math.floor(Math.random() * currentPlaylistSongs.length);
    } else if (nextIndex >= currentPlaylistSongs.length) {
        nextIndex = 0; // Loop to start
    }
    
    playSongAtIndex(nextIndex);
}

function handlePrev() {
    if (currentPlaylistSongs.length === 0) return;
    
    let prevIndex = currentSongIndex - 1;
    
    if (audioElement && audioElement.currentTime > 3) {
        // Restart track instead if it's played a bit
        audioElement.currentTime = 0;
        return;
    }
    
    if (isShuffle) {
        prevIndex = Math.floor(Math.random() * currentPlaylistSongs.length);
    } else if (prevIndex < 0) {
        prevIndex = currentPlaylistSongs.length - 1; // Loop to end
    }
    
    playSongAtIndex(prevIndex);
}

function handleTrackEnded() {
    if (isRepeat) {
        audioElement.currentTime = 0;
        audioElement.play();
    } else {
        handleNext();
    }
}

function updatePlayPauseUI() {
    if (isPlaying) {
        elPlayPauseBtn.innerHTML = '<i class="fa-solid fa-pause"></i>';
        elPlayPauseBtn.title = "Pause";
    } else {
        elPlayPauseBtn.innerHTML = '<i class="fa-solid fa-play"></i>';
        elPlayPauseBtn.title = "Play";
    }
}

// --- Progress Bar Control ---
function updateProgressBar() {
    if (!audioElement || !audioElement.duration) return;
    
    const pct = (audioElement.currentTime / audioElement.duration) * 100;
    elProgressBarFill.style.width = pct + "%";
    elProgressBarHandle.style.left = pct + "%";
    
    elTimeCurrent.textContent = formatTime(audioElement.currentTime);
}

function seekTo(e) {
    if (!audioElement || !audioElement.duration) return;
    
    const rect = elProgressBarBg.getBoundingClientRect();
    const clickX = e.clientX - rect.left;
    const width = rect.width;
    const seekPercent = Math.min(Math.max(clickX / width, 0), 1);
    
    audioElement.currentTime = seekPercent * audioElement.duration;
    updateProgressBar();
}

function formatTime(seconds) {
    if (isNaN(seconds)) return "0:00";
    const mins = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${mins}:${secs < 10 ? '0' : ''}${secs}`;
}

// --- File Upload and Parsing ---
async function handleFileUpload(files) {
    if (currentPlaylistId === "demo") {
        alert("Demo Tracks cannot be modified. Please select or create a custom playlist on the left first.");
        return;
    }
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        if (!file.type.startsWith("audio/")) continue;
        
        // Setup clean metadata
        let title = file.name.replace(/\.[^/.]+$/, ""); // Strip extension
        let artist = "Unknown Artist";
        
        // Rough parse of "Artist - Title" formats
        if (title.includes(" - ")) {
            const parts = title.split(" - ");
            artist = parts[0].trim();
            title = parts.slice(1).join(" - ").trim();
        }
        
        // Load file info to find duration
        const durStr = await getAudioDurationString(file);
        
        // Convert File to ArrayBuffer to prevent DataCloneError in iOS Safari
        let arrayBuffer;
        try {
            arrayBuffer = await file.arrayBuffer();
        } catch (e) {
            console.error("Error reading file to ArrayBuffer:", e);
            continue;
        }
        
        const newSong = {
            id: "song_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
            title: title,
            artist: artist,
            duration: durStr,
            playlistId: currentPlaylistId,
            audioData: arrayBuffer,
            mimeType: file.type
        };
        
        songs.push(newSong);
        await saveSongToDB(newSong);
    }
    
    selectPlaylist(currentPlaylistId);
}

function getAudioDurationString(file) {
    return new Promise((resolve) => {
        const audio = document.createElement("audio");
        audio.src = URL.createObjectURL(file);
        audio.addEventListener("loadedmetadata", () => {
            resolve(formatTime(audio.duration));
            URL.revokeObjectURL(audio.src);
        });
        audio.addEventListener("error", () => {
            resolve("0:00");
        });
    });
}

// --- Canvas Visualizer Animation ---
function drawVisualizer() {
    if (!analyserNode) return;
    
    requestAnimationFrame(drawVisualizer);
    
    analyserNode.getByteFrequencyData(visualizerDataArray);
    
    const width = elVisualizerCanvas.width / window.devicePixelRatio;
    const height = elVisualizerCanvas.height / window.devicePixelRatio;
    
    visualizerCtx.clearRect(0, 0, width, height);
    
    // Draw circular concentric visualizer ring
    const centerX = width / 2;
    const centerY = height / 2;
    const innerRadius = 110; // Slightly larger than the album art disc radius
    const barCount = 60;
    
    const dataLen = visualizerDataArray.length;
    
    // Outer glowing visual effect
    for (let i = 0; i < barCount; i++) {
        // Map bar to frequency bin
        const binIndex = Math.floor((i / barCount) * (dataLen * 0.7));
        const val = visualizerDataArray[binIndex];
        
        // Calculate length of visualizer bars based on frequency energy
        // Boost length slightly for visual energy
        const barLength = (val / 255) * 45;
        
        const angle = (i / barCount) * Math.PI * 2;
        
        const x1 = centerX + Math.sin(angle) * innerRadius;
        const y1 = centerY + Math.cos(angle) * innerRadius;
        
        // Bar extends outward
        const x2 = centerX + Math.sin(angle) * (innerRadius + barLength);
        const y2 = centerY + Math.cos(angle) * (innerRadius + barLength);
        
        // Colorful neon gradient depending on angle
        const grad = visualizerCtx.createLinearGradient(x1, y1, x2, y2);
        
        // Alternate cyan/magenta/purple neon theme
        if (i % 2 === 0) {
            grad.addColorStop(0, "rgba(0, 243, 255, 0.4)");
            grad.addColorStop(1, "rgba(0, 243, 255, 0.9)");
        } else {
            grad.addColorStop(0, "rgba(255, 0, 127, 0.4)");
            grad.addColorStop(1, "rgba(255, 0, 127, 0.9)");
        }
        
        visualizerCtx.strokeStyle = grad;
        visualizerCtx.lineWidth = 4;
        visualizerCtx.lineCap = "round";
        
        // Add neon glow filters to lines
        visualizerCtx.shadowBlur = 10;
        visualizerCtx.shadowColor = i % 2 === 0 ? "rgba(0, 243, 255, 0.5)" : "rgba(255, 0, 127, 0.5)";
        
        visualizerCtx.beginPath();
        visualizerCtx.moveTo(x1, y1);
        visualizerCtx.lineTo(x2, y2);
        visualizerCtx.stroke();
    }
    
    // Reset shadow values for next draw calls
    visualizerCtx.shadowBlur = 0;
}

// --- 3D Spatial Pad Renderer & Controller ---
function drawSpatialPad() {
    const width = elSpatialPad.width / window.devicePixelRatio;
    const height = elSpatialPad.height / window.devicePixelRatio;
    
    elSpatialPadCtx.clearRect(0, 0, width, height);
    
    const centerX = width / 2;
    const centerY = height / 2;
    
    // Draw concentric range rings (distance visual guides)
    elSpatialPadCtx.strokeStyle = "rgba(255, 255, 255, 0.05)";
    elSpatialPadCtx.lineWidth = 1;
    
    for (let r = 30; r < centerX; r += 30) {
        elSpatialPadCtx.beginPath();
        elSpatialPadCtx.arc(centerX, centerY, r, 0, Math.PI * 2);
        elSpatialPadCtx.stroke();
    }
    
    // Draw Crosshairs
    elSpatialPadCtx.beginPath();
    elSpatialPadCtx.moveTo(0, centerY);
    elSpatialPadCtx.lineTo(width, centerY);
    elSpatialPadCtx.moveTo(centerX, 0);
    elSpatialPadCtx.lineTo(centerX, height);
    elSpatialPadCtx.stroke();
    
    // Draw Listener (Center point - user's head)
    // Draw neon headphones symbol or custom head circle
    elSpatialPadCtx.fillStyle = "var(--primary-neon)";
    elSpatialPadCtx.shadowBlur = 15;
    elSpatialPadCtx.shadowColor = "rgba(0, 243, 255, 0.8)";
    
    elSpatialPadCtx.beginPath();
    elSpatialPadCtx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    elSpatialPadCtx.fill();
    
    // Draw Listener Headphone cups (visual cue)
    elSpatialPadCtx.fillStyle = "#ffffff";
    elSpatialPadCtx.fillRect(centerX - 12, centerY - 4, 3, 8); // left cup
    elSpatialPadCtx.fillRect(centerX + 9, centerY - 4, 3, 8);  // right cup
    
    // Draw Speakers based on Mode
    const maxCoord = 6.0;
    
    if (isSurroundMode) {
        // Draw 5 virtual speakers (FL, FR, C, SL, SR)
        const speakerPositions = [
            { name: "C", x: 0, z: -2.0 },
            { name: "FL", x: -2.5, z: -2.5 },
            { name: "FR", x: 2.5, z: -2.5 },
            { name: "SL", x: -4.5, z: 2.2 },
            { name: "SR", x: 4.5, z: 2.2 }
        ];
        
        speakerPositions.forEach(spk => {
            const spkX = centerX + (spk.x / maxCoord) * centerX;
            const spkZ = centerY + (spk.z / maxCoord) * centerY;
            
            // Draw glowing projection line to center (user)
            elSpatialPadCtx.strokeStyle = "rgba(0, 243, 255, 0.18)";
            elSpatialPadCtx.lineWidth = 1;
            elSpatialPadCtx.beginPath();
            elSpatialPadCtx.moveTo(centerX, centerY);
            elSpatialPadCtx.lineTo(spkX, spkZ);
            elSpatialPadCtx.stroke();
            
            // Draw speaker circles
            elSpatialPadCtx.fillStyle = "rgba(155, 81, 224, 0.2)";
            elSpatialPadCtx.strokeStyle = "var(--tertiary-neon)";
            elSpatialPadCtx.lineWidth = 2;
            elSpatialPadCtx.shadowBlur = 10;
            elSpatialPadCtx.shadowColor = "rgba(155, 81, 224, 0.6)";
            
            elSpatialPadCtx.beginPath();
            elSpatialPadCtx.arc(spkX, spkZ, 8, 0, Math.PI * 2);
            elSpatialPadCtx.fill();
            elSpatialPadCtx.stroke();
            
            // Draw speaker label
            elSpatialPadCtx.shadowBlur = 0;
            elSpatialPadCtx.fillStyle = "#ffffff";
            elSpatialPadCtx.font = "8px 'Outfit', sans-serif";
            elSpatialPadCtx.textAlign = "center";
            elSpatialPadCtx.textBaseline = "middle";
            elSpatialPadCtx.fillText(spk.name, spkX, spkZ);
        });
    } else {
        // Draw Single Speaker Node (Sound source)
        const speakerX = centerX + (currentX / maxCoord) * centerX;
        const speakerZ = centerY + (currentZ / maxCoord) * centerY;
        
        // Draw orbit path if 8D enabled
        if (is8DEnabled) {
            elSpatialPadCtx.strokeStyle = "rgba(255, 0, 127, 0.15)";
            elSpatialPadCtx.lineWidth = 2;
            elSpatialPadCtx.shadowBlur = 0;
            
            const radiusMeters = 1.0 + (orbitRadius / 100) * 5.0;
            const orbitRadiusPx = (radiusMeters / maxCoord) * centerX;
            
            elSpatialPadCtx.beginPath();
            elSpatialPadCtx.arc(centerX, centerY, orbitRadiusPx, 0, Math.PI * 2);
            elSpatialPadCtx.stroke();
        }
        
        // Speaker Dot
        elSpatialPadCtx.fillStyle = "var(--secondary-neon)";
        elSpatialPadCtx.shadowBlur = 15;
        elSpatialPadCtx.shadowColor = "rgba(255, 0, 127, 0.8)";
        
        elSpatialPadCtx.beginPath();
        elSpatialPadCtx.arc(speakerX, speakerZ, 10, 0, Math.PI * 2);
        elSpatialPadCtx.fill();
        
        // Speaker inner core
        elSpatialPadCtx.fillStyle = "#ffffff";
        elSpatialPadCtx.shadowBlur = 0;
        elSpatialPadCtx.beginPath();
        elSpatialPadCtx.arc(speakerX, speakerZ, 4, 0, Math.PI * 2);
        elSpatialPadCtx.fill();
    }
}

// --- Resize Canvas Elements for High DPI screens ---
function resizeCanvases() {
    // Visualizer Canvas
    const visRect = elVisualizerCanvas.parentElement.getBoundingClientRect();
    elVisualizerCanvas.width = visRect.width * window.devicePixelRatio;
    elVisualizerCanvas.height = visRect.height * window.devicePixelRatio;
    visualizerCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    // Spatial Pad Canvas
    const padRect = elSpatialPad.parentElement.getBoundingClientRect();
    elSpatialPad.width = padRect.width * window.devicePixelRatio;
    elSpatialPad.height = padRect.height * window.devicePixelRatio;
    elSpatialPadCtx.scale(window.devicePixelRatio, window.devicePixelRatio);
    
    drawSpatialPad();
}

// --- Interactive Spatial Pad Events ---
let isDraggingSpeaker = false;

function handleSpatialPadInput(e) {
    initAudioEngine();
    
    const rect = elSpatialPad.getBoundingClientRect();
    const touchX = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const touchZ = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    
    const width = rect.width;
    const height = rect.height;
    
    // Map pixel click to coordinates range [-6.0, 6.0]
    const maxCoord = 6.0;
    const x = ((touchX / width) * 2 - 1) * maxCoord;
    const z = ((touchZ / height) * 2 - 1) * maxCoord;
    
    // Disable 8D effect if user manually drags speaker
    if (is8DEnabled) {
        is8DEnabled = false;
        elToggle8d.checked = false;
    }
    
    // Disable 5.1 Surround mode if user manually drags speaker
    if (isSurroundMode) {
        isSurroundMode = false;
        if (elBtnToggleSurround) {
            elBtnToggleSurround.classList.remove("active");
        }
        updateAudioConnections();
    }
    
    updateSpatialPosition(x, 0, z);
    drawSpatialPad();
}

// --- Bind Interactive DOM Events ---
function setupEventListeners() {
    // Playback Buttons
    elPlayPauseBtn.addEventListener("click", handlePlayPause);
    elNextBtn.addEventListener("click", handleNext);
    elPrevBtn.addEventListener("click", handlePrev);
    
    elShuffleBtn.addEventListener("click", () => {
        isShuffle = !isShuffle;
        elShuffleBtn.classList.toggle("active", isShuffle);
    });
    
    elRepeatBtn.addEventListener("click", () => {
        isRepeat = !isRepeat;
        elRepeatBtn.classList.toggle("active", isRepeat);
    });
    
    // Volume Control
    elVolumeSlider.addEventListener("input", () => {
        if (audioElement) {
            audioElement.volume = elVolumeSlider.value;
        }
    });
    
    // Seek
    elProgressBarBg.addEventListener("mousedown", seekTo);
    
    // 8D Toggle & Controls
    elToggle8d.addEventListener("change", () => {
        is8DEnabled = elToggle8d.checked;
        if (is8DEnabled) {
            // Disable 5.1 Surround mode if enabling 8D
            if (isSurroundMode) {
                isSurroundMode = false;
                if (elBtnToggleSurround) {
                    elBtnToggleSurround.classList.remove("active");
                }
                updateAudioConnections();
            }
            initAudioEngine();
            lastFrameTime = performance.now();
            requestAnimationFrame(processOrbitEffect);
        } else {
            // Restore center front position on disable
            updateSpatialPosition(0, 0, 0);
            drawSpatialPad();
        }
    });
    
    elSliderOrbitSpeed.addEventListener("input", () => {
        orbitSpeed = parseFloat(elSliderOrbitSpeed.value);
        elValOrbitSpeed.textContent = orbitSpeed.toFixed(1) + "Hz";
    });
    
    elSliderOrbitRadius.addEventListener("input", () => {
        orbitRadius = parseInt(elSliderOrbitRadius.value);
        elValOrbitRadius.textContent = orbitRadius + "%";
    });
    
    elSliderReverb.addEventListener("input", () => {
        reverbPercent = parseInt(elSliderReverb.value);
        elValReverb.textContent = reverbPercent + "%";
        updateReverbLevel();
    });
    
    // Spatial Coordinate Pad Interaction (Pointers work for mouse and touch)
    elSpatialPad.addEventListener("pointerdown", (e) => {
        isDraggingSpeaker = true;
        elSpatialPad.setPointerCapture(e.pointerId);
        handleSpatialPadInput(e);
    });
    
    elSpatialPad.addEventListener("pointermove", (e) => {
        if (isDraggingSpeaker) {
            handleSpatialPadInput(e);
        }
    });
    
    elSpatialPad.addEventListener("pointerup", (e) => {
        isDraggingSpeaker = false;
        elSpatialPad.releasePointerCapture(e.pointerId);
    });
    
    // 3D Spatial Reset Button
    if (elBtnResetSpatial) {
        elBtnResetSpatial.addEventListener("click", resetSpatialPosition);
    }
    
    // 5.1 Virtual Surround Toggle Button
    if (elBtnToggleSurround) {
        elBtnToggleSurround.addEventListener("click", () => {
            initAudioEngine();
            isSurroundMode = !isSurroundMode;
            elBtnToggleSurround.classList.toggle("active", isSurroundMode);
            
            // Turn off 8D mode if enabling surround mode
            if (isSurroundMode && is8DEnabled) {
                is8DEnabled = false;
                elToggle8d.checked = false;
            }
            
            updateAudioConnections();
            
            if (isSurroundMode) {
                elCoordinatesDisplay.textContent = "5.1 Surround";
            } else {
                updateCoordinatesBadge();
            }
            
            drawSpatialPad();
        });
    }
    
    // DJ Panel Toggle
    elToggleDj.addEventListener("change", () => {
        isDjEnabled = elToggleDj.checked;
        if (isDjEnabled) {
            initAudioEngine();
            elDjControlsContent.classList.remove("dj-content-disabled");
            elSliderDjSpeed.disabled = false;
            elBtnResetDjSpeed.disabled = false;
            elSliderDjFilter.disabled = false;
            elBtnSfxAirhorn.disabled = false;
            elBtnSfxSiren.disabled = false;
            elBtnSfxScratch.disabled = false;
            elBtnSfxLaser.disabled = false;
            
            // Set playback rate to whatever is currently selected
            if (audioElement) {
                audioElement.playbackRate = djSpeed;
            }
        } else {
            elDjControlsContent.classList.add("dj-content-disabled");
            elSliderDjSpeed.disabled = true;
            elBtnResetDjSpeed.disabled = true;
            elSliderDjFilter.disabled = true;
            elBtnSfxAirhorn.disabled = true;
            elBtnSfxSiren.disabled = true;
            elBtnSfxScratch.disabled = true;
            elBtnSfxLaser.disabled = true;
            
            // Reset playback speed to 1.0
            if (audioElement) {
                audioElement.playbackRate = 1.0;
            }
            // Reset filter to bypass
            if (djFilterNode) {
                djFilterValue = 0;
                elSliderDjFilter.value = 0;
                updateDJFilter();
            }
        }
    });
    
    // DJ Speed Slider
    elSliderDjSpeed.addEventListener("input", () => {
        djSpeed = parseFloat(elSliderDjSpeed.value);
        elValDjSpeed.textContent = djSpeed.toFixed(2) + "x";
        if (audioElement) {
            audioElement.playbackRate = djSpeed;
        }
    });
    
    // DJ Reset Speed Button
    elBtnResetDjSpeed.addEventListener("click", () => {
        djSpeed = 1.0;
        elSliderDjSpeed.value = 1.0;
        elValDjSpeed.textContent = "1.00x";
        if (audioElement) {
            audioElement.playbackRate = 1.0;
        }
    });
    
    // DJ Filter Slider
    elSliderDjFilter.addEventListener("input", () => {
        initAudioEngine();
        djFilterValue = parseInt(elSliderDjFilter.value);
        updateDJFilter();
    });
    
    // DJ Sound Effects Trigger Buttons
    elBtnSfxAirhorn.addEventListener("click", playAirhornSFX);
    elBtnSfxSiren.addEventListener("click", playSirenSFX);
    elBtnSfxScratch.addEventListener("click", playScratchSFX);
    elBtnSfxLaser.addEventListener("click", playLaserSFX);
    
    // Equalizer sliders
    for (let i = 0; i < 5; i++) {
        document.getElementById(`eq-band-${i}`).addEventListener("input", applyEQSettings);
    }
    
    elPresetSelector.addEventListener("change", () => {
        applyPreset(elPresetSelector.value);
    });
    
    // Create Playlist Dialog Modal
    elBtnCreatePlaylist.addEventListener("click", () => {
        elModalContainer.classList.remove("modal-hidden");
        elPlaylistNameInput.value = "";
        elPlaylistNameInput.focus();
    });
    
    elModalCancel.addEventListener("click", () => {
        elModalContainer.classList.add("modal-hidden");
    });
    
    elModalSubmit.addEventListener("click", () => {
        const val = elPlaylistNameInput.value.trim();
        if (val) {
            createPlaylist(val);
            elModalContainer.classList.add("modal-hidden");
        }
    });
    
    elPlaylistNameInput.addEventListener("keypress", (e) => {
        if (e.key === "Enter") {
            elModalSubmit.click();
        }
    });
    
    // Upload Zones (Drag & Drop + File Uploads)
    elUploadZone.addEventListener("click", () => elFileInput.click());
    elFileInput.addEventListener("change", (e) => {
        handleFileUpload(e.target.files);
    });
    
    // Drag over styling
    elUploadZone.addEventListener("dragover", (e) => {
        e.preventDefault();
        elUploadZone.style.borderColor = "var(--secondary-neon)";
        elUploadZone.style.background = "rgba(255, 0, 127, 0.05)";
    });
    
    elUploadZone.addEventListener("dragleave", () => {
        elUploadZone.style.borderColor = "rgba(255, 255, 255, 0.1)";
        elUploadZone.style.background = "rgba(255, 255, 255, 0.01)";
    });
    
    elUploadZone.addEventListener("drop", (e) => {
        e.preventDefault();
        elUploadZone.style.borderColor = "rgba(255, 255, 255, 0.1)";
        elUploadZone.style.background = "rgba(255, 255, 255, 0.01)";
        if (e.dataTransfer.files) {
            handleFileUpload(e.dataTransfer.files);
        }
    });
    
    // Wake Lock button toggle
    if (elWakeLockBtn) {
        elWakeLockBtn.addEventListener("click", toggleWakeLock);
    }

    // Page Visibility change & AudioContext auto-resume safety
    document.addEventListener("visibilitychange", () => {
        if (isPlaying && audioCtx && audioCtx.state === "suspended") {
            audioCtx.resume().catch(() => {});
        }
        if (!document.hidden && is8DEnabled) {
            lastFrameTime = performance.now();
            requestAnimationFrame(processOrbitEffect);
        }
        if (!document.hidden && isWakeLockActive && wakeLock && wakeLock.released) {
            requestWakeLock();
        }
    });

    // Periodic heartbeat to ensure AudioContext stays alive during background play
    setInterval(() => {
        if (isPlaying && audioCtx && audioCtx.state === "suspended") {
            audioCtx.resume().catch(() => {});
        }
    }, 1000);

    // Resize handler
    window.addEventListener("resize", resizeCanvases);
}

// --- Mobile Tab Navigation ---
function setupMobileNavigation() {
    const tabs = document.querySelectorAll(".nav-tab");
    
    // Set default tab on mobile
    document.body.classList.add("tab-player");
    
    tabs.forEach(tab => {
        tab.addEventListener("click", () => {
            // Remove active from all tabs
            tabs.forEach(t => t.classList.remove("active"));
            // Add active to clicked tab
            tab.classList.add("active");
            
            // Switch body class
            const target = tab.getAttribute("data-target");
            document.body.classList.remove("tab-player", "tab-library", "tab-effects");
            document.body.classList.add(`tab-${target}`);
            
            // If switching to active views with canvases, redraw them
            if (target === "effects" || target === "player") {
                setTimeout(resizeCanvases, 100);
            }
        });
    });
}

// --- Application Entry Point ---
window.addEventListener("DOMContentLoaded", async () => {
    // Initial display config
    updateCoordinatesBadge();
    applyPreset("flat");
    
    // Setup event bounds
    setupEventListeners();
    setupMobileNavigation();
    
    // Draw initial empty spaces
    resizeCanvases();
    
    // Register Service Worker for offline support
    if ("serviceWorker" in navigator) {
        navigator.serviceWorker.register("sw.js")
            .then(() => console.log("Aether Service Worker Registered"))
            .catch(err => console.warn("Service worker registration failed:", err));
    }
    
    try {
        await initDB();
        await loadDataFromDB();
    } catch (e) {
        console.error("IndexedDB load failed. Local song storage is unavailable.", e);
        // Fallback to demo songs
        selectPlaylist("demo");
    }
});
