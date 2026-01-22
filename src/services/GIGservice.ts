import { GIGinstance, credentials } from "../config/GIGconfig";
import { GIGShippingRequest } from "../interfaces/interface";
import { GIGAuthCache } from "../models/GIGAuthCache";



// GIGService class to handle GIG API requests
export class GIGService {
  private static CACHE_EXPIRY_MINUTES = process.env.GIG_CACHE_EXPIRY 
    ? parseInt(process.env.GIG_CACHE_EXPIRY) 
    : 300; // Default 5 hours
  // private static authToken: string = "";
  // private static userId: string = "";


    // Get cached auth if valid
    private static async getCachedAuth(): Promise<{ authToken: string; userId: string } | null> {
      try {
        const cache = await GIGAuthCache.findOne({ serviceName: 'GIG' })
          .sort({ createdAt: -1 })
          .exec();
  
        if (cache && cache.expiresAt > new Date()) {
          return {
            authToken: cache.authToken,
            userId: cache.userId
          };
        }
        return null;
      } catch (error) {
        console.error('Cache read error:', error);
        return null; // Fail gracefully - will trigger new auth
      }
    }
  
    // Cache new auth data
    private static async cacheAuth(token: string, userId: string): Promise<void> {
      try {
        const expiresAt = new Date();
        expiresAt.setMinutes(expiresAt.getMinutes() + this.CACHE_EXPIRY_MINUTES);
  
        await GIGAuthCache.create({
          authToken: token,
          userId,
          expiresAt
        });
      } catch (error) {
        console.error('Cache write error:', error);
        // Fail silently - we still have the token in memory for this instance
      }
    }


  // Clear cache (for example, when token is invalid)
  private static async clearCache(): Promise<void> {
    try {
      await GIGAuthCache.deleteMany({ serviceName: 'GIG' });
    } catch (error) {
      console.error('Cache clear error:', error);
    }
  }


  // Authenticate and cache token
  private static async authenticate(): Promise<{ authToken: string; userId: string }> {
    // // If we already have both the authToken and userId, return them
    // if (this.authToken && this.userId) {
    //   return {
    //     authToken: this.authToken,
    //     userId: this.userId
    //   };
    // }
  
    try {
      // 1. Try to get valid cached credentials
      const cachedAuth = await this.getCachedAuth();
      if (cachedAuth) {
        return cachedAuth;
      }

      // 2. If no valid cache, authenticate with API
      const response = await GIGinstance.post("/login", credentials);
      const authData = {
        authToken: response.data.data.token,
        userId: response.data.data.userId
      };

      // 3. Cache the new credentials
      await this.cacheAuth(authData.authToken, authData.userId);
      
      return authData;

    } catch (error: any) {
      throw new Error(`Authentication failed: ${error.response?.data?.message || error.message}`);
    }
  }

  // Get Shipping Price
public static async getShippingPrice(data: GIGShippingRequest): Promise<{
  shippingData: any;
  userId?: string;
}> {
  const { authToken, userId } = await this.authenticate();

  try {
    // Add userId to the request data
    const requestData = {
      ...data,
      UserId: userId
    };

    const response = await GIGinstance.post("/price", requestData, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json"
      },
    });

    return {
      shippingData: response.data,
    };
  } catch (error: any) {
    // If auth error, clear cache and retry once
    if (error.response?.status === 401) {
      await this.clearCache();
      return this.getShippingPrice(data);
    }
    console.error("GIG API Error Response:", error.response?.data);
    throw new Error(`Failed to get shipping price: ${error.response?.data?.message || error.message}`);
  }
}



// Capture Shipment
public static async captureShipment(data: GIGShippingRequest): Promise<{
  captureData: any;
  userId?: string;
}> {
  const { authToken, userId } = await this.authenticate();

  try {
    // Add userId to the request data
    const requestData = {
      ...data,
      UserId: userId
    };
    const response = await GIGinstance.post("/captureshipment", requestData, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json"
      },
    });

    return {
      captureData: response.data,
    };
  } catch (error: any) {
    // If auth error, clear cache and retry once
    if (error.response?.status === 401) {
      await this.clearCache();
      return this.captureShipment(data);
    }
    throw new Error(`Failed to capture shipment: ${error.response?.data?.message || error.message}`);
  }
}


// Track Shipment
public static async trackShipment(waybillNumber: string): Promise<{
  trackingData: any;
}> {
  const { authToken } = await this.authenticate();

  try {
    const response = await GIGinstance.get(`/TrackAllShipment/${waybillNumber}`, {
      headers: {
        Authorization: `Bearer ${authToken}`,
        "Content-Type": "application/json"
      },
    });

    return {
      trackingData: response.data,
    };
  } catch (error: any) {
    // If auth error, clear cache and retry once
    if (error.response?.status === 401) {
      await this.clearCache();
      return this.trackShipment(waybillNumber);
    }
    throw new Error(`Failed to track shipment: ${error.response?.data?.message || error.message}`);
  }
}


  // Get Local Stations
  public static async getLocalStations(): Promise<{
    stationsData: any;
  }> {
    const { authToken } = await this.authenticate();

    try {
      const response = await GIGinstance.get("/localStations", {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json"
        },
      });

      return {
        stationsData: response.data,
      };
    } catch (error: any) {
      // If auth error, clear cache and retry once
      if (error.response?.status === 401) {
        await this.clearCache();
        return this.getLocalStations();
      }
      throw new Error(`Failed to get local stations: ${error.response?.data?.message || error.message}`);
    }
  }



  // Get Active GIGGO Locations
  public static async getActiveGIGGO(): Promise<{
    activeGIGGOData: any;
  }> {
    const { authToken } = await this.authenticate();

    try {
      const response = await GIGinstance.get("/getactivelgas", {
        headers: {
          Authorization: `Bearer ${authToken}`,
          "Content-Type": "application/json"
        },
      });

      return {
        activeGIGGOData: response.data,
      };
    } catch (error: any) {
      // If auth error, clear cache and retry once
      if (error.response?.status === 401) {
        await this.clearCache();
        return this.getActiveGIGGO();
      }
      throw new Error(`Failed to get active GIGGO locations: ${error.response?.data?.message || error.message}`);
    }
  }


}

