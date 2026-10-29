let db = null;
let bancoDeMusicas = [];
let playlists = JSON.parse(localStorage.getItem('tikko_playlists')) || [];
let playlistAtivaIndex = null;
let musicaAtualIndex = null;
let filaAtual = [];
let musicaSelecionadaIndex = null;
let abaAtiva = 'playlists';

const audio = document.getElementById('main-audio');
const CAPA_PADRAO = "data:image/svg+xml;utf8,<svg xmlns='http://www.w3.org/2000/svg' width='300' height='300'><rect width='100%' height='100%' fill='%23222222'/><text x='50%' y='55%' font-size='90' fill='%231db954' text-anchor='middle' dominant-baseline='middle'>🎵</text></svg>";

// BANCO DE DADOS INDEXEDDB
function abrirBancoDeDados() {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open("TikkoPlayerDB", 1);
    request.onupgradeneeded = (e) => {
      db = e.target.result;
      if (!db.objectStoreNames.contains("musicas")) {
        db.createObjectStore("musicas", { keyPath: "id" });
      }
    };
    request.onsuccess = (e) => { db = e.target.result; resolve(db); };
    request.onerror = (e) => reject("Erro no banco de dados");
  });
}

function limparEGravarNoDB(novasMusicas) {
  return new Promise((resolve) => {
    const tx = db.transaction("musicas", "readwrite");
    const store = tx.objectStore("musicas");
    store.clear().onsuccess = () => {
      novasMusicas.forEach(m => store.put(m));
    };
    tx.oncomplete = () => resolve();
  });
}

function carregarMusicasDoDB() {
  return new Promise((resolve) => {
    const tx = db.transaction("musicas", "readonly");
    const store = tx.objectStore("musicas");
    const req = store.getAll();
    req.onsuccess = () => {
      bancoDeMusicas = req.result || [];
      resolve();
    };
  });
}

window.onload = async () => {
  await abrirBancoDeDados();
  await carregarMusicasDoDB();

  const temaSalvo = localStorage.getItem('tikko_theme_color');
  if (temaSalvo) {
    document.documentElement.style.setProperty('--accent-color', temaSalvo);
  }

  setTimeout(() => {
    document.getElementById('splash-screen').style.opacity = '0';
    setTimeout(() => {
      document.getElementById('splash-screen').style.visibility = 'hidden';
    }, 600);
  }, 3500);

  renderPlaylists();
  renderTodasAsCancoes();
  verificarPermissaoArquivos();
  configurarEventosAudio();
};

function verificarPermissaoArquivos() {
  if (bancoDeMusicas.length === 0) {
    document.getElementById('modal-permissao').classList.remove('hidden');
  }
}

// NAVEGAÇÃO DE ABAS
function mudarAba(nomeAba) {
  abaAtiva = nomeAba;
  document.getElementById('tab-btn-playlists').classList.toggle('active', nomeAba === 'playlists');
  document.getElementById('tab-btn-cancoes').classList.toggle('active', nomeAba === 'cancoes');

  if (nomeAba === 'playlists') {
    document.getElementById('view-cancoes_list').classList.remove('active');
    document.getElementById('view-playlist_detail').classList.remove('active');
    document.getElementById('view-playlists_list').classList.add('active');
  } else if (nomeAba === 'cancoes') {
    document.getElementById('view-playlists_list').classList.remove('active');
    document.getElementById('view-playlist_detail').classList.remove('active');
    document.getElementById('view-cancoes_list').classList.add('active');
    renderTodasAsCancoes();
  }
}

