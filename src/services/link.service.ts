import { prisma } from "../config/prisma";
import AppError from "../utils/appError";
import { parseAndCleanUrl } from "../utils/url";
import { createLinkInput, updateLinkInput } from "../schemas/link.schema";
import { linkQueue } from "../queues/link.queue";

export const createLinkService = async (
  userId: string,
  data: createLinkInput,
) => {
  const { originalUrl, canonicalUrl, domain } = parseAndCleanUrl(data.url);

  const existingLink = await prisma.link.findFirst({
    where: { userId, canonicalUrl },
  });

  if (existingLink) {
    throw new AppError(409, "You have already saved this link");
  }

  if (data.collectionId) {
    const collection = await prisma.collection.findFirst({
      where: { id: data.collectionId, userId },
    });

    if (!collection) {
      throw new AppError(404, "Collection not found");
    }
  }

  const newLink = await prisma.link.create({
    data: {
      userId,
      url: originalUrl,
      canonicalUrl,
      domain,
      collectionId: data.collectionId,
      note: data.note,
      status: "PENDING",
    },
  });

  await linkQueue.add("scrape-link", {
    linkId: newLink.id,
    url: newLink.url,
  });

  return newLink;
};

export const getLinksService = async (
  userId: string,
  collectionId?: string,
) => {
  return await prisma.link.findMany({
    where: {
      userId,
      ...(collectionId && { collectionId }),
    },
    orderBy: { createdAt: "desc" },
    include: {
      collection: { select: { id: true, name: true } },
      linkTags: {
        include: {
          tag: { select: { id: true, name: true } },
        },
      },
    },
  });
};

export const getLinkByIdService = async (userId: string, linkId: string) => {
  const link = await prisma.link.findFirst({
    where: { id: linkId, userId },
    include: {
      collection: { select: { id: true, name: true } },
      linkTags: {
        include: {
          tag: { select: { id: true, name: true } },
        },
      },
    },
  });

  if (!link) {
    throw new AppError(404, "Link not found");
  }

  return link;
};

export const updateLinkService = async (
  userId: string,
  linkId: string,
  data: updateLinkInput,
) => {
  const existing = await prisma.link.findFirst({
    where: { id: linkId, userId },
  });

  if (!existing) {
    throw new AppError(404, "Link not found");
  }

  return await prisma.link.update({
    where: { id: linkId },
    data,
  });
};

export const deleteLinkService = async (userId: string, linkId: string) => {
  const deleted = await prisma.link.deleteMany({
    where: { id: linkId, userId },
  });

  if (deleted.count === 0) {
    throw new AppError(404, "Link not found");
  }
};
