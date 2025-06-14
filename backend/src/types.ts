import { Request } from 'express';

    export interface AuthenticatedRequest extends Request {
      user?: {
        uid: string;
        admin?: boolean;
      };
    }