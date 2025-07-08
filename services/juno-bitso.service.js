import { createHmac } from 'crypto';
import { v4 as uuidv4 } from 'uuid';

/**
 * @class JunoBitsoService
 * @description Provides static methods to interact with the Juno and Bitso APIs.
 * It handles authentication, request signing, and logging.
 * The API keys must be set in the .env file (JUNO_API_KEY, JUNO_API_SECRET, BITSO_API_KEY, BITSO_API_SECRET).
 * It also requires a JUNO_ENVIRONMENT variable set to 'stage' or 'production'.
 */
class JunoBitsoService {
	static #junoApiKey = process.env.JUNO_API_KEY;
	static #junoApiSecret = process.env.JUNO_API_SECRET;
	static #bitsoApiKey = process.env.BITSO_API_KEY;
	static #bitsoApiSecret = process.env.BITSO_API_SECRET;

	static #junoBaseUrl = process.env.JUNO_ENVIRONMENT === 'production'
		? 'https://buildwithjuno.com'
		: 'https://stage.buildwithjuno.com';

	static #bitsoBaseUrl = process.env.JUNO_ENVIRONMENT === 'production'
		? 'https://bitso.com'
		: 'https://stage.bitso.com';

	/**
	 * Creates an HMAC-SHA256 signature for the request.
	 * @param {string} apiSecret - The API secret key.
	 * @param {string} nonce - A unique number that must increase with each request.
	 * @param {string} httpMethod - The HTTP method (GET, POST, etc.).
	 * @param {string} requestPath - The path of the request.
	 * @param {string} [jsonPayload=''] - The JSON payload of the request.
	 * @returns {string} The hex-encoded signature.
	 * @private
	 */
	static #createSignature(apiSecret, nonce, httpMethod, requestPath, jsonPayload = '') {
		const data = `${ nonce }${ httpMethod }${ requestPath }${ jsonPayload }`;
		return createHmac('sha256', apiSecret).update(data).digest('hex');
	}

