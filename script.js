let db;
let songs = [];
let currentSong = -1;

const audio = document.getElementById("audio");
const playBtn = document.getElementById("play");
const prevBtn = document.getElementById("prev");
const nextBtn = document.getElementById("next");
const title = document.getElementById("title");
const artist = document.getElementById("artist");
const cover = document.getElementById("cover");
const progress = document.getElementById("progress");
const time = document.getElementById("time");
const volume = document.getElementById("volume");
const playlistEl = document.getElementById("playlist");

const drawer = document.getElementById("playlistDrawer");
const playlistBtn = document.getElementById("playlistBtn");
const closeDrawer = document.getElementById("closeDrawer");

const fileInput = document.getElementById("fileInput");
const artistInput = document.getElementById("artistInput");
const coverInput = document.getElementById("coverInput");
const addSongBtn = document.getElementById("addSongBtn");
const dropZone = document.getElementById("dropZone");

// Drawer toggle
playlistBtn.onclick = () => drawer.classList.toggle("open");
closeDrawer.onclick = () => drawer.classList.remove("open");

// IndexedDB setup
function initDB(){
  const request = indexedDB.open("musicDB",1);
  request.onupgradeneeded = (e)=>{
    db = e.target.result;
    if(!db.objectStoreNames.contains("songs")){
      const store = db.createObjectStore("songs",{keyPath:"id", autoIncrement:true});
      store.createIndex("title","title",{unique:false});
    }
  };
  request.onsuccess = (e)=>{
    db = e.target.result;
    loadSongsFromDB();
  };
  request.onerror = (e)=>console.error("DB error:",e.target.error);
}

// Load songs from DB
function loadSongsFromDB(){
  const tx = db.transaction("songs","readonly");
  const store = tx.objectStore("songs");
  const req = store.getAll();
  req.onsuccess = ()=>{
    songs = req.result;
    songs.forEach((s,i)=>addSongToPlaylist(s,i));
    const savedIndex = parseInt(localStorage.getItem("currentSong"));
    if(!isNaN(savedIndex) && songs[savedIndex]){
      loadSong(savedIndex);
      playSong();
    }
  };
}

// Add song to DB
function addSongToDB(file,artistName,imgFile){
  const reader = new FileReader();
  reader.onload = (e)=>{
    const audioBlob = new Blob([e.target.result], {type:file.type});
    let imgBlob = null;
    if(imgFile){
      const imgReader = new FileReader();
      imgReader.onload = (ev)=>{
        imgBlob = new Blob([ev.target.result],{type:imgFile.type});
        saveSong(audioBlob, artistName, imgBlob, file.name);
      };
      imgReader.readAsArrayBuffer(imgFile);
    } else {
      saveSong(audioBlob, artistName, null, file.name);
    }
  };
  reader.readAsArrayBuffer(file);
}

// Save song in IndexedDB
function saveSong(audioBlob, artistName, imgBlob, filename){
  const tx = db.transaction("songs","readwrite");
  const store = tx.objectStore("songs");
  const song = {
    title: filename.replace(/\.[^/.]+$/,""),
    artist: artistName || "Unknown",
    audio: audioBlob,
    cover: imgBlob || null
  };
  const req = store.add(song);
  req.onsuccess = ()=>{
    song.id = req.result;
    songs.push(song);
    addSongToPlaylist(song,songs.length-1);
    if(currentSong==-1) { loadSong(0); playSong(); }
  };
  req.onerror = (e)=>console.error("Add song error:",e.target.error);
}

// Load song
function loadSong(index){
  const song = songs[index];
  title.textContent = song.title;
  artist.textContent = song.artist;
  if(song.cover){
    const imgURL = URL.createObjectURL(song.cover);
    cover.src = imgURL;
  } else cover.src = "default-cover.png";

  const audioURL = URL.createObjectURL(song.audio);
  audio.src = audioURL;

  highlightPlaylist(index);
  currentSong = index;
  localStorage.setItem("currentSong", index);
}

// Play / Pause
function playSong(){ if(currentSong>=0){ audio.play(); playBtn.textContent="⏸"; } }
function pauseSong(){ audio.pause(); playBtn.textContent="▶️"; }
playBtn.addEventListener("click",()=>audio.paused?playSong():pauseSong());

