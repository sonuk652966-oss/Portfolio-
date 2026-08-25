// ---------- Element refs ----------
const keyToggle = document.getElementById('keyToggle');
const keyPanel = document.getElementById('keyPanel');
const apiKeyInput = document.getElementById('apiKey');
const chatWindow = document.getElementById('chatWindow');
const scrollBottomBtn = document.getElementById('scrollBottomBtn');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');
const micBtn = document.getElementById('micBtn');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const removeImage = document.getElementById('removeImage');
const charCount = document.getElementById('charCount');

const sheetOverlay = document.getElementById('sheetOverlay');
const sheetClose = document.getElementById('sheetClose');
const cameraOption = document.getElementById('cameraOption');
const galleryOption = document.getElementById('galleryOption');
const cameraInput = document.getElementById('cameraInput');
const galleryInput = document.getElementById('galleryInput');

const chatsToggle = document.getElementById('chatsToggle');
const chatsOverlay = document.getElementById('chatsOverlay');
const chatsClose = document.getElementById('chatsClose');
const chatsList = document.getElementById('chatsList');
const newChatBtn = document.getElementById('newChatBtn');

const searchToggle = document.getElementById('searchToggle');
const searchOverlay = document.getElementById('searchOverlay');
const searchClose = document.getElementById('searchClose');
const searchInput = document.getElementById('searchInput');
const searchResults = document.getElementById('searchResults');

const pinnedToggle = document.getElementById('pinnedToggle');
const pinnedOverlay = document.getElementById('pinnedOverlay');
const pinnedClose = document.getElementById('pinnedClose');
const pinnedResults = document.getElementById('pinnedResults');

const settingsToggle = document.getElementById('settingsToggle');
const settingsOverlay = document.getElementById('settingsOverlay');
const settingsClose = document.getElementById('settingsClose');
const langToggle = document.getElementById('langToggle');
const lengthToggle = document.getElementById('lengthToggle');
const soundToggle = document.getElementById('soundToggle');
const themeToggleCheckbox = document.getElementById('themeToggleCheckbox');
const exportBtn = document.getElementById('exportBtn');
const clearBtn = document.getElementById('clearBtn');

const TEXT_MODEL = "openai/gpt-oss-120b";
const VISION_MODEL = "qwen/qwen3.6-27b";
const BASE_SYSTEM_PROMPT = "You are a helpful, friendly assistant. For math/chemistry/physics problems: use plain, simple notation (write fractions as a/b, use × for multiply, write powers like 10^-4 or 10⁻⁴) — never use LaTeX syntax like \\frac, \\times, or $ symbols. Use **bold** for section headings like **Given:**, **Formula:**, **Calculation:**, **Answer:**. Keep it clean and step-by-step.";

const SUGGESTED_PROMPTS = [
  "Mujhe ek chutkula sunao",
  "Physics ka koi topic aasan bhasha mein samjhao",
  "Ek chhoti si Hindi kahani likho",
  "Interview ke liye tips do"
];

let selectedImageBase64 = null;
let abortController = null;
let isGenerating = false;
let editingIndex = null;
let typingSoundInterval = null;

// ---------- Settings ----------
function loadSettings(){
  try{ return JSON.parse(localStorage.getItem('chat_settings')) || {}; }catch(e){ return {}; }
}
let settings = Object.assign({ language: 'auto', length: 'normal', sound: false, theme: 'light' }, loadSettings());

function saveSettings(){
  localStorage.setItem('chat_settings', JSON.stringify(settings));
}

function applyTheme(theme){
  document.documentElement.setAttribute('data-theme', theme);
  settings.theme = theme;
  saveSettings();
  themeToggleCheckbox.checked = theme === 'dark';
}
applyTheme(settings.theme);

themeToggleCheckbox.addEventListener('change', () => {
  applyTheme(themeToggleCheckbox.checked ? 'dark' : 'light');
});

function refreshToggleGroup(group, value){
  group.querySelectorAll('.toggle-opt').forEach(btn => {
    btn.classList.toggle('active', btn.dataset.val === value);
  });
}
refreshToggleGroup(langToggle, settings.language);
refreshToggleGroup(lengthToggle, settings.length);
soundToggle.checked = !!settings.sound;

langToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.toggle-opt');
  if(!btn) return;
  settings.language = btn.dataset.val;
  saveSettings();
  refreshToggleGroup(langToggle, settings.language);
});
lengthToggle.addEventListener('click', (e) => {
  const btn = e.target.closest('.toggle-opt');
  if(!btn) return;
  settings.length = btn.dataset.val;
  saveSettings();
  refreshToggleGroup(lengthToggle, settings.length);
});
soundToggle.addEventListener('change', () => {
  settings.sound = soundToggle.checked;
  saveSettings();
});

function buildSystemPrompt(){
  let extra = "";
  if(settings.language === 'hi') extra += " Always reply in Hindi (Devanagari script), regardless of what language the user writes in.";
  if(settings.language === 'en') extra += " Always reply in English, regardless of what language the user writes in.";
  if(settings.length === 'short') extra += " Keep replies very short — 2 to 4 sentences maximum, no long explanations unless explicitly asked.";
  if(settings.length === 'long') extra += " Give thorough, detailed replies with full explanations and examples where useful.";
  return BASE_SYSTEM_PROMPT + extra;
}

settingsToggle.addEventListener('click', () => settingsOverlay.classList.add('open'));
settingsClose.addEventListener('click', () => settingsOverlay.classList.remove('open'));
settingsOverlay.addEventListener('click', (e) => { if(e.target === settingsOverlay) settingsOverlay.classList.remove('open'); });

