const keyToggle = document.getElementById('keyToggle');
const keyPanel = document.getElementById('keyPanel');
const apiKeyInput = document.getElementById('apiKey');
const chatWindow = document.getElementById('chatWindow');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');
const attachBtn = document.getElementById('attachBtn');
const imagePreview = document.getElementById('imagePreview');
const previewImg = document.getElementById('previewImg');
const removeImage = document.getElementById('removeImage');
const clearBtn = document.getElementById('clearBtn');

const sheetOverlay = document.getElementById('sheetOverlay');
const sheetClose = document.getElementById('sheetClose');
const cameraOption = document.getElementById('cameraOption');
const galleryOption = document.getElementById('galleryOption');
const cameraInput = document.getElementById('cameraInput');
const galleryInput = document.getElementById('galleryInput');

const TEXT_MODEL = "openai/gpt-oss-120b";
const VISION_MODEL = "qwen/qwen3.6-27b";

let selectedImageBase64 = null;

const savedKey = localStorage.getItem('groq_api_key');
if(savedKey){
  apiKeyInput.value = savedKey;
} else {
  keyPanel.classList.add('open');
}

let conversation = [
  { role: "system", content: "You are a helpful, friendly assistant. Reply concisely." }
];

keyToggle.addEventListener('click', () => {
  keyPanel.classList.toggle('open');
});

apiKeyInput.addEventListener('input', () => {
  const val = apiKeyInput.value.trim();
  localStorage.setItem('groq_api_key', val);
  if(val.length > 10){
    keyPanel.classList.remove('open');
  }
});

clearBtn.addEventListener('click', () => {
  conversation = [
    { role: "system", content: "You are a helpful, friendly assistant. Reply concisely." }
  ];
  chatWindow.innerHTML = '';
  addMessage("Chat clear ho gayi. Kuch bhi pooch sakte hain!", "bot");
});

attachBtn.addEventListener('click', () => {
  sheetOverlay.classList.add('open');
});
sheetClose.addEventListener('click', () => {
  sheetOverlay.classList.remove('open');
});
sheetOverlay.addEventListener('click', (e) => {
  if(e.target === sheetOverlay) sheetOverlay.classList.remove('open');
});

cameraOption.addEventListener('click', () => {
  cameraInput.click();
});
galleryOption.addEventListener('click', () => {
  galleryInput.click();
});

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
  cameraInput.value = '';
  galleryInput.value = '';
  imagePreview.style.display = 'none';
});

function addMessage(text, sender, imageSrc){
  const row = document.createElement('div');
  row.className = `msg-row ${sender}`;

  const avatar = document.createElement('div');
  avatar.className = 'msg-avatar';
  avatar.textContent = sender === 'user' ? '🙂' : '🤖';

  const bubble = document.createElement('div');
  bubble.className = `msg ${sender}`;

  if(imageSrc){
    const img = document.createElement('img');
    img.src = imageSrc;
    img.className = 'attached';
    bubble.appendChild(img);
  }
  if(text){
    const p = document.createElement('div');
    p.textContent = text;
    bubble.appendChild(p);
  }

  row.appendChild(avatar);
  row.appendChild(bubble);
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return row;
}

function showTyping(){
  const row = document.createElement('div');
  row.className = 'msg-row bot';
  row.innerHTML = `
    <div class="msg-avatar">🤖</div>
    <div class="msg bot typing"><span></span><span></span><span></span></div>
  `;
  chatWindow.appendChild(row);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return row;
}

userInput.addEventListener('focus', () => {
  setTimeout(() => {
    userInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  const imageToSend = selectedImageBase64;

  if(!text && !imageToSend) return;

  const apiKey = apiKeyInput.value.trim();
  if(!apiKey){
    addMessage("Pehle apni Groq API key daalein (upar 'API Key' button dabayein).", "bot");
    keyPanel.classList.add('open');
    return;
  }

  addMessage(text, "user", imageToSend);

  let userContent;
  let modelToUse = TEXT_MODEL;

  if(imageToSend){
    userContent = [
      { type: "text", text: text || "Is image mein kya hai? Batao." },
      { type: "image_url", image_url: { url: imageToSend } }
    ];
    modelToUse = VISION_MODEL;
  } else {
    userContent = text;
  }

  conversation.push({ role: "user", content: userContent });

  userInput.value = "";
  selectedImageBase64 = null;
  cameraInput.value = '';
  galleryInput.value = '';
  imagePreview.style.display = 'none';
  sendBtn.disabled = true;

  const typingEl = showTyping();

  try{
    const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: modelToUse,
        messages: conversation
      })
    });

    const data = await response.json();
    typingEl.remove();

    if(data.error){
      addMessage("Error: " + data.error.message, "bot");
      return;
    }

    const reply = data.choices[0].message.content;
    conversation.push({ role: "assistant", content: reply });
    addMessage(reply, "bot");

  }catch(err){
    typingEl.remove();
    addMessage("Kuch gadbad ho gayi. Apna internet connection ya API key check karein.", "bot");
  }finally{
    sendBtn.disabled = false;
  }
});

if(window.visualViewport){
  const appEl = document.querySelector('.app');
  window.visualViewport.addEventListener('resize', () => {
    appEl.style.height = window.visualViewport.height + 'px';
    chatWindow.scrollTop = chatWindow.scrollHeight;
  });
}