// Next & Prev
nextBtn.addEventListener("click",()=>{
  if(songs.length==0) return;
  currentSong = (currentSong+1)%songs.length;
  loadSong(currentSong); playSong();
});
prevBtn.addEventListener("click",()=>{
  if(songs.length==0) return;
  currentSong = (currentSong-1+songs.length)%songs.length;
  loadSong(currentSong); playSong();
});

// Progress bar
audio.addEventListener("timeupdate",()=>{
  progress.value = (audio.currentTime/audio.duration)*100 || 0;
  time.textContent = formatTime(audio.currentTime)+" / "+formatTime(audio.duration);
});
progress.addEventListener("input",()=>audio.currentTime=(progress.value/100)*audio.duration);

// Volume control
volume.addEventListener("input",()=>audio.volume = volume.value);

audio.addEventListener("ended",()=>nextBtn.click());

function formatTime(sec){
  if(isNaN(sec)) return "00:00";
  let m=Math.floor(sec/60), s=Math.floor(sec%60);
  return (m<10?"0":"")+m+":"+(s<10?"0":"")+s;
}

// Add song to playlist UI
function addSongToPlaylist(song,index){
  const li=document.createElement("li");
  li.draggable = true;
  li.innerHTML = `<img src="${song.cover ? URL.createObjectURL(song.cover) : "default-cover.png"}" alt=""><div><strong>${song.title}</strong><br><small>${song.artist}</small></div>`;

  // Delete button
  const delBtn = document.createElement("button");
  delBtn.textContent = "🗑";
  delBtn.style.marginLeft = "auto";
  delBtn.addEventListener("click", (e)=>{
    e.stopPropagation();
    deleteSongFromDB(song.id);
  });
  li.appendChild(delBtn);

  // Click to play
  li.addEventListener("click",()=>{
    loadSong(index);
    playSong();
    drawer.classList.remove("open");
  });

  // Drag & Drop (optional, can be enhanced)
  li.addEventListener("dragstart",(e)=>e.dataTransfer.setData("text/plain",index));
  li.addEventListener("dragover",(e)=>e.preventDefault());
  li.addEventListener("drop",(e)=>{
    e.preventDefault();
    const fromIndex = e.dataTransfer.getData("text/plain");
    const toIndex = index;
    if(fromIndex==toIndex) return;
    [songs[fromIndex],songs[toIndex]]=[songs[toIndex],songs[fromIndex]];
    refreshPlaylist();
  });

  playlistEl.appendChild(li);
}

// Delete song from DB
function deleteSongFromDB(id){
  const tx = db.transaction("songs","readwrite");
  const store = tx.objectStore("songs");
  store.delete(id);
  songs = songs.filter(s=>s.id !== id);
  refreshPlaylist();
  if(songs.length>0) loadSong(0);
  else {
    audio.src=""; cover.src="default-cover.png"; title.textContent="No Song"; artist.textContent="Add Your Song"; currentSong=-1;
    localStorage.removeItem("currentSong");
  }
}

// Button click
addSongBtn.addEventListener("click",()=>{
  if(!fileInput.files[0]) return alert("Select audio file");
  addSongToDB(fileInput.files[0], artistInput.value, coverInput.files[0]);
  fileInput.value=""; artistInput.value=""; coverInput.value="";
});

// Drag & Drop zone
dropZone.addEventListener("dragover",(e)=>{ e.preventDefault(); dropZone.classList.add("dragover"); });
dropZone.addEventListener("dragleave",(e)=>{ dropZone.classList.remove("dragover"); });
dropZone.addEventListener("drop",(e)=>{
  e.preventDefault(); dropZone.classList.remove("dragover");
  const files=Array.from(e.dataTransfer.files).filter(f=>f.type.startsWith("audio"));
  files.forEach(f=>addSongToDB(f,"Unknown",null));
});

// Highlight playlist
function highlightPlaylist(index){
  const items=playlistEl.querySelectorAll("li");
  items.forEach((li,i)=>li.classList.toggle("active",i===index));
}

// Refresh playlist UI
function refreshPlaylist(){
  playlistEl.innerHTML="";
  songs.forEach((s,i)=>addSongToPlaylist(s,i));
}

// Init DB
initDB();

