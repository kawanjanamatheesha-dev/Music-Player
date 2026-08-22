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
let mediaStreamDestination = null;
let outputAudioElement = null;

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

// --- 5 NEW 3D Spatial Audio Effects State ---
// 1. 3D Helix Altitude
let isHelixEnabled = false;
let helixSpeed = 1.2;
let helixHeight = 3.5;
let helixAngle = 0;

// 2. 3D Pendulum Swing
let isPendulumEnabled = false;
let pendulumSpeed = 0.8;
let pendulumWidth = 4.5;
let pendulumAngle = 0;

// 3. 3D Doppler Flyby Pass
let isDopplerEnabled = false;
let dopplerSpeed = 3;
let isDopplerFlying = false;

// 4. Hyper-Space 3D Echo Chamber
let isEchoEnabled = false;
let echoTime = 320; // ms
let echoWidth = 75; // %
let echoDelayNode = null;
let echoFeedbackGain = null;

// 5. 8D Spatial Wobble / Tremolo
let isWobbleEnabled = false;
let wobbleRate = 4.0; // Hz
let wobbleDepth = 60; // %
let wobbleGainNode = null;
let wobbleAngle = 0;

// --- DJ Panel State ---
let isDjEnabled = false;
let djFilterNode = null;
let djFilterValue = 0; // [-100, 100]
let djSpeed = 1.0;     // [0.5, 2.0]

// --- 5.1 & 7.1 Virtual Surround & Soundstage Customizer State ---
let isSurroundMode = false;
let surroundNodes = []; // Array of { name, panner, gain, delay, x, z }
let lfeFilterNode = null;
let lfeGainNode = null;
let lfePannerNode = null;

let surroundPreset = "5.1";    // '5.1', '7.1', 'studio', 'stadium', '360'
let surroundWidthScale = 1.0;  // 0.3 - 2.0
let surroundSubGain = 1.0;     // 0.0 - 2.0
let surroundRearDelay = 0.018; // seconds (0 - 0.040s)
let surroundCenterGain = 1.0;  // 0.0 - 1.5

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

// --- 11 NEW FEATURES STATE VARIABLES ---
let convolverNode = null;
let convolverGainNode = null;
let currentReverbRoom = "none";

let isVocalRemoverEnabled = false;
let vocalMode = "karaoke";
let vocalSplitterNode = null;
let vocalMergerNode = null;
let vocalInvertGainNode = null;
let vocalFilterNode = null;

let pitchShiftSemitones = 0;
let isGyroEnabled = false;
let currentVisMode = "bars"; // 'bars', 'wave', 'sphere', 'grid'
let sleepTimerId = null;
let sleepEndTime = null;
let parsedLyrics = [];
let activeLyricIndex = -1;

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
        const defaultPlaylist = { id: "my_library", name: "My Library" };
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
    if (savedPlaylistId && (savedPlaylistId === "demo" || playlists.some(p => p.id === savedPlaylistId))) {
        currentPlaylistId = savedPlaylistId;
    } else if (songs.length > 0) {
        currentPlaylistId = songs[0].playlistId || playlists[0].id;
    } else {
        currentPlaylistId = "demo";
    }

    renderPlaylists();
    selectPlaylist(currentPlaylistId);
}

