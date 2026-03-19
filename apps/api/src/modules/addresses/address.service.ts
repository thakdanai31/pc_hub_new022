import { prisma } from '../../config/database.js';
import { AppError } from '../../common/errors.js';
import type { CreateAddressBody, UpdateAddressBody } from './address.schema.js';

export async function listAddresses(userId: number) {
  return prisma.address.findMany({
    where: { userId },
    orderBy: [{ isDefault: 'desc' }, { createdAt: 'desc' }],
  });
}

export async function createAddress(userId: number, body: CreateAddressBody) {
  if (body.isDefault) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.address.create({
    data: { ...body, userId },
  });
}

async function findOwnedAddress(addressId: number, userId: number) {
  const address = await prisma.address.findFirst({
    where: { id: addressId, userId },
  });

  if (!address) {
    throw new AppError('Address not found', 404, 'NOT_FOUND');
  }

  return address;
}

export async function updateAddress(
  addressId: number,
  userId: number,
  body: UpdateAddressBody,
) {
  await findOwnedAddress(addressId, userId);

  if (body.isDefault) {
    await prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    });
  }

  return prisma.address.update({
    where: { id: addressId },
    data: body,
  });
}

export async function deleteAddress(addressId: number, userId: number) {
  await findOwnedAddress(addressId, userId);

  await prisma.address.delete({ where: { id: addressId } });
}

export async function setDefault(addressId: number, userId: number) {
  await findOwnedAddress(addressId, userId);

  await prisma.$transaction([
    prisma.address.updateMany({
      where: { userId, isDefault: true },
      data: { isDefault: false },
    }),
    prisma.address.update({
      where: { id: addressId },
      data: { isDefault: true },
    }),
  ]);

  return prisma.address.findUnique({ where: { id: addressId } });
}
