import express, { Request, Response } from "express";
import { IApiResponse } from "../../interfaces/interface";

export const sendResponse = (
  res: Response,
  statusCode: number,
  message: string,
  data?: any,
  extraFields?: Record<string, any> // This allows you to pass custom key-value pairs
) => {
  const response: IApiResponse = {
    success: statusCode >= 200 && statusCode < 300,
    message,
    data,
    ...(extraFields || {}) // Spread any extra fields dynamically
  };
  return res.status(statusCode).json(response);
};
