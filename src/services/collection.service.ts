import {
  createCollectionInput,
  updateCollectionInput,
} from "../schemas/collection.schema";
import { prisma } from "../config/prisma";
import AppError from "../utils/appError";

export const createCollectionService = async (
  { name, description }: createCollectionInput,
  userId: string,
) => {
  const exists = await prisma.collection.findUnique({
    where: { userId_name: { userId, name } },
  });

  if (exists) {
    throw new AppError(409, `Collection ${name} already exists`);
  }
  const collection = await prisma.collection.create({
    data: {
      name,
      description,
      userId,
    },
  });
  return collection;
};

export const getCollectionService = async (userId: string) => {
  const collection = await prisma.collection.findMany({
    where: { userId },
    include: {
      _count: {
        select: { links: true },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return collection;
};

export const getCollectionByIdService = async (
  userId: string,
  collectionId: string,
) => {
  const collection = await prisma.collection.findFirst({
    where: { id: collectionId, userId },
  });
  if (!collection) {
    throw new AppError(404, "collection not found");
  }

  return collection;
};

export const updateCollectionService = async (
  userId: string,
  collectionId: string,
  { name, description }: updateCollectionInput,
) => {
  const existing = await prisma.collection.findFirst({
    where: { id: collectionId, userId },
  });
  if (!existing) {
    throw new AppError(404, "collection not found");
  }

  if (name && name !== existing.name) {
    const duplicate = await prisma.collection.findUnique({
      where: {
        userId_name: { userId, name },
      },
    });

    if (duplicate) {
      throw new AppError(409, `Collection "${name}" already exists`);
    }
  }
  return await prisma.collection.update({
    where: { id: collectionId },
    data: { name, description },
  });
};

export const deleteCollectionService = async (
  userId: string,
  collectionId: string,
) => {
  const deleted = await prisma.collection.deleteMany({
    where: { id: collectionId, userId },
  });
  if (deleted.count === 0) {
    throw new AppError(404, "collection not found");
  }
};
