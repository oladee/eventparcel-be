declare module "hyperwallet-sdk" {
    interface HyperwalletOptions {
      username: string;
      password: string;
      programToken: string;
      server?: string;
    }
  
    interface User {
      clientUserId: string;
      profileType: string;
      firstName: string;
      lastName: string;
      email: string;
      addressLine1?: string;
      city?: string;
      stateProvince?: string;
      country?: string;
      postalCode?: string;
      dateOfBirth?: string;
      governmentId?: string;
      [key: string]: any;
    }
  
    interface Payment {
      destinationToken: string;
      clientPaymentId: string;
      amount: string;
      currency: string;
      purpose?: string;
    }
  
    interface BankAccount {
      transferMethodCountry: string;
      transferMethodCurrency: string;
      type: string;
      bankAccountPurpose: string;
      branchId: string;
      bankId: string;
      accountNumber: string;
    }
  
    type Callback<T = any> = (error: Error | null, body?: T, response?: any) => void;
  
    class Hyperwallet {
      constructor(options: HyperwalletOptions);
  
      createUser(user: User, callback: Callback): void;
      getUser(token: string, callback: Callback): void;
      listUsers(params: any, callback: Callback): void;
  
      createBankAccount(userToken: string, data: BankAccount, callback: Callback): void;
  
      createPayment(data: Payment, callback: Callback): void;
  
      // Add other methods as needed...
    }
  
    export default Hyperwallet;
}
  