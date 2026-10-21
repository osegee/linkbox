import { Request, Response, NextFunction } from "express";
import {
  createCollectionService,
  getCollectionService,
  getCollectionByIdService,
  updateCollectionService,
  deleteCollectionService,
} from "../services/collection.service";

export const createCollectionController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id; 
    const result = await createCollectionService(req.body, userId);

    return res.status(201).json({
      success: true,
      message: "Collection created successfully",
      data: result, 
    });
  } catch (error) {
    next(error);
  }
};


export const getCollectionController = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const result = await getCollectionService(userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};


export const getCollectionByIdController = async (
  req: Request<{id: string}>,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const collectionId = req.params.id;

    const result = await getCollectionByIdService(userId, collectionId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};


export const updateCollectionController = async (
  req: Request<{id: string}>,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const collectionId = req.params.id;

    
    const result = await updateCollectionService(
      userId,
      collectionId,
      req.body
    );

    return res.status(200).json({
      success: true,
      message: "Collection updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};


export const deleteCollectionController = async (
  req: Request<{id: string}>,
  res: Response,
  next: NextFunction
) => {
  try {
    const userId = req.user!.id;
    const collectionId = req.params.id;

    await deleteCollectionService(userId, collectionId);

    return res.status(200).json({
      success: true,
      message: "Collection deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};