// --- Save Playlist to DB ---
function savePlaylistToDB(playlist) {
    return new Promise((resolve) => {
        if (!db) return resolve();
        const transaction = db.transaction("playlists", "readwrite");
        const req = transaction.objectStore("playlists").put(playlist);
        req.onsuccess = () => resolve();
        req.onerror = () => resolve();
    });
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
        if (audioElement) updateLyricsSync(audioElement.currentTime);
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
    
    // --- Create Convolver Reverb Node ---
    convolverNode = audioCtx.createConvolver();
    convolverGainNode = audioCtx.createGain();
    convolverGainNode.gain.setValueAtTime(0, audioCtx.currentTime);

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
    
    // Create MediaStreamDestination bridge to force mobile OS background keep-alive
    try {
        if (audioCtx.createMediaStreamDestination) {
            mediaStreamDestination = audioCtx.createMediaStreamDestination();
            outputAudioElement = document.getElementById("background-audio-output");
            if (!outputAudioElement) {
                outputAudioElement = document.createElement("audio");
                outputAudioElement.id = "background-audio-output";
                outputAudioElement.setAttribute("playsinline", "");
                outputAudioElement.setAttribute("webkit-playsinline", "");
                outputAudioElement.style.display = "none";
                document.body.appendChild(outputAudioElement);
            }
            outputAudioElement.srcObject = mediaStreamDestination.stream;
            analyserNode.connect(mediaStreamDestination);
        } else {
            analyserNode.connect(audioCtx.destination);
        }
    } catch (e) {
        console.warn("MediaStream destination fallback:", e);
        analyserNode.connect(audioCtx.destination);
    }
    
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
    
    const time = audioCtx ? audioCtx.currentTime : 0;
    
    if (pannerNode.positionX) {
        pannerNode.positionX.setValueAtTime(x, time);
        pannerNode.positionY.setValueAtTime(y, time);
        pannerNode.positionZ.setValueAtTime(z, time);
    } else {
        pannerNode.setPosition(x, y, z);
    }

    // 360° Sub-bass Subwoofer Orbiting: Low-end bass rotates in 360° space in sync!
    if (lfePannerNode) {
        if (lfePannerNode.positionX) {
            lfePannerNode.positionX.setValueAtTime(x, time);
            lfePannerNode.positionY.setValueAtTime(y * 0.5 - 1.0, time);
            lfePannerNode.positionZ.setValueAtTime(z, time);
        } else {
            lfePannerNode.setPosition(x, y * 0.5 - 1.0, z);
        }
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

// --- Surround Soundstage Presets & Customizer ---
const SURROUND_PRESETS = {
    "5.1": [
        { name: "C", x: 0, y: 0, z: -2.0, delay: 0.0, gain: 0.85, isCenter: true },
        { name: "FL", x: -2.5, y: 0, z: -2.5, delay: 0.002, gain: 0.95 },
        { name: "FR", x: 2.5, y: 0, z: -2.5, delay: 0.0025, gain: 0.95 },
        { name: "SL", x: -4.5, y: 0, z: 2.2, delay: 0.018, gain: 0.85, isRear: true },
        { name: "SR", x: 4.5, y: 0, z: 2.2, delay: 0.019, gain: 0.85, isRear: true }
    ],
    "7.1": [
        { name: "C", x: 0, y: 0, z: -2.2, delay: 0.0, gain: 0.9, isCenter: true },
        { name: "FL", x: -2.8, y: 0, z: -2.8, delay: 0.001, gain: 0.95 },
        { name: "FR", x: 2.8, y: 0, z: -2.8, delay: 0.0015, gain: 0.95 },
        { name: "SL", x: -4.5, y: 0, z: 0.5, delay: 0.012, gain: 0.85 },
        { name: "SR", x: 4.5, y: 0, z: 0.5, delay: 0.013, gain: 0.85 },
        { name: "RL", x: -3.2, y: 0, z: 3.5, delay: 0.024, gain: 0.8, isRear: true },
        { name: "RR", x: 3.2, y: 0, z: 3.5, delay: 0.026, gain: 0.8, isRear: true }
    ],
    "studio": [
        { name: "L-Mon", x: -2.0, y: 0, z: -2.0, delay: 0.0, gain: 1.0 },
        { name: "R-Mon", x: 2.0, y: 0, z: -2.0, delay: 0.0, gain: 1.0 },
        { name: "M-Voice", x: 0, y: 0, z: -1.8, delay: 0.0, gain: 0.9, isCenter: true },
        { name: "S-Wide", x: -5.0, y: 0, z: 0, delay: 0.015, gain: 0.7, isRear: true },
        { name: "S-Wide2", x: 5.0, y: 0, z: 0, delay: 0.016, gain: 0.7, isRear: true }
    ],
    "stadium": [
        { name: "C-Stage", x: 0, y: 0, z: -3.5, delay: 0.0, gain: 1.0, isCenter: true },
        { name: "FL-Tower", x: -4.0, y: 1.5, z: -3.5, delay: 0.005, gain: 0.9 },
        { name: "FR-Tower", x: 4.0, y: 1.5, z: -3.5, delay: 0.005, gain: 0.9 },
        { name: "SL-Arena", x: -5.5, y: 0, z: 3.0, delay: 0.032, gain: 0.85, isRear: true },
        { name: "SR-Arena", x: 5.5, y: 0, z: 3.0, delay: 0.035, gain: 0.85, isRear: true }
    ],
    "360": [
        { name: "TOP", x: 0, y: 4.0, z: 0, delay: 0.008, gain: 0.8 },
        { name: "FRONT", x: 0, y: 0, z: -3.0, delay: 0.0, gain: 0.9, isCenter: true },
        { name: "BACK", x: 0, y: 0, z: 3.0, delay: 0.022, gain: 0.85, isRear: true },
        { name: "LEFT", x: -4.0, y: 0, z: 0, delay: 0.012, gain: 0.85 },
        { name: "RIGHT", x: 4.0, y: 0, z: 0, delay: 0.014, gain: 0.85 }
    ]
};

function initSurroundNodes() {
    if (!audioCtx) return;
    
    // Disconnect & clear old surround nodes if rebuilding
    surroundNodes.forEach(node => {
        try {
            node.panner.disconnect();
            node.gain.disconnect();
            node.delay.disconnect();
        } catch (e) {}
    });
    surroundNodes = [];
    
    const configs = SURROUND_PRESETS[surroundPreset] || SURROUND_PRESETS["5.1"];
    
    configs.forEach(cfg => {
        const panner = audioCtx.createPanner();
        panner.panningModel = 'HRTF';
        panner.distanceModel = 'inverse';
        panner.refDistance = 1;
        panner.maxDistance = 10000;
        panner.rolloffFactor = 1;
        panner.coneInnerAngle = 360;
        panner.coneOuterAngle = 360;
        
        const scaledX = cfg.x * surroundWidthScale;
        const scaledY = cfg.y * surroundWidthScale;
        const scaledZ = cfg.z * surroundWidthScale;
        
        const time = audioCtx.currentTime;
        if (panner.positionX) {
            panner.positionX.setValueAtTime(scaledX, time);
            panner.positionY.setValueAtTime(scaledY, time);
            panner.positionZ.setValueAtTime(scaledZ, time);
        } else {
            panner.setPosition(scaledX, scaledY, scaledZ);
        }
        
        let nodeGainVal = cfg.gain;
        if (cfg.isCenter) {
            nodeGainVal *= surroundCenterGain;
        }
        
        const gain = audioCtx.createGain();
        gain.gain.value = nodeGainVal;
        
        let nodeDelayVal = cfg.delay;
        if (cfg.isRear) {
            nodeDelayVal = surroundRearDelay;
        }
        
        const delay = audioCtx.createDelay(1.0);
        delay.delayTime.value = nodeDelayVal;
        
        delay.connect(gain);
        gain.connect(panner);
        
        surroundNodes.push({ name: cfg.name, panner, gain, delay, x: scaledX, z: scaledZ });
    });
    
    if (!lfeFilterNode) {
        lfeFilterNode = audioCtx.createBiquadFilter();
        lfeFilterNode.type = "lowpass";
        lfeFilterNode.frequency.value = 120;
        
        lfeGainNode = audioCtx.createGain();
        lfePannerNode = audioCtx.createPanner();
        lfePannerNode.panningModel = 'HRTF';
        lfePannerNode.setPosition(0, -1, 0);
        
        lfeFilterNode.connect(lfeGainNode);
        lfeGainNode.connect(lfePannerNode);
    }
    
    lfeGainNode.gain.setValueAtTime(surroundSubGain, audioCtx.currentTime);
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

// --- 5 NEW 3D SPATIAL AUDIO EFFECTS PROCESSORS ---

// 1. 3D Helix Altitude (Spiral Orbit + Elevation)
function processHelixEffect(time) {
    if (!isHelixEnabled) return;
    
    const nowTime = time || performance.now();
    const delta = Math.min((nowTime - lastFrameTime) / 1000, 0.1);
    lastFrameTime = nowTime;
    
    helixAngle += helixSpeed * Math.PI * 2 * delta;
    if (helixAngle > Math.PI * 2) helixAngle -= Math.PI * 2;
    
    const radiusMeters = 3.5;
    const x = Math.sin(helixAngle) * radiusMeters;
    const z = -Math.cos(helixAngle) * radiusMeters;
    const y = Math.sin(helixAngle * 0.5) * (helixHeight * 0.5);
    
    updateSpatialPosition(x, y, z);
    if (!document.hidden) drawSpatialPad();
    
    if (isHelixEnabled) {
        requestAnimationFrame(processHelixEffect);
    }
}

// 2. 3D Pendulum Swing (Front-Back & Left-Right Arc Oscillation)
function processPendulumEffect(time) {
    if (!isPendulumEnabled) return;
    
    const nowTime = time || performance.now();
    const delta = Math.min((nowTime - lastFrameTime) / 1000, 0.1);
    lastFrameTime = nowTime;
    
    pendulumAngle += pendulumSpeed * Math.PI * 2 * delta;
    if (pendulumAngle > Math.PI * 2) pendulumAngle -= Math.PI * 2;
    
    const x = Math.sin(pendulumAngle) * pendulumWidth;
    const z = Math.cos(pendulumAngle * 2) * (pendulumWidth * 0.4);
    const y = 0;
    
    updateSpatialPosition(x, y, z);
    if (!document.hidden) drawSpatialPad();
    
    if (isPendulumEnabled) {
        requestAnimationFrame(processPendulumEffect);
    }
}

// 3. 3D Doppler Flyby Pass (Velocity Proximity & Pitch Shift)
function triggerDopplerFlyby() {
    if (!pannerNode || isDopplerFlying) return;
    isDopplerFlying = true;
    
    const duration = 2.5 / (dopplerSpeed * 0.5);
    const startTime = performance.now();
    
    function stepFlyby(now) {
        const elapsed = (now - startTime) / 1000;
        const progress = Math.min(elapsed / duration, 1.0);
        
        // Swoop path: from far X: -12, Z: -10 to far X: 12, Z: 10
        const startX = -12, endX = 12;
        const startZ = -10, endZ = 10;
        
        const x = startX + (endX - startX) * progress;
        const z = startZ + (endZ - startZ) * progress;
        const y = Math.sin(progress * Math.PI) * 1.5;
        
        updateSpatialPosition(x, y, z);
        if (!document.hidden) drawSpatialPad();
        
        if (progress < 1.0 && isDopplerFlying) {
            requestAnimationFrame(stepFlyby);
        } else {
            isDopplerFlying = false;
            updateSpatialPosition(0, 0, 0);
            drawSpatialPad();
        }
    }
    
    requestAnimationFrame(stepFlyby);
}

// 4. Hyper-Space 3D Echo Chamber
function updateEchoChamber() {
    if (!audioCtx || !djFilterNode) return;
    
    if (!echoDelayNode) {
        echoDelayNode = audioCtx.createDelay(2.0);
        echoFeedbackGain = audioCtx.createGain();
        
        echoDelayNode.delayTime.value = echoTime / 1000;
        echoFeedbackGain.gain.value = (echoWidth / 100) * 0.6;
        
        // Connect 3D echo feedback loop
        djFilterNode.connect(echoDelayNode);
        echoDelayNode.connect(echoFeedbackGain);
        echoFeedbackGain.connect(echoDelayNode);
        echoFeedbackGain.connect(pannerNode || analyserNode);
    } else {
        echoDelayNode.delayTime.setValueAtTime(echoTime / 1000, audioCtx.currentTime);
        echoFeedbackGain.gain.setValueAtTime(isEchoEnabled ? (echoWidth / 100) * 0.6 : 0, audioCtx.currentTime);
    }
}

// 5. 8D Spatial Wobble / Tremolo
function processWobbleEffect(time) {
    if (!isWobbleEnabled) return;
    
    const nowTime = time || performance.now();
    const delta = Math.min((nowTime - lastFrameTime) / 1000, 0.1);
    lastFrameTime = nowTime;
    
    wobbleAngle += wobbleRate * Math.PI * 2 * delta;
    if (wobbleAngle > Math.PI * 2) wobbleAngle -= Math.PI * 2;
    
    const depthRatio = wobbleDepth / 100;
    const wobbleRadius = 2.0 + Math.sin(wobbleAngle) * (3.0 * depthRatio);
    const x = Math.sin(wobbleAngle * 0.5) * wobbleRadius;
    const z = -Math.cos(wobbleAngle * 0.5) * wobbleRadius;
    
    updateSpatialPosition(x, 0, z);
    if (!document.hidden) drawSpatialPad();
    
    if (isWobbleEnabled) {
        requestAnimationFrame(processWobbleEffect);
    }
}
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
        if (outputAudioElement) {
            outputAudioElement.play().catch(e => console.log("Output audio play:", e));
        }
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
        if (outputAudioElement) outputAudioElement.pause();
        isPlaying = false;
        document.body.classList.remove("is-playing");
    } else {
        audioElement.play();
        if (outputAudioElement) {
            outputAudioElement.play().catch(e => console.log("Output audio play:", e));
        }
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
    if (!files || files.length === 0) return;
    
    // Auto-create/switch to custom playlist if on demo playlist
    if (currentPlaylistId === "demo") {
        let userPl = playlists.find(p => p.id !== "demo");
        if (!userPl) {
            userPl = { id: "my_library", name: "My Library" };
            playlists.push(userPl);
            await savePlaylistToDB(userPl);
        }
        currentPlaylistId = userPl.id;
        localStorage.setItem("aether_current_playlist_id", currentPlaylistId);
        renderPlaylists();
    }
    
    for (let i = 0; i < files.length; i++) {
        const file = files[i];
        const isAudioOrVideo = file.type.startsWith("audio/") || file.type.startsWith("video/") || /\.(mp3|m4a|wav|aac|flac|ogg|mp4|webm|mkv)$/i.test(file.name);
        if (!isAudioOrVideo) continue;
        
        // Setup clean metadata
        let title = file.name.replace(/\.[^/.]+$/, ""); // Strip extension
        let artist = "Local File";
        
        // Rough parse of "Artist - Title" formats
        if (title.includes(" - ")) {
            const parts = title.split(" - ");
            artist = parts[0].trim();
            title = parts.slice(1).join(" - ").trim();
        }
        
        // Load file info to find duration
        const durStr = await getAudioDurationString(file);
        
        let audioData = null;
        try {
            audioData = await file.arrayBuffer();
        } catch (e) {
            console.warn("ArrayBuffer read error:", e);
        }
        
        const newSong = {
            id: "song_" + Date.now() + "_" + Math.random().toString(36).substr(2, 9),
            title: title,
            artist: artist,
            duration: durStr,
            playlistId: currentPlaylistId,
            audioData: audioData, // Raw ArrayBuffer - 100% reliable in IndexedDB across reloads!
            mimeType: file.type || "audio/mpeg"
        };
        
        songs.push(newSong);
        try {
            await saveSongToDB(newSong);
            showToast(`"${newSong.title}" saved permanently!`);
        } catch (dbErr) {
            console.error("IndexedDB Save Song error:", dbErr);
        }
    }
    
    localStorage.setItem("aether_current_playlist_id", currentPlaylistId);
    selectPlaylist(currentPlaylistId);
}

// --- Toast Notification Helper ---
function showToast(message, type = "info") {
    let toastContainer = document.getElementById("toast-container");
    if (!toastContainer) {
        toastContainer = document.createElement("div");
        toastContainer.id = "toast-container";
        toastContainer.style.cssText = "position: fixed; bottom: 80px; right: 20px; z-index: 9999; display: flex; flex-direction: column; gap: 8px; pointer-events: none;";
        document.body.appendChild(toastContainer);
    }
    
    const toast = document.createElement("div");
    toast.className = `toast toast-${type}`;
    toast.style.cssText = "background: rgba(10, 25, 20, 0.95); border: 1px solid #00ffaa; color: #ffffff; padding: 10px 16px; border-radius: 10px; font-size: 12px; font-weight: 600; box-shadow: 0 4px 20px rgba(0, 255, 170, 0.4); backdrop-filter: blur(10px); transition: all 0.3s ease; transform: translateY(20px); opacity: 0; pointer-events: auto;";
    toast.innerHTML = `<i class="fa-solid fa-circle-check" style="color: #00ffaa; margin-right: 8px;"></i> ${message}`;
    
    toastContainer.appendChild(toast);
    
    setTimeout(() => {
        toast.style.transform = "translateY(0)";
        toast.style.opacity = "1";
    }, 10);
    
    setTimeout(() => {
        toast.style.transform = "translateY(-10px)";
        toast.style.opacity = "0";
        setTimeout(() => toast.remove(), 300);
    }, 4000);
}

function getAudioDurationString(file) {
    return new Promise((resolve) => {
        let timer = null;
        const audio = document.createElement("audio");
        const url = URL.createObjectURL(file);
        audio.src = url;
        
        const cleanup = (dur) => {
            if (timer) clearTimeout(timer);
            try { URL.revokeObjectURL(url); } catch (e) {}
            resolve(dur);
        };
        
        audio.addEventListener("loadedmetadata", () => {
            cleanup(formatTime(audio.duration));
        });
        
        audio.addEventListener("error", () => {
            cleanup("0:00");
        });
        
        timer = setTimeout(() => {
            cleanup("0:00");
        }, 1500);
    });
}

// --- Enhanced Multi-Mode Canvas Visualizer Animation ---
let sphereRotationAngle = 0;
let gridZOffset = 0;

function drawVisualizer() {
    if (!analyserNode) return;
    
    requestAnimationFrame(drawVisualizer);
    
    analyserNode.getByteFrequencyData(visualizerDataArray);
    
    const width = elVisualizerCanvas.width / window.devicePixelRatio;
    const height = elVisualizerCanvas.height / window.devicePixelRatio;
    
    visualizerCtx.clearRect(0, 0, width, height);
    const centerX = width / 2;
    const centerY = height / 2;
    const dataLen = visualizerDataArray.length;

    // Calculate sub-bass energy for dynamic pulsing
    let bassSum = 0;
    for (let i = 0; i < 8; i++) bassSum += visualizerDataArray[i];
    const bassEnergy = bassSum / 8 / 255;

    if (currentVisMode === "wave") {
        // --- MODE 2: Oscilloscope Waveform ---
        const timeData = new Uint8Array(analyserNode.fftSize);
        analyserNode.getByteTimeDomainData(timeData);

        visualizerCtx.lineWidth = 3;
        visualizerCtx.strokeStyle = "#00ffaa";
        visualizerCtx.shadowBlur = 12;
        visualizerCtx.shadowColor = "rgba(0, 255, 170, 0.8)";
        visualizerCtx.beginPath();

        const sliceWidth = width / timeData.length;
        let x = 0;
        for (let i = 0; i < timeData.length; i++) {
            const v = timeData[i] / 128.0;
            const y = (v * height) / 2;
            if (i === 0) visualizerCtx.moveTo(x, y);
            else visualizerCtx.lineTo(x, y);
            x += sliceWidth;
        }
        visualizerCtx.stroke();
        visualizerCtx.shadowBlur = 0;

    } else if (currentVisMode === "sphere") {
        // --- MODE 3: 3D Cyber Particle Sphere ---
        sphereRotationAngle += 0.015;
        const numParticles = 64;
        const baseRadius = 90 + bassEnergy * 35;

        for (let i = 0; i < numParticles; i++) {
            const phi = Math.acos(-1 + (2 * i) / numParticles);
            const theta = Math.sqrt(numParticles * Math.PI) * phi + sphereRotationAngle;

            const binIndex = Math.floor((i / numParticles) * (dataLen * 0.6));
            const amp = (visualizerDataArray[binIndex] / 255) * 30;
            const r = baseRadius + amp;

            // 3D coordinates
            const x3d = r * Math.sin(phi) * Math.cos(theta);
            const y3d = r * Math.sin(phi) * Math.sin(theta);
            const z3d = r * Math.cos(phi);

            // 3D projection
            const fov = 300;
            const scale = fov / (fov + z3d + 150);
            const px = centerX + x3d * scale;
            const py = centerY + y3d * scale;
            const size = Math.max(1.5, 4 * scale + amp * 0.1);

            visualizerCtx.fillStyle = i % 2 === 0 ? "#00ffaa" : "#ffffff";
            visualizerCtx.shadowBlur = 8 * scale;
            visualizerCtx.shadowColor = i % 2 === 0 ? "rgba(0, 255, 170, 0.9)" : "rgba(255, 255, 255, 0.8)";

            visualizerCtx.beginPath();
            visualizerCtx.arc(px, py, size, 0, Math.PI * 2);
            visualizerCtx.fill();
        }
        visualizerCtx.shadowBlur = 0;

    } else if (currentVisMode === "grid") {
        // --- MODE 4: 3D Particle Wave Grid ---
        gridZOffset += 0.05;
        const cols = 20;
        const rows = 12;
        const gridWidth = width * 0.9;
        const gridHeight = height * 0.6;

        visualizerCtx.strokeStyle = "rgba(0, 255, 170, 0.4)";
        visualizerCtx.lineWidth = 1.5;

        for (let r = 0; r < rows; r++) {
            const rowProgress = (r + (gridZOffset % 1)) / rows;
            const y3d = centerY + (rowProgress - 0.5) * gridHeight;
            const scale = 0.5 + rowProgress * 0.6;

            visualizerCtx.beginPath();
            for (let c = 0; c < cols; c++) {
                const binIndex = Math.floor((c / cols) * (dataLen * 0.7));
                const val = visualizerDataArray[binIndex];
                const elevation = (val / 255) * 35 * scale;

                const x3d = centerX + (c / (cols - 1) - 0.5) * gridWidth * scale;
                const finalY = y3d - elevation;

                if (c === 0) visualizerCtx.moveTo(x3d, finalY);
                else visualizerCtx.lineTo(x3d, finalY);
            }
            visualizerCtx.stroke();
        }
    } else {
        // --- MODE 1: Standard Concentric 2D Frequency Ring ---
        const innerRadius = 110;
        const barCount = 60;

        for (let i = 0; i < barCount; i++) {
            const binIndex = Math.floor((i / barCount) * (dataLen * 0.7));
            const val = visualizerDataArray[binIndex];
            const barLength = (val / 255) * 45;
            const angle = (i / barCount) * Math.PI * 2;

            const x1 = centerX + Math.sin(angle) * innerRadius;
            const y1 = centerY + Math.cos(angle) * innerRadius;
            const x2 = centerX + Math.sin(angle) * (innerRadius + barLength);
            const y2 = centerY + Math.cos(angle) * (innerRadius + barLength);

            const grad = visualizerCtx.createLinearGradient(x1, y1, x2, y2);
            if (i % 2 === 0) {
                grad.addColorStop(0, "rgba(0, 255, 170, 0.4)");
                grad.addColorStop(1, "rgba(0, 255, 170, 0.95)");
            } else {
                grad.addColorStop(0, "rgba(160, 160, 160, 0.3)");
                grad.addColorStop(1, "rgba(255, 255, 255, 0.9)");
            }

            visualizerCtx.strokeStyle = grad;
            visualizerCtx.lineWidth = 3.5;
            visualizerCtx.lineCap = "round";

            visualizerCtx.shadowBlur = 8;
            visualizerCtx.shadowColor = "rgba(0, 255, 170, 0.5)";

            visualizerCtx.beginPath();
            visualizerCtx.moveTo(x1, y1);
            visualizerCtx.lineTo(x2, y2);
            visualizerCtx.stroke();
        }
        visualizerCtx.shadowBlur = 0;
    }
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
    elSpatialPadCtx.fillStyle = "#ffffff";
    elSpatialPadCtx.shadowBlur = 15;
    elSpatialPadCtx.shadowColor = "rgba(255, 255, 255, 0.8)";
    
    elSpatialPadCtx.beginPath();
    elSpatialPadCtx.arc(centerX, centerY, 8, 0, Math.PI * 2);
    elSpatialPadCtx.fill();
    
    // Draw Listener Headphone cups (visual cue)
    elSpatialPadCtx.fillStyle = "#ffffff";
    elSpatialPadCtx.fillRect(centerX - 12, centerY - 4, 3, 8); // left cup
    elSpatialPadCtx.fillRect(centerX + 9, centerY - 4, 3, 8);  // right cup

    // Draw Head Orientation FOV Fan Cone when Head Tracking is Active
    if (isHeadTrackingEnabled) {
        const headRad = (currentHeadAngle * Math.PI) / 180 - Math.PI / 2;
        const fanAngle = Math.PI / 5;
        
        elSpatialPadCtx.fillStyle = "rgba(0, 255, 170, 0.25)";
        elSpatialPadCtx.strokeStyle = "rgba(0, 255, 170, 0.8)";
        elSpatialPadCtx.lineWidth = 1.5;
        
        elSpatialPadCtx.beginPath();
        elSpatialPadCtx.moveTo(centerX, centerY);
        elSpatialPadCtx.arc(centerX, centerY, 55, headRad - fanAngle, headRad + fanAngle);
        elSpatialPadCtx.closePath();
        elSpatialPadCtx.fill();
        elSpatialPadCtx.stroke();
    }
    
    // -------------------------------------------------------------
    // DRAWING 3D EFFECTS TRAJECTORIES AND SPEAKERS
    // -------------------------------------------------------------
    
    // 1. SURROUND SOUNDSTAGE MODE
    if (isSurroundMode) {
        const spkConfigs = (surroundNodes.length > 0) 
            ? surroundNodes 
            : (SURROUND_PRESETS[surroundPreset] || SURROUND_PRESETS["5.1"]);
        
        elSpatialPadCtx.shadowBlur = 0;
        elSpatialPadCtx.fillStyle = "#ffffff";
        elSpatialPadCtx.font = "9px 'Outfit', sans-serif";
        elSpatialPadCtx.textAlign = "left";
        const modeTitle = `SURROUND: ${surroundPreset.toUpperCase()} (${spkConfigs.length} CHANNELS)`;
        elSpatialPadCtx.fillText(modeTitle, 12, height - 12);
        
        spkConfigs.forEach(spk => {
            const rawX = spk.x * (surroundNodes.length > 0 ? 1 : surroundWidthScale);
            const rawZ = spk.z * (surroundNodes.length > 0 ? 1 : surroundWidthScale);
            
            const spkX = centerX + (rawX / maxCoord) * centerX;
            const spkZ = centerY + (rawZ / maxCoord) * centerY;
            
            // Draw glowing cyan projection line to center (user)
            elSpatialPadCtx.strokeStyle = "rgba(0, 243, 255, 0.65)";
            elSpatialPadCtx.lineWidth = 1.5;
            elSpatialPadCtx.shadowBlur = 8;
            elSpatialPadCtx.shadowColor = "rgba(0, 243, 255, 0.8)";
            elSpatialPadCtx.beginPath();
            elSpatialPadCtx.moveTo(centerX, centerY);
            elSpatialPadCtx.lineTo(spkX, spkZ);
            elSpatialPadCtx.stroke();
            
            // Draw purple/cyan speaker circles
            elSpatialPadCtx.fillStyle = "rgba(155, 81, 224, 0.35)";
            elSpatialPadCtx.strokeStyle = "#00f3ff";
            elSpatialPadCtx.lineWidth = 2;
            elSpatialPadCtx.shadowBlur = 12;
            elSpatialPadCtx.shadowColor = "rgba(155, 81, 224, 0.9)";
            
            elSpatialPadCtx.beginPath();
            elSpatialPadCtx.arc(spkX, spkZ, 10, 0, Math.PI * 2);
            elSpatialPadCtx.fill();
            elSpatialPadCtx.stroke();
            
            // Draw speaker label
            elSpatialPadCtx.shadowBlur = 0;
            elSpatialPadCtx.fillStyle = "#ffffff";
            elSpatialPadCtx.font = "9px 'Outfit', sans-serif";
            elSpatialPadCtx.textAlign = "center";
            elSpatialPadCtx.textBaseline = "middle";
            elSpatialPadCtx.fillText(spk.name, spkX, spkZ);
        });
    }
    
    // 2. 8D AUTO-ORBIT TRAJECTORY
    if (is8DEnabled) {
        const radiusMeters = 1.0 + (orbitRadius / 100) * 5.0;
        const orbitRadiusPx = (radiusMeters / maxCoord) * centerX;
        
        elSpatialPadCtx.strokeStyle = "rgba(255, 255, 255, 0.3)";
        elSpatialPadCtx.lineWidth = 1.5;
        elSpatialPadCtx.shadowBlur = 0;
        
        elSpatialPadCtx.beginPath();
        elSpatialPadCtx.arc(centerX, centerY, orbitRadiusPx, 0, Math.PI * 2);
        elSpatialPadCtx.stroke();
        
        elSpatialPadCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
        elSpatialPadCtx.font = "9px 'Outfit', sans-serif";
        elSpatialPadCtx.textAlign = "left";
        elSpatialPadCtx.fillText("MODE: 8D AUTO-ORBIT", 12, height - 12);
    }
    
    // 3. 3D HELIX ALTITUDE TRAJECTORY
    if (isHelixEnabled) {
        const helixRadiusPx = (3.5 / maxCoord) * centerX;
        
        elSpatialPadCtx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        elSpatialPadCtx.lineWidth = 1.5;
        elSpatialPadCtx.setLineDash([3, 3]);
        elSpatialPadCtx.beginPath();
        elSpatialPadCtx.arc(centerX, centerY, helixRadiusPx, 0, Math.PI * 2);
        elSpatialPadCtx.stroke();
        elSpatialPadCtx.setLineDash([]);
        
        elSpatialPadCtx.fillStyle = "#ffffff";
        elSpatialPadCtx.font = "9px 'Outfit', sans-serif";
        elSpatialPadCtx.textAlign = "left";
        const heightSign = currentY >= 0 ? "+" : "";
        elSpatialPadCtx.fillText(`MODE: 3D HELIX ALTITUDE (${heightSign}${currentY.toFixed(1)}m)`, 12, height - 12);
    }
    
    // 4. 3D PENDULUM SWING TRAJECTORY
    if (isPendulumEnabled) {
        elSpatialPadCtx.strokeStyle = "rgba(255, 255, 255, 0.35)";
        elSpatialPadCtx.lineWidth = 1.5;
        elSpatialPadCtx.beginPath();
        
        const arcPoints = 30;
        for (let i = 0; i <= arcPoints; i++) {
            const pAngle = (i / arcPoints) * Math.PI * 2;
            const px = Math.sin(pAngle) * pendulumWidth;
            const pz = Math.cos(pAngle * 2) * (pendulumWidth * 0.4);
            
            const ptX = centerX + (px / maxCoord) * centerX;
            const ptZ = centerY + (pz / maxCoord) * centerY;
            
            if (i === 0) elSpatialPadCtx.moveTo(ptX, ptZ);
            else elSpatialPadCtx.lineTo(ptX, ptZ);
        }
        elSpatialPadCtx.stroke();
        
        elSpatialPadCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
        elSpatialPadCtx.font = "9px 'Outfit', sans-serif";
        elSpatialPadCtx.textAlign = "left";
        elSpatialPadCtx.fillText("MODE: 3D PENDULUM SWING", 12, height - 12);
    }
    
    // 5. 3D DOPPLER FLYBY TRAJECTORY
    if (isDopplerFlying || isDopplerEnabled) {
        elSpatialPadCtx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        elSpatialPadCtx.lineWidth = 2;
        elSpatialPadCtx.beginPath();
        elSpatialPadCtx.moveTo(10, 10);
        elSpatialPadCtx.lineTo(width - 10, height - 10);
        elSpatialPadCtx.stroke();
        
        elSpatialPadCtx.fillStyle = "#ffffff";
        elSpatialPadCtx.font = "9px 'Outfit', sans-serif";
        elSpatialPadCtx.textAlign = "left";
        elSpatialPadCtx.fillText("MODE: 3D DOPPLER VELOCITY FLYBY", 12, height - 12);
    }
    
    // 6. 8D SPATIAL WOBBLE RIPPLES
    if (isWobbleEnabled) {
        const speakerX = centerX + (currentX / maxCoord) * centerX;
        const speakerZ = centerY + (currentZ / maxCoord) * centerY;
        
        const rippleR = 12 + (Math.sin(wobbleAngle) + 1) * 8;
        elSpatialPadCtx.strokeStyle = "rgba(255, 255, 255, 0.4)";
        elSpatialPadCtx.lineWidth = 1;
        elSpatialPadCtx.beginPath();
        elSpatialPadCtx.arc(speakerX, speakerZ, rippleR, 0, Math.PI * 2);
        elSpatialPadCtx.stroke();
        
        elSpatialPadCtx.fillStyle = "rgba(255, 255, 255, 0.8)";
        elSpatialPadCtx.font = "9px 'Outfit', sans-serif";
        elSpatialPadCtx.textAlign = "left";
        elSpatialPadCtx.fillText("MODE: 8D SPATIAL WOBBLE", 12, height - 12);
    }
    
    // DRAW PRIMARY ACTIVE SPEAKER NODE
    const speakerX = centerX + (currentX / maxCoord) * centerX;
    const speakerZ = centerY + (currentZ / maxCoord) * centerY;
    
    // Projection line to center user head
    elSpatialPadCtx.strokeStyle = "rgba(255, 255, 255, 0.25)";
    elSpatialPadCtx.lineWidth = 1;
    elSpatialPadCtx.beginPath();
    elSpatialPadCtx.moveTo(centerX, centerY);
    elSpatialPadCtx.lineTo(speakerX, speakerZ);
    elSpatialPadCtx.stroke();
    
    // Outer glowing ring
    elSpatialPadCtx.fillStyle = "#ffffff";
    elSpatialPadCtx.shadowBlur = 15;
    elSpatialPadCtx.shadowColor = "rgba(255, 255, 255, 0.9)";
    
    elSpatialPadCtx.beginPath();
    elSpatialPadCtx.arc(speakerX, speakerZ, 10, 0, Math.PI * 2);
    elSpatialPadCtx.fill();
    
    // Inner core
    elSpatialPadCtx.fillStyle = "#000000";
    elSpatialPadCtx.shadowBlur = 0;
    elSpatialPadCtx.beginPath();
    elSpatialPadCtx.arc(speakerX, speakerZ, 4, 0, Math.PI * 2);
    elSpatialPadCtx.fill();
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
    if (audioCtx && audioCtx.state === "suspended") {
        audioCtx.resume().catch(() => {});
    }
    
    const rect = elSpatialPad.getBoundingClientRect();
    const touchX = (e.clientX || (e.touches && e.touches[0].clientX)) - rect.left;
    const touchZ = (e.clientY || (e.touches && e.touches[0].clientY)) - rect.top;
    
    const width = rect.width;
    const height = rect.height;
    
    // Map pixel click to coordinates range [-6.0, 6.0]
    const maxCoord = 6.0;
    const x = Math.max(-maxCoord, Math.min(maxCoord, ((touchX / width) * 2 - 1) * maxCoord));
    const z = Math.max(-maxCoord, Math.min(maxCoord, ((touchZ / height) * 2 - 1) * maxCoord));
    
    // Disable 8D effect if user manually drags speaker
    if (is8DEnabled) {
        is8DEnabled = false;
        if (elToggle8d) elToggle8d.checked = false;
    }
    
    // Disable 5.1 Surround mode if user manually drags speaker
    if (isSurroundMode) {
        isSurroundMode = false;
        const toggleSurround = document.getElementById("toggle-surround");
        if (toggleSurround) toggleSurround.checked = false;
        if (elBtnToggleSurround) elBtnToggleSurround.classList.remove("active");
        updateAudioConnections();
    }
    
    // Switch spatial mode buttons to Manual 3D
    const spBtns = document.querySelectorAll(".spatial-mode-btn");
    spBtns.forEach(btn => {
        if (btn.getAttribute("data-spmode") === "manual") {
            btn.classList.add("active");
        } else {
            btn.classList.remove("active");
        }
    });

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
    
    // 5.1 & 7.1 Virtual Surround Toggle & Controls
    const elToggleSurroundCheck = document.getElementById("toggle-surround");
    const elSelectSurroundPreset = document.getElementById("select-surround-preset");
    const elSliderSurroundWidth = document.getElementById("slider-surround-width");
    const elSliderSurroundSub = document.getElementById("slider-surround-sub");
    const elSliderSurroundDelay = document.getElementById("slider-surround-delay");
    const elSliderSurroundCenter = document.getElementById("slider-surround-center");

    const elValSurroundWidth = document.getElementById("val-surround-width");
    const elValSurroundSub = document.getElementById("val-surround-sub");
    const elValSurroundDelay = document.getElementById("val-surround-delay");
    const elValSurroundCenter = document.getElementById("val-surround-center");

    if (elToggleSurroundCheck) {
        elToggleSurroundCheck.addEventListener("change", () => {
            initAudioEngine();
            isSurroundMode = elToggleSurroundCheck.checked;
            if (elBtnToggleSurround) elBtnToggleSurround.classList.toggle("active", isSurroundMode);
            
            if (isSurroundMode && is8DEnabled) {
                is8DEnabled = false;
                if (elToggle8d) elToggle8d.checked = false;
            }
            
            initSurroundNodes();
            updateAudioConnections();
            drawSpatialPad();
        });
    }

    if (elSelectSurroundPreset) {
        elSelectSurroundPreset.addEventListener("change", () => {
            surroundPreset = elSelectSurroundPreset.value;
            if (isSurroundMode) {
                initSurroundNodes();
                updateAudioConnections();
                drawSpatialPad();
            }
        });
    }

    if (elSliderSurroundWidth) {
        elSliderSurroundWidth.addEventListener("input", () => {
            const val = parseInt(elSliderSurroundWidth.value);
            surroundWidthScale = val / 100;
            if (elValSurroundWidth) elValSurroundWidth.textContent = val + "%";
            if (isSurroundMode) {
                initSurroundNodes();
                updateAudioConnections();
                drawSpatialPad();
            }
        });
    }

    if (elSliderSurroundSub) {
        elSliderSurroundSub.addEventListener("input", () => {
            const val = parseInt(elSliderSurroundSub.value);
            surroundSubGain = val / 100;
            if (elValSurroundSub) elValSurroundSub.textContent = val + "%";
            if (lfeGainNode) lfeGainNode.gain.setValueAtTime(surroundSubGain, audioCtx.currentTime);
        });
    }

    if (elSliderSurroundDelay) {
        elSliderSurroundDelay.addEventListener("input", () => {
            const val = parseInt(elSliderSurroundDelay.value);
            surroundRearDelay = val / 1000;
            if (elValSurroundDelay) elValSurroundDelay.textContent = val + "ms";
            if (isSurroundMode) {
                initSurroundNodes();
                updateAudioConnections();
            }
        });
    }

    if (elSliderSurroundCenter) {
        elSliderSurroundCenter.addEventListener("input", () => {
            const val = parseInt(elSliderSurroundCenter.value);
            surroundCenterGain = val / 100;
            if (elValSurroundCenter) elValSurroundCenter.textContent = val + "%";
            if (isSurroundMode) {
                initSurroundNodes();
                updateAudioConnections();
            }
        });
    }

    if (elBtnToggleSurround) {
        elBtnToggleSurround.addEventListener("click", () => {
            initAudioEngine();
            isSurroundMode = !isSurroundMode;
            if (elToggleSurroundCheck) elToggleSurroundCheck.checked = isSurroundMode;
            elBtnToggleSurround.classList.toggle("active", isSurroundMode);
            
            if (isSurroundMode && is8DEnabled) {
                is8DEnabled = false;
                if (elToggle8d) elToggle8d.checked = false;
            }
            
            initSurroundNodes();
            updateAudioConnections();
            
            if (isSurroundMode) {
                elCoordinatesDisplay.textContent = "Surround Active";
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
            
            const elSliderPitch = document.getElementById("slider-pitch-shift");
            const elBtnResetPitch = document.getElementById("btn-reset-pitch");
            const elToggleMic = document.getElementById("toggle-mic");
            const elSliderMic = document.getElementById("slider-mic-volume");
            if (elSliderPitch) elSliderPitch.disabled = false;
            if (elBtnResetPitch) elBtnResetPitch.disabled = false;
            if (elToggleMic) elToggleMic.disabled = false;
            if (elSliderMic) elSliderMic.disabled = false;
            
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
            
            const elSliderPitch = document.getElementById("slider-pitch-shift");
            const elBtnResetPitch = document.getElementById("btn-reset-pitch");
            const elToggleMic = document.getElementById("toggle-mic");
            const elSliderMic = document.getElementById("slider-mic-volume");
            if (elSliderPitch) elSliderPitch.disabled = true;
            if (elBtnResetPitch) elBtnResetPitch.disabled = true;
            if (elToggleMic) elToggleMic.disabled = true;
            if (elSliderMic) elSliderMic.disabled = true;
            
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
    
    // Setup sub-tab navigation for Effects panel
    setupFxTabs();
    setupSpatialModeButtons();

    // Bind 5 New 3D Spatial Effects
    // 1. 3D Helix Altitude
    const elToggleHelix = document.getElementById("toggle-helix");
    const elSliderHelixSpeed = document.getElementById("slider-helix-speed");
    const elSliderHelixHeight = document.getElementById("slider-helix-height");
    const elValHelixSpeed = document.getElementById("val-helix-speed");
    const elValHelixHeight = document.getElementById("val-helix-height");

    if (elToggleHelix) {
        elToggleHelix.addEventListener("change", () => {
            isHelixEnabled = elToggleHelix.checked;
            if (isHelixEnabled) {
                initAudioEngine();
                lastFrameTime = performance.now();
                requestAnimationFrame(processHelixEffect);
            }
        });
    }
    if (elSliderHelixSpeed) {
        elSliderHelixSpeed.addEventListener("input", () => {
            helixSpeed = parseFloat(elSliderHelixSpeed.value);
            if (elValHelixSpeed) elValHelixSpeed.textContent = helixSpeed.toFixed(1) + "Hz";
        });
    }
    if (elSliderHelixHeight) {
        elSliderHelixHeight.addEventListener("input", () => {
            helixHeight = parseFloat(elSliderHelixHeight.value);
            if (elValHelixHeight) elValHelixHeight.textContent = helixHeight.toFixed(1) + "m";
        });
    }

    // 2. 3D Pendulum Swing
    const elTogglePendulum = document.getElementById("toggle-pendulum");
    const elSliderPendulumSpeed = document.getElementById("slider-pendulum-speed");
    const elSliderPendulumWidth = document.getElementById("slider-pendulum-width");
    const elValPendulumSpeed = document.getElementById("val-pendulum-speed");
    const elValPendulumWidth = document.getElementById("val-pendulum-width");

    if (elTogglePendulum) {
        elTogglePendulum.addEventListener("change", () => {
            isPendulumEnabled = elTogglePendulum.checked;
            if (isPendulumEnabled) {
                initAudioEngine();
                lastFrameTime = performance.now();
                requestAnimationFrame(processPendulumEffect);
            }
        });
    }
    if (elSliderPendulumSpeed) {
        elSliderPendulumSpeed.addEventListener("input", () => {
            pendulumSpeed = parseFloat(elSliderPendulumSpeed.value);
            if (elValPendulumSpeed) elValPendulumSpeed.textContent = pendulumSpeed.toFixed(1) + "Hz";
        });
    }
    if (elSliderPendulumWidth) {
        elSliderPendulumWidth.addEventListener("input", () => {
            pendulumWidth = parseFloat(elSliderPendulumWidth.value);
            if (elValPendulumWidth) elValPendulumWidth.textContent = pendulumWidth.toFixed(1) + "m";
        });
    }

    // 3. 3D Doppler Flyby Pass
    const elToggleDoppler = document.getElementById("toggle-doppler");
    const elBtnTriggerDoppler = document.getElementById("btn-trigger-doppler");
    const elSliderDopplerSpeed = document.getElementById("slider-doppler-speed");
    const elValDopplerSpeed = document.getElementById("val-doppler-speed");

    if (elToggleDoppler) {
        elToggleDoppler.addEventListener("change", () => {
            isDopplerEnabled = elToggleDoppler.checked;
            if (isDopplerEnabled) {
                initAudioEngine();
                triggerDopplerFlyby();
            }
        });
    }
    if (elBtnTriggerDoppler) {
        elBtnTriggerDoppler.addEventListener("click", () => {
            initAudioEngine();
            triggerDopplerFlyby();
        });
    }
    if (elSliderDopplerSpeed) {
        elSliderDopplerSpeed.addEventListener("input", () => {
            dopplerSpeed = parseInt(elSliderDopplerSpeed.value);
            const labels = ["Slow", "Medium-Slow", "Medium", "Fast", "Ultra-Fast"];
            if (elValDopplerSpeed) elValDopplerSpeed.textContent = labels[dopplerSpeed - 1] || "Medium";
        });
    }

    // 4. Hyper-Space 3D Echo Chamber
    const elToggleEcho = document.getElementById("toggle-echo");
    const elSliderEchoTime = document.getElementById("slider-echo-time");
    const elSliderEchoWidth = document.getElementById("slider-echo-width");
    const elValEchoTime = document.getElementById("val-echo-time");
    const elValEchoWidth = document.getElementById("val-echo-width");

    if (elToggleEcho) {
        elToggleEcho.addEventListener("change", () => {
            isEchoEnabled = elToggleEcho.checked;
            initAudioEngine();
            updateEchoChamber();
        });
    }
    if (elSliderEchoTime) {
        elSliderEchoTime.addEventListener("input", () => {
            echoTime = parseInt(elSliderEchoTime.value);
            if (elValEchoTime) elValEchoTime.textContent = echoTime + "ms";
            updateEchoChamber();
        });
    }
    if (elSliderEchoWidth) {
        elSliderEchoWidth.addEventListener("input", () => {
            echoWidth = parseInt(elSliderEchoWidth.value);
            if (elValEchoWidth) elValEchoWidth.textContent = echoWidth + "%";
            updateEchoChamber();
        });
    }

    // 5. 8D Spatial Wobble / Tremolo
    const elToggleWobble = document.getElementById("toggle-wobble");
    const elSliderWobbleRate = document.getElementById("slider-wobble-rate");
    const elSliderWobbleDepth = document.getElementById("slider-wobble-depth");
    const elValWobbleRate = document.getElementById("val-wobble-rate");
    const elValWobbleDepth = document.getElementById("val-wobble-depth");

    if (elToggleWobble) {
        elToggleWobble.addEventListener("change", () => {
            isWobbleEnabled = elToggleWobble.checked;
            if (isWobbleEnabled) {
                initAudioEngine();
                lastFrameTime = performance.now();
                requestAnimationFrame(processWobbleEffect);
            }
        });
    }
    if (elSliderWobbleRate) {
        elSliderWobbleRate.addEventListener("input", () => {
            wobbleRate = parseFloat(elSliderWobbleRate.value);
            if (elValWobbleRate) elValWobbleRate.textContent = wobbleRate.toFixed(1) + "Hz";
        });
    }
    if (elSliderWobbleDepth) {
        elSliderWobbleDepth.addEventListener("input", () => {
            wobbleDepth = parseInt(elSliderWobbleDepth.value);
            if (elValWobbleDepth) elValWobbleDepth.textContent = wobbleDepth + "%";
        });
    }
    
    // Upload zone click & file input change handlers
    if (elUploadZone && elFileInput) {
        elUploadZone.addEventListener("click", () => {
            elFileInput.click();
        });
        elFileInput.addEventListener("change", (e) => {
            if (e.target.files && e.target.files.length > 0) {
                handleFileUpload(e.target.files);
                elFileInput.value = "";
            }
        });
    }

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

    // --- 11 NEW FEATURES EVENT LISTENERS ---
    
    // Convolver Room Reverb Selector
    const elSelectReverbRoom = document.getElementById("select-reverb-room");
    if (elSelectReverbRoom) {
        elSelectReverbRoom.addEventListener("change", () => {
            updateConvolverRoom(elSelectReverbRoom.value);
        });
    }

    // Hyper-Immersion Experience Button
    const elBtnToggleImmersion = document.getElementById("btn-toggle-immersion");
    if (elBtnToggleImmersion) {
        elBtnToggleImmersion.addEventListener("click", toggleHyperImmersion);
    }

    // Apple Spatial Audio Head Tracking Switch
    const elToggleHeadTracking = document.getElementById("toggle-head-tracking");
    if (elToggleHeadTracking) {
        elToggleHeadTracking.addEventListener("change", toggleHeadTracking);
    }

    // Gyroscope 3D Button
    const elBtnToggleGyro = document.getElementById("btn-toggle-gyro");
    if (elBtnToggleGyro) {
        elBtnToggleGyro.addEventListener("click", toggleGyro3D);
    }

    // Vocal Isolator & Karaoke Switch
    const elToggleVocalRemover = document.getElementById("toggle-vocal-remover");
    const elSelectVocalMode = document.getElementById("select-vocal-mode");
    
    if (elToggleVocalRemover) {
        elToggleVocalRemover.addEventListener("change", updateVocalIsolator);
    }
    if (elSelectVocalMode) {
        elSelectVocalMode.addEventListener("change", updateVocalIsolator);
    }

    // Pitch Shift Slider & Reset
    const elSliderPitch = document.getElementById("slider-pitch-shift");
    const elValPitch = document.getElementById("val-pitch-shift");
    const elBtnResetPitch = document.getElementById("btn-reset-pitch");

    if (elSliderPitch) {
        elSliderPitch.addEventListener("input", () => {
            pitchShiftSemitones = parseInt(elSliderPitch.value);
            if (elValPitch) elValPitch.textContent = (pitchShiftSemitones > 0 ? "+" : "") + pitchShiftSemitones + " semitones";
            if (audioElement) {
                audioElement.preservesPitch = false;
                const pitchRatio = Math.pow(2, pitchShiftSemitones / 12);
                audioElement.playbackRate = (isDjEnabled ? djSpeed : 1.0) * pitchRatio;
            }
        });
    }
    if (elBtnResetPitch) {
        elBtnResetPitch.addEventListener("click", () => {
            pitchShiftSemitones = 0;
            if (elSliderPitch) elSliderPitch.value = 0;
            if (elValPitch) elValPitch.textContent = "0 semitones";
            if (audioElement) {
                audioElement.playbackRate = isDjEnabled ? djSpeed : 1.0;
            }
        });
    }

    // Visualizer Mode Selector
    const visModeBtns = document.querySelectorAll(".vis-mode-btn");
    visModeBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            visModeBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            currentVisMode = btn.getAttribute("data-vismode");
        });
    });

    // 8D Audio Export Button & Modal
    const elBtnExport8d = document.getElementById("btn-export-8d");
    const elModalExport = document.getElementById("modal-export");
    const elBtnCancelExport = document.getElementById("btn-cancel-export");

    if (elBtnExport8d) {
        elBtnExport8d.addEventListener("click", export8DAudioTrack);
    }
    if (elBtnCancelExport && elModalExport) {
        elBtnCancelExport.addEventListener("click", () => {
            elModalExport.classList.add("modal-hidden");
        });
    }

    // Sleep Timer Buttons & Modal
    const elBtnSleepTimer = document.getElementById("btn-sleep-timer");
    const elModalSleep = document.getElementById("modal-sleep-timer");
    const elBtnCancelSleep = document.getElementById("btn-cancel-sleep");
    const elBtnCloseSleep = document.getElementById("btn-close-sleep-modal");
    const timerOptBtns = document.querySelectorAll(".timer-opt-btn");

    if (elBtnSleepTimer && elModalSleep) {
        elBtnSleepTimer.addEventListener("click", () => {
            elModalSleep.classList.remove("modal-hidden");
        });
    }
    timerOptBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const mins = parseInt(btn.getAttribute("data-minutes"));
            setSleepTimer(mins);
            if (elModalSleep) elModalSleep.classList.add("modal-hidden");
        });
    });
    if (elBtnCancelSleep && elModalSleep) {
        elBtnCancelSleep.addEventListener("click", () => {
            cancelSleepTimer();
            elModalSleep.classList.add("modal-hidden");
        });
    }
    if (elBtnCloseSleep && elModalSleep) {
        elBtnCloseSleep.addEventListener("click", () => {
            elModalSleep.classList.add("modal-hidden");
        });
    }

    // Synchronized Lyrics Buttons & Modal
    const elBtnToggleLyrics = document.getElementById("btn-toggle-lyrics");
    const elLyricsOverlay = document.getElementById("lyrics-overlay");
    const elModalLyrics = document.getElementById("modal-lyrics");
    const elBtnCancelLyrics = document.getElementById("btn-cancel-lyrics-modal");
    const elBtnApplyLyrics = document.getElementById("btn-apply-lyrics");
    const elTextareaLrc = document.getElementById("textarea-lrc");
    const elInputLrcFile = document.getElementById("input-lrc-file");

    if (elBtnToggleLyrics && elLyricsOverlay) {
        elBtnToggleLyrics.addEventListener("click", () => {
            if (parsedLyrics.length === 0 && elModalLyrics) {
                elModalLyrics.classList.remove("modal-hidden");
            } else {
                const isHidden = elLyricsOverlay.classList.toggle("lyrics-hidden");
                elBtnToggleLyrics.classList.toggle("active", !isHidden);
            }
        });
    }
    if (elBtnApplyLyrics && elTextareaLrc && elModalLyrics) {
        elBtnApplyLyrics.addEventListener("click", () => {
            if (elTextareaLrc.value.trim()) {
                parseLRC(elTextareaLrc.value);
                if (elLyricsOverlay) elLyricsOverlay.classList.remove("lyrics-hidden");
                if (elBtnToggleLyrics) elBtnToggleLyrics.classList.add("active");
            }
            elModalLyrics.classList.add("modal-hidden");
        });
    }
    if (elInputLrcFile && elTextareaLrc) {
        elInputLrcFile.addEventListener("change", (e) => {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    elTextareaLrc.value = evt.target.result;
                };
                reader.readAsText(e.target.files[0]);
            }
        });
    }
    if (elBtnCancelLyrics && elModalLyrics) {
        elBtnCancelLyrics.addEventListener("click", () => {
            elModalLyrics.classList.add("modal-hidden");
        });
    }

    // Sound Profile Sharing (Export / Import JSON)
    const elBtnExportPreset = document.getElementById("btn-export-preset");
    const elBtnImportPreset = document.getElementById("btn-import-preset");
    const elInputPresetFile = document.getElementById("input-preset-file");

    if (elBtnExportPreset) {
        elBtnExportPreset.addEventListener("click", exportSoundProfile);
    }
    if (elBtnImportPreset && elInputPresetFile) {
        elBtnImportPreset.addEventListener("click", () => {
            elInputPresetFile.click();
        });
        elInputPresetFile.addEventListener("change", (e) => {
            if (e.target.files && e.target.files[0]) {
                const reader = new FileReader();
                reader.onload = (evt) => {
                    try {
                        const jsonObj = JSON.parse(evt.target.result);
                        importSoundProfile(jsonObj);
                    } catch (err) {
                        alert("Invalid JSON profile file.");
                    }
                };
                reader.readAsText(e.target.files[0]);
            }
        });
    }

    // Stream Audio URL Modal
    const elBtnStreamUrl = document.getElementById("btn-stream-url");
    const elModalStream = document.getElementById("modal-stream-url");
    const elBtnCancelStream = document.getElementById("btn-cancel-stream");
    const elBtnSubmitStream = document.getElementById("btn-submit-stream");
    const elStreamUrlInput = document.getElementById("stream-url-input");
    const elStreamNameInput = document.getElementById("stream-name-input");

    if (elBtnStreamUrl && elModalStream) {
        elBtnStreamUrl.addEventListener("click", () => {
            elModalStream.classList.remove("modal-hidden");
        });
    }
    if (elBtnCancelStream && elModalStream) {
        elBtnCancelStream.addEventListener("click", () => {
            elModalStream.classList.add("modal-hidden");
        });
    }
    if (elBtnSubmitStream && elStreamUrlInput && elModalStream) {
        elBtnSubmitStream.addEventListener("click", () => {
            const url = elStreamUrlInput.value.trim();
            const title = (elStreamNameInput ? elStreamNameInput.value.trim() : "") || "Web Audio Stream";
            if (url) {
                const streamTrack = {
                    id: "stream_" + Date.now(),
                    title: title,
                    artist: "Live Radio / Stream",
                    url: url,
                    duration: "Live",
                    playlistId: currentPlaylistId
                };
                currentPlaylistSongs.push(streamTrack);
                renderSongList();
                playSongAtIndex(currentPlaylistSongs.length - 1);
                elStreamUrlInput.value = "";
                if (elStreamNameInput) elStreamNameInput.value = "";
                elModalStream.classList.add("modal-hidden");
            }
        });
    }

    // Resize handler
    window.addEventListener("resize", resizeCanvases);
}

