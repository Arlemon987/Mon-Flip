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

const adminSection = document.getElementById('admin-section');
const withdrawAmountInput = document.getElementById('withdraw-amount');
const withdrawButton = document.getElementById('withdraw-button');
const withdrawStatus = document.getElementById('withdraw-status');

let provider;
let signer;
let coinFlipContract;
let currentAccount = null;

const MONAD_TESTNET_CHAIN_ID = '0x279f'; // 10143 decimal in hex

const MONAD_TESTNET_PARAMS = {
  chainId: MONAD_TESTNET_CHAIN_ID,
  chainName: 'Monad Testnet',
  nativeCurrency: {
    name: 'Monad',
    symbol: 'MON',
    decimals: 18,
  },
  rpcUrls: ['https://testnet-rpc.monad.xyz'],
  blockExplorerUrls: ['https://testnet.monadexplorer.com'],
};

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
      await checkOwnerAndToggleAdmin();
    } catch (error) {
      console.error("Balance fetch error:", error);
      walletBalanceDisplay.textContent = "Error fetching balance";
      flipButton.disabled = true;
      hideAdminSection();
    }
  } else {
    connectedAccountDisplay.textContent = "Not Connected";
    walletBalanceDisplay.textContent = "0.00 MON";
    flipButton.disabled = true;
    hideAdminSection();
  }
}

async function checkOwnerAndToggleAdmin() {
  try {
    const ownerAddress = await coinFlipContract.owner();
    if (ownerAddress.toLowerCase() === currentAccount.toLowerCase()) {
      showAdminSection();
      showMessage("Owner detected. Withdrawal enabled.", "success");
    } else {
      hideAdminSection();
    }
  } catch (error) {
    console.error("Owner check failed:", error);
    hideAdminSection();
  }
}

function showAdminSection() {
  if (adminSection) adminSection.classList.remove('hidden');
  if (withdrawButton) withdrawButton.disabled = false;
}

function hideAdminSection() {
  if (adminSection) adminSection.classList.add('hidden');
  if (withdrawButton) withdrawButton.disabled = true;
}

async function switchToMonadTestnet() {
  if (!window.ethereum) return false;

  try {
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (currentChainId === MONAD_TESTNET_CHAIN_ID) {
      return true; // Already on Monad Testnet
    }

    await window.ethereum.request({
      method: 'wallet_switchEthereumChain',
      params: [{ chainId: MONAD_TESTNET_CHAIN_ID }],
    });
    return true;

  } catch (switchError) {
    if (switchError.code === 4902) {
      try {
        await window.ethereum.request({
          method: 'wallet_addEthereumChain',
          params: [MONAD_TESTNET_PARAMS],
        });
        return true;
      } catch (addError) {
        console.error('Failed to add Monad Testnet:', addError);
        showMessage('Failed to add Monad Testnet network.', 'error');
        return false;
      }
    } else {
      console.error('Failed to switch to Monad Testnet:', switchError);
      showMessage('Failed to switch network to Monad Testnet.', 'error');
      return false;
    }
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    alert("No Ethereum wallet detected. Please install MetaMask or another wallet.");
    return;
  }

  try {
    const switched = await switchToMonadTestnet();
    if (!switched) return;

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

  } catch (error) {
    console.error("Wallet connection failed:", error);
    showMessage("Wallet connection failed or denied.", 'error');
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

// Withdraw function only accessible by owner
async function withdraw() {
  if (!coinFlipContract || !signer) {
    showMessage("Wallet not connected or contract not initialized.", 'error');
    return;
  }

  const amount = withdrawAmountInput.value;
  if (!amount || isNaN(amount) || parseFloat(amount) <= 0) {
    showMessage("Enter a valid withdrawal amount.", "error");
    return;
  }

  withdrawButton.disabled = true;
  withdrawStatus.textContent = "Processing withdrawal...";

  try {
    const tx = await coinFlipContract.withdraw(ethers.utils.parseEther(amount));
    await tx.wait();
    withdrawStatus.textContent = `Withdrawal of ${amount} MON successful!`;
    showMessage(`Withdrawal of ${amount} MON successful!`, 'success');
    withdrawAmountInput.value = "";
  } catch (error) {
    withdrawStatus.textContent = "Withdrawal failed.";
    showMessage(`Withdrawal failed: ${error.message || error}`, 'error');
    console.error(error);
  } finally {
    withdrawButton.disabled = false;
  }
}

// Event listeners
connectWalletButton.addEventListener('click', connectWallet);
disconnectWalletButton.addEventListener('click', disconnectWallet);
flipButton.addEventListener('click', flipCoin);
withdrawButton.addEventListener('click', withdraw);

// Initialize UI on page load
window.addEventListener('load', () => updateUI());
