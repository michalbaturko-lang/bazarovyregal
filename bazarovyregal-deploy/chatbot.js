// ========== REGAL BOT - Chatbot s localStorage ==========

// Načti historii z localStorage
let chatLog = JSON.parse(localStorage.getItem('regalbot_history') || '[]');
let chatContext = JSON.parse(localStorage.getItem('regalbot_context') || '{"height":null,"width":null,"depth":null,"color":null,"quantity":null,"usage":null}');

// Produktová data pro chatbot (zjednodušená verze)
const chatProducts = [
  { height: 150, width: 70, depth: 30, color: "Černá", price: 599, name: "Regál 150×70×30 cm černý", url: "regal-150x70x30-cerna.html" },
  { height: 150, width: 70, depth: 30, color: "Bílá", price: 599, name: "Regál 150×70×30 cm bílý", url: "regal-150x70x30-bila.html" },
  { height: 150, width: 70, depth: 30, color: "Červená", price: 599, name: "Regál 150×70×30 cm červený", url: "regal-150x70x30-cervena.html" },
  { height: 150, width: 70, depth: 30, color: "Zinkovaný", price: 549, name: "Regál 150×70×30 cm zinkovaný", url: "regal-150x70x30-zinkovany.html" },
  { height: 180, width: 90, depth: 40, color: "Černá", price: 739, name: "Regál 180×90×40 cm černý", url: "regal-180x90x40-cerna.html", bestseller: true },
  { height: 180, width: 90, depth: 40, color: "Bílá", price: 739, name: "Regál 180×90×40 cm bílý", url: "regal-180x90x40-bila.html" },
  { height: 180, width: 90, depth: 40, color: "Zinkovaný", price: 649, name: "Regál 180×90×40 cm zinkovaný", url: "regal-180x90x40-zinkovany.html" },
  { height: 180, width: 90, depth: 40, color: "Červená", price: 759, name: "Regál 180×90×40 cm červený", url: "regal-180x90x40-cervena.html" },
  { height: 180, width: 90, depth: 40, color: "Modrá", price: 759, name: "Regál 180×90×40 cm modrý", url: "regal-180x90x40-modra.html" },
  { height: 180, width: 60, depth: 40, color: "Černá", price: 689, name: "Regál 180×60×40 cm černý", url: "regal-180x60x40-cerna.html" },
  { height: 180, width: 40, depth: 40, color: "Černá", price: 629, name: "Regál 180×40×40 cm černý", url: "regal-180x40x40-cerna.html" },
  { height: 180, width: 40, depth: 40, color: "Zinkovaný", price: 579, name: "Regál 180×40×40 cm zinkovaný", url: "regal-180x40x40-zinkovany.html" },
  { height: 200, width: 90, depth: 40, color: "Černá", price: 849, name: "Regál 200×90×40 cm černý", url: "regal-200x90x40-cerna.html" },
  { height: 220, width: 90, depth: 45, color: "Černá", price: 899, name: "Regál 220×90×45 cm černý", url: "regal-220x90x45-cerna.html" },
  { height: 180, width: 120, depth: 50, color: "Černá", price: 1149, name: "Regál 180×120×50 cm černý", url: "regal-180x120x50-cerna.html" },
  { height: 180, width: 120, depth: 50, color: "Profesionální", price: 1249, name: "Regál 180×120×50 cm profesionální", url: "regal-180x120x50-profesionalni.html" }
];

function toggleChat() {
  const chatWindow = document.getElementById('chatWindow');
  chatWindow.classList.toggle('hidden');

  // Při otevření scrolluj dolů
  if (!chatWindow.classList.contains('hidden')) {
    const container = document.getElementById('chatMessages');
    container.scrollTop = container.scrollHeight;
  }
}

function sendMessage() {
  const input = document.getElementById('chatInput');
  const message = input.value.trim();
  if (!message) return;

  addChatMessage(message, 'user');
  chatLog.push({ role: 'user', message, time: new Date().toISOString() });
  saveChatData();
  input.value = '';

  // Simulate AI response
  setTimeout(() => {
    const response = generateAIResponse(message);
    addChatMessage(response, 'bot');
    chatLog.push({ role: 'bot', message: response, time: new Date().toISOString() });
    saveChatData();
  }, 800);
}

function quickQuestion(question) {
  document.getElementById('chatInput').value = question;
  sendMessage();
}

