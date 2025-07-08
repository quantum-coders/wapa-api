import { PrismaClient } from '@prisma/client';
import JunoBitsoService from '#services/juno.service.js';

const prisma = new PrismaClient();

class JunoBitsoController {

    /**
     * @summary Creates a new Juno CLABE and associates it with the authenticated user.
     * @param {object} req - The authenticated request object. req.user must contain the user's uid.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response with the new CLABE details.
     */
    static async createJunoClabeForUser(req, res) {
        try {
            const { uid } = req.user;
            const user = await prisma.user.findUnique({ where: { uid } });
            if (user.clabeJuno) {
                return res.respond({ status: 409, message: 'User already has a Juno CLABE assigned.', data: { clabe: user.clabeJuno } });
            }

            const junoResponse = await JunoBitsoService.createJunoClabe();
            if (!junoResponse.success || !junoResponse.payload.clabe) {
                 return res.respond({ status: 502, message: 'Failed to create Juno CLABE from provider.', error: junoResponse.error });
            }

            const newClabe = junoResponse.payload.clabe;
            const updatedUser = await prisma.user.update({
                where: { uid },
                data: { clabeJuno: newClabe },
            });

            return res.respond({ status: 201, message: 'Juno CLABE created and assigned successfully.', data: { clabe: updatedUser.clabeJuno } });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Retrieves Juno bank accounts registered to the platform's main account.
     * @param {object} req - The authenticated request object.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getJunoBankAccounts(req, res) {
        try {
            const data = await JunoBitsoService.retrieveBankAccounts();
            return res.respond({ status: 200, message: 'Juno bank accounts retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Retrieves Juno account details for the platform.
     * @param {object} req - The authenticated request object.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getJunoAccountDetails(req, res) {
        try {
            const data = await JunoBitsoService.retrieveAccountDetails();
            return res.respond({ status: 200, message: 'Juno account details retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Retrieves the platform's main Juno MXNB balance.
     * @param {object} req - The authenticated request object.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getJunoBalance(req, res) {
        try {
            const data = await JunoBitsoService.retrieveBalance();
            return res.respond({ status: 200, message: 'Juno balance retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Lists transactions for the platform's Juno account.
     * @param {object} req - The authenticated request object. May contain query params.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async listJunoTransactions(req, res) {
        try {
            const queryParams = new URLSearchParams(req.query);
            const data = await JunoBitsoService.listTransactions(queryParams);
            return res.respond({ status: 200, message: 'Juno transactions listed successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Lists CLABEs belonging to the platform's Juno account.
     * @param {object} req - The authenticated request object. May contain query params.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async listJunoClabes(req, res) {
        try {
            const queryParams = new URLSearchParams(req.query);
            const data = await JunoBitsoService.listJunoClabes(queryParams);
            return res.respond({ status: 200, message: 'Juno CLABEs listed successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Lists deposits made to the platform's Juno account.
     * @param {object} req - The authenticated request object. May contain query params.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async listJunoDeposits(req, res) {
        try {
            const queryParams = new URLSearchParams(req.query);
            const data = await JunoBitsoService.listJunoDeposits(queryParams);
            return res.respond({ status: 200, message: 'Juno deposits listed successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Creates a mock MXN deposit in the Juno testing environment.
     * @param {object} req - The authenticated request object. Contains deposit data in body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async createMockDeposit(req, res) {
        try {
            const depositData = req.body;
            if (!depositData || !depositData.amount || !depositData.receiver_clabe) {
                return res.respond({ status: 400, message: 'Amount and receiver_clabe are required.' });
            }
            const data = await JunoBitsoService.createMockDeposit(depositData);
            return res.respond({ status: 201, message: 'Mock deposit created successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Retrieves the platform's Bitso account balance.
     * @param {object} req - The authenticated request object. May contain a 'currency' query parameter.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getBitsoBalance(req, res) {
        try {
            const { currency } = req.query;
            const data = await JunoBitsoService.getBitsoBalance(currency);
            return res.respond({ status: 200, message: 'Bitso balance retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Lists fundings from the platform's Bitso account.
     * @param {object} req - The authenticated request object. May contain query parameters.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async listFundings(req, res) {
        try {
            const queryParams = new URLSearchParams(req.query);
            const data = await JunoBitsoService.listFundings(queryParams);
            return res.respond({ status: 200, message: 'Fundings listed successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Gets details for a specific funding from the platform's Bitso account.
     * @param {object} req - The authenticated request object. Contains 'fid' in params.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getFundingDetails(req, res) {
        try {
            const { fid } = req.params;
            if (!fid) return res.respond({ status: 400, message: 'Funding ID (fid) is required.' });
            const data = await JunoBitsoService.getFundingDetails(fid);
            return res.respond({ status: 200, message: 'Funding details retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Gets available funding methods for a currency on Bitso.
     * @param {object} req - The authenticated request object. Contains 'currency' in params.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getFundingMethods(req, res) {
        try {
            const { currency } = req.params;
            if (!currency) return res.respond({ status: 400, message: 'Currency is required.' });
            const data = await JunoBitsoService.getFundingMethods(currency);
            return res.respond({ status: 200, message: 'Funding methods retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Gets available withdrawal methods for a currency on Bitso.
     * @param {object} req - The authenticated request object. Contains 'currency' in params.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getWithdrawalMethods(req, res) {
        try {
            const { currency } = req.params;
            if (!currency) return res.respond({ status: 400, message: 'Currency is required.' });
            const data = await JunoBitsoService.getWithdrawalMethods(currency);
            return res.respond({ status: 200, message: 'Withdrawal methods retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Creates a fiat withdrawal from the platform's Bitso account.
     * @param {object} req - The authenticated request object. Contains withdrawal data in the body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async createFiatWithdrawal(req, res) {
        try {
            const withdrawalData = req.body;
            if (!withdrawalData || Object.keys(withdrawalData).length === 0) return res.respond({ status: 400, message: 'Withdrawal data is required.' });
            const data = await JunoBitsoService.createFiatWithdrawal(withdrawalData);
            return res.respond({ status: 201, message: 'Fiat withdrawal created successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Creates a Bitcoin (BTC) withdrawal from the platform's Bitso account.
     * @param {object} req - The authenticated request object. Contains BTC withdrawal data in the body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async createBtcWithdrawal(req, res) {
        try {
            const btcData = req.body;
            if (!btcData || !btcData.amount || !btcData.address) {
                return res.respond({ status: 400, message: 'Amount and address are required.' });
            }
            const data = await JunoBitsoService.createBtcWithdrawal(btcData);
            return res.respond({ status: 201, message: 'BTC withdrawal created successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Creates an XRP (Ripple) withdrawal from the platform's Bitso account.
     * @param {object} req - The authenticated request object. Contains XRP withdrawal data in the body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async createXrpWithdrawal(req, res) {
        try {
            const xrpData = req.body;
            if (!xrpData || !xrpData.amount || !xrpData.address) {
                return res.respond({ status: 400, message: 'Amount and address are required.' });
            }
            const data = await JunoBitsoService.createXrpWithdrawal(xrpData);
            return res.respond({ status: 201, message: 'XRP withdrawal created successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Creates a withdrawal via Bitso Transfer.
     * @param {object} req - The authenticated request object. Contains transfer data in the body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async createBitsoTransfer(req, res) {
        try {
            const transferData = req.body;
            if (!transferData || !transferData.currency || !transferData.amount || (!transferData.email && !transferData.phone)) {
                return res.respond({ status: 400, message: 'Currency, amount, and a recipient (email or phone) are required.' });
            }
            const data = await JunoBitsoService.createBitsoTransfer(transferData);
            return res.respond({ status: 201, message: 'Bitso Transfer created successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Lists withdrawals from the platform's Bitso account.
     * @param {object} req - The authenticated request object. May contain query parameters.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async listWithdrawals(req, res) {
        try {
            const queryParams = new URLSearchParams(req.query);
            const data = await JunoBitsoService.listWithdrawals(queryParams);
            return res.respond({ status: 200, message: 'Withdrawals listed successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Filters MXN withdrawals from the platform's Bitso account.
     * @param {object} req - The authenticated request object. May contain SPEI-specific query params.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async filterMxnWithdrawals(req, res) {
        try {
            const queryParams = new URLSearchParams(req.query);
            const data = await JunoBitsoService.filterMxnWithdrawals(queryParams);
            return res.respond({ status: 200, message: 'MXN withdrawals filtered successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Gets details for a specific withdrawal from the platform's Bitso account.
     * @param {object} req - The authenticated request object. Contains 'wid' in params.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getWithdrawalDetails(req, res) {
        try {
            const { wid } = req.params;
            if (!wid) return res.respond({ status: 400, message: 'Withdrawal ID (wid) is required.' });
            const data = await JunoBitsoService.getWithdrawalDetails(wid);
            return res.respond({ status: 200, message: 'Withdrawal details retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Creates a new contact (beneficiary) in the platform's Bitso account.
     * @param {object} req - The authenticated request object. Contains contact data in the body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async createContact(req, res) {
        try {
            const contactData = req.body;
            if (!contactData || Object.keys(contactData).length === 0) return res.respond({ status: 400, message: 'Contact data is required.' });
            const data = await JunoBitsoService.createContact(contactData);
            return res.respond({ status: 201, message: 'Contact created successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Lists all contacts (beneficiaries) from the platform's Bitso account.
     * @param {object} req - The authenticated request object. May contain query parameters.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async listContacts(req, res) {
        try {
            const queryParams = new URLSearchParams(req.query);
            const data = await JunoBitsoService.listContacts(queryParams);
            return res.respond({ status: 200, message: 'Contacts listed successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Partially updates an existing withdrawal contact in the platform's Bitso account.
     * @param {object} req - The authenticated request object. Contains 'contactId' in params and patch data in body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async patchContact(req, res) {
        try {
            const { contactId } = req.params;
            const patchData = req.body;
            if (!contactId) return res.respond({ status: 400, message: 'Contact ID is required.' });
            if (!patchData || Object.keys(patchData).length === 0) return res.respond({ status: 400, message: 'Patch data is required.' });
            const data = await JunoBitsoService.patchContact(contactId, patchData);
            return res.respond({ status: 200, message: 'Contact updated successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Deletes a withdrawal contact from the platform's Bitso account.
     * @param {object} req - The authenticated request object. Contains 'contactId' in params.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async deleteContact(req, res) {
        try {
            const { contactId } = req.params;
            if (!contactId) return res.respond({ status: 400, message: 'Contact ID is required.' });
            const data = await JunoBitsoService.deleteContact(contactId);
            return res.respond({ status: 200, message: 'Contact deleted successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Lists all CLABEs from the platform's Bitso account.
     * @param {object} req - The authenticated request object. May contain query parameters.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async listBitsoClabes(req, res) {
        try {
            const queryParams = new URLSearchParams(req.query);
            const data = await JunoBitsoService.listBitsoClabes(queryParams);
            return res.respond({ status: 200, message: 'Bitso CLABEs listed successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Creates a new Bitso CLABE and associates it with the authenticated user.
     * @param {object} req - The authenticated request object.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async createBitsoClabe(req, res) {
        try {
            const { uid } = req.user;
            const user = await prisma.user.findUnique({ where: { uid } });
            if (user.clabeBitso) {
                return res.respond({ status: 409, message: 'User already has a Bitso CLABE assigned.', data: { clabe: user.clabeBitso } });
            }
            const bitsoResponse = await JunoBitsoService.createBitsoClabe();
            if (!bitsoResponse.success || !bitsoResponse.payload.clabe) {
                return res.respond({ status: 502, message: 'Failed to create Bitso CLABE from provider.', error: bitsoResponse.error });
            }
            const newClabe = bitsoResponse.payload.clabe;
            const updatedUser = await prisma.user.update({
                where: { uid },
                data: { clabeBitso: newClabe },
            });
            return res.respond({ status: 201, message: 'Bitso CLABE created and assigned successfully.', data: { clabe: updatedUser.clabeBitso } });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Retrieves details for a specific Bitso CLABE.
     * @param {object} req - The authenticated request object. Contains 'clabe' in params.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getBitsoClabeDetails(req, res) {
        try {
            const { clabe } = req.params;
            if (!clabe) return res.respond({ status: 400, message: 'CLABE is required.' });
            const data = await JunoBitsoService.getBitsoClabeDetails(clabe);
            return res.respond({ status: 200, message: 'CLABE details retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Sets deposit limits for a specific Bitso CLABE.
     * @param {object} req - The authenticated request object. Contains 'clabe' in params and limits data in body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async setClabeLimits(req, res) {
        try {
            const { clabe } = req.params;
            const limitsData = req.body;
            if (!clabe) return res.respond({ status: 400, message: 'CLABE is required.' });
            if (!limitsData || Object.keys(limitsData).length === 0) return res.respond({ status: 400, message: 'Limits data is required.' });
            const data = await JunoBitsoService.setClabeLimits(clabe, limitsData);
            return res.respond({ status: 200, message: 'CLABE limits updated successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Retrieves deposit limits for a specific Bitso CLABE.
     * @param {object} req - The authenticated request object. Contains 'clabe' in params.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getClabeLimits(req, res) {
        try {
            const { clabe } = req.params;
            if (!clabe) return res.respond({ status: 400, message: 'CLABE is required.' });
            const data = await JunoBitsoService.getClabeLimits(clabe);
            return res.respond({ status: 200, message: 'CLABE limits retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Updates the status of a Bitso CLABE (ENABLED/DISABLED).
     * @param {object} req - The authenticated request object. Contains 'clabe' in params and status in body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async updateClabeStatus(req, res) {
        try {
            const { clabe } = req.params;
            const { status } = req.body;
            if (!clabe) return res.respond({ status: 400, message: 'CLABE is required.' });
            if (!status || !['ENABLED', 'DISABLED'].includes(status)) return res.respond({ status: 400, message: 'Valid status (ENABLED/DISABLED) is required.' });
            const data = await JunoBitsoService.updateClabeStatus(clabe, status);
            return res.respond({ status: 200, message: 'CLABE status updated successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Retrieves the list of available order books on Bitso.
     * @param {object} req - The authenticated request object.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getAvailableBooks(req, res) {
        try {
            const data = await JunoBitsoService.getAvailableBooks();
            return res.respond({ status: 200, message: 'Available books retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Retrieves trading information (ticker) from a specific book on Bitso.
     * @param {object} req - The authenticated request object. Requires 'book' in query.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getTicker(req, res) {
        try {
            const { book } = req.query;
            if (!book) return res.respond({ status: 400, message: 'Book is required in query parameters.' });
            const data = await JunoBitsoService.getTicker(book);
            return res.respond({ status: 200, message: 'Ticker retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Retrieves the order book for a specific book on Bitso.
     * @param {object} req - The authenticated request object. Requires 'book' in query.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getOrderBook(req, res) {
        try {
            const { book, aggregate } = req.query;
            if (!book) return res.respond({ status: 400, message: 'Book is required in query parameters.' });
            const data = await JunoBitsoService.getOrderBook(book, aggregate);
            return res.respond({ status: 200, message: 'Order book retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Places a trading order on the platform's Bitso account.
     * @param {object} req - The authenticated request object. Contains order data in the body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async placeOrder(req, res) {
        try {
            const orderData = req.body;
            if (!orderData || Object.keys(orderData).length === 0) return res.respond({ status: 400, message: 'Order data is required.' });
            const data = await JunoBitsoService.placeOrder(orderData);
            return res.respond({ status: 201, message: 'Order placed successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Retrieves a list of open orders from the platform's Bitso account.
     * @param {object} req - The authenticated request object. May contain query parameters.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async listOpenOrders(req, res) {
        try {
            const queryParams = new URLSearchParams(req.query);
            const data = await JunoBitsoService.listOpenOrders(queryParams);
            return res.respond({ status: 200, message: 'Open orders listed successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Retrieves details of specific orders by their IDs from the platform's Bitso account.
     * @param {object} req - The authenticated request object. Requires 'oids' in query (comma-separated).
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async lookupOrders(req, res) {
        try {
            const { oids } = req.query;
            if (!oids) return res.respond({ status: 400, message: 'Order IDs (oids) are required in query parameters.' });
            const oidsArray = oids.split(',');
            const data = await JunoBitsoService.lookupOrders(oidsArray);
            return res.respond({ status: 200, message: 'Orders retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Cancels one or more open orders in the platform's Bitso account.
     * @param {object} req - The authenticated request object. Contains 'oids' in body (comma-separated string or 'all').
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async cancelOrders(req, res) {
        try {
            const { oids } = req.body;
            if (!oids) return res.respond({ status: 400, message: 'Order IDs (oids) array is required in the body.' });
            const oidsArray = Array.isArray(oids) ? oids : [oids];
            const data = await JunoBitsoService.cancelOrders(oidsArray);
            return res.respond({ status: 200, message: 'Orders cancelled successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Retrieves fee information from the platform's Bitso account.
     * @param {object} req - The authenticated request object.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getFees(req, res) {
        try {
            const data = await JunoBitsoService.getFees();
            return res.respond({ status: 200, message: 'Fees retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Retrieves a list of user trades for a specific book from the platform's Bitso account.
     * @param {object} req - The authenticated request object. Requires 'book' in query.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async listUserTrades(req, res) {
        try {
            const { book } = req.query;
            if (!book) return res.respond({ status: 400, message: 'Book is required in query parameters.' });
            const queryParams = new URLSearchParams(req.query);
            const data = await JunoBitsoService.listUserTrades(book, queryParams);
            return res.respond({ status: 200, message: 'User trades listed successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Requests a quote for a currency conversion.
     * @param {object} req - The authenticated request object. Contains quote data in body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async requestConversionQuote(req, res) {
        try {
            const quoteData = req.body;
            if (!quoteData || Object.keys(quoteData).length === 0) return res.respond({ status: 400, message: 'Quote data is required.' });
            const data = await JunoBitsoService.requestConversionQuote(quoteData);
            return res.respond({ status: 201, message: 'Conversion quote requested successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Executes a previously requested currency conversion quote.
     * @param {object} req - The authenticated request object. Contains 'quoteId' in params.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async executeConversion(req, res) {
        try {
            const { quoteId } = req.params;
            if (!quoteId) return res.respond({ status: 400, message: 'Quote ID is required.' });
            const data = await JunoBitsoService.executeConversion(quoteId);
            return res.respond({ status: 200, message: 'Conversion executed successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Retrieves the details and status of a specific currency conversion.
     * @param {object} req - The authenticated request object. Contains 'conversionId' in params.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getConversionDetails(req, res) {
        try {
            const { conversionId } = req.params;
            if (!conversionId) return res.respond({ status: 400, message: 'Conversion ID is required.' });
            const data = await JunoBitsoService.getConversionDetails(conversionId);
            return res.respond({ status: 200, message: 'Conversion details retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Requests a security token for money transmitter operations.
     * @param {object} req - The authenticated request object.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getSecurityToken(req, res) {
        try {
            const data = await JunoBitsoService.getSecurityToken();
            return res.respond({ status: 201, message: 'Security token retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Sets the `bridge_terms_and_conditions_accepted` flag to true.
     * @param {object} req - The authenticated request object.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async setBridgeTermsFlag(req, res) {
        try {
            const data = await JunoBitsoService.setBridgeTermsFlag();
            return res.respond({ status: 200, message: 'Bridge terms flag set successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Initiates the customer onboarding process for USD/SEPA transfers.
     * @param {object} req - The authenticated request object.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async customerOnboarding(req, res) {
        try {
            const data = await JunoBitsoService.customerOnboarding();
            return res.respond({ status: 201, message: 'Customer onboarding initiated successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Registers an external bank account for USD wire or SEPA transfers.
     * @param {object} req - The authenticated request object. Contains account data in the body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async registerBankAccount(req, res) {
        try {
            const accountData = req.body;
            if (!accountData || Object.keys(accountData).length === 0) return res.respond({ status: 400, message: 'Bank account data is required.' });
            const data = await JunoBitsoService.registerBankAccount(accountData);
            return res.respond({ status: 201, message: 'External bank account registered successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Lists all registered external bank accounts for the platform's account.
     * @param {object} req - The authenticated request object.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async listRegisteredBankAccounts(req, res) {
        try {
            const data = await JunoBitsoService.listRegisteredBankAccounts();
            return res.respond({ status: 200, message: 'Registered bank accounts listed successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Creates a deposit intent for a USD wire transfer.
     * @param {object} req - The authenticated request object. Contains intent data in the body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async createUsdWireDepositIntent(req, res) {
        try {
            const intentData = req.body;
            if (!intentData || !intentData.amount) return res.respond({ status: 400, message: 'Intent data with amount is required.' });
            const data = await JunoBitsoService.createUsdWireDepositIntent(intentData);
            return res.respond({ status: 201, message: 'USD wire deposit intent created successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Creates a deposit intent for a SEPA transfer.
     * @param {object} req - The authenticated request object. Contains intent data in the body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async createSepaDepositIntent(req, res) {
        try {
            const intentData = req.body;
            if (!intentData || !intentData.amount) return res.respond({ status: 400, message: 'Intent data with amount is required.' });
            const data = await JunoBitsoService.createSepaDepositIntent(intentData);
            return res.respond({ status: 201, message: 'SEPA deposit intent created successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Retrieves the catalog of registered VASPs for Travel Rule purposes.
     * @param {object} req - The authenticated request object.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getVasps(req, res) {
        try {
            const data = await JunoBitsoService.getVasps();
            return res.respond({ status: 200, message: 'VASPs retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Registers a webhook URL for the platform's account.
     * @param {object} req - The authenticated request object. Contains URL in the body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async registerWebhook(req, res) {
        try {
            const { url } = req.body;
            if (!url) return res.respond({ status: 400, message: 'A valid callback_url is required.' });
            const data = await JunoBitsoService.registerWebhook(url);
            return res.respond({ status: 201, message: 'Webhook registered successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Previews a BRL (Brazilian Real) withdrawal via Pix.
     * @param {object} req - The authenticated request object. Contains preview data in the body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async previewBrlWithdrawal(req, res) {
        try {
            const previewData = req.body;
            if (!previewData || Object.keys(previewData).length === 0) return res.respond({ status: 400, message: 'Preview data is required.' });
            const data = await JunoBitsoService.previewBrlWithdrawal(previewData);
            return res.respond({ status: 200, message: 'BRL withdrawal preview retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Creates a one-time payment request via SPEI.
     * @param {object} req - The authenticated request object. Contains payment data in the body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async createOneTimePayment(req, res) {
        try {
            const paymentData = req.body;
            if (!paymentData || !paymentData.amount || !paymentData.payer_name || !paymentData.payment_id) {
                return res.respond({ status: 400, message: 'Amount, payer_name, and payment_id are required.' });
            }
            const data = await JunoBitsoService.createOneTimePayment(paymentData);
            return res.respond({ status: 201, message: 'One-time payment created successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Retrieves the details of a specific one-time payment.
     * @param {object} req - The authenticated request object. Contains 'paymentId' in params.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async getOneTimePaymentDetails(req, res) {
        try {
            const { paymentId } = req.params;
            if (!paymentId) return res.respond({ status: 400, message: 'Payment ID is required.' });
            const data = await JunoBitsoService.getOneTimePaymentDetails(paymentId);
            return res.respond({ status: 200, message: 'Payment details retrieved successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Lists one-time payments with pagination.
     * @param {object} req - The authenticated request object. May contain query params.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async listOneTimePayments(req, res) {
        try {
            const params = new URLSearchParams(req.query);
            const data = await JunoBitsoService.listOneTimePayments(params);
            return res.respond({ status: 200, message: 'One-time payments listed successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Lists SPEI deposits with pagination.
     * @param {object} req - The authenticated request object. May contain query params.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async listSpeiDeposits(req, res) {
        try {
            const params = new URLSearchParams(req.query);
            const data = await JunoBitsoService.listSpeiDeposits(params);
            return res.respond({ status: 200, message: 'SPEI deposits listed successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }

    /**
     * @summary Updates an existing contact's details using PATCH.
     * @param {object} req - The authenticated request object. Contains 'contactId' in params and update data in body.
     * @param {object} res - The response object.
     * @returns {Promise<object>} A standard JSON response.
     */
    static async updateContact(req, res) {
        try {
            const { contactId } = req.params;
            const updateData = req.body;
            if (!contactId) return res.respond({ status: 400, message: 'Contact ID is required.' });
            if (!updateData || Object.keys(updateData).length === 0) return res.respond({ status: 400, message: 'Update data is required.' });
            const data = await JunoBitsoService.updateContact(contactId, updateData);
            return res.respond({ status: 200, message: 'Contact updated successfully.', data });
        } catch (error) {
            return res.respond({ status: 500, message: 'Internal Server Error', error: error.message });
        }
    }
}

export default JunoBitsoController;
