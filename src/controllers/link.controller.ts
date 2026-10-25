import { Request, Response, NextFunction } from "express";
import {
  createLinkService,
  getLinksService,
  getLinkByIdService,
  updateLinkService,
  deleteLinkService,
} from "../services/link.service";
import { createLinkInput, updateLinkInput } from "../schemas/link.schema";

export const createLinkController = async (
  req: Request<{}, {}, createLinkInput>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const result = await createLinkService(userId, req.body);

    return res.status(201).json({
      success: true,
      message: "Link created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getLinksController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const collectionId = req.query.collectionId as string | undefined;

    const result = await getLinksService(userId, collectionId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const getLinkByIdController = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const result = await getLinkByIdService(userId, req.params.id);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const updateLinkController = async (
  req: Request<{ id: string }, {}, updateLinkInput>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const result = await updateLinkService(userId, req.params.id, req.body);

    return res.status(200).json({
      success: true,
      message: "Link updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const deleteLinkController = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    await deleteLinkService(userId, req.params.id);

    return res.status(200).json({
      success: true,
      message: "Link deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};
