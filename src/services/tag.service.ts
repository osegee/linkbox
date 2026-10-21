import { prisma } from "../config/prisma";
import AppError from "../utils/appError";
import {
  createTagInput,
  updateTagInput,
  attachTagsInput,
} from "../schemas/tag.schema";

export const createTagService = async (
  { name }: createTagInput,
  userId: string
) => {
  const exists = await prisma.tag.findUnique({
    where: {
      userId_name: { userId, name },
    },
  });

  if (exists) {
    throw new AppError(409, `Tag "#${name}" already exists`);
  }

  return await prisma.tag.create({
    data: { name, userId },
  });
};

export const getTagsService = async (userId: string) => {
  return await prisma.tag.findMany({
    where: { userId },
    include: {
      _count: {
        select: { linkTags: true }, 
      },
    },
    orderBy: { name: "asc" },
  });
};


export const updateTagService = async (
  userId: string,
  tagId: string,
  { name }: updateTagInput
) => {
  const existing = await prisma.tag.findFirst({
    where: { id: tagId, userId },
  });

  if (!existing) {
    throw new AppError(404, "Tag not found");
  }

  if (name !== existing.name) {
    const duplicate = await prisma.tag.findUnique({
      where: {
        userId_name: { userId, name },
      },
    });

    if (duplicate) {
      throw new AppError(409, `Tag "#${name}" already exists`);
    }
  }

  return await prisma.tag.update({
    where: { id: tagId },
    data: { name },
  });
};

export const deleteTagService = async (userId: string, tagId: string) => {
  const deleted = await prisma.tag.deleteMany({
    where: { id: tagId, userId },
  });

  if (deleted.count === 0) {
    throw new AppError(404, "Tag not found");
  }
};


export const attachTagsToLinkService = async (
  userId: string,
  linkId: string,
  { tags }: attachTagsInput
) => {

  const link = await prisma.link.findFirst({
    where: { id: linkId, userId },
  });

  if (!link) {
    throw new AppError(404, "Link not found");
  }

  const uniqueTagNames = Array.from(new Set(tags));

  
  await prisma.tag.createMany({
    data: uniqueTagNames.map((name) => ({ name, userId })),
    skipDuplicates: true,
  });

  const tagRecords = await prisma.tag.findMany({
    where: {
      userId,
      name: { in: uniqueTagNames },
    },
  });

  
  await prisma.linkTag.createMany({
    data: tagRecords.map((tag) => ({
      linkId: link.id,
      tagId: tag.id,
    })),
    skipDuplicates: true,
  });

  return tagRecords;
};


export const detachTagFromLinkService = async (
  userId: string,
  linkId: string,
  tagId: string
) => {
  
  const link = await prisma.link.findFirst({
    where: { id: linkId, userId },
  });

  if (!link) {
    throw new AppError(404, "Link not found");
  }

  
  const deleted = await prisma.linkTag.deleteMany({
    where: {
      linkId,
      tagId,
    },
  });

  if (deleted.count === 0) {
    throw new AppError(404, "Tag is not attached to this link");
  }
};