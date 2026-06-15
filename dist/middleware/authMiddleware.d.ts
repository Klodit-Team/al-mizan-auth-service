import type { Request, Response, NextFunction } from 'express';
export declare const authenticate: (req: Request, res: Response, next: NextFunction) => Promise<void>;
export declare function validateSendOtp(req: Request, res: Response, next: NextFunction): void;
export declare function validateVerifyOtp(req: Request, res: Response, next: NextFunction): void;
export default authenticate;
//# sourceMappingURL=authMiddleware.d.ts.map