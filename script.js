// Referências dos elementos do DOM
const selectFolderBtn = document.getElementById('select-folder-btn');
const fileInput = document.getElementById('file-input');
const musicList = document.getElementById('music-list');
const audioPlayer = document.getElementById('main-audio');

// Estado da aplicação
let playlist = [];
let currentIndex = 0;

// 1. Clicar no botão aciona o seletor invisível de ficheiros
if (selectFolderBtn && fileInput) {
  selectFolderBtn.addEventListener('click', () => {
    fileInput.click();
  });
}

// 2. Evento disparado quando o utilizador escolhe as músicas no telemóvel
if (fileInput) {
  fileInput.addEventListener('change', (event) => {
    const files = Array.from(event.target.files);
    
    // Filtra apenas ficheiros de áudio válidos
    const audioFiles = files.filter(file => file.type.startsWith('audio/') || file.name.endsWith('.mp3'));

    if (audioFiles.length === 0) {
      alert('Nenhum ficheiro de áudio válido foi selecionado.');
      return;
    }

    playlist = audioFiles;
    renderPlaylist(playlist);
    
    // Toca a primeira faixa da lista selecionada
    if (playlist.length > 0) {
      loadTrack(0);
    }
  });
}

// 3. Renderiza a lista de músicas no ecrã
function renderPlaylist(songs) {
  if (!musicList) return;
  musicList.innerHTML = '';

  songs.forEach((file, index) => {
    const li = document.createElement('li');
    li.className = 'music-item';
    li.dataset.index = index;

    li.innerHTML = `
      <div class="song-info">
        <span class="song-title">${file.name.replace(/\.[^/.]+$/, "")}</span>
        <span class="song-artist">Música Local</span>
      </div>
    `;

    li.addEventListener('click', () => {
      loadTrack(index);
      if (audioPlayer) audioPlayer.play();
    });

    musicList.appendChild(li);
    extractMetadata(file, li);
  });
}

// 4. Extrai título e artista usando a biblioteca jsmediatags
function extractMetadata(file, listItem) {
  if (typeof jsmediatags === 'undefined') return;

  jsmediatags.read(file, {
    onSuccess: function(tag) {
      const tags = tag.tags;
      const title = tags.title || file.name.replace(/\.[^/.]+$/, "");
      const artist = tags.artist || "Artista Desconhecido";

      const titleEl = listItem.querySelector('.song-title');
      const artistEl = listItem.querySelector('.song-artist');

      if (titleEl) titleEl.textContent = title;
      if (artistEl) artistEl.textContent = artist;
    },
    onError: function(error) {
      console.log("Metadados não encontrados para:", file.name);
    }
  });
}

// 5. Carrega a faixa escolhida no player de áudio
function loadTrack(index) {
  if (index < 0 || index >= playlist.length || !audioPlayer) return;

  currentIndex = index;
  const file = playlist[currentIndex];

  const objectURL = URL.createObjectURL(file);
  audioPlayer.src = objectURL;

  // Destaque visual do item em execução
  if (musicList) {
    const items = musicList.querySelectorAll('.music-item');
    items.forEach((item, i) => {
      if (i === index) {
        item.classList.add('active');
      } else {
        item.classList.remove('active');
      }
    });
  }
}

// 6. Avança automaticamente para a próxima música ao finalizar a atual
if (audioPlayer) {
  audioPlayer.addEventListener('ended', () => {
    if (currentIndex + 1 < playlist.length) {
      loadTrack(currentIndex + 1);
      audioPlayer.play();
    }
  });
}