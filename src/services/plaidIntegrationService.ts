import { Configuration, PlaidApi, PlaidEnvironments, Products, CountryCode } from 'plaid';


// Initialize the Plaid client with your credentials
class PlaidIntegrationService {
    private client: PlaidApi;
  
    constructor() {
      const configuration = new Configuration({
        basePath: PlaidEnvironments.sandbox,
        baseOptions: {
          headers: {
            'PLAID-CLIENT-ID': process.env.PLAID_CLIENT_ID!,
            'PLAID-SECRET': process.env.PLAID_SECRET!,
          },
        },
      });
      this.client = new PlaidApi(configuration);
    }
  
    async createLinkToken(user_id: string): Promise<{ link_token: string }> {
      try {
        const linkTokenResponse = await this.client.linkTokenCreate({
          user: {
            client_user_id: user_id,
          },
          client_name: 'Event Parcel',
          products: [Products.Auth], // <-- Use imported Products
          country_codes: [CountryCode.Us], // <-- Use imported CountryCode
          language: 'en',
        });
  
        return { link_token: linkTokenResponse.data.link_token };
      } catch (error: any) {
        console.error('Error creating link token:', error);
        throw new Error('Failed to create link token');
      }
    }
  
    async exchangePublicToken(public_token: string): Promise<{ access_token: string, item_id: string }> {
      try {
        const response = await this.client.itemPublicTokenExchange({ public_token });
        return {
          access_token: response.data.access_token,
          item_id: response.data.item_id,
        };
      } catch (error) {
        console.error('Error exchanging public token:', error);
        throw new Error('Failed to exchange public token');
      }
    }
  
    async getBankDetails(accessToken: string) {
      try {
        const response = await this.client.authGet({ access_token: accessToken });
  
        if (response?.data?.accounts?.length) {
          return response.data.accounts.map(account => ({
            name: account.name,
            official_name: account.official_name,
            account_id: account.account_id,
            subtype: account.subtype,
            routing: response.data.numbers?.ach?.find(num => num.account_id === account.account_id)?.routing,
            account_number: response.data.numbers?.ach?.find(num => num.account_id === account.account_id)?.account,
            mask: account.mask,
          }));
        } else {
          throw new Error('No bank accounts found.');
        }
      } catch (error: any) {
        console.error('Plaid Account Retrieval Error:', {
          message: error.message,
          stack: error.stack,
          response: error.response?.data,
        });
  
        if (error.response) {
          class PlaidError extends Error {
            statusCode?: number;
            details?: any;
          }
  
          const err = new PlaidError(error.response.data?.error_message || 'Plaid API error.');
          err.statusCode = error.response.status;
          err.details = error.response.data;
          throw err;
        } else if (error.request) {
          throw new Error('No response from Plaid server.');
        } else {
          throw new Error('Unexpected error occurred while retrieving bank details.');
        }
      }
    }
  }
  
  export default PlaidIntegrationService;
  