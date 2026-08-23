const keyToggle = document.getElementById('keyToggle');
const keyPanel = document.getElementById('keyPanel');
const apiKeyInput = document.getElementById('apiKey');
const chatWindow = document.getElementById('chatWindow');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

const savedKey = localStorage.getItem('gemini_api_key');
if(savedKey){
  apiKeyInput.value = savedKey;
} else {
  keyPanel.classList.add('open'); // key nahi hai to shuru mein hi dikha do
}

let conversation = [];
const systemInstruction = "You are a helpful, friendly assistant. Reply concisely.";

keyToggle.addEventListener('click', () => {
  keyPanel.classList.toggle('open');
});

apiKeyInput.addEventListener('input', () => {
  const val = apiKeyInput.value.trim();
  localStorage.setItem('gemini_api_key', val);
  if(val.length > 10){
    keyPanel.classList.remove('open'); // key sahi lagi to panel band kar do
  }
});

function addMessage(text, sender){
  const div = document.createElement('div');
  div.className = `msg ${sender}`;
  div.textContent = text;
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return div;
}

function showTyping(){
  const div = document.createElement('div');
  div.className = 'msg bot typing';
  div.innerHTML = '<span></span><span></span><span></span>';
  chatWindow.appendChild(div);
  chatWindow.scrollTop = chatWindow.scrollHeight;
  return div;
}

// Keyboard khulne par input box ko view mein le aao
userInput.addEventListener('focus', () => {
  setTimeout(() => {
    userInput.scrollIntoView({ behavior: 'smooth', block: 'center' });
  }, 300);
});

chatForm.addEventListener('submit', async (e) => {
  e.preventDefault();
  const text = userInput.value.trim();
  if(!text) return;

  const apiKey = apiKeyInput.value.trim();
  if(!apiKey){
    addMessage("Pehle apni Gemini API key daalein (upar 'API Key' button dabayein).", "bot");
    keyPanel.classList.add('open');
    return;
  }

  addMessage(text, "user");
  conversation.push({ role: "user", parts: [{ text }] });
  userInput.value = "";
  sendBtn.disabled = true;

  const typingEl = showTyping();

  try{
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-3.6-flash:generateContent?key=${apiKey}`,
      {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          systemInstruction: { parts: [{ text: systemInstruction }] },
          contents: conversation
        })
      }
    );

    const data = await response.json();
    typingEl.remove();

    if(data.error){
      addMessage("Error: " + data.error.message, "bot");
      return;
    }

    const reply = data.candidates[0].content.parts[0].text;
    conversation.push({ role: "model", parts: [{ text: reply }] });
    addMessage(reply, "bot");

  }catch(err){
    typingEl.remove();
    addMessage("Kuch gadbad ho gayi. Apna internet connection ya API key check karein.", "bot");
  }finally{
    sendBtn.disabled = false;
  }
});