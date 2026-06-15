// --- Inteligentní funkce pro nahrávání souborů (Drag & Drop) ---
const dropZone = document.getElementById('dropZone');
const fileInput = document.getElementById('fileInput');
const logInput = document.getElementById('logInput');
const fileHint = document.getElementById('fileHint');

fileHint.addEventListener('click', () => fileInput.click());

fileInput.addEventListener('change', (e) => {
    handleFiles(e.target.files);
});

dropZone.addEventListener('dragover', (e) => {
    e.preventDefault();
    dropZone.classList.add('dragover');
});

dropZone.addEventListener('dragleave', () => {
    dropZone.classList.remove('dragover');
});

dropZone.addEventListener('drop', (e) => {
    e.preventDefault();
    dropZone.classList.remove('dragover');
    handleFiles(e.dataTransfer.files);
});

function handleFiles(files) {
    if (files.length === 0) return;
    const file = files[0];
    
    const reader = new FileReader();
    reader.onload = (e) => {
        logInput.value = e.target.result;
        alert(`Soubor "${file.name}" byl úspěšně načten! Nyní klikni na tlačítko níže.`);
    };
    reader.readAsText(file);
}

// --- Hlavní analýza ---
async function analyzeLog() {
    const logText = logInput.value;
    const resultBox = document.getElementById('result');
    const aiResponseDiv = document.getElementById('aiResponse');
    const loadingDiv = document.getElementById('loading');
    const analyzeBtn = document.getElementById('analyzeBtn');

    if (!logText.trim()) {
        alert("Nejdříve vlož text logu nebo přetáhni soubor!");
        return;
    }

    loadingDiv.style.display = 'block';
    resultBox.style.display = 'none';
    analyzeBtn.disabled = true;
    analyzeBtn.innerHTML = `<i class="fa-solid fa-spinner fa-spin"></i> Analyzuji...`;

    try {
        const response = await fetch('http://127.0.0.1:8000/analyze', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ log_text: logText })
        });

        if (!response.ok) {
            throw new Error(`Chyba na API: ${response.statusText}`);
        }

        const data = await response.json();
        resultBox.style.display = 'block';
        
        // Vepíšeme první výsledek analýzy
        aiResponseDiv.innerHTML = marked.parse(data.reply);

        // Odstraníme staré chatovací rozhraní, pokud tam zbylo z minula, a vytvoříme nové čisté
        removeExistingChatUI();
        createChatUI(resultBox);

        resultBox.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        alert("Chyba spojení! Ujisti se, že v terminálu běží tvůj Python server (Uvicorn).");
        console.error(error);
    } finally {
        loadingDiv.style.display = 'none';
        analyzeBtn.disabled = false;
        analyzeBtn.innerHTML = `<i class="fa-solid fa-brain"></i> Spustit inteligentní analýzu`;
    }
}

// --- INTELIGENTNÍ DOPLNĚK: Dynamické vytvoření chatu pod výsledkem ---
function createChatUI(targetBox) {
    const chatContainer = document.createElement('div');
    chatContainer.id = 'chatContainer';
    chatContainer.style.marginTop = '24px';
    chatContainer.style.paddingTop = '20px';
    chatContainer.style.borderTop = '1px solid var(--border)';

    chatContainer.innerHTML = `
        <h4 style="margin: 0 0 10px 0; font-size: 0.95rem; color: var(--text-muted);">Nerozumíš řešení? Zeptej se na podrobnosti:</h4>
        <div id="chatHistory" style="margin-bottom: 15px; display: flex; flex-direction: column; gap: 10px;"></div>
        <div style="display: flex; gap: 10px;">
            <input type="text" id="chatInput" placeholder="Napiš svou otázku (např. 'Jak na linuxu nainstaluji Javu 17?')..." style="flex-grow: 1; background-color: var(--bg-input); color: var(--text-main); border: 1px solid var(--border); padding: 10px; border-radius: 4px; font-size: 0.9rem;">
            <button id="sendChatBtn" onclick="sendFollowUp()" style="margin: 0; padding: 10px 16px; font-size: 0.85rem;"><i class="fa-solid fa-paper-plane"></i> Odeslat</button>
        </div>
    `;
    
    targetBox.appendChild(chatContainer);

    // Aktivace odesílání stiskem klávesy Enter
    document.getElementById('chatInput').addEventListener('keypress', function(e) {
        if (e.key === 'Enter') sendFollowUp();
    });
}

function removeExistingChatUI() {
    const oldChat = document.getElementById('chatContainer');
    if (oldChat) oldChat.remove();
}

// --- Odeslání doplňující otázky ---
async function sendFollowUp() {
    const chatInput = document.getElementById('chatInput');
    const chatHistory = document.getElementById('chatHistory');
    const sendBtn = document.getElementById('sendChatBtn');
    const question = chatInput.value;

    if (!question.trim()) return;

    // Zablokujeme rozhraní během načítání zprávy
    chatInput.disabled = true;
    sendBtn.disabled = true;

    // Přidáme otázku uživatele do historie na webu
    const userMsg = document.createElement('div');
    userMsg.style.alignSelf = 'flex-end';
    userMsg.style.backgroundColor = 'var(--bg-input)';
    userMsg.style.padding = '8px 12px';
    userMsg.style.borderRadius = '6px';
    userMsg.style.fontSize = '0.9rem';
    userMsg.style.maxWidth = '80%';
    userMsg.innerHTML = `<strong>Ty:</strong> ${question}`;
    chatHistory.appendChild(userMsg);
    
    chatInput.value = '';

    // Přidáme dočasný indikátor psaní pro AI
    const typingIndicator = document.createElement('div');
    typingIndicator.style.color = 'var(--text-muted)';
    typingIndicator.style.fontSize = '0.85rem';
    typingIndicator.innerHTML = `<i class="fa-solid fa-circle-notch fa-spin"></i> AI píše odpověď...`;
    chatHistory.appendChild(typingIndicator);

    try {
        const response = await fetch('http://127.0.0.1:8000/ask', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ user_question: question })
        });

        if (!response.ok) throw new Error("Chyba při komunikaci s chatovacím API");

        const data = await response.json();
        
        // Odstraníme indikátor psaní
        typingIndicator.remove();

        // Přidáme naformátovanou odpověď AI do konverzace
        const aiMsg = document.createElement('div');
        aiMsg.style.backgroundColor = 'rgba(16, 185, 129, 0.05)';
        aiMsg.style.borderLeft = '3px solid var(--primary)';
        aiMsg.style.padding = '10px 14px';
        aiMsg.style.borderRadius = '4px';
        aiMsg.style.fontSize = '0.95rem';
        aiMsg.className = 'ai-response';
        aiMsg.innerHTML = marked.parse(data.reply);
        
        chatHistory.appendChild(aiMsg);
        aiMsg.scrollIntoView({ behavior: 'smooth' });

    } catch (error) {
        alert("Nepodařilo se získat odpověď od chatu.");
        console.error(error);
        typingIndicator.remove();
    } finally {
        chatInput.disabled = false;
        sendBtn.disabled = false;
        chatInput.focus();
    }
}