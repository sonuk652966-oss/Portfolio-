const keyToggle = document.getElementById('keyToggle');
const keyPanel = document.getElementById('keyPanel');
const apiKeyInput = document.getElementById('apiKey');
const chatWindow = document.getElementById('chatWindow');
const chatForm = document.getElementById('chatForm');
const userInput = document.getElementById('userInput');
const sendBtn = document.getElementById('sendBtn');

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
    addMessage("Pehle apni Groq API key daalein (upar 'API Key' button dabayein).", "bot");
    keyPanel.classList.add('open');
    return;
  }

  addMessage(text, "user");
  conversation.push({ role: "user", content: text });
  userInput.value = "";
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
        model: "openai/gpt-oss-120b", 
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