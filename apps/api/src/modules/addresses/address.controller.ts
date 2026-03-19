import type { Request, Response } from 'express';
import * as addressService from './address.service.js';
import {
  createAddressBodySchema,
  updateAddressBodySchema,
  addressIdParamSchema,
} from './address.schema.js';
import { sendSuccess } from '../../common/response.js';
import { getAuthUser } from '../../middleware/auth.js';

function parseAddressId(req: Request): number {
  return addressIdParamSchema.parse(req.params).addressId;
}

export async function list(req: Request, res: Response): Promise<void> {
  const addresses = await addressService.listAddresses(getAuthUser(req).userId);
  sendSuccess({ res, message: 'Addresses retrieved', data: addresses });
}

export async function create(req: Request, res: Response): Promise<void> {
  const body = createAddressBodySchema.parse(req.body);
  const address = await addressService.createAddress(getAuthUser(req).userId, body);
  sendSuccess({
    res,
    message: 'Address created',
    data: address,
    statusCode: 201,
  });
}

export async function update(req: Request, res: Response): Promise<void> {
  const addressId = parseAddressId(req);
  const body = updateAddressBodySchema.parse(req.body);
  const address = await addressService.updateAddress(
    addressId,
    getAuthUser(req).userId,
    body,
  );
  sendSuccess({ res, message: 'Address updated', data: address });
}

export async function remove(req: Request, res: Response): Promise<void> {
  const addressId = parseAddressId(req);
  await addressService.deleteAddress(addressId, getAuthUser(req).userId);
  sendSuccess({ res, message: 'Address deleted' });
}

export async function setDefault(req: Request, res: Response): Promise<void> {
  const addressId = parseAddressId(req);
  const address = await addressService.setDefault(addressId, getAuthUser(req).userId);
  sendSuccess({ res, message: 'Default address set', data: address });
}