/**
	 * Sends a request to the specified API. Both Juno and Bitso use the same auth format.
	 * @private
	 */
	static async #sendRequest(api, endpoint, method, body = null, headers = {}) {
		const baseUrl = api === 'juno' ? this.#junoBaseUrl : this.#bitsoBaseUrl;
		const apiKey = api === 'juno' ? this.#junoApiKey : this.#bitsoApiKey;
		const apiSecret = api === 'juno' ? this.#junoApiSecret : this.#bitsoApiSecret;
		console.log("Print keys")
		console.log("API Key:", apiKey);
		console.log("API Secret:", apiSecret);
		// MEJORA: Lanzar un error claro si las claves no se cargaron del archivo .env
		if (!apiKey || !apiSecret) {
			throw new Error(`API Key or Secret not found for API: '${api}'. Check your .env file and ensure dotenv is loaded correctly.`);
		}

		const url = `${ baseUrl }${ endpoint }`;
		const nonce = Date.now().toString();
		const jsonPayload = body ? JSON.stringify(body) : '';

		const signature = this.#createSignature(apiSecret, nonce, method, endpoint, jsonPayload);

		// LÓGICA CORRECTA: Ambas APIs usan el mismo formato "Bitso".
		const authHeader = `Bitso ${ apiKey }:${ nonce }:${ signature }`;

		const options = {
			method,
			headers: {
				'Authorization': authHeader,
				'Content-Type': 'application/json',
				...headers,
			},
		};

		if(body) {
			options.body = jsonPayload;
		}

		console.log(`Sending ${ method } request to ${ url }`);
		if(body) {
			console.log('Request Body:', options.body);
		}

		try {
			const response = await fetch(url, options);
			const responseData = await response.json();
			console.log('API Response:', responseData);
			if(!response.ok) {
				throw new Error(`API Error: ${ response.status } ${ response.statusText } - ${ JSON.stringify(responseData) }`);
			}
			return responseData;
		} catch(error) {
			console.error('API Request Failed:', error);
			throw error;
		}
	}
	// --- JUNO API METHODS ---

	/**
	 * Retrieves the bank accounts registered in the Juno account for redemptions.
	 * Note: Registering bank accounts is a manual process in the Juno web portal.
	 * The API does not provide an endpoint to create them.
	 * @returns {Promise<any>} A promise resolving to a list of registered bank accounts. Can be an empty array.
	 * @example // Successful Response (with registered accounts)
	 * {
	 * "success": true,
	 * "payload": [
	 * {
	 * "id": "0b338ba9-7c3a-4a13-964b-0c0ca6bb473e",
	 * "tag": "Test-Bank-Account",
	 * "recipient_legal_name": "Jane Doe",
	 * "clabe": "646180110412345678",
	 * "ownership": "COMPANY_OWNED"
	 * }
	 * ]
	 * }
	 * @example // Successful Response (no accounts registered)
	 * {
	 * "success": true,
	 * "payload": []
	 * }
	 */
	static async retrieveBankAccounts() {
		return this.#sendRequest('juno', '/mint_platform/v1/accounts/banks', 'GET');
	}

	/**
	 * Creates a new AUTO_PAYMENT CLABE in the Juno account.
	 * Deposits made to this type of CLABE automatically trigger an issuance of MXNB.
	 * @returns {Promise<any>} A promise that resolves to an object with the new CLABE details.
	 * @example // Successful Response
	 * {
	 * "success": true,
	 * "payload": {
	 * "clabe": "710969000000401506",
	 * "type": "AUTO_PAYMENT"
	 * }
	 * }
	 * @example // Error Response
	 * {
	 * "success": false,
	 * "error": { "message": "Error message from API", "code": "ERROR_CODE" }
	 * }
	 */
	static async createJunoClabe() {
		return this.#sendRequest('juno', '/mint_platform/v1/clabes', 'POST');
	}

	// --- BITSO GENERAL & FIAT API METHODS ---

	/**
	 * Retrieves the account balance for all or a specific currency.
	 * @param {string} [currency=null] - Optional currency ticker to filter the balance.
	 * @returns {Promise<any>} The balance information.
	 * @example // Cómo llamar a la función
	 * const allBalances = await JunoBitsoService.getBitsoBalance();
	 * @example // Respuesta Exitosa (de tus logs)
	 * {
	 * "success": true,
	 * "payload": {
	 * "balances": [
	 * {
	 * "currency": "mxn",
	 * "available": "20279.66000000",
	 * "locked": "0.00000000",
	 * "total": "20279.66000000"
	 * }
	 * ]
	 * }
	 * }
	 */
	static async getBitsoBalance(currency = null) {
		const endpoint = `/api/v3/balance${ currency ? `?currency=${ currency }` : '' }`;
		return this.#sendRequest('bitso', endpoint, 'GET');
	}

	/**
	 * Lists fundings (deposits) for the Bitso account.
	 * @param {URLSearchParams} [queryParams=null] - Optional query parameters for filtering.
	 * @returns {Promise<any>} A list of fundings.
	 * @example // Cómo llamar a la función
	 * const fundings = await JunoBitsoService.listFundings(new URLSearchParams({ limit: 5 }));
	 * @example // Respuesta Exitosa (de tus logs)
	 * {
	 * "success": true,
	 * "payload": [
	 * {
	 * "fid": "3806959d9f76491cbabbb00aa3726e37",
	 * "status": "failed",
	 * "created_at": "2025-07-08T03:48:56+00:00",
	 * "currency": "mxn",
	 * "method": "praxis",
	 * "amount": "5000.00"
	 * }
	 * ]
	 * }
	 */
	static async listFundings(queryParams = null) {
		const endpoint = `/api/v3/fundings/${ queryParams ? `?${ queryParams }` : '' }`;
		return this.#sendRequest('bitso', endpoint, 'GET');
	}

	/**
	 * Retrieves details for a specific funding by its FID.
	 * @param {string} fid - The unique funding identifier.
	 * @returns {Promise<any>} The funding details.
	 * @example // Cómo llamar a la función
	 * const fundingDetails = await JunoBitsoService.getFundingDetails("3806959d9f76491cbabbb00aa3726e37");
	 * @example // Respuesta Exitosa (de tus logs)
	 * {
	 * "success": true,
	 * "payload": [
	 * {
	 * "fid": "3806959d9f76491cbabbb00aa3726e37",
	 * "status": "failed",
	 * "created_at": "2025-07-08T03:48:56+00:00",
	 * "currency": "mxn",
	 * "details": {
	 * "sender_name": "Acmess",
	 * "sender_clabe": "710969000000051901",
	 * "receive_clabe": "710969000000400646"
	 * }
	 * }
	 * ]
	 * }
	 */
	static async getFundingDetails(fid) {
		return this.#sendRequest('bitso', `/api/v3/fundings/${ fid }`, 'GET');
	}

	/**
	 * Retrieves available funding methods for a given currency.
	 * @param {string} currency - The currency ticker (e.g., 'mxn', 'btc').
	 * @returns {Promise<any>} The available funding methods and limits.
	 * @example // Cómo llamar a la función
	 * const methods = await JunoBitsoService.getFundingMethods('mxn');
	 * @example // Respuesta Exitosa (de tus logs)
	 * {
	 * "success": true,
	 * "payload": [
	 * {
	 * "method": "praxis",
	 * "name": "SPEI®",
	 * "protocol": "clabe",
	 * "network": "spei"
	 * }
	 * ]
	 * }
	 */
	static async getFundingMethods(currency) {
		return this.#sendRequest('bitso', `/api/v3/funding_methods/${ currency }`, 'GET');
	}

	/**
	 * Retrieves available withdrawal methods for a given currency.
	 * @param {string} currency - The currency ticker (e.g., 'mxn', 'btc').
	 * @returns {Promise<any>} The available withdrawal methods.
	 * @example // Cómo llamar a la función
	 * const methods = await JunoBitsoService.getWithdrawalMethods('mxn');
	 * @example // Respuesta Exitosa (de tus logs)
	 * {
	 * "success": true,
	 * "payload": [
	 * {
	 * "method": "praxis",
	 * "name": "CLABE",
	 * "protocol": "clabe",
	 * "network": "spei"
	 * },
	 * {
	 * "method": "bt",
	 * "name": "Bitso Transfer"
	 * }
	 * ]
	 * }
	 */
	static async getWithdrawalMethods(currency) {
		return this.#sendRequest('bitso', `/api/v3/withdrawal_methods/${ currency }`, 'GET');
	}

	/**
	 * Creates a fiat withdrawal (e.g., MXN, ARS).
	 * @param {object} withdrawalData - The data for the fiat withdrawal.
	 * @returns {Promise<any>} The result of the withdrawal request.
	 * @example // Successful Response
	 * {
	 * "success": true,
	 * "payload": {
	 * "wid": "8f1556bb1f583c8192c6777fbb180049",
	 * "status": "pending",
	 * "currency": "mxn",
	 * "amount": "12.34"
	 * }
	 * }
	 */
	static async createFiatWithdrawal(withdrawalData) {
		return this.#sendRequest('bitso', '/api/v3/withdrawals', 'POST', withdrawalData);
	}

	/**
	 * Lists withdrawals from the Bitso account.
	 * @param {URLSearchParams} [queryParams=null] - Optional query parameters for filtering.
	 * @returns {Promise<any>} A list of withdrawals.
	 * @example // Cómo llamar a la función
	 * const withdrawals = await JunoBitsoService.listWithdrawals(new URLSearchParams({ limit: 5 }));
	 * @example // Respuesta Exitosa (de tus logs)
	 * {
	 * "success": true,
	 * "payload": [
	 * {
	 * "wid": "51da5fc2a56ac387a68355342878e925",
	 * "status": "complete",
	 * "created_at": "2025-07-08T03:21:14+00:00",
	 * "currency": "mxn",
	 * "method": "it",
	 * "amount": "330000.75"
	 * }
	 * ]
	 * }
	 */
	static async listWithdrawals(queryParams = null) {
		const endpoint = `/api/v3/withdrawals/${ queryParams ? `?${ queryParams }` : '' }`;
		return this.#sendRequest('bitso', endpoint, 'GET');
	}

	/**
	 * Retrieves details for a specific withdrawal by its WID.
	 * @param {string} wid - The unique withdrawal identifier.
	 * @returns {Promise<any>} The withdrawal details.
	 * @example // Cómo llamar a la función
	 * const details = await JunoBitsoService.getWithdrawalDetails("51da5fc2a56ac387a68355342878e925");
	 * @example // Respuesta Exitosa (de tus logs)
	 * {
	 * "success": true,
	 * "payload": [
	 * {
	 * "wid": "51da5fc2a56ac387a68355342878e925",
	 * "status": "complete",
	 * "created_at": "2025-07-08T03:21:14+00:00",
	 * "currency": "mxn",
	 * "method_name": "Bitso Internal Transfer"
	 * }
	 * ]
	 * }
	 */
	static async getWithdrawalDetails(wid) {
		return this.#sendRequest('bitso', `/api/v3/withdrawals/${ wid }`, 'GET');
	}

	// --- BITSO CONTACTS (BENEFICIARIES) API METHODS ---

	/**
	 * Creates a new contact (beneficiary) in the Bitso account for withdrawals.
	 * This is typically used to register a destination bank account (CLABE).
	 * @param {object} contactData - The contact's information.
	 * @param {string} contactData.alias - A name to identify the account.
	 * @param {string} contactData.currency - The currency for the contact (e.g., 'mxn').
	 * @param {object} contactData.taxonomy - The taxonomy for the withdrawal method.
	 * @param {object} contactData.details - The specific details of the account, like CLABE and beneficiary name.
	 * @returns {Promise<any>} A promise that resolves to an object containing the details of the newly created contact.
	 * @example // Successful Response
	 * {
	 * "success": true,
	 * "payload": {
	 * "contact_id": 18683,
	 * "alias": "Beneficiario-Test-1751938920255",
	 * "currency": "mxn",
	 * "details": [
	 * {
	 * "name": "Beneficiary",
	 * "key": "beneficiary",
	 * "value": "Usuario De Pruebas"
	 * },
	 * {
	 * "name": "CLABE",
	 * "key": "clabe",
	 * "value": "646180110400000007"
	 * }
	 * ],
	 * "created": "2025-07-08T01:42:00Z"
	 * }
	 * }
	 * @example // Error Response
	 * {
	 * "success": false,
	 * "error": { "message": "Error message from API", "code": "ERROR_CODE" }
	 * }
	 */
	static async createContact(contactData) {
		return this.#sendRequest('bitso', '/api/v3/consumer-contacts/', 'POST', contactData);
	}

	/**
	 * Retrieves a list of all contacts (beneficiaries).
	 * @param {URLSearchParams} [queryParams=null] - Optional query parameters for filtering.
	 * @returns {Promise<any>} A list of contacts.
	 * @example // Successful Response
	 * {
	 * "success": true,
	 * "payload": [
	 * {
	 * "contact_id": 18683,
	 * "alias": "Beneficiario-Test-1751938920255",
	 * "currency": "mxn",
	 * "created": "2025-07-08T01:42:00Z"
	 * }
	 * ]
	 * }
	 */
	static async listContacts(queryParams = null) {
		const endpoint = `/api/v3/consumer-contacts/${ queryParams ? `?${ queryParams }` : '' }`;
		return this.#sendRequest('bitso', endpoint, 'GET');
	}

	// --- BITSO SPEI & CLABE MGMT API METHODS ---

	/**
	 * Lists all created CLABEs for the authenticated user.
	 * @param {URLSearchParams} [queryParams=null] - Optional query parameters.
	 * @returns {Promise<any>} The user CLABEs.
	 * @example // Successful Response
	 * {
	 * "success": true,
	 * "payload": {
	 * "total_items": "4",
	 * "response": [ { "clabe": "710969000000401496", "type": "ADDITIONAL", "status": "ENABLED" } ]
	 * }
	 * }
	 */
	static async listBitsoClabes(queryParams = null) {
		const endpoint = `/spei/v1/clabes${ queryParams ? `?${ queryParams }` : '' }`;
		return this.#sendRequest('bitso', endpoint, 'GET');
	}

	/**
	 * Creates an additional CLABE for the authenticated Bitso user.
	 * The new CLABE will be of type 'ADDITIONAL'.
	 * @returns {Promise<any>} A promise that resolves to an object containing the details of the new CLABE.
	 * @example // Successful Response
	 * {
	 * "success": true,
	 * "payload": {
	 * "clabe": "710969000000401496",
	 * "type": "ADDITIONAL",
	 * "status": "ENABLED",
	 * "created_at": "2025-07-08T01:42:01"
	 * }
	 * }
	 * @example // Error Response
	 * {
	 * "success": false,
	 * "error": { "message": "Error message from API", "code": "ERROR_CODE" }
	 * }
	 */
	static async createBitsoClabe() {
		return this.#sendRequest('bitso', '/spei/v1/clabes', 'POST');
	}

	/**
	 * Retrieves details for a specific Bitso CLABE.
	 * @param {string} clabe - The CLABE to query.
	 * @returns {Promise<any>} The CLABE details.
	 * @example // Successful Response
	 * {
	 * "success": true,
	 * "payload": {
	 * "clabe": "710969000000401496",
	 * "type": "ADDITIONAL",
	 * "status": "DISABLED",
	 * "created_at": "2025-07-08T01:42:01",
	 * "updated_at": "2025-07-08T02:01:38"
	 * }
	 * }
	 */
	static async getBitsoClabeDetails(clabe) {
		return this.#sendRequest('bitso', `/spei/v1/clabes/${ clabe }`, 'GET');
	}

	/**
	 * Sets or updates deposit limits for a specific Bitso CLABE.
	 * Replaces all limits, so all desired limits must be sent in each call. Use null for no limit.
	 * @param {string} clabe - The 18-digit CLABE to update.
	 * @param {object} limitsData - The limits configuration object.
	 * @returns {Promise<any>} The updated CLABE object with its new limits.
	 * @example // Successful Response
	 * {
	 * "success": true,
	 * "payload": {
	 * "clabe": "710969000000401496",
	 * "type": "ADDITIONAL",
	 * "status": "ENABLED",
	 * "deposit_minimum_amount": "50.00",
	 * "deposit_maximum_amounts": {
	 * "operation": "10000.00",
	 * "daily": "50000.00",
	 * "weekly": null,
	 * "monthly": "200000.00"
	 * },
	 * "updated_at": "2025-07-08T02:10:48"
	 * }
	 * }
	 */
	static async setClabeLimits(clabe, limitsData) {
		return this.#sendRequest('bitso', `/spei/v1/clabes/${ clabe }/limits`, 'PUT', limitsData);
	}

	/**
	 * Retrieves the configured deposit limits for a specific Bitso CLABE.
	 * It shows the configuration, the consumed amounts, and the available amounts for each period.
	 * @param {string} clabe - The 18-digit CLABE to query.
	 * @returns {Promise<any>} The limits configuration and consumption data.
	 * @example // Successful Response
	 * {
	 * "success": true,
	 * "payload": {
	 * "deposit": {
	 * "configuration": {
	 * "deposit_minimum_amount": "50.00",
	 * "deposit_maximum_amounts": { "operation": "10000.00", "daily": "50000.00", ... }
	 * },
	 * "consumed_amounts": { "daily": "0", "weekly": "0", "monthly": "0" },
	 * "available_amounts": { "daily": "50000.00", "monthly": "200000.00", ... }
	 * }
	 * }
	 * }
	 */
	static async getClabeLimits(clabe) {
		return this.#sendRequest('bitso', `/spei/v1/clabes/${ clabe }/limits`, 'GET');
	}

	/**
	 * Enables or disables a CLABE for the authenticated user.
	 * @param {string} clabe - The clabe to be updated.
	 * @param {'ENABLED' | 'DISABLED'} status - The status to set the CLABE to.
	 * @returns {Promise<any>} The result of the update operation.
	 * @example // Successful Response
	 * {
	 * "success": true,
	 * "payload": { "clabe": "710969000000401496", "status": "DISABLED" }
	 * }
	 */
	static async updateClabeStatus(clabe, status) {
		return this.#sendRequest('bitso', `/spei/v1/clabes/${ clabe }/status`, 'PUT', { status });
	}

	/**
	 * Retrieves the list of available order books for trading.
	 * Used to dynamically find which currencies can be converted from a base currency.
	 * @returns {Promise<any>} A promise that resolves to the API response containing a list of available books.
	 * @example // How to call
	 * const response = await JunoBitsoService.getAvailableBooks();
	 * @example // Successful Response Snippet
	 * {
	 * "success": true,
	 * "payload": [
	 * {
	 * "book": "btc_mxn",
	 * "minimum_value": "5",
	 * "maximum_value": "50000000",
	 * // ... other properties
	 * },
	 * {
	 * "book": "eth_mxn",
	 * "minimum_value": "10",
	 * "maximum_value": "200000000",
	 * // ... other properties
	 * }
	 * ]
	 * }
	 */
	static async getAvailableBooks() {
		return this.#sendRequest('bitso', '/api/v3/available_books', 'GET');
	}

	/**
	 * Retrieves trading information from a specific book.
	 * @param {string} book - The book to query (e.g., 'btc_mxn').
	 * @returns {Promise<any>} A promise that resolves with the book's ticker information.
	 * @example // How to call
	 * const ticker = await JunoBitsoService.getTicker('btc_mxn');
	 * @example // Successful Response from logs
	 * {
	 * "success": true,
	 * "payload": {
	 * "high": "2040980",
	 * "last": "2020290",
	 * "book": "btc_mxn",
	 * "volume": "364.52568876",
	 * "bid": "2019930.000000000000",
	 * "ask": "2020840.000000000000"
	 * }
	 * }
	 */
	static async getTicker(book) {
		return this.#sendRequest('bitso', `/api/v3/ticker?book=${ book }`, 'GET');
	}

	/**
	 * Retrieves a list of all open orders in a specific book.
	 * @param {string} book - The book to query (e.g., 'btc_mxn').
	 * @param {boolean} [aggregate=true] - If true, aggregates orders by price.
	 * @returns {Promise<any>} The order book data.
	 * @example // How to call
	 * const orderBook = await JunoBitsoService.getOrderBook('btc_mxn');
	 * @example // Successful Response from logs
	 * {
	 * "success": true,
	 * "payload": {
	 * "updated_at": "2025-07-08T06:59:04+00:00",
	 * "sequence": "356228469",
	 * "bids": [{"book": "btc_mxn", "price": "2019930", "amount": "0.00488293"}],
	 * "asks": [{"book": "btc_mxn", "price": "2020840", "amount": "0.01354793"}]
	 * }
	 * }
	 */
	static async getOrderBook(book, aggregate = true) {
		return this.#sendRequest('bitso', `/api/v3/order_book?book=${ book }&aggregate=${ aggregate }`, 'GET');
	}

	/**
	 * Places a trading order (buy/sell).
	 * @param {object} orderData - The data for the order.
	 * @returns {Promise<any>} A promise that resolves with the oid of the placed order.
	 * @example // How to call
	 * const newOrder = await JunoBitsoService.placeOrder({
	 * book: 'btc_mxn',
	 * side: 'buy',
	 * type: 'limit',
	 * major: '0.0001',
	 * price: '1009965.00'
	 * });
	 * @example // Successful Response from logs
	 * {
	 * "success": true,
	 * "payload": {
	 * "oid": "e8lqW899AhwjKMXv"
	 * }
	 * }
	 */
	static async placeOrder(orderData) {
		return this.#sendRequest('bitso', '/api/v3/orders', 'POST', orderData);
	}

	/**
	 * Retrieves a list of the user's open orders.
	 * @param {URLSearchParams} [queryParams=null] - Optional query parameters for filtering.
	 * @returns {Promise<any>} A promise that resolves with a list of open orders.
	 * @example // How to call
	 * const openOrders = await JunoBitsoService.listOpenOrders();
	 * @example // Successful Response from logs
	 * {
	 * "success": true,
	 * "payload": [
	 * {
	 * "unfilled_amount": "0.00010000",
	 * "book": "btc_mxn",
	 * "created_at": "2025-07-08T06:59:04+00:00",
	 * "oid": "e8lqW899AhwjKMXv",
	 * "status": "open"
	 * }]
	 * }
	 */
	static async listOpenOrders(queryParams = null) {
		const endpoint = `/api/v3/open_orders${ queryParams ? `?${ queryParams }` : '' }`;
		return this.#sendRequest('bitso', endpoint, 'GET');
	}

	/**
	 * Retrieves the details of one or more specific orders by their IDs.
	 * @param {string[]} oids - An array of Bitso-supplied order IDs.
	 * @returns {Promise<any>} A list of the specified orders.
	 * @example // How to call
	 * const specificOrder = await JunoBitsoService.lookupOrders(['e8lqW899AhwjKMXv']);
	 * @example // Successful Response from logs
	 * {
	 * "success": true,
	 * "payload": [
	 * {
	 * "oid": "e8lqW899AhwjKMXv",
	 * "book": "btc_mxn",
	 * "original_amount": "0.0001",
	 * "status": "open"
	 * }]
	 * }
	 */
	static async lookupOrders(oids) {
		const oidsString = oids.join(',');
		return this.#sendRequest('bitso', `/api/v3/orders?oids=${ oidsString }`, 'GET');
	}

	/**
	 * Cancels one or more open orders.
	 * @param {string[]} oids - An array of Bitso-supplied order IDs to cancel.
	 * @returns {Promise<any>} A promise that resolves with an array of the cancelled order IDs.
	 * @example // How to call
	 * const cancelled = await JunoBitsoService.cancelOrders(['e8lqW899AhwjKMXv']);
	 * @example // Successful Response from logs
	 * {
	 * "success": true,
	 * "payload": [
	 * "e8lqW899AhwjKMXv"
	 * ]
	 * }
	 */
	static async cancelOrders(oids) {
		const oidsString = oids.join(',');
		const endpoint = oidsString === 'all' ? '/api/v3/orders/all' : `/api/v3/orders/${ oidsString }`;
		return this.#sendRequest('bitso', endpoint, 'DELETE');
	}

	/**
	 * Retrieves information on customer and withdrawal fees.
	 * @returns {Promise<any>} A promise that resolves with a detailed fee structure object.
	 * @example // How to call
	 * const fees = await JunoBitsoService.getFees();
	 * @example // Successful Response from logs
	 * {
	 * "success": true,
	 * "payload": {
	 * "fees": [{"book": "btc_mxn", "fee_percent": "0.6500", ...}],
	 * "deposit_fees": [{"currency": "mxn", "method": "spei", ...}],
	 * "withdrawal_fees": {"btc": "0.00000000", "mxn": "1.00", ...}
	 * }
	 * }
	 */
	static async getFees() {
		return this.#sendRequest('bitso', '/api/v3/fees', 'GET');
	}

	/**
	 * Retrieves a list of the user's trades for a specific book.
	 * @param {string} book - The book to query trades from (e.g., 'btc_mxn').
	 * @param {URLSearchParams} [queryParams=null] - Optional query parameters.
	 * @returns {Promise<any>} A list of user trades.
	 * @example // How to call
	 * const trades = await JunoBitsoService.listUserTrades('btc_mxn', new URLSearchParams({limit: 5}));
	 * @example // Successful Response from logs (empty because no trades were made)
	 * {
	 * "success": true,
	 * "payload": []
	 * }
	 */
	static async listUserTrades(book, queryParams = null) {
		const endpoint = `/api/v3/user_trades?book=${ book }${ queryParams ? `&${ queryParams }` : '' }`;
		return this.#sendRequest('bitso', endpoint, 'GET');
	}

	/**
	 * Requests a quote for a currency conversion. The quote is valid for 30 seconds.
	 * @param {object} quoteData - The data for the quote request.
	 * @param {string} quoteData.from_currency - The currency to convert from (e.g., 'mxn').
	 * @param {string} quoteData.to_currency - The currency to convert to (e.g., 'xrp').
	 * @param {string} quoteData.spend_amount - The amount of 'from_currency' to convert.
	 * @returns {Promise<any>} A promise that resolves with the conversion quote details, including the quote ID.
	 * @example // How to call
	 * const quote = await JunoBitsoService.requestConversionQuote({
	 * from_currency: "mxn",
	 * to_currency: "xrp",
	 * spend_amount: "100.00"
	 * });
	 * @example // Successful Response from logs
	 * {
	 * "success": true,
	 * "payload": {
	 * "id": "I9Zip22hsdUoY48s",
	 * "from_amount": "100.00000000",
	 * "from_currency": "mxn",
	 * "to_amount": "2.33505936",
	 * "to_currency": "xrp",
	 * "created": 1751948306378,
	 * "expires": 1751948336378,
	 * "rate": "42.83",
	 * "plain_rate": "42.18"
	 * }
	 * }
	 */
	static async requestConversionQuote(quoteData) {
		return this.#sendRequest('bitso', '/api/v4/currency_conversions', 'POST', quoteData);
	}

	/**
	 * Executes a previously requested currency conversion quote.
	 * @param {string} quoteId - The ID of the quote to execute, obtained from `requestConversionQuote`.
	 * @returns {Promise<any>} A promise that resolves with the execution confirmation, containing the conversion's order ID (oid).
	 * @example // How to call
	 * const execution = await JunoBitsoService.executeConversion("I9Zip22hsdUoY48s");
	 * @example // Successful Response from logs
	 * {
	 * "success": true,
	 * "payload": {
	 * "oid": "342465"
	 * }
	 * }
	 */
	static async executeConversion(quoteId) {
		return this.#sendRequest('bitso', `/api/v4/currency_conversions/${ quoteId }`, 'PUT');
	}

	/**
	 * Retrieves the details and status of a specific currency conversion. Used for polling.
	 * @param {string} conversionId - The order ID (`oid`) of the conversion, obtained from `executeConversion`.
	 * @returns {Promise<any>} The details and status of the conversion.
	 * @example // How to call
	 * const details = await JunoBitsoService.getConversionDetails("342465");
	 * @example // Successful Response from logs (when completed)
	 * {
	 * "success": true,
	 * "payload": {
	 * "id": "342465",
	 * "from_amount": "100.00000000",
	 * "from_currency": "mxn",
	 * "to_amount": "2.33505936",
	 * "to_currency": "xrp",
	 * "status": "completed"
	 * // ... other properties
	 * }
	 * }
	 */
	static async getConversionDetails(conversionId) {
		return this.#sendRequest('bitso', `/api/v4/currency_conversions/${ conversionId }`, 'GET');
	}

	/**

	 * Creates a mock MXN deposit in the Juno testing environment.

	 *

	 * In test scenarios, you typically only change the amount and the destination clabe.

	 * The other parameters can usually remain fixed.

	 *

	 * @param {object} depositData - The data for the mock deposit.

	 * @param {string} depositData.amount - The amount to deposit. **(Variable)**

	 * @param {string} depositData.receiver_clabe - The 18-digit Juno CLABE that will receive the funds. **(Variable)**

	 * @param {string} depositData.receiver_name - The name of your Juno account. Usually the same in all your tests. **(Fixed)**

	 * @param {string} depositData.sender_name - A simulated sender name. Can always be the same, e.g., 'Banco de Pruebas'. **(Fixed)**

	 * @param {string} depositData.sender_clabe - A sender CLABE with a valid format. Can always be the same for tests, e.g., '646180110400000007'. **(Fixed)**

	 * @returns {Promise<any>} The result of the mock deposit.

	 * @example // How to call the function

	 * JunoBitsoService.createMockDeposit({

	 * // --- DATA THAT YOU CHANGE ---

	 * amount: "500.00",

	 * receiver_clabe: "710969000000401506", // The CLABE you want to fund

	 *

	 * // --- DATA THAT CAN BE FIXED IN YOUR TESTS ---

	 * receiver_name: "Your Juno Account Name", // Your entity's name

	 * sender_name: "Banco de Pruebas SPEI",

	 * sender_clabe: "646180110400000007"

	 * })

	 * * @example // Successful Response

	 * {

	 * "success": true,

	 * "payload": {

	 * "amount": "500.00",

	 * "tracking_code": "TESTSPEI788741751940098737",

	 * "receiver_clabe": "710969000000401506",

	 * "created_at": "2025-07-08T02:01:38"

	 * }

	 * }

	 */

	static async createMockDeposit(depositData) {

		return this.#sendRequest('juno', '/spei/test/deposits', 'POST', depositData);

	}

	/**
	 * Requests a security token for money transmitter operations.
	 * @returns {Promise<any>} A promise that resolves to the security token.
	 * @example // How to call the function
	 * const response = await JunoBitsoService.getSecurityToken();
	 * @example // Successful Response (based on documentation)
	 * {
	 * "success": true,
	 * "payload": {
	 * "token": "4ed7a6c8-a0ab-49e9-9220-28ded3f8b1bd"
	 * }
	 * }
	 * @example // Common Error Response (from your logs)
	 * {
	 * "success": false,
	 * "error": {
	 * "code": "1005",
	 * "default_message": "The user must be a Money Transmitter. Contact your sales representative."
	 * }
	 * }
	 */
	static async getSecurityToken() {
		return this.#sendRequest('bitso', '/api/v3/payments/usd/bridge/security-tokens', 'POST');
	}

	// --- BITSO INTERNATIONAL PAYMENTS & MONEY TRANSMITTER API METHODS ---

	/**
	 * Sets the `bridge_terms_and_conditions_accepted` flag to true for the user.
	 * @returns {Promise<any>} A promise that resolves to the user's updated settings flags.
	 * @example // How to call the function
	 * const response = await JunoBitsoService.setBridgeTermsFlag();
	 * @example // Successful Response (from your logs)
	 * {
	 * "success": true,
	 * "payload": {
	 * "risk_warning_crypto_accepted": true,
	 * "bridge_terms_and_conditions_accepted": true,
	 * "has_balance_debt": false
	 * }
	 * }
	 */
	static async setBridgeTermsFlag() {
		const body = { 'bridge_terms_and_conditions_accepted': true };
		return this.#sendRequest('bitso', '/api/v3/settings/flags', 'POST', body);
	}

	/**
	 * Initiates the customer onboarding process for USD/SEPA transfers.
	 * @returns {Promise<any>} A promise that resolves to the onboarding initiation response.
	 * @example // How to call the function
	 * const response = await JunoBitsoService.customerOnboarding();
	 * @example // Successful Response (based on documentation)
	 * {
	 * "success": true,
	 * "payload": {
	 * "account": {
	 * "id": "525e2302-7345-4ff5-8c51-bd478cfce7ed",
	 * "account_status": "STARTED"
	 * }
	 * }
	 * }
	 * @example // Common Error Response (from your logs)
	 * {
	 * "success": false,
	 * "error": {
	 * "code": "712",
	 * "default_message": "There was an error creating your account. Try again or contact Support."
	 * }
	 * }
	 */
	static async customerOnboarding() {
		return this.#sendRequest('bitso', '/api/v3/payments/usd/bridge/onboarding', 'POST');
	}

	/**
	 * Registers an external bank account for USD wire or SEPA transfers.
	 * @param {object} accountData - The bank account details, including type, address, and owner info.
	 * @returns {Promise<any>} A promise that resolves to the registered account details.
	 * @example // How to call the function
	 * const accountData = {
	 * bank_name: "Test Bank of America",
	 * account_owner_name: "Juan Probador",
	 * account_number: "1234567890123456",
	 * routing_number: "026009593",
	 * type: "wire",
	 * address: { ... }
	 * };
	 * const response = await JunoBitsoService.registerBankAccount(accountData);
	 * @example // Common Error Response (from your logs)
	 * {
	 * "success": false,
	 * "error": {
	 * "code": "349",
	 * "default_message": "This bank account has already been added for this customer."
	 * }
	 * }
	 */
	static async registerBankAccount(accountData) {
		return this.#sendRequest('bitso', '/api/v3/payments/usd/bridge/external-accounts', 'POST', accountData);
	}

	/**
	 * Lists all registered external bank accounts for the user.
	 * @returns {Promise<any>} A promise that resolves to a list of bank accounts.
	 * @example // How to call the function
	 * const response = await JunoBitsoService.listRegisteredBankAccounts();
	 * @example // Successful Response (from your logs)
	 * {
	 * "success": true,
	 * "payload": [
	 * {
	 * "active": true,
	 * "id": "584d4277-2b6f-4328-915e-546c8f970a81",
	 * "bank_name": "Test Bank of America",
	 * "last_4": "3456",
	 * "account_owner_name": "Juan Probador"
	 * }
	 * ]
	 * }
	 */
	static async listRegisteredBankAccounts() {
		return this.#sendRequest('bitso', '/api/v3/payments/usd/bridge/external-accounts', 'GET');
	}

	/**
	 * Creates a deposit intent for a USD wire transfer.
	 * @param {object} intentData - The intent data, containing the amount.
	 * @returns {Promise<any>} A promise that resolves to the deposit intent details, including bank info.
	 * @example // How to call the function
	 * const response = await JunoBitsoService.createUsdWireDepositIntent({ amount: "100.00" });
	 * @example // Successful Response (from your logs)
	 * {
	 * "success": true,
	 * "payload": {
	 * "id": "e69070a0-c3db-4f1d-9cba-75a8f1bfb2b4",
	 * "status": "pending",
	 * "amount": 100,
	 * "bank": {
	 * "name": "Bank of Nowhere",
	 * "routing_number": "123456789",
	 * "account_number": "11223344556677",
	 * "beneficiary_name": "Bridge Ventures Inc"
	 * },
	 * "deposit_message": "BRGZSPX36U29ZGPVJ539"
	 * }
	 * }
	 */
	static async createUsdWireDepositIntent(intentData) {
		return this.#sendRequest('bitso', '/api/v3/payments/usd/bridge/deposit-intents', 'POST', intentData);
	}

	/**
	 * Creates a deposit intent for a SEPA transfer.
	 * @param {object} intentData - The intent data, containing amount and protocol ('sepa').
	 * @returns {Promise<any>} A promise that resolves to the SEPA deposit intent details.
	 * @example // How to call the function
	 * const response = await JunoBitsoService.createSepaDepositIntent({ amount: "100.00", protocol: "sepa" });
	 * @example // Successful Response (from your logs)
	 * {
	 * "success": true,
	 * "payload": {
	 * "id": "edc1fb25-e74e-4c3c-90d0-9a40abf3ef85",
	 * "status": "pending",
	 * "amount": 100,
	 * "bank": {
	 * "name": "Bank of Nowhere",
	 * "beneficiary_name": "Bridge Building Sp.z.o.o.",
	 * "iban": "GB63MOCK00000003615430",
	 * "bic": "MOCKGB21"
	 * },
	 * "deposit_message": "BRGXM27JHJDY4CZ9TAFE"
	 * }
	 * }
	 */
	static async createSepaDepositIntent(intentData) {
		return this.#sendRequest('bitso', '/api/v3/payments/usd/bridge/deposit-intents', 'POST', intentData);
	}

	/**
	 * Creates a withdrawal via Bitso Transfer to an email or phone number.
	 * @param {object} transferData - The transfer details, including currency, amount, and email/phone.
	 * @returns {Promise<any>} A promise that resolves to the withdrawal confirmation.
	 * @example // How to call the function
	 * const transferData = { currency: 'mxn', amount: '1.50', email: 'test-recipient@bitso.com' };
	 * const response = await JunoBitsoService.createBitsoTransfer(transferData);
	 * @example // Common Error Response (from your logs)
	 * {
	 * "success": false,
	 * "error": {
	 * "code": "0304",
	 * "message": "El correo ingresado no corresponde a ningún usuario"
	 * }
	 * }
	 */
	static async createBitsoTransfer(transferData) {
		const body = { ...transferData, method: 'bt', network: 'bt', protocol: 'bt', asset: transferData.currency };
		return this.#sendRequest('bitso', '/api/v3/withdrawals', 'POST', body);
	}

	/**
	 * Retrieves the catalog of registered VASPs for Travel Rule purposes.
	 * @returns {Promise<any>} A promise that resolves to the list of VASPs.
	 * @example // How to call the function
	 * const response = await JunoBitsoService.getVasps();
	 * @example // Successful Response (from your logs)
	 * {
	 * "success": true,
	 * "payload": [
	 * {
	 * "id": "did:ethr:0x59ad3fb48eaf11aa7340b5af20b2e71a832283d4",
	 * "name": "Bitbond"
	 * }
	 * ]
	 * }
	 */
	static async getVasps() {
		return this.#sendRequest('bitso', '/api/v3/vasps', 'GET');
	}

	/**
	 * Registers a webhook URL for receiving notifications.
	 * @param {string} url - The public URL to be registered as a webhook.
	 * @returns {Promise<any>} A promise that resolves to the registration confirmation.
	 * @example // How to call the function
	 * const url = 'https://my-test-app.com/webhooks/bitso';
	 * const response = await JunoBitsoService.registerWebhook(url);
	 * @example // Successful Response (from your logs)
	 * {
	 * "success": true,
	 * "payload": "Successfully registered URL: https://my-test-app.com/webhooks/bitso"
	 * }
	 */
	static async registerWebhook(url) {
		const body = { callback_url: url };
		return this.#sendRequest('bitso', '/api/v3/webhooks/', 'POST', body);
	}

	/**
	 * Previews a BRL (Brazilian Real) withdrawal via Pix.
	 * @param {object} previewData - The preview details, including taxonomy and identifier (Pix key).
	 * @returns {Promise<any>} A promise that resolves to the withdrawal preview.
	 * @example // How to call the function
	 * const pixData = {
	 * taxonomy: { currency: "brl", protocol: "pix_ind" },
	 * identifier: { pix_key: "1a71...4d52", pix_key_type: "EVP" }
	 * };
	 * const response = await JunoBitsoService.previewBrlWithdrawal(pixData);
	 * @example // Common Error Response (from your logs)
	 * {
	 * "success": false,
	 * "error": {
	 * "message": "User does not have a Brazilian document",
	 * "code": "2010"
	 * }
	 * }
	 */
	static async previewBrlWithdrawal(previewData) {
		return this.#sendRequest('bitso', '/api/v3/withdrawal/preview', 'POST', previewData);
	}

	/**
	 * Creates a one-time payment request via SPEI.
	 * @param {object} paymentData - The payment details, including amount, payer_name, and a unique payment_id.
	 * @returns {Promise<any>} A promise that resolves to the payment request details, including the CLABE.
	 * @example // How to call the function
	 * const paymentData = {
	 * amount: "150.75",
	 * payer_name: "Test Customer",
	 * payment_id: `test-payment-${Date.now()}`
	 * };
	 * const response = await JunoBitsoService.createOneTimePayment(paymentData);
	 * @example // Successful Response (from your logs)
	 * {
	 * "success": true,
	 * "payload": {
	 * "payment_id": "test-payment-1751962197347",
	 * "amount": "150.75",
	 * "payer_name": "Cliente de Prueba",
	 * "expiration_date": "2025-07-11",
	 * "clabe": "710969000000401739",
	 * "beneficiary": "Jesus Lopez Batallar",
	 * "status": "PENDING"
	 * }
	 * }
	 */
	static async createOneTimePayment(paymentData) {
		return this.#sendRequest('spei', '/spei/v1/payments', 'POST', paymentData);
	}

	/**
	 * Retrieves the details of a specific one-time payment.
	 * @param {string} paymentId - The unique ID of the payment.
	 * @returns {Promise<any>} A promise that resolves to the detailed payment information.
	 * @example // How to call the function
	 * const paymentId = 'test-payment-1751962197347';
	 * const response = await JunoBitsoService.getOneTimePaymentDetails(paymentId);
	 * @example // Successful Response (from your logs)
	 * {
	 * "success": true,
	 * "payload": {
	 * "payment_id": "test-payment-1751962197347",
	 * "amount": "150.75",
	 * "status": "PENDING",
	 * "details": {
	 * "fid": null,
	 * "tracking_key": null,
	 * "payer_clabe": null
	 * },
	 * "created_at": "2025-07-08T08:09:57"
	 * }
	 * }
	 */
	static async getOneTimePaymentDetails(paymentId) {
		return this.#sendRequest('spei', `/spei/v1/payments/${ paymentId }`, 'GET');
	}

	/**
	 * Lists one-time payments with pagination.
	 * @param {URLSearchParams} [params] - Optional query parameters for pagination (e.g., limit).
	 * @returns {Promise<any>} A promise that resolves to a paginated list of payments.
	 * @example // How to call the function
	 * const params = new URLSearchParams({ limit: 5 });
	 * const response = await JunoBitsoService.listOneTimePayments(params);
	 * @example // Successful Response (from your logs)
	 * {
	 * "success": true,
	 * "payload": {
	 * "total_items": "2",
	 * "total_pages": "1",
	 * "current_page": "1",
	 * "response": [
	 * {
	 * "payment_id": "test-payment-1751962197347",
	 * "amount": "150.75",
	 * "status": "PENDING"
	 * }
	 * ]
	 * }
	 * }
	 */
	static async listOneTimePayments(params) {
		const endpoint = params ? `/spei/v1/payments?${ params.toString() }` : '/spei/v1/payments';
		return this.#sendRequest('spei', endpoint, 'GET');
	}

	/**
	 * Lists SPEI deposits with pagination.
	 * @param {URLSearchParams} [params] - Optional query parameters for pagination (e.g., limit).
	 * @returns {Promise<any>} A promise that resolves to a paginated list of SPEI deposits.
	 * @example // How to call the function
	 * const params = new URLSearchParams({ limit: 5 });
	 * const response = await JunoBitsoService.listSpeiDeposits(params);
	 * @example // Successful Response (from your logs)
	 * {
	 * "success": true,
	 * "payload": {
	 * "total_items": "29",
	 * "total_pages": "2",
	 * "response": [
	 * {
	 * "fid": "...",
	 * "deposit_id": "...",
	 * "sender_clabe": "...",
	 * "status": "COMPLETE",
	 * "amount": "10.00",
	 * "details": {
	 * "sender_name": "...",
	 * "clave_rastreo": "..."
	 * }
	 * }
	 * ]
	 * }
	 * }
	 */
	static async listSpeiDeposits(params) {
		const endpoint = params ? `/spei/v1/deposits?${ params.toString() }` : '/spei/v1/deposits';
		return this.#sendRequest('spei', endpoint, 'GET');
	}

	/**
	 * Partially updates an existing withdrawal contact.
	 * @param {string|number} contactId - The ID of the contact to update.
	 * @param {object} patchData - The data to update (e.g., { alias: "New Alias" }).
	 * @returns {Promise<any>} A promise that resolves to the updated contact's information.
	 * @example // How to call the function
	 * const response = await JunoBitsoService.patchContact(18686, { alias: "New Alias" });
	 * @example // Common Error Response (from your logs)
	 * {
	 * "success": false,
	 * "error": {
	 * "message": "Check your credentials",
	 * "code": "0215"
	 * }
	 * }
	 */
	static async patchContact(contactId, patchData) {
		return this.#sendRequest('bitso', `/api/v3/consumer-contacts/${ contactId }`, 'PATCH', patchData);
	}

	/**
	 * Deletes a withdrawal contact.
	 * @param {string|number} contactId - The ID of the contact to delete.
	 * @returns {Promise<any>} A promise that resolves to the deletion confirmation.
	 * @example // Successful Response
	 * {
	 * "success": true,
	 * "payload": {}
	 * }
	 */
	static async deleteContact(contactId) {
		return this.#sendRequest('bitso', `/api/v3/consumer-contacts/${ contactId }`, 'DELETE');
	}

	/**
	 * Creates a Bitcoin (BTC) withdrawal.
	 * @param {object} withdrawalData - The withdrawal details, including amount and address.
	 * @returns {Promise<any>} A promise that resolves to the withdrawal confirmation.
	 * @example // How to call the function
	 * const btcData = { amount: '0.00005', address: 'tb1q...e7w2d' };
	 * const response = await JunoBitsoService.createBtcWithdrawal(btcData);
	 * @example // Successful Response (based on documentation)
	 * {
	 * "success": true,
	 * "payload": {
	 * "wid": "a1b2c3d4e5f6g7h8i9j0",
	 * "status": "pending",
	 * "created_at": "2024-01-01T12:00:00+00:00",
	 * "currency": "btc",
	 * "method": "btc",
	 * "amount": "0.00005",
	 * "details": {
	 * "withdrawal_address": "tb1q...e7w2d",
	 * "tx_hash": null
	 * }
	 * }
	 * }
	 * @example // Common Error Response (from your logs)
	 * {
	 * "success": false,
	 * "error": {
	 * "code": "0601",
	 * "message": "El retiro supera tu balance disponible. Por favor, deposita más fondos para continuar."
	 * }
	 * }
	 */
	static async createBtcWithdrawal(withdrawalData) {
		const body = {
			...withdrawalData,
			currency: 'btc',
			method: 'btc',
			protocol: 'btc',
			network: 'btc',
			asset: 'btc',
		};
		return this.#sendRequest('bitso', '/api/v3/withdrawals', 'POST', body);
	}

	/**
	 * Filters MXN withdrawals with SPEI®-specific query parameters.
	 * @param {URLSearchParams} [queryParams=null] - Optional SPEI-specific query parameters.
	 * @returns {Promise<any>} A filtered list of MXN SPEI withdrawals.
	 * @example // How to call the function
	 * const params = new URLSearchParams({ receiver_clabe: "646180110400000007", limit: "5" });
	 * const withdrawals = await JunoBitsoService.filterMxnWithdrawals(params);
	 * @example // Successful Response (from your logs)
	 * {
	 * "success": true,
	 * "payload": {
	 * "total_items": "1",
	 * "total_pages": "1",
	 * "current_page": "1",
	 * "page_size": "25",
	 * "response": [
	 * {
	 * "wid": "a1b2c3d4e5f6g7h8i9j0",
	 * "status": "complete",
	 * "created_at": "2025-07-08T08:20:00",
	 * "currency": "mxn",
	 * "amount": "150.00",
	 * "refund_deposit": null,
	 * "details": {
	 * "origin_id": null,
	 * "clave_de_rastreo": "SPEI_TRACKING_KEY_123",
	 * "beneficiary_name": "Test Beneficiary",
	 * "beneficiary_clabe": "646180110400000007",
	 * "numeric_ref": "1234567"
	 * }
	 * }
	 * ]
	 * }
	 * }
	 */
	static async filterMxnWithdrawals(queryParams = null) {
		const endpoint = `/spei/v1/withdrawals${ queryParams ? `?${ queryParams }` : '' }`;
		return this.#sendRequest('bitso', endpoint, 'GET');
	}

	/**
	 * Creates an XRP (Ripple) withdrawal.
	 * @description This function requires a valid destination address, tag, and sufficient XRP balance.
	 * @param {object} data - Withdrawal data.
	 * @param {string} data.amount - The amount of XRP to withdraw.
	 * @param {string} data.address - The destination XRP address.
	 * @param {string} data.destination_tag - The destination tag for the XRP transaction.
	 * @returns {Promise<any>} The withdrawal response.
	 * @example // How to call the function
	 * const xrpData = {
	 * amount: '10',
	 * address: 'rG1QQv2nh2gr7RCZ1P8YYcBUKCCN633jCn',
	 * destination_tag: '1001'
	 * };
	 * const response = await JunoBitsoService.createXrpWithdrawal(xrpData);
	 * @example // Successful Response (from your logs)
	 * {
	 * "success": true,
	 * "payload": {
	 * "wid": "792458dde14341e0d96442adfeb32950",
	 * "status": "pending",
	 * "created_at": "2025-07-08T08:40:08+00:00",
	 * "currency": "xrp",
	 * "method": "rp",
	 * "amount": "10.00006000",
	 * "details": {
	 * "withdrawal_address": "rG1QQv2nh2gr7RCZ1P8YYcBUKCCN633jCn",
	 * "destination_tag": "1001"
	 * }
	 * }
	 * }
	 */
	static async createXrpWithdrawal(data) {
		const withdrawalData = {
			...data,
			currency: 'xrp',
			method: 'rp',
			protocol: 'ripple',
			network: 'rp',
			asset: 'xrp',
		};
		return this.createCryptoWithdrawal(withdrawalData);
	}

	/**
	 * Retrieves Juno account details, filtering for AUTO_PAYMENT CLABEs.
	 * @returns {Promise<any>} The account data.
	 * @example // Successful Response
	 * {
	 * "success": true,
	 * "payload": {
	 * "total_items": "2",
	 * "total_pages": "1",
	 * "current_page": "1",
	 * "page_size": "25",
	 * "response": [
	 * {
	 * "clabe": "710969000000401506",
	 * "type": "AUTO_PAYMENT",
	 * "status": "ENABLED",
	 * "deposit_minimum_amount": null,
	 * "deposit_maximum_amounts": {
	 * "operation": null,
	 * "daily": null,
	 * "weekly": null,
	 * "monthly": null
	 * },
	 * "created_at": "2025-07-08T01:42:01Z",
	 * "updated_at": null
	 * }
	 * ]
	 * }
	 * }
	 */
	static async retrieveAccountDetails() {
		return this.#sendRequest('juno', '/spei/v1/clabes?clabe_type=AUTO_PAYMENT', 'GET');
	}

	/**
	 * Retrieves the MXNB balance of the Juno account.
	 * @returns {Promise<any>} The balance information.
	 * @example // Successful Response
	 * {
	 * "success": true,
	 * "payload": {
	 * "balances": [
	 * {
	 * "asset": "mxnb",
	 * "total": 10000.00,
	 * "on_hold": 0.00,
	 * "available": 10000.00,
	 * "locked": 0.00
	 * }
	 * ]
	 * }
	 * }
	 */
	static async retrieveBalance() {
		return this.#sendRequest('juno', '/mint_platform/v1/balances', 'GET');
	}

	/**
	 * Lists transactions for the Juno account.
	 * @param {URLSearchParams} [queryParams=null] - Optional query parameters for filtering and pagination.
	 * @returns {Promise<any>} A paginated list of transactions.
	 * @example // Successful Response
	 * {
	 * "success": true,
	 * "payload": {
	 * "content": [
	 * {
	 * "id": "txn_123456789abcdef",
	 * "amount": 500.00,
	 * "currency": "mxnb",
	 * "transaction_type": "DEPOSIT",
	 * "method": "SPEI",
	 * "summary_status": "COMPLETED",
	 * "created_at": "2025-07-08T09:00:00Z",
	 * "updated_at": "2025-07-08T09:00:10Z"
	 * }
	 * ],
	 * "pageable": {
	 * "page_number": 0,
	 * "page_size": 10,
	 * "sort": {
	 * "empty": false,
	 * "sorted": true,
	 * "unsorted": false
	 * },
	 * "offset": 0,
	 * "paged": true,
	 * "unpaged": false
	 * },
	 * "total_pages": 1,
	 * "total_elements": 10,
	 * "last": true,
	 * "first": true,
	 * "size": 10,
	 * "number": 0,
	 * "number_of_elements": 10,
	 * "empty": false
	 * }
	 * }
	 */
	static async listTransactions(queryParams = null) {
		const endpoint = `/mint_platform/v1/transactions${ queryParams ? `?${ queryParams }` : '' }`;
		return this.#sendRequest('juno', endpoint, 'GET');
	}

	/**
	 * Lists CLABEs belonging to the Juno account, with optional filtering.
	 * @param {URLSearchParams} [queryParams=null] - Optional query parameters.
	 * @returns {Promise<any>} A paginated list of CLABEs.
	 * @example // Successful Response
	 * {
	 * "success": true,
	 * "payload": {
	 * "total_items": "6",
	 * "total_pages": "1",
	 * "current_page": "1",
	 * "page_size": "25",
	 * "response": [
	 * {
	 * "clabe": "710969000000401506",
	 * "type": "AUTO_PAYMENT",
	 * "status": "ENABLED",
	 * "deposit_minimum_amount": null,
	 * "deposit_maximum_amounts": {
	 * "operation": null,
	 * "daily": null,
	 * "weekly": null,
	 * "monthly": null
	 * },
	 * "created_at": "2025-07-08T01:42:01Z",
	 * "updated_at": null
	 * }
	 * ]
	 * }
	 * }
	 */
	static async listJunoClabes(queryParams = null) {
		const endpoint = `/spei/v1/clabes${ queryParams ? `?${ queryParams }` : '' }`;
		return this.#sendRequest('juno', endpoint, 'GET');
	}

	/**
	 * Lists deposits made to the Juno account's CLABEs.
	 * @param {URLSearchParams} [queryParams=null] - Optional query parameters for filtering.
	 * @returns {Promise<any>} A paginated list of deposits.
	 * @example // Successful Response
	 * {
	 * "success": true,
	 * "payload": {
	 * "total_items": "29",
	 * "total_pages": "2",
	 * "current_page": "1",
	 * "page_size": "25",
	 * "response": [
	 * {
	 * "fid": "a1b2c3d4e5f6g7h8i9j0",
	 * "deposit_id": "1234567",
	 * "sender_clabe": "012180015040777777",
	 * "receiver_clabe": "710969000000401506",
	 * "status": "COMPLETE",
	 * "amount": "500.00",
	 * "currency": "mxn",
	 * "details": {
	 * "sender_name": "JOHN DOE",
	 * "sender_bank": "012",
	 * "clave": "123456",
	 * "clave_rastreo": "BANKTRACKINGKEY123",
	 * "numeric_reference": "9876543",
	 * "concepto": "Payment for services",
	 * "cep_link": null
	 * },
	 * "created_at": "2025-07-08T09:00:00Z",
	 * "updated_at": "2025-07-08T09:00:10Z"
	 * }
	 * ]
	 * }
	 * }
	 */
	static async listJunoDeposits(queryParams = null) {
		const endpoint = `/spei/v1/deposits${ queryParams ? `?${ queryParams }` : '' }`;
		return this.#sendRequest('juno', endpoint, 'GET');
	}

		/**
	 * Updates an existing contact's details using PATCH.
	 * NOTE: This function was corrected from PUT to PATCH based on a 405 Method Not Allowed error.
	 * The API expects partial updates via PATCH for this endpoint.
	 * @param {number} contactId - The ID of the contact to update.
	 * @param {object} updateData - The data to update (e.g., { alias: 'New Alias' }).
	 * @returns {Promise<any>} The updated contact details.
	 * @example // How to call the function
	 * const response = await JunoBitsoService.updateContact(18692, { alias: "Alias Actualizado" });
	 * @example // Successful Response
	 * {
	 * "success": true,
	 * "payload": {
	 * "contact_id": 18692,
	 * "alias": "Alias Actualizado",
	 * "currency": "mxn",
	 * "details": [
	 * {
	 * "name": "Beneficiary",
	 * "key": "beneficiary",
	 * "value": "Temporal User"
	 * },
	 * {
	 * "name": "CLABE",
	 * "key": "clabe",
	 * "value": "646180110400000007"
	 * }
	 * ]
	 * }
	 * }
	 */
	static async updateContact(contactId, updateData) {
		return this.#sendRequest('bitso', `/api/v3/consumer-contacts/${ contactId }`, 'PATCH', updateData);
	}
	/**
	 * ============================= Funciones sin @example =============================
	 *
	 */
