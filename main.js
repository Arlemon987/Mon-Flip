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

let userDisconnected = false;

const MONAD_TESTNET_CHAIN_ID = '0x279f'; // 10143 decimal in hex
const MONAD_TESTNET_PARAMS = {
  chainId: MONAD_TESTNET_CHAIN_ID,
  chainName: 'Monad Testnet',
  nativeCurrency: { name: 'Monad', symbol: 'MON', decimals: 18 },
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

async function switchToMonadTestnet() {
  if (!window.ethereum) return false;

  try {
    const currentChainId = await window.ethereum.request({ method: 'eth_chainId' });
    if (currentChainId === MONAD_TESTNET_CHAIN_ID) return true;

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

async function checkIfOwner() {
  if (!coinFlipContract || !currentAccount) {
    adminSection.classList.add('hidden');
    withdrawButton.disabled = true;
    return;
  }

  try {
    const ownerAddress = await coinFlipContract.owner();
    console.log("Contract owner:", ownerAddress);
    console.log("Current account:", currentAccount);
    if (currentAccount.toLowerCase() === ownerAddress.toLowerCase()) {
      adminSection.classList.remove('hidden');
      withdrawButton.disabled = false;
      console.log("Admin section shown");
    } else {
      adminSection.classList.add('hidden');
      withdrawButton.disabled = true;
      console.log("Admin section hidden");
    }
  } catch (error) {
    console.error("Error fetching owner:", error);
    adminSection.classList.add('hidden');
    withdrawButton.disabled = true;
  }
}

async function connectWallet() {
  if (!window.ethereum) {
    alert("No Ethereum wallet detected. Please install MetaMask or another