// LEITURA DE METADADOS E CAPAS OFFLINE
async function solicitarAcessoArquivos() {
  try {
    if ('showDirectoryPicker' in window) {
      const dirHandle = await window.showDirectoryPicker();
      const musicasEncontradas = [];

      for await (const entry of dirHandle.values()) {
        if (entry.kind === 'file' && (entry.name.endsWith('.mp3') || entry.name.endsWith('.wav'))) {
          const file = await entry.getFile();
          
          const nomeLimpo = file.name.replace(/\.[^/.]+$/, "");
          let tituloAuto = nomeLimpo;
          let artistaAuto = "Artista Desconhecido";

          if (nomeLimpo.includes("-")) {
            const partes = nomeLimpo.split("-");
            artistaAuto = partes[0].trim();
            tituloAuto = partes.slice(1).join("-").trim();
          }

          const meta = await lerMetadadosOffline(file);
          
          musicasEncontradas.push({
            id: 'm_' + Math.random().toString(36).substr(2, 9),
            nome: meta.title || tituloAuto,
            artista: meta.artist || artistaAuto,
            capa: meta.cover || CAPA_PADRAO,
            arquivo: file
          });
        }
      }

      await limparEGravarNoDB(musicasEncontradas);
      await carregarMusicasDoDB();
      renderTodasAsCancoes();
      renderPlaylists();
    }
    document.getElementById('modal-permissao').classList.add('hidden');
  } catch (err) { console.log("Acesso cancelado."); }
}

function lerMetadadosOffline(file) {
  return new Promise((resolve) => {
    if (window.jsmediatags) {
      window.jsmediatags.read(file, {
        onSuccess: function(tag) {
          const tags = tag.tags;
          let coverUrl = null;
          if (tags.picture) {
            try {
              const { data, format } = tags.picture;
              let base64String = "";
              for (let i = 0; i < data.length; i++) { base64String += String.fromCharCode(data[i]); }
              coverUrl = `data:${format};base64,${btoa(base64String)}`;
            } catch (e) { coverUrl = null; }
          }
          resolve({
            title: tags.title && tags.title.trim() !== "" ? tags.title : null,
            artist: tags.artist && tags.artist.trim() !== "" ? tags.artist : null,
            cover: coverUrl
          });
        },
        onError: function() { resolve({}); }
      });
    } else { resolve({}); }
  });
}

function renderTodasAsCancoes() {
  const list = document.getElementById('all-songs-list');
  const countEl = document.getElementById('total-cancoes-count');
  list.innerHTML = '';
  countEl.innerText = `${bancoDeMusicas.length} faixas`;

  if (bancoDeMusicas.length === 0) {
    list.innerHTML = '<p style="color:#777; font-size:12px; text-align:center; margin-top:20px;">Nenhuma música encontrada.</p>';
    return;
  }

  bancoDeMusicas.forEach((m, idx) => {
    const li = document.createElement('li');
    li.className = 'song-item';
    li.innerHTML = `
      <img src="${m.capa || CAPA_PADRAO}" alt="Capa">
      <div class="song-meta">
        <h4>${m.nome}</h4>
        <p>${m.artista}</p>
      </div>
    `;

    li.onclick = () => {
      filaAtual = bancoDeMusicas;
      musicaAtualIndex = idx;
      carregarETocar(bancoDeMusicas[idx]);
    };

    list.appendChild(li);
  });
}

function renderPlaylists() {
  const grid = document.getElementById('grid-playlists');
  grid.innerHTML = '';

  if (playlists.length === 0) {
    grid.innerHTML = '<p style="color:#888; font-size:12px;">Nenhuma playlist criada.</p>';
    return;
  }

  playlists.forEach((pl, idx) => {
    let capaHTML = '';

    if (pl.capaPersonalizada) {
      capaHTML = `<div class="playlist-cover-box"><img src="${pl.capaPersonalizada}"></div>`;
    } else if (pl.musicas.length >= 4) {
      capaHTML = `
        <div class="playlist-cover-box grid-2x2">
          <img src="${pl.musicas[0].capa || CAPA_PADRAO}">
          <img src="${pl.musicas[1].capa || CAPA_PADRAO}">
          <img src="${pl.musicas[2].capa || CAPA_PADRAO}">
          <img src="${pl.musicas[3].capa || CAPA_PADRAO}">
        </div>
      `;
    } else if (pl.musicas.length > 0) {
      capaHTML = `<div class="playlist-cover-box"><img src="${pl.musicas[0].capa || CAPA_PADRAO}"></div>`;
    } else {
      capaHTML = `<div class="playlist-cover-box"><img src="${CAPA_PADRAO}"></div>`;
    }

    const row = document.createElement('div');
    row.className = 'playlist-card-row';
    row.innerHTML = `
      ${capaHTML}
      <div class="playlist-info-text">
        <h3>${pl.nome}</h3>
        <p>${pl.musicas.length} faixa(s)</p>
      </div>
      <button class="btn-more-options" onclick="event.stopPropagation(); abrirModalOpcoesPlaylistObj(${idx})">⋮</button>
    `;

    row.onclick = () => abrirPlaylist(idx);
    grid.appendChild(row);
  });
}

