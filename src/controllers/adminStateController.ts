import { Request, Response } from "express";
import { StateModel } from "../models/stateModel";
import { CityModel } from "../models/cityModel";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { AuthenticatedRequest } from "../middleware/authentication";
import auditLog from "../services/adminDeliveryFeeAuditLogService";

// ─────────────────────────────────────────────
// STATE ENDPOINTS
// ─────────────────────────────────────────────

/**
 * POST /api/v1/admin/states
 * Create a new state. If it already exists but is inactive, toggle it back to active.
 */
export const createState = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
    try {
        const { name } = req.body;
        if (!name || !name.trim()) {
            return ErrorHandler.badUserInput(res, "State name is required.");
        }

        const normalizedName = name.trim().toLowerCase();

        // Check if state already exists (any status)
        const existing = await StateModel.findOne({ normalizedName });

        if (existing) {
            if (existing.status === "active") {
                return ErrorHandler.badUserInput(res, `State "${existing.name}" already exists.`);
            }

            // Toggle inactive → active
            existing.status = "active";
            existing.name = name.trim();
            existing.normalizedName = normalizedName;
            await existing.save();
            auditLog.log({ action: "create", performedBy: req.user!.userId, resource: "state", resourceId: existing._id, details: { name: existing.name, reactivated: true } });
            return sendResponse(res, 200, "State re-activated successfully.", existing);
        }

        const state = await StateModel.create({ name: name.trim(), normalizedName });
        auditLog.log({ action: "create", performedBy: req.user!.userId, resource: "state", resourceId: state._id, details: { name: state.name } });
        return sendResponse(res, 201, "State created successfully.", state);
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};

/**
 * GET /api/v1/admin/states
 * List all active states.
 */