// --- Vocal Isolator & Karaoke DSP Processor ---
function updateVocalIsolator() {
    const toggleCheck = document.getElementById("toggle-vocal-remover");
    const selectMode = document.getElementById("select-vocal-mode");
    
    if (toggleCheck) isVocalRemoverEnabled = toggleCheck.checked;
    if (selectMode) vocalMode = selectMode.value;
    
    if (isVocalRemoverEnabled) {
        initAudioEngine();
        // Apply EQ filter cut to center frequencies (300Hz - 3kHz) for Vocal Suppression
        if (eqFilters.length >= 4) {
            if (vocalMode === "karaoke") {
                eqFilters[1].gain.setValueAtTime(-12, audioCtx.currentTime); // Low-mid vocal cut
                eqFilters[2].gain.setValueAtTime(-18, audioCtx.currentTime); // Mid vocal cut
                eqFilters[3].gain.setValueAtTime(-10, audioCtx.currentTime); // High-mid vocal cut
            } else if (vocalMode === "vocal_solo") {
                eqFilters[0].gain.setValueAtTime(-14, audioCtx.currentTime); // Bass cut
                eqFilters[1].gain.setValueAtTime(+6, audioCtx.currentTime);  // Vocal boost
                eqFilters[2].gain.setValueAtTime(+12, audioCtx.currentTime); // Vocal boost
                eqFilters[3].gain.setValueAtTime(+4, audioCtx.currentTime);
                eqFilters[4].gain.setValueAtTime(-12, audioCtx.currentTime); // Treble cut
            }
        }
    } else {
        if (audioCtx) applyEQSettings();
    }
}