/**
	 * Creates a new digital asset withdrawal from the Juno platform.
	 * This is used to send assets like MXNB to an external blockchain address.
	 * @param {object} withdrawalData - The withdrawal details.
	 * @param {string} withdrawalData.address - The destination blockchain address.
	 * @param {string} withdrawalData.amount - The amount of the asset to withdraw.
	 * @param {string} withdrawalData.asset - The asset ticker (e.g., "MXNB").
	 * @param {string} withdrawalData.blockchain - The blockchain network (e.g., "ARBITRUM").
	 * @param {object} [withdrawalData.compliance] - Optional compliance information.
	 * @returns {Promise<any>} A promise that resolves with the withdrawal confirmation details.
	 * @example // How to call the function
	 * const withdrawalDetails = await JunoBitsoService.createJunoWithdrawal({
	 * address: "0xD69E4bfB516BCAC4a7b59c73aD9870b33Af6e56F",
	 * amount: "1000",
	 * asset: "MXNB",
	 * blockchain: "ARBITRUM",
	 * compliance: {}
	 * });
	 */
	static async createJunoWithdrawal(withdrawalData) {
		// Using a UUID for the idempotency key is a good practice for POST requests
		// to prevent accidental duplicate operations.
		const headers = { 'X-Idempotency-Key': uuidv4() };
		return this.#sendRequest('juno', '/mint_platform/v1/withdrawals', 'POST', withdrawalData, headers);
	}
	/**
	 * Creates a business customer for a money transmitter.
	 * NOTE: This function requires special 'Money Transmitter' permissions on the API key.
	 * The payload was adjusted to include the 'identifying_information' wrapper based on a 400 error.
	 * @param {object} businessData - The business's information.
	 * @param {string} token - The security token obtained from getSecurityToken.
	 * @returns {Promise<any>} The created business customer's details.
	 */
	static async createBusinessCustomer(businessData, token) {
		const headers = { 'Authorization': `Bearer ${ token }` };
		// FIX: Wrapped the business data inside an 'identifying_information' object
		// to address the "Failed to read request" error, assuming a similar structure
		// to the non-business endpoint.
		const body = {
			identifying_information: businessData,
		};
		return this.#sendRequest('bitso', '/api/v3/payments/usd/bridge/money-transmitters/customers/businesses', 'POST', body, headers);
	}

	/**
	 * Requests the Terms of Service URL for a customer.
	 * @returns {Promise<any>} The URL for the customer to accept the ToS.
	 */
	static async getTermsOfServiceUrl() {
		return this.#sendRequest('bitso', '/api/v3/payments/usd/bridge/money-transmitters/customers/terms-of-service', 'POST');
	}

	/**
	 * Creates a non-business customer for a money transmitter.
	 * NOTE: This function requires special 'Money Transmitter' permissions on the API key.
	 * The payload was adjusted to include the 'identifying_information' wrapper based on a 400 error.
	 * @param {object} customerData - The customer's personal and address information.
	 * @param {string} token - The security token obtained from getSecurityToken.
	 * @returns {Promise<any>} The created customer's details.
	 */
	static async createNonBusinessCustomer(customerData, token) {
		const headers = { 'Authorization': `Bearer ${ token }` };
		// FIX: Wrapped the customer data inside an 'identifying_information' object
		// to address the "identifying_information is required" error.
		const body = {
			identifying_information: customerData,
		};
		return this.#sendRequest('bitso', '/api/v3/payments/usd/bridge/money-transmitters/customers', 'POST', body, headers);
	}

	/**
	 * Retrieves details for a specific money transmitter customer.
	 * @param {string} customerId - The ID of the customer.
	 * @returns {Promise<any>} The customer's details and KYC status.
	 */
	static async getCustomerDetails(customerId) {
		return this.#sendRequest('bitso', `/api/v3/payments/usd/bridge/money-transmitters/customers/${ customerId }`, 'GET');
	}

	/**
	 * Lists all customers for a money transmitter.
	 * @returns {Promise<any>} A list of customers.
	 */
	static async listCustomers() {
		return this.#sendRequest('bitso', '/api/v3/payments/usd/bridge/money-transmitters/customers', 'GET');
	}

	/**
	 * Updates a money transmitter's customer information.
	 * @param {string} customerId - The ID of the customer to update.
	 * @param {object} customerData - The complete, updated data structure for the customer.
	 * @returns {Promise<any>} The updated customer details.
	 */
	static async updateCustomer(customerId, customerData) {
		return this.#sendRequest('bitso', `/api/v3/payments/usd/bridge/money-transmitters/customers/${ customerId }`, 'PUT', customerData);
	}

	/**
	 * Deletes a money transmitter's customer.
	 * @param {string} customerId - The ID of the customer to delete.
	 * @returns {Promise<any>} The result of the deletion.
	 */
	static async deleteCustomer(customerId) {
		return this.#sendRequest('bitso', `/api/v3/payments/usd/bridge/money-transmitters/customers/${ customerId }`, 'DELETE');
	}



	/**
	 * Generic method to create a crypto withdrawal.
	 * Specific methods for each coin are recommended.
	 * @param {object} withdrawalData - The data for the crypto withdrawal, may include compliance info.
	 * @returns {Promise<any>} The result of the withdrawal request.
	 */
	static async createCryptoWithdrawal(withdrawalData) {
		return this.#sendRequest('bitso', '/api/v3/withdrawals', 'POST', withdrawalData);
	}

	/**
	 * Creates an ADA (Cardano) withdrawal.
	 * @param {object} data - Withdrawal data.
	 * @param {string} data.amount - The amount of ADA to withdraw.
	 * @param {string} data.address - The destination ADA address.
	 * @param {object} [data.compliance] - Optional Travel Rule compliance info.
	 * @returns {Promise<any>} The withdrawal response.
	 */
	static async createAdaWithdrawal(data) {
		const withdrawalData = {
			...data,
			currency: 'ada',
			method: 'ada',
			protocol: 'ada',
			network: 'cardano',
			asset: 'ada',
		};
		return this.createCryptoWithdrawal(withdrawalData);
	}

	/**
	 * Creates a USDT withdrawal on the Ethereum (ERC20) network.
	 * @param {object} data - Withdrawal data.
	 * @param {string} data.amount - The amount of USDT to withdraw.
	 * @param {string} data.address - The destination Ethereum address.
	 * @param {object} [data.compliance] - Optional Travel Rule compliance info.
	 * @returns {Promise<any>} The withdrawal response.
	 */
	static async createUsdtEthWithdrawal(data) {
		const withdrawalData = {
			...data,
			currency: 'usdt',
			method: 'eth_erc20',
			protocol: 'erc20',
			network: 'eth',
			asset: 'usdt',
		};
		return this.createCryptoWithdrawal(withdrawalData);
	}

	/**
	 * Creates a USDT withdrawal on the Tron (TRC20) network.
	 * @param {object} data - Withdrawal data.
	 * @param {string} data.amount - The amount of USDT to withdraw.
	 * @param {string} data.address - The destination Tron address.
	 * @param {object} [data.compliance] - Optional Travel Rule compliance info.
	 * @returns {Promise<any>} The withdrawal response.
	 */
	static async createUsdtTronWithdrawal(data) {
		const withdrawalData = {
			...data,
			currency: 'usdt',
			method: 'trx_trc20',
			protocol: 'trc20',
			network: 'trx',
			asset: 'usdt',
		};
		return this.createCryptoWithdrawal(withdrawalData);
	}

	/**
	 * Creates a USDC withdrawal on the Polygon network.
	 * NOTE: The call will fail if the account has insufficient funds.
	 * @param {object} data - Withdrawal data.
	 * @param {string} data.amount - The amount of USDC to withdraw.
	 * @param {string} data.address - The valid destination Polygon address.
	 * @returns {Promise<any>} The withdrawal response.
	 */
	static async createUsdcPolygonWithdrawal(data) {
		const withdrawalData = {
			...data,
			currency: 'usd',
			method: 'usdc_trf',
			protocol: 'usdc_trf',
			network: 'circle',
			asset: 'usdc',
			chain: 'POLY',
		};
		return this.createCryptoWithdrawal(withdrawalData);
	}

	/**
	 * Creates a USDC withdrawal on the Stellar network.
	 * @param {object} data - Withdrawal data.
	 * @param {string} data.amount - The amount of USDC to withdraw.
	 * @param {string} data.address - The destination Stellar address.
	 * @param {string} data.destination_tag - The memo for the Stellar transaction.
	 * @param {object} [data.compliance] - Optional Travel Rule compliance info.
	 * @returns {Promise<any>} The withdrawal response.
	 */
	static async createUsdcStellarWithdrawal(data) {
		const withdrawalData = {
			...data,
			currency: 'usd',
			method: 'usdc_trf',
			protocol: 'usdc_trf',
			network: 'circle',
			asset: 'usdc',
			chain: 'xlm',
		};
		return this.createCryptoWithdrawal(withdrawalData);
	}

	/**
	 * Creates a USDC withdrawal on the Solana network.
	 * @param {object} data - Withdrawal data.
	 * @param {string} data.amount - The amount of USDC to withdraw.
	 * @param {string} data.address - The destination Solana address.
	 * @param {object} [data.compliance] - Optional Travel Rule compliance info.
	 * @returns {Promise<any>} The withdrawal response.
	 */
	static async createUsdcSolanaWithdrawal(data) {
		const withdrawalData = {
			...data,
			currency: 'usd',
			method: 'usdc_trf',
			protocol: 'usdc_trf',
			network: 'circle',
			asset: 'usdc',
			chain: 'SOL',
		};
		return this.createCryptoWithdrawal(withdrawalData);
	}

	/**
	 * Retrieves comprehensive information about a specific CLABE.
	 * @param {string} clabe - The 18-digit CLABE to query.
	 * @returns {Promise<any>} The CLABE details.
	 */
	static async retrieveJunoClabeDetails(clabe) {
		return this.#sendRequest('juno', `/spei/v1/clabes/${ clabe }`, 'GET');
	}

	/**
	 * Redeems MXNB tokens for MXN.
	 * @param {object} redemptionData - The data for the redemption.
	 * @param {number} redemptionData.amount - The amount of MXNB to redeem.
	 * @param {string} redemptionData.destination_bank_account_id - The Juno-provided bank account ID.
	 * @param {string} [redemptionData.asset='mxn'] - The asset, must be 'mxn'.
	 * @returns {Promise<any>} The result of the redemption request.
	 */
	static async redeemMxn(redemptionData) {
		const headers = { 'X-Idempotency-Key': uuidv4() };
		return this.#sendRequest('juno', '/mint_platform/v1/redemptions', 'POST', { asset: 'mxn', ...redemptionData }, headers);
	}

	/**
	 * Retrieves details for a specific transaction by its ID.
	 * @param {string} transactionId - The Juno-provided unique identifier of the transaction.
	 * @returns {Promise<any>} The transaction details.
	 */
	static async getTransactionDetails(transactionId) {
		return this.#sendRequest('juno', `/mint_platform/v1/transactions/${ transactionId }`, 'GET');
	}

}

export default JunoBitsoService;
