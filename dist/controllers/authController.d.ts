import type { Request, Response } from 'express';
export declare const register: (req: Request, res: Response) => Promise<void>;
export declare const login: (req: Request, res: Response) => Promise<void>;
export declare const refresh: (req: Request, res: Response) => Promise<void>;
export declare const logout: (req: Request, res: Response) => Promise<void>;
export declare const logoutAll: (req: Request, res: Response) => Promise<void>;
export declare const me: (req: Request, res: Response) => Promise<void>;
export declare const sessions: (req: Request, res: Response) => Promise<void>;
export declare const deleteSession: (req: Request, res: Response) => Promise<void>;
export declare const forgotPassword: (req: Request, res: Response) => Promise<void>;
export declare const verifyResetToken: (req: Request, res: Response) => Promise<void>;
export declare const resetPassword: (req: Request, res: Response) => Promise<void>;
export declare class OtpController {
    send(req: Request, res: Response): Promise<void>;
    verify(req: Request, res: Response): void;
}
export declare const changePassword: (req: Request, res: Response) => Promise<void>;
declare const _default: {
    register: (req: Request, res: Response) => Promise<void>;
    OtpController: typeof OtpController;
    login: (req: Request, res: Response) => Promise<void>;
    refresh: (req: Request, res: Response) => Promise<void>;
    logout: (req: Request, res: Response) => Promise<void>;
    logoutAll: (req: Request, res: Response) => Promise<void>;
    me: (req: Request, res: Response) => Promise<void>;
    sessions: (req: Request, res: Response) => Promise<void>;
    deleteSession: (req: Request, res: Response) => Promise<void>;
    forgotPassword: (req: Request, res: Response) => Promise<void>;
    verifyResetToken: (req: Request, res: Response) => Promise<void>;
    resetPassword: (req: Request, res: Response) => Promise<void>;
    changePassword: (req: Request, res: Response) => Promise<void>;
};
export default _default;
//# sourceMappingURL=authController.d.ts.map