// --- 11 NEW FEATURES HELPER FUNCTIONS ---

function createImpulseResponse(ctx, duration, decay, reverse) {
    const sampleRate = ctx.sampleRate;
    const length = sampleRate * duration;
    const impulse = ctx.createBuffer(2, length, sampleRate);
    const left = impulse.getChannelData(0);
    const right = impulse.getChannelData(1);

    for (let i = 0; i < length; i++) {
        const n = reverse ? length - i : i;
        const env = Math.pow(1 - n / length, decay);
        left[i] = (Math.random() * 2 - 1) * env;
        right[i] = (Math.random() * 2 - 1) * env;
    }
    return impulse;
}

function updateConvolverRoom(roomType) {
    currentReverbRoom = roomType;
    if (!audioCtx) initAudioEngine();
    
    if (!convolverNode) {
        convolverNode = audioCtx.createConvolver();
        convolverGainNode = audioCtx.createGain();
    }
    
    if (roomType === "none") {
        convolverGainNode.gain.setValueAtTime(0, audioCtx.currentTime);
        return;
    }
    
    let duration = 2.0;
    let decay = 3.0;
    
    if (roomType === "cathedral") { duration = 3.5; decay = 2.2; }
    else if (roomType === "stadium") { duration = 2.8; decay = 2.8; }
    else if (roomType === "studio") { duration = 0.4; decay = 7.0; }
    else if (roomType === "car") { duration = 0.25; decay = 12.0; }
    else if (roomType === "concert") { duration = 2.0; decay = 3.5; }
    
    convolverNode.buffer = createImpulseResponse(audioCtx, duration, decay, false);
    convolverGainNode.gain.setValueAtTime(0.8, audioCtx.currentTime);
}