function abrirPlaylist(index) {
  playlistAtivaIndex = index;
  document.getElementById('view-playlists_list').classList.remove('active');
  document.getElementById('view-playlist_detail').classList.add('active');
  document.getElementById('playlist-title-display').innerText = playlists[index].nome;
  renderMusicasDaPlaylist();
}

function voltarParaPlaylists() {
  document.getElementById('view-playlist_detail').classList.remove('active');
  document.getElementById('view-playlists_list').classList.add('active');
}

function criarPlaylist() {
  const nome = prompt("Nome da Playlist:");
  if (nome && nome.trim() !== '') {
    playlists.push({ nome: nome, musicas: [], capaPersonalizada: null });
    salvarPlaylists();
    renderPlaylists();
  }
}

function renderMusicasDaPlaylist() {
  const list = document.getElementById('playlist-songs-list');
  list.innerHTML = '';

  const playlist = playlists[playlistAtivaIndex];
  if (playlist.musicas.length === 0) {
    list.innerHTML = '<p style="color:#777; font-size:12px; text-align:center; margin-top:20px;">Esta playlist está vazia.</p>';
    return;
  }

  playlist.musicas.forEach((m, idx) => {
    const li = document.createElement('li');
    li.className = 'song-item';
    li.innerHTML = `
      <img src="${m.capa || CAPA_PADRAO}" alt="Capa">
      <div class="song-meta">
        <h4>${m.nome}</h4>
        <p>${m.artista}</p>
      </div>
      <button class="btn-more-options" onclick="event.stopPropagation(); abrirModalOpcoesMusicaPlaylist(${idx})">⋮</button>
    `;

    li.onclick = () => tocarDaPlaylist(idx);

    list.appendChild(li);
  });
}

function tocarPlaylistNormal() {
  const pl = playlists[playlistAtivaIndex];
  if (!pl || pl.musicas.length === 0) return;
  filaAtual = [...pl.musicas];
  musicaAtualIndex = 0;
  carregarETocar(filaAtual[musicaAtualIndex]);
}

function tocarPlaylistAleatorio() {
  const pl = playlists[playlistAtivaIndex];
  if (!pl || pl.musicas.length === 0) return;
  
  filaAtual = [...pl.musicas];
  for (let i = filaAtual.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [filaAtual[i], filaAtual[j]] = [filaAtual[j], filaAtual[i]];
  }
  
  musicaAtualIndex = 0;
  carregarETocar(filaAtual[musicaAtualIndex]);
}

function tocarDaPlaylist(index) {
  filaAtual = playlists[playlistAtivaIndex].musicas;
  musicaAtualIndex = index;
  carregarETocar(filaAtual[musicaAtualIndex]);
}

