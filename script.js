(function(){
  const ICONS = {
    tag: '<svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M20.59 13.41 11 3.83A2 2 0 0 0 9.59 3.24L3 3v6.59a2 2 0 0 0 .59 1.41l9.58 9.58a2 2 0 0 0 2.83 0l4.59-4.59a2 2 0 0 0 0-2.83Z"/><circle cx="7.5" cy="7.5" r="1.5"/></svg>',
    store: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 9h18M4 4h16l-1.5 5H5.5L4 4Z"/><path d="M4 9v11h16V9"/><path d="M9 21v-6h6v6"/></svg>',
    yen: '<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.2"><path d="m6 4 6 8 6-8M6 14h12M6 18h12M12 12v9"/></svg>',
    pencil: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M12 20h9M16.5 3.5a2.1 2.1 0 0 1 3 3L7 19l-4 1 1-4Z"/></svg>',
    trash: '<svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M3 6h18M8 6V4h8v2M19 6l-1 14H6L5 6"/></svg>',
    imageOff: '<svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#C9C3B6" stroke-width="2"><path d="M21 3 3 21M3 8v11a2 2 0 0 0 2 2h11M21 16V5a2 2 0 0 0-2-2H8"/></svg>',
    refresh: '<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.3"><path d="M21 12a9 9 0 1 1-2.64-6.36M21 3v6h-6"/></svg>'
  };
  const DEFAULT_GENRES = [
    { id:'oshi', label:'推し活', color:'#D98BA0' },
    { id:'cook', label:'料理', color:'#7C9473' },
    { id:'wash', label:'洗面まわり', color:'#7195AC' },
    { id:'makeup', label:'メイク', color:'#D4915E' },
  ];
  const SWATCHES = ['#D98BA0','#7C9473','#7195AC','#D4915E','#9C9585','#8A7CA8','#C9A227','#5E9E8E'];

  let genres = DEFAULT_GENRES.slice();
  let items = [];
  let activeGenre = 'all';
  let activeStore = 'all';
  let query = '';
  let editingId = null;
  let stagedPhoto = '';
  let newGenreColor = SWATCHES[0];

  const uid = () => Math.random().toString(36).slice(2,10) + Date.now().toString(36);
  const todayStr = () => new Date().toISOString().slice(0,10);
  const fmtDate = (s) => { if(!s) return ''; const d = new Date(s+'T00:00:00'); return d.getFullYear()+'/'+String(d.getMonth()+1).padStart(2,'0')+'/'+String(d.getDate()).padStart(2,'0'); };

  function compressImage(file, maxW=340, quality=0.68){
    return new Promise((resolve,reject)=>{
      const reader = new FileReader();
      reader.onload = (e)=>{
        const img = new Image();
        img.onload = ()=>{
          const scale = Math.min(1, maxW/img.width);
          const w = Math.round(img.width*scale), h = Math.round(img.height*scale);
          const canvas = document.createElement('canvas');
          canvas.width = w; canvas.height = h;
          const ctx = canvas.getContext('2d');
          ctx.drawImage(img,0,0,w,h);
          resolve(canvas.toDataURL('image/jpeg', quality));
        };
        img.onerror = reject;
        img.src = e.target.result;
      };
      reader.onerror = reject;
      reader.readAsDataURL(file);
    });
  }

  async function loadData(){
    try{
      const res = await window.storage.get('app-data');
      if(res && res.value){
        const parsed = JSON.parse(res.value);
        genres = (parsed.genres && parsed.genres.length) ? parsed.genres : DEFAULT_GENRES.slice();
        items = parsed.items || [];
      }
    }catch(e){ /* no data yet */ }
    render();
  }

  async function saveData(){
    try{
      await window.storage.set('app-data', JSON.stringify({genres, items}));
    }catch(e){ console.error('save failed', e); }
  }

  function showToast(msg){
    const t = document.getElementById('toast');
    t.textContent = msg;
    t.classList.add('show');
    clearTimeout(showToast._timer);
    showToast._timer = setTimeout(()=> t.classList.remove('show'), 1800);
  }

  function genreMap(){ return Object.fromEntries(genres.map(g=>[g.id,g])); }

  function uniqueStores(){
    const s = new Set();
    items.forEach(it=>{ if(it.store && it.store.trim()) s.add(it.store.trim()); });
    return Array.from(s).sort((a,b)=>a.localeCompare(b,'ja'));
  }

  function filteredItems(){
    return items
      .filter(it => activeGenre==='all' ? true : it.genreId===activeGenre)
      .filter(it => activeStore==='all' ? true : it.store===activeStore)
      .filter(it => query.trim() ? it.name.toLowerCase().includes(query.trim().toLowerCase()) : true)
      .sort((a,b)=> (b.purchaseDate||'').localeCompare(a.purchaseDate||'') || b.createdAt - a.createdAt);
  }

  function render(){
    renderSidebar();
    renderStoreSelect();
    renderGrid();
    document.getElementById('sidebarFooter').textContent = `登録アイテム ${items.length} 件`;
  }

  function renderSidebar(){
    const wrap = document.getElementById('genreList');
    const gm = genreMap();
    let html = `
      <button class="genre-btn" data-genre="all" style="background:${activeGenre==='all' ? '#2B2926' : 'transparent'}; color:${activeGenre==='all' ? '#F7F5F0' : '#2B2926'};">
        <span class="dot" style="background:#2B2926"></span> すべて <span class="count">${items.length}</span>
      </button>`;
    genres.forEach(g=>{
      const count = items.filter(it=>it.genreId===g.id).length;
      const active = activeGenre===g.id;
      html += `
        <button class="genre-btn" data-genre="${g.id}" style="background:${active ? g.color : 'transparent'}; color:${active ? '#fff' : '#2B2926'};">
          <span class="dot" style="background:${g.color}"></span> ${escapeHtml(g.label)} <span class="count">${count}</span>
        </button>`;
    });
    html += `<button class="add-genre-btn" id="editGenresBtn"><svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M12 5v14M5 12h14"/></svg> ジャンルを編集</button>`;
    wrap.innerHTML = html;
    wrap.querySelectorAll('[data-genre]').forEach(btn=>{
      btn.addEventListener('click', ()=>{ activeGenre = btn.dataset.genre; render(); });
    });
    document.getElementById('editGenresBtn').addEventListener('click', openGenreModal);
  }

  function renderStoreSelect(){
    const sel = document.getElementById('storeSelect');
    const stores = uniqueStores();
    const prev = activeStore;
    sel.innerHTML = `<option value="all">すべての店舗</option>` + stores.map(s=>`<option value="${escapeAttr(s)}">${escapeHtml(s)}</option>`).join('');
    if(stores.includes(prev)) sel.value = prev; else { activeStore = 'all'; sel.value = 'all'; }
  }

  function renderGrid(){
    const grid = document.getElementById('grid');
    const empty = document.getElementById('emptyState');
    const list = filteredItems();
    const gm = genreMap();

    if(list.length===0){
      grid.style.display = 'none';
      empty.style.display = 'flex';
      document.getElementById('emptyTitle').textContent = items.length===0 ? 'まだ何も記録されていません' : '見つかりませんでした';
      document.getElementById('emptyText').textContent = items.length===0
        ? 'いつも買うもの、リピートしたい商品を写真つきで記録しておきましょう。'
        : 'ジャンル・店舗・検索条件を変えてみてください。';
      document.getElementById('emptyAddBtn').style.display = items.length===0 ? 'flex' : 'none';
      grid.innerHTML = '';
      return;
    }
    empty.style.display = 'none';
    grid.style.display = 'grid';

    grid.innerHTML = list.map(it=>{
      const g = gm[it.genreId];
      const photoHtml = it.photo
        ? `<img src="${it.photo}" alt="${escapeAttr(it.name)}" />`
        : `<div class="photo-placeholder">${ICONS.imageOff}</div>`;
      const chip = g ? `<span class="chip" style="background:${g.color}22; color:${g.color}; border-color:${g.color}55;">${ICONS.tag} ${escapeHtml(g.label)}</span>` : '';
      const priceHtml = (it.price !== '' && it.price != null) ? `<span class="price">${ICONS.yen} ${Number(it.price).toLocaleString()}</span>` : '';
      const storeHtml = it.store ? `<span class="store">${ICONS.store} ${escapeHtml(it.store)}</span>` : '';
      const noteHtml = it.note ? `<div class="note">${escapeHtml(it.note)}</div>` : '';
      const lastBuy = it.purchaseDate ? fmtDate(it.purchaseDate) : '未記録';
      return `
        <div class="card" data-id="${it.id}">
          <div class="punch"></div>
          <div class="card-actions">
            <button class="icon-btn" data-action="edit" data-id="${it.id}" aria-label="編集">${ICONS.pencil}</button>
            <button class="icon-btn" data-action="delete" data-id="${it.id}" aria-label="削除">${ICONS.trash}</button>
          </div>
          <div class="photo-wrap">${photoHtml}</div>
          <div class="card-body">
            ${chip}
            <div class="item-name">${escapeHtml(it.name)}</div>
            <div class="meta-row">${priceHtml}${storeHtml}</div>
            ${noteHtml}
            <div class="last-buy-row">
              <span class="last-buy">最終購入 ${lastBuy}</span>
              <button class="rebuy-btn" data-action="rebuy" data-id="${it.id}" title="今日の日付で更新">${ICONS.refresh} 今日買った</button>
            </div>
          </div>
        </div>`;
    }).join('');

    grid.querySelectorAll('[data-action="edit"]').forEach(b=> b.addEventListener('click', (e)=>{ e.stopPropagation(); openItemModal(b.dataset.id); }));
    grid.querySelectorAll('[data-action="delete"]').forEach(b=> b.addEventListener('click', (e)=>{ e.stopPropagation(); deleteItem(b.dataset.id); }));
    grid.querySelectorAll('[data-action="rebuy"]').forEach(b=> b.addEventListener('click', (e)=>{ e.stopPropagation(); quickRebuy(b.dataset.id); }));
  }

  function escapeHtml(str){
    return String(str ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  }
  function escapeAttr(str){ return escapeHtml(str); }

  /* ---- Item modal ---- */
  function openItemModal(id){
    editingId = id || null;
    const it = id ? items.find(x=>x.id===id) : null;
    stagedPhoto = it ? (it.photo || '') : '';
    document.getElementById('itemModalTitle').textContent = it ? '編集する' : '新しく記録する';
    document.getElementById('nameInput').value = it ? it.name : '';
    document.getElementById('priceInput').value = it ? (it.price ?? '') : '';
    document.getElementById('storeInput').value = it ? (it.store ?? '') : '';
    document.getElementById('noteInput').value = it ? (it.note ?? '') : '';
    document.getElementById('dateInput').value = it ? (it.purchaseDate || todayStr()) : todayStr();
    renderGenrePickRow(it ? it.genreId : (genres[0] && genres[0].id));
    updatePhotoPreview();
    document.getElementById('itemOverlay').classList.remove('hidden');
  }
  function closeItemModal(){ document.getElementById('itemOverlay').classList.add('hidden'); }

  function renderGenrePickRow(selectedId){
    const wrap = document.getElementById('genrePickRow');
    wrap.dataset.selected = selectedId || '';
    wrap.innerHTML = genres.map(g=>{
      const active = g.id === selectedId;
      return `<button type="button" class="genre-pick-btn" data-id="${g.id}" style="background:${active?g.color:'#fff'}; color:${active?'#fff':'#2B2926'}; border-color:${g.color};">${escapeHtml(g.label)}</button>`;
    }).join('');
    wrap.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click', ()=>{ renderGenrePickRow(b.dataset.id); });
    });
  }

  function updatePhotoPreview(){
    const inner = document.getElementById('photoPreviewInner');
    const removeBtn = document.getElementById('removePhotoBtn');
    if(stagedPhoto){
      inner.outerHTML = `<img id="photoPreviewInner" src="${stagedPhoto}" style="width:100%;height:100%;object-fit:cover;" />`;
      removeBtn.style.display = 'inline-block';
    } else {
      const el = document.getElementById('photoPreviewInner');
      el.outerHTML = `<div class="photo-placeholder" id="photoPreviewInner"><svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#B3AC9C" stroke-width="2"><path d="M23 19a2 2 0 0 1-2 2H3a2 2 0 0 1-2-2V8a2 2 0 0 1 2-2h4l2-3h6l2 3h4a2 2 0 0 1 2 2z"/><circle cx="12" cy="13" r="4"/></svg></div>`;
      removeBtn.style.display = 'none';
    }
  }

  async function saveItem(){
    const name = document.getElementById('nameInput').value.trim();
    if(!name) return;
    const genreId = document.getElementById('genrePickRow').dataset.selected || (genres[0] && genres[0].id) || '';
    const price = document.getElementById('priceInput').value;
    const store = document.getElementById('storeInput').value.trim();
    const note = document.getElementById('noteInput').value.trim();
    const purchaseDate = document.getElementById('dateInput').value || todayStr();

    if(editingId){
      const idx = items.findIndex(x=>x.id===editingId);
      if(idx>-1){
        items[idx] = { ...items[idx], name, genreId, price, store, note, purchaseDate, photo: stagedPhoto };
      }
      showToast('更新しました');
    } else {
      items.unshift({ id: uid(), name, genreId, price, store, note, purchaseDate, photo: stagedPhoto, createdAt: Date.now() });
      showToast('記録しました');
    }
    await saveData();
    closeItemModal();
    render();
  }

  async function deleteItem(id){
    if(!window.confirm('このアイテムを削除しますか？')) return;
    items = items.filter(it=>it.id!==id);
    await saveData();
    render();
    showToast('削除しました');
  }

  async function quickRebuy(id){
    const idx = items.findIndex(x=>x.id===id);
    if(idx===-1) return;
    items[idx].purchaseDate = todayStr();
    await saveData();
    render();
    showToast('購入日を更新しました');
  }

  /* ---- Genre modal ---- */
  function openGenreModal(){
    renderGenreEditList();
    renderSwatches();
    document.getElementById('newGenreName').value = '';
    document.getElementById('genreOverlay').classList.remove('hidden');
  }
  function closeGenreModal(){ document.getElementById('genreOverlay').classList.add('hidden'); }

  function renderGenreEditList(){
    const wrap = document.getElementById('genreEditList');
    wrap.innerHTML = genres.map(g=>`
      <div class="genre-row">
        <span class="dot" style="background:${g.color}"></span>
        <span style="flex:1;">${escapeHtml(g.label)}</span>
        <button class="icon-btn" data-remove="${g.id}">${ICONS.trash}</button>
      </div>`).join('');
    wrap.querySelectorAll('[data-remove]').forEach(b=>{
      b.addEventListener('click', async ()=>{
        const id = b.dataset.remove;
        if(items.some(it=>it.genreId===id)){
          if(!window.confirm('このジャンルのアイテムも紐付けが外れます。削除しますか？')) return;
        }
        genres = genres.filter(g=>g.id!==id);
        if(activeGenre===id) activeGenre='all';
        await saveData();
        renderGenreEditList();
        render();
      });
    });
  }

  function renderSwatches(){
    const wrap = document.getElementById('swatchRow');
    wrap.innerHTML = SWATCHES.map(c=>`<button type="button" class="swatch" data-color="${c}" style="background:${c}; box-shadow:${newGenreColor===c ? `0 0 0 2px #fff, 0 0 0 4px ${c}` : 'none'};"></button>`).join('');
    wrap.querySelectorAll('button').forEach(b=>{
      b.addEventListener('click', ()=>{ newGenreColor = b.dataset.color; renderSwatches(); });
    });
  }

  async function addGenreHandler(){
    const nameEl = document.getElementById('newGenreName');
    const name = nameEl.value.trim();
    if(!name) return;
    genres.push({ id: uid(), label: name, color: newGenreColor });
    nameEl.value = '';
    newGenreColor = SWATCHES[genres.length % SWATCHES.length];
    await saveData();
    renderGenreEditList();
    renderSwatches();
    render();
  }

  /* ---- wire up events ---- */
  document.getElementById('openAddBtn').addEventListener('click', ()=>openItemModal(null));
  document.getElementById('emptyAddBtn').addEventListener('click', ()=>openItemModal(null));
  document.getElementById('closeItemModal').addEventListener('click', closeItemModal);
  document.getElementById('cancelItemBtn').addEventListener('click', closeItemModal);
  document.getElementById('itemOverlay').addEventListener('click', (e)=>{ if(e.target.id==='itemOverlay') closeItemModal(); });
  document.getElementById('saveItemBtn').addEventListener('click', saveItem);

  document.getElementById('closeGenreModal').addEventListener('click', closeGenreModal);
  document.getElementById('genreOverlay').addEventListener('click', (e)=>{ if(e.target.id==='genreOverlay') closeGenreModal(); });
  document.getElementById('addGenreBtn').addEventListener('click', addGenreHandler);

  document.getElementById('choosePhotoBtn').addEventListener('click', ()=> document.getElementById('photoInput').click());
  document.getElementById('photoPreviewBtn').addEventListener('click', ()=> document.getElementById('photoInput').click());
  document.getElementById('removePhotoBtn').addEventListener('click', ()=>{ stagedPhoto=''; updatePhotoPreview(); });
  document.getElementById('photoInput').addEventListener('change', async (e)=>{
    const file = e.target.files && e.target.files[0];
    if(!file) return;
    try{
      stagedPhoto = await compressImage(file);
      updatePhotoPreview();
    }catch(err){ console.error(err); }
  });

  document.getElementById('searchInput').addEventListener('input', (e)=>{ query = e.target.value; renderGrid(); });
  document.getElementById('storeSelect').addEventListener('change', (e)=>{ activeStore = e.target.value; renderGrid(); });

  loadData();
})();