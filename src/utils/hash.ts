import bcrypt, { hash } from "bcrypt";

const SALT_ROUND = 10;

export const hashPassword = async (plainPassword: string) => {
  return await bcrypt.hash(plainPassword, SALT_ROUND);
};

export const comparePassword = async (plainPassword: string, hash: string) => {
  return await bcrypt.compare(plainPassword, hash);
};
