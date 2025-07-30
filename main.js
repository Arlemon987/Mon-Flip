import abi from './contracts/CoinFlip.js';

const contractAddress = "0xBAA21Eb0bB1D9325A2A4046EbBb015eb45508B3f";

const connectWalletButton = document.getElementById('connect-wallet-button');
const disconnectWalletButton = document.getElementById('disconnect-wallet-button');
const connectedAccountDisplay = document.getElementById('connected-account');
const walletBalanceDisplay = document.getElementById('wallet-balance');
const coin = document.getElementById('coin');
const flipButton = document.getElementById('flip-button');
const resultDisplay = document.getElementById('result-display');
const betAmountInput = document.getElementById('bet-amount');
const guessSelect = document.getElementById('guess');
const messageBox = document.getElementById('message-box');

let provider;
let signer;
let coinFlipContract;
let currentAccount = null;

// Flag to block auto reconnect after disconnect
let userDisconnected = false;

function showMessage(message, type = 'info') {
    console.log(`[Message - ${type}]: ${message}`);
    messageBox.textContent = message;
    messageBox.className = `message-box show ${type}`;
    setTimeout(() => {
        messageBox.classList.remove('show');
    }, 5000);
}

async function updateUI() {
    if (currentAccount) {
        connectedAccountDisplay.textContent = `${currentAccount.substring(0,6)}...${currentAccount.slice(-4)}`;
        try {
            const balance = await provider.getBalance(currentAccount);
            const formatted = ethers.utils.formatEther(balance);
            walletBalanceDisplay.textContent = `${parseFloat(formatted).toFixed(4)} MON`;
            flipButton.disabled = false;
        } catch (error) {
            console.error("Balance fetch error:", error);
            walletBalanceDisplay.textContent = "Error fetching balance";
            flipButton.disabled = true;
        }
    } else {
        connectedAccountDisplay.textContent = "Not Connected";
        walletBalanceDisplay.textContent = "0.00 MON";
        flipButton.disabled = true;
    }
}

async function connectWallet() {
    if (!window.ethereum) {
        alert("No Ethereum wallet detected. Please install MetaMask or another wallet.");
        return;
    }

    try {
        // Always prompts wallet permission popup
        const accounts = await window.ethereum.request({ method: 'eth_requestAccounts' });
        if (!accounts || accounts.length === 0) throw new Error("No accounts found");

        currentAccount = accounts[0];
        provider = new ethers.providers.Web3Provider(window.ethereum);
        signer = provider.getSigner();
        coinFlipContract = new ethers.Contract(contractAddress, abi, signer);

        showMessage(`Wallet connected: ${currentAccount}`, 'success');
        await updateUI();

        disconnectWalletButton.classList.remove('hidden');
        connectWalletButton.classList.add('hidden');

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        coinFlipContract.on("FlipResult", handleFlipResult);

        // Reset flag on manual connect
        userDisconnected = false;

    } catch (error) {
        console.error("Wallet connection failed:", error);
        showMessage("Wallet connection failed or denied.", 'error');
    }
}

// Disabled auto connect on page load to require manual connect every time
async function autoConnectWallet() {
    if (userDisconnected) {
        disconnectWalletButton.classList.add('hidden');
        connectWalletButton.classList.remove('hidden');
        return updateUI();
    }

    if (!window.ethereum) return;

    try {
        provider = new ethers.providers.Web3Provider(window.ethereum);
        const accounts = await provider.listAccounts();
        if (accounts.length === 0) {
            disconnectWalletButton.classList.add('hidden');
            connectWalletButton.classList.remove('hidden');
            return updateUI();
        }

        currentAccount = accounts[0];
        signer = provider.getSigner();
        coinFlipContract = new ethers.Contract(contractAddress, abi, signer);

        showMessage(`Wallet auto-connected: ${currentAccount}`, 'success');
        await updateUI();

        disconnectWalletButton.classList.remove('hidden');
        connectWalletButton.classList.add('hidden');

        window.ethereum.on('accountsChanged', handleAccountsChanged);
        window.ethereum.on('chainChanged', handleChainChanged);

        coinFlipContract.on("FlipResult", handleFlipResult);

    } catch (error) {
        console.error("Auto connect failed:", error);
        disconnectWalletButton.classList.add('hidden');
        connectWalletButton.classList.remove('hidden');
        await updateUI();
    }
}

