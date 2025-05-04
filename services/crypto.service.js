import 'dotenv/config';
import { ethers } from 'ethers';

class CryptoService {

	static provider = new ethers.providers.JsonRpcProvider('https://sepolia-rollup.arbitrum.io/rpc');

	/**
	 * Generates a new wallet and returns its address, private key, and mnemonic.
	 * @return {Promise<{address: string, privateKey: string, mnemonic: string}>}
	 */
	static async generateWallet() {
		try {
			const wallet = ethers.Wallet.createRandom();
			const connectedWallet = wallet.connect(this.provider);

			return {
				address: wallet.address,
				privateKey: wallet.privateKey,
				mnemonic: wallet.mnemonic.phrase,
			};
		} catch(error) {
			console.error('Error generating wallet:', error.message);
			throw new Error('Error generating wallet');
		}
	}

	/**
	 * Sends tokens from one wallet to another.
	 * @param {Object} walletObject - Wallet object containing private key
	 * @param {string} tokenAddress - Address of the token contract
	 * @param {string} toAddress - Address of the recipient
	 * @param {string|number} amount - Amount of tokens to send
	 * @param {number} decimals - Decimals of the token (optional)
	 * @returns {Object} - Transaction details
	 */
	static async sendToken(walletObject, tokenAddress, toAddress, amount, decimals = 18) {
		try {
			// Create a wallet instance from the provided wallet object
			const walletInstance = new ethers.Wallet(
				walletObject.privateKey,
				this.provider,
			);

			// Minimal ABI to interact with ERC20 tokens
			const erc20Abi = [
				'function transfer(address to, uint amount) returns (bool)',
				'function balanceOf(address owner) view returns (uint256)',
				'function decimals() view returns (uint8)',
				'function symbol() view returns (string)',
			];

			// Create a contract instance
			const tokenContract = new ethers.Contract(
				tokenAddress,
				erc20Abi,
				walletInstance,
			);

			// If the token address is invalid, throw an error
			let tokenDecimals = decimals;
			try {
				tokenDecimals = await tokenContract.decimals();
			} catch(error) {
				console.warn('The token address is invalid or the token does not have decimals');
			}

			// Get the token symbol
			let tokenSymbol;
			try {
				tokenSymbol = await tokenContract.symbol();
			} catch(error) {
				tokenSymbol = 'Token';
				console.warn('It was not possible to get the token symbol');
			}

			// Format the amount to send
			const amountToSend = ethers.utils.parseUnits(
				amount.toString(),
				tokenDecimals,
			);

			// Get the balance of the sender
			const balance = await tokenContract.balanceOf(walletInstance.address);
			if(balance.lt(amountToSend)) {
				throw new Error(`Saldo insuficiente de ${ tokenSymbol }`);
			}

			// Send the tokens
			const transaction = await tokenContract.transfer(toAddress, amountToSend);
			const receipt = await transaction.wait();

			return {
				success: true,
				hash: transaction.hash,
				blockNumber: receipt.blockNumber,
				tokenSymbol: tokenSymbol,
			};
		} catch(error) {
			console.error('Error sending tokens:', error.message);
			throw new Error(`Error sending tokens: ${ error.message }`);
		}
	}

	static async fundWallet(walletAddress) {

		const mxnb = await this.sendToken(
			{
				privateKey: process.env.BASE_WALLET_PRIVATE_KEY,
				address: process.env.BASE_WALLET_ADDRESS,
			},
			'0x82b9e52b26a2954e113f94ff26647754d5a4247d',
			walletAddress,
			100,
			6,
		);

		console.log('Transacción MXNB', mxnb);

		const eth = await this.sendToken(
			{
				privateKey: process.env.BASE_WALLET_PRIVATE_KEY,
				address: process.env.BASE_WALLET_ADDRESS,
			},
			'0xE71bDfE1Df69284f00EE185cf0d95d0c7680c0d4',
			walletAddress,
			0.01,
			18,
		);

		console.log('Transacción SETH', eth);

		return { mxnb, eth };
	}

	/**
	 * Gets the balance of a token for a given wallet address.
	 * @param {string} walletAddress - Wallet address to check
	 * @param {string} tokenAddress - Wallet address of the token
	 * @param {number} decimals - Decimals of the token (optional)
	 * @returns {Object} - Token balance details
	 */
	static async getTokenBalance(walletAddress, tokenAddress, decimals = null) {
		try {
			// Min. ABI to interact with ERC20 tokens
			const erc20Abi = [
				'function balanceOf(address owner) view returns (uint256)',
				'function decimals() view returns (uint8)',
				'function symbol() view returns (string)',
				'function name() view returns (string)',
			];

			// Create a contract instance
			const tokenContract = new ethers.Contract(
				tokenAddress,
				erc20Abi,
				this.provider,
			);

			// Obtener información del token
			let tokenDecimals = decimals;
			let tokenSymbol;
			let tokenName;

			try {
				// If decimals is not provided, fetch it from the contract
				if(tokenDecimals === null) {
					tokenDecimals = await tokenContract.decimals();
				}
				tokenSymbol = await tokenContract.symbol();
				tokenName = await tokenContract.name();
			} catch(error) {
				console.warn('Error getting token details:', error.message);
				tokenDecimals = tokenDecimals || 18; // Default to 18 if not specified
				tokenSymbol = 'Token';
				tokenName = 'Unknown Token';
			}

			// Get the balance of the wallet
			const balance = await tokenContract.balanceOf(walletAddress);
			const formattedBalance = ethers.utils.formatUnits(balance, tokenDecimals);

			return {
				address: tokenAddress,
				name: tokenName,
				symbol: tokenSymbol,
				decimals: tokenDecimals,
				balance: formattedBalance,
				rawBalance: balance.toString(),
			};
		} catch(error) {
			console.error('Error getting token balance:', error.message);
			throw new Error('Error getting token balance');
		}
	}
}

export default CryptoService;