function carregarETocar(musica) {
  if (!musica) return;

  const musicaDB = bancoDeMusicas.find(b => b.id === musica.id || b.nome === musica.nome);

  if (musicaDB && musicaDB.arquivo) {
    const urlBlob = URL.createObjectURL(musicaDB.arquivo);
    audio.src = urlBlob;
    audio.play().catch(err => console.log("Erro de áudio:", err));
  }

  const capaFinal = musica.capa || CAPA_PADRAO;

  document.getElementById('mini-title').innerText = musica.nome;
  document.getElementById('mini-artist').innerText = musica.artista;
  document.getElementById('mini-cover-container').innerHTML = `<img src="${capaFinal}">`;
  document.getElementById('mini-btn-play').innerText = '⏸';

  document.getElementById('full-title').innerText = musica.nome;
  document.getElementById('full-artist').innerText = musica.artista;
  document.getElementById('full-cover-container').innerHTML = `<img src="${capaFinal}">`;
  document.getElementById('full-btn-play').innerText = '⏸';

  extrairCorEAplicarTema(capaFinal);
  buscarLetra(musica.nome, musica.artista);
}

function extrairCorEAplicarTema(srcCapa) {
  if (!srcCapa || srcCapa === CAPA_PADRAO) {
    document.documentElement.style.setProperty('--dynamic-theme', '#121212');
    return;
  }
  const img = new Image();
  img.crossOrigin = "Anonymous";
  img.src = srcCapa;
  img.onload = () => {
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d');
    canvas.width = 1; canvas.height = 1;
    ctx.drawImage(img, 0, 0, 1, 1);
    const pixel = ctx.getImageData(0, 0, 1, 1).data;
    const color = `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
    document.documentElement.style.setProperty('--dynamic-theme', color);
  };
}

async function buscarLetra(titulo, artista) {
  const lyricsEl = document.getElementById('lyrics-text');
  lyricsEl.innerText = "Buscando letra...";

  if (!artista || artista === "Artista Desconhecido") {
    lyricsEl.innerText = "Letra indisponível (artista não identificado).";
    return;
  }

  try {
    const res = await fetch(`https://lrclib.net/api/get?artist_name=${encodeURIComponent(artista)}&track_name=${encodeURIComponent(titulo)}`);
    if (res.ok) {
      const data = await res.json();
      lyricsEl.innerText = data.plainLyrics || data.syncedLyrics || "Letra não encontrada.";
    } else { lyricsEl.innerText = "Letra indisponível para esta música."; }
  } catch (e) { lyricsEl.innerText = "Letra não encontrada."; }
}

function togglePlay() {
  if (!audio.src) return;
  if (audio.paused) {
    audio.play();
    document.getElementById('mini-btn-play').innerText = '⏸';
    document.getElementById('full-btn-play').innerText = '⏸';
  } else {
    audio.pause();
    document.getElementById('mini-btn-play').innerText = '▶';
    document.getElementById('full-btn-play').innerText = '▶';
  }
}

function nextSong() {
  if (filaAtual.length > 0 && musicaAtualIndex < filaAtual.length - 1) {
    musicaAtualIndex++;
    carregarETocar(filaAtual[musicaAtualIndex]);
  }
}

function prevSong() {
  if (filaAtual.length > 0 && musicaAtualIndex > 0) {
    musicaAtualIndex--;
    carregarETocar(filaAtual[musicaAtualIndex]);
  }
}

function configurarEventosAudio() {
  audio.ontimeupdate = () => {
    if (audio.duration) {
      const prog = (audio.currentTime / audio.duration) * 100;
      document.getElementById('progress-bar').value = prog;
      document.getElementById('time-current').innerText = formatTime(audio.currentTime);
      document.getElementById('time-total').innerText = formatTime(audio.duration);
    }
  };
  audio.onended = () => nextSong();
}

function seekAudio(val) {
  if (audio.duration) { audio.currentTime = (val / 100) * audio.duration; }
}

function formatTime(sec) {
  const m = Math.floor(sec / 60);
  const s = Math.floor(sec % 60);
  return `${m}:${s < 10 ? '0' : ''}${s}`;
}

function abrirPlayerFull() { document.getElementById('full-player').classList.remove('hidden'); }
function fecharPlayerFull() { document.getElementById('full-player').classList.add('hidden'); }