function addChatMessage(message, sender) {
  const container = document.getElementById('chatMessages');
  const div = document.createElement('div');
  div.className = 'flex gap-3' + (sender === 'user' ? ' flex-row-reverse' : '');

  const avatar = sender === 'user' ? '👤' : '🤖';
  const bgColor = sender === 'user' ? 'bg-primary-500 text-white rounded-tr-none' : 'bg-gray-100 rounded-tl-none';

  div.innerHTML = `
    <div class="w-8 h-8 ${sender === 'user' ? 'bg-gray-200' : 'bg-primary-100'} rounded-full flex items-center justify-center flex-shrink-0">${avatar}</div>
    <div class="${bgColor} rounded-2xl p-3 text-sm max-w-[80%]">${message}</div>
  `;

  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function saveChatData() {
  localStorage.setItem('regalbot_history', JSON.stringify(chatLog.slice(-50))); // Max 50 zpráv
  localStorage.setItem('regalbot_context', JSON.stringify(chatContext));
}

function loadChatHistory() {
  const container = document.getElementById('chatMessages');
  if (!container) return;

  // Vyčisti default zprávu pokud máme historii
  if (chatLog.length > 0) {
    container.innerHTML = '';
    chatLog.forEach(item => {
      addChatMessage(item.message, item.role);
    });
  }
}

function clearChatHistory() {
  chatLog = [];
  chatContext = { height: null, width: null, depth: null, color: null, quantity: null, usage: null };
  localStorage.removeItem('regalbot_history');
  localStorage.removeItem('regalbot_context');

  const container = document.getElementById('chatMessages');
  container.innerHTML = `
    <div class="flex gap-3">
      <div class="w-8 h-8 bg-primary-100 rounded-full flex items-center justify-center flex-shrink-0">🤖</div>
      <div class="bg-gray-100 rounded-2xl rounded-tl-none p-3 text-sm max-w-[80%]">
        Ahoj! 👋 Jsem RegálBot a pomohu vám vybrat ideální regál. Na co se chcete zeptat?
      </div>
    </div>
  `;
}

function findMatchingProduct() {
  if (chatContext.height && chatContext.width && chatContext.depth && chatContext.color) {
    const colorMap = {
      'černá': 'Černá', 'černý': 'Černá', 'cerna': 'Černá', 'cerny': 'Černá', 'black': 'Černá',
      'bílá': 'Bílá', 'bílý': 'Bílá', 'bila': 'Bílá', 'bily': 'Bílá', 'white': 'Bílá',
      'červená': 'Červená', 'červený': 'Červená', 'cervena': 'Červená', 'cerveny': 'Červená', 'red': 'Červená',
      'modrá': 'Modrá', 'modrý': 'Modrá', 'modra': 'Modrá', 'modry': 'Modrá', 'blue': 'Modrá',
      'zinkovaný': 'Zinkovaný', 'zinkovany': 'Zinkovaný', 'zink': 'Zinkovaný', 'pozink': 'Zinkovaný'
    };
    const normalizedColor = colorMap[chatContext.color.toLowerCase()] || chatContext.color;

    return chatProducts.find(p =>
      p.height === chatContext.height &&
      p.width === chatContext.width &&
      p.depth === chatContext.depth &&
      p.color === normalizedColor
    );
  }
  return null;
}

function generateAIResponse(message) {
  const msg = message.toLowerCase();

  // Detect dimensions like "180x90x40"
  const fullDimMatch = msg.match(/(\d{2,3})\s*[x×]\s*(\d{2,3})\s*[x×]\s*(\d{2,3})/);
  if (fullDimMatch) {
    chatContext.height = parseInt(fullDimMatch[1]);
    chatContext.width = parseInt(fullDimMatch[2]);
    chatContext.depth = parseInt(fullDimMatch[3]);
  }

  // Detect color
  if (msg.includes('čern') || msg.includes('cern') || msg.includes('black')) chatContext.color = 'černá';
  if (msg.includes('bíl') || msg.includes('bil') || msg.includes('white')) chatContext.color = 'bílá';
  if (msg.includes('červen') || msg.includes('cerven') || msg.includes('red')) chatContext.color = 'červená';
  if (msg.includes('modr') || msg.includes('blue')) chatContext.color = 'modrá';
  if (msg.includes('zink') || msg.includes('pozink')) chatContext.color = 'zinkovaný';

  // Detect quantity
  const qtyMatch = msg.match(/(\d+)\s*(ks|kus)/i);
  if (qtyMatch) chatContext.quantity = parseInt(qtyMatch[1]);

  // Check if we can find exact product
  const matchedProduct = findMatchingProduct();
  if (matchedProduct) {
    if (chatContext.quantity) {
      return `Skvělé! Mám pro vás: <a href="${matchedProduct.url}" class="text-primary-500 underline font-bold">${matchedProduct.name}</a> za ${matchedProduct.price} Kč/ks.<br><br>🛒 Pro ${chatContext.quantity} ks: <strong>${matchedProduct.price * chatContext.quantity} Kč</strong><br><br><a href="${matchedProduct.url}" class="inline-block bg-primary-500 text-white px-4 py-2 rounded-lg text-sm mt-2">Zobrazit detail →</a>`;
    } else {
      return `Mám pro vás: <a href="${matchedProduct.url}" class="text-primary-500 underline font-bold">${matchedProduct.name}</a> za ${matchedProduct.price} Kč.<br><br>Kolik kusů potřebujete? 🤔<br><br><a href="${matchedProduct.url}" class="inline-block bg-primary-500 text-white px-4 py-2 rounded-lg text-sm mt-2">Zobrazit detail →</a>`;
    }
  }

  // If we have partial info
  if (chatContext.height && chatContext.width && chatContext.depth && !chatContext.color) {
    const matchingProducts = chatProducts.filter(p =>
      p.height === chatContext.height &&
      p.width === chatContext.width &&
      p.depth === chatContext.depth
    );
    if (matchingProducts.length > 0) {
      const colors = [...new Set(matchingProducts.map(p => p.color))];
      return `Máme regál ${chatContext.height}×${chatContext.width}×${chatContext.depth} cm v barvách: <strong>${colors.join(', ')}</strong>.<br><br>Kterou preferujete? 🎨`;
    }
  }

  if (chatContext.color && !chatContext.height) {
    return `Skvělá volba - ${chatContext.color}! 👍<br><br>Jaké rozměry potřebujete? Máme výšky: 150, 180, 200 a 220 cm.`;
  }

  // Usage-based recommendations
  if (msg.includes('garáž') || msg.includes('garaz')) {
    return `Pro garáž doporučuji <a href="regal-180x90x40-cerna.html" class="text-primary-500 underline">černý regál 180×90×40 cm</a> - nosnost 875 kg, cena 739 Kč. 🚗<br><br>Nebo preferujete zinkovaný (odolnější vlhkosti)?`;
  }

  if (msg.includes('vlhk') || msg.includes('sklep')) {
    return `Do vlhka doporučuji <a href="regal-180x90x40-zinkovany.html" class="text-primary-500 underline">zinkovaný regál</a> - odolný korozi! 💧<br><br>Nejprodávanější je 180×90×40 cm za 649 Kč.`;
  }

  if (msg.includes('levn') || msg.includes('nejlevnější')) {
    return `Nejlevnější regál: <a href="regal-150x70x30-cerna.html" class="text-primary-500 underline">150×70×30 cm černý</a> za 599 Kč! 💰`;
  }

  if (msg.includes('nosnost') || msg.includes('těžk')) {
    return 'Všechny regály mají nosnost 175 kg/polici, celkem až 875 kg! 💪<br><br>Pro nejtěžší věci: <a href="regal-180x120x50-profesionalni.html" class="text-primary-500 underline">profesionální řada</a> s 1050 kg.';
  }

  if (msg.includes('doručení') || msg.includes('doprava')) {
    return 'Doručení do 2-3 pracovních dnů. 🚚<br>• Doprava od 99 Kč<br>• Nad 1000 Kč ZDARMA!';
  }

  if (msg.includes('záruka')) {
    return 'Záruka <strong>7 let</strong> na všechny regály! 🛡️';
  }

  if (msg.includes('montáž') || msg.includes('sestav')) {
    return 'Montáž je super jednoduchá - <strong>10 minut bez nářadí</strong>! 🔧<br><br><a href="https://youtube.com/watch?v=BBjY5IomYkk" target="_blank" class="text-primary-500 underline">Video návod</a>';
  }

  // Numbers might be quantity
  const justNumber = msg.match(/^(\d+)$/);
  if (justNumber) {
    chatContext.quantity = parseInt(justNumber[1]);
    const matchedProduct = findMatchingProduct();
    if (matchedProduct) {
      return `${chatContext.quantity} kusů <a href="${matchedProduct.url}" class="text-primary-500 underline">${matchedProduct.name}</a>:<br><br>💰 Celkem: <strong>${matchedProduct.price * chatContext.quantity} Kč</strong><br><br><a href="${matchedProduct.url}" class="inline-block bg-primary-500 text-white px-4 py-2 rounded-lg text-sm mt-2">Objednat →</a>`;
    }
    return `${chatContext.quantity} kusů, rozumím! Jaké rozměry a barvu? 📏`;
  }

  return 'Pomohu vám vybrat ideální regál! 😊<br><br>Řekněte mi:<br>• Kam ho chcete? (garáž, sklep, dílna...)<br>• Jaké rozměry? (např. 180×90×40 cm)<br>• Jakou barvu? (černá, bílá, zinkovaný...)';
}

// Inicializace při načtení stránky
document.addEventListener('DOMContentLoaded', function() {
  loadChatHistory();
});
