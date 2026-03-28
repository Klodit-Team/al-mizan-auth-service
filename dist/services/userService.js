import prisma from '../config/db.js';
export const findByEmail = async (email) => {
    return await prisma.user.findUnique({ where: { email } });
};
export const findById = async (id) => {
    return await prisma.user.findUnique({ where: { id } });
};
export const createUser = async (email, password, role) => {
    return await prisma.user.create({ data: { email, password, role: role } });
};
export default { findByEmail, findById, createUser };
//# sourceMappingURL=userService.js.map