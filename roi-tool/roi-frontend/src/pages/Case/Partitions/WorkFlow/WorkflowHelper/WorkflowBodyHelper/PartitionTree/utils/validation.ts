export const isValidHex = (v: string): boolean => /^#([0-9a-fA-F]{3,8})$/.test(v);