function handleDeviceOrientation(e) {
    if (!isGyroEnabled) return;
    const gamma = e.gamma || 0;
    const beta = e.beta || 0;
    
    const targetX = (gamma / 45) * 4.0;
    const targetZ = ((beta - 45) / 45) * 4.0;
    
    currentX = currentX + (Math.max(-5, Math.min(5, targetX)) - currentX) * 0.15;
    currentZ = currentZ + (Math.max(-5, Math.min(5, targetZ)) - currentZ) * 0.15;
    
    updateSpatialPosition(currentX, 0, currentZ);
    if (!document.hidden) drawSpatialPad();
}

function toggleGyro3D() {
    isGyroEnabled = !isGyroEnabled;
    const btn = document.getElementById("btn-toggle-gyro");
    if (btn) {
        if (isGyroEnabled) {
            btn.classList.add("active");
            if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
                DeviceOrientationEvent.requestPermission().then(state => {
                    if (state === "granted") window.addEventListener("deviceorientation", handleDeviceOrientation);
                }).catch(e => console.warn(e));
            } else {
                window.addEventListener("deviceorientation", handleDeviceOrientation);
            }
        } else {
            btn.classList.remove("active");
            window.removeEventListener("deviceorientation", handleDeviceOrientation);
        }
    }
// --- Apple Spatial Audio Head Tracking State & Handlers ---
let isHeadTrackingEnabled = false;
let currentHeadAngle = 0; // degrees [-180, 180]
let targetHeadAngle = 0;