function handleAccountsChanged(accounts) {
    currentAccount = accounts[0] || null;
    showMessage(`Account changed to: ${currentAccount || 'None'}`, 'info');
    updateUI();

    if (!currentAccount) {
        disconnectWallet();
    }
}

function handleChainChanged() {
    window.location.reload();
}

function handleFlipResult(player, betAmount, guessedHeads, isHeads, won) {
    if (!currentAccount || player.toLowerCase() !== currentAccount.toLowerCase()) return;

    coin.classList.remove('flipping');
    coin.classList.add(isHeads ? 'heads' : 'tails');

    const result = isHeads ? 'HEADS' : 'TAILS';
    const amount = ethers.utils.formatEther(betAmount);

    setTimeout(() => {
        if (won) {
            showMessage(`Congrats! You won ${parseFloat(amount * 2).toFixed(4)} MON!`, 'success');
            resultDisplay.textContent = `It's ${result}! You WIN!`;
            resultDisplay.classList.replace('text-red-400', 'text-green-400');
        } else {
            showMessage(`Sorry, you lost ${parseFloat(amount).toFixed(4)} MON.`, 'error');
            resultDisplay.textContent = `It's ${result}! You LOSE!`;
            resultDisplay.classList.replace('text-green-400', 'text-red-400');
        }

        resultDisplay.classList.remove('hidden');
        flipButton.disabled = false;
        flipButton.textContent = 'Flip Coin';
        updateUI();
    }, 1000);
}

function disconnectWallet() {
    currentAccount = null;

    if (coinFlipContract) {
        coinFlipContract.removeAllListeners("FlipResult");
        coinFlipContract = null;
    }
    signer = null;
    provider = null;

    connectedAccountDisplay.textContent = "Not Connected";
    walletBalanceDisplay.textContent = "0.00 MON";
    flipButton.disabled = true;
    flipButton.textContent = "Flip Coin";
    resultDisplay.classList.add('hidden');
    coin.classList.remove('heads', 'tails', 'flipping');

    showMessage("Wallet disconnected.", "info");

    disconnectWalletButton.classList.add('hidden');
    connectWalletButton.classList.remove('hidden');

    if (window.ethereum && window.ethereum.removeListener) {
        window.ethereum.removeListener('accountsChanged', handleAccountsChanged);
        window.ethereum.removeListener('chainChanged', handleChainChanged);
    }

    // Set flag so no auto connect occurs after disconnect
    userDisconnected = true;
}

async function flipCoin() {
    if (!coinFlipContract || !signer) {
        showMessage("Wallet not connected or contract not initialized.", 'error');
        return;
    }

    const betAmountEth = parseFloat(betAmountInput.value);
    if (isNaN(betAmountEth) || betAmountEth <= 0) {
        showMessage('Please enter a valid bet amount.', 'error');
        return;
    }

    const betAmountWei = ethers.utils.parseEther(betAmountEth.toString());
    const userGuessIsHeads = guessSelect.value === 'heads';

    flipButton.disabled = true;
    flipButton.textContent = 'Confirming Transaction...';
    resultDisplay.classList.add('hidden');
    coin.classList.remove('heads', 'tails');
    coin.classList.add('flipping');

    try {
        showMessage('Sending transaction to blockchain...', 'info');
        console.log(`Flipping: guess=${userGuessIsHeads}, bet=${betAmountEth} MON`);

        const tx = await coinFlipContract.flip(userGuessIsHeads, { value: betAmountWei });
        showMessage(`Tx sent! Waiting... (${tx.hash.slice(0, 10)}...)`, 'info');

        flipButton.textContent = 'Waiting for Confirmation...';
        await tx.wait();

        showMessage('Transaction confirmed. Waiting for result...', 'info');
    } catch (error) {
        console.error("Flip failed:", error);
        showMessage(`Transaction failed: ${error.message || error}`, 'error');
        flipButton.disabled = false;
        flipButton.textContent = 'Flip Coin';
        coin.classList.remove('flipping');
        updateUI();
    }
}

// Event listeners
connectWalletButton.addEventListener('click', connectWallet);
disconnectWalletButton.addEventListener('click', disconnectWallet);
flipButton.addEventListener('click', flipCoin);

// NO auto connect on load, so commented out
// window.addEventListener('load', autoConnectWallet);

// Just update UI on load
window.addEventListener('load', () => updateUI());