// OPÇÕES DE MÚSICA NA PLAYLIST
function abrirModalOpcoesMusicaPlaylist(index) {
  musicaSelecionadaIndex = index;
  const m = playlists[playlistAtivaIndex].musicas[index];
  document.getElementById('opcoes-musica-titulo').innerText = m.nome;
  document.getElementById('modal-opcoes-musica').classList.remove('hidden');
}

function fecharModalOpcoes() {
  document.getElementById('modal-opcoes-musica').classList.add('hidden');
}

function removerMusicaDaPlaylistAtiva() {
  if (musicaSelecionadaIndex !== null && playlistAtivaIndex !== null) {
    playlists[playlistAtivaIndex].musicas.splice(musicaSelecionadaIndex, 1);
    salvarPlaylists();
    renderMusicasDaPlaylist();
    renderPlaylists();
    fecharModalOpcoes();
  }
}

// OPÇÕES DA PLAYLIST
function abrirModalOpcoesPlaylistObj(index) {
  playlistAtivaIndex = index;
  document.getElementById('opcoes-playlist-titulo').innerText = playlists[index].nome;
  document.getElementById('modal-opcoes-playlist').classList.remove('hidden');
}

function fecharModalPlaylist() {
  document.getElementById('modal-opcoes-playlist').classList.add('hidden');
}

function selecionarCapaPlaylist() {
  document.getElementById('input-capa-playlist').click();
}

function aplicarCapaPlaylist(event) {
  const file = event.target.files[0];
  if (file && playlistAtivaIndex !== null) {
    const reader = new FileReader();
    reader.onload = (e) => {
      playlists[playlistAtivaIndex].capaPersonalizada = e.target.result;
      salvarPlaylists();
      renderPlaylists();
      fecharModalPlaylist();
    };
    reader.readAsDataURL(file);
  }
}

function excluirPlaylistAtiva() {
  if (playlistAtivaIndex !== null) {
    playlists.splice(playlistAtivaIndex, 1);
    salvarPlaylists();
    renderPlaylists();
    fecharModalPlaylist();
  }
}

// CONFIGURAÇÕES E TEMAS
function abrirModalConfiguracoes() { document.getElementById('modal-configuracoes').classList.remove('hidden'); }
function fecharModalConfiguracoes() { document.getElementById('modal-configuracoes').classList.add('hidden'); }

function aplicarTemaPredefinido(corHex) {
  document.documentElement.style.setProperty('--accent-color', corHex);
  localStorage.setItem('tikko_theme_color', corHex);
  fecharModalConfiguracoes();
}

function abrirModalAdicionar() {
  const list = document.getElementById('modal-lista-musicas');
  list.innerHTML = '';

  if (bancoDeMusicas.length === 0) {
    list.innerHTML = '<p style="color:#aaa; font-size:12px;">Nenhuma música salva no banco de dados.</p>';
  } else {
    bancoDeMusicas.forEach((m) => {
      list.innerHTML += `
        <li class="song-item" onclick="adicionarNaPlaylistAtiva('${m.id}')">
          <div class="song-meta">
            <h4>${m.nome}</h4>
            <p>${m.artista}</p>
          </div>
          <span style="color:var(--accent-color); font-weight:bold;">+</span>
        </li>
      `;
    });
  }
  document.getElementById('modal-adicionar').classList.remove('hidden');
}

function adicionarNaPlaylistAtiva(idMusica) {
  const pl = playlists[playlistAtivaIndex];
  const musicaObj = bancoDeMusicas.find(m => m.id === idMusica);

  if (musicaObj && !pl.musicas.some(m => m.id === idMusica)) {
    pl.musicas.push({
      id: musicaObj.id,
      nome: musicaObj.nome,
      artista: musicaObj.artista,
      capa: musicaObj.capa
    });
    salvarPlaylists();
    renderMusicasDaPlaylist();
    renderPlaylists();
  }
}

function fecharModal() { document.getElementById('modal-adicionar').classList.add('hidden'); }
function salvarPlaylists() { localStorage.setItem('tikko_playlists', JSON.stringify(playlists)); }