function updateHeadOrientation(angleDegrees) {
    currentHeadAngle = angleDegrees;
    
    const badge = document.getElementById("head-angle-badge");
    if (badge) {
        badge.textContent = `Head: ${Math.round(angleDegrees)}°`;
    }
    
    if (!audioCtx || !audioCtx.listener) return;
    
    const rad = (angleDegrees * Math.PI) / 180;
    const forwardX = Math.sin(-rad);
    const forwardZ = -Math.cos(-rad);
    const time = audioCtx.currentTime;
    
    if (audioCtx.listener.forwardX) {
        audioCtx.listener.forwardX.setValueAtTime(forwardX, time);
        audioCtx.listener.forwardY.setValueAtTime(0, time);
        audioCtx.listener.forwardZ.setValueAtTime(forwardZ, time);
    } else {
        audioCtx.listener.setOrientation(forwardX, 0, forwardZ, 0, 1, 0);
    }
}

function handleHeadTrackingOrientation(e) {
    if (!isHeadTrackingEnabled) return;
    
    let yaw = e.alpha || e.gamma || 0;
    if (e.gamma !== undefined && Math.abs(e.gamma) <= 90) {
        yaw = e.gamma * 2.0; // scale up phone tilt to head yaw angle
    }
    
    targetHeadAngle = Math.max(-90, Math.min(90, yaw));
    currentHeadAngle += (targetHeadAngle - currentHeadAngle) * 0.2;
    updateHeadOrientation(currentHeadAngle);
    if (!document.hidden) drawSpatialPad();
}

