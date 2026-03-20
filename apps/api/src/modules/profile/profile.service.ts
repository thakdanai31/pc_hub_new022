import { prisma } from '../../config/database.js';
import { Prisma } from '../../generated/prisma/client.js';
import { AppError } from '../../common/errors.js';
import type { UpdateProfileBody } from './profile.schema.js';

interface ProfileData {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: string;
  isActive: boolean;
}

function toProfileData(user: {
  id: number;
  email: string;
  firstName: string;
  lastName: string;
  phoneNumber: string;
  role: string;
  isActive: boolean;
}): ProfileData {
  return {
    id: user.id,
    email: user.email,
    firstName: user.firstName,
    lastName: user.lastName,
    phoneNumber: user.phoneNumber,
    role: user.role,
    isActive: user.isActive,
  };
}

export async function getProfile(userId: number): Promise<ProfileData> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }
  return toProfileData(user);
}

export async function updateProfile(userId: number, body: UpdateProfileBody): Promise<ProfileData> {
  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    throw new AppError('User not found', 404, 'NOT_FOUND');
  }

  if (body.phoneNumber !== undefined) {
    const existingPhone = await prisma.user.findFirst({
      where: {
        phoneNumber: body.phoneNumber,
        id: { not: userId },
      },
      select: { id: true },
    });

    if (existingPhone) {
      throw new AppError('Phone number already registered', 409, 'PHONE_TAKEN');
    }
  }

  let updated;
  try {
    updated = await prisma.user.update({
      where: { id: userId },
      data: {
        ...(body.firstName !== undefined && { firstName: body.firstName }),
        ...(body.lastName !== undefined && { lastName: body.lastName }),
        ...(body.phoneNumber !== undefined && { phoneNumber: body.phoneNumber }),
      },
    });
  } catch (error) {
    if (
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2002'
    ) {
      throw new AppError('Phone number already registered', 409, 'PHONE_TAKEN');
    }

    throw error;
  }

  return toProfileData(updated);
}
