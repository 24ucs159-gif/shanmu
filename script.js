/**
 * NEXUS AI CHAT - script.js
 */

document.addEventListener('DOMContentLoaded', () => {
  // DOM Elements
  const sidebar = document.getElementById('sidebar');
  const sidebarToggle = document.getElementById('sidebarToggle');
  const topbarToggle = document.getElementById('topbarToggle');
  const newChatBtn = document.getElementById('newChatBtn');
  const clearBtn = document.getElementById('clearBtn');
  const chatArea = document.getElementById('chatArea');
  const welcomeScreen = document.getElementById('welcomeScreen');
  const messagesContainer = document.getElementById('messagesContainer');
  const userInput = document.getElementById('userInput');
  const sendBtn = document.getElementById('sendBtn');
  const suggestionCards = document.querySelectorAll('.suggestion-card');
  const topbarTitle = document.getElementById('topbarTitle');
  const historyList = document.getElementById('historyList');

  // App State
  let isChatActive = false;
  let isGenerating = false;
  let sessionId = generateSessionId();

  // Webhook URL provided by user
  const WEBHOOK_URL = 'https://maha1302207.app.n8n.cloud/webhook/chat';

  // --- Utility Functions ---

  function generateSessionId() {
    return Math.random().toString(36).substring(2, 15) + Math.random().toString(36).substring(2, 15);
  }

  function getTimestamp() {
    const now = new Date();
    return now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function escapeHtml(unsafe) {
    return unsafe
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;")
      .replace(/"/g, "&quot;")
      .replace(/'/g, "&#039;");
  }

  // Simple Markdown Parser
  function parseMarkdown(text) {
    if (!text) return '';
    let html = escapeHtml(text);

    // Code blocks
    html = html.replace(/```([\s\S]*?)```/g, '<div class="code-wrapper"><button class="copy-code-btn">Copy</button><pre><code>$1</code></pre></div>');
    // Inline code
    html = html.replace(/`([^`]+)`/g, '<code>$1</code>');
    // Bold
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    // Italic
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener noreferrer">$1</a>');
    // Headings
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');
    // Lists
    html = html.replace(/^\- (.*$)/gim, '<ul><li>$1</li></ul>');
    html = html.replace(/<\/ul>\n<ul>/g, '\n');
    // Paragraphs (basic)
    html = html.replace(/\n\n/g, '</p><p>');
    
    return `<p>${html}</p>`;
  }

  // --- Event Listeners ---

  // Sidebar Toggle
  const toggleSidebar = () => {
    sidebar.classList.toggle('collapsed');
  };
  sidebarToggle.addEventListener('click', toggleSidebar);
  topbarToggle.addEventListener('click', toggleSidebar);

  // Auto-resize textarea
  userInput.addEventListener('input', function() {
    this.style.height = 'auto';
    this.style.height = (this.scrollHeight) + 'px';
    
    // Enable/disable send button
    if (this.value.trim().length > 0) {
      sendBtn.removeAttribute('disabled');
    } else {
      sendBtn.setAttribute('disabled', 'true');
    }
  });

  // Handle Enter key (Shift+Enter for new line)
  userInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      if (!isGenerating && userInput.value.trim().length > 0) {
        handleSend();
      }
    }
  });

  // Send button click
  sendBtn.addEventListener('click', () => {
    if (!isGenerating && userInput.value.trim().length > 0) {
      handleSend();
    }
  });

  // Suggestion cards
  suggestionCards.forEach(card => {
    card.addEventListener('click', () => {
      const text = card.getAttribute('data-text');
      userInput.value = text;
      userInput.style.height = 'auto';
      sendBtn.removeAttribute('disabled');
      handleSend();
    });
  });

  // New Chat
  newChatBtn.addEventListener('click', startNewChat);
  clearBtn.addEventListener('click', startNewChat);

  // Copy code blocks
  messagesContainer.addEventListener('click', (e) => {
    if (e.target.classList.contains('copy-code-btn')) {
      const pre = e.target.nextElementSibling;
      const code = pre.textContent;
      navigator.clipboard.writeText(code).then(() => {
        const originalText = e.target.textContent;
        e.target.textContent = 'Copied!';
        setTimeout(() => {
          e.target.textContent = originalText;
        }, 2000);
      });
    }
  });


  // --- Core Functions ---

  function startNewChat() {
    // Hide chat, show welcome
    isChatActive = false;
    messagesContainer.innerHTML = '';
    welcomeScreen.style.display = 'flex';
    topbarTitle.textContent = 'New Chat';
    sessionId = generateSessionId();
    userInput.value = '';
    userInput.style.height = 'auto';
    sendBtn.setAttribute('disabled', 'true');
  }

  function activateChat() {
    if (!isChatActive) {
      isChatActive = true;
      welcomeScreen.style.display = 'none';
      topbarTitle.textContent = 'NexusAI Chat';
      
      // Add to history (simple demo)
      const li = document.createElement('li');
      li.className = 'history-item active';
      li.innerHTML = `
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
          <path d="M21 15a2 2 0 0 1-2 2H7l-4 4V5a2 2 0 0 1 2-2h14a2 2 0 0 1 2 2z"></path>
        </svg>
        <span>Chat ${getTimestamp()}</span>
      `;
      // Remove active class from others
      document.querySelectorAll('.history-item').forEach(el => el.classList.remove('active'));
      historyList.prepend(li);
    }
  }

  async function handleSend() {
    const text = userInput.value.trim();
    if (!text) return;

    // Reset input
    userInput.value = '';
    userInput.style.height = 'auto';
    sendBtn.setAttribute('disabled', 'true');
    
    activateChat();

    // Add User Message
    addMessageToUI(text, 'user');

    // Add Typing Indicator
    const typingIndicator = addTypingIndicator();

    isGenerating = true;
    sendBtn.classList.add('stop-mode');
    sendBtn.innerHTML = `
      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
        <rect x="6" y="6" width="12" height="12"></rect>
      </svg>
    `;

    try {
      // Send to n8n Webhook
      const response = await fetch(WEBHOOK_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        // We send both text and chatInput just in case
        body: JSON.stringify({ 
          text: text,
          chatInput: text,
          sessionId: sessionId
        })
      });

      typingIndicator.remove();

      if (!response.ok) {
        throw new Error('Network response was not ok');
      }

      const textResponse = await response.text();
      let botReply = "I received a response, but couldn't parse the format.";
      
      try {
        const data = JSON.parse(textResponse);
        if (typeof data === 'string') {
          botReply = data;
        } else if (data && data.text) {
          botReply = data.text;
        } else if (data && data.output) {
          botReply = data.output;
        } else if (Array.isArray(data) && data.length > 0) {
          botReply = data[0].text || JSON.stringify(data[0]);
        } else {
          botReply = JSON.stringify(data);
        }
      } catch (e) {
        // If it's not JSON, assume it's a plain text response
        botReply = textResponse;
      }

      addMessageToUI(botReply, 'bot');

    } catch (error) {
      console.error('Error fetching from webhook:', error);
      typingIndicator.remove();
      addMessageToUI(`Error connecting to AI: ${error.message}. Please check if your n8n webhook is active and accessible.`, 'bot', true);
    } finally {
      isGenerating = false;
      sendBtn.classList.remove('stop-mode');
      sendBtn.innerHTML = `
        <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5">
          <line x1="12" y1="19" x2="12" y2="5"/>
          <polyline points="5 12 12 5 19 12"/>
        </svg>
      `;
      // Re-evaluate send button state based on new input
      if (userInput.value.trim().length > 0) {
        sendBtn.removeAttribute('disabled');
      }
    }
  }

  function addMessageToUI(text, sender, isError = false) {
    const row = document.createElement('div');
    row.className = `message-row ${sender}`;
    
    let avatarHtml = '';
    if (sender === 'bot') {
      avatarHtml = `
        <div class="msg-avatar bot-av">
          <img src="bot_avatar.jpg" alt="AI" />
        </div>
      `;
    } else {
      avatarHtml = `
        <div class="msg-avatar user-av">U</div>
      `;
    }

    const bubbleClass = isError ? 'message-bubble error-bubble' : 'message-bubble';
    
    // Parse markdown for bot, escape for user
    const contentHtml = sender === 'bot' ? parseMarkdown(text) : `<p>${escapeHtml(text)}</p>`;

    row.innerHTML = `
      ${sender === 'bot' ? avatarHtml : ''}
      <div style="display: flex; flex-direction: column; ${sender === 'user' ? 'align-items: flex-end;' : ''} max-width: calc(100% - 45px);">
        <div class="${bubbleClass}">
          ${contentHtml}
        </div>
        <div class="msg-timestamp">${getTimestamp()}</div>
      </div>
      ${sender === 'user' ? avatarHtml : ''}
    `;

    messagesContainer.appendChild(row);
    scrollToBottom();
  }

  function addTypingIndicator() {
    const row = document.createElement('div');
    row.className = 'message-row bot';
    
    row.innerHTML = `
      <div class="msg-avatar bot-av">
        <img src="bot_avatar.jpg" alt="AI" />
      </div>
      <div class="message-bubble" style="padding: 10px 14px;">
        <div class="typing-indicator">
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
          <div class="typing-dot"></div>
        </div>
      </div>
    `;

    messagesContainer.appendChild(row);
    scrollToBottom();
    return row;
  }

  function scrollToBottom() {
    chatArea.scrollTop = chatArea.scrollHeight;
  }
});