function handleMouseMoveHeadTracking(e) {
    if (!isHeadTrackingEnabled) return;
    
    const normX = (e.clientX / window.innerWidth) * 2 - 1; // [-1, 1]
    targetHeadAngle = normX * 60; // [-60 deg to +60 deg]
    
    currentHeadAngle += (targetHeadAngle - currentHeadAngle) * 0.15;
    updateHeadOrientation(currentHeadAngle);
    if (!document.hidden) drawSpatialPad();
}

function toggleHeadTracking() {
    isHeadTrackingEnabled = !isHeadTrackingEnabled;
    const toggleBtn = document.getElementById("toggle-head-tracking");
    if (toggleBtn) toggleBtn.checked = isHeadTrackingEnabled;
    
    if (isHeadTrackingEnabled) {
        initAudioEngine();
        
        if (typeof DeviceOrientationEvent !== "undefined" && typeof DeviceOrientationEvent.requestPermission === "function") {
            DeviceOrientationEvent.requestPermission().then(state => {
                if (state === "granted") {
                    window.addEventListener("deviceorientation", handleHeadTrackingOrientation);
                }
            }).catch(e => console.warn(e));
        } else {
            window.addEventListener("deviceorientation", handleHeadTrackingOrientation);
        }
        
        window.addEventListener("mousemove", handleMouseMoveHeadTracking);
    } else {
        window.removeEventListener("deviceorientation", handleHeadTrackingOrientation);
        window.removeEventListener("mousemove", handleMouseMoveHeadTracking);
        updateHeadOrientation(0); // Reset head facing forward
    }
}
    parsedLyrics = [];
    activeLyricIndex = -1;
    const lines = lrcText.split("\n");
    const timeRegex = /\[(\d{2}):(\d{2})\.(\d{2,3})\](.*)/;
    
    lines.forEach(line => {
        const match = timeRegex.exec(line);
        if (match) {
            const min = parseInt(match[1]);
            const sec = parseInt(match[2]);
            const ms = parseInt(match[3]);
            const time = min * 60 + sec + (ms > 99 ? ms / 1000 : ms / 100);
            const text = match[4].trim();
            if (text) {
                parsedLyrics.push({ time, text });
            }
        }
    });
    
    parsedLyrics.sort((a, b) => a.time - b.time);
    renderLyricsUI();
}

function renderLyricsUI() {
    const container = document.getElementById("lyrics-scroll-container");
    if (!container) return;
    container.innerHTML = "";
    
    if (parsedLyrics.length === 0) {
        container.innerHTML = '<p class="lyric-line placeholder">No lyrics loaded. Click <i class="fa-solid fa-align-center"></i> to add LRC.</p>';
        return;
    }
    
    parsedLyrics.forEach((item, index) => {
        const p = document.createElement("p");
        p.className = `lyric-line line-${index}`;
        p.textContent = item.text;
        p.addEventListener("click", () => {
            if (audioElement) {
                audioElement.currentTime = item.time;
            }
        });
        container.appendChild(p);
    });
}

function updateLyricsSync(currentTime) {
    if (parsedLyrics.length === 0) return;
    
    let newIndex = -1;
    for (let i = 0; i < parsedLyrics.length; i++) {
        if (currentTime >= parsedLyrics[i].time) {
            newIndex = i;
        } else {
            break;
        }
    }
    
    if (newIndex !== activeLyricIndex) {
        activeLyricIndex = newIndex;
        const container = document.getElementById("lyrics-scroll-container");
        if (!container) return;
        
        const lines = container.querySelectorAll(".lyric-line");
        lines.forEach((l, idx) => {
            if (idx === activeLyricIndex) {
                l.classList.add("active");
                l.scrollIntoView({ behavior: "smooth", block: "center" });
            } else {
                l.classList.remove("active");
            }
        });
    }
}

function setSleepTimer(minutes) {
    cancelSleepTimer();
    if (minutes <= 0) return;
    
    sleepEndTime = Date.now() + minutes * 60 * 1000;
    updateSleepTimerBadge();
    
    sleepTimerId = setInterval(() => {
        const remainingMs = sleepEndTime - Date.now();
        if (remainingMs <= 0) {
            cancelSleepTimer();
            if (audioElement) {
                audioElement.pause();
                if (outputAudioElement) outputAudioElement.pause();
                isPlaying = false;
                updatePlayPauseUI();
            }
        } else {
            if (remainingMs <= 15000) {
                const fadeRatio = remainingMs / 15000;
                const masterVol = parseFloat(elVolumeSlider.value || 0.8);
                audioElement.volume = masterVol * fadeRatio;
            }
            updateSleepTimerBadge();
        }
    }, 1000);
}

function cancelSleepTimer() {
    if (sleepTimerId) {
        clearInterval(sleepTimerId);
        sleepTimerId = null;
    }
    sleepEndTime = null;
    if (audioElement && elVolumeSlider) {
        audioElement.volume = parseFloat(elVolumeSlider.value || 0.8);
    }
    const badge = document.getElementById("sleep-timer-badge");
    const btn = document.getElementById("btn-sleep-timer");
    if (badge) badge.style.display = "none";
    if (btn) btn.classList.remove("active");
}

function updateSleepTimerBadge() {
    const badge = document.getElementById("sleep-timer-badge");
    const btn = document.getElementById("btn-sleep-timer");
    if (!sleepEndTime) return;
    
    const remSec = Math.max(0, Math.ceil((sleepEndTime - Date.now()) / 1000));
    const mins = Math.floor(remSec / 60);
    const secs = remSec % 60;
    
    if (badge) {
        badge.style.display = "inline-block";
        badge.textContent = `${mins}:${secs < 10 ? "0" : ""}${secs}`;
    }
    if (btn) btn.classList.add("active");
}

function export8DAudioTrack() {
    if (currentSongIndex === -1) {
        alert("Please select and play a song first!");
        return;
    }
    const song = currentPlaylistSongs[currentSongIndex];
    const modal = document.getElementById("modal-export");
    const statusText = document.getElementById("export-modal-status");
    const progressFill = document.getElementById("export-progress-fill");
    const spinner = document.getElementById("export-spinner");
    const downloadBtn = document.getElementById("btn-download-export");
    
    if (modal) modal.classList.remove("modal-hidden");
    if (spinner) spinner.style.display = "block";
    if (downloadBtn) downloadBtn.style.display = "none";
    if (statusText) statusText.textContent = "Fetching audio data...";
    if (progressFill) progressFill.style.width = "10%";

    let audioPromise;
    if (song.audioBlob) {
        audioPromise = song.audioBlob.arrayBuffer();
    } else if (song.audioData) {
        audioPromise = Promise.resolve(song.audioData);
    } else {
        audioPromise = fetch(song.url).then(res => res.arrayBuffer());
    }

    audioPromise.then(arrayBuffer => {
        if (statusText) statusText.textContent = "Decoding audio buffer...";
        if (progressFill) progressFill.style.width = "30%";
        
        const tempCtx = new (window.AudioContext || window.webkitAudioContext)();
        return tempCtx.decodeAudioData(arrayBuffer).then(decodedBuffer => {
            tempCtx.close();
            
            if (statusText) statusText.textContent = "Rendering 8D Spatial Audio Offline...";
            if (progressFill) progressFill.style.width = "50%";

            const offlineCtx = new (window.OfflineAudioContext || window.webkitOfflineAudioContext)(
                2,
                decodedBuffer.sampleRate * decodedBuffer.duration,
                decodedBuffer.sampleRate
            );

            const source = offlineCtx.createBufferSource();
            source.buffer = decodedBuffer;

            const panner = offlineCtx.createPanner();
            panner.panningModel = 'HRTF';
            
            source.connect(panner);
            panner.connect(offlineCtx.destination);

            const duration = decodedBuffer.duration;
            const step = 0.05;
            const radiusMeters = 1.0 + (orbitRadius / 100) * 5.0;
            let angle = 0;

            for (let t = 0; t < duration; t += step) {
                angle += orbitSpeed * Math.PI * 2 * step;
                const x = Math.sin(angle) * radiusMeters;
                const z = -Math.cos(angle) * radiusMeters;
                if (panner.positionX) {
                    panner.positionX.setValueAtTime(x, t);
                    panner.positionZ.setValueAtTime(z, t);
                } else {
                    panner.setPosition(x, 0, z);
                }
            }

            source.start(0);

            return offlineCtx.startRendering().then(renderedBuffer => {
                if (statusText) statusText.textContent = "Encoding WAV File...";
                if (progressFill) progressFill.style.width = "90%";
                
                const wavBlob = audioBufferToWavBlob(renderedBuffer);
                const downloadUrl = URL.createObjectURL(wavBlob);
                
                if (progressFill) progressFill.style.width = "100%";
                if (spinner) spinner.style.display = "none";
                if (statusText) statusText.textContent = "8D Audio Rendering Complete!";
                
                if (downloadBtn) {
                    downloadBtn.href = downloadUrl;
                    downloadBtn.download = `${song.title.replace(/[^a-zA-Z0-9]/g, "_")}_8D_Spatial.wav`;
                    downloadBtn.style.display = "inline-block";
                }
            });
        });
    }).catch(err => {
        console.error("8D Audio Export error:", err);
        if (statusText) statusText.textContent = "Export Failed: " + err.message;
        if (spinner) spinner.style.display = "none";
    });
}

