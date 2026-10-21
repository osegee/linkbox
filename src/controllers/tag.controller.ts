import { Response, Request, NextFunction } from "express";
import {
  deleteTagService,
  createTagService,
  getTagsService,
  updateTagService,
  attachTagsToLinkService,
  detachTagFromLinkService,
} from "../services/tag.service";


export const createTagController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const result = await createTagService(req.body, userId);

    return res.status(201).json({
      success: true,
      message: "Tag created successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};


export const getTagsController = async (
  req: Request,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const result = await getTagsService(userId);

    return res.status(200).json({
      success: true,
      data: result,
    });
  } catch (error) {
    next(error);
  }
};


export const updateTagController = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const tagId = req.params.id;
    const result = await updateTagService(userId, tagId, req.body);

    return res.status(200).json({
      success: true,
      message: "Tag updated successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};


export const deleteTagController = async (
  req: Request<{ id: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const tagId = req.params.id;
    await deleteTagService(userId, tagId);

    return res.status(200).json({
      success: true,
      message: "Tag deleted successfully",
    });
  } catch (error) {
    next(error);
  }
};


export const attachTagsToLinkController = async (
  req: Request<{ linkId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const { linkId } = req.params;
    const result = await attachTagsToLinkService(userId, linkId, req.body);

    return res.status(200).json({
      success: true,
      message: "Tags attached to link successfully",
      data: result,
    });
  } catch (error) {
    next(error);
  }
};

export const detachTagFromLinkController = async (
  req: Request<{ linkId: string; tagId: string }>,
  res: Response,
  next: NextFunction,
) => {
  try {
    const userId = req.user!.id;
    const { linkId, tagId } = req.params;

    await detachTagFromLinkService(userId, linkId, tagId);

    return res.status(200).json({
      success: true,
      message: "Tag detached from link successfully",
    });
  } catch (error) {
    next(error);
  }
};