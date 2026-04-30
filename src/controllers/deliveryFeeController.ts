import { Request, Response } from "express";
import ExcelJS from "exceljs";
import deliveryFeeService from "../services/deliveryFeeService";
import { DeliveryFeeImportModel } from "../models/deliveryFeeImportModel";
import DeliveryFeeModel from "../models/deliveryFeeModel";
import { StateModel } from "../models/stateModel";
import { CityModel } from "../models/cityModel";
import { sendResponse } from "../utils/ApiHandler/ApiResponse";
import { ErrorHandler } from "../utils/errorHandler/errorHandler";
import { Types } from "mongoose";
import { AuthenticatedRequest } from "../middleware/authentication";
import auditLog from "../services/adminDeliveryFeeAuditLogService";

// ─── helpers ─────────────────────────────────────────────────────────────────
const toOid = (id: string) => new Types.ObjectId(id);

// ─── GET /delivery-fees ───────────────────────────────────────────────────────
export const getAllDeliveryFees = async (req: Request, res: Response) => {
    try {
        const fees = await deliveryFeeService.getAll();
        if (!fees.length) return sendResponse(res, 200, "No delivery fees found!", []);
        return sendResponse(res, 200, "Delivery Fees fetched successfully!", fees);
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};

// ─── GET /delivery-fees/template ─────────────────────────────────────────────
export const downloadTemplate = async (req: Request, res: Response) => {
    try {
        const states = await StateModel.find({ status: "active" }).lean();
        const cities = await CityModel.find({ status: "active" }).lean();

        const workbook = new ExcelJS.Workbook();

        // Sheet 1: Template
        const sheet = workbook.addWorksheet("Delivery Fee Template");
        sheet.addRow(["Pickup State", "Pickup City", "Destination State", "Destination City", "Base Fee", "Multiplier (%)"]);
        sheet.getRow(1).font = { bold: true };
        sheet.columns.forEach(col => { col.width = 22; });

        // Sheet 2: States (hidden)
        const stateSheet = workbook.addWorksheet("States");
        stateSheet.addRow(["State ID", "State Name"]);
        states.forEach(s => stateSheet.addRow([s._id.toString(), s.name]));
        stateSheet.state = "hidden";

        // Sheet 3: Cities (hidden)
        const citySheet = workbook.addWorksheet("Cities");
        citySheet.addRow(["City ID", "City Name", "State ID"]);
        cities.forEach(c => citySheet.addRow([c._id.toString(), c.name, (c as any).stateId.toString()]));
        citySheet.state = "hidden";

        const stateRange = `States!$B$2:$B$${states.length + 1}`;
        const cityRange = `Cities!$B$2:$B$${cities.length + 1}`;

        for (let i = 2; i <= 1000; i++) {
            sheet.getCell(`A${i}`).dataValidation = { type: "list", allowBlank: true, formulae: [stateRange] };
            sheet.getCell(`B${i}`).dataValidation = { type: "list", allowBlank: true, formulae: [cityRange] };
            sheet.getCell(`C${i}`).dataValidation = { type: "list", allowBlank: true, formulae: [stateRange] };
            sheet.getCell(`D${i}`).dataValidation = { type: "list", allowBlank: true, formulae: [cityRange] };
        }

        const buffer = await workbook.xlsx.writeBuffer();
        res.setHeader("Content-Disposition", `attachment; filename="delivery_fee_template.xlsx"`);
        res.setHeader("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
        return res.send(buffer);
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};

// ─── POST /delivery-fees/import ───────────────────────────────────────────────
export const importDeliveryFeePreview = async (req: AuthenticatedRequest, res: Response) => {
    try {
        if (!req.file) return ErrorHandler.badUserInput(res, "Excel file is required.");

        const adminId = (req.user as any)?._id || (req.user as any)?.userId;
        if (!adminId) return ErrorHandler.unauthorized(res, "Unauthorized");

        const workbook = new ExcelJS.Workbook();
        await workbook.xlsx.readFile(req.file.path);

        const sheet = workbook.getWorksheet("Delivery Fee Template");
        const stateSheet = workbook.getWorksheet("States");
        const citySheet = workbook.getWorksheet("Cities");

        if (!sheet || !stateSheet || !citySheet) {
            return ErrorHandler.badUserInput(res, "Invalid template. Please use the official download template.");
        }

        // Build lookup maps from helper sheets
        const stateNameToId = new Map<string, string>();
        stateSheet.eachRow((row, i) => {
            if (i === 1) return;
            const id = row.getCell(1).text.trim();
            const name = row.getCell(2).text.trim();
            if (id && name) stateNameToId.set(name.toLowerCase(), id);
        });

        const cityNameToId = new Map<string, string>();
        citySheet.eachRow((row, i) => {
            if (i === 1) return;
            const id = row.getCell(1).text.trim();
            const name = row.getCell(2).text.trim();
            if (id && name) cityNameToId.set(name.toLowerCase(), id);
        });

        const previewRows: any[] = [];
        const errors: string[] = [];

        sheet.eachRow((row, rowIndex) => {
            if (rowIndex === 1) return;
            const pickupStateName = row.getCell(1).text.trim();
            const pickupCityName = row.getCell(2).text.trim();
            const destStateName = row.getCell(3).text.trim();
            const destCityName = row.getCell(4).text.trim();
            let baseFee = Number(row.getCell(5).text.trim());
            let multiplier = Number(row.getCell(6).text.trim());

            if (!pickupStateName && !pickupCityName && !destStateName && !destCityName) return;

            const pickupStateId = stateNameToId.get(pickupStateName.toLowerCase());
            const pickupCityId = cityNameToId.get(pickupCityName.toLowerCase());
            const destStateId = stateNameToId.get(destStateName.toLowerCase());
            const destCityId = cityNameToId.get(destCityName.toLowerCase());

            if (!pickupStateId) { errors.push(`Row ${rowIndex}: Pickup state "${pickupStateName}" not found.`); return; }
            if (!pickupCityId) { errors.push(`Row ${rowIndex}: Pickup city "${pickupCityName}" not found.`); return; }
            if (!destStateId) { errors.push(`Row ${rowIndex}: Destination state "${destStateName}" not found.`); return; }
            if (!destCityId) { errors.push(`Row ${rowIndex}: Destination city "${destCityName}" not found.`); return; }
            if (isNaN(baseFee) || baseFee < 0) baseFee = 0;
            if (isNaN(multiplier) || multiplier < 0) multiplier = 0;

            previewRows.push({
                pickupState: toOid(pickupStateId),
                pickupStateLabel: pickupStateName,
                pickupCity: toOid(pickupCityId),
                pickupCityLabel: pickupCityName,
                destinationState: toOid(destStateId),
                destinationStateLabel: destStateName,
                destinationCity: toOid(destCityId),
                destinationCityLabel: destCityName,
                baseFee,
                multiplier,
            });
        });

        if (errors.length) {
            return ErrorHandler.badUserInput(res, `Import errors:\n${errors.join("\n")}`);
        }

        // Determine row statuses
        const enrichedRows = await Promise.all(
            previewRows.map(async (row) => {
                const existing = await deliveryFeeService.findByCombination(
                    row.pickupState.toString(),
                    row.pickupCity.toString(),
                    row.destinationState.toString(),
                    row.destinationCity.toString()
                );
                let rowStatus: "new" | "duplicate" | "inactive_match" = "new";
                let existingDocId: Types.ObjectId | null = null;

                if (existing) {
                    existingDocId = existing._id as Types.ObjectId;
                    rowStatus = existing.status === "active" ? "duplicate" : "inactive_match";
                }
                return { ...row, rowStatus, existingDocId };
            })
        );

        const expiresAt = new Date(Date.now() + 24 * 60 * 60 * 1000);
        const importSession = await DeliveryFeeImportModel.create({
            uploadedBy: toOid(adminId.toString()),
            rows: enrichedRows,
            expiresAt,
        });

        return sendResponse(res, 200, "Preview ready.", {
            importId: importSession._id,
            expiresAt,
            rows: enrichedRows,
            summary: {
                total: enrichedRows.length,
                new: enrichedRows.filter(r => r.rowStatus === "new").length,
                duplicate: enrichedRows.filter(r => r.rowStatus === "duplicate").length,
                inactive_match: enrichedRows.filter(r => r.rowStatus === "inactive_match").length,
            },
        });
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};

// ─── POST /delivery-fees/import/:importId/confirm ─────────────────────────────
export const confirmDeliveryFeeImport = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { importId } = req.params;
        const { action } = req.body;

        if (!["merge", "replace_all"].includes(action)) {
            return ErrorHandler.badUserInput(res, `action must be "merge" or "replace_all".`);
        }

        const session = await DeliveryFeeImportModel.findById(importId);
        if (!session) return ErrorHandler.notFound(res, "Import session not found or expired.");

        const rows = session.rows as any[];
        let inserted = 0, reactivated = 0, updated = 0;

        for (const row of rows) {
            if (action === "merge") {
                if (row.rowStatus === "duplicate") continue;

                if (row.rowStatus === "inactive_match" && row.existingDocId) {
                    await DeliveryFeeModel.findByIdAndUpdate(row.existingDocId, { status: "active", baseFee: row.baseFee, multiplier: row.multiplier });
                    reactivated++;
                    continue;
                }

                await DeliveryFeeModel.create({
                    pickupState: row.pickupState, pickupCity: row.pickupCity,
                    destinationState: row.destinationState, destinationCity: row.destinationCity,
                    baseFee: row.baseFee, multiplier: row.multiplier, status: "active",
                });
                inserted++;
            } else {
                // replace_all
                if (row.existingDocId) {
                    await DeliveryFeeModel.findByIdAndUpdate(row.existingDocId, { status: "active", baseFee: row.baseFee, multiplier: row.multiplier });
                    updated++;
                } else {
                    await DeliveryFeeModel.create({
                        pickupState: row.pickupState, pickupCity: row.pickupCity,
                        destinationState: row.destinationState, destinationCity: row.destinationCity,
                        baseFee: row.baseFee, multiplier: row.multiplier, status: "active",
                    });
                    inserted++;
                }
            }
        }

        await DeliveryFeeImportModel.findByIdAndDelete(importId);
        auditLog.log({ action: "create", performedBy: req.user!.userId, resource: "delivery_fee_import", resourceId: new Types.ObjectId(importId), details: { mode: action, inserted, reactivated, updated, importId } });
        return sendResponse(res, 200, "Import confirmed successfully.", { inserted, reactivated, updated });
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};

// ─── POST /delivery-fees ──────────────────────────────────────────────────────
export const createDeliveryFee = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { pickupStateId, pickupCityId, destinationStateId, destinationCityId, baseFee, multiplier } = req.body;

        if (!pickupStateId || !pickupCityId || !destinationStateId || !destinationCityId || baseFee === undefined) {
            return ErrorHandler.badUserInput(res, "pickupStateId, pickupCityId, destinationStateId, destinationCityId, and baseFee are required.");
        }

        for (const [field, val] of Object.entries({ pickupStateId, pickupCityId, destinationStateId, destinationCityId })) {
            if (!Types.ObjectId.isValid(val as string)) return ErrorHandler.badUserInput(res, `${field} is not a valid ID.`);
        }

        const existing = await deliveryFeeService.findByCombination(pickupStateId, pickupCityId, destinationStateId, destinationCityId);

        if (existing) {
            if (existing.status === "active") {
                return ErrorHandler.badUserInput(res, "A delivery fee for this combination already exists.");
            }
            const reactivated = await deliveryFeeService.update(existing._id!.toString(), {
                status: "active",
                baseFee: Number(baseFee),
                multiplier: Number(multiplier) || 0,
            });
            auditLog.log({ action: "create", performedBy: req.user!.userId, resource: "delivery_fee", resourceId: existing._id!, details: { pickupStateId, pickupCityId, destinationStateId, destinationCityId, baseFee, reactivated: true } });
            return sendResponse(res, 200, "Delivery fee re-activated successfully.", reactivated);
        }

        const fee = await deliveryFeeService.create({
            pickupState: toOid(pickupStateId),
            pickupCity: toOid(pickupCityId),
            destinationState: toOid(destinationStateId),
            destinationCity: toOid(destinationCityId),
            baseFee: Number(baseFee),
            multiplier: Number(multiplier) || 0,
            status: "active",
        } as any);

        auditLog.log({ action: "create", performedBy: req.user!.userId, resource: "delivery_fee", resourceId: fee._id!, details: { pickupStateId, pickupCityId, destinationStateId, destinationCityId, baseFee } });
        return sendResponse(res, 201, "Delivery fee created successfully.", fee);
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};

// ─── PATCH /delivery-fees/:id ─────────────────────────────────────────────────
export const updateDeliveryFee = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const { pickupStateId, pickupCityId, destinationStateId, destinationCityId, baseFee, multiplier } = req.body;

        const existing = await deliveryFeeService.getById(id);
        if (!existing || existing.status === "inactive") return ErrorHandler.notFound(res, "Delivery fee not found.");

        const newPickupState = pickupStateId ? toOid(pickupStateId) : existing.pickupState;
        const newPickupCity = pickupCityId ? toOid(pickupCityId) : existing.pickupCity;
        const newDestState = destinationStateId ? toOid(destinationStateId) : existing.destinationState;
        const newDestCity = destinationCityId ? toOid(destinationCityId) : existing.destinationCity;

        const combinationChanged =
            newPickupState.toString() !== existing.pickupState.toString() ||
            newPickupCity.toString() !== existing.pickupCity.toString() ||
            newDestState.toString() !== existing.destinationState.toString() ||
            newDestCity.toString() !== existing.destinationCity.toString();

        if (combinationChanged) {
            const clash = await deliveryFeeService.findByCombination(
                newPickupState.toString(), newPickupCity.toString(), newDestState.toString(), newDestCity.toString()
            );
            if (clash && clash._id!.toString() !== id) {
                return ErrorHandler.badUserInput(res, clash.status === "active"
                    ? "A delivery fee for this combination already exists."
                    : "An inactive delivery fee for this combination exists."
                );
            }
        }

        const changedFields: Record<string, any> = {};
        if (pickupStateId) changedFields.pickupStateId = pickupStateId;
        if (pickupCityId) changedFields.pickupCityId = pickupCityId;
        if (destinationStateId) changedFields.destinationStateId = destinationStateId;
        if (destinationCityId) changedFields.destinationCityId = destinationCityId;
        if (baseFee !== undefined) changedFields.baseFee = Number(baseFee);
        if (multiplier !== undefined) changedFields.multiplier = Number(multiplier);

        const updated = await deliveryFeeService.update(id, {
            pickupState: newPickupState as any,
            pickupCity: newPickupCity as any,
            destinationState: newDestState as any,
            destinationCity: newDestCity as any,
            ...(baseFee !== undefined && { baseFee: Number(baseFee) }),
            ...(multiplier !== undefined && { multiplier: Number(multiplier) }),
        });

        auditLog.log({ action: "update", performedBy: req.user!.userId, resource: "delivery_fee", resourceId: id, details: { changedFields } });
        return sendResponse(res, 200, "Delivery fee updated successfully.", updated);
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};

// ─── DELETE /delivery-fees/:id ────────────────────────────────────────────────
export const deleteDeliveryFee = async (req: AuthenticatedRequest, res: Response) => {
    try {
        const { id } = req.params;
        const existing = await deliveryFeeService.getById(id);
        if (!existing || existing.status === "inactive") return ErrorHandler.notFound(res, "Delivery fee not found.");
        await deliveryFeeService.softDelete(id);
        auditLog.log({ action: "delete", performedBy: req.user!.userId, resource: "delivery_fee", resourceId: id, details: { pickupState: existing.pickupState?.toString(), pickupCity: existing.pickupCity?.toString(), destinationState: existing.destinationState?.toString(), destinationCity: existing.destinationCity?.toString() } });
        return sendResponse(res, 200, "Delivery fee deleted successfully.");
    } catch (error: any) {
        return ErrorHandler.internalServerError(res, error.message);
    }
};