function audioBufferToWavBlob(buffer) {
    const numOfChan = buffer.numberOfChannels;
    const length = buffer.length * numOfChan * 2 + 44;
    const out = new DataView(new ArrayBuffer(length));
    let channels = [], sample, offset = 0, pos = 0;

    function setUint16(data) { out.setUint16(pos, data, true); pos += 2; }
    function setUint32(data) { out.setUint32(pos, data, true); pos += 4; }

    setUint32(0x46464952);
    setUint32(length - 8);
    setUint32(0x45564157);
    setUint32(0x20746d66);
    setUint32(16);
    setUint16(1);
    setUint16(numOfChan);
    setUint32(buffer.sampleRate);
    setUint32(buffer.sampleRate * 2 * numOfChan);
    setUint16(numOfChan * 2);
    setUint16(16);
    setUint32(0x61746164);
    setUint32(length - pos - 4);

    for (let i = 0; i < buffer.numberOfChannels; i++) channels.push(buffer.getChannelData(i));

    while (offset < buffer.length) {
        for (let i = 0; i < numOfChan; i++) {
            sample = Math.max(-1, Math.min(1, channels[i][offset]));
            sample = (0.5 + sample < 0 ? sample * 32768 : sample * 32767) | 0;
            out.setInt16(pos, sample, true);
            pos += 2;
        }
        offset++;
    }

    return new Blob([out.buffer], { type: "audio/wav" });
}

function exportSoundProfile() {
    const profile = {
        app: "Matheesha 3D Audio Player",
        version: "2.0",
        timestamp: new Date().toISOString(),
        eqGains: eqFilters.map(f => f.gain.value),
        spatial: {
            orbitSpeed,
            orbitRadius,
            reverbPercent,
            currentX,
            currentY,
            currentZ,
            reverbRoom: currentReverbRoom
        },
        surround: {
            preset: surroundPreset,
            widthScale: surroundWidthScale,
            subGain: surroundSubGain,
            centerGain: surroundCenterGain
        }
    };

    const jsonStr = JSON.stringify(profile, null, 2);
    const blob = new Blob([jsonStr], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `Matheesha_Sound_Profile_${Date.now()}.json`;
    a.click();
    URL.revokeObjectURL(url);
}

function importSoundProfile(jsonObj) {
    try {
        if (jsonObj.eqGains && Array.isArray(jsonObj.eqGains)) {
            jsonObj.eqGains.forEach((g, i) => {
                const slider = document.getElementById(`eq-band-${i}`);
                if (slider) slider.value = g;
            });
            if (audioCtx) applyEQSettings();
        }
        if (jsonObj.spatial) {
            if (jsonObj.spatial.orbitSpeed) {
                orbitSpeed = jsonObj.spatial.orbitSpeed;
                const sl = document.getElementById("slider-orbit-speed");
                if (sl) sl.value = orbitSpeed;
                const val = document.getElementById("val-orbit-speed");
                if (val) val.textContent = orbitSpeed + "Hz";
            }
            if (jsonObj.spatial.reverbRoom) {
                const sel = document.getElementById("select-reverb-room");
                if (sel) sel.value = jsonObj.spatial.reverbRoom;
                updateConvolverRoom(jsonObj.spatial.reverbRoom);
            }
        }
        alert("Sound profile loaded successfully!");
    } catch (e) {
        alert("Failed to import profile: Invalid JSON format.");
    }
}

// --- Hyper-Immersion Experience (Live Inside the Song) ---
let isHyperImmersionActive = false;

function toggleHyperImmersion() {
    isHyperImmersionActive = !isHyperImmersionActive;
    
    const btn = document.getElementById("btn-toggle-immersion");
    const toggle8d = document.getElementById("toggle-8d");
    const toggleSurround = document.getElementById("toggle-surround");
    const elSelectReverbRoom = document.getElementById("select-reverb-room");
    
    if (isHyperImmersionActive) {
        initAudioEngine();
        
        // 1. Enable smooth 8D Orbit (Speed: 0.8Hz for floating immersion)
        is8DEnabled = true;
        orbitSpeed = 0.8;
        orbitRadius = 85;
        reverbPercent = 40;
        if (toggle8d) toggle8d.checked = true;
        
        const sliderSpeed = document.getElementById("slider-orbit-speed");
        if (sliderSpeed) sliderSpeed.value = 0.8;
        const valSpeed = document.getElementById("val-orbit-speed");
        if (valSpeed) valSpeed.textContent = "0.8Hz";
        
        const sliderReverb = document.getElementById("slider-reverb");
        if (sliderReverb) sliderReverb.value = 40;
        const valReverb = document.getElementById("val-reverb");
        if (valReverb) valReverb.textContent = "40%";

        // 2. Enable 360° Spherical 5.1 Surround & Haas Width
        isSurroundMode = true;
        surroundPreset = "360";
        surroundWidthScale = 1.3;
        surroundSubGain = 1.4;
        surroundDelayMs = 24;
        surroundCenterGain = 1.1;
        if (toggleSurround) toggleSurround.checked = true;
        initSurroundNodes();
        
        // 3. Enable Concert / Cathedral Room Acoustics
        updateConvolverRoom("concert");
        if (elSelectReverbRoom) elSelectReverbRoom.value = "concert";
        
        // 4. Apply Warm Sub-bass Boost Equalizer Preset
        applyPreset("bassboost");
        
        // 5. Start Orbit Animation
        lastFrameTime = performance.now();
        requestAnimationFrame(processOrbitEffect);
        
        // 6. Switch Visualizer to 3D Cyber Sphere automatically
        const visSphereBtn = document.querySelector('.vis-mode-btn[data-vismode="sphere"]');
        if (visSphereBtn) visSphereBtn.click();
        
        // 7. Update UI button
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-headset"></i> Live Inside Song: ON';
            btn.style.background = "linear-gradient(135deg, #00ffaa, #00f3ff)";
            btn.style.color = "#000000";
            btn.style.boxShadow = "0 0 20px rgba(0, 255, 170, 0.8)";
        }
    } else {
        // Disable Hyper-Immersion
        is8DEnabled = false;
        isSurroundMode = false;
        if (toggle8d) toggle8d.checked = false;
        if (toggleSurround) toggleSurround.checked = false;
        
        updateConvolverRoom("none");
        if (elSelectReverbRoom) elSelectReverbRoom.value = "none";
        applyPreset("flat");
        updateSpatialPosition(0, 0, 0);
        
        if (btn) {
            btn.innerHTML = '<i class="fa-solid fa-headset"></i> Live Inside Song: OFF';
            btn.style.background = "linear-gradient(135deg, #00f3ff, #8000ff)";
            btn.style.color = "#ffffff";
            btn.style.boxShadow = "0 0 12px rgba(0, 243, 255, 0.4)";
        }
    }
}

// --- Effects Sub-Tab Navigation ---
function setupFxTabs() {
    const fxBtns = document.querySelectorAll(".fx-tab-btn");
    const fxContents = document.querySelectorAll(".fx-tab-content");
    
    fxBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            const targetTab = btn.getAttribute("data-fxtab");
            fxBtns.forEach(b => b.classList.remove("active"));
            fxContents.forEach(c => c.classList.remove("active"));
            
            btn.classList.add("active");
            const activeContent = document.getElementById(`fx-tab-${targetTab}`);
            if (activeContent) {
                activeContent.classList.add("active");
            }
        });
    });
}

// --- Quick 3D Spatial Mode Selector Buttons ---
function setupSpatialModeButtons() {
    const spBtns = document.querySelectorAll(".spatial-mode-btn");
    
    spBtns.forEach(btn => {
        btn.addEventListener("click", () => {
            initAudioEngine();
            const mode = btn.getAttribute("data-spmode");
            
            // Reset all modes
            is8DEnabled = false;
            isHelixEnabled = false;
            isPendulumEnabled = false;
            isDopplerEnabled = false;
            isSurroundMode = false;
            
            const toggle8d = document.getElementById("toggle-8d");
            const toggleHelix = document.getElementById("toggle-helix");
            const togglePendulum = document.getElementById("toggle-pendulum");
            const toggleDoppler = document.getElementById("toggle-doppler");
            const toggleSurround = document.getElementById("toggle-surround");
            
            if (toggle8d) toggle8d.checked = false;
            if (toggleHelix) toggleHelix.checked = false;
            if (togglePendulum) togglePendulum.checked = false;
            if (toggleDoppler) toggleDoppler.checked = false;
            if (toggleSurround) toggleSurround.checked = false;
            if (elBtnToggleSurround) elBtnToggleSurround.classList.remove("active");
            
            spBtns.forEach(b => b.classList.remove("active"));
            btn.classList.add("active");
            
            lastFrameTime = performance.now();
            
            if (mode === "8d") {
                is8DEnabled = true;
                if (toggle8d) toggle8d.checked = true;
                requestAnimationFrame(processOrbitEffect);
            } else if (mode === "helix") {
                isHelixEnabled = true;
                if (toggleHelix) toggleHelix.checked = true;
                requestAnimationFrame(processHelixEffect);
            } else if (mode === "pendulum") {
                isPendulumEnabled = true;
                if (togglePendulum) togglePendulum.checked = true;
                requestAnimationFrame(processPendulumEffect);
            } else if (mode === "doppler") {
                isDopplerEnabled = true;
                if (toggleDoppler) toggleDoppler.checked = true;
                triggerDopplerFlyby();
            } else if (mode === "surround") {
                isSurroundMode = true;
                if (toggleSurround) toggleSurround.checked = true;
                if (elBtnToggleSurround) elBtnToggleSurround.classList.add("active");
                initSurroundNodes();
            } else {
                // Manual 3D
                updateSpatialPosition(0, 0, 0);
            }
            
            updateAudioConnections();
            drawSpatialPad();
        });
    });
}

// --- Mobile Tab Navigation ---
function setupMobileNavigation() {
    const tabs = document.querySelectorAll(".nav-tab");
    
    function checkViewport() {
        if (window.innerWidth <= 1024) {
            if (!document.body.classList.contains("tab-player") &&
                !document.body.classList.contains("tab-library") &&
                !document.body.classList.contains("tab-effects")) {
                document.body.classList.add("tab-player");
            }
        } else {
            document.body.classList.remove("tab-player", "tab-library", "tab-effects");
        }
    }
    
    checkViewport();
    window.addEventListener("resize", checkViewport);
    
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
