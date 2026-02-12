const BACKEND_URL = `${location.protocol}//${location.hostname}:${location.port}`;
const socket = io(BACKEND_URL);

const statusDisplay = document.getElementById('status-display');
const uidInput = document.getElementById('uid');
const amountInput = document.getElementById('amount');
const topupBtn = document.getElementById('topup-btn');
const logList = document.getElementById('log-list');
const cardVisual = document.getElementById('card-visual');
const cardUidDisplay = document.getElementById('card-uid-display');
const cardBalanceDisplay = document.getElementById('card-balance-display');

let lastScannedUid = null;

// Load saved amount from localStorage immediately
const savedAmount = localStorage.getItem('topupAmount');
if (savedAmount) {
    amountInput.value = savedAmount;
}

// Save amount to localStorage whenever it changes
amountInput.addEventListener('input', (e) => {
    if (e.target.value) {
        localStorage.setItem('topupAmount', e.target.value);
    }
});

// -------------------------------
// Socket.IO events
// -------------------------------
socket.on('connect', () => {
    addLog('Connected to backend server');
});

socket.on('card-status', (data) => {
    addLog(`Card detected: ${data.uid} | Balance: $${data.balance}`);
    lastScannedUid = data.uid;
    uidInput.value = data.uid;

    // Check if card already exists in localStorage - if yes, use saved balance
    const storedBalance = localStorage.getItem(`card_${data.uid}`);
    let balance;

    if (storedBalance) {
        // Card has been used before - use the stored balance
        balance = parseFloat(storedBalance);
        addLog(`Loaded card from localStorage: ${data.uid} | Stored Balance: $${balance.toFixed(2)}`);
    } else {
        // New card - use the balance from the device
        balance = data.balance;
        addLog(`New card: ${data.uid} | Device Balance: $${balance.toFixed(2)}`);
    }

    // Store/update card UID as key and balance as value in localStorage
    localStorage.setItem(`card_${data.uid}`, balance);

    // Update card visual
    cardVisual.classList.add('active');
    cardUidDisplay.textContent = data.uid;
    cardBalanceDisplay.textContent = `$${balance.toFixed(2)}`;

    statusDisplay.innerHTML = `
    <div class="data-row">
      <span class="data-label">UID:</span>
      <span class="data-value">${data.uid}</span>
    </div>
    <div class="data-row">
      <span class="data-label">Balance:</span>
      <span class="data-value" style="color: #6366f1;">$${balance.toFixed(2)}</span>
    </div>
    <div class="data-row">
      <span class="data-label">Status:</span>
      <span class="data-value" style="color: #4ade80;">Active</span>
    </div>
  `;

    topupBtn.disabled = false;
});

socket.on('card-balance', (data) => {
    addLog(`Balance updated for ${data.uid}: $${data.new_balance}`);

    if (data.uid === lastScannedUid) {
        cardBalanceDisplay.textContent = `$${data.new_balance.toFixed(2)}`;

        // Brief pulse effect
        cardVisual.style.transform = 'scale(1.1)';
        setTimeout(() => { cardVisual.style.transform = ''; }, 200);
    }

    statusDisplay.innerHTML += `
    <div class="data-row">
      <span class="data-label">New Balance:</span>
      <span class="data-value" style="color: #6366f1;">$${data.new_balance}</span>
    </div>
  `;
});

socket.on('topup-success', (data) => {
    // This is the confirmed balance from the server after a successful top-up
    if (data.uid === lastScannedUid) {
        addLog(`Top-up confirmed: +$${data.amount} | New Balance: $${data.newBalance}`);
        localStorage.setItem(`card_${data.uid}`, data.newBalance);
        cardBalanceDisplay.textContent = `$${data.newBalance.toFixed(2)}`;

        // Update the status display with the new balance
        statusDisplay.innerHTML = `
    <div class="data-row">
      <span class="data-label">UID:</span>
      <span class="data-value">${data.uid}</span>
    </div>
    <div class="data-row">
      <span class="data-label">Balance:</span>
      <span class="data-value" style="color: #6366f1;">$${data.newBalance.toFixed(2)}</span>
    </div>
    <div class="data-row">
      <span class="data-label">Status:</span>
      <span class="data-value" style="color: #4ade80;">Active</span>
    </div>
  `;
    }
});

// -------------------------------
// Top-up button click
// -------------------------------
topupBtn.addEventListener('click', async () => {
    const amount = parseFloat(amountInput.value);
    if (isNaN(amount) || amount <= 0) {
        alert('Please enter a valid amount');
        return;
    }

    if (!lastScannedUid) {
        alert('Please scan a card first');
        return;
    }

    try {
        // Get current balance from localStorage (source of truth for client)
        const currentBalance = parseFloat(localStorage.getItem(`card_${lastScannedUid}`) || 0);

        addLog(`Processing top-up: UID=${lastScannedUid}, Current Balance=$${currentBalance.toFixed(2)}, Amount=$${amount.toFixed(2)}`);

        const response = await fetch(`${BACKEND_URL}/topup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                uid: lastScannedUid,
                amount,
                currentBalance  // Send current balance to server
            })
        });

        const result = await response.json();
        if (result.success) {
            addLog(`Top-up request sent for ${lastScannedUid}`);
            amountInput.value = '';
            // Server will emit topup-success event with confirmed balance
        } else {
            addLog(`Error: ${result.error}`);
        }
    } catch (err) {
        addLog('Failed to connect to backend for top-up');
        console.error(err);
    }
});

// -------------------------------
// Log helper function
// -------------------------------
function addLog(message) {
    const li = document.createElement('li');
    const now = new Date();
    li.textContent = `[${now.toLocaleTimeString()}] ${message}`;
    logList.prepend(li);

    // Keep only last 20 logs
    if (logList.children.length > 20) {
        logList.removeChild(logList.lastChild);
    }
}
