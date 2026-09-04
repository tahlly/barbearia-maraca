declare global {
  namespace Express {
    interface Request {
      user?: {
        id: string;
        tipo: string;
        role: string;
      };
    }
  }
}

export {};