export const getStates = async (req: Request, res: Response): Promise<Response | undefined> => {
    try {
        const states = await StateModel.find({ status: "active" }).sort({ name: 1 });
        return sendResponse(res, 200, "States fetched successfully.", states);
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};

/**
 * PATCH /api/v1/admin/states/:stateId
 * Edit the name of a state. Normalizes and checks for duplicates among active states.
 */
// export const updateState = async (req: Request, res: Response): Promise<Response | undefined> => {
//     try {
//         const { stateId } = req.params;
//         const { name } = req.body;

//         if (!name || !name.trim()) {
//             return ErrorHandler.badUserInput(res, "New state name is required.");
//         }

//         const state = await StateModel.findById(stateId);
//         if (!state || state.status === "inactive") {
//             return ErrorHandler.notFound(res, "State not found.");
//         }

//         const normalizedName = name.trim().toLowerCase();

//         // Make sure the new name doesn't clash with another active state
//         if (normalizedName !== state.normalizedName) {
//             const conflict = await StateModel.findOne({ normalizedName, status: "active" });
//             if (conflict) {
//                 return ErrorHandler.badUserInput(res, `A state named "${conflict.name}" already exists.`);
//             }
//         }

//         state.name = name.trim();
//         state.normalizedName = normalizedName;
//         await state.save();

//         return sendResponse(res, 200, "State updated successfully.", state);
//     } catch (error: any) {
//         return ErrorHandler.internalServerError(res, error.message);
//     }
// };

/**
 * DELETE /api/v1/admin/states/:stateId
 * Soft-delete a state and all its cities.
 */
export const deleteState = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
    try {
        const { stateId } = req.params;

        const state = await StateModel.findById(stateId);
        if (!state || state.status === "inactive") {
            return ErrorHandler.notFound(res, "State not found.");
        }

        state.status = "inactive";
        await state.save();

        // Soft-delete all cities belonging to this state
        await CityModel.updateMany({ stateId, status: "active" }, { status: "inactive" });

        auditLog.log({ action: "delete", performedBy: req.user!.userId, resource: "state", resourceId: state._id, details: { name: state.name } });
        return sendResponse(res, 200, "State and its cities deleted successfully.");
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};

// ─────────────────────────────────────────────
// CITY ENDPOINTS
// ─────────────────────────────────────────────

/**
 * POST /api/v1/admin/states/:stateId/cities
 * Add a city to a state. If it already exists but is inactive, toggle it back to active.
 */
export const createCity = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
    try {
        const { stateId } = req.params;
        const { name } = req.body;

        if (!name || !name.trim()) {
            return ErrorHandler.badUserInput(res, "City name is required.");
        }

        const state = await StateModel.findById(stateId);
        if (!state || state.status === "inactive") {
            return ErrorHandler.notFound(res, "State not found.");
        }

        const normalizedName = name.trim().toLowerCase();

        // Check if city already exists in this state (any status)
        const existing = await CityModel.findOne({ normalizedName, stateId });

        if (existing) {
            if (existing.status === "active") {
                return ErrorHandler.badUserInput(res, `City "${existing.name}" already exists in this state.`);
            }

            // Toggle inactive → active
            existing.status = "active";
            existing.name = name.trim();
            existing.normalizedName = normalizedName;
            await existing.save();
            auditLog.log({ action: "create", performedBy: req.user!.userId, resource: "city", resourceId: existing._id, details: { name: existing.name, stateId, stateName: state.name, reactivated: true } });
            return sendResponse(res, 200, "City re-activated successfully.", existing);
        }

        const city = await CityModel.create({ name: name.trim(), normalizedName, stateId });
        auditLog.log({ action: "create", performedBy: req.user!.userId, resource: "city", resourceId: city._id, details: { name: city.name, stateId, stateName: state.name } });
        return sendResponse(res, 201, "City created successfully.", city);
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};

/**
 * GET /api/v1/admin/states/:stateId/cities
 * List all active cities for a given state.
 */
export const getCitiesByState = async (req: Request, res: Response): Promise<Response | undefined> => {
    try {
        const { stateId } = req.params;

        const state = await StateModel.findById(stateId);
        if (!state || state.status === "inactive") {
            return ErrorHandler.notFound(res, "State not found.");
        }

        const cities = await CityModel.find({ stateId, status: "active" }).sort({ name: 1 });
        return sendResponse(res, 200, "Cities fetched successfully.", cities);
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};

/**
 * PATCH /api/v1/admin/states/:stateId/cities/:cityId
 * Edit a city name. Normalizes and checks for duplicates within the same state.
 */
// export const updateCity = async (req: Request, res: Response): Promise<Response | undefined> => {
//     try {
//         const { stateId, cityId } = req.params;
//         const { name } = req.body;

//         if (!name || !name.trim()) {
//             return ErrorHandler.badUserInput(res, "New city name is required.");
//         }

//         const city = await CityModel.findOne({ _id: cityId, stateId });
//         if (!city || city.status === "inactive") {
//             return ErrorHandler.notFound(res, "City not found.");
//         }

//         const normalizedName = name.trim().toLowerCase();

//         // Check for name clash with another active city in the same state
//         if (normalizedName !== city.normalizedName) {
//             const conflict = await CityModel.findOne({ normalizedName, stateId, status: "active" });
//             if (conflict) {
//                 return ErrorHandler.badUserInput(res, `A city named "${conflict.name}" already exists in this state.`);
//             }
//         }

//         city.name = name.trim();
//         city.normalizedName = normalizedName;
//         await city.save();

//         return sendResponse(res, 200, "City updated successfully.", city);
//     } catch (error: any) {
//         return ErrorHandler.internalServerError(res, error.message);
//     }
// };

/**
 * DELETE /api/v1/admin/states/:stateId/cities/:cityId
 * Soft-delete a city.
 */
export const deleteCity = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
    try {
        const { stateId, cityId } = req.params;

        const city = await CityModel.findOne({ _id: cityId, stateId });
        if (!city || city.status === "inactive") {
            return ErrorHandler.notFound(res, "City not found.");
        }

        city.status = "inactive";
        await city.save();

        auditLog.log({ action: "delete", performedBy: req.user!.userId, resource: "city", resourceId: city._id, details: { name: city.name, stateId } });
        return sendResponse(res, 200, "City deleted successfully.");
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};

// ─── DELIVERY COVERAGE ────────────────────────────────────────────────────────

/**
 * PATCH /api/v1/admin/states/:stateId/delivery-covered
 * Toggle deliveryCovered on a state (admin only).
 */
export const toggleDeliveryCovered = async (req: AuthenticatedRequest, res: Response): Promise<Response | undefined> => {
    try {
        const { stateId } = req.params;

        const state = await StateModel.findOne({ _id: stateId, status: "active" });
        if (!state) {
            return ErrorHandler.notFound(res, "State not found.");
        }

        state.deliveryCovered = !state.deliveryCovered;
        await state.save();

        auditLog.log({ action: "update", performedBy: req.user!.userId, resource: "state", resourceId: state._id, details: { stateName: state.name, deliveryCovered: state.deliveryCovered } });
        return sendResponse(res, 200, `Delivery coverage ${state.deliveryCovered ? "enabled" : "disabled"} for ${state.name}.`, { deliveryCovered: state.deliveryCovered });
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};

/**
 * GET /api/v1/states/delivery-covered
 * Public — returns active states where deliveryCovered is true.
 */
export const getDeliveryCoveredStates = async (_req: Request, res: Response): Promise<Response | undefined> => {
    try {
        const states = await StateModel.find({ status: "active", deliveryCovered: true }).select("name normalizedName").lean();
        return sendResponse(res, 200, "Delivery-covered states fetched.", { states });
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};

/**
 * Public — checks whether a specific state has delivery covered.
 * GET /states/:stateId/delivery-covered
 */
export const checkStateDeliveryCoverage = async (req: Request, res: Response): Promise<Response | undefined> => {
    try {
        const { stateId } = req.params;
        const state = await StateModel.findById(stateId).select("name normalizedName deliveryCovered status").lean();

        if (!state) {
            return sendResponse(res, 404, "State not found.", null);
        }

        const covered = state.status === "active" && state.deliveryCovered === true;
        return sendResponse(res, 200, "State delivery coverage fetched.", {
            stateId,
            name: state.name,
            normalizedName: state.normalizedName,
            deliveryCovered: covered,
        });
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};