// ---------- Typing sound (Web Audio, no files needed) ----------
let audioCtx = null;
function playTick(){
  if(!settings.sound) return;
  try{
    if(!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = 700;
    gain.gain.value = 0.04;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    osc.start();
    osc.stop(audioCtx.currentTime + 0.04);
  }catch(e){}
}
function startTypingSound(){
  if(!settings.sound) return;
  playTick();
  typingSoundInterval = setInterval(playTick, 450);
}
function stopTypingSound(){
  if(typingSoundInterval){ clearInterval(typingSoundInterval); typingSoundInterval = null; }
}

// ---------- API key ----------
const savedKey = localStorage.getItem('groq_api_key');
if(savedKey){ apiKeyInput.value = savedKey; } else { keyPanel.classList.add('open'); }
keyToggle.addEventListener('click', () => keyPanel.classList.toggle('open'));
apiKeyInput.addEventListener('input', () => {
  const val = apiKeyInput.value.trim();
  localStorage.setItem('groq_api_key', val);
  if(val.length > 10) keyPanel.classList.remove('open');
});

// ---------- Multi-chat storage ----------
function loadChats(){
  try{ return JSON.parse(localStorage.getItem('chats_v1')) || []; }catch(e){ return []; }
}
function saveChats(){
  const toSave = chats.map(c => ({
    id: c.id,
    title: c.title,
    apiMessages: c.apiMessages.map(m => {
      if(Array.isArray(m.content)){
        return { role: m.role, content: m.content.map(part => part.type === 'image_url' ? { type:'text', text:'[Photo]' } : part) };
      }
      return m;
    }),
    displayMessages: c.displayMessages.map(m => ({ ...m, imageSrc: null }))
  }));
  localStorage.setItem('chats_v1', JSON.stringify(toSave));
  localStorage.setItem('current_chat_id', currentChatId);
}
function newChatObj(){
  return {
    id: 'c' + Date.now(),
    title: 'Nayi Chat',
    apiMessages: [{ role: 'system', content: buildSystemPrompt() }],
    displayMessages: []
  };
}

let chats = loadChats();
let currentChatId = localStorage.getItem('current_chat_id');
if(chats.length === 0){
  const c = newChatObj();
  chats.push(c);
  currentChatId = c.id;
}
if(!chats.find(c => c.id === currentChatId)){
  currentChatId = chats[0].id;
}
function getCurrentChat(){ return chats.find(c => c.id === currentChatId); }

// ---------- Draft auto-save ----------
function draftKey(){ return `draft_${currentChatId}`; }
function loadDraft(){
  const d = localStorage.getItem(draftKey());
  if(d) userInput.value = d;
}
function saveDraft(){
  if(userInput.value){ localStorage.setItem(draftKey(), userInput.value); }
  else{ localStorage.removeItem(draftKey()); }
}
function clearDraft(){ localStorage.removeItem(draftKey()); }

userInput.addEventListener('input', () => {
  saveDraft();
  const val = userInput.value;
  if(val.length === 0){ charCount.style.display = 'none'; return; }
  const words = val.trim().split(/\s+/).filter(Boolean).length;
  charCount.style.display = 'block';
  charCount.textContent = `${val.length} characters · ${words} words`;
  charCount.classList.toggle('warn', val.length > 1000);
});

// ---------- Chats list sheet ----------
function renderChatsList(){
  chatsList.innerHTML = '';
  chats.slice().reverse().forEach(c => {
    const item = document.createElement('div');
    item.className = 'chat-item' + (c.id === currentChatId ? ' active' : '');
    item.innerHTML = `<span class="chat-item-title"></span><div class="chat-item-actions"><button type="button" class="chat-item-rename">✏️</button><button type="button" class="chat-item-del">✕</button></div>`;
    item.querySelector('.chat-item-title').textContent = c.title;
    item.addEventListener('click', (e) => {
      if(e.target.closest('.chat-item-del') || e.target.closest('.chat-item-rename')) return;
      currentChatId = c.id;
      saveChats();
      renderCurrentChat();
      loadDraft();
      renderChatsList();
      chatsOverlay.classList.remove('open');
    });
    item.querySelector('.chat-item-rename').addEventListener('click', (e) => {
      e.stopPropagation();
      const titleSpan = item.querySelector('.chat-item-title');
      const input = document.createElement('input');
      input.type = 'text';
      input.className = 'chat-item-title-input';
      input.value = c.title;
      titleSpan.replaceWith(input);
      input.focus();
      input.select();
      function commitRename(){
        const newTitle = input.value.trim() || c.title;
        c.title = newTitle;
        saveChats();
        renderChatsList();
        if(c.id === currentChatId) renderCurrentChat();
      }
      input.addEventListener('blur', commitRename);
      input.addEventListener('keydown', (ev) => {
        if(ev.key === 'Enter'){ ev.preventDefault(); input.blur(); }
      });
      input.addEventListener('click', (ev) => ev.stopPropagation());
    });
    item.querySelector('.chat-item-del').addEventListener('click', (e) => {
      e.stopPropagation();
      chats = chats.filter(x => x.id !== c.id);
      if(chats.length === 0){ chats.push(newChatObj()); }
      if(currentChatId === c.id){ currentChatId = chats[chats.length - 1].id; }
      saveChats();
      renderCurrentChat();
      renderChatsList();
    });
    chatsList.appendChild(item);
  });
}
chatsToggle.addEventListener('click', () => { renderChatsList(); chatsOverlay.classList.add('open'); });
chatsClose.addEventListener('click', () => chatsOverlay.classList.remove('open'));
chatsOverlay.addEventListener('click', (e) => { if(e.target === chatsOverlay) chatsOverlay.classList.remove('open'); });
newChatBtn.addEventListener('click', () => {
  const c = newChatObj();
  chats.push(c);
  currentChatId = c.id;
  saveChats();
  renderCurrentChat();
  loadDraft();
  renderChatsList();
  chatsOverlay.classList.remove('open');
});

clearBtn.addEventListener('click', () => {
  const chat = getCurrentChat();
  chat.apiMessages = [{ role: 'system', content: buildSystemPrompt() }];
  chat.displayMessages = [];
  chat.title = 'Nayi Chat';
  saveChats();
  renderCurrentChat();
  settingsOverlay.classList.remove('open');
});

// ---------- Export chat ----------
exportBtn.addEventListener('click', () => {
  const chat = getCurrentChat();
  if(chat.displayMessages.length === 0){ alert('Chat khaali hai, export karne ke liye kuch messages honi chahiye.'); return; }
  let content = `AI Chat Export — ${chat.title}\n${'='.repeat(40)}\n\n`;
  chat.displayMessages.forEach(m => {
    const who = m.sender === 'user' ? 'Aap' : 'AI';
    const time = formatTime(m.time || Date.now());
    content += `[${time}] ${who}:\n${cleanReply(m.text || '')}${m.imageSrc ? ' [Photo attached]' : ''}\n\n`;
  });
  const blob = new Blob([content], { type: 'text/plain' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `chat-${chat.title.replace(/[^a-z0-9]/gi, '_').toLowerCase()}.txt`;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
});

// ---------- Search within chat ----------
function renderSearchResults(query){
  const chat = getCurrentChat();
  searchResults.innerHTML = '';
  if(!query){
    searchResults.innerHTML = '<div class="empty-note">Kuch type karke dhundhna shuru karein</div>';
    return;
  }
  const q = query.toLowerCase();
  const matches = [];
  chat.displayMessages.forEach((m, idx) => {
    if(m.text && m.text.toLowerCase().includes(q)) matches.push({ m, idx });
  });
  if(matches.length === 0){
    searchResults.innerHTML = '<div class="empty-note">Kuch nahi mila</div>';
    return;
  }
  matches.forEach(({ m, idx }) => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.innerHTML = `
      <div class="search-result-meta"><span>${m.sender === 'user' ? 'Aap' : 'AI'}</span><span>${formatTime(m.time || Date.now())}</span></div>
      <div class="search-result-text"></div>
    `;
    item.querySelector('.search-result-text').textContent = cleanReply(m.text);
    item.addEventListener('click', () => {
      searchOverlay.classList.remove('open');
      scrollToMessage(idx);
    });
    searchResults.appendChild(item);
  });
}
function scrollToMessage(idx){
  const row = chatWindow.querySelector(`[data-idx="${idx}"]`);
  if(row){
    row.scrollIntoView({ behavior: 'smooth', block: 'center' });
    row.classList.add('flash');
    setTimeout(() => row.classList.remove('flash'), 1500);
  }
}
searchToggle.addEventListener('click', () => {
  searchInput.value = '';
  renderSearchResults('');
  searchOverlay.classList.add('open');
  setTimeout(() => searchInput.focus(), 200);
});
searchClose.addEventListener('click', () => searchOverlay.classList.remove('open'));
searchOverlay.addEventListener('click', (e) => { if(e.target === searchOverlay) searchOverlay.classList.remove('open'); });
searchInput.addEventListener('input', () => renderSearchResults(searchInput.value.trim()));

// ---------- Pinned messages ----------
function renderPinnedResults(){
  const chat = getCurrentChat();
  pinnedResults.innerHTML = '';
  const pinned = [];
  chat.displayMessages.forEach((m, idx) => { if(m.pinned) pinned.push({ m, idx }); });
  if(pinned.length === 0){
    pinnedResults.innerHTML = '<div class="empty-note">Abhi tak koi message pin nahi kiya</div>';
    return;
  }
  pinned.forEach(({ m, idx }) => {
    const item = document.createElement('div');
    item.className = 'search-result-item';
    item.innerHTML = `
      <div class="search-result-meta"><span>${m.sender === 'user' ? 'Aap' : 'AI'}</span><span>${formatTime(m.time || Date.now())}</span></div>
      <div class="search-result-text"></div>
    `;
    item.querySelector('.search-result-text').textContent = cleanReply(m.text);
    item.addEventListener('click', () => {
      pinnedOverlay.classList.remove('open');
      scrollToMessage(idx);
    });
    pinnedResults.appendChild(item);
  });
}
pinnedToggle.addEventListener('click', () => { renderPinnedResults(); pinnedOverlay.classList.add('open'); });
pinnedClose.addEventListener('click', () => pinnedOverlay.classList.remove('open'));
pinnedOverlay.addEventListener('click', (e) => { if(e.target === pinnedOverlay) pinnedOverlay.classList.remove('open'); });

function togglePin(idx){
  const chat = getCurrentChat();
  chat.displayMessages[idx].pinned = !chat.displayMessages[idx].pinned;
  saveChats();
  renderCurrentChat();
}

// ---------- Markdown + math rendering ----------
function escapeHtml(text){ return text.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

function renderMarkdown(raw){
  let text = raw;
  const codeBlocks = [];
  text = text.replace(/```(\w*)\n([\s\S]*?)```/g, (m, lang, code) => {
    codeBlocks.push(`<pre><code>${escapeHtml(code.trim())}</code></pre>`);
    return `%%CODEBLOCK${codeBlocks.length - 1}%%`;
  });
  text = escapeHtml(text);
  text = text.replace(/`([^`]+)`/g, '<code>$1</code>');
  text = text.replace(/^### (.*)$/gm, '<h4>$1</h4>');
  text = text.replace(/^## (.*)$/gm, '<h3>$1</h3>');
  text = text.replace(/^# (.*)$/gm, '<h2>$1</h2>');
  text = text.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
  text = text.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<i>$2</i>');

  const lines = text.split('\n');
  let html = '', listBuffer = [], listType = null;
  function flushList(){
    if(listBuffer.length){
      html += `<${listType}>${listBuffer.map(li => `<li>${li}</li>`).join('')}</${listType}>`;
      listBuffer = []; listType = null;
    }
  }
  lines.forEach(line => {
    const ulMatch = line.match(/^\s*[-*]\s+(.*)$/);
    const olMatch = line.match(/^\s*\d+\.\s+(.*)$/);
    if(ulMatch){ if(listType !== 'ul') flushList(); listType = 'ul'; listBuffer.push(ulMatch[1]); }
    else if(olMatch){ if(listType !== 'ol') flushList(); listType = 'ol'; listBuffer.push(olMatch[1]); }
    else{
      flushList();
      if(line.trim() === ''){ html += ''; }
      else if(/^<h[234]>/.test(line)){ html += line; }
      else{ html += `<p>${line}</p>`; }
    }
  });
  flushList();
  html = html.replace(/(https?:\/\/[^\s<]+)/g, '<a href="$1" target="_blank" rel="noopener">$1</a>');
  html = html.replace(/%%CODEBLOCK(\d+)%%/g, (m, i) => codeBlocks[Number(i)]);
  html = html.replace(/<p>(<pre>[\s\S]*?<\/pre>)<\/p>/g, '$1');
  return html;
}

function cleanReply(text){ return text.replace(/<think>[\s\S]*?<\/think>/gi, '').trim(); }
function formatTime(ts){ return new Date(ts).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' }); }

// ---------- Rendering messages ----------
function renderCurrentChat(){
  chatWindow.innerHTML = '';
  const chat = getCurrentChat();

  if(chat.displayMessages.length === 0){
    renderRow({ sender: 'bot', text: 'Hi! Main aapka AI assistant hoon. Pehle upar "Key" button dabakar apni Groq key daal dein. Main text sawalon ka jawab de sakta hoon, aur photo bhi dekh kar bata sakta hoon.', time: Date.now() }, false, -1);

    const promptsWrap = document.createElement('div');
    promptsWrap.className = 'suggested-prompts';
    const label = document.createElement('div');
    label.className = 'label';
    label.textContent = 'Try karke dekhein:';
    promptsWrap.appendChild(label);
    SUGGESTED_PROMPTS.forEach(p => {
      const chip = document.createElement('button');
      chip.type = 'button';
      chip.className = 'prompt-chip';
      chip.textContent = p;
      chip.addEventListener('click', () => { userInput.value = p; chatForm.requestSubmit(); });
      promptsWrap.appendChild(chip);
    });
    chatWindow.appendChild(promptsWrap);
  } else {
    chat.displayMessages.forEach((m, idx) => {
      const isLastBot = m.sender === 'bot' && idx === chat.displayMessages.length - 1;
      renderRow(m, isLastBot, idx);
    });
  }
  chatWindow.scrollTop = chatWindow.scrollHeight;
}

function renderRow(m, showRegenerate, idx){
  const row = document.createElement('div');
  row.className = `msg-row ${m.sender}`;
  if(idx !== undefined) row.dataset.idx = idx;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = m.sender === 'user' ? '🙂' : '🤖';

  const col = document.createElement('div');
  col.className = 'msg-col';

  const bubble = document.createElement('div');
  bubble.className = `msg ${m.sender}`;

  if(m.imageSrc){
    const img = document.createElement('img');
    img.src = m.imageSrc;
    img.className = 'attached';
    bubble.appendChild(img);
  }
  if(m.text){
    const content = document.createElement('div');
    if(m.pinned){
      const pinSpan = document.createElement('span');
      pinSpan.className = 'pin-badge';
      pinSpan.textContent = '📌';
      content.appendChild(pinSpan);
    }
    const inner = document.createElement('span');
    if(m.sender === 'bot'){ inner.innerHTML = renderMarkdown(cleanReply(m.text)); }
    else{ inner.textContent = m.text; }
    content.appendChild(inner);
    bubble.appendChild(content);
  }

  const meta = document.createElement('div');
  meta.className = 'msg-meta';
  const timeEl = document.createElement('span');
  timeEl.className = 'msg-time';
  timeEl.textContent = formatTime(m.time || Date.now());
  meta.appendChild(timeEl);

  const actions = document.createElement('div');
  actions.className = 'msg-actions';

  if(m.text){
    const pinBtn = document.createElement('button');
    pinBtn.type = 'button';
    pinBtn.className = 'msg-action-btn' + (m.pinned ? ' pinned' : '');
    pinBtn.innerHTML = m.pinned ? '📌 Pinned' : '📌 Pin';
    pinBtn.addEventListener('click', () => togglePin(idx));
    actions.appendChild(pinBtn);
  }

  if(m.sender === 'bot' && m.text){
    const copyBtn = document.createElement('button');
    copyBtn.type = 'button';
    copyBtn.className = 'msg-action-btn';
    copyBtn.innerHTML = '📋 Copy';
    copyBtn.addEventListener('click', () => {
      navigator.clipboard.writeText(cleanReply(m.text)).then(() => {
        copyBtn.innerHTML = '✅ Copied';
        setTimeout(() => { copyBtn.innerHTML = '📋 Copy'; }, 1500);
      });
    });
    actions.appendChild(copyBtn);

    const thumbUp = document.createElement('button');
    thumbUp.type = 'button';
    thumbUp.className = 'msg-action-btn' + (m.feedback === 'up' ? ' thumb-active' : '');
    thumbUp.innerHTML = '👍';
    thumbUp.addEventListener('click', () => {
      m.feedback = m.feedback === 'up' ? null : 'up';
      saveChats();
      renderCurrentChat();
    });
    actions.appendChild(thumbUp);

    const thumbDown = document.createElement('button');
    thumbDown.type = 'button';
    thumbDown.className = 'msg-action-btn' + (m.feedback === 'down' ? ' thumb-active' : '');
    thumbDown.innerHTML = '👎';
    thumbDown.addEventListener('click', () => {
      m.feedback = m.feedback === 'down' ? null : 'down';
      saveChats();
      renderCurrentChat();
    });
    actions.appendChild(thumbDown);

    if(showRegenerate){
      const regenBtn = document.createElement('button');
      regenBtn.type = 'button';
      regenBtn.className = 'msg-action-btn';
      regenBtn.innerHTML = '🔄 Regenerate';
      regenBtn.addEventListener('click', regenerateLast);
      actions.appendChild(regenBtn);
    }
  }

  if(m.sender === 'user' && idx !== undefined && idx >= 0){
    const editBtn = document.createElement('button');
    editBtn.type = 'button';
    editBtn.className = 'msg-action-btn';
    editBtn.innerHTML = '✏️ Edit';
    editBtn.addEventListener('click', () => startEdit(idx));
    actions.appendChild(editBtn);
  }

  if(actions.children.length) meta.appendChild(actions);

  col.appendChild(bubble);
  col.appendChild(meta);
  row.appendChild(avatar);
  row.appendChild(col);
  chatWindow.appendChild(row);

  if(m.sender === 'bot' && window.renderMathInElement){
    renderMathInElement(bubble, { delimiters: [{left:"$$",right:"$$",display:true},{left:"$",right:"$",display:false}] });
  }
  return row;
}

function showTyping(){
  const row = document.createElement('div');
  row.className = 'msg-row bot';
  row.innerHTML = `<div class="msg-avatar">🤖</div><div class="msg-col"><div class="msg bot typing"><span></span><span></span><span></span></div></div>`;
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return row;
}

// ---------- Edit message ----------
function startEdit(idx){
  const chat = getCurrentChat();
  const m = chat.displayMessages[idx];
  if(!m || m.sender !== 'user') return;
  userInput.value = m.text;
  userInput.focus();
  editingIndex = idx;
  sendBtn.title = 'Update karke bhejein';
}

// ---------- Photo attach ----------
attachBtn.addEventListener('click', () => sheetOverlay.classList.add('open'));
sheetClose.addEventListener('click', () => sheetOverlay.classList.remove('open'));
sheetOverlay.addEventListener('click', (e) => { if(e.target === sheetOverlay) sheetOverlay.classList.remove('open'); });
cameraOption.addEventListener('click', () => cameraInput.click());
galleryOption.addEventListener('click', () => galleryInput.click());

function handleFile(file){
  if(!file) return;
  const reader = new FileReader();
  reader.onload = () => {
    selectedImageBase64 = reader.result;
    previewImg.src = selectedImageBase64;
    imagePreview.style.display = 'flex';
  };
  reader.readAsDataURL(file);
  sheetOverlay.classList.remove('open');
}
cameraInput.addEventListener('change', () => handleFile(cameraInput.files[0]));
galleryInput.addEventListener('change', () => handleFile(galleryInput.files[0]));
removeImage.addEventListener('click', () => {
  selectedImageBase64 = null;
  cameraInput.value = ''; galleryInput.value = '';
  imagePreview.style.display = 'none';
});

// ---------- Voice input ----------
const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
if(SpeechRecognition){
  const recognition = new SpeechRecognition();
  recognition.lang = 'hi-IN';
  recognition.interimResults = false;
  let isListening = false;
  micBtn.addEventListener('click', () => { if(isListening){ recognition.stop(); return; } recognition.start(); });
  recognition.onstart = () => { isListening = true; micBtn.classList.add('listening'); };
  recognition.onresult = (event) => { userInput.value = event.results[0][0].transcript; saveDraft(); };
  recognition.onerror = () => { isListening = false; micBtn.classList.remove('listening'); };
  recognition.onend = () => { isListening = false; micBtn.classList.remove('listening'); };
} else {
  micBtn.style.display = 'none';
}

// ---------- Keyboard handling ----------
userInput.addEventListener('focus', () => {
  setTimeout(() => userInput.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300);
});
if(window.visualViewport){
  const appEl = document.querySelector('.app');
  window.visualViewport.addEventListener('resize', () => {
    appEl.style.height = window.visualViewport.height + 'px';
    chatWindow.scrollTop = chatWindow.scrollHeight;
  });
}

// ---------- Scroll-to-bottom button ----------
chatWindow.addEventListener('scroll', () => {
  const distanceFromBottom = chatWindow.scrollHeight - chatWindow.scrollTop - chatWindow.clientHeight;
  scrollBottomBtn.classList.toggle('show', distanceFromBottom > 200);
});
scrollBottomBtn.addEventListener('click', () => {
  chatWindow.scrollTo({ top: chatWindow.scrollHeight, behavior: 'smooth' });
});

// ---------- Send / Stop / Regenerate ----------
function setGenerating(state){
  isGenerating = state;
  if(state){ sendBtn.innerHTML = '■'; sendBtn.classList.add('stop-mode'); sendBtn.title = 'Rokein'; startTypingSound(); }
  else{ sendBtn.innerHTML = '➤'; sendBtn.classList.remove('stop-mode'); sendBtn.title = 'Bhejein'; stopTypingSound(); }
}

async function callGroq(apiKey, messages, modelToUse, signal){
  const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", "Authorization": `Bearer ${apiKey}` },
    body: JSON.stringify({
      model: modelToUse,
      messages: messages,
      reasoning_effort: modelToUse === TEXT_MODEL ? "low" : "none",
      include_reasoning: false
    }),
    signal
  });
  return response.json();
}

async function sendToModel(chat, modelToUse){
  const apiKey = apiKeyInput.value.trim();
  chat.apiMessages[0] = { role: 'system', content: buildSystemPrompt() };
  const typingEl = showTyping();
  abortController = new AbortController();
  setGenerating(true);

  const MAX_RETRIES = 2;
  let attempt = 0;
  let lastErr = null;

  while(attempt <= MAX_RETRIES){
    try{
      const data = await callGroq(apiKey, chat.apiMessages, modelToUse, abortController.signal);
      typingEl.remove();
      if(data.error){
        chat.displayMessages.push({ sender: 'bot', text: "Error: " + data.error.message, time: Date.now() });
        renderCurrentChat();
        setGenerating(false);
        abortController = null;
        return;
      }
      const reply = data.choices[0].message.content;
      chat.apiMessages.push({ role: "assistant", content: reply });
      chat.displayMessages.push({ sender: 'bot', text: reply, time: Date.now() });
      saveChats();
      renderCurrentChat();
      setGenerating(false);
      abortController = null;
      return;
    }catch(err){
      lastErr = err;
      if(err.name === 'AbortError'){
        typingEl.remove();
        chat.displayMessages.push({ sender: 'bot', text: "Jawab rok diya gaya.", time: Date.now() });
        renderCurrentChat();
        setGenerating(false);
        abortController = null;
        return;
      }
      attempt++;
      if(attempt <= MAX_RETRIES){
        await new Promise(res => setTimeout(res, 1000 * attempt)); // thoda ruk kar dobara try
      }
    }
  }

  // Sab retries fail ho gaye
  typingEl.remove();
  chat.displayMessages.push({ sender: 'bot', text: "Kuch gadbad ho gayi (network issue). " + MAX_RETRIES + " baar try kiya, phir bhi nahi hua. Apna internet connection ya API key check karein.", time: Date.now() });
  renderCurrentChat();
  setGenerating(false);
  abortController = null;
}

function regenerateLast(){
  if(isGenerating) return;
  const chat = getCurrentChat();
  if(chat.apiMessages[chat.apiMessages.length - 1].role === 'assistant') chat.apiMessages.pop();
  if(chat.displayMessages[chat.displayMessages.length - 1].sender === 'bot') chat.displayMessages.pop();
  renderCurrentChat();
  const lastUserMsg = chat.apiMessages[chat.apiMessages.length - 1];
  const modelToUse = Array.isArray(lastUserMsg.content) ? VISION_MODEL : TEXT_MODEL;
  sendToModel(chat, modelToUse);
}

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  if(isGenerating){ if(abortController) abortController.abort(); return; }

  const text = userInput.value.trim();
  const imageToSend = selectedImageBase64;
  if(!text && !imageToSend) return;

  const apiKey = apiKeyInput.value.trim();
  if(!apiKey){
    const chat = getCurrentChat();
    chat.displayMessages.push({ sender: 'bot', text: "Pehle apni Groq API key daalein (upar 'Key' button dabayein).", time: Date.now() });
    renderCurrentChat();
    keyPanel.classList.add('open');
    return;
  }

  const chat = getCurrentChat();

  if(editingIndex !== null){
    chat.displayMessages = chat.displayMessages.slice(0, editingIndex);
    let userTurnsSeen = 0, cutAt = chat.apiMessages.length;
    for(let i = 0; i < chat.apiMessages.length; i++){
      if(chat.apiMessages[i].role === 'user'){
        if(userTurnsSeen === editingIndex){ cutAt = i; break; }
        userTurnsSeen++;
      }
    }
    chat.apiMessages = chat.apiMessages.slice(0, cutAt);
    editingIndex = null;
    sendBtn.title = 'Bhejein';
  }

  if(chat.title === 'Nayi Chat' && text) chat.title = text.slice(0, 32);

  chat.displayMessages.push({ sender: 'user', text, imageSrc: imageToSend, time: Date.now() });

  let userContent, modelToUse = TEXT_MODEL;
  if(imageToSend){
    userContent = [{ type: "text", text: text || "Is image mein kya hai? Batao." }, { type: "image_url", image_url: { url: imageToSend } }];
    modelToUse = VISION_MODEL;
  } else {
    userContent = text;
  }
  chat.apiMessages.push({ role: "user", content: userContent });

  userInput.value = "";
  clearDraft();
  charCount.style.display = 'none';
  selectedImageBase64 = null;
  cameraInput.value = ''; galleryInput.value = '';
  imagePreview.style.display = 'none';

  renderCurrentChat();
  saveChats();

  await sendToModel(chat, modelToUse);
});

// ---------- Init ----------
renderCurrentChat();
loadDraft();
